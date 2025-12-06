/**
 * Cloud Storage Service
 * Storage-agnostic interface for Google Drive, Dropbox, and OneDrive
 * User picks their provider - we never store media on our servers (zero liability)
 *
 * Features:
 * - Proactive token refresh: checks token validity before every API request
 * - Reactive token refresh: retries on 401 with fresh token
 * - Event emission for reconnection when refresh fails
 * - PKCE-based OAuth for Dropbox and OneDrive (no client secret needed)
 */

import { cloudStorageConfig } from '@/config';
import type {
  CloudStorageProvider,
  CloudStorageConfig,
  CloudFile,
  CloudFolder,
  UploadProgress,
  CloudStorageQuota,
  StorageError,
} from '@/types';
import {
  tokenManager,
  TokenManager,
  generateCodeVerifier,
  generateCodeChallenge,
  type TokenInfo,
  type TokenEvent,
  type TokenEventListener,
} from './TokenManager';

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface CloudStorageProviderInterface {
  /**
   * Initialize the provider and handle OAuth
   */
  authenticate(): Promise<CloudStorageConfig>;

  /**
   * Refresh access token
   */
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }>;

  /**
   * List files in a folder
   */
  listFiles(folderId?: string): Promise<(CloudFile | CloudFolder)[]>;

  /**
   * Get file metadata
   */
  getFile(fileId: string): Promise<CloudFile>;

  /**
   * Download file content
   */
  downloadFile(fileId: string): Promise<Blob>;

  /**
   * Upload a file
   */
  uploadFile(
    file: File,
    folderId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile>;

  /**
   * Create a folder
   */
  createFolder(name: string, parentId?: string): Promise<CloudFolder>;

  /**
   * Delete a file or folder
   */
  delete(fileId: string): Promise<void>;

  /**
   * Get storage quota
   */
  getQuota(): Promise<CloudStorageQuota>;

  /**
   * Get shareable link
   */
  getShareableLink(fileId: string): Promise<string>;

  /**
   * Revoke access
   */
  revokeAccess(): Promise<void>;
}

// ============================================================================
// GOOGLE DRIVE PROVIDER
// ============================================================================

class GoogleDriveProvider implements CloudStorageProviderInterface {
  private readonly provider: CloudStorageProvider = 'google_drive';
  private readonly tokenMgr: TokenManager;
  private gapiInitialized = false;

  constructor(tokenMgr: TokenManager = tokenManager) {
    this.tokenMgr = tokenMgr;

    // Register refresh handler
    this.tokenMgr.registerRefreshHandler('google_drive', async () => {
      return this.refreshToken('');
    });
  }

  setAccessToken(token: string, refreshToken = '', expiresAt?: Date): void {
    this.tokenMgr.setTokens(this.provider, {
      accessToken: token,
      refreshToken,
      expiresAt: expiresAt || new Date(Date.now() + 3600 * 1000),
      provider: this.provider,
    });
  }

  async authenticate(): Promise<CloudStorageConfig> {
    return new Promise((resolve, reject) => {
      const { clientId, scopes } = cloudStorageConfig.google;

      if (!clientId) {
        reject(new Error('Google Client ID not configured'));
        return;
      }

      // Load Google API client
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('client:auth2', async () => {
          try {
            await gapi.client.init({
              clientId,
              scope: scopes.join(' '),
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });

            this.gapiInitialized = true;

            const authInstance = gapi.auth2.getAuthInstance();
            const user = await authInstance.signIn();
            const authResponse = user.getAuthResponse(true);

            const tokenInfo: TokenInfo = {
              provider: this.provider,
              accessToken: authResponse.access_token,
              refreshToken: authResponse.id_token, // Google uses ID token for refresh in implicit flow
              expiresAt: new Date(authResponse.expires_at),
            };

            this.tokenMgr.setTokens(this.provider, tokenInfo);

            resolve({
              provider: this.provider,
              accessToken: authResponse.access_token,
              refreshToken: authResponse.id_token,
              expiresAt: new Date(authResponse.expires_at),
            });
          } catch (error) {
            reject(error);
          }
        });
      };
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.body.appendChild(script);
    });
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
    // Ensure gapi is loaded
    if (!this.gapiInitialized) {
      await this.loadGapi();
    }

    const authInstance = gapi.auth2.getAuthInstance();
    const user = authInstance.currentUser.get();
    const authResponse = await user.reloadAuthResponse();

    const result = {
      accessToken: authResponse.access_token,
      refreshToken: undefined, // Google implicit flow doesn't return new refresh token
      expiresAt: new Date(authResponse.expires_at),
    };

    this.tokenMgr.setTokens(this.provider, {
      provider: this.provider,
      accessToken: result.accessToken,
      refreshToken: this.tokenMgr.getTokens(this.provider)?.refreshToken || '',
      expiresAt: result.expiresAt,
    });

