import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ProgressModel } from '@/models/Progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    await connectToDatabase();

    const { status, watchPercentage, lastPosition, notes, rating, isFavorite } = body;

    const updateFields: any = {
      lastWatchedAt: new Date(),
    };

    if (status !== undefined) updateFields.status = status;
    if (watchPercentage !== undefined) {
      updateFields.watchPercentage = Math.min(100, Math.max(0, Number(watchPercentage)));
      if (updateFields.watchPercentage >= 90) {
        updateFields.status = 'completed';
      } else if (updateFields.watchPercentage > 0 && (!status || status === 'not_started')) {
        updateFields.status = 'watching';
      }
    }

    if (updateFields.status === 'completed' || (watchPercentage !== undefined && Number(watchPercentage) >= 90)) {
      updateFields.status = 'completed';
      updateFields.watchPercentage = 100;
      updateFields.completedAt = new Date();
    }

    if (lastPosition !== undefined) updateFields.lastPosition = Number(lastPosition);
    if (notes !== undefined) updateFields.notes = String(notes);
    if (rating !== undefined) updateFields.rating = Math.min(5, Math.max(0, Number(rating)));
    if (isFavorite !== undefined) updateFields.isFavorite = Boolean(isFavorite);

    const progress = await ProgressModel.findOneAndUpdate(
      { videoId: id },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error: any) {
    console.error('Update progress error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update progress' }, { status: 500 });
  }
}
