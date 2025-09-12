import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  WorkspaceTemplate,
  TemplateCategory,
  SessionLayout,
  TemplateRequirement,
  RequirementType,
  CompatibilityInfo,
  UsageStatistics,
  TemplateRating,
  DisplayInfo,
  WindowType,
  MonitoringInterfaceType,
  DataStreamSource,
  WidgetType,
  PositionAnchor,
  InteractionMode,
  InterfaceTheme
} from '../types';
import { DisplayDetectionManager } from '../display/DisplayDetectionManager';

export class WorkspaceTemplateManager extends EventEmitter {
  private templatesDirectory: string;
  private templates: Map<string, WorkspaceTemplate> = new Map();
  private displayManager: DisplayDetectionManager;
  private logger: any;

  constructor(displayManager: DisplayDetectionManager, baseDirectory: string = './data') {
    super();
    this.displayManager = displayManager;
    this.templatesDirectory = path.join(baseDirectory, 'templates');
    this.logger = console; // Replace with actual logger
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure templates directory exists
      await fs.mkdir(this.templatesDirectory, { recursive: true });
      
      // Load existing templates
      await this.loadExistingTemplates();
      
      // Create built-in templates if none exist
      if (this.templates.size === 0) {
        await this.createBuiltInTemplates();
      }
      
      this.emit('initialized');
      this.logger.info('Workspace template manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize workspace template manager:', error);
      this.emit('error', { error, context: 'initialization' });
    }
  }

  private async loadExistingTemplates(): Promise<void> {
    try {
      const templateFiles = await fs.readdir(this.templatesDirectory);
      
      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.templatesDirectory, file);
            const templateData = await fs.readFile(filePath, 'utf-8');
            const template: WorkspaceTemplate = JSON.parse(templateData);
            
            this.templates.set(template.id, template);
            this.logger.info(`Loaded template: ${template.name} (${template.id})`);
          } catch (error) {
            this.logger.error(`Failed to load template file ${file}:`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.templates.size} templates`);
    } catch (error) {
      this.logger.error('Failed to load existing templates:', error);
    }
  }

  private async createBuiltInTemplates(): Promise<void> {
    this.logger.info('Creating built-in workspace templates');

    // Investigation Templates
    await this.createInvestigationTemplate();
    await this.createSurveillanceTemplate();
    await this.createAnalysisTemplate();
    await this.createMonitoringTemplate();
    await this.createDebuggingTemplate();
    await this.createPresentationTemplate();

    this.logger.info('Built-in templates created');
  }

  private async createInvestigationTemplate(): Promise<void> {
    const template: WorkspaceTemplate = {
      id: 'investigation-standard',
      name: 'Standard Investigation Setup',
      description: 'Complete investigation setup with EMF visualization, audio analysis, and correlation monitoring across multiple displays.',
      category: TemplateCategory.INVESTIGATION,
      displayCount: 3,
      layout: {
        id: 'layout-investigation-standard',
        name: 'Investigation Standard Layout',
        description: 'Three-monitor investigation layout',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        displays: [
          {
            displayId: 'primary',
            role: 'primary_control',
            windows: ['main-control', 'session-timeline'],
            priority: 1
          },
          {
            displayId: 'secondary',
            role: 'secondary_monitoring',
            windows: ['emf-visualization', 'audio-analyzer'],
            priority: 2
          },
          {
            displayId: 'tertiary',
            role: 'data_visualization',
            windows: ['correlation-matrix', 'environmental-metrics'],
            priority: 3
          }
        ],
        windows: [
          this.createWindowConfig('main-control', WindowType.MAIN_CONTROL, 'primary', { x: 50, y: 50, width: 1200, height: 800 }),
          this.createWindowConfig('session-timeline', WindowType.SESSION_TIMELINE, 'primary', { x: 50, y: 870, width: 1200, height: 300 }),
          this.createWindowConfig('emf-visualization', WindowType.EMF_VISUALIZATION, 'secondary', { x: 0, y: 0, width: 1920, height: 540 }),
          this.createWindowConfig('audio-analyzer', WindowType.AUDIO_ANALYZER, 'secondary', { x: 0, y: 560, width: 1920, height: 520 }),
          this.createWindowConfig('correlation-matrix', WindowType.CORRELATION_MATRIX, 'tertiary', { x: 0, y: 0, width: 1920, height: 540 }),
          this.createWindowConfig('environmental-metrics', WindowType.ENVIRONMENTAL_METRICS, 'tertiary', { x: 0, y: 560, width: 1920, height: 520 })
        ],
        monitoringInterfaces: [
          this.createMonitoringInterface('emf-monitor', MonitoringInterfaceType.REAL_TIME_HEATMAP, 'secondary', 'emf-visualization', [DataStreamSource.EMF_SENSOR]),
          this.createMonitoringInterface('audio-monitor', MonitoringInterfaceType.WAVEFORM_MONITOR, 'secondary', 'audio-analyzer', [DataStreamSource.AUDIO_ANALYZER]),
          this.createMonitoringInterface('correlation-monitor', MonitoringInterfaceType.CORRELATION_VIEWER, 'tertiary', 'correlation-matrix', [DataStreamSource.CORRELATION_ENGINE]),
          this.createMonitoringInterface('env-monitor', MonitoringInterfaceType.STATUS_BOARD, 'tertiary', 'environmental-metrics', [DataStreamSource.ENVIRONMENTAL_SENSOR])
        ],
        globalSettings: this.createDefaultGlobalSettings(),
        tags: ['investigation', 'standard', 'three-monitor'],
        isDefault: true,
        isLocked: false
      },
      requirements: [
        { type: RequirementType.MIN_DISPLAYS, specification: '3', optional: false },
        { type: RequirementType.MIN_RESOLUTION, specification: '1920x1080', optional: false },
        { type: RequirementType.HARDWARE, specification: 'EMF Sensor', optional: true },
        { type: RequirementType.HARDWARE, specification: 'Audio Input', optional: false }
      ],
      compatibility: {
        electronVersion: ['>=13.0.0'],
        operatingSystem: ['win32', 'darwin', 'linux'],
        minimumRAM: 8192, // 8GB
        minimumStorage: 2048, // 2GB
        gpuAcceleration: true
      },
      usage: {
        timesUsed: 0,
        averageSessionDuration: 0,
        lastUsed: 0,
        userRating: 0
      },
      ratings: {
        average: 0,
        count: 0,
        breakdown: {}
      }
    };

    await this.saveTemplate(template);
  }

  private async createSurveillanceTemplate(): Promise<void> {
    const template: WorkspaceTemplate = {
      id: 'surveillance-dual',
      name: 'Dual-Monitor Surveillance',
      description: 'Optimized for continuous surveillance with live feeds and alert monitoring.',
      category: TemplateCategory.SURVEILLANCE,
      displayCount: 2,
      layout: {
        id: 'layout-surveillance-dual',
        name: 'Surveillance Dual Layout',
        description: 'Two-monitor surveillance setup',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        displays: [
          {
            displayId: 'primary',
            role: 'primary_control',
            windows: ['main-control', 'alert-panel'],
            priority: 1
          },
          {
            displayId: 'secondary',
            role: 'secondary_monitoring',
            windows: ['camera-feed', 'motion-display'],
            priority: 2
          }
        ],
        windows: [
          this.createWindowConfig('main-control', WindowType.MAIN_CONTROL, 'primary', { x: 0, y: 0, width: 960, height: 1080 }),
          this.createWindowConfig('alert-panel', WindowType.ALERT_PANEL, 'primary', { x: 980, y: 0, width: 940, height: 1080 }),
          this.createWindowConfig('camera-feed', WindowType.CAMERA_FEED, 'secondary', { x: 0, y: 0, width: 1920, height: 720 }),
          this.createWindowConfig('motion-display', WindowType.MONITORING_DISPLAY, 'secondary', { x: 0, y: 740, width: 1920, height: 340 })
        ],
        monitoringInterfaces: [
          this.createMonitoringInterface('camera-monitor', MonitoringInterfaceType.LIVE_DASHBOARD, 'secondary', 'camera-feed', [DataStreamSource.CAMERA_360]),
          this.createMonitoringInterface('motion-monitor', MonitoringInterfaceType.STREAMING_CHARTS, 'secondary', 'motion-display', [DataStreamSource.MOTION_DETECTOR]),
          this.createMonitoringInterface('alert-monitor', MonitoringInterfaceType.ALERT_CENTER, 'primary', 'alert-panel', [DataStreamSource.CORRELATION_ENGINE])
        ],
        globalSettings: this.createDefaultGlobalSettings(),
        tags: ['surveillance', 'dual-monitor', 'continuous'],
        isDefault: false,
        isLocked: false
      },
      requirements: [
        { type: RequirementType.MIN_DISPLAYS, specification: '2', optional: false },
        { type: RequirementType.MIN_RESOLUTION, specification: '1920x1080', optional: false },
        { type: RequirementType.HARDWARE, specification: '360° Camera', optional: true }
      ],
      compatibility: {
        electronVersion: ['>=13.0.0'],
        operatingSystem: ['win32', 'darwin', 'linux'],
        minimumRAM: 4096, // 4GB
        minimumStorage: 1024, // 1GB
        gpuAcceleration: false
      },
      usage: {
        timesUsed: 0,
        averageSessionDuration: 0,
        lastUsed: 0,
        userRating: 0
      },
      ratings: {
        average: 0,
        count: 0,
        breakdown: {}
      }
    };

    await this.saveTemplate(template);
  }

  private async createAnalysisTemplate(): Promise<void> {
    const template: WorkspaceTemplate = {
      id: 'analysis-quad',
      name: 'Quad-Monitor Analysis Station',
      description: 'Advanced analysis setup with detailed correlation analysis and data visualization across four monitors.',
      category: TemplateCategory.ANALYSIS,
      displayCount: 4,
      layout: {
        id: 'layout-analysis-quad',
        name: 'Analysis Quad Layout',
        description: 'Four-monitor analysis workstation',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        displays: [
          {
            displayId: 'primary',
            role: 'primary_control',
            windows: ['main-control'],
            priority: 1
          },
          {
            displayId: 'secondary',
            role: 'data_visualization',
            windows: ['correlation-matrix'],
            priority: 2
          },
          {
            displayId: 'tertiary',
            role: 'secondary_monitoring',
            windows: ['emf-visualization', 'audio-analyzer'],
            priority: 3
          },
          {
            displayId: 'quaternary',
            role: 'status_board',
            windows: ['environmental-metrics', 'session-timeline'],
            priority: 4
          }
        ],
        windows: [
          this.createWindowConfig('main-control', WindowType.MAIN_CONTROL, 'primary', { x: 0, y: 0, width: 1920, height: 1080 }),
          this.createWindowConfig('correlation-matrix', WindowType.CORRELATION_MATRIX, 'secondary', { x: 0, y: 0, width: 1920, height: 1080 }),
          this.createWindowConfig('emf-visualization', WindowType.EMF_VISUALIZATION, 'tertiary', { x: 0, y: 0, width: 1920, height: 540 }),
          this.createWindowConfig('audio-analyzer', WindowType.AUDIO_ANALYZER, 'tertiary', { x: 0, y: 560, width: 1920, height: 520 }),
          this.createWindowConfig('environmental-metrics', WindowType.ENVIRONMENTAL_METRICS, 'quaternary', { x: 0, y: 0, width: 1920, height: 540 }),
          this.createWindowConfig('session-timeline', WindowType.SESSION_TIMELINE, 'quaternary', { x: 0, y: 560, width: 1920, height: 520 })
        ],
        monitoringInterfaces: [
          this.createMonitoringInterface('correlation-analysis', MonitoringInterfaceType.CORRELATION_VIEWER, 'secondary', 'correlation-matrix', [DataStreamSource.CORRELATION_ENGINE]),
          this.createMonitoringInterface('emf-analysis', MonitoringInterfaceType.REAL_TIME_HEATMAP, 'tertiary', 'emf-visualization', [DataStreamSource.EMF_SENSOR]),
          this.createMonitoringInterface('audio-analysis', MonitoringInterfaceType.WAVEFORM_MONITOR, 'tertiary', 'audio-analyzer', [DataStreamSource.AUDIO_ANALYZER]),
          this.createMonitoringInterface('env-analysis', MonitoringInterfaceType.DATA_GRID, 'quaternary', 'environmental-metrics', [DataStreamSource.ENVIRONMENTAL_SENSOR])
        ],
        globalSettings: this.createDefaultGlobalSettings(),
        tags: ['analysis', 'quad-monitor', 'advanced'],
        isDefault: false,
        isLocked: false
      },
      requirements: [
        { type: RequirementType.MIN_DISPLAYS, specification: '4', optional: false },
        { type: RequirementType.MIN_RESOLUTION, specification: '1920x1080', optional: false },
        { type: RequirementType.HARDWARE, specification: 'High-end GPU', optional: true }
      ],
      compatibility: {
        electronVersion: ['>=13.0.0'],
        operatingSystem: ['win32', 'darwin', 'linux'],
        minimumRAM: 16384, // 16GB
        minimumStorage: 4096, // 4GB
        gpuAcceleration: true
      },
      usage: {
        timesUsed: 0,
        averageSessionDuration: 0,
        lastUsed: 0,
        userRating: 0
      },
      ratings: {
        average: 0,
        count: 0,
        breakdown: {}
      }
    };

    await this.saveTemplate(template);
  }

  private async createMonitoringTemplate(): Promise<void> {
    const template: WorkspaceTemplate = {
      id: 'monitoring-single',
      name: 'Single Monitor Monitoring',
      description: 'Compact monitoring setup for single display with essential data streams.',
      category: TemplateCategory.MONITORING,
      displayCount: 1,
      layout: {
        id: 'layout-monitoring-single',
        name: 'Monitoring Single Layout',
        description: 'Single-monitor monitoring setup',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        displays: [
          {
            displayId: 'primary',
            role: 'primary_control',
            windows: ['monitoring-display'],
            priority: 1
          }
        ],
        windows: [
          this.createWindowConfig('monitoring-display', WindowType.MONITORING_DISPLAY, 'primary', { x: 0, y: 0, width: 1920, height: 1080 })
        ],
        monitoringInterfaces: [
          this.createMonitoringInterface('compact-monitor', MonitoringInterfaceType.LIVE_DASHBOARD, 'primary', 'monitoring-display', [
            DataStreamSource.MOTION_DETECTOR,
            DataStreamSource.EMF_SENSOR,
            DataStreamSource.AUDIO_ANALYZER,
            DataStreamSource.ENVIRONMENTAL_SENSOR
          ])
        ],
        globalSettings: this.createDefaultGlobalSettings(),
        tags: ['monitoring', 'single-monitor', 'compact'],
        isDefault: false,
        isLocked: false
      },
      requirements: [
        { type: RequirementType.MIN_DISPLAYS, specification: '1', optional: false },
        { type: RequirementType.MIN_RESOLUTION, specification: '1920x1080', optional: false }
      ],
      compatibility: {
        electronVersion: ['>=13.0.0'],
        operatingSystem: ['win32', 'darwin', 'linux'],
        minimumRAM: 2048, // 2GB
        minimumStorage: 512, // 512MB
        gpuAcceleration: false
      },
      usage: {
        timesUsed: 0,
        averageSessionDuration: 0,
        lastUsed: 0,
        userRating: 0
      },
      ratings: {
        average: 0,
        count: 0,
        breakdown: {}
      }
    };

    await this.saveTemplate(template);
  }

  private async createDebuggingTemplate(): Promise<void> {
    const template: WorkspaceTemplate = {
      id: 'debugging-dev',
      name: 'Development & Debugging',
      description: 'Development-focused template with debug console and diagnostic tools.',
      category: TemplateCategory.DEBUGGING,
      displayCount: 2,
      layout: {
        id: 'layout-debugging-dev',
        name: 'Debugging Development Layout',
        description: 'Two-monitor development and debugging setup',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        displays: [
          {
            displayId: 'primary',
            role: 'primary_control',
            windows: ['main-control', 'debug-console'],
            priority: 1
          },
          {
            displayId: 'secondary',
            role: 'debug_console',
            windows: ['settings-panel', 'data-stream'],
            priority: 2
          }
        ],
        windows: [
          this.createWindowConfig('main-control', WindowType.MAIN_CONTROL, 'primary', { x: 0, y: 0, width: 1920, height: 720 }),
          this.createWindowConfig('debug-console', WindowType.DEBUG_CONSOLE, 'primary', { x: 0, y: 740, width: 1920, height: 340 }),
          this.createWindowConfig('settings-panel', WindowType.SETTINGS_PANEL, 'secondary', { x: 0, y: 0, width: 1920, height: 540 }),
          this.createWindowConfig('data-stream', WindowType.DATA_STREAM, 'secondary', { x: 0, y: 560, width: 1920, height: 520 })
        ],
        monitoringInterfaces: [
          this.createMonitoringInterface('debug-monitor', MonitoringInterfaceType.DATA_GRID, 'secondary', 'data-stream', [
            DataStreamSource.MOTION_DETECTOR,
            DataStreamSource.EMF_SENSOR,
            DataStreamSource.AUDIO_ANALYZER
          ])
        ],
        globalSettings: this.createDefaultGlobalSettings(),
        tags: ['debugging', 'development', 'diagnostic'],
        isDefault: false,
        isLocked: false
      },
      requirements: [
        { type: RequirementType.MIN_DISPLAYS, specification: '2', optional: false },
        { type: RequirementType.MIN_RESOLUTION, specification: '1920x1080', optional: false },
        { type: RequirementType.SOFTWARE, specification: 'Development Tools', optional: true }
      ],
      compatibility: {
        electronVersion: ['>=13.0.0'],
        operatingSystem: ['win32', 'darwin', 'linux'],
        minimumRAM: 4096, // 4GB
        minimumStorage: 1024, // 1GB
        gpuAcceleration: false
      },
      usage: {
        timesUsed: 0,
        averageSessionDuration: 0,
        lastUsed: 0,
        userRating: 0
      },
      ratings: {
        average: 0,
        count: 0,
        breakdown: {}
      }
    };

    await this.saveTemplate(template);
  }

  private async createPresentationTemplate(): Promise<void> {
    const template: WorkspaceTemplate = {
      id: 'presentation-dual',
      name: 'Presentation Mode',
      description: 'Presentation-ready setup with clean interfaces optimized for demonstrations.',
      category: TemplateCategory.PRESENTATION,
      displayCount: 2,
      layout: {
        id: 'layout-presentation-dual',
        name: 'Presentation Dual Layout',
        description: 'Two-monitor presentation setup',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        displays: [
          {
            displayId: 'primary',
            role: 'primary_control',
            windows: ['main-control'],
            priority: 1
          },
          {
            displayId: 'secondary',
            role: 'secondary_monitoring',
            windows: ['emf-visualization', 'audio-analyzer'],
            priority: 2
          }
        ],
        windows: [
          this.createWindowConfig('main-control', WindowType.MAIN_CONTROL, 'primary', { x: 0, y: 0, width: 1920, height: 1080 }),
          this.createWindowConfig('emf-visualization', WindowType.EMF_VISUALIZATION, 'secondary', { x: 0, y: 0, width: 1920, height: 540 }),
          this.createWindowConfig('audio-analyzer', WindowType.AUDIO_ANALYZER, 'secondary', { x: 0, y: 560, width: 1920, height: 520 })
        ],
        monitoringInterfaces: [
          this.createMonitoringInterface('emf-presentation', MonitoringInterfaceType.REAL_TIME_HEATMAP, 'secondary', 'emf-visualization', [DataStreamSource.EMF_SENSOR]),
          this.createMonitoringInterface('audio-presentation', MonitoringInterfaceType.WAVEFORM_MONITOR, 'secondary', 'audio-analyzer', [DataStreamSource.AUDIO_ANALYZER])
        ],
        globalSettings: this.createDefaultGlobalSettings(),
        tags: ['presentation', 'demo', 'clean-interface'],
        isDefault: false,
        isLocked: false
      },
      requirements: [
        { type: RequirementType.MIN_DISPLAYS, specification: '2', optional: false },
        { type: RequirementType.MIN_RESOLUTION, specification: '1920x1080', optional: false }
      ],
      compatibility: {
        electronVersion: ['>=13.0.0'],
        operatingSystem: ['win32', 'darwin', 'linux'],
        minimumRAM: 4096, // 4GB
        minimumStorage: 1024, // 1GB
        gpuAcceleration: true
      },
      usage: {
        timesUsed: 0,
        averageSessionDuration: 0,
        lastUsed: 0,
        userRating: 0
      },
      ratings: {
        average: 0,
        count: 0,
        breakdown: {}
      }
    };

    await this.saveTemplate(template);
  }

  private createWindowConfig(id: string, type: WindowType, displayId: string, bounds: { x: number; y: number; width: number; height: number }): any {
    return {
      id,
      title: this.getWindowTitle(type),
      displayId,
      bounds,
      windowType: type,
      alwaysOnTop: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      fullscreenable: true,
      transparent: false,
      opacity: 1.0,
      hasShadow: true,
      focusable: true,
      skipTaskbar: false,
      kiosk: false,
      frame: true,
      show: true,
      modal: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: true
      }
    };
  }

  private getWindowTitle(type: WindowType): string {
    const titles: Record<WindowType, string> = {
      [WindowType.MAIN_CONTROL]: 'Investigation Control Center',
      [WindowType.MONITORING_DISPLAY]: 'Live Monitoring Dashboard',
      [WindowType.DATA_STREAM]: 'Data Stream Viewer',
      [WindowType.EMF_VISUALIZATION]: 'EMF Field Visualization',
      [WindowType.AUDIO_ANALYZER]: 'Audio Frequency Analyzer',
      [WindowType.CAMERA_FEED]: '360° Camera Feed',
      [WindowType.CORRELATION_MATRIX]: 'Multi-Source Correlation Analysis',
      [WindowType.ENVIRONMENTAL_METRICS]: 'Environmental Metrics Monitor',
      [WindowType.SESSION_TIMELINE]: 'Investigation Timeline',
      [WindowType.ALERT_PANEL]: 'Alert Management Panel',
      [WindowType.SETTINGS_PANEL]: 'System Settings',
      [WindowType.DEBUG_CONSOLE]: 'Debug Console'
    };
    return titles[type] || 'Unknown Window';
  }

  private createMonitoringInterface(id: string, type: MonitoringInterfaceType, displayId: string, windowId: string, sources: DataStreamSource[]): any {
    return {
      id,
      type,
      displayId,
      windowId,
      dataStreams: sources.map(source => this.createDataStreamConfig(source)),
      layout: {
        type: 'grid',
        columns: 2,
        rows: 2,
        widgets: this.createDefaultWidgets(sources),
        responsive: true,
        padding: 10,
        margin: 5,
        gap: 10
      },
      refreshRate: 60,
      autoScale: true,
      interactionMode: InteractionMode.read_only,
      theme: InterfaceTheme.DARK,
      filters: [],
      alerts: {
        enabled: true,
        rules: [],
        notifications: [],
        escalation: {
          enabled: false,
          levels: [],
          maxAttempts: 3
        }
      }
    };
  }

  private createDataStreamConfig(source: DataStreamSource): any {
    return {
      id: `stream_${source}_${Date.now()}`,
      name: this.getDataStreamName(source),
      source,
      type: this.getDataStreamType(source),
      updateInterval: 100,
      bufferSize: 1000,
      compression: false,
      encryption: false,
      priority: 'medium',
      format: 'websocket'
    };
  }

  private getDataStreamName(source: DataStreamSource): string {
    const names: Record<DataStreamSource, string> = {
      [DataStreamSource.MOTION_DETECTOR]: 'Motion Detection Stream',
      [DataStreamSource.EMF_SENSOR]: 'EMF Sensor Data',
      [DataStreamSource.AUDIO_ANALYZER]: 'Audio Analysis Stream',
      [DataStreamSource.ENVIRONMENTAL_SENSOR]: 'Environmental Readings',
      [DataStreamSource.CAMERA_360]: '360° Camera Stream',
      [DataStreamSource.CORRELATION_ENGINE]: 'Correlation Analysis',
      [DataStreamSource.BASELINE_MONITOR]: 'Baseline Monitor',
      [DataStreamSource.SENSITIVITY_CONTROLLER]: 'Sensitivity Control'
    };
    return names[source] || 'Unknown Stream';
  }

  private getDataStreamType(source: DataStreamSource): string {
    const types: Record<DataStreamSource, string> = {
      [DataStreamSource.MOTION_DETECTOR]: 'time_series',
      [DataStreamSource.EMF_SENSOR]: 'spatial_data',
      [DataStreamSource.AUDIO_ANALYZER]: 'frequency_spectrum',
      [DataStreamSource.ENVIRONMENTAL_SENSOR]: 'time_series',
      [DataStreamSource.CAMERA_360]: 'image_feed',
      [DataStreamSource.CORRELATION_ENGINE]: 'correlation_matrix',
      [DataStreamSource.BASELINE_MONITOR]: 'status_data',
      [DataStreamSource.SENSITIVITY_CONTROLLER]: 'status_data'
    };
    return types[source] || 'time_series';
  }

  private createDefaultWidgets(sources: DataStreamSource[]): any[] {
    return sources.map((source, index) => ({
      id: `widget_${source}_${index}`,
      type: this.getWidgetType(source),
      position: {
        x: (index % 2) * 50,
        y: Math.floor(index / 2) * 50,
        width: 45,
        height: 45
      },
      dataStream: `stream_${source}_${Date.now()}`,
      properties: this.getWidgetProperties(source),
      style: this.getDefaultWidgetStyle(),
      interactions: []
    }));
  }

  private getWidgetType(source: DataStreamSource): WidgetType {
    const types: Record<DataStreamSource, WidgetType> = {
      [DataStreamSource.MOTION_DETECTOR]: WidgetType.LINE_CHART,
      [DataStreamSource.EMF_SENSOR]: WidgetType.HEATMAP,
      [DataStreamSource.AUDIO_ANALYZER]: WidgetType.WAVEFORM,
      [DataStreamSource.ENVIRONMENTAL_SENSOR]: WidgetType.GAUGE,
      [DataStreamSource.CAMERA_360]: WidgetType.VIDEO_PLAYER,
      [DataStreamSource.CORRELATION_ENGINE]: WidgetType.CORRELATION_GRAPH,
      [DataStreamSource.BASELINE_MONITOR]: WidgetType.STATUS_INDICATOR,
      [DataStreamSource.SENSITIVITY_CONTROLLER]: WidgetType.GAUGE
    };
    return types[source] || WidgetType.LINE_CHART;
  }

  private getWidgetProperties(source: DataStreamSource): Record<string, any> {
    return {
      title: this.getDataStreamName(source),
      showLegend: true,
      showGrid: true,
      autoScale: true,
      refreshRate: 100
    };
  }

  private getDefaultWidgetStyle(): any {
    return {
      backgroundColor: '#1a1a1a',
      borderColor: '#333333',
      borderWidth: 1,
      borderRadius: 4,
      opacity: 1,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontColor: '#ffffff',
      padding: 10,
      margin: 5,
      shadow: true
    };
  }

  private createDefaultGlobalSettings(): any {
    return {
      autoArrange: true,
      snapToGrid: true,
      gridSize: 10,
      theme: InterfaceTheme.DARK,
      animations: true,
      tooltips: true,
      shortcuts: [
        { key: 'F11', modifiers: [], action: 'toggle-fullscreen', context: 'global' },
        { key: 'Escape', modifiers: [], action: 'exit-fullscreen', context: 'global' },
        { key: 'F5', modifiers: [], action: 'refresh-data', context: 'global' }
      ],
      accessibility: {
        highContrast: false,
        largeText: false,
        screenReader: false,
        keyboardNavigation: true,
        reducedMotion: false,
        colorBlindSupport: false
      }
    };
  }

  public async saveTemplate(template: WorkspaceTemplate): Promise<void> {
    try {
      const templatePath = path.join(this.templatesDirectory, `${template.id}.json`);
      const templateData = JSON.stringify(template, null, 2);
      
      await fs.writeFile(templatePath, templateData, 'utf-8');
      
      this.templates.set(template.id, template);
      
      this.emit('template-saved', { templateId: template.id, template });
      this.logger.info(`Template saved: ${template.name} (${template.id})`);
    } catch (error) {
      this.logger.error(`Failed to save template ${template.id}:`, error);
      this.emit('template-save-error', { templateId: template.id, error });
      throw error;
    }
  }

  public async loadTemplate(templateId: string): Promise<WorkspaceTemplate | null> {
    try {
      let template = this.templates.get(templateId);
      if (template) {
        return template;
      }
      
      const templatePath = path.join(this.templatesDirectory, `${templateId}.json`);
      const templateData = await fs.readFile(templatePath, 'utf-8');
      template = JSON.parse(templateData);
      
      this.templates.set(templateId, template);
      this.emit('template-loaded', { templateId, template });
      
      return template;
    } catch (error) {
      this.logger.error(`Failed to load template ${templateId}:`, error);
      this.emit('template-load-error', { templateId, error });
      return null;
    }
  }

  public async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        return false;
      }
      
      // Don't allow deletion of built-in templates
      if (template.id.includes('investigation-') || template.id.includes('surveillance-') || 
          template.id.includes('analysis-') || template.id.includes('monitoring-') ||
          template.id.includes('debugging-') || template.id.includes('presentation-')) {
        this.logger.warn(`Cannot delete built-in template: ${templateId}`);
        return false;
      }
      
      const templatePath = path.join(this.templatesDirectory, `${templateId}.json`);
      await fs.unlink(templatePath);
      
      this.templates.delete(templateId);
      
      this.emit('template-deleted', { templateId });
      this.logger.info(`Template deleted: ${templateId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete template ${templateId}:`, error);
      this.emit('template-delete-error', { templateId, error });
      return false;
    }
  }

  public async applyTemplate(templateId: string, targetDisplays: DisplayInfo[]): Promise<SessionLayout | null> {
    try {
      const template = await this.loadTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      
      // Check compatibility
      const compatibility = this.checkCompatibility(template, targetDisplays);
      if (!compatibility.compatible) {
        this.logger.warn(`Template ${templateId} not compatible:`, compatibility.reasons);
        this.emit('template-incompatible', { templateId, reasons: compatibility.reasons });
        return null;
      }
      
      // Map template displays to actual displays
      const mappedLayout = this.mapTemplateToDisplays(template.layout, targetDisplays);
      
      // Update usage statistics
      template.usage.timesUsed++;
      template.usage.lastUsed = Date.now();
      await this.saveTemplate(template);
      
      this.emit('template-applied', { templateId, template, layout: mappedLayout });
      this.logger.info(`Template applied: ${template.name} (${templateId})`);
      
      return mappedLayout;
    } catch (error) {
      this.logger.error(`Failed to apply template ${templateId}:`, error);
      this.emit('template-apply-error', { templateId, error });
      return null;
    }
  }

  private checkCompatibility(template: WorkspaceTemplate, displays: DisplayInfo[]): { compatible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Check display count
    if (displays.length < template.displayCount) {
      reasons.push(`Requires ${template.displayCount} displays, but only ${displays.length} available`);
    }
    
    // Check minimum resolution
    const minResRequirement = template.requirements.find(r => r.type === RequirementType.MIN_RESOLUTION);
    if (minResRequirement && !minResRequirement.optional) {
      const [minWidth, minHeight] = minResRequirement.specification.split('x').map(Number);
      
      const incompatibleDisplays = displays.filter(display => 
        display.bounds.width < minWidth || display.bounds.height < minHeight
      );
      
      if (incompatibleDisplays.length > 0) {
        reasons.push(`Some displays don't meet minimum resolution requirement: ${minResRequirement.specification}`);
      }
    }
    
    return {
      compatible: reasons.length === 0,
      reasons
    };
  }

  private mapTemplateToDisplays(templateLayout: SessionLayout, displays: DisplayInfo[]): SessionLayout {
    const mappedLayout = JSON.parse(JSON.stringify(templateLayout)); // Deep clone
    
    // Map display IDs
    const displayMapping: Record<string, string> = {};
    
    // Primary display
    const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
    displayMapping['primary'] = primaryDisplay.id;
    
    // Secondary displays
    let nonPrimaryDisplays = displays.filter(d => !d.isPrimary);
    if (nonPrimaryDisplays.length === 0 && displays.length > 1) {
      nonPrimaryDisplays = displays.slice(1);
    }
    
    const displayNames = ['secondary', 'tertiary', 'quaternary'];
    nonPrimaryDisplays.forEach((display, index) => {
      if (index < displayNames.length) {
        displayMapping[displayNames[index]] = display.id;
      }
    });
    
    // Update display references in layout
    mappedLayout.displays.forEach(displayConfig => {
      const actualDisplayId = displayMapping[displayConfig.displayId];
      if (actualDisplayId) {
        displayConfig.displayId = actualDisplayId;
      }
    });
    
    mappedLayout.windows.forEach(windowConfig => {
      const actualDisplayId = displayMapping[windowConfig.displayId];
      if (actualDisplayId) {
        windowConfig.displayId = actualDisplayId;
        
        // Adjust window bounds to fit actual display
        const targetDisplay = displays.find(d => d.id === actualDisplayId);
        if (targetDisplay) {
          windowConfig.bounds = this.adjustWindowBounds(windowConfig.bounds, targetDisplay);
        }
      }
    });
    
    mappedLayout.monitoringInterfaces.forEach(interfaceConfig => {
      const actualDisplayId = displayMapping[interfaceConfig.displayId];
      if (actualDisplayId) {
        interfaceConfig.displayId = actualDisplayId;
      }
    });
    
    // Generate new unique ID for the mapped layout
    mappedLayout.id = `layout_applied_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    mappedLayout.name = `${mappedLayout.name} (Applied)`;
    mappedLayout.createdAt = Date.now();
    mappedLayout.updatedAt = Date.now();
    
    return mappedLayout;
  }

  private adjustWindowBounds(templateBounds: any, display: DisplayInfo): any {
    const displayWorkArea = display.workArea;
    
    // Scale bounds if necessary to fit within display
    let { x, y, width, height } = templateBounds;
    
    // Ensure window fits within display work area
    if (width > displayWorkArea.width) {
      const scale = displayWorkArea.width / width;
      width = displayWorkArea.width * 0.95; // Leave some margin
      height = height * scale;
    }
    
    if (height > displayWorkArea.height) {
      const scale = displayWorkArea.height / height;
      height = displayWorkArea.height * 0.95; // Leave some margin
      width = width * scale;
    }
    
    // Adjust position to be within display bounds
    x = Math.max(displayWorkArea.x, Math.min(x, displayWorkArea.x + displayWorkArea.width - width));
    y = Math.max(displayWorkArea.y, Math.min(y, displayWorkArea.y + displayWorkArea.height - height));
    
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  }

  public getTemplate(templateId: string): WorkspaceTemplate | null {
    return this.templates.get(templateId) || null;
  }

  public listTemplates(): WorkspaceTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplatesByCategory(category: TemplateCategory): WorkspaceTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.category === category);
  }

  public getCompatibleTemplates(displays: DisplayInfo[]): WorkspaceTemplate[] {
    return Array.from(this.templates.values()).filter(template => {
      const compatibility = this.checkCompatibility(template, displays);
      return compatibility.compatible;
    });
  }

  public async rateTemplate(templateId: string, rating: number): Promise<boolean> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      const template = this.templates.get(templateId);
      if (!template) {
        return false;
      }
      
      // Update rating breakdown
      if (!template.ratings.breakdown[rating]) {
        template.ratings.breakdown[rating] = 0;
      }
      template.ratings.breakdown[rating]++;
      
      // Update count and average
      template.ratings.count++;
      
      const totalScore = Object.entries(template.ratings.breakdown)
        .reduce((sum, [score, count]) => sum + (parseInt(score) * count), 0);
      template.ratings.average = totalScore / template.ratings.count;
      
      await this.saveTemplate(template);
      
      this.emit('template-rated', { templateId, rating, newAverage: template.ratings.average });
      return true;
    } catch (error) {
      this.logger.error(`Failed to rate template ${templateId}:`, error);
      return false;
    }
  }

  public async createCustomTemplate(name: string, description: string, layout: SessionLayout): Promise<string> {
    try {
      const templateId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const template: WorkspaceTemplate = {
        id: templateId,
        name,
        description,
        category: TemplateCategory.CUSTOM,
        displayCount: layout.displays.length,
        layout,
        requirements: [
          { type: RequirementType.MIN_DISPLAYS, specification: layout.displays.length.toString(), optional: false }
        ],
        compatibility: {
          electronVersion: ['>=13.0.0'],
          operatingSystem: ['win32', 'darwin', 'linux'],
          minimumRAM: 4096,
          minimumStorage: 1024,
          gpuAcceleration: false
        },
        usage: {
          timesUsed: 0,
          averageSessionDuration: 0,
          lastUsed: 0,
          userRating: 0
        },
        ratings: {
          average: 0,
          count: 0,
          breakdown: {}
        }
      };
      
      await this.saveTemplate(template);
      
      this.emit('custom-template-created', { templateId, template });
      this.logger.info(`Custom template created: ${name} (${templateId})`);
      
      return templateId;
    } catch (error) {
      this.logger.error('Failed to create custom template:', error);
      throw error;
    }
  }

  public dispose(): void {
    this.templates.clear();
    this.removeAllListeners();
    this.logger.info('WorkspaceTemplateManager disposed');
  }
}