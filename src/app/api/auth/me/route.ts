import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ChannelModel } from '@/models/Channel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.telegramSession) {
      return NextResponse.json({ isLoggedIn: false }, { status: 401 });
    }

    await connectToDatabase();
    const activeChannel = await ChannelModel.findOne();

    return NextResponse.json({
      isLoggedIn: true,
      user: session.user,
      hasChannel: !!activeChannel,
      channel: activeChannel
        ? {
            id: activeChannel._id,
            telegramChatId: activeChannel.telegramChatId,
            title: activeChannel.title,
            inviteLink: activeChannel.inviteLink,
            connectedAt: activeChannel.connectedAt,
            lastSyncAt: activeChannel.lastSyncAt,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