    return result;
  }

  private async loadGapi(): Promise<void> {
    if (this.gapiInitialized) return;

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
      if (existing) {
        // Already loaded, just init
        gapi.load('client:auth2', async () => {
          try {
            const { clientId, scopes } = cloudStorageConfig.google;
            await gapi.client.init({
              clientId,
              scope: scopes.join(' '),
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            this.gapiInitialized = true;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('client:auth2', async () => {
          try {
            const { clientId, scopes } = cloudStorageConfig.google;
            await gapi.client.init({
              clientId,
              scope: scopes.join(' '),
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            this.gapiInitialized = true;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      };
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.body.appendChild(script);
    });
  }

  async listFiles(folderId = 'root'): Promise<(CloudFile | CloudFolder)[]> {
    return this.tokenMgr.executeWithTokenRefresh(
      this.provider,
      async () => {
        await this.loadGapi();
        const response = await gapi.client.drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webViewLink, parents)',
          pageSize: 100,
        });

        return (response.result.files || []).map((file: gapi.client.drive.File) => {
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

          if (isFolder) {
            return {
              id: file.id!,
              name: file.name!,
              provider: this.provider,
              path: `/${file.name}`,
              parentId: file.parents?.[0],
            } as CloudFolder;
          }

          return {
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            size: Number(file.size) || 0,
            createdAt: new Date(file.createdTime!),
            modifiedAt: new Date(file.modifiedTime!),
            provider: this.provider,
            path: `/${file.name}`,
            thumbnailUrl: file.thumbnailLink,
            webViewLink: file.webViewLink,
            parentId: file.parents?.[0],
          } as CloudFile;
        });
      },
      (error) => this.isAuthError(error)
    );
  }

  async getFile(fileId: string): Promise<CloudFile> {
    return this.tokenMgr.executeWithTokenRefresh(
      this.provider,
      async () => {
        await this.loadGapi();
        const response = await gapi.client.drive.files.get({
          fileId,
          fields: 'id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webViewLink, parents',
        });

        const file = response.result;
        return {
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          size: Number(file.size) || 0,
          createdAt: new Date(file.createdTime!),
          modifiedAt: new Date(file.modifiedTime!),
          provider: this.provider,
          path: `/${file.name}`,
          thumbnailUrl: file.thumbnailLink,
          webViewLink: file.webViewLink,
          parentId: file.parents?.[0],
        };
      },
      (error) => this.isAuthError(error)
    );
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const accessToken = await this.tokenMgr.ensureValidToken(this.provider);

    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      (response) => response.blob()
    );
  }

  async uploadFile(
    file: File,
    folderId = 'root',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    const accessToken = await this.tokenMgr.ensureValidToken(this.provider);

    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    return new Promise<CloudFile>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink');
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress({
              fileId: '',
              fileName: file.name,
              bytesUploaded: event.loaded,
              totalBytes: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
              status: 'uploading',
            });
          }
        };
      }

      xhr.onload = async () => {
        // Handle 401 with retry
        if (xhr.status === 401) {
          try {
            const result = await this.tokenMgr.refreshToken(this.provider);
            // Retry with new token
            const retryXhr = new XMLHttpRequest();
            retryXhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink');
            retryXhr.setRequestHeader('Authorization', `Bearer ${result.accessToken}`);

            retryXhr.onload = () => {
              if (retryXhr.status >= 200 && retryXhr.status < 300) {
                const result = JSON.parse(retryXhr.responseText);
                resolve({
                  id: result.id,
                  name: result.name,
                  mimeType: result.mimeType,
                  size: Number(result.size) || file.size,
                  createdAt: new Date(result.createdTime),
                  modifiedAt: new Date(result.modifiedTime),
                  provider: this.provider,
                  path: `/${result.name}`,
                  thumbnailUrl: result.thumbnailLink,
                  webViewLink: result.webViewLink,
                  parentId: folderId,
                });
              } else {
                reject(new Error(`Upload failed: ${retryXhr.statusText}`));
              }
            };
            retryXhr.onerror = () => reject(new Error('Upload failed on retry'));
            retryXhr.send(form);
            return;
          } catch {
            reject(new Error('Authentication failed for google_drive: token refresh required'));
            return;
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText);
          resolve({
            id: result.id,
            name: result.name,
            mimeType: result.mimeType,
            size: Number(result.size) || file.size,
            createdAt: new Date(result.createdTime),
            modifiedAt: new Date(result.modifiedTime),
            provider: this.provider,
            path: `/${result.name}`,
            thumbnailUrl: result.thumbnailLink,
            webViewLink: result.webViewLink,
            parentId: folderId,
          });
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(form);
    });
  }

  async createFolder(name: string, parentId = 'root'): Promise<CloudFolder> {
    return this.tokenMgr.executeWithTokenRefresh(
      this.provider,
      async () => {
        await this.loadGapi();
        const response = await gapi.client.drive.files.create({
          resource: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          },
          fields: 'id, name',
        });

        return {
          id: response.result.id!,
          name: response.result.name!,
          provider: this.provider,
          path: `/${name}`,
          parentId,
        };
      },
      (error) => this.isAuthError(error)
    );
  }

  async delete(fileId: string): Promise<void> {
    return this.tokenMgr.executeWithTokenRefresh(
      this.provider,
      async () => {
        await this.loadGapi();
        await gapi.client.drive.files.delete({ fileId });
      },
      (error) => this.isAuthError(error)
    );
  }

  async getQuota(): Promise<CloudStorageQuota> {
    return this.tokenMgr.executeWithTokenRefresh(
      this.provider,
      async () => {
        await this.loadGapi();
        const response = await gapi.client.drive.about.get({
          fields: 'storageQuota',
        });

        const quota = response.result.storageQuota!;
        return {
          used: Number(quota.usage) || 0,
          total: Number(quota.limit) || 0,
          provider: this.provider,
        };
      },
      (error) => this.isAuthError(error)
    );
  }

  async getShareableLink(fileId: string): Promise<string> {
    return this.tokenMgr.executeWithTokenRefresh(
      this.provider,
      async () => {
        await this.loadGapi();
        // Create sharing permission
        await gapi.client.drive.permissions.create({
          fileId,
          resource: {
            role: 'reader',
            type: 'anyone',
          },
        });

        // Get the web view link
        const response = await gapi.client.drive.files.get({
          fileId,
          fields: 'webViewLink',
        });

        return response.result.webViewLink!;
      },
      (error) => this.isAuthError(error)
    );
  }

  async revokeAccess(): Promise<void> {
    try {
      await this.loadGapi();
      const authInstance = gapi.auth2.getAuthInstance();
      await authInstance.signOut();
    } catch {
      // Ignore errors during sign out
    }
    this.tokenMgr.clearTokens(this.provider);
  }

  private isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('401') ||
        message.includes('unauthorized') ||
        message.includes('auth') ||
        message.includes('token') ||
        message.includes('expired');
    }
    return false;
  }
}

