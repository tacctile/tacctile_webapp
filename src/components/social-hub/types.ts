export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SocialPlatform {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface SocialAccount {
  platform: string;
  username: string;
  displayName: string;
  profileImage?: string;
  followerCount?: number;
  isVerified?: boolean;
}

export interface ShareOptions {
  title: string;
  description: string;
  mediaUrl?: string;
  tags?: string[];
  privacy: 'public' | 'private' | 'unlisted';
}

export interface SocialApiError {
  platform: string;
  code: string;
  message: string;
  details?: any;
}