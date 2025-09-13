import { EventEmitter } from 'events';
// import Database from 'better-sqlite3'; // Temporarily disabled for basic startup
import * as path from 'path';
import * as fs from 'fs/promises';
import { MigrationManager } from './migrations/MigrationManager';
import { DatabaseConnection, DatabaseStatistics } from './types';

export class DatabaseManager extends EventEmitter {
  // private db: Database.Database | null = null; // Temporarily disabled
  private migrationManager: MigrationManager | null = null;
  private connectionInfo: DatabaseConnection;
  private backupInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private logger: Pick<Console, 'log' | 'warn' | 'error'>;

  constructor(dbPath = './data/tacctile.db') {
    super();
    this.logger = console; // Replace with actual logger
    this.connectionInfo = {
      path: dbPath,
      version: 0,
      isOpen: false,
      readonly: false,
      walMode: false
    };
  }

  public async initialize(readonly = false): Promise<void> {
    try {
      this.logger.info(`Initializing database: ${this.connectionInfo.path}`);
      
      // Ensure database directory exists
      await this.ensureDirectoryExists();
      
      // Open database connection
      await this.openConnection(readonly);
      
      // Initialize migration manager
      if (!readonly) {
        this.migrationManager = new MigrationManager(this.connectionInfo.path);
        
        // Set up migration event listeners
        this.setupMigrationEventListeners();
        
        // Run migrations
        await this.migrationManager.migrate();
        this.connectionInfo.version = this.migrationManager.getCurrentVersion();
      }
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Set up automatic backups if not readonly
      if (!readonly) {
        this.setupAutomaticBackups();
      }
      
      this.emit('initialized', this.connectionInfo);
      this.logger.info(`Database initialized successfully - Version: ${this.connectionInfo.version}`);
      
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      this.emit('error', { error, context: 'initialization' });
      throw error;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.connectionInfo.path);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      this.logger.info(`Created database directory: ${dir}`);
    }
  }

  private async openConnection(readonly: boolean): Promise<void> {
    const options: Database.Options = {
      readonly,
      fileMustExist: readonly, // Only require file to exist for readonly connections
      timeout: 10000, // 10 second timeout
      verbose: null // Can be set to console.log for debugging
    };

    this.db = new Database(this.connectionInfo.path, options);
    
    // Configure database
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB
    this.db.pragma('cache_size = -64000'); // 64MB cache
    
    this.connectionInfo.isOpen = true;
    this.connectionInfo.readonly = readonly;
    this.connectionInfo.walMode = true;
    
    this.logger.info(`Database connection opened - Readonly: ${readonly}`);
  }

  private setupMigrationEventListeners(): void {
    if (!this.migrationManager) return;

    this.migrationManager.on('migration-started', (event) => {
      this.logger.info(`Migration started: ${event.version} - ${event.name}`);
      this.emit('migration-started', event);
    });

    this.migrationManager.on('migration-applied', (event) => {
      this.logger.info(`Migration applied: ${event.version} (${event.executionTime}ms)`);
      this.emit('migration-applied', event);
    });

    this.migrationManager.on('migration-completed', (event) => {
      this.logger.info(`All migrations completed: ${event.fromVersion} -> ${event.toVersion}`);
      this.emit('migration-completed', event);
    });

    this.migrationManager.on('migration-failed', (event) => {
      this.logger.error(`Migration failed: ${event.version} - ${event.error}`);
      this.emit('migration-failed', event);
    });
  }

  private startHealthMonitoring(): void {
    // Check database health every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      if (!this.db) return;

      // Test basic connectivity
      const result = this.db.prepare('SELECT 1 as test').get() as { test: number };
      if (result?.test !== 1) {
        throw new Error('Database connectivity test failed');
      }

      // Check WAL mode
      const walCheck = this.db.pragma('journal_mode', { simple: true }) as string;
      if (walCheck !== 'wal') {
        this.logger.warn('Database not in WAL mode');
      }

      // Check foreign keys
      const fkCheck = this.db.pragma('foreign_keys', { simple: true }) as number;
      if (fkCheck !== 1) {
        this.logger.warn('Foreign keys not enabled');
      }

      // Get basic statistics
      const stats = await this.getStatistics();
      
      this.emit('health-check', {
        healthy: true,
        timestamp: Date.now(),
        statistics: stats
      });

    } catch (error) {
      this.logger.error('Database health check failed:', error);
      this.emit('health-check', {
        healthy: false,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  private setupAutomaticBackups(): void {
    // Set up automatic backups every 24 hours
    this.backupInterval = setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        this.logger.error('Automatic backup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  public getDatabase(): Database.Database {
    if (!this.db || !this.connectionInfo.isOpen) {
      throw new Error('Database is not connected');
    }
    return this.db;
  }

  public getMigrationManager(): MigrationManager {
    if (!this.migrationManager) {
      throw new Error('Migration manager not available (readonly mode?)');
    }
    return this.migrationManager;
  }

  public async createBackup(backupPath?: string): Promise<string> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = backupPath || `./backups/tacctile_backup_${timestamp}.db`;
    
    // Ensure backup directory exists
    const backupDir = path.dirname(defaultPath);
    await fs.mkdir(backupDir, { recursive: true });

    try {
      // Use SQLite backup API
      await this.db.backup(defaultPath);
      
      // Verify backup integrity
      const backupDb = new Database(defaultPath, { readonly: true });
      const integrityCheck = backupDb.pragma('integrity_check', { simple: true });
      backupDb.close();
      
      if (integrityCheck !== 'ok') {
        throw new Error(`Backup integrity check failed: ${integrityCheck}`);
      }

      // Get backup file size
      const stats = await fs.stat(defaultPath);
      
      this.emit('backup-created', {
        path: defaultPath,
        size: stats.size,
        timestamp: Date.now()
      });
      
      this.logger.info(`Database backup created: ${defaultPath} (${this.formatBytes(stats.size)})`);
      return defaultPath;
      
    } catch (error) {
      this.logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  public async restoreFromBackup(backupPath: string): Promise<void> {
    if (this.connectionInfo.readonly) {
      throw new Error('Cannot restore to readonly database');
    }

    try {
      // Verify backup file exists and is valid
      await fs.access(backupPath);
      
      // Test backup integrity
      const backupDb = new Database(backupPath, { readonly: true });
      const integrityCheck = backupDb.pragma('integrity_check', { simple: true });
      backupDb.close();
      
      if (integrityCheck !== 'ok') {
        throw new Error(`Backup file integrity check failed: ${integrityCheck}`);
      }

      // Close current connection
      if (this.db) {
        this.db.close();
        this.db = null;
        this.connectionInfo.isOpen = false;
      }

      // Create backup of current database
      const currentBackupPath = `${this.connectionInfo.path}.restore-backup`;
      try {
        await fs.copyFile(this.connectionInfo.path, currentBackupPath);
      } catch (error) {
        this.logger.warn('Could not create backup of current database:', error.message);
      }

      // Copy backup over current database
      await fs.copyFile(backupPath, this.connectionInfo.path);

      // Reopen connection
      await this.openConnection(false);

      // Reinitialize migration manager
      if (this.migrationManager) {
        this.migrationManager.dispose();
      }
      this.migrationManager = new MigrationManager(this.connectionInfo.path);
      this.setupMigrationEventListeners();

      this.emit('backup-restored', {
        backupPath,
        restoredAt: Date.now()
      });

      this.logger.info(`Database restored from backup: ${backupPath}`);

    } catch (error) {
      this.logger.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  public async vacuum(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      this.logger.info('Starting database vacuum...');
      const startTime = Date.now();
      
      this.db.exec('VACUUM');
      
      const duration = Date.now() - startTime;
      this.logger.info(`Database vacuum completed in ${duration}ms`);
      
      this.emit('vacuum-completed', { duration });
      
    } catch (error) {
      this.logger.error('Database vacuum failed:', error);
      throw error;
    }
  }

  public async analyze(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      this.logger.info('Analyzing database...');
      const startTime = Date.now();
      
      this.db.exec('ANALYZE');
      
      const duration = Date.now() - startTime;
      this.logger.info(`Database analysis completed in ${duration}ms`);
      
      this.emit('analyze-completed', { duration });
      
    } catch (error) {
      this.logger.error('Database analysis failed:', error);
      throw error;
    }
  }

  public async getStatistics(): Promise<DatabaseStatistics> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      // Get database size
      const dbSizeResult = this.db.pragma('page_count') as number;
      const pageSizeResult = this.db.pragma('page_size') as number;
      const totalSize = dbSizeResult * pageSizeResult;

      // Get table information
      const tables = this.db.prepare(`
        SELECT name, type FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      // Get index information
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      // Find largest table
      let largestTable = '';
      let largestTableSize = 0;
      
      for (const table of tables) {
        try {
          const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
          if (count.count > largestTableSize) {
            largestTableSize = count.count;
            largestTable = table.name;
          }
        } catch (error) {
          // Skip if table access fails
        }
      }

      return {
        total_size: totalSize,
        table_count: tables.length,
        index_count: indexes.length,
        largest_table: largestTable,
        largest_table_size: largestTableSize,
        most_accessed_table: largestTable, // Simplified - would need query stats
        average_query_time: 0, // Would need performance monitoring
        slow_queries_count: 0, // Would need query logging
        last_analyzed: Date.now()
      };

    } catch (error) {
      this.logger.error('Failed to get database statistics:', error);
      throw error;
    }
  }

  public async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const result = this.db.pragma('integrity_check');
      const errors = Array.isArray(result) 
        ? result.filter(r => r !== 'ok').map(r => r.toString())
        : result === 'ok' ? [] : [result.toString()];

      return {
        ok: errors.length === 0,
        errors
      };

    } catch (error) {
      return {
        ok: false,
        errors: [error.message]
      };
    }
  }

  public async optimizePerformance(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      this.logger.info('Optimizing database performance...');

      // Update statistics
      await this.analyze();

      // Optimize automatic indexing
      this.db.pragma('optimize');

      // Checkpoint WAL file
      const walCheckpoint = this.db.pragma('wal_checkpoint(TRUNCATE)');
      this.logger.info('WAL checkpoint result:', walCheckpoint);

      this.logger.info('Database performance optimization completed');
      this.emit('performance-optimized');

    } catch (error) {
      this.logger.error('Performance optimization failed:', error);
      throw error;
    }
  }

  public getConnectionInfo(): DatabaseConnection {
    return { ...this.connectionInfo };
  }

  public isConnected(): boolean {
    return this.connectionInfo.isOpen && this.db !== null;
  }

  public isReadonly(): boolean {
    return this.connectionInfo.readonly;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public async close(): Promise<void> {
    try {
      // Stop intervals
      if (this.backupInterval) {
        clearInterval(this.backupInterval);
        this.backupInterval = undefined;
      }

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      // Dispose migration manager
      if (this.migrationManager) {
        this.migrationManager.dispose();
        this.migrationManager = null;
      }

      // Close database connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.connectionInfo.isOpen = false;
      
      this.emit('closed');
      this.logger.info('Database connection closed');

    } catch (error) {
      this.logger.error('Error closing database:', error);
      throw error;
    }
  }

  public dispose(): void {
    this.close().catch(error => {
      this.logger.error('Error during dispose:', error);
    });
    
    this.removeAllListeners();
  }
}