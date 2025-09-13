/**
 * License Management & Compliance System Integration
 * Unified export and integration layer for license management components
 */

import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import { LicenseManager } from './LicenseManager';
import {
  ThirdPartyLibrary,
  LicensePolicy,
  ComplianceReport,
  ComplianceViolation,
  DependencyAudit,
  LicenseMetrics,
  LegalComplianceConfig,
  ReportType,
  ReportScope,
  // LicenseApproval
} from './types';

export class LicenseManagementSystem extends EventEmitter {
  private licenseManager: LicenseManager;
  private initialized = false;

  constructor() {
    super();
    
    this.licenseManager = new LicenseManager();
    this.setupEventForwarding();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize license manager
      await this.licenseManager.initialize();
      
      // Setup IPC handlers
      this.setupIPCHandlers();
      
      this.initialized = true;
      
      console.log('License Management System initialized successfully');
      this.emit('system-initialized');
      
    } catch (error) {
      console.error('Failed to initialize License Management System:', error);
      throw error;
    }
  }

  // Library Management API
  public async scanProject(projectPath?: string): Promise<ThirdPartyLibrary[]> {
    return await this.licenseManager.scanProject(projectPath);
  }

  public getLibraries(): ThirdPartyLibrary[] {
    return this.licenseManager.getLibraries();
  }

  // Policy Management API
  public async createPolicy(policy: Omit<LicensePolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<LicensePolicy> {
    return await this.licenseManager.createPolicy(policy);
  }

  public async updatePolicy(policyId: string, updates: Partial<LicensePolicy>): Promise<boolean> {
    return await this.licenseManager.updatePolicy(policyId, updates);
  }

  public getPolicies(): LicensePolicy[] {
    return this.licenseManager.getPolicies();
  }

  public getPolicy(policyId: string): LicensePolicy | null {
    return this.licenseManager.getPolicy(policyId);
  }

  // Compliance Reporting API
  public async generateComplianceReport(
    reportType?: ReportType,
    scope?: ReportScope
  ): Promise<ComplianceReport> {
    return await this.licenseManager.generateComplianceReport(reportType, scope);
  }

  public getViolations(): ComplianceViolation[] {
    return this.licenseManager.getViolations();
  }

  // Dependency Auditing API
  public async performDependencyAudit(): Promise<DependencyAudit> {
    return await this.licenseManager.performDependencyAudit();
  }

  // Metrics and Analytics API
  public getLicenseMetrics(): LicenseMetrics {
    return this.licenseManager.getLicenseMetrics();
  }

  // Configuration API
  public async updateConfiguration(config: Partial<LegalComplianceConfig>): Promise<void> {
    await this.licenseManager.updateConfiguration(config);
  }

  public getConfiguration(): LegalComplianceConfig {
    return this.licenseManager.getConfiguration();
  }

  // Event Forwarding
  private setupEventForwarding(): void {
    this.licenseManager.on('scan-completed', (libraries) => this.emit('scan-completed', libraries));
    this.licenseManager.on('policy-created', (policy) => this.emit('policy-created', policy));
    this.licenseManager.on('policy-updated', (policy) => this.emit('policy-updated', policy));
    this.licenseManager.on('report-generated', (report) => this.emit('report-generated', report));
    this.licenseManager.on('audit-completed', (audit) => this.emit('audit-completed', audit));
    this.licenseManager.on('configuration-updated', (config) => this.emit('configuration-updated', config));
    this.licenseManager.on('event-logged', (event) => this.emit('event-logged', event));
  }

  // IPC Handlers for Renderer Process
  private setupIPCHandlers(): void {
    // Library Management
    ipcMain.handle('license-management:scan-project', (_, projectPath?: string) => {
      return this.scanProject(projectPath);
    });

    ipcMain.handle('license-management:get-libraries', () => {
      return this.getLibraries();
    });

    // Policy Management
    ipcMain.handle('license-management:get-policies', () => {
      return this.getPolicies();
    });

    ipcMain.handle('license-management:get-policy', (_, policyId: string) => {
      return this.getPolicy(policyId);
    });

    ipcMain.handle('license-management:create-policy', (_, policy: Omit<LicensePolicy, 'id' | 'createdAt' | 'updatedAt'>) => {
      return this.createPolicy(policy);
    });

    ipcMain.handle('license-management:update-policy', (_, policyId: string, updates: Partial<LicensePolicy>) => {
      return this.updatePolicy(policyId, updates);
    });

    // Compliance Reporting
    ipcMain.handle('license-management:generate-report', (_, reportType?: ReportType, scope?: ReportScope) => {
      return this.generateComplianceReport(reportType, scope);
    });

    ipcMain.handle('license-management:get-violations', () => {
      return this.getViolations();
    });

    // Dependency Auditing
    ipcMain.handle('license-management:perform-audit', () => {
      return this.performDependencyAudit();
    });

    // Metrics and Analytics
    ipcMain.handle('license-management:get-metrics', () => {
      return this.getLicenseMetrics();
    });

    // Configuration
    ipcMain.handle('license-management:get-configuration', () => {
      return this.getConfiguration();
    });

    ipcMain.handle('license-management:update-configuration', (_, config: Partial<LegalComplianceConfig>) => {
      return this.updateConfiguration(config);
    });

    console.log('License Management IPC handlers registered');
  }

  // Advanced Compliance Features
  public async performComplianceCheck(libraryName: string, version: string): Promise<{
    compliant: boolean;
    issues: Array<Record<string, unknown>>;
    recommendations: Array<Record<string, unknown>>;
  }> {
    try {
      const libraries = this.getLibraries();
      const library = libraries.find(lib => lib.name === libraryName && lib.version === version);
      
      if (!library) {
        return {
          compliant: false,
          issues: [{ type: 'not_found', description: 'Library not found in inventory' }],
          recommendations: [{ action: 'Scan project to update library inventory' }]
        };
      }

      const violations = this.getViolations().filter(v => 
        v.library === libraryName && v.version === version
      );

      const compliant = violations.length === 0 && 
                       library.license.compatibility !== 'incompatible';

      const issues = violations.map(v => ({
        type: v.violationType,
        description: v.description,
        severity: v.severity
      }));

      const recommendations = violations.map(v => ({
        action: v.recommendation,
        priority: v.severity === 'critical' ? 'high' : 'medium'
      }));

      return { compliant, issues, recommendations };
      
    } catch (error) {
      console.error('Failed to perform compliance check:', error);
      return {
        compliant: false,
        issues: [{ type: 'error', description: 'Failed to perform compliance check' }],
        recommendations: []
      };
    }
  }

  public async getLicenseCompatibilityMatrix(): Promise<Record<string, Record<string, string>>> {
    const libraries = this.getLibraries();
    const licenseTypes = [...new Set(libraries.map(lib => lib.license.type))];
    const matrix: Record<string, Record<string, string>> = {};

    // Build compatibility matrix
    for (const license1 of licenseTypes) {
      matrix[license1] = {};
      for (const license2 of licenseTypes) {
        matrix[license1][license2] = this.assessLicenseCompatibility(license1, license2);
      }
    }

    return matrix;
  }

  private assessLicenseCompatibility(license1: string, license2: string): string {
    // Simplified compatibility assessment
    const permissiveLicenses = ['MIT', 'BSD-3-Clause', 'BSD-2-Clause', 'Apache-2.0', 'ISC'];
    const copyleftLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'];
    const weakCopyleftLicenses = ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'];

    // Same license is always compatible
    if (license1 === license2) return 'compatible';

    // Permissive licenses are generally compatible with each other
    if (permissiveLicenses.includes(license1) && permissiveLicenses.includes(license2)) {
      return 'compatible';
    }

    // Strong copyleft with permissive
    if (copyleftLicenses.includes(license1) && permissiveLicenses.includes(license2)) {
      return 'one-way'; // Can use permissive in copyleft, not vice versa
    }
    if (permissiveLicenses.includes(license1) && copyleftLicenses.includes(license2)) {
      return 'incompatible';
    }

    // Weak copyleft considerations
    if (weakCopyleftLicenses.includes(license1) && permissiveLicenses.includes(license2)) {
      return 'conditional';
    }

    return 'unknown';
  }

  public async generateLicenseNotices(): Promise<string> {
    const libraries = this.getLibraries();
    const notices: string[] = [];

    notices.push('THIRD-PARTY SOFTWARE NOTICES AND INFORMATION');
    notices.push('='.repeat(50));
    notices.push('');

    for (const library of libraries.sort((a, b) => a.name.localeCompare(b.name))) {
      notices.push(`${library.name} v${library.version}`);
      notices.push(`License: ${library.license.type}`);
      
      if (library.author) {
        notices.push(`Copyright: ${library.author}`);
      }
      
      if (library.homepage) {
        notices.push(`Homepage: ${library.homepage}`);
      }
      
      if (library.license.text) {
        notices.push('');
        notices.push(library.license.text);
      }
      
      notices.push('');
      notices.push('-'.repeat(40));
      notices.push('');
    }

    return notices.join('\n');
  }

  public async exportComplianceData(format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    const libraries = this.getLibraries();
    const violations = this.getViolations();
    const metrics = this.getLicenseMetrics();

    const data = {
      exportDate: new Date().toISOString(),
      libraries: libraries.map(lib => ({
        name: lib.name,
        version: lib.version,
        license: lib.license.type,
        category: lib.category,
        riskLevel: lib.riskLevel,
        homepage: lib.homepage
      })),
      violations: violations.map(v => ({
        library: v.library,
        version: v.version,
        type: v.violationType,
        severity: v.severity,
        status: v.status,
        description: v.description
      })),
      metrics,
      summary: {
        totalLibraries: libraries.length,
        licenseTypes: [...new Set(libraries.map(lib => lib.license.type))].length,
        complianceScore: metrics.complianceScore,
        riskScore: metrics.riskScore
      }
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      case 'xml':
        return this.convertToXML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private convertToCSV(data: Record<string, unknown>): string {
    const lines: string[] = [];
    
    // Library data
    lines.push('Name,Version,License,Category,Risk Level,Homepage');
    for (const lib of data.libraries) {
      lines.push(`"${lib.name}","${lib.version}","${lib.license}","${lib.category}","${lib.riskLevel}","${lib.homepage || ''}"`);
    }
    
    return lines.join('\n');
  }

  private convertToXML(data: Record<string, unknown>): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<compliance-report>\n';
    xml += `  <export-date>${data.exportDate}</export-date>\n`;
    xml += '  <libraries>\n';
    
    for (const lib of data.libraries) {
      xml += '    <library>\n';
      xml += `      <name>${this.escapeXML(lib.name)}</name>\n`;
      xml += `      <version>${lib.version}</version>\n`;
      xml += `      <license>${this.escapeXML(lib.license)}</license>\n`;
      xml += `      <category>${lib.category}</category>\n`;
      xml += `      <risk-level>${lib.riskLevel}</risk-level>\n`;
      xml += `      <homepage>${this.escapeXML(lib.homepage || '')}</homepage>\n`;
      xml += '    </library>\n';
    }
    
    xml += '  </libraries>\n';
    xml += '</compliance-report>';
    
    return xml;
  }

  private escapeXML(str: string): string {
    return str.replace(/[<>&'"]/g, (match) => {
      switch (match) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return match;
      }
    });
  }

  // Integration with Security System
  public async validateSecurityLibraries(securityLibraries: string[]): Promise<{
    approved: string[];
    rejected: string[];
    requiresReview: string[];
  }> {
    const result = { approved: [], rejected: [], requiresReview: [] } as {
      approved: string[];
      rejected: string[];
      requiresReview: string[];
    };
    const libraries = this.getLibraries();

    for (const libraryName of securityLibraries) {
      const library = libraries.find(lib => lib.name === libraryName);
      
      if (!library) {
        result.requiresReview.push(libraryName);
        continue;
      }

      const violations = this.getViolations().filter(v => v.library === libraryName);
      
      if (violations.some(v => v.severity === 'critical')) {
        result.rejected.push(libraryName);
      } else if (violations.length === 0 && library.license.compatibility === 'compatible') {
        result.approved.push(libraryName);
      } else {
        result.requiresReview.push(libraryName);
      }
    }

    return result;
  }

  public async getSecurityLibraryRecommendations(): Promise<{
    category: string;
    recommendations: Array<{
      name: string;
      description: string;
      license: string;
      riskLevel: string;
      alternatives?: string[];
    }>;
  }[]> {
    return [
      {
        category: 'Cryptography',
        recommendations: [
          {
            name: 'crypto',
            description: 'Node.js built-in cryptographic functionality',
            license: 'Node.js License (MIT-like)',
            riskLevel: 'low'
          },
          {
            name: 'node-forge',
            description: 'JavaScript implementations of network transports, cryptography, ciphers, PKI, message digests, and various utilities',
            license: 'BSD-3-Clause',
            riskLevel: 'low',
            alternatives: ['crypto-js']
          }
        ]
      },
      {
        category: 'Authentication',
        recommendations: [
          {
            name: 'jsonwebtoken',
            description: 'JsonWebToken implementation for node.js',
            license: 'MIT',
            riskLevel: 'low'
          },
          {
            name: 'bcryptjs',
            description: 'Optimized bcrypt in plain JavaScript with zero dependencies',
            license: 'MIT',
            riskLevel: 'low',
            alternatives: ['argon2']
          }
        ]
      }
    ];
  }

  public destroy(): void {
    // Remove IPC handlers
    ipcMain.removeHandler('license-management:scan-project');
    ipcMain.removeHandler('license-management:get-libraries');
    ipcMain.removeHandler('license-management:get-policies');
    ipcMain.removeHandler('license-management:get-policy');
    ipcMain.removeHandler('license-management:create-policy');
    ipcMain.removeHandler('license-management:update-policy');
    ipcMain.removeHandler('license-management:generate-report');
    ipcMain.removeHandler('license-management:get-violations');
    ipcMain.removeHandler('license-management:perform-audit');
    ipcMain.removeHandler('license-management:get-metrics');
    ipcMain.removeHandler('license-management:get-configuration');
    ipcMain.removeHandler('license-management:update-configuration');

    // Destroy manager
    this.licenseManager.destroy();

    this.removeAllListeners();
    console.log('License Management System destroyed');
  }
}

// Export types and classes
export * from './types';
export { LicenseManager } from './LicenseManager';