// ============================================================================
// DROPBOX PROVIDER
// ============================================================================

class DropboxProvider implements CloudStorageProviderInterface {
  private readonly provider: CloudStorageProvider = 'dropbox';
  private readonly apiBase = 'https://api.dropboxapi.com/2';
  private readonly contentBase = 'https://content.dropboxapi.com/2';
  private readonly tokenMgr: TokenManager;

  constructor(tokenMgr: TokenManager = tokenManager) {
    this.tokenMgr = tokenMgr;

    // Register refresh handler
    this.tokenMgr.registerRefreshHandler('dropbox', async (refreshToken) => {
      return this.refreshToken(refreshToken);
    });
  }

  setAccessToken(token: string, refreshToken = '', expiresAt?: Date): void {
    this.tokenMgr.setTokens(this.provider, {
      accessToken: token,
      refreshToken,
      expiresAt: expiresAt || new Date(Date.now() + 14400 * 1000), // 4 hours default
      provider: this.provider,
    });
  }

  async authenticate(): Promise<CloudStorageConfig> {
    const { clientId, redirectUri } = cloudStorageConfig.dropbox;

    if (!clientId) {
      throw new Error('Dropbox Client ID not configured');
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('dropbox_oauth_state', state);
    sessionStorage.setItem('dropbox_code_verifier', codeVerifier);

    // Build OAuth URL with PKCE (authorization code flow)
    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code'); // Use code flow instead of token
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('token_access_type', 'offline'); // Request refresh token

    // Open OAuth popup
    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'dropbox-oauth', 'width=600,height=700');

      if (!popup) {
        reject(new Error('Failed to open Dropbox authorization popup'));
        return;
      }

      const checkPopup = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(checkPopup);
            reject(new Error('Authorization cancelled'));
            return;
          }

