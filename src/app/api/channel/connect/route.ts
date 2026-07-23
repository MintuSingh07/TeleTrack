import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import { connectAndValidateChannel } from '@/lib/telegram/channel';
import { syncChannelVideos } from '@/lib/telegram/sync';
import { ChannelModel } from '@/models/Channel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ConnectChannelSchema = z.object({
  inviteLink: z.string().min(5, 'Telegram invite link or channel username is required'),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.telegramSession) {
      return NextResponse.json({ error: 'Unauthorized. Please login to Telegram.' }, { status: 401 });
    }

    const body = await request.json();
    const { inviteLink } = ConnectChannelSchema.parse(body);

    await connectToDatabase();

    // Validate channel & join if permitted
    const channelData = await connectAndValidateChannel(session.telegramSession, inviteLink);

    // Upsert channel in database
    const channel = await ChannelModel.findOneAndUpdate(
      { telegramChatId: channelData.telegramChatId },
      {
        telegramChatId: channelData.telegramChatId,
        title: channelData.title,
        inviteLink: channelData.inviteLink,
        connectedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Trigger initial video sync
    let syncResult = { syncedCount: 0, newCount: 0 };
    try {
      syncResult = await syncChannelVideos(session.telegramSession, channel.telegramChatId, channel.inviteLink);
    } catch (syncErr) {
      console.warn('Initial sync warning:', syncErr);
    }

    return NextResponse.json({
      success: true,
      channel,
      syncResult,
      message: `Channel "${channel.title}" connected successfully! Initial sync completed with ${syncResult.newCount} new videos.`,
    });
  } catch (error: any) {
    console.error('Channel connect error:', error);
    return NextResponse.json({ error: error.message || 'Failed to connect channel' }, { status: 400 });
  }
}
