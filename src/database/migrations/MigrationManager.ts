import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import {
  Migration,
  MigrationState,
  MigrationInfo,
  DatabaseConnection
} from '../types';

export class MigrationManager extends EventEmitter {
  private db: Database.Database;
  private migrationsDirectory: string;
  private migrations: Map<number, Migration> = new Map();
  private currentState: MigrationState;
  private logger: any;

  constructor(dbPath: string, migrationsDir = './src/database/migrations') {
    super();
    this.db = new Database(dbPath, { verbose: null });
    this.migrationsDirectory = migrationsDir;
    this.logger = console; // Replace with actual logger
    this.currentState = {
      current_version: 0,
      in_progress: false
    };
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Enable WAL mode and foreign keys
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA foreign_keys = ON');
      this.db.exec('PRAGMA synchronous = NORMAL');
      
      // Create migrations tracking table
      await this.createMigrationsTable();
      
      // Load existing migrations from directory
      await this.loadMigrations();
      
      // Get current migration state
      await this.getCurrentState();
      
      this.emit('initialized', {
        currentVersion: this.currentState.current_version,
        availableMigrations: this.migrations.size
      });
      
      this.logger.info(`Migration manager initialized - Current version: ${this.currentState.current_version}`);
    } catch (error) {
      this.logger.error('Failed to initialize migration manager:', error);
      this.emit('error', { error, context: 'initialization' });
      throw error;
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        execution_time INTEGER, -- milliseconds
        applied_by TEXT DEFAULT 'system',
        rollback_checksum TEXT,
        
        CHECK (version > 0),
        CHECK (execution_time IS NULL OR execution_time >= 0)
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON schema_migrations(applied_at);
      CREATE INDEX IF NOT EXISTS idx_migrations_version ON schema_migrations(version);
    `;
    
    this.db.exec(createTableSQL);
    
    // Also create migration state table for tracking ongoing migrations
    const createStateTableSQL = `
      CREATE TABLE IF NOT EXISTS migration_state (
        id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row allowed
        current_version INTEGER NOT NULL DEFAULT 0,
        target_version INTEGER,
        in_progress BOOLEAN NOT NULL DEFAULT 0,
        last_migration_at INTEGER,
        failed_migration INTEGER,
        error_message TEXT,
        locked_by TEXT,
        locked_at INTEGER,
        
        CHECK (current_version >= 0),
        CHECK (target_version IS NULL OR target_version >= 0),
        CHECK (failed_migration IS NULL OR failed_migration > 0)
      );
      
      -- Insert default state if not exists
      INSERT OR IGNORE INTO migration_state (id, current_version) VALUES (1, 0);
    `;
    
    this.db.exec(createStateTableSQL);
  }

  private async loadMigrations(): Promise<void> {
    try {
      const migrationFiles = await fs.readdir(this.migrationsDirectory);
      
      for (const file of migrationFiles) {
        if (file.endsWith('.sql') && file.match(/^\d+_/)) {
          await this.loadMigrationFile(file);
        }
      }
      
      this.logger.info(`Loaded ${this.migrations.size} migration files`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`Migrations directory not found: ${this.migrationsDirectory}`);
        // Create directory
        await fs.mkdir(this.migrationsDirectory, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  private async loadMigrationFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.migrationsDirectory, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Parse version from filename (format: 001_migration_name.sql)
      const versionMatch = filename.match(/^(\d+)_/);
      if (!versionMatch) {
        this.logger.warn(`Invalid migration filename format: ${filename}`);
        return;
      }
      
      const version = parseInt(versionMatch[1], 10);
      
      // Parse migration content
      const migration = this.parseMigrationContent(content, version, filename);
      
      this.migrations.set(version, migration);
      this.logger.debug(`Loaded migration: ${migration.name} (version ${version})`);
    } catch (error) {
      this.logger.error(`Failed to load migration file ${filename}:`, error);
      throw error;
    }
  }

  private parseMigrationContent(content: string, version: number, filename: string): Migration {
    const lines = content.split('\n');
    let name = '';
    let description = '';
    let upSQL = '';
    let downSQL = '';
    let currentSection = 'header';
    let dependencies: number[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('-- Name:')) {
        name = trimmedLine.replace('-- Name:', '').trim();
      } else if (trimmedLine.startsWith('-- Description:')) {
        description = trimmedLine.replace('-- Description:', '').trim();
      } else if (trimmedLine.startsWith('-- Dependencies:')) {
        const depStr = trimmedLine.replace('-- Dependencies:', '').trim();
        if (depStr && depStr !== 'none') {
          dependencies = depStr.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
        }
      } else if (trimmedLine === '-- UP MIGRATION') {
        currentSection = 'up';
        continue;
      } else if (trimmedLine === '-- DOWN MIGRATION') {
        currentSection = 'down';
        continue;
      }
      
      if (currentSection === 'up' && !trimmedLine.startsWith('--')) {
        upSQL += line + '\n';
      } else if (currentSection === 'down' && !trimmedLine.startsWith('--')) {
        downSQL += line + '\n';
      }
    }
    
    // Default name from filename if not specified
    if (!name) {
      name = filename.replace(/^\d+_/, '').replace('.sql', '').replace(/_/g, ' ');
    }
    
    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(upSQL.trim()).digest('hex');
    
    return {
      version,
      name,
      description: description || `Migration ${version}`,
      up: upSQL.trim(),
      down: downSQL.trim(),
      dependencies,
      checksum
    };
  }

  private async getCurrentState(): Promise<void> {
    const stateRow = this.db.prepare('SELECT * FROM migration_state WHERE id = 1').get() as any;
    
    if (stateRow) {
      this.currentState = {
        current_version: stateRow.current_version,
        target_version: stateRow.target_version,
        in_progress: stateRow.in_progress === 1,
        last_migration_at: stateRow.last_migration_at,
        failed_migration: stateRow.failed_migration,
        error_message: stateRow.error_message
      };
    }
  }

  public async migrate(targetVersion?: number): Promise<void> {
    if (this.currentState.in_progress) {
      throw new Error('Migration already in progress');
    }
    
    const currentVersion = this.currentState.current_version;
    const maxVersion = Math.max(...this.migrations.keys());
    const actualTargetVersion = targetVersion || maxVersion;
    
    if (actualTargetVersion === currentVersion) {
      this.logger.info('Database is already at target version');
      return;
    }
    
    if (actualTargetVersion < currentVersion) {
      await this.rollback(actualTargetVersion);
      return;
    }
    
    try {
      // Lock migration state
      await this.lockMigrations(actualTargetVersion);
      
      // Get migrations to apply
      const migrationsToApply = this.getMigrationsToApply(currentVersion, actualTargetVersion);
      
      this.logger.info(`Migrating from version ${currentVersion} to ${actualTargetVersion} (${migrationsToApply.length} migrations)`);
      
      for (const migration of migrationsToApply) {
        await this.applyMigration(migration);
      }
      
      // Update final state
      await this.updateMigrationState({
        current_version: actualTargetVersion,
        target_version: null,
        in_progress: false,
        last_migration_at: Date.now()
      });
      
      this.currentState.current_version = actualTargetVersion;
      this.currentState.in_progress = false;
      
      this.emit('migration-completed', {
        fromVersion: currentVersion,
        toVersion: actualTargetVersion,
        migrationsApplied: migrationsToApply.length
      });
      
      this.logger.info(`Migration completed successfully - Now at version ${actualTargetVersion}`);
      
    } catch (error) {
      await this.handleMigrationError(error);
      throw error;
    }
  }

  public async rollback(targetVersion: number): Promise<void> {
    if (this.currentState.in_progress) {
      throw new Error('Migration in progress, cannot rollback');
    }
    
    const currentVersion = this.currentState.current_version;
    
    if (targetVersion >= currentVersion) {
      throw new Error('Target version must be lower than current version for rollback');
    }
    
    try {
      await this.lockMigrations(targetVersion);
      
      const migrationsToRollback = this.getMigrationsToRollback(currentVersion, targetVersion);
      
      this.logger.info(`Rolling back from version ${currentVersion} to ${targetVersion} (${migrationsToRollback.length} migrations)`);
      
      for (const migration of migrationsToRollback) {
        await this.rollbackMigration(migration);
      }
      
      await this.updateMigrationState({
        current_version: targetVersion,
        target_version: null,
        in_progress: false,
        last_migration_at: Date.now()
      });
      
      this.currentState.current_version = targetVersion;
      this.currentState.in_progress = false;
      
      this.emit('rollback-completed', {
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsRolledBack: migrationsToRollback.length
      });
      
      this.logger.info(`Rollback completed successfully - Now at version ${targetVersion}`);
      
    } catch (error) {
      await this.handleMigrationError(error);
      throw error;
    }
  }

  private async lockMigrations(targetVersion: number): Promise<void> {
    const updateResult = this.db.prepare(`
      UPDATE migration_state 
      SET 
        in_progress = 1,
        target_version = ?,
        locked_by = 'migration_manager',
        locked_at = strftime('%s', 'now')
      WHERE id = 1 AND in_progress = 0
    `).run(targetVersion);
    
    if (updateResult.changes === 0) {
      throw new Error('Could not acquire migration lock - another migration may be in progress');
    }
    
    this.currentState.in_progress = true;
    this.currentState.target_version = targetVersion;
  }

  private getMigrationsToApply(fromVersion: number, toVersion: number): Migration[] {
    const migrations: Migration[] = [];
    
    for (let version = fromVersion + 1; version <= toVersion; version++) {
      const migration = this.migrations.get(version);
      if (!migration) {
        throw new Error(`Migration version ${version} not found`);
      }
      migrations.push(migration);
    }
    
    // Validate dependencies
    for (const migration of migrations) {
      if (migration.dependencies) {
        for (const depVersion of migration.dependencies) {
          if (depVersion > fromVersion && !migrations.some(m => m.version === depVersion)) {
            throw new Error(`Migration ${migration.version} depends on ${depVersion} which is not being applied`);
          }
        }
      }
    }
    
    return migrations;
  }

  private getMigrationsToRollback(fromVersion: number, toVersion: number): Migration[] {
    const migrations: Migration[] = [];
    
    for (let version = fromVersion; version > toVersion; version--) {
      const migration = this.migrations.get(version);
      if (!migration) {
        throw new Error(`Migration version ${version} not found for rollback`);
      }
      if (!migration.down || migration.down.trim() === '') {
        throw new Error(`Migration version ${version} does not have a down migration`);
      }
      migrations.push(migration);
    }
    
    return migrations;
  }

  private async applyMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    this.emit('migration-started', { version: migration.version, name: migration.name });
    this.logger.info(`Applying migration ${migration.version}: ${migration.name}`);
    
    try {
      // Validate checksum
      const currentChecksum = crypto.createHash('sha256').update(migration.up).digest('hex');
      if (currentChecksum !== migration.checksum) {
        throw new Error(`Migration ${migration.version} checksum mismatch - file may have been modified`);
      }
      
      // Apply migration in transaction
      const applyTransaction = this.db.transaction(() => {
        // Execute the migration SQL
        this.db.exec(migration.up);
        
        // Record successful migration
        const executionTime = Date.now() - startTime;
        this.db.prepare(`
          INSERT INTO schema_migrations 
          (version, name, description, checksum, execution_time, rollback_checksum)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          migration.version,
          migration.name,
          migration.description,
          migration.checksum,
          executionTime,
          migration.down ? crypto.createHash('sha256').update(migration.down).digest('hex') : null
        );
      });
      
      applyTransaction();
      
      const executionTime = Date.now() - startTime;
      
      this.emit('migration-applied', { 
        version: migration.version, 
        name: migration.name, 
        executionTime 
      });
      
      this.logger.info(`Migration ${migration.version} applied successfully (${executionTime}ms)`);
      
    } catch (error) {
      this.logger.error(`Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }

  private async rollbackMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    this.emit('rollback-started', { version: migration.version, name: migration.name });
    this.logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);
    
    try {
      // Apply rollback in transaction
      const rollbackTransaction = this.db.transaction(() => {
        // Execute the rollback SQL
        this.db.exec(migration.down);
        
        // Remove migration record
        this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
      });
      
      rollbackTransaction();
      
      const executionTime = Date.now() - startTime;
      
      this.emit('migration-rolledback', { 
        version: migration.version, 
        name: migration.name, 
        executionTime 
      });
      
      this.logger.info(`Migration ${migration.version} rolled back successfully (${executionTime}ms)`);
      
    } catch (error) {
      this.logger.error(`Failed to rollback migration ${migration.version}:`, error);
      throw error;
    }
  }

  private async updateMigrationState(updates: Partial<MigrationState>): Promise<void> {
    const fields = [];
    const values = [];
    
    if (updates.current_version !== undefined) {
      fields.push('current_version = ?');
      values.push(updates.current_version);
    }
    
    if (updates.target_version !== undefined) {
      fields.push('target_version = ?');
      values.push(updates.target_version);
    }
    
    if (updates.in_progress !== undefined) {
      fields.push('in_progress = ?');
      values.push(updates.in_progress ? 1 : 0);
    }
    
    if (updates.last_migration_at !== undefined) {
      fields.push('last_migration_at = ?');
      values.push(updates.last_migration_at);
    }
    
    if (updates.failed_migration !== undefined) {
      fields.push('failed_migration = ?');
      values.push(updates.failed_migration);
    }
    
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message);
    }
    
    if (fields.length > 0) {
      const sql = `UPDATE migration_state SET ${fields.join(', ')} WHERE id = 1`;
      this.db.prepare(sql).run(...values);
    }
  }

  private async handleMigrationError(error: any): Promise<void> {
    const failedVersion = this.currentState.target_version || this.currentState.current_version;
    
    await this.updateMigrationState({
      in_progress: false,
      target_version: null,
      failed_migration: failedVersion,
      error_message: error.message
    });
    
    this.currentState.in_progress = false;
    this.currentState.failed_migration = failedVersion;
    this.currentState.error_message = error.message;
    
    this.emit('migration-failed', {
      version: failedVersion,
      error: error.message
    });
  }

  public async createMigration(name: string, description?: string): Promise<string> {
    // Get next version number
    const maxVersion = this.migrations.size > 0 ? Math.max(...this.migrations.keys()) : 0;
    const nextVersion = maxVersion + 1;
    
    // Generate filename
    const versionPadded = nextVersion.toString().padStart(3, '0');
    const nameSanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const filename = `${versionPadded}_${nameSanitized}.sql`;
    
    // Generate migration template
    const template = `-- Name: ${name}
-- Description: ${description || 'Migration description'}
-- Dependencies: none

-- UP MIGRATION
-- Add your migration SQL here



-- DOWN MIGRATION  
-- Add your rollback SQL here


`;
    
    // Write file
    const filePath = path.join(this.migrationsDirectory, filename);
    await fs.writeFile(filePath, template, 'utf-8');
    
    this.logger.info(`Created migration file: ${filename}`);
    
    // Reload migrations to include the new one
    await this.loadMigrationFile(filename);
    
    return filePath;
  }

  public getCurrentVersion(): number {
    return this.currentState.current_version;
  }

  public getAvailableVersions(): number[] {
    return Array.from(this.migrations.keys()).sort((a, b) => a - b);
  }

  public getMigrationInfo(version: number): MigrationInfo | null {
    const migration = this.migrations.get(version);
    if (!migration) return null;
    
    // Check if applied
    const appliedRow = this.db.prepare(`
      SELECT applied_at, execution_time 
      FROM schema_migrations 
      WHERE version = ?
    `).get(version) as any;
    
    return {
      version: migration.version,
      name: migration.name,
      description: migration.description,
      upScript: migration.up,
      downScript: migration.down,
      appliedAt: appliedRow?.applied_at,
      executionTime: appliedRow?.execution_time
    };
  }

  public getAppliedMigrations(): MigrationInfo[] {
    const rows = this.db.prepare(`
      SELECT version, name, description, applied_at, execution_time
      FROM schema_migrations 
      ORDER BY version
    `).all() as any[];
    
    return rows.map(row => ({
      version: row.version,
      name: row.name,
      description: row.description,
      upScript: '',
      downScript: '',
      appliedAt: row.applied_at,
      executionTime: row.execution_time
    }));
  }

  public getPendingMigrations(): MigrationInfo[] {
    const appliedVersions = new Set(
      this.db.prepare('SELECT version FROM schema_migrations').all()
        .map((row: any) => row.version)
    );
    
    const pending = [];
    for (const [version, migration] of this.migrations) {
      if (version > this.currentState.current_version && !appliedVersions.has(version)) {
        pending.push({
          version: migration.version,
          name: migration.name,
          description: migration.description,
          upScript: migration.up,
          downScript: migration.down
        });
      }
    }
    
    return pending.sort((a, b) => a.version - b.version);
  }

  public getMigrationState(): MigrationState {
    return { ...this.currentState };
  }

  public async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Check for version gaps
      const versions = this.getAvailableVersions();
      for (let i = 1; i < versions.length; i++) {
        if (versions[i] !== versions[i - 1] + 1) {
          errors.push(`Version gap detected: missing version ${versions[i - 1] + 1}`);
        }
      }
      
      // Check for applied migrations that no longer exist
      const appliedVersions = this.getAppliedMigrations().map(m => m.version);
      for (const version of appliedVersions) {
        if (!this.migrations.has(version)) {
          errors.push(`Applied migration ${version} no longer exists in migration files`);
        }
      }
      
      // Check for checksum mismatches
      for (const appliedMigration of this.getAppliedMigrations()) {
        const migration = this.migrations.get(appliedMigration.version);
        if (migration) {
          const dbChecksum = this.db.prepare('SELECT checksum FROM schema_migrations WHERE version = ?')
            .get(appliedMigration.version) as any;
          
          if (dbChecksum && dbChecksum.checksum !== migration.checksum) {
            errors.push(`Checksum mismatch for migration ${appliedMigration.version}: file may have been modified after application`);
          }
        }
      }
      
      // Check dependencies
      for (const migration of this.migrations.values()) {
        if (migration.dependencies) {
          for (const depVersion of migration.dependencies) {
            if (!this.migrations.has(depVersion)) {
              errors.push(`Migration ${migration.version} depends on non-existent migration ${depVersion}`);
            } else if (depVersion >= migration.version) {
              errors.push(`Migration ${migration.version} has invalid dependency ${depVersion} (must be lower version)`);
            }
          }
        }
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async reset(): Promise<void> {
    this.logger.warn('Resetting database - this will drop all data!');
    
    // Drop all tables except migrations tracking
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT IN ('schema_migrations', 'migration_state')
    `).all() as any[];
    
    for (const table of tables) {
      this.db.exec(`DROP TABLE IF EXISTS ${table.name}`);
    }
    
    // Reset migration state
    await this.updateMigrationState({
      current_version: 0,
      target_version: null,
      in_progress: false,
      failed_migration: null,
      error_message: null,
      last_migration_at: null
    });
    
    this.currentState.current_version = 0;
    
    // Clear applied migrations
    this.db.exec('DELETE FROM schema_migrations');
    
    this.emit('database-reset');
    this.logger.info('Database reset completed');
  }

  public dispose(): void {
    if (this.db) {
      this.db.close();
    }
    this.removeAllListeners();
    this.logger.info('Migration manager disposed');
  }
}