          // Check if redirected back with code
          const popupUrl = popup.location.href;
          if (popupUrl.includes(redirectUri)) {
            clearInterval(checkPopup);
            popup.close();

            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const savedState = sessionStorage.getItem('dropbox_oauth_state');
            const savedVerifier = sessionStorage.getItem('dropbox_code_verifier');

            // Clean up
            sessionStorage.removeItem('dropbox_oauth_state');
            sessionStorage.removeItem('dropbox_code_verifier');

            if (returnedState !== savedState) {
              reject(new Error('OAuth state mismatch'));
              return;
            }

            if (!code || !savedVerifier) {
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for tokens using PKCE
            try {
              const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  code,
                  grant_type: 'authorization_code',
                  client_id: clientId,
                  redirect_uri: redirectUri,
                  code_verifier: savedVerifier,
                }),
              });

              if (!tokenResponse.ok) {
                const error = await tokenResponse.json();
                reject(new Error(error.error_description || 'Token exchange failed'));
                return;
              }

              const tokens = await tokenResponse.json();
              const expiresAt = new Date(Date.now() + (tokens.expires_in || 14400) * 1000);

              this.tokenMgr.setTokens(this.provider, {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || '',
                expiresAt,
                provider: this.provider,
              });

              resolve({
                provider: this.provider,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || '',
                expiresAt,
              });
            } catch (error) {
              reject(error);
            }
          }
        } catch {
          // Cross-origin errors are expected until redirect
        }
      }, 500);
    });
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
    const { clientId } = cloudStorageConfig.dropbox;

    if (!refreshToken) {
      throw new Error('No refresh token available for Dropbox');
    }

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Token refresh failed');
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 14400) * 1000);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken, // Dropbox may or may not return new refresh token
      expiresAt,
    };
  }

  async listFiles(folderId = ''): Promise<(CloudFile | CloudFolder)[]> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.apiBase}/files/list_folder`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: folderId || '',
            include_media_info: true,
          }),
        }),
      async (response) => {
        const data = await response.json();
        return data.entries.map((entry: DropboxEntry) => {
          if (entry['.tag'] === 'folder') {
            return {
              id: entry.id,
              name: entry.name,
              provider: this.provider,
              path: entry.path_display,
              parentId: entry.path_display.split('/').slice(0, -1).join('/') || undefined,
            } as CloudFolder;
          }

          return {
            id: entry.id,
            name: entry.name,
            mimeType: this.getMimeType(entry.name),
            size: entry.size || 0,
            createdAt: new Date(entry.client_modified || Date.now()),
            modifiedAt: new Date(entry.server_modified || Date.now()),
            provider: this.provider,
            path: entry.path_display,
            parentId: entry.path_display.split('/').slice(0, -1).join('/') || undefined,
          } as CloudFile;
        });
      }
    );
  }

  async getFile(fileId: string): Promise<CloudFile> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.apiBase}/files/get_metadata`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: fileId,
            include_media_info: true,
          }),
        }),
      async (response) => {
        const data = await response.json();
        return {
          id: data.id,
          name: data.name,
          mimeType: this.getMimeType(data.name),
          size: data.size || 0,
          createdAt: new Date(data.client_modified || Date.now()),
          modifiedAt: new Date(data.server_modified || Date.now()),
          provider: this.provider,
          path: data.path_display,
        };
      }
    );
  }

  async downloadFile(fileId: string): Promise<Blob> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.contentBase}/files/download`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
          },
        }),
      (response) => response.blob()
    );
  }

  async uploadFile(
    file: File,
    folderId = '',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    const path = folderId ? `${folderId}/${file.name}` : `/${file.name}`;

    // For files > 150MB, use chunked upload
    if (file.size > 150 * 1024 * 1024) {
      return this.chunkedUpload(file, path, onProgress);
    }

    const accessToken = await this.tokenMgr.ensureValidToken(this.provider);

    const response = await fetch(`${this.contentBase}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
        }),
      },
      body: file,
    });

    // Handle 401 with retry
    if (response.status === 401) {
      const result = await this.tokenMgr.refreshToken(this.provider);
      const retryResponse = await fetch(`${this.contentBase}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${result.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path,
            mode: 'add',
            autorename: true,
          }),
        },
        body: file,
      });

      if (!retryResponse.ok) {
        throw new Error(`Upload failed: ${retryResponse.statusText}`);
      }

      const retryResult = await retryResponse.json();

      if (onProgress) {
        onProgress({
          fileId: retryResult.id,
          fileName: file.name,
          bytesUploaded: file.size,
          totalBytes: file.size,
          percentage: 100,
          status: 'completed',
        });
      }

      return {
        id: retryResult.id,
        name: retryResult.name,
        mimeType: this.getMimeType(retryResult.name),
        size: retryResult.size,
        createdAt: new Date(retryResult.client_modified),
        modifiedAt: new Date(retryResult.server_modified),
        provider: this.provider,
        path: retryResult.path_display,
      };
    }

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        fileId: result.id,
        fileName: file.name,
        bytesUploaded: file.size,
        totalBytes: file.size,
        percentage: 100,
        status: 'completed',
      });
    }

    return {
      id: result.id,
      name: result.name,
      mimeType: this.getMimeType(result.name),
      size: result.size,
      createdAt: new Date(result.client_modified),
      modifiedAt: new Date(result.server_modified),
      provider: this.provider,
      path: result.path_display,
    };
  }

  private async chunkedUpload(
    file: File,
    path: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    const chunkSize = 8 * 1024 * 1024; // 8MB chunks
    let offset = 0;
    let sessionId: string | null = null;
    let accessToken = await this.tokenMgr.ensureValidToken(this.provider);

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);

      if (offset === 0) {
        // Start session
        const response = await fetch(`${this.contentBase}/files/upload_session/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: chunk,
        });

        if (response.status === 401) {
          const result = await this.tokenMgr.refreshToken(this.provider);
          accessToken = result.accessToken;
          // Retry start
          const retryResponse = await fetch(`${this.contentBase}/files/upload_session/start`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
            },
            body: chunk,
          });
          const retryResult = await retryResponse.json();
          sessionId = retryResult.session_id;
        } else {
          const result = await response.json();
          sessionId = result.session_id;
        }
      } else if (offset + chunkSize >= file.size) {
        // Finish session
        const response = await fetch(`${this.contentBase}/files/upload_session/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              cursor: { session_id: sessionId, offset },
              commit: { path, mode: 'add', autorename: true },
            }),
          },
          body: chunk,
        });

        if (response.status === 401) {
          const result = await this.tokenMgr.refreshToken(this.provider);
          accessToken = result.accessToken;
          const retryResponse = await fetch(`${this.contentBase}/files/upload_session/finish`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                cursor: { session_id: sessionId, offset },
                commit: { path, mode: 'add', autorename: true },
              }),
            },
            body: chunk,
          });
          const retryResult = await retryResponse.json();
          return {
            id: retryResult.id,
            name: retryResult.name,
            mimeType: this.getMimeType(retryResult.name),
            size: retryResult.size,
            createdAt: new Date(retryResult.client_modified),
            modifiedAt: new Date(retryResult.server_modified),
            provider: this.provider,
            path: retryResult.path_display,
          };
        }

        const result = await response.json();
        return {
          id: result.id,
          name: result.name,
          mimeType: this.getMimeType(result.name),
          size: result.size,
          createdAt: new Date(result.client_modified),
          modifiedAt: new Date(result.server_modified),
          provider: this.provider,
          path: result.path_display,
        };
      } else {
        // Append to session
        const response = await fetch(`${this.contentBase}/files/upload_session/append_v2`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              cursor: { session_id: sessionId, offset },
            }),
          },
          body: chunk,
        });

        if (response.status === 401) {
          const result = await this.tokenMgr.refreshToken(this.provider);
          accessToken = result.accessToken;
          await fetch(`${this.contentBase}/files/upload_session/append_v2`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                cursor: { session_id: sessionId, offset },
              }),
            },
            body: chunk,
          });
        }
      }

      offset += chunk.size;

      if (onProgress) {
        onProgress({
          fileId: '',
          fileName: file.name,
          bytesUploaded: offset,
          totalBytes: file.size,
          percentage: Math.round((offset / file.size) * 100),
          status: 'uploading',
        });
      }
    }

    throw new Error('Upload failed: unexpected end of chunks');
  }

  async createFolder(name: string, parentId = ''): Promise<CloudFolder> {
    const path = parentId ? `${parentId}/${name}` : `/${name}`;

    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.apiBase}/files/create_folder_v2`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path }),
        }),
      async (response) => {
        const data = await response.json();
        return {
          id: data.metadata.id,
          name: data.metadata.name,
          provider: this.provider,
          path: data.metadata.path_display,
          parentId: parentId || undefined,
        };
      }
    );
  }

  async delete(fileId: string): Promise<void> {
    await this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.apiBase}/files/delete_v2`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: fileId }),
        }),
      async () => {}
    );
  }

  async getQuota(): Promise<CloudStorageQuota> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.apiBase}/users/get_space_usage`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
      async (response) => {
        const data = await response.json();
        return {
          used: data.used || 0,
          total: data.allocation?.allocated || 0,
          provider: this.provider,
        };
      }
    );
  }

  async getShareableLink(fileId: string): Promise<string> {
    try {
      return await this.tokenMgr.fetchWithTokenRefresh(
        this.provider,
        (token) =>
          fetch(`${this.apiBase}/sharing/create_shared_link_with_settings`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              path: fileId,
              settings: { requested_visibility: 'public' },
            }),
          }),
        async (response) => {
          const data = await response.json();
          return data.url;
        }
      );
    } catch (error: unknown) {
      // Link might already exist
      const err = error as { message?: string };
      if (err.message?.includes('shared_link_already_exists')) {
        return this.tokenMgr.fetchWithTokenRefresh(
          this.provider,
          (token) =>
            fetch(`${this.apiBase}/sharing/list_shared_links`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                path: fileId,
                direct_only: true,
              }),
            }),
          async (response) => {
            const data = await response.json();
            return data.links[0]?.url || '';
          }
        );
      }
      throw error;
    }
  }

  async revokeAccess(): Promise<void> {
    const accessToken = this.tokenMgr.getAccessToken(this.provider);
    if (accessToken) {
      try {
        await fetch(`${this.apiBase}/auth/token/revoke`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      } catch {
        // Ignore errors during revoke
      }
    }
    this.tokenMgr.clearTokens(this.provider);
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

// Type definitions for Dropbox API responses
interface DropboxEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_display: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
}

// ============================================================================
// ONEDRIVE PROVIDER
// ============================================================================

class OneDriveProvider implements CloudStorageProviderInterface {
  private readonly provider: CloudStorageProvider = 'onedrive';
  private readonly graphBase = 'https://graph.microsoft.com/v1.0';
  private readonly tokenMgr: TokenManager;

  constructor(tokenMgr: TokenManager = tokenManager) {
    this.tokenMgr = tokenMgr;

    // Register refresh handler
    this.tokenMgr.registerRefreshHandler('onedrive', async (refreshToken) => {
      return this.refreshToken(refreshToken);
    });
  }

  setAccessToken(token: string, refreshToken = '', expiresAt?: Date): void {
    this.tokenMgr.setTokens(this.provider, {
      accessToken: token,
      refreshToken,
      expiresAt: expiresAt || new Date(Date.now() + 3600 * 1000), // 1 hour default
      provider: this.provider,
    });
  }

  async authenticate(): Promise<CloudStorageConfig> {
    const { clientId, redirectUri, scopes } = cloudStorageConfig.onedrive;

    if (!clientId) {
      throw new Error('OneDrive Client ID not configured');
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('onedrive_oauth_state', state);
    sessionStorage.setItem('onedrive_code_verifier', codeVerifier);

    // Build OAuth URL with PKCE (authorization code flow)
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code'); // Use code flow instead of token
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Open OAuth popup
    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'onedrive-oauth', 'width=600,height=700');

      if (!popup) {
        reject(new Error('Failed to open OneDrive authorization popup'));
        return;
      }

      const checkPopup = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(checkPopup);
            reject(new Error('Authorization cancelled'));
            return;
          }

          const popupUrl = popup.location.href;
          if (popupUrl.includes(redirectUri)) {
            clearInterval(checkPopup);
            popup.close();

            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const savedState = sessionStorage.getItem('onedrive_oauth_state');
            const savedVerifier = sessionStorage.getItem('onedrive_code_verifier');

            // Clean up
            sessionStorage.removeItem('onedrive_oauth_state');
            sessionStorage.removeItem('onedrive_code_verifier');

            if (returnedState !== savedState) {
              reject(new Error('OAuth state mismatch'));
              return;
            }

            if (!code || !savedVerifier) {
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for tokens using PKCE
            try {
              const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  code,
                  grant_type: 'authorization_code',
                  client_id: clientId,
                  redirect_uri: redirectUri,
                  code_verifier: savedVerifier,
                  scope: scopes.join(' '),
                }),
              });

              if (!tokenResponse.ok) {
                const error = await tokenResponse.json();
                reject(new Error(error.error_description || 'Token exchange failed'));
                return;
              }

              const tokens = await tokenResponse.json();
              const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

              this.tokenMgr.setTokens(this.provider, {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || '',
                expiresAt,
                provider: this.provider,
              });

              resolve({
                provider: this.provider,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || '',
                expiresAt,
              });
            } catch (error) {
              reject(error);
            }
          }
        } catch {
          // Cross-origin errors expected until redirect
        }
      }, 500);
    });
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
    const { clientId, scopes } = cloudStorageConfig.onedrive;

    if (!refreshToken) {
      throw new Error('No refresh token available for OneDrive');
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        scope: scopes.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Token refresh failed');
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken, // Microsoft may return new refresh token
      expiresAt,
    };
  }

  async listFiles(folderId = 'root'): Promise<(CloudFile | CloudFolder)[]> {
    const endpoint = folderId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${folderId}/children`;

    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.graphBase}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      async (response) => {
        const data = await response.json();
        return data.value.map((item: OneDriveItem) => {
          if (item.folder) {
            return {
              id: item.id,
              name: item.name,
              provider: this.provider,
              path: item.parentReference?.path ? `${item.parentReference.path}/${item.name}` : `/${item.name}`,
              parentId: item.parentReference?.id,
            } as CloudFolder;
          }

          return {
            id: item.id,
            name: item.name,
            mimeType: item.file?.mimeType || 'application/octet-stream',
            size: item.size || 0,
            createdAt: new Date(item.createdDateTime),
            modifiedAt: new Date(item.lastModifiedDateTime),
            provider: this.provider,
            path: item.parentReference?.path ? `${item.parentReference.path}/${item.name}` : `/${item.name}`,
            thumbnailUrl: item.thumbnails?.[0]?.medium?.url,
            webViewLink: item.webUrl,
            parentId: item.parentReference?.id,
          } as CloudFile;
        });
      }
    );
  }

  async getFile(fileId: string): Promise<CloudFile> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.graphBase}/me/drive/items/${fileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      async (response) => {
        const data = await response.json();
        return {
          id: data.id,
          name: data.name,
          mimeType: data.file?.mimeType || 'application/octet-stream',
          size: data.size || 0,
          createdAt: new Date(data.createdDateTime),
          modifiedAt: new Date(data.lastModifiedDateTime),
          provider: this.provider,
          path: data.parentReference?.path ? `${data.parentReference.path}/${data.name}` : `/${data.name}`,
          webViewLink: data.webUrl,
          downloadUrl: data['@microsoft.graph.downloadUrl'],
        };
      }
    );
  }

  async downloadFile(fileId: string): Promise<Blob> {
    // Get download URL first
    const file = await this.getFile(fileId);
    const downloadUrl = (file as CloudFile & { downloadUrl?: string }).downloadUrl;

    if (!downloadUrl) {
      throw new Error('No download URL available');
    }

    // Download URL doesn't need auth
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async uploadFile(
    file: File,
    folderId = 'root',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    // For files > 4MB, use resumable upload
    if (file.size > 4 * 1024 * 1024) {
      return this.resumableUpload(file, folderId, onProgress);
    }

    const endpoint = folderId === 'root'
      ? `/me/drive/root:/${file.name}:/content`
      : `/me/drive/items/${folderId}:/${file.name}:/content`;

    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.graphBase}${endpoint}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        }),
      async (response) => {
        const result = await response.json();

        if (onProgress) {
          onProgress({
            fileId: result.id,
            fileName: file.name,
            bytesUploaded: file.size,
            totalBytes: file.size,
            percentage: 100,
            status: 'completed',
          });
        }

        return {
          id: result.id,
          name: result.name,
          mimeType: result.file?.mimeType || file.type,
          size: result.size,
          createdAt: new Date(result.createdDateTime),
          modifiedAt: new Date(result.lastModifiedDateTime),
          provider: this.provider,
          path: `/${result.name}`,
          webViewLink: result.webUrl,
        };
      }
    );
  }

  private async resumableUpload(
    file: File,
    folderId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    let accessToken = await this.tokenMgr.ensureValidToken(this.provider);

    // Create upload session
    const endpoint = folderId === 'root'
      ? `/me/drive/root:/${file.name}:/createUploadSession`
      : `/me/drive/items/${folderId}:/${file.name}:/createUploadSession`;

    let sessionResponse = await fetch(`${this.graphBase}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename' },
      }),
    });

    // Handle 401 for session creation
    if (sessionResponse.status === 401) {
      const result = await this.tokenMgr.refreshToken(this.provider);
      accessToken = result.accessToken;
      sessionResponse = await fetch(`${this.graphBase}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'rename' },
        }),
      });
    }

    const session = await sessionResponse.json();
    const uploadUrl = session.uploadUrl;

    // Upload in chunks
    const chunkSize = 320 * 1024 * 10; // 3.2MB chunks (must be multiple of 320KB)
    let offset = 0;

    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);

      let response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.size),
          'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
        },
        body: chunk,
      });

      // The upload URL doesn't need auth, but check for errors
      if (response.status === 200 || response.status === 201) {
        // Upload complete
        const result = await response.json();
        return {
          id: result.id,
          name: result.name,
          mimeType: result.file?.mimeType || file.type,
          size: result.size,
          createdAt: new Date(result.createdDateTime),
          modifiedAt: new Date(result.lastModifiedDateTime),
          provider: this.provider,
          path: `/${result.name}`,
          webViewLink: result.webUrl,
        };
      }

      offset = end;

      if (onProgress) {
        onProgress({
          fileId: '',
          fileName: file.name,
          bytesUploaded: offset,
          totalBytes: file.size,
          percentage: Math.round((offset / file.size) * 100),
          status: 'uploading',
        });
      }
    }

    throw new Error('Upload failed: unexpected end');
  }

  async createFolder(name: string, parentId = 'root'): Promise<CloudFolder> {
    const endpoint = parentId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${parentId}/children`;

    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.graphBase}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        }),
      async (response) => {
        const result = await response.json();
        return {
          id: result.id,
          name: result.name,
          provider: this.provider,
          path: `/${result.name}`,
          parentId: parentId === 'root' ? undefined : parentId,
        };
      }
    );
  }

  async delete(fileId: string): Promise<void> {
    const accessToken = await this.tokenMgr.ensureValidToken(this.provider);

    let response = await fetch(`${this.graphBase}/me/drive/items/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Handle 401 with retry
    if (response.status === 401) {
      const result = await this.tokenMgr.refreshToken(this.provider);
      response = await fetch(`${this.graphBase}/me/drive/items/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${result.accessToken}` },
      });
    }

    if (!response.ok && response.status !== 204) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  async getQuota(): Promise<CloudStorageQuota> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.graphBase}/me/drive`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      async (response) => {
        const data = await response.json();
        return {
          used: data.quota?.used || 0,
          total: data.quota?.total || 0,
          provider: this.provider,
        };
      }
    );
  }

  async getShareableLink(fileId: string): Promise<string> {
    return this.tokenMgr.fetchWithTokenRefresh(
      this.provider,
      (token) =>
        fetch(`${this.graphBase}/me/drive/items/${fileId}/createLink`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'view',
            scope: 'anonymous',
          }),
        }),
      async (response) => {
        const result = await response.json();
        return result.link?.webUrl || '';
      }
    );
  }

  async revokeAccess(): Promise<void> {
    // Microsoft doesn't have a token revocation endpoint for consumer accounts
    this.tokenMgr.clearTokens(this.provider);
  }
}

