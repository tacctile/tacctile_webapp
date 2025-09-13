import { EventEmitter } from 'events';
import {
  ApplicationError,
  ErrorAnalytics as IErrorAnalytics,
  ErrorCategory,
  ErrorSeverity,
  ErrorCode,
  ErrorAggregator,
  ErrorLogger
} from './types';

export interface AnalyticsMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCode: Record<ErrorCode, number>;
  topErrors: Array<{
    code: ErrorCode;
    count: number;
    lastOccurrence: Date;
    severity: ErrorSeverity;
    category: ErrorCategory;
    avgTimeBetween: number;
  }>;
  errorTrends: Array<{
    date: Date;
    count: number;
    severity: ErrorSeverity;
    category: ErrorCategory;
  }>;
  meanTimeToResolution: number;
  recoveryRate: number;
  crashRate: number;
  userAffectedCount: number;
  componentReliability: Record<string, {
    errorCount: number;
    uptime: number;
    reliability: number; // percentage
  }>;
  performanceImpact: {
    memoryLeaks: number;
    cpuSpikes: number;
    slowOperations: number;
  };
  timeRangeAnalysis: {
    busyHours: Array<{ hour: number; errorCount: number }>;
    dailyPattern: Array<{ day: string; errorCount: number }>;
    weeklyTrend: Array<{ week: string; errorCount: number }>;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: AnalyticsMetrics) => boolean;
  severity: ErrorSeverity;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
  actions: Array<{
    type: 'email' | 'webhook' | 'log' | 'notification';
    config: Record<string, unknown>;
  }>;
}

export interface AnalyticsReport {
  id: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  metrics: AnalyticsMetrics;
  insights: string[];
  recommendations: string[];
  alertsTriggered: Array<{
    rule: AlertRule;
    triggeredAt: Date;
    metrics: AnalyticsMetrics;
  }>;
}

