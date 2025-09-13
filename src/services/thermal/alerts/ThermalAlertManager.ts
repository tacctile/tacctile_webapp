import { EventEmitter } from 'events';
import {
  ThermalAlert,
  ThermalAlertRule,
  ThermalAlertType,
  ThermalFrame,
  TemperaturePoint,
  ThermalRegion,
  AlertPriority,
  AlertNotificationMethod,
  ThermalAlertHistory,
  AlertStatistics
} from '../types';
import { logger } from '../../../utils/logger';

export class ThermalAlertManager extends EventEmitter {
  private rules: Map<string, ThermalAlertRule>;
  private activeAlerts: Map<string, ThermalAlert>;
  private alertHistory: ThermalAlertHistory[];
  private statistics: AlertStatistics;
  private isEnabled: boolean;
  private lastFrameTimestamp: number;
  private alertCounters: Map<string, number>;
  private cooldownTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    super();
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.statistics = this.initializeStatistics();
    this.isEnabled = true;
    this.lastFrameTimestamp = 0;
    this.alertCounters = new Map();
    this.cooldownTimers = new Map();

    this.setupDefaultRules();
  }

  private initializeStatistics(): AlertStatistics {
    return {
      totalAlerts: 0,
      alertsByType: new Map(),
      alertsByPriority: new Map(),
      averageResponseTime: 0,
      falsePositiveRate: 0,
      lastCalculated: new Date()
    };
  }

  private setupDefaultRules(): void {
    const defaultRules: ThermalAlertRule[] = [
      {
        id: 'high-temp-critical',
        name: 'Critical High Temperature',
        type: ThermalAlertType.HIGH_TEMPERATURE,
        threshold: 80,
        priority: AlertPriority.CRITICAL,
        enabled: true,
        region: null, // Global
        hysteresis: 2.0,
        minDuration: 1000, // 1 second
        cooldownPeriod: 30000, // 30 seconds
        notificationMethods: [AlertNotificationMethod.POPUP, AlertNotificationMethod.SOUND],
        conditions: {
          minPixelCount: 10,
          spatialFiltering: true,
          temporalFiltering: true
        }
      },
      {
        id: 'rapid-temp-change',
        name: 'Rapid Temperature Change',
        type: ThermalAlertType.RAPID_CHANGE,
        threshold: 10, // 10°C per second
        priority: AlertPriority.HIGH,
        enabled: true,
        region: null,
        hysteresis: 1.0,
        minDuration: 500,
        cooldownPeriod: 10000,
        notificationMethods: [AlertNotificationMethod.POPUP],
        conditions: {
          minPixelCount: 5,
          spatialFiltering: true,
          temporalFiltering: false
        }
      },
      {
        id: 'anomaly-detection',
        name: 'Temperature Anomaly',
        type: ThermalAlertType.ANOMALY,
        threshold: 3, // 3 standard deviations
        priority: AlertPriority.MEDIUM,
        enabled: true,
        region: null,
        hysteresis: 0.5,
        minDuration: 2000,
        cooldownPeriod: 15000,
        notificationMethods: [AlertNotificationMethod.LOG],
        conditions: {
          minPixelCount: 20,
          spatialFiltering: true,
          temporalFiltering: true
        }
      }
    ];

    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  addRule(rule: ThermalAlertRule): void {
    this.rules.set(rule.id, { ...rule });
    logger.info(`Added alert rule: ${rule.name}`);
    this.emit('rule-added', rule);
  }

  removeRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.delete(ruleId);
    this.clearRuleAlerts(ruleId);
    logger.info(`Removed alert rule: ${rule.name}`);
    this.emit('rule-removed', ruleId);
    return true;
  }

  updateRule(ruleId: string, updates: Partial<ThermalAlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    logger.info(`Updated alert rule: ${rule.name}`);
    this.emit('rule-updated', updatedRule);
    return true;
  }

  processFrame(frame: ThermalFrame): ThermalAlert[] {
    if (!this.isEnabled) return [];

    const newAlerts: ThermalAlert[] = [];
    this.lastFrameTimestamp = frame.timestamp;

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      try {
        const alerts = this.evaluateRule(rule, frame);
        newAlerts.push(...alerts);
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }

    // Update statistics
    this.updateStatistics(newAlerts);

    // Process new alerts
    newAlerts.forEach(alert => {
      this.activeAlerts.set(alert.id, alert);
      this.alertHistory.push({
        alert,
        timestamp: new Date(),
        acknowledged: false,
        resolved: false
      });
      this.triggerNotifications(alert);
      this.emit('alert-triggered', alert);
    });

    return newAlerts;
  }

  private evaluateRule(rule: ThermalAlertRule, frame: ThermalFrame): ThermalAlert[] {
    const alerts: ThermalAlert[] = [];

    switch (rule.type) {
      case ThermalAlertType.HIGH_TEMPERATURE:
        alerts.push(...this.evaluateHighTemperature(rule, frame));
        break;
      case ThermalAlertType.LOW_TEMPERATURE:
        alerts.push(...this.evaluateLowTemperature(rule, frame));
        break;
      case ThermalAlertType.RAPID_CHANGE:
        alerts.push(...this.evaluateRapidChange(rule, frame));
        break;
      case ThermalAlertType.ANOMALY:
        alerts.push(...this.evaluateAnomaly(rule, frame));
        break;
      case ThermalAlertType.PATTERN:
        alerts.push(...this.evaluatePattern(rule, frame));
        break;
    }

    return alerts.filter(alert => this.shouldTriggerAlert(rule, alert));
  }

  private evaluateHighTemperature(rule: ThermalAlertRule, frame: ThermalFrame): ThermalAlert[] {
    const alerts: ThermalAlert[] = [];
    const temperatureData = frame.temperatureData;
    const threshold = rule.threshold;

    // Find hot spots
    const hotSpots: TemperaturePoint[] = [];
    for (let i = 0; i < temperatureData.length; i++) {
      const temp = temperatureData[i];
      if (temp >= threshold) {
        const x = i % frame.width;
        const y = Math.floor(i / frame.width);
        hotSpots.push({ x, y, temperature: temp });
      }
    }

    if (hotSpots.length >= (rule.conditions?.minPixelCount || 1)) {
      // Group nearby hot spots
      const clusters = this.clusterHotSpots(hotSpots, 10); // 10 pixel radius

      clusters.forEach((cluster, index) => {
        const maxTemp = Math.max(...cluster.map(p => p.temperature));
        const avgTemp = cluster.reduce((sum, p) => sum + p.temperature, 0) / cluster.length;
        
        const alertId = `${rule.id}-${frame.frameNumber}-${index}`;
        const alert: ThermalAlert = {
          id: alertId,
          ruleId: rule.id,
          type: rule.type,
          priority: rule.priority,
          timestamp: frame.timestamp,
          message: `High temperature detected: ${maxTemp.toFixed(1)}°C`,
          location: this.calculateClusterCenter(cluster),
          temperature: maxTemp,
          region: this.createRegionFromCluster(cluster),
          metadata: {
            frameNumber: frame.frameNumber,
            pixelCount: cluster.length,
            averageTemperature: avgTemp,
            threshold: threshold
          }
        };

        alerts.push(alert);
      });
    }

    return alerts;
  }

  private evaluateLowTemperature(rule: ThermalAlertRule, frame: ThermalFrame): ThermalAlert[] {
    const alerts: ThermalAlert[] = [];
    const temperatureData = frame.temperatureData;
    const threshold = rule.threshold;

    const coldSpots: TemperaturePoint[] = [];
    for (let i = 0; i < temperatureData.length; i++) {
      const temp = temperatureData[i];
      if (temp <= threshold) {
        const x = i % frame.width;
        const y = Math.floor(i / frame.width);
        coldSpots.push({ x, y, temperature: temp });
      }
    }

    if (coldSpots.length >= (rule.conditions?.minPixelCount || 1)) {
      const clusters = this.clusterHotSpots(coldSpots, 10);

      clusters.forEach((cluster, index) => {
        const minTemp = Math.min(...cluster.map(p => p.temperature));
        const avgTemp = cluster.reduce((sum, p) => sum + p.temperature, 0) / cluster.length;
        
        const alertId = `${rule.id}-${frame.frameNumber}-${index}`;
        const alert: ThermalAlert = {
          id: alertId,
          ruleId: rule.id,
          type: rule.type,
          priority: rule.priority,
          timestamp: frame.timestamp,
          message: `Low temperature detected: ${minTemp.toFixed(1)}°C`,
          location: this.calculateClusterCenter(cluster),
          temperature: minTemp,
          region: this.createRegionFromCluster(cluster),
          metadata: {
            frameNumber: frame.frameNumber,
            pixelCount: cluster.length,
            averageTemperature: avgTemp,
            threshold: threshold
          }
        };

        alerts.push(alert);
      });
    }

    return alerts;
  }

  private evaluateRapidChange(rule: ThermalAlertRule, frame: ThermalFrame): ThermalAlert[] {
    // Implementation would require frame history for temporal analysis
    // For now, return empty array - would need previous frame data
    return [];
  }

  private evaluateAnomaly(rule: ThermalAlertRule, frame: ThermalFrame): ThermalAlert[] {
    const alerts: ThermalAlert[] = [];
    const temperatureData = frame.temperatureData;
    
    // Calculate statistical parameters
    const mean = frame.avgTemp;
    const variance = temperatureData.reduce((sum, temp) => sum + Math.pow(temp - mean, 2), 0) / temperatureData.length;
    const stdDev = Math.sqrt(variance);
    const threshold = rule.threshold; // Number of standard deviations

    const anomalies: TemperaturePoint[] = [];
    for (let i = 0; i < temperatureData.length; i++) {
      const temp = temperatureData[i];
      const zScore = Math.abs(temp - mean) / stdDev;
      
      if (zScore >= threshold) {
        const x = i % frame.width;
        const y = Math.floor(i / frame.width);
        anomalies.push({ x, y, temperature: temp });
      }
    }

    if (anomalies.length >= (rule.conditions?.minPixelCount || 1)) {
      const clusters = this.clusterHotSpots(anomalies, 15);

      clusters.forEach((cluster, index) => {
        const maxTemp = Math.max(...cluster.map(p => p.temperature));
        const minTemp = Math.min(...cluster.map(p => p.temperature));
        const avgTemp = cluster.reduce((sum, p) => sum + p.temperature, 0) / cluster.length;
        
        const alertId = `${rule.id}-${frame.frameNumber}-${index}`;
        const alert: ThermalAlert = {
          id: alertId,
          ruleId: rule.id,
          type: rule.type,
          priority: rule.priority,
          timestamp: frame.timestamp,
          message: `Temperature anomaly detected: ${avgTemp.toFixed(1)}°C (${((avgTemp - mean) / stdDev).toFixed(1)}σ)`,
          location: this.calculateClusterCenter(cluster),
          temperature: avgTemp,
          region: this.createRegionFromCluster(cluster),
          metadata: {
            frameNumber: frame.frameNumber,
            pixelCount: cluster.length,
            averageTemperature: avgTemp,
            standardDeviation: stdDev,
            zScore: (avgTemp - mean) / stdDev,
            threshold: threshold
          }
        };

        alerts.push(alert);
      });
    }

    return alerts;
  }

  private evaluatePattern(rule: ThermalAlertRule, frame: ThermalFrame): ThermalAlert[] {
    // Pattern recognition would require more complex implementation
    // This could include shape detection, temperature gradients, etc.
    return [];
  }

  private clusterHotSpots(points: TemperaturePoint[], radius: number): TemperaturePoint[][] {
    const clusters: TemperaturePoint[][] = [];
    const visited = new Set<number>();

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;

      const cluster: TemperaturePoint[] = [points[i]];
      visited.add(i);

      // Find nearby points
      for (let j = i + 1; j < points.length; j++) {
        if (visited.has(j)) continue;

        const distance = Math.sqrt(
          Math.pow(points[i].x - points[j].x, 2) + 
          Math.pow(points[i].y - points[j].y, 2)
        );

        if (distance <= radius) {
          cluster.push(points[j]);
          visited.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private calculateClusterCenter(cluster: TemperaturePoint[]): { x: number; y: number } {
    const sumX = cluster.reduce((sum, p) => sum + p.x, 0);
    const sumY = cluster.reduce((sum, p) => sum + p.y, 0);
    return {
      x: Math.round(sumX / cluster.length),
      y: Math.round(sumY / cluster.length)
    };
  }

  private createRegionFromCluster(cluster: TemperaturePoint[]): ThermalRegion {
    const minX = Math.min(...cluster.map(p => p.x));
    const maxX = Math.max(...cluster.map(p => p.x));
    const minY = Math.min(...cluster.map(p => p.y));
    const maxY = Math.max(...cluster.map(p => p.y));

    return {
      id: `cluster-${Date.now()}`,
      name: 'Alert Region',
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ],
      isActive: true
    };
  }

  private shouldTriggerAlert(rule: ThermalAlertRule, alert: ThermalAlert): boolean {
    // Check cooldown
    const cooldownKey = `${rule.id}-${alert.location.x}-${alert.location.y}`;
    if (this.cooldownTimers.has(cooldownKey)) {
      return false;
    }

    // Apply cooldown
    const timer = setTimeout(() => {
      this.cooldownTimers.delete(cooldownKey);
    }, rule.cooldownPeriod);
    this.cooldownTimers.set(cooldownKey, timer);

    return true;
  }

  private triggerNotifications(alert: ThermalAlert): void {
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return;

    rule.notificationMethods.forEach(method => {
      switch (method) {
        case AlertNotificationMethod.POPUP:
          this.emit('show-popup', alert);
          break;
        case AlertNotificationMethod.SOUND:
          this.emit('play-sound', { alert, soundType: this.getSoundType(alert.priority) });
          break;
        case AlertNotificationMethod.EMAIL:
          this.emit('send-email', alert);
          break;
        case AlertNotificationMethod.LOG:
          logger.warn(`Thermal Alert: ${alert.message}`, {
            location: alert.location,
            temperature: alert.temperature,
            priority: alert.priority
          });
          break;
      }
    });
  }

  private getSoundType(priority: AlertPriority): string {
    switch (priority) {
      case AlertPriority.CRITICAL: return 'alarm-critical';
      case AlertPriority.HIGH: return 'alarm-high';
      case AlertPriority.MEDIUM: return 'beep-medium';
      case AlertPriority.LOW: return 'beep-low';
      default: return 'beep-default';
    }
  }

  private updateStatistics(newAlerts: ThermalAlert[]): void {
    this.statistics.totalAlerts += newAlerts.length;

    newAlerts.forEach(alert => {
      // Update by type
      const typeCount = this.statistics.alertsByType.get(alert.type) || 0;
      this.statistics.alertsByType.set(alert.type, typeCount + 1);

      // Update by priority
      const priorityCount = this.statistics.alertsByPriority.get(alert.priority) || 0;
      this.statistics.alertsByPriority.set(alert.priority, priorityCount + 1);
    });

    this.statistics.lastCalculated = new Date();
  }

  private clearRuleAlerts(ruleId: string): void {
    // Remove active alerts for this rule
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.ruleId === ruleId) {
        this.activeAlerts.delete(alertId);
      }
    }

    // Clear cooldown timers for this rule
    for (const [key, timer] of this.cooldownTimers) {
      if (key.startsWith(ruleId)) {
        clearTimeout(timer);
        this.cooldownTimers.delete(key);
      }
    }
  }

  acknowledgeAlert(alertId: string): boolean {
    const historyEntry = this.alertHistory.find(h => h.alert.id === alertId);
    if (!historyEntry) return false;

    historyEntry.acknowledged = true;
    historyEntry.acknowledgedAt = new Date();
    this.emit('alert-acknowledged', historyEntry.alert);
    logger.info(`Alert acknowledged: ${alertId}`);
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const historyEntry = this.alertHistory.find(h => h.alert.id === alertId);
    if (!historyEntry) return false;

    historyEntry.resolved = true;
    historyEntry.resolvedAt = new Date();
    this.activeAlerts.delete(alertId);
    this.emit('alert-resolved', historyEntry.alert);
    logger.info(`Alert resolved: ${alertId}`);
    return true;
  }

  getActiveAlerts(): ThermalAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit?: number): ThermalAlertHistory[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  getStatistics(): AlertStatistics {
    return { ...this.statistics };
  }

  getRules(): ThermalAlertRule[] {
    return Array.from(this.rules.values());
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      // Clear all active alerts and timers
      this.activeAlerts.clear();
      this.cooldownTimers.forEach(timer => clearTimeout(timer));
      this.cooldownTimers.clear();
    }
    this.emit('enabled-changed', enabled);
  }

  isAlertingEnabled(): boolean {
    return this.isEnabled;
  }

  destroy(): void {
    this.cooldownTimers.forEach(timer => clearTimeout(timer));
    this.cooldownTimers.clear();
    this.activeAlerts.clear();
    this.removeAllListeners();
  }
}