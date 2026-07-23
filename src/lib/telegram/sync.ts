import { createTelegramClient } from './client';
import { Api } from 'telegram';
import { connectToDatabase } from '../db/mongodb';
import { VideoModel } from '@/models/Video';
import { ProgressModel } from '@/models/Progress';
import { ChannelModel } from '@/models/Channel';
import { extractInviteHashOrUsername } from './channel';

export async function syncChannelVideos(
  sessionString: string,
  telegramChatId: string,
  inviteLink?: string
): Promise<{ syncedCount: number; newCount: number }> {
  await connectToDatabase();
  const client = createTelegramClient(sessionString);
  await client.connect();

  let syncedCount = 0;
  let newCount = 0;

  try {
    let entity: any;

    // 1. Fetch user dialogs to populate GramJS entity cache
    const dialogs = await client.getDialogs({});
    const foundInDialogs = dialogs.find((d: any) => {
      if (!d.entity) return false;
      const idStr = d.entity.id?.toString() || d.entity.channelId?.toString();
      return idStr === telegramChatId;
    });

    if (foundInDialogs) {
      entity = foundInDialogs.entity;
    } else if (inviteLink) {
      const { hash, username } = extractInviteHashOrUsername(inviteLink);
      if (hash) {
        try {
          const checkResult = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
          if ((checkResult as any).chat) {
            entity = (checkResult as any).chat;
          }
        } catch (e: any) {
          console.warn('CheckChatInvite warning in sync:', e.message);
        }
      } else if (username) {
        try {
          entity = await client.getEntity(username);
        } catch (e: any) {
          console.warn('GetEntity username warning in sync:', e.message);
        }
      }
    }

    if (!entity) {
      try {
        entity = await client.getEntity(telegramChatId);
      } catch (err: any) {
        console.error('Entity resolution failed:', err);
        throw new Error(`Unable to access Telegram channel (ID: ${telegramChatId}).`);
      }
    }

    // Paginate through ALL channel messages
    let offsetId = 0;
    let keepFetching = true;

    while (keepFetching) {
      const messages: any = await client.getMessages(entity, {
        limit: 100,
        offsetId: offsetId,
      });

      if (!messages || messages.length === 0) {
        keepFetching = false;
        break;
      }

      for (const msg of messages) {
        if (!msg) continue;

        const media = msg.media;
        const doc = msg.document || (media && (media as any).className === 'MessageMediaDocument' ? (media as any).document : null);
        const photo = media && (media as any).className === 'MessageMediaPhoto' ? (media as any).photo : null;
        const textCaption = msg.text || '';

        // If message has no media and no text, skip
        if (!doc && !photo && !textCaption.trim()) continue;

        let mediaType: 'video' | 'pdf' | 'audio' | 'image' | 'document' | 'other' = 'other';
        let mimeType = 'text/plain';
        let fileSize = 0;
        let duration = 0;
        let fileName = '';

        if (doc) {
          mimeType = (doc.mimeType || '').toLowerCase();
          fileSize = doc.size ? Number(doc.size) : 0;
          const attributes = doc.attributes || [];
          const videoAttr = attributes.find((attr: any) => attr.className === 'DocumentAttributeVideo');
          const audioAttr = attributes.find((attr: any) => attr.className === 'DocumentAttributeAudio');
          const fileNameAttr = attributes.find((attr: any) => attr.className === 'DocumentAttributeFilename');

          fileName = fileNameAttr?.fileName || '';

          if (mimeType.startsWith('video/') || videoAttr) {
            mediaType = 'video';
            duration = videoAttr?.duration || 0;
          } else if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            mediaType = 'pdf';
          } else if (mimeType.startsWith('audio/') || audioAttr) {
            mediaType = 'audio';
            duration = audioAttr?.duration || 0;
          } else if (mimeType.startsWith('image/')) {
            mediaType = 'image';
          } else {
            mediaType = 'document';
          }
        } else if (photo) {
          mediaType = 'image';
          mimeType = 'image/jpeg';
        } else if (textCaption) {
          mediaType = 'other';
        }

        const fallbackTitle = fileName || (mediaType === 'other' ? textCaption.substring(0, 60) : `${mediaType.toUpperCase()} #${msg.id}`);
        const title = textCaption.split('\n')[0].substring(0, 120) || fallbackTitle;

        // Download thumbnail if available
        let thumbnailBuffer: Buffer | undefined;
        if (media) {
          try {
            const thumbResult = await client.downloadMedia(media, { thumb: 0 });
            if (thumbResult) {
              thumbnailBuffer = Buffer.from(thumbResult);
            }
          } catch (tErr) {
            // Ignore thumbnail failures
          }
        }

        const documentId = doc?.id?.toString();
        const accessHash = doc?.accessHash?.toString();
        const fileReference = doc?.fileReference ? Buffer.from(doc.fileReference).toString('hex') : undefined;
        const uploadDate = new Date(msg.date * 1000);

        // Upsert Item in MongoDB
        const filter = { telegramChatId, telegramMessageId: msg.id };
        const update = {
          telegramChatId,
          telegramMessageId: msg.id,
          mediaType,
          title,
          caption: textCaption,
          uploadDate,
          duration: Math.round(duration),
          fileSize,
          mimeType,
          fileName,
          documentId,
          accessHash,
          fileReference,
          ...(thumbnailBuffer ? { thumbnailBuffer } : {}),
        };

        const existingVideo = await VideoModel.findOne(filter);
        const savedVideo = await VideoModel.findOneAndUpdate(filter, update, {
          upsert: true,
          new: true,
        });

        if (!existingVideo) {
          newCount++;
          await ProgressModel.create({
            videoId: savedVideo._id,
            status: 'not_started',
            watchPercentage: 0,
            lastPosition: 0,
            notes: '',
            rating: 0,
            isFavorite: false,
          });
        }

        syncedCount++;
      }

      // Move offsetId to last message ID in batch
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.id) {
        if (offsetId === lastMsg.id) break; // prevent infinite loop
        offsetId = lastMsg.id;
      } else {
        break;
      }
    }

    await ChannelModel.findOneAndUpdate(
      { telegramChatId },
      { lastSyncAt: new Date() }
    );

    await client.disconnect();
    return { syncedCount, newCount };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}