export class ErrorAnalytics extends EventEmitter implements ErrorAggregator {
  private logger?: ErrorLogger;
  private errorHistory: ApplicationError[] = [];
  private maxHistorySize = 10000;
  private alertRules: Map<string, AlertRule> = new Map();
  private metricsCache?: { metrics: AnalyticsMetrics; cachedAt: number };
  private cacheTimeout = 60000; // 1 minute
  private analysisInterval?: NodeJS.Timeout;
  private reportSchedule?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupDefaultAlertRules();
    this.startPeriodicAnalysis();
  }

  public setLogger(logger: ErrorLogger): void {
    this.logger = logger;
  }

  public async recordError(error: ApplicationError): Promise<void> {
    this.errorHistory.unshift(error);
    
    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.splice(this.maxHistorySize);
    }

    // Clear cache to force recalculation
    this.metricsCache = undefined;

    // Check for real-time alerts
    await this.checkAlertRules();

    this.emit('error-recorded', error);
  }

  public async getAnalytics(timeRange?: { start: Date; end: Date }): Promise<AnalyticsMetrics> {
    const now = Date.now();
    
    // Use cache if available and not expired
    if (this.metricsCache && (now - this.metricsCache.cachedAt) < this.cacheTimeout) {
      return this.metricsCache.metrics;
    }

    const metrics = await this.calculateMetrics(timeRange);
    
    this.metricsCache = {
      metrics,
      cachedAt: now
    };

    return metrics;
  }

  public aggregate(errors: ApplicationError[]): IErrorAnalytics {
    const metrics = this.aggregateErrors(errors);
    return metrics;
  }

  public groupBy(errors: ApplicationError[], field: keyof ApplicationError): Record<string, ApplicationError[]> {
    const groups: Record<string, ApplicationError[]> = {};

    for (const error of errors) {
      const key = String(error[field]);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(error);
    }

    return groups;
  }

  public trending(errors: ApplicationError[], timeWindow: number): Array<{
    period: Date;
    count: number;
    errors: ApplicationError[];
  }> {
    const now = Date.now();
    const periods: Array<{ period: Date; count: number; errors: ApplicationError[] }> = [];
    
    // Create time buckets
    const bucketCount = 24; // 24 periods
    const bucketSize = timeWindow / bucketCount;

    for (let i = 0; i < bucketCount; i++) {
      const periodStart = now - ((i + 1) * bucketSize);
      const periodEnd = now - (i * bucketSize);
      const periodDate = new Date(periodStart);
      
      const periodErrors = errors.filter(error => 
        error.timestamp >= periodStart && error.timestamp < periodEnd
      );

      periods.unshift({
        period: periodDate,
        count: periodErrors.length,
        errors: periodErrors
      });
    }

    return periods;
  }

  public async generateReport(
    period: { start: Date; end: Date }
  ): Promise<AnalyticsReport> {
    const metrics = await this.getAnalytics(period);
    const insights = this.generateInsights(metrics);
    const recommendations = this.generateRecommendations(metrics);

    return {
      id: `report_${Date.now()}`,
      generatedAt: new Date(),
      period,
      metrics,
      insights,
      recommendations,
      alertsTriggered: [] // Would be populated from alert history
    };
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.emit('alert-rule-added', rule);
  }

  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.emit('alert-rule-removed', ruleId);
  }

  public async triggerManualAnalysis(): Promise<AnalyticsMetrics> {
    this.metricsCache = undefined; // Clear cache
    const metrics = await this.getAnalytics();
    await this.checkAlertRules();
    this.emit('manual-analysis-completed', metrics);
    return metrics;
  }

  private async calculateMetrics(timeRange?: { start: Date; end: Date }): Promise<AnalyticsMetrics> {
    let errors = this.errorHistory;

    // Apply time range filter if specified
    if (timeRange) {
      errors = errors.filter(error => {
        const errorDate = new Date(error.timestamp);
        return errorDate >= timeRange.start && errorDate <= timeRange.end;
      });
    }

    // Load additional errors from logger if available
    if (this.logger && timeRange) {
      try {
        const loggedErrors = await this.logger.query({
          timeRange,
          limit: this.maxHistorySize
        });
        
        // Merge with in-memory errors, avoiding duplicates
        const errorIds = new Set(errors.map(e => e.id));
        const additionalErrors = loggedErrors.filter(e => !errorIds.has(e.id));
        errors = [...errors, ...additionalErrors];
      } catch (error) {
        console.warn('Failed to load errors from logger:', error);
      }
    }

    return this.aggregateErrors(errors);
  }

  private aggregateErrors(errors: ApplicationError[]): AnalyticsMetrics {
    const totalErrors = errors.length;
    
    // Count by category
    const errorsByCategory: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    for (const category of Object.values(ErrorCategory)) {
      errorsByCategory[category] = errors.filter(e => e.category === category).length;
    }

    // Count by severity
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    for (const severity of Object.values(ErrorSeverity)) {
      errorsBySeverity[severity] = errors.filter(e => e.severity === severity).length;
    }

    // Count by code
    const errorsByCode: Record<ErrorCode, number> = {} as Record<ErrorCode, number>;
    const codeMap = new Map<ErrorCode, { count: number; lastOccurrence: Date; errors: ApplicationError[] }>();
    
    for (const error of errors) {
      if (!codeMap.has(error.code)) {
        codeMap.set(error.code, { 
          count: 0, 
          lastOccurrence: new Date(0),
          errors: []
        });
      }
      
      const entry = codeMap.get(error.code);
      if (!entry) continue;
      entry.count++;
      entry.errors.push(error);
      
      const errorDate = new Date(error.timestamp);
      if (errorDate > entry.lastOccurrence) {
        entry.lastOccurrence = errorDate;
      }
    }

    for (const [code, data] of codeMap) {
      errorsByCode[code] = data.count;
    }

    // Top errors with additional metrics
    const topErrors = Array.from(codeMap.entries())
      .map(([code, data]) => {
        const timestamps = data.errors.map(e => e.timestamp).sort();
        let avgTimeBetween = 0;
        
        if (timestamps.length > 1) {
          const intervals = [];
          for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
          }
          avgTimeBetween = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        }

        return {
          code,
          count: data.count,
          lastOccurrence: data.lastOccurrence,
          severity: data.errors[0]?.severity || ErrorSeverity.LOW,
          category: data.errors[0]?.category || ErrorCategory.SYSTEM,
          avgTimeBetween
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Error trends (daily aggregation)
    const errorTrends = this.calculateErrorTrends(errors);

    // Component reliability
    const componentReliability = this.calculateComponentReliability(errors);

    // Performance impact analysis
    const performanceImpact = this.analyzePerformanceImpact(errors);

    // Time range analysis
    const timeRangeAnalysis = this.analyzeTimePatterns(errors);

    // Recovery and resolution metrics
    const recoveredCount = errors.filter(e => e.recoverable).length;
    const recoveryRate = totalErrors > 0 ? (recoveredCount / totalErrors) * 100 : 0;

    // Crash rate (critical errors)
    const crashCount = errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;
    const crashRate = totalErrors > 0 ? (crashCount / totalErrors) * 100 : 0;

    // Affected users
    const uniqueUsers = new Set(
      errors
        .map(e => e.context.userId)
        .filter(userId => userId)
    );
    const userAffectedCount = uniqueUsers.size;

    // Mean time to resolution (simplified)
    const meanTimeToResolution = this.calculateMTTR(errors);

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      errorsByCode,
      topErrors,
      errorTrends,
      meanTimeToResolution,
      recoveryRate,
      crashRate,
      userAffectedCount,
      componentReliability,
      performanceImpact,
      timeRangeAnalysis
    };
  }

  private calculateErrorTrends(errors: ApplicationError[]): Array<{
    date: Date;
    count: number;
    severity: ErrorSeverity;
    category: ErrorCategory;
  }> {
    const trends: Record<string, { date: Date; count: number; severity: ErrorSeverity; category: ErrorCategory }> = {};

    for (const error of errors) {
      const date = new Date(error.timestamp);
      date.setHours(0, 0, 0, 0); // Normalize to day
      const key = `${date.toISOString()}_${error.severity}_${error.category}`;

      if (!trends[key]) {
        trends[key] = {
          date: new Date(date),
          count: 0,
          severity: error.severity,
          category: error.category
        };
      }

      trends[key].count++;
    }

    return Object.values(trends).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateComponentReliability(errors: ApplicationError[]): Record<string, {
    errorCount: number;
    uptime: number;
    reliability: number;
  }> {
    const components: Record<string, { errorCount: number; uptime: number; reliability: number }> = {};
    
    const componentErrors = this.groupBy(errors, 'context');
    
    for (const [, contextErrors] of Object.entries(componentErrors)) {
      const component = contextErrors[0]?.context?.component;
      if (!component) continue;

      if (!components[component]) {
        components[component] = {
          errorCount: 0,
          uptime: 100, // Placeholder - would need actual uptime data
          reliability: 100
        };
      }

      components[component].errorCount += contextErrors.length;
      
      // Calculate reliability as inverse of error rate
      // This is simplified - real calculation would consider time periods
      const totalOperations = Math.max(1000, contextErrors.length * 10); // Estimated
      components[component].reliability = Math.max(0, 
        100 - ((contextErrors.length / totalOperations) * 100)
      );
    }

    return components;
  }

  private analyzePerformanceImpact(errors: ApplicationError[]): {
    memoryLeaks: number;
    cpuSpikes: number;
    slowOperations: number;
  } {
    let memoryLeaks = 0;
    let cpuSpikes = 0;
    let slowOperations = 0;

    for (const error of errors) {
      if (error.metadata.performanceMetrics) {
        const metrics = error.metadata.performanceMetrics;
        
        if (metrics.memoryUsage > 500) { // MB threshold
          memoryLeaks++;
        }
        
        if (metrics.cpuUsage > 80) { // % threshold
          cpuSpikes++;
        }
      }

      // Detect slow operations from error messages or technical details
      if (error.technicalDetails?.toLowerCase().includes('timeout') ||
          error.technicalDetails?.toLowerCase().includes('slow')) {
        slowOperations++;
      }
    }

    return { memoryLeaks, cpuSpikes, slowOperations };
  }

  private analyzeTimePatterns(errors: ApplicationError[]): {
    busyHours: Array<{ hour: number; errorCount: number }>;
    dailyPattern: Array<{ day: string; errorCount: number }>;
    weeklyTrend: Array<{ week: string; errorCount: number }>;
  } {
    // Busy hours analysis
    const hourCounts: number[] = new Array(24).fill(0);
    const dayCounts: Record<string, number> = {};
    const weekCounts: Record<string, number> = {};

    for (const error of errors) {
      const date = new Date(error.timestamp);
      
      // Hour analysis
      hourCounts[date.getHours()]++;
      
      // Daily analysis
      const dayKey = date.toLocaleDateString();
      dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
      
      // Weekly analysis
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toLocaleDateString();
      weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
    }

    return {
      busyHours: hourCounts.map((count, hour) => ({ hour, errorCount: count })),
      dailyPattern: Object.entries(dayCounts).map(([day, errorCount]) => ({ day, errorCount })),
      weeklyTrend: Object.entries(weekCounts).map(([week, errorCount]) => ({ week, errorCount }))
    };
  }

  private calculateMTTR(errors: ApplicationError[]): number {
    // Simplified MTTR calculation
    // In a real system, this would track resolution times
    const criticalErrors = errors.filter(e => e.severity === ErrorSeverity.CRITICAL);
    return criticalErrors.length > 0 ? 3600000 : 0; // 1 hour placeholder
  }

  private generateInsights(metrics: AnalyticsMetrics): string[] {
    const insights: string[] = [];

    if (metrics.totalErrors > 1000) {
      insights.push('High error volume detected. Consider reviewing system stability.');
    }

    if (metrics.crashRate > 10) {
      insights.push(`Critical error rate is ${metrics.crashRate.toFixed(1)}%. Immediate attention required.`);
    }

    if (metrics.recoveryRate < 50) {
      insights.push(`Low recovery rate (${metrics.recoveryRate.toFixed(1)}%). Review recovery mechanisms.`);
    }

    const topError = metrics.topErrors[0];
    if (topError && topError.count > metrics.totalErrors * 0.3) {
      insights.push(`Error ${topError.code} accounts for ${((topError.count / metrics.totalErrors) * 100).toFixed(1)}% of all errors.`);
    }

    return insights;
  }

  private generateRecommendations(metrics: AnalyticsMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.performanceImpact.memoryLeaks > 0) {
      recommendations.push('Investigate memory leaks in components with high error rates.');
    }

    if (metrics.performanceImpact.cpuSpikes > 0) {
      recommendations.push('Optimize CPU-intensive operations that correlate with errors.');
    }

    const highestErrorCategory = Object.entries(metrics.errorsByCategory)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (highestErrorCategory && highestErrorCategory[1] > metrics.totalErrors * 0.4) {
      recommendations.push(`Focus on ${highestErrorCategory[0]} category - it represents the majority of errors.`);
    }

    return recommendations;
  }

  private setupDefaultAlertRules(): void {
    // High error rate alert
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Triggers when error rate exceeds threshold',
      condition: (metrics) => metrics.totalErrors > 100, // per analysis period
      severity: ErrorSeverity.HIGH,
      enabled: true,
      cooldownMs: 300000, // 5 minutes
      actions: [
        { type: 'log', config: { level: 'error' } },
        { type: 'notification', config: { message: 'High error rate detected' } }
      ]
    });

    // Critical error alert
    this.addAlertRule({
      id: 'critical-errors',
      name: 'Critical Errors Detected',
      description: 'Triggers when critical errors occur',
      condition: (metrics) => metrics.errorsBySeverity[ErrorSeverity.CRITICAL] > 0,
      severity: ErrorSeverity.CRITICAL,
      enabled: true,
      cooldownMs: 60000, // 1 minute
      actions: [
        { type: 'log', config: { level: 'critical' } },
        { type: 'notification', config: { message: 'Critical errors detected' } }
      ]
    });
  }

  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(async () => {
      try {
        await this.checkAlertRules();
      } catch (error) {
        console.error('Periodic analysis failed:', error);
      }
    }, 60000); // Every minute
  }

  private async checkAlertRules(): Promise<void> {
    const metrics = await this.getAnalytics();
    const now = Date.now();

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldownMs) {
        continue;
      }

      try {
        if (rule.condition(metrics)) {
          rule.lastTriggered = now;
          this.emit('alert-triggered', rule, metrics);
          
          // Execute actions
          for (const action of rule.actions) {
            await this.executeAlertAction(action, rule, metrics);
          }
        }
      } catch (error) {
        console.error(`Alert rule ${ruleId} evaluation failed:`, error);
      }
    }
  }

  private async executeAlertAction(
    action: AlertRule['actions'][0], 
    rule: AlertRule, 
    metrics: AnalyticsMetrics
  ): Promise<void> {
    switch (action.type) {
      case 'log':
        console.log(`Alert: ${rule.name} - ${rule.description}`);
        break;
      case 'notification':
        this.emit('alert-notification', {
          rule,
          metrics,
          message: action.config.message
        });
        break;
      case 'webhook':
        // Would implement webhook call
        break;
      case 'email':
        // Would implement email sending
        break;
    }
  }

  public dispose(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    if (this.reportSchedule) {
      clearInterval(this.reportSchedule);
      this.reportSchedule = undefined;
    }

    this.removeAllListeners();
    this.errorHistory.length = 0;
    this.alertRules.clear();
    this.metricsCache = undefined;
  }
}