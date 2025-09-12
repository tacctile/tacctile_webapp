import FB from 'fb';
import { SocialAccount } from '../../services/social/AccountManager';

interface FacebookCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
}

export class FacebookService {
  private initialized = false;

  async testConnection(credentials: FacebookCredentials): Promise<SocialAccount> {
    try {
      // Set the access token
      if (credentials.accessToken) {
        FB.setAccessToken(credentials.accessToken);
        this.initialized = true;
      } else {
        throw new Error('Access token is required for Facebook connection');
      }

      // Test the connection by getting user info
      const user = await new Promise<any>((resolve, reject) => {
        FB.api('/me', { fields: 'id,name,picture.type(large),verified' }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });

      return {
        platform: 'facebook',
        username: user.id,
        displayName: user.name,
        profileImage: user.picture?.data?.url,
        isVerified: user.verified || false,
      };
    } catch (error) {
      throw new Error(`Facebook connection failed: ${error.message}`);
    }
  }

  async shareContent(content: {
    message: string;
    link?: string;
    mediaUrl?: string;
    pageId?: string; // For posting to a page instead of personal profile
  }): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.initialized) {
      throw new Error('Facebook client not initialized');
    }

    try {
      const endpoint = content.pageId ? `/${content.pageId}/feed` : '/me/feed';
      
      const postData: any = {
        message: content.message,
      };

      if (content.link) {
        postData.link = content.link;
      }

      const response = await new Promise<any>((resolve, reject) => {
        FB.api(endpoint, 'post', postData, (response: any) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });

      return {
        success: true,
        postId: response.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to share on Facebook: ${error.message}`,
      };
    }
  }

  async sharePhoto(photo: {
    message: string;
    photoUrl: string;
    pageId?: string;
  }): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.initialized) {
      throw new Error('Facebook client not initialized');
    }

    try {
      const endpoint = photo.pageId ? `/${photo.pageId}/photos` : '/me/photos';
      
      const response = await new Promise<any>((resolve, reject) => {
        FB.api(endpoint, 'post', {
          message: photo.message,
          url: photo.photoUrl,
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });

      return {
        success: true,
        postId: response.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to share photo on Facebook: ${error.message}`,
      };
    }
  }

  async getProfile(): Promise<SocialAccount | null> {
    if (!this.initialized) return null;

    try {
      const user = await new Promise<any>((resolve, reject) => {
        FB.api('/me', { fields: 'id,name,picture.type(large),verified' }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });

      return {
        platform: 'facebook',
        username: user.id,
        displayName: user.name,
        profileImage: user.picture?.data?.url,
        isVerified: user.verified || false,
      };
    } catch (error) {
      console.error('Failed to get Facebook profile:', error);
      return null;
    }
  }

  async getPages(): Promise<Array<{ id: string; name: string; accessToken: string }>> {
    if (!this.initialized) return [];

    try {
      const response = await new Promise<any>((resolve, reject) => {
        FB.api('/me/accounts', { fields: 'id,name,access_token' }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });

      return response.data?.map((page: any) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
      })) || [];
    } catch (error) {
      console.error('Failed to get Facebook pages:', error);
      return [];
    }
  }

  async getGroups(): Promise<Array<{ id: string; name: string; privacy: string }>> {
    if (!this.initialized) return [];

    try {
      const response = await new Promise<any>((resolve, reject) => {
        FB.api('/me/groups', { fields: 'id,name,privacy' }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        });
      });

      return response.data?.map((group: any) => ({
        id: group.id,
        name: group.name,
        privacy: group.privacy,
      })) || [];
    } catch (error) {
      console.error('Failed to get Facebook groups:', error);
      return [];
    }
  }

  async revokeTokens(credentials: FacebookCredentials): Promise<void> {
    try {
      if (this.initialized && credentials.accessToken) {
        // Revoke the access token
        await new Promise<void>((resolve, reject) => {
          FB.api('/me/permissions', 'delete', (response: any) => {
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve();
            }
          });
        });
      }
      this.initialized = false;
      console.log('Facebook tokens revoked');
    } catch (error) {
      console.error('Failed to revoke Facebook tokens:', error);
      throw error;
    }
  }

  disconnect(): void {
    this.initialized = false;
    FB.setAccessToken('');
  }
}