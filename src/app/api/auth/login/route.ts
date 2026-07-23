import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPhoneCode } from '@/lib/telegram/auth';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  phoneNumber: z.string().min(8, 'Please enter a valid phone number with country code (e.g. +1234567890)'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { phoneNumber } = parsed.data;
    const { phoneCodeHash, sessionString } = await requestPhoneCode(phoneNumber);

    const session = await getSession();
    session.phoneNumber = phoneNumber;
    session.phoneCodeHash = phoneCodeHash;
    session.tempSession = sessionString;
    session.isLoggedIn = false;
    await session.save();

    return NextResponse.json({
      success: true,
      message: 'OTP verification code sent to your Telegram account.',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
