/**
 * Enterprise Account Manager
 * 
 * Handles enterprise account management with primary account administration,
 * centralized admin controls, seat management, usage monitoring, and
 * comprehensive enterprise licensing capabilities.
 */

import { EventEmitter } from 'events';
import { 
  IEnterpriseAccountManager,
  EnterpriseAccount,
  EnterpriseAdmin,
  EnterprisePermission,
  EnterpriseRole,
  AdminStatus,
  EnterpriseAccountStatus,
  SeatAllocationSettings,
  UserManagementSettings,
  EnterpriseSettings,
  Seat,
  SeatRole,
  SeatStatus,
  SeatPermission,
  LicenseProtectionEvent,
  ProtectionEventType,
  EventSeverity,
  NotificationSettings,
  EnterpriseResource,
  EnterpriseAction,
  PermissionCondition,
  PermissionScope,
  SSOConfiguration,
  DirectoryIntegration,
  UserProvisioningSettings,
  SessionManagementSettings,
  ComplianceSettings,
  AuditConfiguration,
  EnterpriseBilling,
  EnterpriseSecuritySettings
} from './types';

export class EnterpriseAccountManager extends EventEmitter implements IEnterpriseAccountManager {
  private accounts: Map<string, EnterpriseAccount> = new Map();
  private adminPermissions: Map<string, Map<string, EnterprisePermission[]>> = new Map();
  private seatAllocations: Map<string, Map<string, Seat[]>> = new Map();
  private initialized: boolean = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('EnterpriseAccountManager already initialized');
      return;
    }

    try {
      console.log('Initializing Enterprise Account Manager...');

      // Load existing accounts and configurations
      await this.loadAccountData();
      await this.initializePermissionSystem();
      await this.setupSeatManagement();

      this.initialized = true;
      this.emit('manager-initialized');
      console.log('Enterprise Account Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Enterprise Account Manager:', error);
      throw error;
    }
  }

  async createAccount(account: Partial<EnterpriseAccount>): Promise<EnterpriseAccount> {
    this.ensureInitialized();

    const accountId = account.id || this.generateAccountId();
    const now = new Date();

    const newAccount: EnterpriseAccount = {
      id: accountId,
      organizationId: account.organizationId || accountId,
      name: account.name || 'Enterprise Account',
      domain: account.domain || '',
      primaryAdminId: account.primaryAdminId || '',
      admins: account.admins || [],
      settings: account.settings || this.createDefaultSettings(),
      billing: account.billing || this.createDefaultBilling(),
      security: account.security || this.createDefaultSecuritySettings(),
      compliance: account.compliance || this.createDefaultComplianceSettings(),
      audit: account.audit || this.createDefaultAuditConfiguration(),
      createdAt: now,
      updatedAt: now,
      status: EnterpriseAccountStatus.ACTIVE
    };

    // Validate account data
    await this.validateAccountData(newAccount);

    // Store account
    this.accounts.set(accountId, newAccount);
    this.adminPermissions.set(accountId, new Map());
    this.seatAllocations.set(accountId, new Map());

    // Create primary admin if specified
    if (newAccount.primaryAdminId) {
      await this.createPrimaryAdmin(accountId, newAccount.primaryAdminId);
    }

    // Log event
    await this.logEvent({
      type: ProtectionEventType.LICENSE_VALIDATED, // Using closest available event
      severity: EventSeverity.INFO,
      message: `Enterprise account created: ${accountId}`,
      details: {
        accountId: accountId,
        organizationId: newAccount.organizationId,
        name: newAccount.name
      }
    });

    this.emit('account-created', { account: newAccount });
    return newAccount;
  }

  async updateAccount(accountId: string, updates: Partial<EnterpriseAccount>): Promise<EnterpriseAccount> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Create updated account
    const updatedAccount: EnterpriseAccount = {
      ...account,
      ...updates,
      updatedAt: new Date()
    };

    // Validate updates
    await this.validateAccountData(updatedAccount);

    // Store updated account
    this.accounts.set(accountId, updatedAccount);

    // Log event
    await this.logEvent({
      type: ProtectionEventType.LICENSE_VALIDATED,
      severity: EventSeverity.INFO,
      message: `Enterprise account updated: ${accountId}`,
      details: {
        accountId: accountId,
        changes: Object.keys(updates)
      }
    });

    this.emit('account-updated', { account: updatedAccount, updates });
    return updatedAccount;
  }

  async getAccount(accountId: string): Promise<EnterpriseAccount | null> {
    this.ensureInitialized();
    return this.accounts.get(accountId) || null;
  }

  async suspendAccount(accountId: string, reason: string): Promise<boolean> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    account.status = EnterpriseAccountStatus.SUSPENDED;
    account.updatedAt = new Date();

    // Suspend all active sessions for this account
    await this.suspendAccountSessions(accountId);

    // Notify admins
    await this.notifyAdmins(accountId, {
      type: 'account-suspended',
      title: 'Account Suspended',
      message: `Enterprise account ${account.name} has been suspended. Reason: ${reason}`,
      severity: EventSeverity.CRITICAL
    });

    // Log event
    await this.logEvent({
      type: ProtectionEventType.LICENSE_REVOKED,
      severity: EventSeverity.CRITICAL,
      message: `Enterprise account suspended: ${accountId}`,
      details: {
        accountId: accountId,
        reason: reason
      }
    });

    this.emit('account-suspended', { accountId, reason });
    return true;
  }

  async activateAccount(accountId: string): Promise<boolean> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    account.status = EnterpriseAccountStatus.ACTIVE;
    account.updatedAt = new Date();

    // Notify admins
    await this.notifyAdmins(accountId, {
      type: 'account-activated',
      title: 'Account Activated',
      message: `Enterprise account ${account.name} has been activated`,
      severity: EventSeverity.INFO
    });

    // Log event
    await this.logEvent({
      type: ProtectionEventType.LICENSE_VALIDATED,
      severity: EventSeverity.INFO,
      message: `Enterprise account activated: ${accountId}`,
      details: {
        accountId: accountId
      }
    });

    this.emit('account-activated', { accountId });
    return true;
  }

  async assignAdmin(accountId: string, admin: Partial<EnterpriseAdmin>): Promise<EnterpriseAdmin> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const now = new Date();
    const newAdmin: EnterpriseAdmin = {
      userId: admin.userId || this.generateUserId(),
      email: admin.email || '',
      role: admin.role || EnterpriseRole.USER_MANAGER,
      permissions: admin.permissions || this.getDefaultPermissions(admin.role || EnterpriseRole.USER_MANAGER),
      assignedAt: now,
      assignedBy: admin.assignedBy || account.primaryAdminId,
      lastActiveAt: admin.lastActiveAt,
      status: AdminStatus.ACTIVE
    };

    // Validate admin data
    await this.validateAdminData(newAdmin);

    // Add to account
    account.admins.push(newAdmin);
    account.updatedAt = now;

    // Store admin permissions
    const accountPermissions = this.adminPermissions.get(accountId) || new Map();
    accountPermissions.set(newAdmin.userId, newAdmin.permissions);
    this.adminPermissions.set(accountId, accountPermissions);

    // Log event
    await this.logEvent({
      type: ProtectionEventType.SEAT_ASSIGNED,
      severity: EventSeverity.INFO,
      message: `Admin assigned: ${newAdmin.userId} to account ${accountId}`,
      details: {
        accountId: accountId,
        adminId: newAdmin.userId,
        role: newAdmin.role,
        assignedBy: newAdmin.assignedBy
      }
    });

    this.emit('admin-assigned', { accountId, admin: newAdmin });
    return newAdmin;
  }

  async removeAdmin(accountId: string, adminId: string): Promise<boolean> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Cannot remove primary admin
    if (adminId === account.primaryAdminId) {
      throw new Error('Cannot remove primary admin');
    }

    const adminIndex = account.admins.findIndex(admin => admin.userId === adminId);
    if (adminIndex === -1) {
      throw new Error(`Admin not found: ${adminId}`);
    }

    // Remove admin
    const removedAdmin = account.admins.splice(adminIndex, 1)[0];
    account.updatedAt = new Date();

    // Remove admin permissions
    const accountPermissions = this.adminPermissions.get(accountId);
    if (accountPermissions) {
      accountPermissions.delete(adminId);
    }

    // Log event
    await this.logEvent({
      type: ProtectionEventType.SEAT_REMOVED,
      severity: EventSeverity.INFO,
      message: `Admin removed: ${adminId} from account ${accountId}`,
      details: {
        accountId: accountId,
        adminId: adminId,
        role: removedAdmin.role
      }
    });

    this.emit('admin-removed', { accountId, adminId, admin: removedAdmin });
    return true;
  }

  async updatePermissions(accountId: string, adminId: string, permissions: EnterprisePermission[]): Promise<boolean> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const admin = account.admins.find(a => a.userId === adminId);
    if (!admin) {
      throw new Error(`Admin not found: ${adminId}`);
    }

    // Update permissions
    admin.permissions = permissions;
    account.updatedAt = new Date();

    // Store updated permissions
    const accountPermissions = this.adminPermissions.get(accountId) || new Map();
    accountPermissions.set(adminId, permissions);
    this.adminPermissions.set(accountId, accountPermissions);

    // Log event
    await this.logEvent({
      type: ProtectionEventType.PERMISSION_CHANGE,
      severity: EventSeverity.INFO,
      message: `Permissions updated for admin: ${adminId} in account ${accountId}`,
      details: {
        accountId: accountId,
        adminId: adminId,
        permissionCount: permissions.length
      }
    });

    this.emit('permissions-updated', { accountId, adminId, permissions });
    return true;
  }

  // Seat Management Methods
  async allocateSeat(accountId: string, userId: string, seatConfig: Partial<Seat>): Promise<Seat> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Check seat availability
    const currentSeats = this.seatAllocations.get(accountId)?.get(userId) || [];
    const maxSeats = account.settings.seatAllocation.maxSeatsPerUser;
    
    if (currentSeats.length >= maxSeats) {
      throw new Error(`Maximum seats reached for user: ${userId}`);
    }

    const now = new Date();
    const seat: Seat = {
      id: seatConfig.id || this.generateSeatId(),
      userId: userId,
      email: seatConfig.email || '',
      role: seatConfig.role || SeatRole.USER,
      status: SeatStatus.ACTIVE,
      assignedAt: now,
      lastActiveAt: seatConfig.lastActiveAt,
      permissions: seatConfig.permissions || this.getDefaultSeatPermissions(seatConfig.role || SeatRole.USER)
    };

    // Store seat allocation
    const accountSeats = this.seatAllocations.get(accountId) || new Map();
    const userSeats = accountSeats.get(userId) || [];
    userSeats.push(seat);
    accountSeats.set(userId, userSeats);
    this.seatAllocations.set(accountId, accountSeats);

    // Log event
    await this.logEvent({
      type: ProtectionEventType.SEAT_ASSIGNED,
      severity: EventSeverity.INFO,
      message: `Seat allocated: ${seat.id} to user ${userId} in account ${accountId}`,
      details: {
        accountId: accountId,
        userId: userId,
        seatId: seat.id,
        role: seat.role
      }
    });

    this.emit('seat-allocated', { accountId, userId, seat });
    return seat;
  }

  async transferSeat(accountId: string, seatId: string, fromUserId: string, toUserId: string): Promise<boolean> {
    this.ensureInitialized();

    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Check transfer restrictions
    await this.checkSeatTransferEligibility(accountId, fromUserId, toUserId);

    const accountSeats = this.seatAllocations.get(accountId);
    if (!accountSeats) {
      throw new Error('No seat allocations found for account');
    }

    const fromUserSeats = accountSeats.get(fromUserId) || [];
    const seatIndex = fromUserSeats.findIndex(s => s.id === seatId);
    
    if (seatIndex === -1) {
      throw new Error(`Seat not found: ${seatId}`);
    }

    const seat = fromUserSeats.splice(seatIndex, 1)[0];
    seat.userId = toUserId;
    seat.assignedAt = new Date();

    // Add to target user
    const toUserSeats = accountSeats.get(toUserId) || [];
    toUserSeats.push(seat);
    accountSeats.set(toUserId, toUserSeats);

    // Log event
    await this.logEvent({
      type: ProtectionEventType.SEAT_ASSIGNED,
      severity: EventSeverity.INFO,
      message: `Seat transferred: ${seatId} from ${fromUserId} to ${toUserId} in account ${accountId}`,
      details: {
        accountId: accountId,
        seatId: seatId,
        fromUserId: fromUserId,
        toUserId: toUserId
      }
    });

    this.emit('seat-transferred', { accountId, seatId, fromUserId, toUserId });
    return true;
  }

  // Private helper methods
  private setupEventHandlers(): void {
    this.on('account-created', this.handleAccountCreated.bind(this));
    this.on('admin-assigned', this.handleAdminAssigned.bind(this));
    this.on('seat-allocated', this.handleSeatAllocated.bind(this));
  }

  private async loadAccountData(): Promise<void> {
    // In production, this would load from persistent storage
    console.log('Loading account data...');
  }

  private async initializePermissionSystem(): Promise<void> {
    console.log('Initializing permission system...');
  }

  private async setupSeatManagement(): Promise<void> {
    console.log('Setting up seat management...');
  }

  private generateAccountId(): string {
    return `ea_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSeatId(): string {
    return `seat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private createDefaultSettings(): EnterpriseSettings {
    return {
      seatAllocation: {
        autoAssignment: false,
        allowSelfProvisioning: false,
        requireApproval: true,
        maxSeatsPerUser: 1,
        seatRetentionDays: 30,
        transferCooldownHours: 24,
        preventAbuseEnabled: true,
        maxTransfersPerMonth: 3
      } as SeatAllocationSettings,
      userManagement: {
        singleSignOn: {
          enabled: false,
          provider: 'saml' as any,
          configuration: {},
          domainRestriction: [],
          enforceSSO: false
        } as SSOConfiguration,
        directoryIntegration: {
          enabled: false,
          provider: 'ldap' as any,
          syncInterval: 3600000,
          syncAttributes: [],
          configuration: {}
        } as DirectoryIntegration,
        userProvisioning: {
          autoProvisioning: false,
          deprovisionOnRemoval: true,
          groupBasedProvisioning: false,
          defaultRole: SeatRole.USER,
          welcomeEmailEnabled: true
        } as UserProvisioningSettings,
        sessionManagement: {
          maxSessions: 3,
          sessionTimeout: 28800000,
          idleTimeout: 3600000,
          forceLogoutOnSuspension: true,
          deviceBinding: true
        } as SessionManagementSettings
      } as UserManagementSettings,
      security: {} as EnterpriseSecuritySettings,
      notifications: {
        enabled: true,
        channels: [],
        recipients: [],
        conditions: [],
        rateLimit: {
          enabled: true,
          maxPerHour: 10,
          maxPerDay: 50,
          cooldownMinutes: 5
        }
      } as NotificationSettings,
      integrations: {
        siem: {
          enabled: false,
          provider: 'splunk' as any,
          configuration: {},
          eventTypes: [],
          batchSize: 100,
          flushInterval: 60
        },
        ticketing: {
          enabled: false,
          provider: 'jira' as any,
          configuration: {},
          autoCreateTickets: false,
          severityMapping: {} as any,
          assignmentRules: []
        },
        mdm: {
          enabled: false,
          provider: 'intune' as any,
          configuration: {},
          syncDevices: false,
          enforcePolicies: false,
          complianceReporting: false
        },
        identity: {
          enabled: false,
          provider: 'azure_ad' as any,
          configuration: {},
          syncUsers: false,
          syncGroups: false,
          attributeMapping: {}
        },
        analytics: {
          enabled: false,
          provider: 'google_analytics' as any,
          configuration: {},
          trackEvents: [],
          customDimensions: {}
        },
        webhooks: []
      },
      branding: {
        enabled: false,
        logo: '',
        colors: {
          primary: '#007bff',
          secondary: '#6c757d',
          accent: '#28a745',
          background: '#ffffff',
          text: '#212529',
          error: '#dc3545',
          warning: '#ffc107',
          success: '#28a745'
        },
        fonts: {
          primary: 'Arial, sans-serif',
          secondary: 'Georgia, serif',
          monospace: 'Monaco, monospace'
        },
        customCSS: '',
        whiteLabeling: false,
        customDomain: ''
      }
    };
  }

  private createDefaultBilling(): EnterpriseBilling {
    return {
      accountId: '',
      billingContact: {
        name: '',
        email: '',
        address: {
          street: '',
          city: '',
          postalCode: '',
          country: ''
        },
        purchaseOrderRequired: false
      },
      paymentMethod: {
        type: 'invoice' as any,
        details: {},
        isDefault: true,
        isActive: true
      },
      invoicing: {
        frequency: 'monthly' as any,
        terms: 'net_30' as any,
        format: 'pdf' as any,
        delivery: {
          method: 'email' as any,
          recipients: []
        },
        customFields: []
      },
      usage: {
        enabled: true,
        granularity: 'daily' as any,
        metrics: [],
        reporting: {
          enabled: true,
          frequency: 'monthly' as any,
          recipients: [],
          includeCosts: true,
          includeForecasts: false,
          customReports: []
        },
        alerts: []
      },
      costCenter: [],
      budgets: []
    };
  }

  private createDefaultSecuritySettings(): EnterpriseSecuritySettings {
    return {
      deviceManagement: {
        maxDevicesPerUser: 5,
        deviceRegistrationRequired: true,
        deviceTrustRequired: true,
        allowBYOD: false,
        mdmIntegration: false,
        deviceComplianceRequired: true,
        automaticDeauthorization: true,
        deviceRetentionDays: 90
      },
      accessControl: {
        ipWhitelisting: {
          enabled: false,
          allowedIPs: [],
          allowedCIDRs: [],
          blockUnknownIPs: false,
          notifyOnBlockedAccess: true
        },
        geofencing: {
          enabled: false,
          allowedCountries: [],
          allowedRegions: [],
          blockVPNs: false,
          blockProxies: false,
          notifyOnSuspiciousLocation: true
        },
        timeBasedAccess: {
          enabled: false,
          allowedTimeZones: [],
          businessHoursOnly: false,
          businessHours: [],
          weekendsAllowed: true,
          holidaysAllowed: true
        },
        riskBasedAccess: {
          enabled: true,
          riskThreshold: 'medium' as any,
          requireMFAOnHighRisk: true,
          blockOnCriticalRisk: true,
          adaptiveAuthEnabled: true,
          behaviorAnalysis: true
        }
      },
      auditLogging: {
        enabled: true,
        level: 'standard' as any,
        retentionDays: 365,
        externalLogging: false,
        realTimeAlerts: true,
        complianceMode: true
      },
      threatDetection: {
        enabled: true,
        sensitivity: 'medium' as any,
        realTimeMonitoring: true,
        automaticResponse: true,
        mlBasedDetection: false,
        behaviorBaselines: true
      }
    };
  }

  private createDefaultComplianceSettings(): ComplianceSettings {
    return {
      enabled: true,
      framework: [],
      reporting: {
        enabled: false,
        frequency: 'quarterly' as any,
        recipients: [],
        includeDetails: true,
        automaticGeneration: false,
        customReports: []
      },
      auditing: {
        enabled: false,
        auditTrail: {
          enabled: false,
          retentionDays: 2555, // 7 years
          immutableStorage: false,
          encryption: false,
          digitalSignature: false,
          realTimeMonitoring: false
        },
        dataClassification: {
          enabled: false,
          categories: [],
          autoClassification: false,
          labelingRequired: false,
          accessControls: false
        },
        accessLogging: {
          enabled: false,
          logSuccessfulAccess: false,
          logFailedAccess: false,
          logPrivilegedAccess: false,
          logDataAccess: false,
          logConfigChanges: false,
          realTimeAlerts: false
        },
        changeTracking: {
          enabled: false,
          trackConfigChanges: false,
          trackPolicyChanges: false,
          trackUserChanges: false,
          trackPermissionChanges: false,
          approvalRequired: false,
          rollbackCapability: false
        }
      },
      retention: {
        enabled: false,
        policies: [],
        automaticPurging: false,
        legalHolds: [],
        archiving: {
          enabled: false,
          provider: 'local_storage' as any,
          configuration: {},
          compression: false,
          encryption: false,
          indexing: false,
          searchCapability: false
        }
      },
      privacy: {
        enabled: false,
        dataMinimization: false,
        consentManagement: {
          enabled: false,
          granularConsent: false,
          consentWithdrawal: false,
          consentLogging: false,
          consentExpiration: 365,
          renewalReminders: false
        },
        rightToErasure: false,
        dataPortability: false,
        privacyByDesign: false,
        impactAssessments: false
      }
    };
  }

  private createDefaultAuditConfiguration(): AuditConfiguration {
    return {
      enabled: true,
      retention: 365,
      events: [],
      storage: {
        location: 'local' as any,
        encryption: true,
        compression: true,
        integrity: {
          enabled: true,
          algorithm: 'sha256' as any,
          verification: {
            frequency: 'daily' as any,
            alertOnFailure: true,
            automaticRepair: false
          }
        },
        backup: {
          enabled: true,
          frequency: 'daily' as any,
          retention: 30,
          offsite: false,
          encryption: true,
          testing: {
            enabled: false,
            frequency: 'monthly' as any,
            automated: false,
            reportResults: false
          }
        }
      },
      reporting: {
        enabled: false,
        frequency: 'monthly' as any,
        recipients: [],
        includeRawLogs: false,
        customQueries: []
      },
      compliance: {
        frameworks: [],
        mapping: [],
        attestation: {
          enabled: false,
          frequency: 'quarterly' as any,
          attestors: [],
          requirements: []
        },
        certification: {
          enabled: false,
          certifications: [],
          auditors: [],
          evidence: {
            autoCollection: false,
            repository: {
              type: 'local' as any,
              configuration: {},
              encryption: false,
              accessControls: []
            },
            organization: {
              categories: [],
              tagging: {
                enabled: false,
                autoTagging: false,
                predefinedTags: [],
                customTags: false
              },
              searchConfiguration: {
                enabled: false,
                indexing: false,
                fullTextSearch: false,
                metadataSearch: false,
                facetedSearch: false
              }
            },
            retention: {
              policies: [],
              automaticPurging: false,
              archiving: false
            }
          }
        }
      }
    };
  }

  private async validateAccountData(account: EnterpriseAccount): Promise<void> {
    if (!account.name || account.name.trim().length === 0) {
      throw new Error('Account name is required');
    }

    if (account.domain && !this.isValidDomain(account.domain)) {
      throw new Error('Invalid domain format');
    }
  }

  private async validateAdminData(admin: EnterpriseAdmin): Promise<void> {
    if (!admin.userId || admin.userId.trim().length === 0) {
      throw new Error('Admin user ID is required');
    }

    if (!admin.email || !this.isValidEmail(admin.email)) {
      throw new Error('Valid admin email is required');
    }
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.?([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.)*[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getDefaultPermissions(role: EnterpriseRole): EnterprisePermission[] {
    const permissions: EnterprisePermission[] = [];

    switch (role) {
      case EnterpriseRole.SUPER_ADMIN:
        permissions.push(
          { resource: EnterpriseResource.USERS, actions: [EnterpriseAction.CREATE, EnterpriseAction.READ, EnterpriseAction.UPDATE, EnterpriseAction.DELETE] },
          { resource: EnterpriseResource.SEATS, actions: [EnterpriseAction.CREATE, EnterpriseAction.READ, EnterpriseAction.UPDATE, EnterpriseAction.DELETE, EnterpriseAction.ASSIGN, EnterpriseAction.REVOKE] },
          { resource: EnterpriseResource.LICENSES, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE, EnterpriseAction.REVOKE] },
          { resource: EnterpriseResource.BILLING, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE] },
          { resource: EnterpriseResource.SECURITY, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE] },
          { resource: EnterpriseResource.AUDIT_LOGS, actions: [EnterpriseAction.READ] },
          { resource: EnterpriseResource.SETTINGS, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE] }
        );
        break;

      case EnterpriseRole.ADMIN:
        permissions.push(
          { resource: EnterpriseResource.USERS, actions: [EnterpriseAction.CREATE, EnterpriseAction.READ, EnterpriseAction.UPDATE] },
          { resource: EnterpriseResource.SEATS, actions: [EnterpriseAction.CREATE, EnterpriseAction.READ, EnterpriseAction.UPDATE, EnterpriseAction.ASSIGN, EnterpriseAction.REVOKE] },
          { resource: EnterpriseResource.LICENSES, actions: [EnterpriseAction.READ] },
          { resource: EnterpriseResource.AUDIT_LOGS, actions: [EnterpriseAction.READ] }
        );
        break;

      case EnterpriseRole.USER_MANAGER:
        permissions.push(
          { resource: EnterpriseResource.USERS, actions: [EnterpriseAction.CREATE, EnterpriseAction.READ, EnterpriseAction.UPDATE] },
          { resource: EnterpriseResource.SEATS, actions: [EnterpriseAction.READ, EnterpriseAction.ASSIGN] }
        );
        break;

      case EnterpriseRole.BILLING_ADMIN:
        permissions.push(
          { resource: EnterpriseResource.BILLING, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE] },
          { resource: EnterpriseResource.USERS, actions: [EnterpriseAction.READ] }
        );
        break;

      case EnterpriseRole.SECURITY_ADMIN:
        permissions.push(
          { resource: EnterpriseResource.SECURITY, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE] },
          { resource: EnterpriseResource.AUDIT_LOGS, actions: [EnterpriseAction.READ] },
          { resource: EnterpriseResource.DEVICES, actions: [EnterpriseAction.READ, EnterpriseAction.UPDATE] }
        );
        break;

      case EnterpriseRole.COMPLIANCE_OFFICER:
        permissions.push(
          { resource: EnterpriseResource.AUDIT_LOGS, actions: [EnterpriseAction.READ] },
          { resource: EnterpriseResource.USERS, actions: [EnterpriseAction.READ] },
          { resource: EnterpriseResource.DEVICES, actions: [EnterpriseAction.READ] }
        );
        break;

      default:
        permissions.push(
          { resource: EnterpriseResource.USERS, actions: [EnterpriseAction.READ] }
        );
    }

    return permissions;
  }

  private getDefaultSeatPermissions(role: SeatRole): SeatPermission[] {
    const permissions: SeatPermission[] = [];

    switch (role) {
      case SeatRole.OWNER:
        permissions.push(
          { feature: 'core', access: 'full' },
          { feature: 'basic_analysis', access: 'full' },
          { feature: 'advanced_analysis', access: 'full' },
          { feature: 'premium_analysis', access: 'full' },
          { feature: 'enterprise_features', access: 'full' },
          { feature: 'api_access', access: 'full' },
          { feature: 'multi_user', access: 'full' }
        );
        break;

      case SeatRole.ADMIN:
        permissions.push(
          { feature: 'core', access: 'full' },
          { feature: 'basic_analysis', access: 'full' },
          { feature: 'advanced_analysis', access: 'full' },
          { feature: 'premium_analysis', access: 'full' },
          { feature: 'api_access', access: 'full' }
        );
        break;

      case SeatRole.USER:
        permissions.push(
          { feature: 'core', access: 'full' },
          { feature: 'basic_analysis', access: 'full' },
          { feature: 'advanced_analysis', access: 'read' }
        );
        break;

      case SeatRole.VIEWER:
        permissions.push(
          { feature: 'core', access: 'read' },
          { feature: 'basic_analysis', access: 'read' }
        );
        break;
    }

    return permissions;
  }

  private async createPrimaryAdmin(accountId: string, userId: string): Promise<void> {
    await this.assignAdmin(accountId, {
      userId: userId,
      role: EnterpriseRole.SUPER_ADMIN,
      email: '',
      assignedBy: 'system'
    });
  }

  private async suspendAccountSessions(accountId: string): Promise<void> {
    // In production, this would suspend all active sessions for the account
    console.log(`Suspending all sessions for account: ${accountId}`);
  }

  private async notifyAdmins(accountId: string, notification: any): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    // In production, this would send notifications to all admins
    console.log(`Notifying admins for account ${accountId}:`, notification.title);
  }

  private async logEvent(event: Partial<LicenseProtectionEvent>): Promise<void> {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullEvent: LicenseProtectionEvent = {
      id: eventId,
      timestamp: new Date(),
      type: event.type || ProtectionEventType.LICENSE_VALIDATED,
      severity: event.severity || EventSeverity.INFO,
      source: 'EnterpriseAccountManager',
      message: event.message || 'Enterprise event',
      details: event.details || {},
      handled: true,
      ...event
    };

    console.log(`[${fullEvent.severity.toUpperCase()}] ${fullEvent.message}`, fullEvent.details);
  }

  private async checkSeatTransferEligibility(accountId: string, fromUserId: string, toUserId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Check transfer cooldown
    const settings = account.settings.seatAllocation;
    if (settings.transferCooldownHours > 0) {
      // In production, would check last transfer time
      console.log(`Checking transfer cooldown: ${settings.transferCooldownHours} hours`);
    }

    // Check monthly transfer limit
    if (settings.maxTransfersPerMonth > 0) {
      // In production, would check monthly transfer count
      console.log(`Checking monthly transfer limit: ${settings.maxTransfersPerMonth}`);
    }

    // Check abuse prevention
    if (settings.preventAbuseEnabled) {
      // In production, would run abuse detection checks
      console.log('Running abuse prevention checks for seat transfer');
    }
  }

  private handleAccountCreated(data: { account: EnterpriseAccount }): void {
    console.log(`Account created event handled: ${data.account.id}`);
  }

  private handleAdminAssigned(data: { accountId: string; admin: EnterpriseAdmin }): void {
    console.log(`Admin assigned event handled: ${data.admin.userId} to ${data.accountId}`);
  }

  private handleSeatAllocated(data: { accountId: string; userId: string; seat: Seat }): void {
    console.log(`Seat allocated event handled: ${data.seat.id} to ${data.userId} in ${data.accountId}`);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EnterpriseAccountManager not initialized. Call initialize() first.');
    }
  }

  async destroy(): Promise<void> {
    console.log('Destroying Enterprise Account Manager...');
    
    // Clean up resources
    this.accounts.clear();
    this.adminPermissions.clear();
    this.seatAllocations.clear();
    this.removeAllListeners();

    this.initialized = false;
    console.log('Enterprise Account Manager destroyed');
  }
}