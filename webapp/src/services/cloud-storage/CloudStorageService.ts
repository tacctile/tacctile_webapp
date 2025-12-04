/**
 * Cloud Storage Service
 * Storage-agnostic interface for Google Drive, Dropbox, and OneDrive
 * User picks their provider - we never store media on our servers (zero liability)
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
  refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>;

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
  private accessToken: string | null = null;
  private readonly provider: CloudStorageProvider = 'google_drive';

  setAccessToken(token: string): void {
    this.accessToken = token;
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

            const authInstance = gapi.auth2.getAuthInstance();
            const user = await authInstance.signIn();
            const authResponse = user.getAuthResponse(true);

            this.accessToken = authResponse.access_token;

            resolve({
              provider: this.provider,
              accessToken: authResponse.access_token,
              refreshToken: authResponse.id_token, // Google uses ID token for refresh in implicit flow
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

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    // For web apps using implicit flow, token refresh requires re-authentication
    // In production with a backend, you'd use the refresh token with OAuth 2.0
    const authInstance = gapi.auth2.getAuthInstance();
    const user = authInstance.currentUser.get();
    const authResponse = await user.reloadAuthResponse();

    this.accessToken = authResponse.access_token;

    return {
      accessToken: authResponse.access_token,
      expiresAt: new Date(authResponse.expires_at),
    };
  }

  async listFiles(folderId = 'root'): Promise<(CloudFile | CloudFolder)[]> {
    this.ensureAuthenticated();

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
  }

  async getFile(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated();

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
  }

  async downloadFile(fileId: string): Promise<Blob> {
    this.ensureAuthenticated();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

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
    this.ensureAuthenticated();

    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    const uploadPromise = new Promise<CloudFile>((resolve, reject) => {
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink');
      xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

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

      xhr.onload = () => {
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

    return uploadPromise;
  }

  async createFolder(name: string, parentId = 'root'): Promise<CloudFolder> {
    this.ensureAuthenticated();

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
  }

  async delete(fileId: string): Promise<void> {
    this.ensureAuthenticated();
    await gapi.client.drive.files.delete({ fileId });
  }

  async getQuota(): Promise<CloudStorageQuota> {
    this.ensureAuthenticated();

    const response = await gapi.client.drive.about.get({
      fields: 'storageQuota',
    });

    const quota = response.result.storageQuota!;
    return {
      used: Number(quota.usage) || 0,
      total: Number(quota.limit) || 0,
      provider: this.provider,
    };
  }

  async getShareableLink(fileId: string): Promise<string> {
    this.ensureAuthenticated();

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
  }

  async revokeAccess(): Promise<void> {
    const authInstance = gapi.auth2.getAuthInstance();
    await authInstance.signOut();
    this.accessToken = null;
  }

  private ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }
  }
}

// ============================================================================
// DROPBOX PROVIDER
// ============================================================================

class DropboxProvider implements CloudStorageProviderInterface {
  private accessToken: string | null = null;
  private readonly provider: CloudStorageProvider = 'dropbox';
  private readonly apiBase = 'https://api.dropboxapi.com/2';
  private readonly contentBase = 'https://content.dropboxapi.com/2';

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async authenticate(): Promise<CloudStorageConfig> {
    const { clientId, redirectUri } = cloudStorageConfig.dropbox;

    if (!clientId) {
      throw new Error('Dropbox Client ID not configured');
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('dropbox_oauth_state', state);

    // Build OAuth URL
    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('token_access_type', 'offline');

    // Open OAuth popup
    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'dropbox-oauth', 'width=600,height=700');

      if (!popup) {
        reject(new Error('Failed to open Dropbox authorization popup'));
        return;
      }

      const checkPopup = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkPopup);
            reject(new Error('Authorization cancelled'));
            return;
          }

          // Check if redirected back with token
          const popupUrl = popup.location.href;
          if (popupUrl.includes(redirectUri)) {
            clearInterval(checkPopup);
            popup.close();

            const hash = new URL(popupUrl).hash.substring(1);
            const params = new URLSearchParams(hash);

            const returnedState = params.get('state');
            const savedState = sessionStorage.getItem('dropbox_oauth_state');

            if (returnedState !== savedState) {
              reject(new Error('OAuth state mismatch'));
              return;
            }

            const accessToken = params.get('access_token');
            const expiresIn = params.get('expires_in');

            if (!accessToken) {
              reject(new Error('No access token received'));
              return;
            }

            this.accessToken = accessToken;

            resolve({
              provider: this.provider,
              accessToken,
              refreshToken: '', // Dropbox implicit flow doesn't provide refresh token
              expiresAt: new Date(Date.now() + (Number(expiresIn) || 14400) * 1000),
            });
          }
        } catch {
          // Cross-origin errors are expected until redirect
        }
      }, 500);
    });
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    // Dropbox requires re-authentication for implicit flow
    throw new Error('Token refresh requires re-authentication');
  }

  async listFiles(folderId = ''): Promise<(CloudFile | CloudFolder)[]> {
    this.ensureAuthenticated();

    const response = await this.apiRequest('/files/list_folder', {
      path: folderId || '',
      include_media_info: true,
    });

    return response.entries.map((entry: DropboxEntry) => {
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

  async getFile(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated();

    const response = await this.apiRequest('/files/get_metadata', {
      path: fileId,
      include_media_info: true,
    });

    return {
      id: response.id,
      name: response.name,
      mimeType: this.getMimeType(response.name),
      size: response.size || 0,
      createdAt: new Date(response.client_modified || Date.now()),
      modifiedAt: new Date(response.server_modified || Date.now()),
      provider: this.provider,
      path: response.path_display,
    };
  }

  async downloadFile(fileId: string): Promise<Blob> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.contentBase}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async uploadFile(
    file: File,
    folderId = '',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    this.ensureAuthenticated();

    const path = folderId ? `${folderId}/${file.name}` : `/${file.name}`;

    // For files > 150MB, use chunked upload
    if (file.size > 150 * 1024 * 1024) {
      return this.chunkedUpload(file, path, onProgress);
    }

    const response = await fetch(`${this.contentBase}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
        }),
      },
      body: file,
    });

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

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);

      if (offset === 0) {
        // Start session
        const response = await fetch(`${this.contentBase}/files/upload_session/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: chunk,
        });
        const result = await response.json();
        sessionId = result.session_id;
      } else if (offset + chunkSize >= file.size) {
        // Finish session
        const response = await fetch(`${this.contentBase}/files/upload_session/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              cursor: { session_id: sessionId, offset },
              commit: { path, mode: 'add', autorename: true },
            }),
          },
          body: chunk,
        });
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
        await fetch(`${this.contentBase}/files/upload_session/append_v2`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              cursor: { session_id: sessionId, offset },
            }),
          },
          body: chunk,
        });
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
    this.ensureAuthenticated();

    const path = parentId ? `${parentId}/${name}` : `/${name}`;

    const response = await this.apiRequest('/files/create_folder_v2', { path });

    return {
      id: response.metadata.id,
      name: response.metadata.name,
      provider: this.provider,
      path: response.metadata.path_display,
      parentId: parentId || undefined,
    };
  }

  async delete(fileId: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('/files/delete_v2', { path: fileId });
  }

  async getQuota(): Promise<CloudStorageQuota> {
    this.ensureAuthenticated();

    const response = await this.apiRequest('/users/get_space_usage', {});

    return {
      used: response.used || 0,
      total: response.allocation?.allocated || 0,
      provider: this.provider,
    };
  }

  async getShareableLink(fileId: string): Promise<string> {
    this.ensureAuthenticated();

    try {
      const response = await this.apiRequest('/sharing/create_shared_link_with_settings', {
        path: fileId,
        settings: { requested_visibility: 'public' },
      });
      return response.url;
    } catch (error: unknown) {
      // Link might already exist
      const err = error as { message?: string };
      if (err.message?.includes('shared_link_already_exists')) {
        const existing = await this.apiRequest('/sharing/list_shared_links', {
          path: fileId,
          direct_only: true,
        });
        return existing.links[0]?.url || '';
      }
      throw error;
    }
  }

  async revokeAccess(): Promise<void> {
    if (this.accessToken) {
      await this.apiRequest('/auth/token/revoke', {});
      this.accessToken = null;
    }
  }

  private async apiRequest(endpoint: string, body: unknown): Promise<DropboxResponse> {
    const response = await fetch(`${this.apiBase}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_summary || response.statusText);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
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

  private ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DropboxResponse = any;

// ============================================================================
// ONEDRIVE PROVIDER
// ============================================================================

class OneDriveProvider implements CloudStorageProviderInterface {
  private accessToken: string | null = null;
  private readonly provider: CloudStorageProvider = 'onedrive';
  private readonly graphBase = 'https://graph.microsoft.com/v1.0';

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async authenticate(): Promise<CloudStorageConfig> {
    const { clientId, redirectUri, scopes } = cloudStorageConfig.onedrive;

    if (!clientId) {
      throw new Error('OneDrive Client ID not configured');
    }

    // Generate state and nonce for CSRF/replay protection
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    sessionStorage.setItem('onedrive_oauth_state', state);

    // Build OAuth URL
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);

    // Open OAuth popup
    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'onedrive-oauth', 'width=600,height=700');

      if (!popup) {
        reject(new Error('Failed to open OneDrive authorization popup'));
        return;
      }

      const checkPopup = setInterval(() => {
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

            const hash = new URL(popupUrl).hash.substring(1);
            const params = new URLSearchParams(hash);

            const returnedState = params.get('state');
            const savedState = sessionStorage.getItem('onedrive_oauth_state');

            if (returnedState !== savedState) {
              reject(new Error('OAuth state mismatch'));
              return;
            }

            const accessToken = params.get('access_token');
            const expiresIn = params.get('expires_in');

            if (!accessToken) {
              reject(new Error('No access token received'));
              return;
            }

            this.accessToken = accessToken;

            resolve({
              provider: this.provider,
              accessToken,
              refreshToken: '', // Implicit flow doesn't provide refresh token
              expiresAt: new Date(Date.now() + (Number(expiresIn) || 3600) * 1000),
            });
          }
        } catch {
          // Cross-origin errors expected until redirect
        }
      }, 500);
    });
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    throw new Error('Token refresh requires re-authentication');
  }

  async listFiles(folderId = 'root'): Promise<(CloudFile | CloudFolder)[]> {
    this.ensureAuthenticated();

    const endpoint = folderId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${folderId}/children`;

    const response = await this.graphRequest(endpoint);

    return response.value.map((item: OneDriveItem) => {
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

  async getFile(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated();

    const response = await this.graphRequest(`/me/drive/items/${fileId}`);

    return {
      id: response.id,
      name: response.name,
      mimeType: response.file?.mimeType || 'application/octet-stream',
      size: response.size || 0,
      createdAt: new Date(response.createdDateTime),
      modifiedAt: new Date(response.lastModifiedDateTime),
      provider: this.provider,
      path: response.parentReference?.path ? `${response.parentReference.path}/${response.name}` : `/${response.name}`,
      webViewLink: response.webUrl,
      downloadUrl: response['@microsoft.graph.downloadUrl'],
    };
  }

  async downloadFile(fileId: string): Promise<Blob> {
    this.ensureAuthenticated();

    // Get download URL
    const item = await this.graphRequest(`/me/drive/items/${fileId}`);
    const downloadUrl = item['@microsoft.graph.downloadUrl'];

    if (!downloadUrl) {
      throw new Error('No download URL available');
    }

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
    this.ensureAuthenticated();

    // For files > 4MB, use resumable upload
    if (file.size > 4 * 1024 * 1024) {
      return this.resumableUpload(file, folderId, onProgress);
    }

    const endpoint = folderId === 'root'
      ? `/me/drive/root:/${file.name}:/content`
      : `/me/drive/items/${folderId}:/${file.name}:/content`;

    const response = await fetch(`${this.graphBase}${endpoint}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

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
      mimeType: result.file?.mimeType || file.type,
      size: result.size,
      createdAt: new Date(result.createdDateTime),
      modifiedAt: new Date(result.lastModifiedDateTime),
      provider: this.provider,
      path: `/${result.name}`,
      webViewLink: result.webUrl,
    };
  }

  private async resumableUpload(
    file: File,
    folderId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CloudFile> {
    // Create upload session
    const endpoint = folderId === 'root'
      ? `/me/drive/root:/${file.name}:/createUploadSession`
      : `/me/drive/items/${folderId}:/${file.name}:/createUploadSession`;

    const sessionResponse = await fetch(`${this.graphBase}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename' },
      }),
    });

    const session = await sessionResponse.json();
    const uploadUrl = session.uploadUrl;

    // Upload in chunks
    const chunkSize = 320 * 1024 * 10; // 3.2MB chunks (must be multiple of 320KB)
    let offset = 0;

    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.size),
          'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
        },
        body: chunk,
      });

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
    this.ensureAuthenticated();

    const endpoint = parentId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${parentId}/children`;

    const response = await fetch(`${this.graphBase}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    });

    const result = await response.json();

    return {
      id: result.id,
      name: result.name,
      provider: this.provider,
      path: `/${result.name}`,
      parentId: parentId === 'root' ? undefined : parentId,
    };
  }

  async delete(fileId: string): Promise<void> {
    this.ensureAuthenticated();

    await fetch(`${this.graphBase}/me/drive/items/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  async getQuota(): Promise<CloudStorageQuota> {
    this.ensureAuthenticated();

    const response = await this.graphRequest('/me/drive');

    return {
      used: response.quota?.used || 0,
      total: response.quota?.total || 0,
      provider: this.provider,
    };
  }

  async getShareableLink(fileId: string): Promise<string> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.graphBase}/me/drive/items/${fileId}/createLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'view',
        scope: 'anonymous',
      }),
    });

    const result = await response.json();
    return result.link?.webUrl || '';
  }

  async revokeAccess(): Promise<void> {
    // Microsoft doesn't have a token revocation endpoint for implicit flow
    this.accessToken = null;
  }

  private async graphRequest(endpoint: string): Promise<OneDriveResponse> {
    const response = await fetch(`${this.graphBase}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || response.statusText);
    }

    return response.json();
  }

  private ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error('Not authenticated with OneDrive');
    }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneDriveResponse = any;

// ============================================================================
// CLOUD STORAGE SERVICE (FACADE)
// ============================================================================

class CloudStorageService {
  private providers: Map<CloudStorageProvider, CloudStorageProviderInterface> = new Map();
  private activeProvider: CloudStorageProvider | null = null;
  private initialized = false;

  constructor() {
    this.providers.set('google_drive', new GoogleDriveProvider());
    this.providers.set('dropbox', new DropboxProvider());
    this.providers.set('onedrive', new OneDriveProvider());
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
  setCredentials(provider: CloudStorageProvider, accessToken: string): void {
    const providerInstance = this.providers.get(provider);
    if (providerInstance) {
      (providerInstance as GoogleDriveProvider | DropboxProvider | OneDriveProvider).setAccessToken(accessToken);
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