// Type definitions for OneDrive API
interface OneDriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl?: string;
  folder?: Record<string, unknown>;
  file?: { mimeType: string };
  thumbnails?: { medium?: { url: string } }[];
  parentReference?: { id: string; path: string };
  '@microsoft.graph.downloadUrl'?: string;
}

// ============================================================================
// CLOUD STORAGE SERVICE (FACADE)
// ============================================================================

class CloudStorageService {
  private providers: Map<CloudStorageProvider, CloudStorageProviderInterface> = new Map();
  private activeProvider: CloudStorageProvider | null = null;
  private initialized = false;
  private readonly tokenMgr: TokenManager;

  constructor(tokenMgr: TokenManager = tokenManager) {
    this.tokenMgr = tokenMgr;
    this.providers.set('google_drive', new GoogleDriveProvider(tokenMgr));
    this.providers.set('dropbox', new DropboxProvider(tokenMgr));
    this.providers.set('onedrive', new OneDriveProvider(tokenMgr));
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[CloudStorage] Initialized');
  }

  /**
   * Get the token manager instance
   */
  getTokenManager(): TokenManager {
    return this.tokenMgr;
  }

  /**
   * Subscribe to token events (e.g., for UI reconnection prompts)
   */
  onTokenEvent(listener: TokenEventListener): () => void {
    return this.tokenMgr.addEventListener(listener);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): CloudStorageProvider[] {
    return ['google_drive', 'dropbox', 'onedrive'];
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider: CloudStorageProvider): string {
    const names: Record<CloudStorageProvider, string> = {
      google_drive: 'Google Drive',
      dropbox: 'Dropbox',
      onedrive: 'OneDrive',
    };
    return names[provider];
  }

