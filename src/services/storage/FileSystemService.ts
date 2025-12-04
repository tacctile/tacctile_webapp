/**
 * FileSystemService - Browser File System Access API wrapper
 * Replaces Node.js fs module with browser-compatible file handling
 */

export interface FileHandle {
  name: string;
  handle: FileSystemFileHandle;
}

export interface DirectoryHandle {
  name: string;
  handle: FileSystemDirectoryHandle;
}

class FileSystemService {
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();
  private directoryHandles: Map<string, FileSystemDirectoryHandle> = new Map();

  /**
   * Check if File System Access API is supported
   */
  isSupported(): boolean {
    return 'showOpenFilePicker' in window;
  }

  /**
   * Show file picker and open a file
   */
  async openFile(options?: {
    accept?: Record<string, string[]>;
    multiple?: boolean;
  }): Promise<File[]> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser');
    }

    try {
      const fileHandles = await (window as any).showOpenFilePicker({
        multiple: options?.multiple || false,
        types: options?.accept ? [{
          description: 'Files',
          accept: options.accept
        }] : undefined
      });

      const files: File[] = [];
      for (const handle of fileHandles) {
        this.fileHandles.set(handle.name, handle);
        const file = await handle.getFile();
        files.push(file);
      }

      return files;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return []; // User cancelled
      }
      throw error;
    }
  }

  /**
   * Show save file picker and save a file
   */
  async saveFile(
    data: Blob | string,
    suggestedName?: string,
    options?: {
      accept?: Record<string, string[]>;
    }
  ): Promise<void> {
    if (!this.isSupported()) {
      // Fallback to download
      this.downloadFile(data, suggestedName || 'download.txt');
      return;
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: options?.accept ? [{
          description: 'File',
          accept: options.accept
        }] : undefined
      });

      const writable = await handle.createWritable();

      if (typeof data === 'string') {
        await writable.write(data);
      } else {
        await writable.write(data);
      }

      await writable.close();
      this.fileHandles.set(handle.name, handle);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // User cancelled
      }
      throw error;
    }
  }

  /**
   * Fallback download method for browsers without File System Access API
   */
  downloadFile(data: Blob | string, filename: string): void {
    const blob = typeof data === 'string'
      ? new Blob([data], { type: 'text/plain' })
      : data;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Open a directory picker
   */
  async openDirectory(): Promise<DirectoryHandle | null> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser');
    }

    try {
      const handle = await (window as any).showDirectoryPicker();
      this.directoryHandles.set(handle.name, handle);
      return {
        name: handle.name,
        handle
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  /**
   * Read file from directory handle
   */
  async readFileFromDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    filename: string
  ): Promise<File | null> {
    try {
      const fileHandle = await directoryHandle.getFileHandle(filename);
      return await fileHandle.getFile();
    } catch (error) {
      return null; // File not found
    }
  }

  /**
   * Write file to directory handle
   */
  async writeFileToDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    filename: string,
    data: Blob | string
  ): Promise<void> {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    if (typeof data === 'string') {
      await writable.write(data);
    } else {
      await writable.write(data);
    }

    await writable.close();
  }

  /**
   * List files in directory
   */
  async listDirectory(directoryHandle: FileSystemDirectoryHandle): Promise<string[]> {
    const files: string[] = [];

    for await (const entry of (directoryHandle as any).values()) {
      files.push(entry.name);
    }

    return files;
  }

  /**
   * Read file as text
   */
  async readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Read file as data URL (base64)
   */
  async readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Read file as array buffer
   */
  async readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Create a blob from data
   */
  createBlob(data: any, type?: string): Blob {
    return new Blob([data], { type: type || 'application/octet-stream' });
  }

  /**
   * Read multiple files via input element (fallback)
   */
  async readFilesViaInput(accept?: string, multiple = false): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.multiple = multiple;

      input.onchange = () => {
        const files = Array.from(input.files || []);
        resolve(files);
      };

      input.click();
    });
  }

  /**
   * Export data as JSON file
   */
  async exportJSON(data: any, filename: string): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await this.saveFile(json, filename, {
      accept: { 'application/json': ['.json'] }
    });
  }

  /**
   * Import JSON file
   */
  async importJSON(): Promise<any> {
    const files = await this.openFile({
      accept: { 'application/json': ['.json'] }
    });

    if (files.length === 0) return null;

    const text = await this.readAsText(files[0]);
    return JSON.parse(text);
  }

  /**
   * Request persistent storage (for larger data)
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
    return false;
  }

  /**
   * Check if storage is persisted
   */
  async isPersisted(): Promise<boolean> {
    if ('storage' in navigator && 'persisted' in navigator.storage) {
      return await navigator.storage.persisted();
    }
    return false;
  }

  /**
   * Estimate storage usage
   */
  async estimateStorage(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { usage: 0, quota: 0 };
  }
}

// Export singleton instance
export const fileSystemService = new FileSystemService();
export default fileSystemService;
