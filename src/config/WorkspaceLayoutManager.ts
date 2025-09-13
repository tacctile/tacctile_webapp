import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
// import * as crypto from 'crypto';
import {
  WorkspaceLayouts,
  WorkspaceLayout,
  WindowLayout,
  PanelLayout,
  ValidationResult
} from './types';
import { ConfigurationManager } from './ConfigurationManager';

export interface LayoutExport {
  layout: WorkspaceLayout;
  exportedAt: string;
  version: string;
  snapshots?: unknown[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  category: 'investigation' | 'analysis' | 'reporting' | 'presentation' | 'custom';
  preview?: string; // Base64 encoded screenshot or SVG
  layout: WorkspaceLayout;
  metadata: {
    created: string;
    author: string;
    version: string;
    tags: string[];
    requiredFeatures: string[];
    targetResolution?: { width: number; height: number };
  };
}

export interface LayoutSnapshot {
  id: string;
  layoutId: string;
  name: string;
  timestamp: string;
  automatic: boolean;
  layout: WorkspaceLayout;
  metadata: {
    reason: string; // 'manual', 'auto-save', 'crash-recovery', 'session-end'
    sessionId?: string;
    duration?: number; // How long the layout was active
  };
}

export interface LayoutSyncData {
  layouts: WorkspaceLayout[];
  templates: LayoutTemplate[];
  snapshots: LayoutSnapshot[];
  preferences: {
    autoSave: boolean;
    syncAcrossDevices: boolean;
    maxSnapshots: number;
    cleanupInterval: number;
  };
  lastSyncAt: string;
  deviceId: string;
  conflicts?: Array<{
    layoutId: string;
    localVersion: string;
    remoteVersion: string;
    conflictType: 'modified' | 'deleted' | 'renamed';
  }>;
}

export interface LayoutValidation {
  isValid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  recommendations: string[];
}

export class WorkspaceLayoutManager extends EventEmitter {
  private configManager: ConfigurationManager;
  private layouts: WorkspaceLayouts;
  private templates: Map<string, LayoutTemplate> = new Map();
  private snapshots: Map<string, LayoutSnapshot> = new Map();
  private layoutsPath: string;
  private templatesPath: string;
  private snapshotsPath: string;
  private currentSessionId: string;
  private autoSaveInterval?: NodeJS.Timeout;
  private snapshotCleanupInterval?: NodeJS.Timeout;
  private isTrackingChanges = false;
  private pendingChanges: Set<string> = new Set();
  private lastSnapshot?: string;

  constructor(
    configManager: ConfigurationManager,
    layoutsPath = './workspace-layouts'
  ) {
    super();
    this.configManager = configManager;
    this.layoutsPath = layoutsPath;
    this.templatesPath = path.join(layoutsPath, 'templates');
    this.snapshotsPath = path.join(layoutsPath, 'snapshots');
    this.currentSessionId = this.generateSessionId();
    
    this.layouts = this.configManager.get('workspaceLayouts', this.getDefaultLayouts());
    
    this.setupEventListeners();
    this.loadTemplates();
    this.loadSnapshots();
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Workspace Layout Manager...');
      
      await this.ensureDirectories();
      await this.validateExistingLayouts();
      await this.migrateOldLayouts();
      await this.cleanupOldSnapshots();
      
      this.startAutoSave();
      this.startSnapshotCleanup();
      this.startChangeTracking();
      
      this.emit('workspace-manager-initialized');
      console.log('Workspace Layout Manager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Workspace Layout Manager:', error);
      this.emit('workspace-error', error);
      throw error;
    }
  }

  // Layout Management
  public async createLayout(
    name: string,
    description: string,
    basedOn?: string
  ): Promise<string> {
    const layoutId = this.generateLayoutId();
    const baseLayout = basedOn ? this.layouts.layouts[basedOn] : this.getDefaultLayout();
    
    if (basedOn && !baseLayout) {
      throw new Error(`Base layout not found: ${basedOn}`);
    }

    const newLayout: WorkspaceLayout = {
      ...JSON.parse(JSON.stringify(baseLayout)), // Deep clone
      id: layoutId,
      name,
      description,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      author: 'user',
      version: '1.0.0'
    };

    this.layouts.layouts[layoutId] = newLayout;
    await this.saveLayouts();
    
    this.emit('layout-created', newLayout);
    return layoutId;
  }

