import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVideoDocument extends Document {
  telegramChatId: string;
  telegramMessageId: number;
  mediaType: 'video' | 'pdf' | 'audio' | 'image' | 'document' | 'other';
  title: string;
  caption: string;
  uploadDate: Date;
  duration: number; // in seconds
  fileSize: number; // in bytes
  mimeType: string;
  fileName?: string;
  documentId?: string;
  accessHash?: string;
  fileReference?: string;
  thumbnailBuffer?: Buffer;
  thumbnailMimeType?: string;
}

const VideoSchema = new Schema<IVideoDocument>(
  {
    telegramChatId: { type: String, required: true, index: true },
    telegramMessageId: { type: Number, required: true },
    mediaType: {
      type: String,
      enum: ['video', 'pdf', 'audio', 'image', 'document', 'other'],
      default: 'video',
      index: true,
    },
    title: { type: String, required: true },
    caption: { type: String, default: '' },
    uploadDate: { type: Date, required: true, index: true },
    duration: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'video/mp4' },
    fileName: { type: String, default: '' },
    documentId: { type: String },
    accessHash: { type: String },
    fileReference: { type: String },
    thumbnailBuffer: { type: Buffer },
    thumbnailMimeType: { type: String, default: 'image/jpeg' },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per channel message
VideoSchema.index({ telegramChatId: 1, telegramMessageId: 1 }, { unique: true });

export const VideoModel: Model<IVideoDocument> =
  mongoose.models.Video || mongoose.model<IVideoDocument>('Video', VideoSchema);
