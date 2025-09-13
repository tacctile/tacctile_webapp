/**
 * Device Management Manager
 * 
 * Handles device fingerprinting, hardware binding, device registration,
 * limit enforcement, deauthorization capabilities, and secure device
 * transfer for legitimate users with comprehensive compliance monitoring.
 */

import { EventEmitter } from 'events';
import {
  IDeviceManagementManager,
  DeviceRegistry,
  RegisteredDevice,
  DeviceStatus,
  DeviceTransferResult,
  DeviceTrustScore,
  PolicyEnforcementResult,
  ComplianceReport,
  DeviceInfo,
  DeviceType,
  Platform,
  ConnectionType,
  RegistrationMethod,
  DeviceUsage,
  DeviceSession,
  SessionEndReason,
  DeviceCompliance,
  ComplianceStatus,
  ComplianceCheck,
  ComplianceCheckType,
  ComplianceCheckStatus,
  ComplianceViolation,
  ViolationSeverity,
  DeviceSecurityInfo,
  SecuritySoftwareType,
  ThreatType,
  ThreatSeverity,
  ThreatStatus,
  DevicePolicy,
  PolicyScope,
  PolicyCondition,
  PolicyAction,
  PolicyActionType,
  TrustScoreFactor,
  TrustScoreHistory,
  TrustFactorType,
  TransferRestriction,
  RestrictionType,
  PolicyViolation,
  ComplianceSummary,
  DeviceComplianceReport,
  ComplianceTrend,
  ComplianceRecommendation,
  ActionPriority,
  ImplementationEffort,
  ReportPeriod,
  HardwareFingerprint,
  LicenseProtectionEvent,
  ProtectionEventType,
  EventSeverity,
  RuleOperator
} from './types';

export class DeviceManagementManager extends EventEmitter implements IDeviceManagementManager {
  private registry: DeviceRegistry;
  private devices: Map<string, RegisteredDevice> = new Map();
  private policies: Map<string, DevicePolicy> = new Map();
  private trustScores: Map<string, DeviceTrustScore> = new Map();
  private activeSessions: Map<string, DeviceSession[]> = new Map();
  private complianceCache: Map<string, DeviceCompliance> = new Map();
  private initialized = false;

  constructor(accountId: string) {
    super();
    this.registry = this.createDefaultRegistry(accountId);
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('DeviceManagementManager already initialized');
      return;
    }