  public async updateLayout(
    layoutId: string,
    updates: Partial<WorkspaceLayout>
  ): Promise<void> {
    const layout = this.layouts.layouts[layoutId];
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    if (layout.readonly) {
      throw new Error('Cannot update read-only layout');
    }

    // Create snapshot before updating
    await this.createSnapshot(layoutId, 'before-update');

    // Apply updates
    Object.assign(layout, updates, {
      modified: new Date().toISOString(),
      version: this.incrementVersion(layout.version)
    });

    // Validate updated layout
    const validation = this.validateLayout(layout);
    if (!validation.isValid) {
      throw new Error(`Layout validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    await this.saveLayouts();
    this.emit('layout-updated', layout);
  }

  public getLayout(layoutId: string): WorkspaceLayout | undefined {
    return this.layouts.layouts[layoutId] ? 
      JSON.parse(JSON.stringify(this.layouts.layouts[layoutId])) : undefined;
  }

  public listLayouts(): Array<{ id: string; layout: WorkspaceLayout }> {
    return Object.entries(this.layouts.layouts)
      .map(([id, layout]) => ({ id, layout }))
      .sort((a, b) => new Date(b.layout.modified).getTime() - new Date(a.layout.modified).getTime());
  }

  public async duplicateLayout(
    layoutId: string,
    newName: string,
    newDescription?: string
  ): Promise<string> {
    const sourceLayout = this.layouts.layouts[layoutId];
    if (!sourceLayout) {
      throw new Error(`Source layout not found: ${layoutId}`);
    }

    return await this.createLayout(
      newName,
      newDescription || `Copy of ${sourceLayout.name}`,
      layoutId
    );
  }

  public async deleteLayout(layoutId: string): Promise<void> {
    const layout = this.layouts.layouts[layoutId];
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    if (layout.readonly) {
      throw new Error('Cannot delete read-only layout');
    }

    // Don't delete the current layout
    if (this.layouts.current === layoutId) {
      throw new Error('Cannot delete the current layout');
    }

    // Create final snapshot
    await this.createSnapshot(layoutId, 'before-delete');

    delete this.layouts.layouts[layoutId];
    await this.saveLayouts();
    
    // Clean up related snapshots
    await this.cleanupLayoutSnapshots(layoutId);
    
    this.emit('layout-deleted', layoutId);
  }

  // Current Layout Management
  public getCurrentLayout(): WorkspaceLayout | undefined {
    return this.getLayout(this.layouts.current);
  }

  public async setCurrentLayout(layoutId: string): Promise<void> {
    const layout = this.layouts.layouts[layoutId];
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    // Save current layout state before switching
    if (this.layouts.current && this.layouts.current !== layoutId) {
      await this.saveCurrentLayoutState();
    }

    const oldLayoutId = this.layouts.current;
    this.layouts.current = layoutId;
    
    // Add to recent layouts
    if (!this.layouts.recent.includes(layoutId)) {
      this.layouts.recent.unshift(layoutId);
      this.layouts.recent = this.layouts.recent.slice(0, 10); // Keep last 10
    }

    await this.saveLayouts();
    this.emit('current-layout-changed', { from: oldLayoutId, to: layoutId, layout });
  }

  // Window Management
  public async addWindow(windowLayout: WindowLayout): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    if (!currentLayout) {
      throw new Error('No current layout set');
    }

    // Validate window
    const validation = this.validateWindow(windowLayout);
    if (!validation.isValid) {
      throw new Error(`Window validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    currentLayout.windows.push(windowLayout);
    await this.updateLayout(currentLayout.id, currentLayout);
    
    this.emit('window-added', windowLayout);
  }

  public async updateWindow(windowId: string, updates: Partial<WindowLayout>): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    if (!currentLayout) {
      throw new Error('No current layout set');
    }

    const windowIndex = currentLayout.windows.findIndex(w => w.id === windowId);
    if (windowIndex === -1) {
      throw new Error(`Window not found: ${windowId}`);
    }

    Object.assign(currentLayout.windows[windowIndex], updates);
    await this.updateLayout(currentLayout.id, currentLayout);
    
    this.emit('window-updated', currentLayout.windows[windowIndex]);
  }

  public async removeWindow(windowId: string): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    if (!currentLayout) {
      throw new Error('No current layout set');
    }

    const windowIndex = currentLayout.windows.findIndex(w => w.id === windowId);
    if (windowIndex === -1) {
      throw new Error(`Window not found: ${windowId}`);
    }

    const removedWindow = currentLayout.windows.splice(windowIndex, 1)[0];
    await this.updateLayout(currentLayout.id, currentLayout);
    
    this.emit('window-removed', removedWindow);
  }

