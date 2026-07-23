import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPhoneCode, verify2FA, getTelegramMe } from '@/lib/telegram/auth';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  code: z.string().optional(),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session.phoneNumber || !session.phoneCodeHash || !session.tempSession) {
      return NextResponse.json({ error: 'Session expired. Please request a new OTP code.' }, { status: 400 });
    }

    const body = await request.json();
    const { code, password } = VerifySchema.parse(body);

    let sessionString = '';
    let is2FARequired = false;

    if (password) {
      // 2FA verification flow
      const res = await verify2FA({
        sessionString: session.tempSession,
        password,
      });
      sessionString = res.sessionString;
    } else if (code) {
      // Code verification flow
      const res = await verifyPhoneCode({
        sessionString: session.tempSession,
        phoneNumber: session.phoneNumber,
        phoneCodeHash: session.phoneCodeHash,
        code,
      });
      sessionString = res.sessionString;
      is2FARequired = !!res.is2FARequired;
      if (is2FARequired && res.sessionString) {
        // Save the updated tempSession in case 2FA step follows
        session.tempSession = res.sessionString;
        await session.save();
      }
    } else {
      return NextResponse.json({ error: 'Verification code or 2FA password is required' }, { status: 400 });
    }

    if (is2FARequired) {
      return NextResponse.json({
        success: false,
        requires2FA: true,
        message: 'Two-Step Verification password is required.',
      });
    }

    if (!sessionString) {
      return NextResponse.json({ error: 'Failed to generate session' }, { status: 500 });
    }

    // Fetch Telegram User Info
    const me = await getTelegramMe(sessionString);

    session.telegramSession = sessionString;
    session.tempSession = undefined; // clear temporary session state
    session.isLoggedIn = true;
    session.user = {
      id: me.id.toString(),
      firstName: me.firstName || '',
      lastName: me.lastName || '',
      username: me.username || '',
      phone: me.phone || session.phoneNumber,
    };
    await session.save();

    return NextResponse.json({
      success: true,
      user: session.user,
      message: 'Successfully authenticated with Telegram!',
    });
  } catch (error: any) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed' },
      { status: 400 }
    );
  }
}
