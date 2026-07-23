import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProgressDocument extends Document {
  videoId: mongoose.Types.ObjectId;
  status: 'not_started' | 'watching' | 'completed';
  watchPercentage: number;
  lastPosition: number;
  lastWatchedAt?: Date;
  completedAt?: Date;
  notes: string;
  rating: number;
  isFavorite: boolean;
}

const ProgressSchema = new Schema<IProgressDocument>(
  {
    videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['not_started', 'watching', 'completed'],
      default: 'not_started',
    },
    watchPercentage: { type: Number, default: 0, min: 0, max: 100 },
    lastPosition: { type: Number, default: 0 },
    lastWatchedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String, default: '' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ProgressModel: Model<IProgressDocument> =
  mongoose.models.Progress || mongoose.model<IProgressDocument>('Progress', ProgressSchema);
