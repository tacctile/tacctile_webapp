/**
 * StorageService - Browser-compatible storage layer
 * Replaces electron-store with IndexedDB + localStorage
 */

import { openDB, DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';

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

/**
 * Migration function type
 * Each migration receives the database instance and the transaction
 * to perform schema changes (create/delete stores, indexes, etc.)
 */
type MigrationFunction = (
  db: IDBPDatabase<TacctileDB>,
  transaction: IDBPTransaction<TacctileDB, ArrayLike<keyof TacctileDB>, 'versionchange'>
) => void;

/**
 * Migration registry - maps version numbers to their migration functions
 * Each migration upgrades from (version - 1) to (version)
 *
 * Example: migration for version 2 upgrades from v1 to v2
 *
 * To add a new migration:
 * 1. Add a new entry with the target version number as key
 * 2. Implement the migration function
 * 3. Update DB_VERSION constant to the new version
 */
const migrations: Record<number, MigrationFunction> = {
  /**
   * Version 1: Initial schema setup
   * Creates the base object stores: investigations, evidence, settings, cache
   */
  1: (db) => {
    // Create investigations store
    if (!db.objectStoreNames.contains('investigations')) {
      db.createObjectStore('investigations', { keyPath: 'id' });
    }
    // Create evidence store with index
    if (!db.objectStoreNames.contains('evidence')) {
      const evidenceStore = db.createObjectStore('evidence', { keyPath: 'id' });
      evidenceStore.createIndex('investigationId', 'investigationId');
    }
    // Create settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings');
    }
    // Create cache store
    if (!db.objectStoreNames.contains('cache')) {
      db.createObjectStore('cache');
    }
  },

  /**
   * Version 2: Placeholder for future migration
   *
   * Example migration patterns:
   * - Add new object store: db.createObjectStore('newStore', { keyPath: 'id' });
   * - Add index to existing store: transaction.objectStore('evidence').createIndex('newIndex', 'field');
   * - Delete store: db.deleteObjectStore('oldStore');
   * - Delete index: transaction.objectStore('evidence').deleteIndex('oldIndex');
   *
   * Note: Data transformations should be done after the upgrade completes,
   * not within the versionchange transaction.
   */
  2: (_db, _transaction) => {
    // Placeholder for future schema changes
    // This migration intentionally does nothing - it's a template for future use
  },
};

/**
 * Run migrations sequentially from oldVersion to newVersion
 * Each migration is wrapped in try-catch to prevent data corruption
 *
 * For fresh installs (oldVersion === 0), runs all migrations starting from version 1.
 * For existing users, runs only the migrations needed to reach newVersion.
 *
 * Example: User on v1 opening app with v4 schema runs: 1→2, 2→3, 3→4
 */
function runMigrations(
  db: IDBPDatabase<TacctileDB>,
  oldVersion: number,
  newVersion: number,
  transaction: IDBPTransaction<TacctileDB, ArrayLike<keyof TacctileDB>, 'versionchange'>
): void {
  // For fresh installs, oldVersion is 0, so we start from migration 1
  // For existing users, we start from their current version + 1
  const startVersion = oldVersion + 1;

  if (oldVersion === 0) {
    console.log(`[StorageService] Fresh install - initializing database to v${newVersion}`);
  } else {
    console.log(`[StorageService] Upgrading database from v${oldVersion} to v${newVersion}`);
  }

  // Run each migration in sequence
  for (let version = startVersion; version <= newVersion; version++) {
    const migration = migrations[version];

    if (!migration) {
      console.warn(`[StorageService] No migration found for version ${version}, skipping`);
      continue;
    }

    try {
      console.log(`[StorageService] Running migration to v${version}`);
      migration(db, transaction);
      console.log(`[StorageService] Migration to v${version} completed successfully`);
    } catch (error) {
      // Log the error but don't rethrow - this prevents corrupting the database
      // The transaction will still complete with whatever changes were made before the error
      console.error(`[StorageService] Migration to v${version} failed:`, error);
      console.error(`[StorageService] Database may be in an inconsistent state. ` +
        `Consider implementing a recovery strategy or reverting to a backup.`);
      // We don't rethrow here to avoid aborting the entire upgrade transaction
      // which could leave the database in an unusable state
    }
  }

  console.log(`[StorageService] Database is now at v${newVersion}`);
}

class StorageService {
  private db: IDBPDatabase<TacctileDB> | null = null;
  private dbName = 'tacctile-webapp-db';
  private dbVersion = 1;

  /**
   * Initialize the database
   * Runs migrations sequentially from the user's current version to dbVersion
   */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<TacctileDB>(this.dbName, this.dbVersion, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Run migrations from oldVersion to newVersion
        // oldVersion is 0 for fresh installs, otherwise the user's current version
        runMigrations(db, oldVersion, newVersion ?? db.version, transaction);
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

  /**
   * Clear all localStorage data
   * Removes all tacctile-prefixed keys and other app-related storage
   */
  clearLocalStorage(): void {
    localStorage.clear();
    console.log('[StorageService] localStorage cleared');
  }

  /**
   * Clear all app data (localStorage + IndexedDB)
   * Use this for a complete reset of the application state
   */
  async clearAllData(): Promise<void> {
    // Clear localStorage
    this.clearLocalStorage();

    // Clear all IndexedDB stores
    await this.init();
    await this.db!.clear('investigations');
    await this.db!.clear('evidence');
    await this.db!.clear('settings');
    await this.db!.clear('cache');
    console.log('[StorageService] All app data cleared (localStorage + IndexedDB)');
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
