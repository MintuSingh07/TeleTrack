export interface IChannel {
  _id?: string;
  telegramChatId: string;
  title: string;
  inviteLink: string;
  connectedAt: string | Date;
  lastSyncAt?: string | Date;
}

export type MediaType = 'video' | 'pdf' | 'audio' | 'image' | 'document' | 'other';

export interface IVideo {
  _id: string;
  telegramChatId: string;
  telegramMessageId: number;
  mediaType: MediaType;
  title: string;
  caption: string;
  uploadDate: string;
  duration: number; // in seconds
  fileSize: number; // in bytes
  mimeType: string;
  fileName?: string;
  documentId?: string;
  accessHash?: string;
  thumbnailUrl?: string;
  progress?: IProgress;
}

export interface IProgress {
  _id?: string;
  videoId: string;
  status: 'not_started' | 'watching' | 'completed';
  watchPercentage: number; // 0 to 100
  lastPosition: number; // in seconds
  lastWatchedAt?: string | Date;
  notes: string;
  rating: number; // 0 to 5
  isFavorite: boolean;
}

export interface IDashboardStats {
  totalVideos: number;
  completedVideos: number;
  watchingVideos: number;
  remainingVideos: number;
  completionPercentage: number;
  totalHoursWatched: number;
  favoriteVideosCount: number;
  totalPdfs: number;
  totalOthers: number;
}

export interface ITelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

export interface ISessionData {
  telegramSession?: string;
  tempSession?: string;
  phoneCodeHash?: string;
  phoneNumber?: string;
  user?: ITelegramUser;
  isLoggedIn?: boolean;
}
