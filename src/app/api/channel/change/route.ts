import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ChannelModel } from '@/models/Channel';
import { VideoModel } from '@/models/Video';
import { ProgressModel } from '@/models/Progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Clear connected channel and imported videos
    await ChannelModel.deleteMany({});
    await VideoModel.deleteMany({});
    await ProgressModel.deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'Channel disconnected. You can now configure a new channel.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
