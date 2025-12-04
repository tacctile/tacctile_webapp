/**
 * StorageService - Browser-compatible storage layer
 * Replaces electron-store with IndexedDB + localStorage
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface TacctileDB extends DBSchema {
  investigations: {
    key: string;
    value: {
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      data: any;
    };
  };
  evidence: {
    key: string;
    value: {
      id: string;
      investigationId: string;
      type: string;
      data: any;
      createdAt: number;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  cache: {
    key: string;
    value: {
      data: any;
      timestamp: number;
    };
  };
}

class StorageService {
  private db: IDBPDatabase<TacctileDB> | null = null;
  private dbName = 'tacctile-webapp-db';
  private dbVersion = 1;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<TacctileDB>(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Create object stores
        if (!db.objectStoreNames.contains('investigations')) {
          db.createObjectStore('investigations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('evidence')) {
          const evidenceStore = db.createObjectStore('evidence', { keyPath: 'id' });
          evidenceStore.createIndex('investigationId', 'investigationId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      },
    });
  }

  /**
   * Get a value from settings (like electron-store.get())
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    await this.init();
    const value = await this.db!.get('settings', key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set a value in settings (like electron-store.set())
   */
  async set(key: string, value: any): Promise<void> {
    await this.init();
    await this.db!.put('settings', value, key);
  }

  /**
   * Delete a key from settings
   */
  async delete(key: string): Promise<void> {
    await this.init();
    await this.db!.delete('settings', key);
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    await this.init();
    const value = await this.db!.get('settings', key);
    return value !== undefined;
  }

  /**
   * Clear all settings
   */
  async clear(): Promise<void> {
    await this.init();
    await this.db!.clear('settings');
  }

  /**
   * Get all investigations
   */
  async getAllInvestigations() {
    await this.init();
    return this.db!.getAll('investigations');
  }

  /**
   * Save an investigation
   */
  async saveInvestigation(investigation: any): Promise<void> {
    await this.init();
    await this.db!.put('investigations', {
      ...investigation,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get an investigation by ID
   */
  async getInvestigation(id: string) {
    await this.init();
    return this.db!.get('investigations', id);
  }

  /**
   * Delete an investigation
   */
  async deleteInvestigation(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('investigations', id);

    // Also delete associated evidence
    const tx = this.db!.transaction('evidence', 'readwrite');
    const index = tx.store.index('investigationId');
    const evidenceItems = await index.getAll(id);

    for (const item of evidenceItems) {
      await tx.store.delete(item.id);
    }
    await tx.done;
  }

  /**
   * Save evidence
   */
  async saveEvidence(evidence: any): Promise<void> {
    await this.init();
    await this.db!.put('evidence', {
      ...evidence,
      createdAt: evidence.createdAt || Date.now(),
    });
  }

  /**
   * Get evidence by investigation ID
   */
  async getEvidenceByInvestigation(investigationId: string) {
    await this.init();
    const tx = this.db!.transaction('evidence', 'readonly');
    const index = tx.store.index('investigationId');
    return index.getAll(investigationId);
  }

  /**
   * Cache data with timestamp
   */
  async cache(key: string, data: any, ttl?: number): Promise<void> {
    await this.init();
    await this.db!.put('cache', {
      data,
      timestamp: Date.now(),
    }, key);
  }

  /**
   * Get cached data (returns null if expired)
   */
  async getCached(key: string, ttl?: number): Promise<any> {
    await this.init();
    const cached = await this.db!.get('cache', key);

    if (!cached) return null;

    if (ttl && Date.now() - cached.timestamp > ttl) {
      await this.db!.delete('cache', key);
      return null;
    }

    return cached.data;
  }

  /**
   * Export all data (for backup)
   */
  async exportData(): Promise<any> {
    await this.init();

    const investigations = await this.db!.getAll('investigations');
    const evidence = await this.db!.getAll('evidence');
    const settings = await this.db!.getAll('settings');

    return {
      investigations,
      evidence,
      settings,
      exportedAt: new Date().toISOString(),
      version: this.dbVersion,
    };
  }

  /**
   * Import data (for restore)
   */
  async importData(data: any): Promise<void> {
    await this.init();

    // Clear existing data
    await this.db!.clear('investigations');
    await this.db!.clear('evidence');
    await this.db!.clear('settings');

    // Import new data
    if (data.investigations) {
      for (const investigation of data.investigations) {
        await this.db!.put('investigations', investigation);
      }
    }

    if (data.evidence) {
      for (const item of data.evidence) {
        await this.db!.put('evidence', item);
      }
    }

    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await this.db!.put('settings', value, key);
      }
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
