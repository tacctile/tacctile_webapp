import { EventEmitter } from 'events';
import {
  MonitoringInterface,
  MonitoringInterfaceType,
  DataStreamConfig,
  DataStreamSource,
  DataStreamType,
  LayoutConfiguration,
  WidgetConfiguration,
  WidgetType,
  InteractionMode,
  InterfaceTheme,
  DataFilter,
  AlertConfiguration,
  AlertRule,
  NotificationConfig,
  StreamPriority,
  DataFormat,
  DataTransform
} from '../types';

export class MonitoringInterfaceManager extends EventEmitter {
  private interfaces: Map<string, MonitoringInterface> = new Map();
  private dataStreams: Map<string, DataStreamHandler> = new Map();
  private activeConnections: Map<string, WebSocket | any> = new Map();
  private logger: any;
  private isRunning: boolean = false;
  private updateInterval?: NodeJS.Timeout;
  private performanceMetrics: Map<string, InterfaceMetrics> = new Map();

  constructor() {
    super();
    this.logger = console; // Replace with actual logger
  }

  public async createInterface(config: Partial<MonitoringInterface>): Promise<string> {
    try {
      const interfaceId = `interface_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const monitoringInterface: MonitoringInterface = {
        id: interfaceId,
        type: config.type || MonitoringInterfaceType.LIVE_DASHBOARD,
        displayId: config.displayId || '',
        windowId: config.windowId || '',
        dataStreams: config.dataStreams || [],
        layout: config.layout || this.createDefaultLayout(),
        refreshRate: config.refreshRate || 60,
        autoScale: config.autoScale !== false,
        interactionMode: config.interactionMode || InteractionMode.READ_only,
        theme: config.theme || InterfaceTheme.DARK,
        filters: config.filters || [],
        alerts: config.alerts || this.createDefaultAlertConfig()
      };

      this.interfaces.set(interfaceId, monitoringInterface);

      // Initialize data streams
      await this.initializeDataStreams(monitoringInterface);

      // Set up interface-specific event handlers
      this.setupInterfaceEventHandlers(interfaceId);

      this.emit('interface-created', { interfaceId, interface: monitoringInterface });
      this.logger.info(`Monitoring interface created: ${interfaceId} (${monitoringInterface.type})`);

      return interfaceId;
    } catch (error) {
      this.logger.error('Failed to create monitoring interface:', error);
      throw error;
    }
  }

  private async initializeDataStreams(monitoringInterface: MonitoringInterface): Promise<void> {
    for (const streamConfig of monitoringInterface.dataStreams) {
      await this.createDataStream(streamConfig);
    }
  }

  private async createDataStream(config: DataStreamConfig): Promise<void> {
    try {
      const handler = new DataStreamHandler(config, this.logger);
      this.dataStreams.set(config.id, handler);

      // Set up stream event handlers
      handler.on('data', (data) => {
        this.handleStreamData(config.id, data);
      });

      handler.on('error', (error) => {
        this.handleStreamError(config.id, error);
      });

      handler.on('connected', () => {
        this.emit('stream-connected', { streamId: config.id });
      });

      handler.on('disconnected', () => {
        this.emit('stream-disconnected', { streamId: config.id });
      });

      await handler.connect();
      this.logger.info(`Data stream initialized: ${config.id} (${config.source})`);
    } catch (error) {
      this.logger.error(`Failed to initialize data stream ${config.id}:`, error);
      throw error;
    }
  }

  private handleStreamData(streamId: string, data: any): void {
    // Find interfaces using this stream
    const affectedInterfaces = Array.from(this.interfaces.values())
      .filter(iface => iface.dataStreams.some(stream => stream.id === streamId));

    for (const iface of affectedInterfaces) {
      // Apply filters
      const filteredData = this.applyFilters(data, iface.filters);
      
      // Check alerts
      this.checkAlerts(filteredData, iface.alerts, streamId);
      
      // Emit data to interface
      this.emit('interface-data', {
        interfaceId: iface.id,
        streamId,
        data: filteredData
      });
    }

    // Update performance metrics
    this.updatePerformanceMetrics(streamId, data);
  }

  private handleStreamError(streamId: string, error: any): void {
    this.logger.error(`Data stream error for ${streamId}:`, error);
    
    // Find affected interfaces
    const affectedInterfaces = Array.from(this.interfaces.values())
      .filter(iface => iface.dataStreams.some(stream => stream.id === streamId));

    for (const iface of affectedInterfaces) {
      this.emit('interface-stream-error', {
        interfaceId: iface.id,
        streamId,
        error
      });
    }
  }

  private applyFilters(data: any, filters: DataFilter[]): any {
    let filteredData = data;

    for (const filter of filters.filter(f => f.enabled)) {
      filteredData = this.applyFilter(filteredData, filter);
    }

    return filteredData;
  }

  private applyFilter(data: any, filter: DataFilter): any {
    switch (filter.type) {
      case 'time_range':
        return this.applyTimeRangeFilter(data, filter.parameters);
      case 'value_range':
        return this.applyValueRangeFilter(data, filter.parameters);
      case 'frequency_range':
        return this.applyFrequencyRangeFilter(data, filter.parameters);
      case 'threshold':
        return this.applyThresholdFilter(data, filter.parameters);
      case 'moving_average':
        return this.applyMovingAverageFilter(data, filter.parameters);
      default:
        return data;
    }
  }

  private applyTimeRangeFilter(data: any, parameters: Record<string, any>): any {
    if (!data.timestamp) return data;
    
    const now = Date.now();
    const timeRange = parameters.range || 30000; // 30 seconds default
    
    if (now - data.timestamp <= timeRange) {
      return data;
    }
    
    return null;
  }

  private applyValueRangeFilter(data: any, parameters: Record<string, any>): any {
    const minValue = parameters.min;
    const maxValue = parameters.max;
    const field = parameters.field || 'value';
    
    if (data[field] !== undefined) {
      if ((minValue !== undefined && data[field] < minValue) ||
          (maxValue !== undefined && data[field] > maxValue)) {
        return null;
      }
    }
    
    return data;
  }

  private applyFrequencyRangeFilter(data: any, parameters: Record<string, any>): any {
    if (!data.frequency) return data;
    
    const minFreq = parameters.minFreq || 0;
    const maxFreq = parameters.maxFreq || Infinity;
    
    if (data.frequency >= minFreq && data.frequency <= maxFreq) {
      return data;
    }
    
    return null;
  }

  private applyThresholdFilter(data: any, parameters: Record<string, any>): any {
    const threshold = parameters.threshold;
    const field = parameters.field || 'value';
    const operator = parameters.operator || 'greater_than';
    
    if (data[field] !== undefined && threshold !== undefined) {
      switch (operator) {
        case 'greater_than':
          return data[field] > threshold ? data : null;
        case 'less_than':
          return data[field] < threshold ? data : null;
        case 'equals':
          return data[field] === threshold ? data : null;
        default:
          return data;
      }
    }
    
    return data;
  }

  private applyMovingAverageFilter(data: any, parameters: Record<string, any>): any {
    // This would require maintaining historical data for moving average calculation
    // For now, return data as-is
    return data;
  }

  private checkAlerts(data: any, alertConfig: AlertConfiguration, streamId: string): void {
    if (!alertConfig.enabled || !data) return;

    for (const rule of alertConfig.rules.filter(r => r.enabled)) {
      const shouldTrigger = this.evaluateAlertRule(data, rule);
      
      if (shouldTrigger) {
        this.triggerAlert(rule, data, streamId);
      }
    }
  }

  private evaluateAlertRule(data: any, rule: AlertRule): boolean {
    const condition = rule.condition;
    const value = data[condition.metric];
    
    if (value === undefined) return false;
    
    switch (condition.operator) {
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than_or_equal':
        return value >= condition.value;
      case 'less_than_or_equal':
        return value <= condition.value;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, data: any, streamId: string): void {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      timestamp: Date.now(),
      streamId,
      data,
      message: this.generateAlertMessage(rule, data)
    };

    // Execute alert actions
    for (const action of rule.actions) {
      this.executeAlertAction(action, alert);
    }

    this.emit('alert-triggered', alert);
    this.logger.warn(`Alert triggered: ${rule.name} (${rule.severity})`);
  }

  private generateAlertMessage(rule: AlertRule, data: any): string {
    const condition = rule.condition;
    const value = data[condition.metric];
    
    return `${rule.name}: ${condition.metric} is ${value} (threshold: ${condition.operator} ${condition.value})`;
  }

  private executeAlertAction(action: any, alert: any): void {
    switch (action.type) {
      case 'notification':
        this.sendNotification(alert, action.parameters);
        break;
      case 'sound':
        this.playAlertSound(action.parameters);
        break;
      case 'highlight':
        this.highlightInterface(alert.streamId, action.parameters);
        break;
      case 'log':
        this.logAlert(alert);
        break;
      default:
        this.logger.warn(`Unknown alert action type: ${action.type}`);
    }
  }

  private sendNotification(alert: any, parameters: Record<string, any>): void {
    // Implementation depends on notification system
    this.emit('notification', {
      title: `${alert.severity.toUpperCase()} Alert`,
      message: alert.message,
      severity: alert.severity,
      ...parameters
    });
  }

  private playAlertSound(parameters: Record<string, any>): void {
    // Implementation depends on audio system
    this.emit('play-sound', {
      soundFile: parameters.soundFile || 'default-alert.wav',
      volume: parameters.volume || 0.8
    });
  }

  private highlightInterface(streamId: string, parameters: Record<string, any>): void {
    const affectedInterfaces = Array.from(this.interfaces.values())
      .filter(iface => iface.dataStreams.some(stream => stream.id === streamId));

    for (const iface of affectedInterfaces) {
      this.emit('highlight-interface', {
        interfaceId: iface.id,
        color: parameters.color || '#ff0000',
        duration: parameters.duration || 5000
      });
    }
  }

  private logAlert(alert: any): void {
    this.logger.warn(`ALERT: ${alert.message}`, {
      ruleId: alert.ruleId,
      severity: alert.severity,
      streamId: alert.streamId,
      timestamp: alert.timestamp
    });
  }

  private updatePerformanceMetrics(streamId: string, data: any): void {
    const existing = this.performanceMetrics.get(streamId);
    const now = Date.now();
    
    const metrics: InterfaceMetrics = {
      streamId,
      lastUpdate: now,
      dataPointsReceived: (existing?.dataPointsReceived || 0) + 1,
      avgLatency: this.calculateAverageLatency(existing, data.timestamp, now),
      bytesReceived: (existing?.bytesReceived || 0) + (JSON.stringify(data).length),
      errorsCount: existing?.errorsCount || 0,
      isHealthy: true
    };
    
    this.performanceMetrics.set(streamId, metrics);
  }

  private calculateAverageLatency(existing: InterfaceMetrics | undefined, dataTimestamp: number, now: number): number {
    if (!dataTimestamp) return existing?.avgLatency || 0;
    
    const currentLatency = now - dataTimestamp;
    
    if (!existing) return currentLatency;
    
    // Exponential moving average
    const alpha = 0.1;
    return (alpha * currentLatency) + ((1 - alpha) * existing.avgLatency);
  }

  private createDefaultLayout(): LayoutConfiguration {
    return {
      type: 'grid',
      columns: 2,
      rows: 2,
      widgets: [],
      responsive: true,
      padding: 10,
      margin: 5,
      gap: 10
    };
  }

  private createDefaultAlertConfig(): AlertConfiguration {
    return {
      enabled: true,
      rules: [],
      notifications: [
        {
          type: 'system',
          enabled: true,
          settings: {}
        }
      ],
      escalation: {
        enabled: false,
        levels: [],
        maxAttempts: 3
      }
    };
  }

  private setupInterfaceEventHandlers(interfaceId: string): void {
    // Set up interface-specific handlers
    this.on(`interface-data-${interfaceId}`, (data) => {
      // Handle interface-specific data
    });
  }

  public async updateInterface(interfaceId: string, updates: Partial<MonitoringInterface>): Promise<boolean> {
    try {
      const existingInterface = this.interfaces.get(interfaceId);
      if (!existingInterface) {
        this.logger.error(`Interface ${interfaceId} not found`);
        return false;
      }

      // Apply updates
      const updatedInterface = { ...existingInterface, ...updates };
      this.interfaces.set(interfaceId, updatedInterface);

      // Handle data stream changes
      if (updates.dataStreams) {
        await this.updateDataStreams(interfaceId, updates.dataStreams);
      }

      this.emit('interface-updated', { interfaceId, updates, interface: updatedInterface });
      return true;
    } catch (error) {
      this.logger.error(`Failed to update interface ${interfaceId}:`, error);
      return false;
    }
  }

  private async updateDataStreams(interfaceId: string, newStreams: DataStreamConfig[]): Promise<void> {
    const existingInterface = this.interfaces.get(interfaceId)!;
    const existingStreamIds = existingInterface.dataStreams.map(s => s.id);
    const newStreamIds = newStreams.map(s => s.id);

    // Remove deleted streams
    for (const streamId of existingStreamIds) {
      if (!newStreamIds.includes(streamId)) {
        await this.removeDataStream(streamId);
      }
    }

    // Add new streams
    for (const stream of newStreams) {
      if (!existingStreamIds.includes(stream.id)) {
        await this.createDataStream(stream);
      }
    }
  }

  private async removeDataStream(streamId: string): Promise<void> {
    const handler = this.dataStreams.get(streamId);
    if (handler) {
      await handler.disconnect();
      this.dataStreams.delete(streamId);
      this.performanceMetrics.delete(streamId);
      this.logger.info(`Data stream removed: ${streamId}`);
    }
  }

  public getInterface(interfaceId: string): MonitoringInterface | null {
    return this.interfaces.get(interfaceId) || null;
  }

  public listInterfaces(): MonitoringInterface[] {
    return Array.from(this.interfaces.values());
  }

  public getInterfacesByType(type: MonitoringInterfaceType): MonitoringInterface[] {
    return Array.from(this.interfaces.values()).filter(iface => iface.type === type);
  }

  public getInterfacesByDisplay(displayId: string): MonitoringInterface[] {
    return Array.from(this.interfaces.values()).filter(iface => iface.displayId === displayId);
  }

  public async deleteInterface(interfaceId: string): Promise<boolean> {
    try {
      const existingInterface = this.interfaces.get(interfaceId);
      if (!existingInterface) {
        return false;
      }

      // Remove all data streams for this interface
      for (const stream of existingInterface.dataStreams) {
        await this.removeDataStream(stream.id);
      }

      this.interfaces.delete(interfaceId);
      this.emit('interface-deleted', { interfaceId });
      
      this.logger.info(`Interface deleted: ${interfaceId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete interface ${interfaceId}:`, error);
      return false;
    }
  }

  public getPerformanceMetrics(streamId?: string): InterfaceMetrics | Map<string, InterfaceMetrics> {
    if (streamId) {
      return this.performanceMetrics.get(streamId) || null;
    }
    return new Map(this.performanceMetrics);
  }

  public startMonitoring(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Start performance monitoring
    this.updateInterval = setInterval(() => {
      this.performHealthChecks();
      this.emitPerformanceUpdate();
    }, 5000); // Every 5 seconds

    this.emit('monitoring-started');
    this.logger.info('Monitoring interface manager started');
  }

  public stopMonitoring(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.emit('monitoring-stopped');
    this.logger.info('Monitoring interface manager stopped');
  }

  private performHealthChecks(): void {
    for (const [streamId, metrics] of this.performanceMetrics) {
      const timeSinceLastUpdate = Date.now() - metrics.lastUpdate;
      const isHealthy = timeSinceLastUpdate < 30000; // 30 seconds threshold
      
      if (metrics.isHealthy !== isHealthy) {
        metrics.isHealthy = isHealthy;
        
        this.emit('stream-health-changed', {
          streamId,
          isHealthy,
          timeSinceLastUpdate
        });

        if (!isHealthy) {
          this.logger.warn(`Data stream unhealthy: ${streamId} (${timeSinceLastUpdate}ms since last update)`);
        }
      }
    }
  }

  private emitPerformanceUpdate(): void {
    const summary = {
      totalStreams: this.performanceMetrics.size,
      healthyStreams: Array.from(this.performanceMetrics.values()).filter(m => m.isHealthy).length,
      totalInterfaces: this.interfaces.size,
      timestamp: Date.now()
    };

    this.emit('performance-update', summary);
  }

  public dispose(): void {
    this.stopMonitoring();

    // Disconnect all data streams
    for (const handler of this.dataStreams.values()) {
      handler.disconnect().catch(error => {
        this.logger.error('Error disconnecting stream:', error);
      });
    }

    // Clear all data
    this.interfaces.clear();
    this.dataStreams.clear();
    this.activeConnections.clear();
    this.performanceMetrics.clear();

    this.removeAllListeners();
    this.logger.info('MonitoringInterfaceManager disposed');
  }
}

// Helper class for handling individual data streams
class DataStreamHandler extends EventEmitter {
  private config: DataStreamConfig;
  private connection: any;
  private isConnected: boolean = false;
  private reconnectTimer?: NodeJS.Timeout;
  private buffer: any[] = [];
  private logger: any;

  constructor(config: DataStreamConfig, logger: any) {
    super();
    this.config = config;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    try {
      switch (this.config.format) {
        case DataFormat.WEBSOCKET:
          await this.connectWebSocket();
          break;
        case DataFormat.WEBRTC:
          await this.connectWebRTC();
          break;
        default:
          await this.connectDefault();
      }
      
      this.isConnected = true;
      this.emit('connected');
      this.logger.info(`Data stream connected: ${this.config.id}`);
    } catch (error) {
      this.logger.error(`Failed to connect stream ${this.config.id}:`, error);
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  private async connectWebSocket(): Promise<void> {
    // WebSocket connection implementation
    const wsUrl = this.getWebSocketUrl();
    this.connection = new WebSocket(wsUrl);
    
    this.connection.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.handleData(data);
      } catch (error) {
        this.logger.error('Error parsing WebSocket data:', error);
      }
    };

    this.connection.onerror = (error: Event) => {
      this.emit('error', error);
    };

    this.connection.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    };
  }

  private async connectWebRTC(): Promise<void> {
    // WebRTC connection implementation
    // This would depend on the specific WebRTC setup
    throw new Error('WebRTC connection not implemented');
  }

  private async connectDefault(): Promise<void> {
    // Default connection for other formats
    // This could be HTTP polling, Server-Sent Events, etc.
    this.scheduleDataPolling();
  }

  private getWebSocketUrl(): string {
    // Generate WebSocket URL based on stream source
    const baseUrl = 'ws://localhost:8080';
    const endpoints: Record<DataStreamSource, string> = {
      [DataStreamSource.MOTION_DETECTOR]: '/motion',
      [DataStreamSource.EMF_SENSOR]: '/emf',
      [DataStreamSource.AUDIO_ANALYZER]: '/audio',
      [DataStreamSource.ENVIRONMENTAL_SENSOR]: '/environment',
      [DataStreamSource.CAMERA_360]: '/camera',
      [DataStreamSource.CORRELATION_ENGINE]: '/correlation',
      [DataStreamSource.BASELINE_MONITOR]: '/baseline',
      [DataStreamSource.SENSITIVITY_CONTROLLER]: '/sensitivity'
    };
    
    return `${baseUrl}${endpoints[this.config.source] || '/default'}`;
  }

  private scheduleDataPolling(): void {
    const pollInterval = Math.max(this.config.updateInterval, 100); // Minimum 100ms
    
    setInterval(() => {
      if (this.isConnected) {
        this.pollData();
      }
    }, pollInterval);
  }

  private async pollData(): Promise<void> {
    // Poll data from source
    try {
      const data = await this.fetchDataFromSource();
      this.handleData(data);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async fetchDataFromSource(): Promise<any> {
    // Fetch data based on stream source
    // This is a mock implementation
    return {
      timestamp: Date.now(),
      value: Math.random() * 100,
      source: this.config.source,
      type: this.config.type
    };
  }

  private handleData(data: any): void {
    // Apply transforms if configured
    let processedData = data;
    
    if (this.config.transform) {
      processedData = this.applyTransforms(data);
    }

    // Buffer data if needed
    if (this.config.bufferSize > 0) {
      this.buffer.push(processedData);
      if (this.buffer.length > this.config.bufferSize) {
        this.buffer.shift();
      }
    }

    this.emit('data', processedData);
  }

  private applyTransforms(data: any): any {
    let result = data;
    
    if (this.config.transform?.pipeline) {
      for (const step of this.config.transform.pipeline) {
        result = this.applyTransformStep(result, step);
      }
    }
    
    return result;
  }

  private applyTransformStep(data: any, step: any): any {
    switch (step.operation) {
      case 'normalize':
        return this.normalizeData(data, step.parameters);
      case 'filter':
        return this.filterData(data, step.parameters);
      case 'aggregate':
        return this.aggregateData(data, step.parameters);
      default:
        return data;
    }
  }

  private normalizeData(data: any, parameters: Record<string, any>): any {
    // Normalize data values
    const min = parameters.min || 0;
    const max = parameters.max || 100;
    
    if (data.value !== undefined) {
      data.value = (data.value - min) / (max - min);
    }
    
    return data;
  }

  private filterData(data: any, parameters: Record<string, any>): any {
    // Apply filtering logic
    return data;
  }

  private aggregateData(data: any, parameters: Record<string, any>): any {
    // Apply aggregation logic
    return data;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    const reconnectDelay = 5000; // 5 seconds
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch(error => {
        this.logger.error(`Reconnect failed for stream ${this.config.id}:`, error);
      });
    }, reconnectDelay);
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.connection) {
      if (this.connection.close) {
        this.connection.close();
      }
      this.connection = null;
    }
    
    this.emit('disconnected');
    this.logger.info(`Data stream disconnected: ${this.config.id}`);
  }
}

interface InterfaceMetrics {
  streamId: string;
  lastUpdate: number;
  dataPointsReceived: number;
  avgLatency: number;
  bytesReceived: number;
  errorsCount: number;
  isHealthy: boolean;
}