    try {
      console.log('Initializing Device Management Manager...');

      // Load existing devices and policies
      await this.loadDeviceRegistry();
      await this.loadDevicePolicies();
      await this.loadTrustScores();
      
      // Initialize compliance monitoring
      await this.initializeComplianceMonitoring();
      
      // Start device monitoring services
      await this.startDeviceMonitoring();
      await this.startSessionMonitoring();

      this.initialized = true;
      this.emit('manager-initialized');
      console.log('Device Management Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Device Management Manager:', error);
      throw error;
    }
  }

  async registerDevice(device: Partial<RegisteredDevice>): Promise<RegisteredDevice> {
    this.ensureInitialized();

    const deviceId = device.id || this.generateDeviceId();
    const now = new Date();

    // Check device limits
    await this.checkDeviceLimits(device.userId || '');

    // Generate hardware fingerprint if not provided
    const hardwareFingerprint = device.hardwareFingerprint || await this.generateHardwareFingerprint(device);

    // Validate device information
    await this.validateDeviceInfo(device);

    const newDevice: RegisteredDevice = {
      id: deviceId,
      userId: device.userId || '',
      deviceId: device.deviceId || deviceId,
      hardwareFingerprint: hardwareFingerprint,
      deviceInfo: device.deviceInfo || this.createDefaultDeviceInfo(),
      registrationInfo: device.registrationInfo || {
        method: RegistrationMethod.AUTOMATIC,
        registeredBy: device.userId || 'system',
        registeredAt: now
      },
      status: this.registry.settings.requireApproval ? DeviceStatus.PENDING_APPROVAL : DeviceStatus.ACTIVE,
      trustScore: 50, // Initial neutral score
      riskScore: 0,
      usage: this.createDefaultUsage(),
      compliance: await this.performInitialComplianceCheck(deviceId),
      security: await this.performSecurityScan(deviceId),
      lastSeen: now,
      createdAt: now
    };

    // Store device
    this.devices.set(deviceId, newDevice);
    this.registry.devices.push(newDevice);

    // Calculate initial trust score
    const trustScore = await this.calculateTrustScore(deviceId);
    this.trustScores.set(deviceId, trustScore);
    newDevice.trustScore = trustScore.score;

    // Apply device policies
    await this.applyDevicePolicies(deviceId);

    // Log registration
    await this.logEvent({
      type: ProtectionEventType.DEVICE_REGISTRATION,
      severity: EventSeverity.INFO,
      message: `Device registered: ${deviceId}`,
      details: {
        deviceId,
        userId: newDevice.userId,
        status: newDevice.status,
        trustScore: newDevice.trustScore
      }
    });

    this.emit('device-registered', { device: newDevice });
    return newDevice;
  }

  async deauthorizeDevice(deviceId: string, reason?: string): Promise<boolean> {
    this.ensureInitialized();

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    // Terminate active sessions
    await this.terminateDeviceSessions(deviceId, SessionEndReason.DEVICE_DEAUTHORIZED);

    // Update device status
    device.status = DeviceStatus.DEAUTHORIZED;
    device.lastSeen = new Date();

    // Clear trust scores
    this.trustScores.delete(deviceId);
    device.trustScore = 0;

    // Log deauthorization
    await this.logEvent({
      type: ProtectionEventType.DEVICE_DEAUTHORIZATION,
      severity: EventSeverity.WARNING,
      message: `Device deauthorized: ${deviceId}`,
      details: {
        deviceId,
        userId: device.userId,
        reason: reason || 'Manual deauthorization',
        sessionsTerminated: this.activeSessions.get(deviceId)?.length || 0
      }
    });

    this.emit('device-deauthorized', { device, reason });
    return true;
  }

  async updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<boolean> {
    this.ensureInitialized();

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const previousStatus = device.status;
    device.status = status;
    device.lastSeen = new Date();

    // Handle status-specific actions
    switch (status) {
      case DeviceStatus.ACTIVE:
        // Reactivate device
        await this.reactivateDevice(deviceId);
        break;
        
      case DeviceStatus.SUSPENDED:
        // Suspend active sessions
        await this.suspendDeviceSessions(deviceId);
        break;
        
      case DeviceStatus.BLOCKED:
        // Block device and terminate sessions
        await this.terminateDeviceSessions(deviceId, SessionEndReason.SECURITY_VIOLATION);
        break;
        
      case DeviceStatus.COMPROMISED:
        // Mark as compromised and implement security measures
        await this.handleCompromisedDevice(deviceId);
        break;
    }

    // Log status change
    await this.logEvent({
      type: ProtectionEventType.DEVICE_REGISTRATION,
      severity: this.getStatusChangeSeverity(previousStatus, status),
      message: `Device status changed: ${deviceId}`,
      details: {
        deviceId,
        userId: device.userId,
        previousStatus,
        newStatus: status
      }
    });

    this.emit('device-status-updated', { device, previousStatus, newStatus: status });
    return true;
  }

  async getDevice(deviceId: string): Promise<RegisteredDevice | null> {
    this.ensureInitialized();
    return this.devices.get(deviceId) || null;
  }

  async getDevicesByUser(userId: string): Promise<RegisteredDevice[]> {
    this.ensureInitialized();
    return Array.from(this.devices.values()).filter(device => device.userId === userId);
  }

  async transferDevice(deviceId: string, fromUserId: string, toUserId: string): Promise<DeviceTransferResult> {
    this.ensureInitialized();

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    if (device.userId !== fromUserId) {
      throw new Error(`Device ${deviceId} does not belong to user ${fromUserId}`);
    }

    // Check transfer eligibility
    const restrictions = await this.checkTransferRestrictions(deviceId, fromUserId, toUserId);
    
    if (restrictions.length > 0 && restrictions.some(r => r.type === RestrictionType.TEMPORARY_BLOCK)) {
      throw new Error('Device transfer is currently blocked');
    }

    // Perform transfer
    const transferId = this.generateTransferId();
    const transferredAt = new Date();

    // Terminate current sessions
    await this.terminateDeviceSessions(deviceId, SessionEndReason.DEVICE_DEAUTHORIZED);

    // Update device ownership
    device.userId = toUserId;
    device.registrationInfo.registeredBy = toUserId;
    device.registrationInfo.registeredAt = transferredAt;
    device.lastSeen = transferredAt;

    // Reset trust score for new user
    device.trustScore = 50;
    await this.calculateTrustScore(deviceId);

    // Apply cooldown period
    const cooldownRestriction: TransferRestriction = {
      type: RestrictionType.COOLDOWN,
      reason: 'Standard transfer cooldown period',
      expiresAt: new Date(transferredAt.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      conditions: ['no_additional_transfers']
    };

    const result: DeviceTransferResult = {
      success: true,
      transferId,
      fromUserId,
      toUserId,
      deviceId,
      transferredAt,
      restrictions: [cooldownRestriction, ...restrictions]
    };

    // Log transfer
    await this.logEvent({
      type: ProtectionEventType.DEVICE_REGISTRATION,
      severity: EventSeverity.INFO,
      message: `Device transferred: ${deviceId}`,
      details: {
        deviceId,
        transferId,
        fromUserId,
        toUserId,
        restrictionCount: result.restrictions?.length || 0
      }
    });

    this.emit('device-transferred', { result });
    return result;
  }

  async calculateTrustScore(deviceId: string): Promise<DeviceTrustScore> {
    this.ensureInitialized();

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const factors: TrustScoreFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Age factor
    const ageInDays = (Date.now() - device.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const ageFactor = Math.min(ageInDays / 30, 1) * 100; // Max score after 30 days
    const ageWeight = 20;
    factors.push({
      factor: TrustFactorType.AGE,
      score: ageFactor,
      weight: ageWeight,
      lastUpdated: new Date(),
      details: { ageInDays }
    });
    totalScore += ageFactor * ageWeight;
    totalWeight += ageWeight;

    // Usage history factor
    const usageScore = this.calculateUsageScore(device.usage);
    const usageWeight = 25;
    factors.push({
      factor: TrustFactorType.USAGE_HISTORY,
      score: usageScore,
      weight: usageWeight,
      lastUpdated: new Date(),
      details: { 
        totalSessions: device.usage.totalSessions,
        totalHours: device.usage.totalHours
      }
    });
    totalScore += usageScore * usageWeight;
    totalWeight += usageWeight;

    // Security factor
    const securityScore = this.calculateSecurityScore(device.security);
    const securityWeight = 30;
    factors.push({
      factor: TrustFactorType.HARDWARE_REPUTATION,
      score: securityScore,
      weight: securityWeight,
      lastUpdated: new Date(),
      details: {
        threats: device.security.threats.length,
        securitySoftware: device.security.securitySoftware.length
      }
    });
    totalScore += securityScore * securityWeight;
    totalWeight += securityWeight;

    // Compliance factor
    const complianceScore = this.calculateComplianceScore(device.compliance);
    const complianceWeight = 15;
    factors.push({
      factor: TrustFactorType.BEHAVIOR_CONSISTENCY,
      score: complianceScore,
      weight: complianceWeight,
      lastUpdated: new Date(),
      details: { status: device.compliance.status }
    });
    totalScore += complianceScore * complianceWeight;
    totalWeight += complianceWeight;

    // Location consistency factor
    const locationScore = await this.calculateLocationConsistencyScore(deviceId);
    const locationWeight = 10;
    factors.push({
      factor: TrustFactorType.LOCATION_CONSISTENCY,
      score: locationScore,
      weight: locationWeight,
      lastUpdated: new Date(),
      details: { consistent: locationScore > 50 }
    });
    totalScore += locationScore * locationWeight;
    totalWeight += locationWeight;

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    // Get existing history or create new
    const existingTrustScore = this.trustScores.get(deviceId);
    const history: TrustScoreHistory[] = existingTrustScore?.history || [];
    
    // Add history entry if score changed
    if (!existingTrustScore || existingTrustScore.score !== finalScore) {
      const change = existingTrustScore ? finalScore - existingTrustScore.score : 0;
      history.push({
        timestamp: new Date(),
        score: finalScore,
        change,
        reason: 'Trust score recalculation',
        triggeredBy: 'system'
      });
    }

    const trustScore: DeviceTrustScore = {
      deviceId,
      score: finalScore,
      factors,
      history,
      lastUpdated: new Date()
    };

    this.trustScores.set(deviceId, trustScore);
    
    // Update device trust score
    device.trustScore = finalScore;

    return trustScore;
  }

  async enforcePolicy(policyId: string, deviceId?: string): Promise<PolicyEnforcementResult> {
    this.ensureInitialized();

    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const targetDevices = deviceId ? 
      [this.devices.get(deviceId)].filter(Boolean) as RegisteredDevice[] :
      this.getDevicesInPolicyScope(policy.scope);

    const actions: PolicyAction[] = [];
    const violations: PolicyViolation[] = [];
    let affectedDevices = 0;

    for (const device of targetDevices) {
      const deviceViolations = await this.evaluateDeviceAgainstPolicy(device, policy);
      
      if (deviceViolations.length > 0) {
        violations.push(...deviceViolations);
        
        // Execute policy actions
        for (const rule of policy.rules) {
          if (rule.enabled && await this.evaluateRuleCondition(device, rule.condition)) {
            await this.executeRuleAction(device, rule.action);
            actions.push(rule.action);
            affectedDevices++;
          }
        }
      }
    }

    const result: PolicyEnforcementResult = {
      success: true,
      policyId,
      deviceId,
      affectedDevices,
      actions,
      violations,
      enforcedAt: new Date()
    };

    // Log enforcement
    await this.logEvent({
      type: ProtectionEventType.POLICY_CHANGE,
      severity: violations.length > 0 ? EventSeverity.WARNING : EventSeverity.INFO,
      message: `Policy enforced: ${policy.name}`,
      details: {
        policyId,
        affectedDevices,
        violationCount: violations.length,
        actionCount: actions.length
      }
    });

    this.emit('policy-enforced', { result, policy });
    return result;
  }

  async generateComplianceReport(accountId: string): Promise<ComplianceReport> {
    this.ensureInitialized();

    const devices = Array.from(this.devices.values());
    const period: ReportPeriod = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
      type: 'monthly'
    };

    // Calculate summary
    const totalDevices = devices.length;
    const compliantDevices = devices.filter(d => d.compliance.status === ComplianceStatus.COMPLIANT).length;
    const nonCompliantDevices = totalDevices - compliantDevices;
    const complianceRate = totalDevices > 0 ? (compliantDevices / totalDevices) * 100 : 0;

    const allViolations = devices.reduce((acc, d) => acc.concat(d.compliance.violations), [] as ComplianceViolation[]);
    const criticalViolations = allViolations.filter(v => v.severity === ViolationSeverity.CRITICAL).length;
    const resolvedViolations = allViolations.filter(v => v.resolvedAt).length;

    const summary: ComplianceSummary = {
      totalDevices,
      compliantDevices,
      nonCompliantDevices,
      complianceRate,
      criticalViolations,
      resolvedViolations,
      pendingActions: allViolations.length - resolvedViolations
    };

    // Generate device compliance reports
    const deviceCompliance: DeviceComplianceReport[] = devices.map(device => ({
      deviceId: device.id,
      userId: device.userId,
      status: device.compliance.status,
      score: this.calculateComplianceScore(device.compliance),
      checks: device.compliance.checks.map(check => ({
        checkId: check.id,
        name: check.name,
        status: check.status,
        score: this.getCheckScore(check.status),
        details: check.result?.toString() || '',
        evaluatedAt: check.lastChecked
      })),
      violations: device.compliance.violations,
      lastEvaluated: device.compliance.lastEvaluation
    }));

    // Calculate trends
    const trends: ComplianceTrend[] = [{
      period: period.start,
      complianceRate,
      violationCount: allViolations.length,
      improvement: 0, // Would calculate from historical data
      topViolationTypes: this.getTopViolationTypes(allViolations)
    }];

    // Generate recommendations
    const recommendations: ComplianceRecommendation[] = [
      {
        priority: ActionPriority.HIGH,
        category: 'Security',
        description: 'Enable automatic security updates on all devices',
        impact: 'Reduces security vulnerabilities by 60%',
        effort: ImplementationEffort.MEDIUM,
        timeline: '2-4 weeks',
        resources: ['Security team', 'Device management tools']
      },
      {
        priority: ActionPriority.MEDIUM,
        category: 'Compliance',
        description: 'Implement automated compliance monitoring',
        impact: 'Improves compliance rate by 25%',
        effort: ImplementationEffort.HIGH,
        timeline: '6-8 weeks',
        resources: ['Compliance team', 'Monitoring tools', 'Training']
      }
    ];

    const report: ComplianceReport = {
      accountId,
      generatedAt: new Date(),
      period,
      summary,
      deviceCompliance,
      violations: allViolations,
      trends,
      recommendations
    };

    this.emit('compliance-report-generated', { report });
    return report;
  }

  // Private helper methods
  private createDefaultRegistry(accountId: string): DeviceRegistry {
    return {
      id: `registry_${accountId}`,
      accountId,
      devices: [],
      settings: {
        autoRegistration: true,
        requireApproval: false,
        maxDevicesPerUser: 5,
        deviceRetentionDays: 90,
        trustScoreThreshold: 40,
        riskScoreThreshold: 70,
        complianceRequired: true,
        securityScanRequired: true
      },
      policies: [],
      trustScores: [],
      lastUpdated: new Date()
    };
  }

  private createDefaultDeviceInfo(): DeviceInfo {
    return {
      name: 'Unknown Device',
      type: DeviceType.UNKNOWN,
      os: {
        platform: Platform.UNKNOWN,
        name: 'Unknown OS',
        version: '0.0.0',
        architecture: 'unknown'
      },
      hardware: {
        isVirtual: false
      },
      network: {
        ipAddress: '0.0.0.0',
        connectionType: ConnectionType.UNKNOWN,
        isVPN: false,
        isProxy: false
      },
      location: {
        lastUpdated: new Date()
      }
    };
  }

  private createDefaultUsage(): DeviceUsage {
    return {
      totalSessions: 0,
      totalHours: 0,
      lastSession: {
        id: '',
        userId: '',
        startTime: new Date(),
        features: [],
        location: { lastUpdated: new Date() },
        ipAddress: '0.0.0.0',
        activities: [],
        ended: false
      },
      recentSessions: [],
      features: [],
      patterns: []
    };
  }

  private async generateHardwareFingerprint(_device: Partial<RegisteredDevice>): Promise<HardwareFingerprint> {
    // In production, would generate actual hardware fingerprint
    const fingerprintId = this.generateFingerprintId();
    
    return {
      id: fingerprintId,
      machineId: fingerprintId,
      cpuInfo: {
        manufacturer: 'Unknown',
        brand: 'Unknown CPU',
        family: '0',
        model: '0',
        stepping: '0',
        speed: 0,
        cores: 1,
        cache: {},
        flags: []
      },
      systemInfo: {
        platform: 'unknown',
        distro: 'unknown',
        release: '0.0.0',
        kernel: '0.0.0',
        arch: 'unknown',
        hostname: 'unknown'
      },
      networkInfo: {
        interfaces: [],
        defaultInterface: 'eth0'
      },
      storageInfo: {
        drives: [],
        totalSize: 0,
        usedSize: 0,
        freeSize: 0
      },
      displayInfo: {
        displays: [],
        resolution: '1920x1080',
        pixelDepth: 24,
        resolutionX: 1920,
        resolutionY: 1080
      },
      biosInfo: {
        vendor: 'Unknown'
      },
      fingerprint: fingerprintId,
      confidence: 0.8,
      generatedAt: new Date(),
      lastSeen: new Date()
    };
  }

  private async validateDeviceInfo(device: Partial<RegisteredDevice>): Promise<void> {
    if (!device.userId) {
      throw new Error('User ID is required for device registration');
    }
  }

  private async checkDeviceLimits(userId: string): Promise<void> {
    const userDevices = await this.getDevicesByUser(userId);
    const activeDevices = userDevices.filter(d => 
      d.status === DeviceStatus.ACTIVE || d.status === DeviceStatus.PENDING_APPROVAL
    );

    if (activeDevices.length >= this.registry.settings.maxDevicesPerUser) {
      throw new Error(`Maximum device limit reached for user: ${userId}`);
    }
  }

  private async performInitialComplianceCheck(_deviceId: string): Promise<DeviceCompliance> {
    const checks: ComplianceCheck[] = [
      {
        id: 'os_version',
        name: 'Operating System Version',
        description: 'Check if OS version is supported',
        type: ComplianceCheckType.OS_VERSION,
        status: ComplianceCheckStatus.PASS,
        result: 'Supported',
        lastChecked: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mandatory: true
      },
      {
        id: 'security_software',
        name: 'Security Software',
        description: 'Check for antivirus and firewall',
        type: ComplianceCheckType.ANTIVIRUS,
        status: ComplianceCheckStatus.WARNING,
        result: 'Partially compliant',
        lastChecked: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mandatory: false
      }
    ];

    return {
      status: ComplianceStatus.PARTIALLY_COMPLIANT,
      checks,
      violations: [],
      lastEvaluation: new Date(),
      nextEvaluation: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  private async performSecurityScan(deviceId: string): Promise<DeviceSecurityInfo> {
    return {
      isJailbroken: false,
      isRooted: false,
      hasDebugger: false,
      hasEmulator: false,
      hasVirtualMachine: false,
      hasKeylogger: false,
      hasRemoteAccess: false,
      securitySoftware: [{
        name: 'System Defender',
        type: SecuritySoftwareType.ANTIVIRUS,
        version: '1.0.0',
        enabled: true,
        upToDate: true,
        lastUpdated: new Date()
      }],
      threats: [],
      lastSecurityScan: new Date()
    };
  }

  private async applyDevicePolicies(_deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    for (const policy of this.registry.policies) {
      if (policy.enabled && this.deviceMatchesPolicyScope(device, policy.scope)) {
        await this.enforcePolicy(policy.id, deviceId);
      }
    }
  }

  private deviceMatchesPolicyScope(device: RegisteredDevice, scope: PolicyScope): boolean {
    // Check if device matches policy scope
    if (scope.users.length > 0 && !scope.users.includes(device.userId)) return false;
    if (scope.deviceTypes.length > 0 && !scope.deviceTypes.includes(device.deviceInfo.type)) return false;
    if (scope.platforms.length > 0 && !scope.platforms.includes(device.deviceInfo.os.platform)) return false;
    
    return true;
  }

  private async terminateDeviceSessions(deviceId: string, reason: SessionEndReason): Promise<void> {
    const sessions = this.activeSessions.get(deviceId) || [];
    
    for (const session of sessions) {
      if (!session.ended) {
        session.ended = true;
        session.endTime = new Date();
        session.endReason = reason;
        session.duration = session.endTime.getTime() - session.startTime.getTime();
      }
    }

    this.activeSessions.set(deviceId, []);
  }

  private async suspendDeviceSessions(deviceId: string): Promise<void> {
    // In production, would suspend active sessions without terminating
    console.log(`Suspending sessions for device: ${deviceId}`);
  }

  private async reactivateDevice(deviceId: string): Promise<void> {
    // In production, would reactivate device and restore sessions
    console.log(`Reactivating device: ${deviceId}`);
  }

  private async handleCompromisedDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Terminate all sessions
    await this.terminateDeviceSessions(deviceId, SessionEndReason.SECURITY_VIOLATION);
    
    // Reset trust score
    device.trustScore = 0;
    this.trustScores.delete(deviceId);
    
    // Add security threat
    device.security.threats.push({
      id: `threat_${Date.now()}`,
      type: ThreatType.SUSPICIOUS_BEHAVIOR,
      severity: ThreatSeverity.CRITICAL,
      description: 'Device marked as compromised',
      detectedAt: new Date(),
      status: ThreatStatus.ACTIVE,
      source: 'system',
      details: { reason: 'Manual compromise detection' }
    });

    // Notify security team
    await this.notifySecurityTeam(deviceId, 'Device compromised');
  }

  private getStatusChangeSeverity(previous: DeviceStatus, current: DeviceStatus): EventSeverity {
    if (current === DeviceStatus.COMPROMISED || current === DeviceStatus.BLOCKED) {
      return EventSeverity.CRITICAL;
    }
    if (current === DeviceStatus.SUSPENDED) {
      return EventSeverity.WARNING;
    }
    return EventSeverity.INFO;
  }

  private async checkTransferRestrictions(deviceId: string, _fromUserId: string, _toUserId: string): Promise<TransferRestriction[]> {
    const restrictions: TransferRestriction[] = [];

    // Check transfer cooldown
    const lastTransfer = await this.getLastTransferTime(deviceId);
    if (lastTransfer && Date.now() - lastTransfer.getTime() < 24 * 60 * 60 * 1000) {
      restrictions.push({
        type: RestrictionType.COOLDOWN,
        reason: 'Transfer cooldown period active',
        expiresAt: new Date(lastTransfer.getTime() + 24 * 60 * 60 * 1000),
        conditions: ['wait_for_cooldown']
      });
    }

    // Check if approval required
    if (this.registry.settings.requireApproval) {
      restrictions.push({
        type: RestrictionType.APPROVAL_REQUIRED,
        reason: 'Admin approval required for device transfer',
        conditions: ['admin_approval']
      });
    }

    return restrictions;
  }

  private calculateUsageScore(usage: DeviceUsage): number {
    // Simple usage scoring algorithm
    const sessionScore = Math.min(usage.totalSessions * 2, 50);
    const hoursScore = Math.min(usage.totalHours, 50);
    return sessionScore + hoursScore;
  }

  private calculateSecurityScore(security: DeviceSecurityInfo): number {
    let score = 100;

    // Deduct for security issues
    if (security.isJailbroken) score -= 30;
    if (security.isRooted) score -= 30;
    if (security.hasDebugger) score -= 20;
    if (security.hasEmulator) score -= 25;
    if (security.hasVirtualMachine) score -= 15;
    if (security.hasKeylogger) score -= 40;
    if (security.hasRemoteAccess) score -= 35;

    // Deduct for active threats
    score -= security.threats.filter(t => t.status === ThreatStatus.ACTIVE).length * 10;

    // Add for security software
    score += security.securitySoftware.filter(s => s.enabled && s.upToDate).length * 5;

    return Math.max(score, 0);
  }

  private calculateComplianceScore(compliance: DeviceCompliance): number {
    if (compliance.checks.length === 0) return 0;

    const passedChecks = compliance.checks.filter(c => c.status === ComplianceCheckStatus.PASS).length;
    return (passedChecks / compliance.checks.length) * 100;
  }

  private async calculateLocationConsistencyScore(_deviceId: string): Promise<number> {
    // In production, would analyze location history for consistency
    return Math.random() * 100; // Simplified
  }

  private getDevicesInPolicyScope(scope: PolicyScope): RegisteredDevice[] {
    return Array.from(this.devices.values()).filter(device => 
      this.deviceMatchesPolicyScope(device, scope)
    );
  }

  private async evaluateDeviceAgainstPolicy(device: RegisteredDevice, policy: DevicePolicy): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    for (const rule of policy.rules) {
      if (rule.enabled && !(await this.evaluateRuleCondition(device, rule.condition))) {
        violations.push({
          deviceId: device.id,
          ruleId: rule.id,
          severity: ViolationSeverity.MEDIUM,
          description: `Policy violation: ${rule.name}`,
          action: rule.action.type,
          resolved: false
        });
      }
    }

    return violations;
  }

  private async evaluateRuleCondition(device: RegisteredDevice, condition: PolicyCondition): Promise<boolean> {
    // Simplified rule evaluation
    switch (condition.field) {
      case 'trustScore':
        return this.evaluateComparison(device.trustScore, condition.operator, condition.value);
      case 'complianceStatus':
        return device.compliance.status === condition.value;
      case 'deviceType':
        return device.deviceInfo.type === condition.value;
      default:
        return true;
    }
  }

  private evaluateComparison(actual: unknown, operator: RuleOperator, expected: unknown): boolean {
    switch (operator) {
      case RuleOperator.EQUALS:
        return actual === expected;
      case RuleOperator.NOT_EQUALS:
        return actual !== expected;
      case RuleOperator.GREATER_THAN:
        return actual > expected;
      case RuleOperator.LESS_THAN:
        return actual < expected;
      default:
        return false;
    }
  }

  private async executeRuleAction(device: RegisteredDevice, action: PolicyAction): Promise<void> {
    switch (action.type) {
      case PolicyActionType.QUARANTINE:
        await this.updateDeviceStatus(device.id, DeviceStatus.SUSPENDED);
        break;
      case PolicyActionType.REQUIRE_AUTH:
        // Would require additional authentication
        console.log(`Requiring additional auth for device: ${device.id}`);
        break;
      case PolicyActionType.LIMIT_FEATURES:
        // Would limit available features
        console.log(`Limiting features for device: ${device.id}`);
        break;
      case PolicyActionType.LOG_ONLY:
        // Just log the action
        await this.logEvent({
          type: ProtectionEventType.POLICY_CHANGE,
          severity: EventSeverity.INFO,
          message: `Policy action logged for device: ${device.id}`,
          details: { action: action.type, deviceId: device.id }
        });
        break;
    }
  }

  private getCheckScore(status: ComplianceCheckStatus): number {
    switch (status) {
      case ComplianceCheckStatus.PASS: return 100;
      case ComplianceCheckStatus.WARNING: return 70;
      case ComplianceCheckStatus.FAIL: return 0;
      case ComplianceCheckStatus.ERROR: return 0;
      default: return 50;
    }
  }

  private getTopViolationTypes(violations: ComplianceViolation[]): string[] {
    const counts = violations.reduce((acc, v) => {
      const type = v.checkId;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);
  }

  private async getLastTransferTime(deviceId: string): Promise<Date | null> {
    // In production, would query transfer history
    return null;
  }

  private async notifySecurityTeam(_deviceId: string, message: string): Promise<void> {
    console.log(`Security notification for device ${deviceId}: ${message}`);
  }

  // Initialization helper methods
  private async loadDeviceRegistry(): Promise<void> {
    console.log('Loading device registry...');
    // In production, would load from database
  }

  private async loadDevicePolicies(): Promise<void> {
    console.log('Loading device policies...');
    // In production, would load policies from database
  }

  private async loadTrustScores(): Promise<void> {
    console.log('Loading trust scores...');
    // In production, would load trust scores from database
  }

  private async initializeComplianceMonitoring(): Promise<void> {
    console.log('Initializing compliance monitoring...');
    // In production, would start compliance monitoring services
  }

  private async startDeviceMonitoring(): Promise<void> {
    console.log('Starting device monitoring...');
    // In production, would start device monitoring services
  }

  private async startSessionMonitoring(): Promise<void> {
    console.log('Starting session monitoring...');
    // In production, would start session monitoring services
  }

  private setupEventHandlers(): void {
    this.on('device-registered', this.handleDeviceRegistered.bind(this));
    this.on('device-deauthorized', this.handleDeviceDeauthorized.bind(this));
    this.on('device-transferred', this.handleDeviceTransferred.bind(this));
  }

  private handleDeviceRegistered(data: { device: RegisteredDevice }): void {
    console.log(`Device registered event handled: ${data.device.id}`);
  }

  private handleDeviceDeauthorized(data: { device: RegisteredDevice; reason?: string }): void {
    console.log(`Device deauthorized event handled: ${data.device.id}`);
  }

  private handleDeviceTransferred(data: { result: DeviceTransferResult }): void {
    console.log(`Device transferred event handled: ${data.result.deviceId}`);
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateFingerprintId(): string {
    return `fp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTransferId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async logEvent(event: Partial<LicenseProtectionEvent>): Promise<void> {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullEvent: LicenseProtectionEvent = {
      id: eventId,
      timestamp: new Date(),
      type: event.type || ProtectionEventType.DEVICE_REGISTRATION,
      severity: event.severity || EventSeverity.INFO,
      source: 'DeviceManagementManager',
      message: event.message || 'Device management event',
      details: event.details || {},
      handled: true,
      ...event
    };

    console.log(`[${fullEvent.severity.toUpperCase()}] ${fullEvent.message}`, fullEvent.details);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('DeviceManagementManager not initialized. Call initialize() first.');
    }
  }

  async destroy(): Promise<void> {
    console.log('Destroying Device Management Manager...');
    
    // Clean up resources
    this.devices.clear();
    this.policies.clear();
    this.trustScores.clear();
    this.activeSessions.clear();
    this.complianceCache.clear();
    this.removeAllListeners();

    this.initialized = false;
    console.log('Device Management Manager destroyed');
  }
}