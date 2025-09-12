/**
 * Auto-save functionality using electron-store
 * Automatically saves application state and user preferences
 */

import Store from 'electron-store';
import { debounce } from 'lodash';

export interface AppState {
  investigations?: any[];
  currentInvestigation?: any;
  userPreferences?: {
    theme: 'light' | 'dark';
    windowSize: { width: number; height: number };
    windowPosition: { x: number; y: number };
    layoutConfig?: any;
    recentFiles?: string[];
  };
  evidenceCache?: Record<string, any>;
  lastSaved?: string;
}

class AutoSaveManager {
  private store: Store<AppState>;
  private debouncedSave: ReturnType<typeof debounce>;

  constructor() {
    // Initialize electron-store with schema validation
    this.store = new Store<AppState>({
      name: 'ghost-hunter-app-state',
      defaults: {
        investigations: [],
        userPreferences: {
          theme: 'dark',
          windowSize: { width: 1200, height: 800 },
          windowPosition: { x: 100, y: 100 },
          recentFiles: [],
        },
        evidenceCache: {},
      },
      schema: {
        investigations: {
          type: 'array',
          default: []
        },
        userPreferences: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              default: 'dark'
            },
            windowSize: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 400 },
                height: { type: 'number', minimum: 300 }
              }
            }
          }
        }
      }
    });

    // Debounced save function (save every 2 seconds max)
    this.debouncedSave = debounce(this.performSave.bind(this), 2000);
  }

  /**
   * Save application state immediately
   */
  private performSave(key: keyof AppState, data: any): void {
    try {
      this.store.set(key, data);
      this.store.set('lastSaved', new Date().toISOString());
      console.log(`Auto-saved: ${key}`);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  /**
   * Schedule an auto-save (debounced)
   */
  public save(key: keyof AppState, data: any): void {
    this.debouncedSave(key, data);
  }

  /**
   * Save immediately without debouncing
   */
  public saveNow(key: keyof AppState, data: any): void {
    this.performSave(key, data);
  }

  /**
   * Load data from storage
   */
  public load<T>(key: keyof AppState): T | undefined {
    return this.store.get(key) as T;
  }

  /**
   * Load all app state
   */
  public loadAll(): AppState {
    return this.store.store;
  }

  /**
   * Clear specific data
   */
  public clear(key: keyof AppState): void {
    this.store.delete(key);
  }

  /**
   * Clear all data (reset app)
   */
  public clearAll(): void {
    this.store.clear();
  }

  /**
   * Get file path for manual backup
   */
  public getStorePath(): string {
    return this.store.path;
  }

  /**
   * Check if auto-save is working
   */
  public isHealthy(): boolean {
    try {
      const testKey = '__health_check__';
      this.store.set(testKey, Date.now());
      const value = this.store.get(testKey);
      this.store.delete(testKey);
      return value !== undefined;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const autoSave = new AutoSaveManager();
export default autoSave;