  /**
   * Get provider icon name (for MUI icons)
   */
  getProviderIcon(provider: CloudStorageProvider): string {
    const icons: Record<CloudStorageProvider, string> = {
      google_drive: 'Google',
      dropbox: 'Cloud',
      onedrive: 'Microsoft',
    };
    return icons[provider];
  }

  /**
   * Connect to a provider
   */
  async connect(provider: CloudStorageProvider): Promise<CloudStorageConfig> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw this.createError(`Unknown provider: ${provider}`, 'storage/unknown-provider');
    }

    const config = await providerInstance.authenticate();
    this.activeProvider = provider;
    return config;
  }

  /**
   * Set credentials for a provider (from stored tokens)
   */
  setCredentials(
    provider: CloudStorageProvider,
    accessToken: string,
    refreshToken = '',
    expiresAt?: Date
  ): void {
    const providerInstance = this.providers.get(provider) as GoogleDriveProvider | DropboxProvider | OneDriveProvider | undefined;
    if (providerInstance) {
      providerInstance.setAccessToken(accessToken, refreshToken, expiresAt);
      this.activeProvider = provider;
    }
  }

  /**
   * Get active provider
   */
  getActiveProvider(): CloudStorageProvider | null {
    return this.activeProvider;
  }

  /**
   * Get provider interface
   */
  getProvider(provider?: CloudStorageProvider): CloudStorageProviderInterface {
    const p = provider || this.activeProvider;
    if (!p) {
      throw this.createError('No active provider', 'storage/no-provider');
    }

    const providerInstance = this.providers.get(p);
    if (!providerInstance) {
      throw this.createError(`Unknown provider: ${p}`, 'storage/unknown-provider');
    }

    return providerInstance;
  }

  /**
   * Check if token needs refresh for a provider
   */
  needsTokenRefresh(provider: CloudStorageProvider): boolean {
    return this.tokenMgr.needsRefresh(provider);
  }

  /**
   * Check if token is valid for a provider
   */
  isTokenValid(provider: CloudStorageProvider): boolean {
    return this.tokenMgr.isTokenValid(provider);
  }

  /**
   * Get token info for a provider
   */
  getTokenInfo(provider: CloudStorageProvider): TokenInfo | undefined {
    return this.tokenMgr.getTokens(provider);
  }

  /**
   * Disconnect from active provider
   */
  async disconnect(provider?: CloudStorageProvider): Promise<void> {
    const p = provider || this.activeProvider;
    if (!p) return;

    const providerInstance = this.providers.get(p);
    if (providerInstance) {
      await providerInstance.revokeAccess();
    }

    if (p === this.activeProvider) {
      this.activeProvider = null;
    }
  }

  // Proxy methods to active provider
  async listFiles(folderId?: string, provider?: CloudStorageProvider): Promise<(CloudFile | CloudFolder)[]> {
    return this.getProvider(provider).listFiles(folderId);
  }

  async getFile(fileId: string, provider?: CloudStorageProvider): Promise<CloudFile> {
    return this.getProvider(provider).getFile(fileId);
  }

  async downloadFile(fileId: string, provider?: CloudStorageProvider): Promise<Blob> {
    return this.getProvider(provider).downloadFile(fileId);
  }

  async uploadFile(
    file: File,
    folderId?: string,
    onProgress?: (progress: UploadProgress) => void,
    provider?: CloudStorageProvider
  ): Promise<CloudFile> {
    return this.getProvider(provider).uploadFile(file, folderId, onProgress);
  }

  async createFolder(name: string, parentId?: string, provider?: CloudStorageProvider): Promise<CloudFolder> {
    return this.getProvider(provider).createFolder(name, parentId);
  }

  async delete(fileId: string, provider?: CloudStorageProvider): Promise<void> {
    return this.getProvider(provider).delete(fileId);
  }

  async getQuota(provider?: CloudStorageProvider): Promise<CloudStorageQuota> {
    return this.getProvider(provider).getQuota();
  }

  async getShareableLink(fileId: string, provider?: CloudStorageProvider): Promise<string> {
    return this.getProvider(provider).getShareableLink(fileId);
  }

  private createError(message: string, code: string): StorageError {
    const error = new Error(message) as StorageError;
    error.name = 'StorageError';
    (error as unknown as { code: string }).code = code;
    return error;
  }
}

