import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { ISessionData } from '@/types';

export const SESSION_OPTIONS = {
  cookieName: 'tg_video_tracker_session',
  password: process.env.SESSION_SECRET || 'fallback_secret_must_be_at_least_32_characters_long_for_security',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<ISessionData>(cookieStore, SESSION_OPTIONS);
  return session;
}
