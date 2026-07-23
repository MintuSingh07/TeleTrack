import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ChannelModel } from '@/models/Channel';
import { syncChannelVideos } from '@/lib/telegram/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.telegramSession) {
      return NextResponse.json({ error: 'Unauthorized. Please login.' }, { status: 401 });
    }

    await connectToDatabase();
    const activeChannel = await ChannelModel.findOne();

    if (!activeChannel) {
      return NextResponse.json({ error: 'No Telegram channel connected.' }, { status: 400 });
    }

    const syncResult = await syncChannelVideos(
      session.telegramSession,
      activeChannel.telegramChatId,
      activeChannel.inviteLink
    );

    return NextResponse.json({
      success: true,
      syncedCount: syncResult.syncedCount,
      newCount: syncResult.newCount,
      lastSyncAt: new Date(),
      message: `Sync completed! ${syncResult.newCount} new videos imported.`,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