// Export singleton
export const cloudStorageService = new CloudStorageService();

// Export classes for testing
export { CloudStorageService, GoogleDriveProvider, DropboxProvider, OneDriveProvider };

// Re-export token manager types and utilities
export { tokenManager, generateCodeVerifier, generateCodeChallenge };
export type { TokenInfo, TokenEvent, TokenEventListener };

// Declare gapi for TypeScript
declare const gapi: {
  load: (api: string, callback: () => void) => void;
  client: {
    init: (config: object) => Promise<void>;
    drive: {
      files: {
        list: (params: object) => Promise<{ result: { files: gapi.client.drive.File[] } }>;
        get: (params: object) => Promise<{ result: gapi.client.drive.File }>;
        create: (params: object) => Promise<{ result: gapi.client.drive.File }>;
        delete: (params: object) => Promise<void>;
      };
      permissions: {
        create: (params: object) => Promise<void>;
      };
      about: {
        get: (params: object) => Promise<{ result: { storageQuota: { usage: string; limit: string } } }>;
      };
    };
  };
  auth2: {
    getAuthInstance: () => {
      signIn: () => Promise<{
        getAuthResponse: (includeAuthorizationData: boolean) => {
          access_token: string;
          id_token: string;
          expires_at: number;
        };
      }>;
      signOut: () => Promise<void>;
      currentUser: {
        get: () => {
          reloadAuthResponse: () => Promise<{
            access_token: string;
            expires_at: number;
          }>;
        };
      };
    };
  };
};

declare namespace gapi.client.drive {
  interface File {
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
    thumbnailLink?: string;
    webViewLink?: string;
    parents?: string[];
  }
}
