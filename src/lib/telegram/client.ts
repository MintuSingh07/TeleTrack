import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '';

declare global {
  // eslint-disable-next-line no-var
  var telegramClientCache: Map<string, TelegramClient> | undefined;
}

if (!global.telegramClientCache) {
  global.telegramClientCache = new Map<string, TelegramClient>();
}

export function createTelegramClient(sessionString = ''): TelegramClient {
  if (!API_ID || !API_HASH) {
    console.warn('TELEGRAM_API_ID or TELEGRAM_API_HASH environment variables are not configured.');
  }

  const stringSession = new StringSession(sessionString);
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: false,
    autoReconnect: true,
    timeout: 15,
  });

  client.setLogLevel('none' as any);
  return client;
}

export async function getConnectedTelegramClient(sessionString: string): Promise<TelegramClient> {
  const cacheKey = sessionString.slice(-32);
  const existingClient = global.telegramClientCache?.get(cacheKey);

  if (existingClient && (existingClient as any)._connected) {
    return existingClient;
  }

  const client = createTelegramClient(sessionString);
  await client.connect();

  if (global.telegramClientCache && cacheKey) {
    global.telegramClientCache.set(cacheKey, client);
  }

  return client;
}