  // Panel Management
  public async addPanel(panelLayout: PanelLayout): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    if (!currentLayout) {
      throw new Error('No current layout set');
    }

    currentLayout.panels.push(panelLayout);
    await this.updateLayout(currentLayout.id, currentLayout);
    
    this.emit('panel-added', panelLayout);
  }

  public async updatePanel(panelId: string, updates: Partial<PanelLayout>): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    if (!currentLayout) {
      throw new Error('No current layout set');
    }

    const panelIndex = currentLayout.panels.findIndex(p => p.id === panelId);
    if (panelIndex === -1) {
      throw new Error(`Panel not found: ${panelId}`);
    }

    Object.assign(currentLayout.panels[panelIndex], updates);
    await this.updateLayout(currentLayout.id, currentLayout);
    
    this.emit('panel-updated', currentLayout.panels[panelIndex]);
  }

  // Template Management
  public getTemplates(): LayoutTemplate[] {
    return Array.from(this.templates.values());
  }

  public async createTemplate(
    name: string,
    description: string,
    category: LayoutTemplate['category'],
    layoutId: string
  ): Promise<string> {
    const sourceLayout = this.layouts.layouts[layoutId];
    if (!sourceLayout) {
      throw new Error(`Source layout not found: ${layoutId}`);
    }

    const template: LayoutTemplate = {
      id: this.generateTemplateId(),
      name,
      description,
      category,
      layout: JSON.parse(JSON.stringify(sourceLayout)),
      metadata: {
        created: new Date().toISOString(),
        author: 'user',
        version: '1.0.0',
        tags: [],
        requiredFeatures: this.extractLayoutFeatures(sourceLayout)
      }
    };

    this.templates.set(template.id, template);
    await this.saveTemplates();
    
    this.emit('template-created', template);
    return template.id;
  }

  public async applyTemplate(templateId: string): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Create new layout from template
    const layoutId = await this.createLayout(
      `${template.name} (Applied)`,
      `Applied from template: ${template.description}`
    );

    // Apply template layout
    const templateLayout = JSON.parse(JSON.stringify(template.layout));
    templateLayout.id = layoutId;
    templateLayout.name = `${template.name} (Applied)`;
    templateLayout.created = new Date().toISOString();
    templateLayout.modified = new Date().toISOString();

    await this.updateLayout(layoutId, templateLayout);
    
    this.emit('template-applied', { templateId, layoutId });
    return layoutId;
  }

  // Snapshot Management
  public async createSnapshot(
    layoutId?: string,
    reason = 'manual'
  ): Promise<string> {
    const targetLayoutId = layoutId || this.layouts.current;
    const layout = this.layouts.layouts[targetLayoutId];
    
    if (!layout) {
      throw new Error(`Layout not found: ${targetLayoutId}`);
    }

    const snapshot: LayoutSnapshot = {
      id: this.generateSnapshotId(),
      layoutId: targetLayoutId,
      name: `${layout.name} - ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      automatic: reason !== 'manual',
      layout: JSON.parse(JSON.stringify(layout)),
      metadata: {
        reason,
        sessionId: this.currentSessionId
      }
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.lastSnapshot = snapshot.id;
    
    // Limit snapshots per layout
    await this.limitLayoutSnapshots(targetLayoutId);
    await this.saveSnapshots();
    
    this.emit('snapshot-created', snapshot);
    return snapshot.id;
  }

  public async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // Create backup snapshot before restoring
    await this.createSnapshot(snapshot.layoutId, 'before-restore');

    // Restore the layout
    const restoredLayout = JSON.parse(JSON.stringify(snapshot.layout));
    restoredLayout.modified = new Date().toISOString();
    restoredLayout.version = this.incrementVersion(restoredLayout.version);

    await this.updateLayout(snapshot.layoutId, restoredLayout);
    
    this.emit('snapshot-restored', { snapshotId, layoutId: snapshot.layoutId });
  }

  public getSnapshots(layoutId?: string): LayoutSnapshot[] {
    let snapshots = Array.from(this.snapshots.values());
    
    if (layoutId) {
      snapshots = snapshots.filter(s => s.layoutId === layoutId);
    }
    
    return snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    if (!this.snapshots.has(snapshotId)) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    this.snapshots.delete(snapshotId);
    await this.saveSnapshots();
    
    this.emit('snapshot-deleted', snapshotId);
  }

  // Import/Export
  public exportLayout(layoutId: string, includeSnapshots = false): LayoutExport {
    const layout = this.layouts.layouts[layoutId];
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    const exportData: LayoutExport = {
      layout,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    if (includeSnapshots) {
      exportData.snapshots = this.getSnapshots(layoutId);
    }

    return exportData;
  }

  public async importLayout(data: LayoutExport): Promise<string> {
    if (!data.layout) {
      throw new Error('Invalid layout data');
    }

    // Validate imported layout
    const validation = this.validateLayout(data.layout);
    if (!validation.isValid) {
      throw new Error(`Imported layout validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create new layout
    const layoutId = await this.createLayout(
      `${data.layout.name} (Imported)`,
      `Imported layout: ${data.layout.description || 'No description'}`
    );

    // Apply imported layout data
    const importedLayout = { ...data.layout };
    importedLayout.id = layoutId;
    importedLayout.created = new Date().toISOString();
    importedLayout.modified = new Date().toISOString();

    await this.updateLayout(layoutId, importedLayout);

    // Import snapshots if present
    if (data.snapshots && Array.isArray(data.snapshots)) {
      for (const snapshotData of data.snapshots) {
        const snapshot: LayoutSnapshot = {
          ...snapshotData,
          id: this.generateSnapshotId(),
          layoutId,
          timestamp: new Date().toISOString()
        };
        this.snapshots.set(snapshot.id, snapshot);
      }
      await this.saveSnapshots();
    }

    this.emit('layout-imported', { layoutId, data });
    return layoutId;
  }

  // Validation
  public validateLayout(layout: WorkspaceLayout): LayoutValidation {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const recommendations: string[] = [];

    // Basic structure validation
    if (!layout.id || !layout.name) {
      errors.push({
        path: 'layout',
        message: 'Layout must have an ID and name',
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Window validation
    for (const window of layout.windows) {
      const windowValidation = this.validateWindow(window);
      errors.push(...windowValidation.errors);
      warnings.push(...windowValidation.warnings);
    }

    // Check for overlapping windows
    for (let i = 0; i < layout.windows.length; i++) {
      for (let j = i + 1; j < layout.windows.length; j++) {
        if (this.windowsOverlap(layout.windows[i], layout.windows[j])) {
          warnings.push({
            path: 'windows',
            message: `Windows '${layout.windows[i].id}' and '${layout.windows[j].id}' overlap`,
            severity: 'warning',
            code: 'OVERLAPPING_WINDOWS'
          });
        }
      }
    }

    // Panel validation
    for (const panel of layout.panels) {
      if (!panel.id || !panel.type) {
        errors.push({
          path: 'panels',
          message: 'Panel must have an ID and type',
          severity: 'error',
          code: 'INVALID_PANEL'
        });
      }
    }

    // Recommendations
    if (layout.windows.length > 10) {
      recommendations.push('Consider reducing the number of windows for better performance');
    }

    if (layout.zoom < 0.5 || layout.zoom > 3.0) {
      recommendations.push('Zoom level should be between 0.5 and 3.0 for optimal user experience');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  private validateWindow(window: WindowLayout): LayoutValidation {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];

    if (!window.id || !window.type) {
      errors.push({
        path: 'window',
        message: 'Window must have an ID and type',
        severity: 'error',
        code: 'MISSING_WINDOW_FIELDS'
      });
    }

    if (window.bounds.width < 100 || window.bounds.height < 100) {
      errors.push({
        path: 'window.bounds',
        message: 'Window must be at least 100x100 pixels',
        severity: 'error',
        code: 'WINDOW_TOO_SMALL'
      });
    }

    if (window.bounds.x < 0 || window.bounds.y < 0) {
      warnings.push({
        path: 'window.bounds',
        message: 'Window position is outside visible area',
        severity: 'warning',
        code: 'WINDOW_OUTSIDE_BOUNDS'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations: []
    };
  }

  // Private Methods
  private async saveLayouts(): Promise<void> {
    await this.configManager.set('workspaceLayouts', this.layouts);
  }

  private async saveTemplates(): Promise<void> {
    const templatesFile = path.join(this.templatesPath, 'templates.json');
    const data = JSON.stringify(Array.from(this.templates.values()), null, 2);
    await fs.writeFile(templatesFile, data, 'utf8');
  }

  private async saveSnapshots(): Promise<void> {
    const snapshotsFile = path.join(this.snapshotsPath, 'snapshots.json');
    const data = JSON.stringify(Array.from(this.snapshots.values()), null, 2);
    await fs.writeFile(snapshotsFile, data, 'utf8');
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templatesFile = path.join(this.templatesPath, 'templates.json');
      const data = await fs.readFile(templatesFile, 'utf8');
      const templates = JSON.parse(data);
      for (const template of templates) {
        this.templates.set(template.id, template);
      }
    } catch (error) {
      console.log('No existing templates found, creating defaults');
      await this.createDefaultTemplates();
    }
  }

  private async loadSnapshots(): Promise<void> {
    try {
      const snapshotsFile = path.join(this.snapshotsPath, 'snapshots.json');
      const data = await fs.readFile(snapshotsFile, 'utf8');
      const snapshots = JSON.parse(data);
      for (const snapshot of snapshots) {
        this.snapshots.set(snapshot.id, snapshot);
      }
    } catch (error) {
      console.log('No existing snapshots found');
    }
  }

  private async createDefaultTemplates(): Promise<void> {
    const investigationTemplate: LayoutTemplate = {
      id: 'template_investigation',
      name: 'Investigation Workspace',
      description: 'Optimized layout for forensic investigation work',
      category: 'investigation',
      layout: this.createInvestigationLayout(),
      metadata: {
        created: new Date().toISOString(),
        author: 'system',
        version: '1.0.0',
        tags: ['investigation', 'forensics', 'default'],
        requiredFeatures: ['evidence-viewer', 'timeline', 'notes']
      }
    };

    const analysisTemplate: LayoutTemplate = {
      id: 'template_analysis',
      name: 'Analysis Workspace',
      description: 'Layout focused on data analysis and visualization',
      category: 'analysis',
      layout: this.createAnalysisLayout(),
      metadata: {
        created: new Date().toISOString(),
        author: 'system',
        version: '1.0.0',
        tags: ['analysis', 'charts', 'data'],
        requiredFeatures: ['charts', 'graphs', 'statistics']
      }
    };

    this.templates.set(investigationTemplate.id, investigationTemplate);
    this.templates.set(analysisTemplate.id, analysisTemplate);
    
    await this.saveTemplates();
  }

  private createInvestigationLayout(): WorkspaceLayout {
    return {
      id: 'investigation_layout',
      name: 'Investigation Layout',
      description: 'Default investigation workspace',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0',
      author: 'system',
      tags: ['investigation'],
      shared: false,
      readonly: true,
      windows: [],
      panels: [],
      toolbars: [],
      menus: [],
      shortcuts: {},
      theme: 'default',
      zoom: 1.0,
      viewport: { x: 0, y: 0, width: 1920, height: 1080 }
    };
  }

  private createAnalysisLayout(): WorkspaceLayout {
    return {
      id: 'analysis_layout',
      name: 'Analysis Layout',
      description: 'Default analysis workspace',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0',
      author: 'system',
      tags: ['analysis'],
      shared: false,
      readonly: true,
      windows: [],
      panels: [],
      toolbars: [],
      menus: [],
      shortcuts: {},
      theme: 'default',
      zoom: 1.0,
      viewport: { x: 0, y: 0, width: 1920, height: 1080 }
    };
  }

  private setupEventListeners(): void {
    this.configManager.on('config:changed', (path: string) => {
      if (path.startsWith('workspaceLayouts.')) {
        this.pendingChanges.add(path);
      }
    });
  }

  private startAutoSave(): void {
    if (this.layouts.autosave) {
      this.autoSaveInterval = setInterval(async () => {
        if (this.pendingChanges.size > 0 && this.layouts.current) {
          await this.createSnapshot(this.layouts.current, 'auto-save');
          this.pendingChanges.clear();
        }
      }, 30000); // Auto-save every 30 seconds
    }
  }

  private startSnapshotCleanup(): void {
    this.snapshotCleanupInterval = setInterval(async () => {
      await this.cleanupOldSnapshots();
    }, 3600000); // Cleanup every hour
  }

  private startChangeTracking(): void {
    this.isTrackingChanges = true;
  }

  private async saveCurrentLayoutState(): Promise<void> {
    if (this.layouts.current) {
      await this.createSnapshot(this.layouts.current, 'layout-switch');
    }
  }

  private async validateExistingLayouts(): Promise<void> {
    for (const [layoutId, layout] of Object.entries(this.layouts.layouts)) {
      const validation = this.validateLayout(layout);
      if (!validation.isValid) {
        console.warn(`Layout ${layoutId} has validation errors:`, validation.errors);
      }
    }
  }

  private async migrateOldLayouts(): Promise<void> {
    // Migration logic for old layout formats
  }

  private async cleanupOldSnapshots(): Promise<void> {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, snapshot] of this.snapshots) {
      const age = now - new Date(snapshot.timestamp).getTime();
      if (age > maxAge && snapshot.automatic) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.snapshots.delete(id);
    }

    if (toDelete.length > 0) {
      await this.saveSnapshots();
      this.emit('snapshots-cleaned', toDelete.length);
    }
  }

  private async limitLayoutSnapshots(layoutId: string): Promise<void> {
    const maxSnapshotsPerLayout = 20;
    const layoutSnapshots = this.getSnapshots(layoutId);
    
    if (layoutSnapshots.length > maxSnapshotsPerLayout) {
      const toDelete = layoutSnapshots
        .slice(maxSnapshotsPerLayout)
        .filter(s => s.automatic)
        .map(s => s.id);
      
      for (const id of toDelete) {
        this.snapshots.delete(id);
      }
    }
  }

  private async cleanupLayoutSnapshots(layoutId: string): Promise<void> {
    const layoutSnapshots = this.getSnapshots(layoutId);
    for (const snapshot of layoutSnapshots) {
      this.snapshots.delete(snapshot.id);
    }
    await this.saveSnapshots();
  }

  private windowsOverlap(window1: WindowLayout, window2: WindowLayout): boolean {
    const w1 = window1.bounds;
    const w2 = window2.bounds;
    
    return !(w1.x + w1.width <= w2.x || 
             w2.x + w2.width <= w1.x || 
             w1.y + w1.height <= w2.y || 
             w2.y + w2.height <= w1.y);
  }

  private extractLayoutFeatures(layout: WorkspaceLayout): string[] {
    const features: Set<string> = new Set();
    
    // Extract features from windows
    for (const window of layout.windows) {
      features.add(window.type);
    }
    
    // Extract features from panels
    for (const panel of layout.panels) {
      features.add(panel.type);
    }
    
    return Array.from(features);
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private generateLayoutId(): string {
    return `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultLayouts(): WorkspaceLayouts {
    const defaultLayout = this.getDefaultLayout();
    
    return {
      current: 'default',
      layouts: {
        default: defaultLayout
      },
      recent: [],
      autosave: true,
      syncAcrossDevices: false
    };
  }

  private getDefaultLayout(): WorkspaceLayout {
    return {
      id: 'default',
      name: 'Default Layout',
      description: 'Default workspace layout',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0',
      author: 'system',
      tags: ['default'],
      shared: false,
      readonly: false,
      windows: [],
      panels: [],
      toolbars: [],
      menus: [],
      shortcuts: {},
      theme: 'default',
      zoom: 1.0,
      viewport: { x: 0, y: 0, width: 1920, height: 1080 }
    };
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.layoutsPath, { recursive: true });
    await fs.mkdir(this.templatesPath, { recursive: true });
    await fs.mkdir(this.snapshotsPath, { recursive: true });
  }

  public async dispose(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }

    if (this.snapshotCleanupInterval) {
      clearInterval(this.snapshotCleanupInterval);
      this.snapshotCleanupInterval = undefined;
    }

    // Final save and snapshot
    if (this.layouts.current) {
      await this.createSnapshot(this.layouts.current, 'session-end');
    }

    await this.saveTemplates();
    await this.saveSnapshots();
    
    this.removeAllListeners();
  }
}