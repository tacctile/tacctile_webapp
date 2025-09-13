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
  details?: Record<string, unknown>;
}

export class SocialApiErrorClass extends Error implements SocialApiError {
  public platform: string;
  public code: string;
  public details?: Record<string, unknown>;

  constructor(error: SocialApiError) {
    super(error.message);
    this.name = 'SocialApiError';
    this.platform = error.platform;
    this.code = error.code;
    this.details = error.details;
  }
}