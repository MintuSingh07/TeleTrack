import { createTelegramClient } from './client';
import { Api } from 'telegram';

export function extractInviteHashOrUsername(inviteLink: string): { hash?: string; username?: string } {
  const trimmed = inviteLink.trim();
  
  // Example: https://t.me/+MuEd5ZMJiggxNWY1 or https://t.me/joinchat/MuEd5ZMJiggxNWY1
  const plusMatch = trimmed.match(/t\.me\/\+([a-zA-Z0-9_-]+)/);
  if (plusMatch) return { hash: plusMatch[1] };

  const joinChatMatch = trimmed.match(/t\.me\/joinchat\/([a-zA-Z0-9_-]+)/);
  if (joinChatMatch) return { hash: joinChatMatch[1] };

  // Example: https://t.me/channel_username or channel_username
  const usernameMatch = trimmed.match(/(?:t\.me\/|@)?([a-zA-Z0-9_]{5,})/);
  if (usernameMatch) return { username: usernameMatch[1] };

  return {};
}

export async function connectAndValidateChannel(
  sessionString: string,
  inviteLink: string
): Promise<{ telegramChatId: string; title: string; inviteLink: string }> {
  const client = createTelegramClient(sessionString);
  await client.connect();

  try {
    const { hash, username } = extractInviteHashOrUsername(inviteLink);

    if (!hash && !username) {
      throw new Error('Invalid Telegram channel invite link or username format.');
    }

    let entity: any;

    if (hash) {
      // Check or import invite link
      try {
        const checkResult = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        
        if (checkResult.className === 'ChatInviteAlready') {
          entity = (checkResult as any).chat;
        } else if (checkResult.className === 'ChatInvite') {
          // Join the channel
          const updates = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
          entity = (updates as any).chats?.[0];
        }
      } catch (err: any) {
        if (err.errorMessage === 'USER_ALREADY_PARTICIPANT') {
          // Try to get channel by hash or search
          const chats = await client.getDialogs({});
          const found = chats.find((d: any) => d.entity);
          if (found) entity = found.entity;
        } else {
          throw err;
        }
      }
    } else if (username) {
      entity = await client.getEntity(username);
    }

    if (!entity) {
      throw new Error('Unable to resolve channel from provided link.');
    }

    const telegramChatId = entity.id?.toString() || entity.channelId?.toString();
    const title = entity.title || 'Telegram Channel';

    await client.disconnect();
    return {
      telegramChatId,
      title,
      inviteLink,
    };
  } catch (error: any) {
    await client.disconnect();
    throw new Error(error.message || 'Failed to connect to Telegram channel');
  }
}
