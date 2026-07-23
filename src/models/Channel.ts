import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChannelDocument extends Document {
  telegramChatId: string;
  title: string;
  inviteLink: string;
  connectedAt: Date;
  lastSyncAt?: Date;
}

const ChannelSchema = new Schema<IChannelDocument>(
  {
    telegramChatId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    inviteLink: { type: String, required: true },
    connectedAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date },
  },
  { timestamps: true }
);

export const ChannelModel: Model<IChannelDocument> =
  mongoose.models.Channel || mongoose.model<IChannelDocument>('Channel', ChannelSchema);
