import { createTelegramClient } from './client';
import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions';

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '';

export async function requestPhoneCode(phoneNumber: string): Promise<{ phoneCodeHash: string; sessionString: string }> {
  const client = createTelegramClient('');
  await client.connect();

  try {
    const res = await client.sendCode(
      {
        apiId: API_ID,
        apiHash: API_HASH,
      },
      phoneNumber
    );

    const sessionString = (client.session as StringSession).save();
    await client.disconnect();
    return { phoneCodeHash: res.phoneCodeHash, sessionString };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function verifyPhoneCode({
  sessionString: initialSessionString,
  phoneNumber,
  phoneCodeHash,
  code,
}: {
  sessionString: string;
  phoneNumber: string;
  phoneCodeHash: string;
  code: string;
}): Promise<{ sessionString: string; is2FARequired?: boolean; user?: any }> {
  // Pass the sessionString saved during requestPhoneCode to maintain MTProto session context
  const client = createTelegramClient(initialSessionString);
  await client.connect();

  try {
    const user = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    const sessionString = (client.session as StringSession).save();
    await client.disconnect();

    return { sessionString, user };
  } catch (error: any) {
    await client.disconnect();
    if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return { sessionString: initialSessionString, is2FARequired: true };
    }
    throw error;
  }
}

export async function verify2FA({
  sessionString: initialSessionString,
  password,
}: {
  sessionString: string;
  password: string;
}): Promise<{ sessionString: string; user?: any }> {
  const client = createTelegramClient(initialSessionString);
  await client.connect();

  try {
    const user = await client.signInWithPassword(
      {
        apiId: API_ID,
        apiHash: API_HASH,
      },
      {
        password: () => Promise.resolve(password),
        onError: (err) => {
          throw err;
        },
      }
    );

    const sessionString = (client.session as StringSession).save();
    await client.disconnect();

    return { sessionString, user };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function getTelegramMe(sessionString: string) {
  const client = createTelegramClient(sessionString);
  await client.connect();

  try {
    const me = await client.getMe();
    await client.disconnect();
    return me;
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}
