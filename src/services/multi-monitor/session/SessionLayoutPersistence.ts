import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SessionLayout,
  MultiMonitorSession,
  SessionStatus,
  DisplayLayoutConfig,
  WindowConfiguration,
  MonitoringInterface,
  GlobalLayoutSettings,
  ActiveWindow,
  ActiveDataStream,
  SessionAlert,
  SessionPerformance,
  SessionSettings,
  LogLevel
} from '../types';

export class SessionLayoutPersistence extends EventEmitter {
  private sessionsDirectory: string;
  private layoutsDirectory: string;
  private activeSessions: Map<string, MultiMonitorSession> = new Map();
  private activeLayouts: Map<string, SessionLayout> = new Map();
  private logger: any;
  private autoSaveTimer?: NodeJS.Timeout;
  private performanceCollector?: NodeJS.Timeout;

  constructor(baseDirectory = './data') {
    super();
    this.sessionsDirectory = path.join(baseDirectory, 'sessions');
    this.layoutsDirectory = path.join(baseDirectory, 'layouts');
    this.logger = console; // Replace with actual logger
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await this.ensureDirectoriesExist();
      
      // Load existing layouts and sessions
      await this.loadExistingLayouts();
      await this.loadActiveSessions();
      
      this.emit('initialized');
      this.logger.info('Session layout persistence initialized');
    } catch (error) {
      this.logger.error('Failed to initialize session layout persistence:', error);
      this.emit('error', { error, context: 'initialization' });
    }
  }

  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDirectory, { recursive: true });
      await fs.mkdir(this.layoutsDirectory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directories: ${error}`);
    }
  }

  private async loadExistingLayouts(): Promise<void> {
    try {
      const layoutFiles = await fs.readdir(this.layoutsDirectory);
      
      for (const file of layoutFiles) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.layoutsDirectory, file);
            const layoutData = await fs.readFile(filePath, 'utf-8');
            const layout: SessionLayout = JSON.parse(layoutData);
            
            this.activeLayouts.set(layout.id, layout);
            this.logger.info(`Loaded layout: ${layout.name} (${layout.id})`);
          } catch (error) {
            this.logger.error(`Failed to load layout file ${file}:`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.activeLayouts.size} layouts`);
    } catch (error) {
      this.logger.error('Failed to load existing layouts:', error);
    }
  }

  private async loadActiveSessions(): Promise<void> {
    try {
      const sessionFiles = await fs.readdir(this.sessionsDirectory);
      
      for (const file of sessionFiles) {
        if (file.endsWith('.json') && !file.endsWith('.backup.json')) {
          try {
            const filePath = path.join(this.sessionsDirectory, file);
            const sessionData = await fs.readFile(filePath, 'utf-8');
            const session: MultiMonitorSession = JSON.parse(sessionData);
            
            // Only load sessions that were not properly closed
            if (session.status === SessionStatus.ACTIVE || session.status === SessionStatus.PAUSED) {
              session.status = SessionStatus.STOPPED; // Mark as stopped since app was restarted
              this.activeSessions.set(session.id, session);
              
              // Auto-save the updated status
              await this.saveSession(session.id);
              
              this.logger.info(`Loaded session: ${session.name} (${session.id})`);
            }
          } catch (error) {
            this.logger.error(`Failed to load session file ${file}:`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.activeSessions.size} sessions`);
    } catch (error) {
      this.logger.error('Failed to load active sessions:', error);
    }
  }

  public async saveLayout(layout: SessionLayout): Promise<void> {
    try {
      const layoutPath = path.join(this.layoutsDirectory, `${layout.id}.json`);
      const layoutData = JSON.stringify(layout, null, 2);
      
      // Create backup if layout exists
      try {
        await fs.access(layoutPath);
        const backupPath = path.join(this.layoutsDirectory, `${layout.id}.backup.json`);
        await fs.copyFile(layoutPath, backupPath);
      } catch {
        // File doesn't exist, no backup needed
      }
      
      await fs.writeFile(layoutPath, layoutData, 'utf-8');
      
      layout.updatedAt = Date.now();
      this.activeLayouts.set(layout.id, layout);
      
      this.emit('layout-saved', { layoutId: layout.id, layout });
      this.logger.info(`Layout saved: ${layout.name} (${layout.id})`);
    } catch (error) {
      this.logger.error(`Failed to save layout ${layout.id}:`, error);
      this.emit('layout-save-error', { layoutId: layout.id, error });
      throw error;
    }
  }

  public async loadLayout(layoutId: string): Promise<SessionLayout | null> {
    try {
      // Check if already loaded
      let layout = this.activeLayouts.get(layoutId);
      if (layout) {
        return layout;
      }
      
      // Load from file
      const layoutPath = path.join(this.layoutsDirectory, `${layoutId}.json`);
      const layoutData = await fs.readFile(layoutPath, 'utf-8');
      layout = JSON.parse(layoutData);
      
      this.activeLayouts.set(layoutId, layout);
      this.emit('layout-loaded', { layoutId, layout });
      
      return layout;
    } catch (error) {
      this.logger.error(`Failed to load layout ${layoutId}:`, error);
      this.emit('layout-load-error', { layoutId, error });
      return null;
    }
  }

  public async deleteLayout(layoutId: string): Promise<boolean> {
    try {
      const layoutPath = path.join(this.layoutsDirectory, `${layoutId}.json`);
      const backupPath = path.join(this.layoutsDirectory, `${layoutId}.backup.json`);
      
      // Remove files
      await fs.unlink(layoutPath);
      try {
        await fs.unlink(backupPath);
      } catch {
        // Backup might not exist
      }
      
      // Remove from memory
      this.activeLayouts.delete(layoutId);
      
      this.emit('layout-deleted', { layoutId });
      this.logger.info(`Layout deleted: ${layoutId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete layout ${layoutId}:`, error);
      this.emit('layout-delete-error', { layoutId, error });
      return false;
    }
  }

  public async createSession(config: Partial<MultiMonitorSession>): Promise<string> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session: MultiMonitorSession = {
        id: sessionId,
        name: config.name || `Investigation Session ${new Date().toLocaleString()}`,
        description: config.description || '',
        startTime: Date.now(),
        status: SessionStatus.INITIALIZING,
        layout: config.layout || this.createDefaultLayout(),
        activeWindows: [],
        dataStreams: [],
        alerts: [],
        performance: this.createDefaultPerformance(),
        settings: config.settings || this.createDefaultSettings()
      };
      
      this.activeSessions.set(sessionId, session);
      await this.saveSession(sessionId);
      
      // Start auto-save if enabled
      if (session.settings.autoSave) {
        this.startAutoSave(sessionId, session.settings.saveInterval);
      }
      
      // Start performance monitoring if enabled
      if (session.settings.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring(sessionId);
      }
      
      this.emit('session-created', { sessionId, session });
      this.logger.info(`Session created: ${session.name} (${sessionId})`);
      
      return sessionId;
    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw error;
    }
  }

  private createDefaultLayout(): SessionLayout {
    return {
      id: `layout_${Date.now()}`,
      name: 'Default Layout',
      description: 'Auto-generated default layout',
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      displays: [],
      windows: [],
      monitoringInterfaces: [],
      globalSettings: {
        autoArrange: true,
        snapToGrid: true,
        gridSize: 10,
        theme: 'dark',
        animations: true,
        tooltips: true,
        shortcuts: [],
        accessibility: {
          highContrast: false,
          largeText: false,
          screenReader: false,
          keyboardNavigation: true,
          reducedMotion: false,
          colorBlindSupport: false
        }
      },
      tags: ['default'],
      isDefault: true,
      isLocked: false
    };
  }

  private createDefaultPerformance(): SessionPerformance {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      gpuUsage: 0,
      networkBandwidth: 0,
      frameRate: {},
      latency: {}
    };
  }

  private createDefaultSettings(): SessionSettings {
    return {
      autoSave: true,
      saveInterval: 30000, // 30 seconds
      logLevel: LogLevel.INFO,
      enablePerformanceMonitoring: true,
      enableDiagnostics: false,
      maxLogSize: 10 * 1024 * 1024, // 10MB
      compressionLevel: 6
    };
  }

  public async saveSession(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      const sessionPath = path.join(this.sessionsDirectory, `${sessionId}.json`);
      const sessionData = JSON.stringify(session, null, 2);
      
      // Create backup if session exists
      try {
        await fs.access(sessionPath);
        const backupPath = path.join(this.sessionsDirectory, `${sessionId}.backup.json`);
        await fs.copyFile(sessionPath, backupPath);
      } catch {
        // File doesn't exist, no backup needed
      }
      
      await fs.writeFile(sessionPath, sessionData, 'utf-8');
      
      this.emit('session-saved', { sessionId, session });
      this.logger.debug(`Session saved: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to save session ${sessionId}:`, error);
      this.emit('session-save-error', { sessionId, error });
      throw error;
    }
  }

  public async loadSession(sessionId: string): Promise<MultiMonitorSession | null> {
    try {
      // Check if already loaded
      let session = this.activeSessions.get(sessionId);
      if (session) {
        return session;
      }
      
      // Load from file
      const sessionPath = path.join(this.sessionsDirectory, `${sessionId}.json`);
      const sessionData = await fs.readFile(sessionPath, 'utf-8');
      session = JSON.parse(sessionData);
      
      this.activeSessions.set(sessionId, session);
      this.emit('session-loaded', { sessionId, session });
      
      return session;
    } catch (error) {
      this.logger.error(`Failed to load session ${sessionId}:`, error);
      this.emit('session-load-error', { sessionId, error });
      return null;
    }
  }

  public async updateSession(sessionId: string, updates: Partial<MultiMonitorSession>): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.error(`Session ${sessionId} not found`);
        return false;
      }
      
      // Apply updates
      Object.assign(session, updates);
      
      // Auto-save if enabled
      if (session.settings.autoSave) {
        await this.saveSession(sessionId);
      }
      
      this.emit('session-updated', { sessionId, updates, session });
      return true;
    } catch (error) {
      this.logger.error(`Failed to update session ${sessionId}:`, error);
      this.emit('session-update-error', { sessionId, error });
      return false;
    }
  }

  public async startSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.error(`Session ${sessionId} not found`);
        return false;
      }
      
      session.status = SessionStatus.ACTIVE;
      session.startTime = Date.now();
      
      await this.saveSession(sessionId);
      
      // Start monitoring
      if (session.settings.autoSave) {
        this.startAutoSave(sessionId, session.settings.saveInterval);
      }
      
      if (session.settings.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring(sessionId);
      }
      
      this.emit('session-started', { sessionId, session });
      this.logger.info(`Session started: ${session.name} (${sessionId})`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start session ${sessionId}:`, error);
      return false;
    }
  }

  public async stopSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.error(`Session ${sessionId} not found`);
        return false;
      }
      
      session.status = SessionStatus.STOPPING;
      session.endTime = Date.now();
      
      // Stop monitoring
      this.stopAutoSave(sessionId);
      this.stopPerformanceMonitoring(sessionId);
      
      // Final save
      session.status = SessionStatus.STOPPED;
      await this.saveSession(sessionId);
      
      this.emit('session-stopped', { sessionId, session });
      this.logger.info(`Session stopped: ${session.name} (${sessionId})`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop session ${sessionId}:`, error);
      return false;
    }
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Stop session if active
      const session = this.activeSessions.get(sessionId);
      if (session && session.status === SessionStatus.ACTIVE) {
        await this.stopSession(sessionId);
      }
      
      const sessionPath = path.join(this.sessionsDirectory, `${sessionId}.json`);
      const backupPath = path.join(this.sessionsDirectory, `${sessionId}.backup.json`);
      
      // Remove files
      await fs.unlink(sessionPath);
      try {
        await fs.unlink(backupPath);
      } catch {
        // Backup might not exist
      }
      
      // Remove from memory
      this.activeSessions.delete(sessionId);
      
      this.emit('session-deleted', { sessionId });
      this.logger.info(`Session deleted: ${sessionId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete session ${sessionId}:`, error);
      this.emit('session-delete-error', { sessionId, error });
      return false;
    }
  }

  private startAutoSave(sessionId: string, interval: number): void {
    this.stopAutoSave(sessionId); // Clear any existing timer
    
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveSession(sessionId);
      } catch (error) {
        this.logger.error(`Auto-save failed for session ${sessionId}:`, error);
      }
    }, interval);
  }

  private stopAutoSave(sessionId: string): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  private startPerformanceMonitoring(sessionId: string): void {
    this.stopPerformanceMonitoring(sessionId); // Clear any existing timer
    
    this.performanceCollector = setInterval(() => {
      this.collectPerformanceData(sessionId);
    }, 5000); // Collect every 5 seconds
  }

  private stopPerformanceMonitoring(sessionId: string): void {
    if (this.performanceCollector) {
      clearInterval(this.performanceCollector);
      this.performanceCollector = undefined;
    }
  }

  private collectPerformanceData(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    // Collect performance data (this would integrate with actual system monitoring)
    const performance: SessionPerformance = {
      cpuUsage: process.cpuUsage().system / 1000000, // Convert to percentage
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      gpuUsage: 0, // Would require GPU monitoring library
      networkBandwidth: 0, // Would require network monitoring
      frameRate: {}, // Would be collected from renderer processes
      latency: {} // Would be measured from data streams
    };
    
    session.performance = performance;
    
    this.emit('performance-updated', { sessionId, performance });
  }

  public addWindowToSession(sessionId: string, window: ActiveWindow): Promise<boolean> {
    return this.updateSession(sessionId, {
      activeWindows: [
        ...((this.activeSessions.get(sessionId)?.activeWindows) || []),
        window
      ]
    });
  }

  public removeWindowFromSession(sessionId: string, windowId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return Promise.resolve(false);
    
    return this.updateSession(sessionId, {
      activeWindows: session.activeWindows.filter(w => w.windowId !== windowId)
    });
  }

  public addDataStreamToSession(sessionId: string, stream: ActiveDataStream): Promise<boolean> {
    return this.updateSession(sessionId, {
      dataStreams: [
        ...((this.activeSessions.get(sessionId)?.dataStreams) || []),
        stream
      ]
    });
  }

  public addAlertToSession(sessionId: string, alert: SessionAlert): Promise<boolean> {
    return this.updateSession(sessionId, {
      alerts: [
        ...((this.activeSessions.get(sessionId)?.alerts) || []),
        alert
      ]
    });
  }

  public getSession(sessionId: string): MultiMonitorSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  public getLayout(layoutId: string): SessionLayout | null {
    return this.activeLayouts.get(layoutId) || null;
  }

  public listSessions(): MultiMonitorSession[] {
    return Array.from(this.activeSessions.values());
  }

  public listLayouts(): SessionLayout[] {
    return Array.from(this.activeLayouts.values());
  }

  public getActiveSessionsCount(): number {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === SessionStatus.ACTIVE).length;
  }

  public async exportSession(sessionId: string, exportPath: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      const exportData = {
        session,
        layout: this.activeLayouts.get(session.layout.id),
        exportedAt: Date.now(),
        version: '1.0.0'
      };
      
      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
      
      this.emit('session-exported', { sessionId, exportPath });
      this.logger.info(`Session exported: ${sessionId} to ${exportPath}`);
    } catch (error) {
      this.logger.error(`Failed to export session ${sessionId}:`, error);
      throw error;
    }
  }

  public async importSession(importPath: string): Promise<string> {
    try {
      const importData = await fs.readFile(importPath, 'utf-8');
      const { session, layout } = JSON.parse(importData);
      
      // Generate new IDs to avoid conflicts
      const newSessionId = `session_imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newLayoutId = `layout_imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update IDs
      session.id = newSessionId;
      session.status = SessionStatus.STOPPED; // Import as stopped
      
      if (layout) {
        layout.id = newLayoutId;
        session.layout = layout;
        await this.saveLayout(layout);
      }
      
      this.activeSessions.set(newSessionId, session);
      await this.saveSession(newSessionId);
      
      this.emit('session-imported', { sessionId: newSessionId, session });
      this.logger.info(`Session imported: ${newSessionId} from ${importPath}`);
      
      return newSessionId;
    } catch (error) {
      this.logger.error(`Failed to import session from ${importPath}:`, error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const sessionFiles = await fs.readdir(this.sessionsDirectory);
      let cleanedCount = 0;
      
      for (const file of sessionFiles) {
        if (file.endsWith('.json') && !file.endsWith('.backup.json')) {
          const filePath = path.join(this.sessionsDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            try {
              const sessionData = await fs.readFile(filePath, 'utf-8');
              const session: MultiMonitorSession = JSON.parse(sessionData);
              
              // Only clean up stopped sessions
              if (session.status === SessionStatus.STOPPED) {
                await fs.unlink(filePath);
                
                // Also remove backup
                const backupPath = path.join(this.sessionsDirectory, `${session.id}.backup.json`);
                try {
                  await fs.unlink(backupPath);
                } catch {
                  // Backup might not exist
                }
                
                this.activeSessions.delete(session.id);
                cleanedCount++;
              }
            } catch (error) {
              this.logger.error(`Error processing file ${file} during cleanup:`, error);
            }
          }
        }
      }
      
      this.emit('cleanup-completed', { cleanedCount });
      this.logger.info(`Cleanup completed: ${cleanedCount} old sessions removed`);
    } catch (error) {
      this.logger.error('Failed to perform cleanup:', error);
      this.emit('cleanup-error', { error });
    }
  }

  public dispose(): void {
    // Stop all timers
    this.stopAutoSave('');
    this.stopPerformanceMonitoring('');
    
    // Clear data
    this.activeSessions.clear();
    this.activeLayouts.clear();
    
    this.removeAllListeners();
    this.logger.info('SessionLayoutPersistence disposed');
  }
}