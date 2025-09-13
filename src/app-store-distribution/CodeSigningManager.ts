/**
 * Code Signing Certificate Management
 * Manages certificates for Mac App Store and Microsoft Store distribution
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import {
  CertificateInfo,
  CertificateType,
  Platform,
  MacAppStoreCredentials,
  MicrosoftStoreCredentials,
  SigningConfiguration,
  ValidationResult,
  ValidationType,
  ValidationStatus,
  DistributionEvent,
  EventType,
  EventStatus
} from './types';

export class CodeSigningManager extends EventEmitter {
  private certificates: Map<string, CertificateInfo> = new Map();
  private signingConfigs: Map<Platform, SigningConfiguration> = new Map();
  private certificatesPath: string;
  private keychainPath: string;

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.certificatesPath = path.join(userDataPath, 'certificates');
    this.keychainPath = path.join(this.certificatesPath, 'signing.keychain');
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.certificatesPath, { recursive: true });
      await this.loadCertificates();
      await this.validateCertificates();
      
      console.log('CodeSigningManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize CodeSigningManager:', error);
      throw error;
    }
  }

  // Certificate Management
  public async importCertificate(
    certificateData: Buffer | string,
    password: string,
    type: CertificateType,
    platform: Platform
  ): Promise<CertificateInfo> {
    try {
      const certificateInfo = await this.parseCertificate(certificateData, password, type);
      
      // Store certificate securely
      const certificateId = this.generateCertificateId(certificateInfo);
      const certificatePath = path.join(this.certificatesPath, `${certificateId}.p12`);
      
      if (typeof certificateData === 'string') {
        // Convert base64 to buffer if needed
        certificateData = Buffer.from(certificateData, 'base64');
      }
      
      await fs.writeFile(certificatePath, certificateData);
      
      certificateInfo.path = certificatePath;
      certificateInfo.password = password; // In production, encrypt this
      
      this.certificates.set(certificateId, certificateInfo);
      await this.saveCertificates();
      
      // Update platform signing configuration
      await this.updateSigningConfiguration(platform, certificateInfo);
      
      this.emitEvent({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: EventType.SIGNING_STARTED,
        platform,
        source: 'CodeSigningManager',
        status: EventStatus.SUCCESS,
        message: `Certificate imported: ${certificateInfo.commonName}`,
        metadata: {
          certificate_id: certificateId,
          certificate_type: type,
          expires_at: certificateInfo.validTo
        }
      });

      this.emit('certificate-imported', certificateInfo);
      return certificateInfo;
      
    } catch (error) {
      console.error('Failed to import certificate:', error);
      throw error;
    }
  }

  public async getCertificate(certificateId: string): Promise<CertificateInfo | null> {
    return this.certificates.get(certificateId) || null;
  }

  public getCertificatesByType(type: CertificateType): CertificateInfo[] {
    return Array.from(this.certificates.values()).filter(cert => cert.type === type);
  }

  public getCertificatesByPlatform(platform: Platform): CertificateInfo[] {
    const config = this.signingConfigs.get(platform);
    if (!config) return [];

    return Array.from(this.certificates.values()).filter(cert => {
      switch (platform) {
        case Platform.MAC_APP_STORE:
          return cert.type === CertificateType.APPLE_DEVELOPER || 
                 cert.type === CertificateType.APPLE_DISTRIBUTION ||
                 cert.type === CertificateType.APPLE_INSTALLER;
        case Platform.MICROSOFT_STORE:
          return cert.type === CertificateType.MICROSOFT_STORE ||
                 cert.type === CertificateType.MICROSOFT_AUTHENTICODE;
        default:
          return false;
      }
    });
  }

  // Platform-specific Signing
  public async signForMacAppStore(
    appPath: string,
    credentials: MacAppStoreCredentials
  ): Promise<ValidationResult[]> {
    try {
      const results: ValidationResult[] = [];
      
      // Validate signing certificate
      const distributionCert = await this.getCertificate(credentials.distributionCertificate.thumbprint);
      if (!distributionCert) {
        results.push({
          type: ValidationType.SIGNING,
          status: ValidationStatus.FAILED,
          message: 'Distribution certificate not found',
          suggestions: ['Import a valid Mac Developer or Mac App Distribution certificate']
        });
        return results;
      }

      // Sign with codesign
      const signingResult = await this.codesignApp(appPath, credentials, distributionCert);
      results.push(signingResult);

      if (signingResult.status === ValidationStatus.PASSED) {
        // Verify signing
        const verificationResult = await this.verifyMacSigning(appPath);
        results.push(verificationResult);

        if (credentials.notarizeCredentials && verificationResult.status === ValidationStatus.PASSED) {
          // Notarize the app
          const notarizeResult = await this.notarizeApp(appPath, credentials.notarizeCredentials);
          results.push(notarizeResult);
        }
      }

      return results;
      
    } catch (error) {
      console.error('Failed to sign for Mac App Store:', error);
      return [{
        type: ValidationType.SIGNING,
        status: ValidationStatus.FAILED,
        message: `Signing failed: ${error.message}`,
        suggestions: ['Check certificate validity and signing identity']
      }];
    }
  }

  public async signForMicrosoftStore(
    appPath: string,
    credentials: MicrosoftStoreCredentials
  ): Promise<ValidationResult[]> {
    try {
      const results: ValidationResult[] = [];
      
      // Validate signing certificate
      const signingCert = await this.getCertificate(credentials.certificateThumbprint);
      if (!signingCert) {
        results.push({
          type: ValidationType.SIGNING,
          status: ValidationStatus.FAILED,
          message: 'Signing certificate not found',
          suggestions: ['Import a valid Microsoft Store certificate']
        });
        return results;
      }

      // Sign with SignTool
      const signingResult = await this.signToolSign(appPath, credentials, signingCert);
      results.push(signingResult);

      if (signingResult.status === ValidationStatus.PASSED) {
        // Verify signing
        const verificationResult = await this.verifyWindowsSigning(appPath);
        results.push(verificationResult);
      }

      return results;
      
    } catch (error) {
      console.error('Failed to sign for Microsoft Store:', error);
      return [{
        type: ValidationType.SIGNING,
        status: ValidationStatus.FAILED,
        message: `Signing failed: ${error.message}`,
        suggestions: ['Check certificate validity and SignTool availability']
      }];
    }
  }

  // Certificate Validation
  public async validateCertificates(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const now = new Date();

    for (const [, certificate] of this.certificates) {
      // Check expiration
      if (certificate.validTo <= now) {
        results.push({
          type: ValidationType.SIGNING,
          status: ValidationStatus.FAILED,
          message: `Certificate expired: ${certificate.commonName}`,
          details: [{
            field: 'validTo',
            expected: 'Future date',
            actual: certificate.validTo.toISOString(),
            severity: 'critical',
            fix: 'Renew the certificate'
          }],
          suggestions: ['Renew the certificate before it expires']
        });
      } else if (certificate.validTo <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        // Warn if expiring within 30 days
        results.push({
          type: ValidationType.SIGNING,
          status: ValidationStatus.WARNING,
          message: `Certificate expiring soon: ${certificate.commonName}`,
          details: [{
            field: 'validTo',
            expected: 'Future date',
            actual: certificate.validTo.toISOString(),
            severity: 'warning',
            fix: 'Renew the certificate'
          }],
          suggestions: ['Renew the certificate to avoid signing failures']
        });
      }

      // Validate certificate file exists
      if (certificate.path) {
        try {
          await fs.access(certificate.path);
        } catch {
          results.push({
            type: ValidationType.SIGNING,
            status: ValidationStatus.FAILED,
            message: `Certificate file not found: ${certificate.path}`,
            suggestions: ['Re-import the certificate']
          });
        }
      }

      // Validate key usage
      if (!this.validateKeyUsage(certificate)) {
        results.push({
          type: ValidationType.SIGNING,
          status: ValidationStatus.WARNING,
          message: `Certificate may not be suitable for code signing: ${certificate.commonName}`,
          suggestions: ['Verify certificate is intended for code signing']
        });
      }
    }

    return results;
  }

  public async rotateCertificate(oldCertificateId: string, newCertificate: CertificateInfo): Promise<void> {
    try {
      const oldCert = this.certificates.get(oldCertificateId);
      if (!oldCert) {
        throw new Error('Old certificate not found');
      }

      // Import new certificate
      const newCertId = this.generateCertificateId(newCertificate);
      this.certificates.set(newCertId, newCertificate);

      // Update signing configurations
      for (const [platform, config] of this.signingConfigs) {
        if (config.certificate === oldCertificateId) {
          config.certificate = newCertId;
          this.signingConfigs.set(platform, config);
        }
      }

      // Remove old certificate after grace period
      setTimeout(() => {
        this.certificates.delete(oldCertificateId);
        if (oldCert.path) {
          fs.unlink(oldCert.path).catch(console.error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      await this.saveCertificates();
      this.emit('certificate-rotated', oldCertificateId, newCertId);
      
    } catch (error) {
      console.error('Failed to rotate certificate:', error);
      throw error;
    }
  }

  // Private Methods
  private async parseCertificate(
    certificateData: Buffer | string,
    password: string,
    type: CertificateType
  ): Promise<CertificateInfo> {
    // This is a simplified implementation
    // In production, use libraries like node-forge or call platform-specific tools
    
    const thumbprint = crypto.createHash('sha256')
      .update(certificateData instanceof Buffer ? certificateData : Buffer.from(certificateData, 'base64'))
      .digest('hex');

    return {
      thumbprint,
      commonName: this.extractCommonName(type),
      issuer: this.extractIssuer(type),
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      keyUsage: this.getDefaultKeyUsage(type),
      type
    };
  }

  private extractCommonName(type: CertificateType): string {
    switch (type) {
      case CertificateType.APPLE_DEVELOPER:
        return 'Mac Developer: Ghost Hunter Toolbox';
      case CertificateType.APPLE_DISTRIBUTION:
        return 'Mac App Distribution: Ghost Hunter Toolbox';
      case CertificateType.APPLE_INSTALLER:
        return 'Mac Installer Distribution: Ghost Hunter Toolbox';
      case CertificateType.MICROSOFT_STORE:
        return 'Ghost Hunter Toolbox Microsoft Store';
      case CertificateType.MICROSOFT_AUTHENTICODE:
        return 'Ghost Hunter Toolbox Code Signing';
      default:
        return 'Ghost Hunter Toolbox Certificate';
    }
  }

  private extractIssuer(type: CertificateType): string {
    switch (type) {
      case CertificateType.APPLE_DEVELOPER:
      case CertificateType.APPLE_DISTRIBUTION:
      case CertificateType.APPLE_INSTALLER:
        return 'Apple Inc.';
      case CertificateType.MICROSOFT_STORE:
      case CertificateType.MICROSOFT_AUTHENTICODE:
        return 'Microsoft Corporation';
      default:
        return 'Certificate Authority';
    }
  }

  private getDefaultKeyUsage(type: CertificateType): string[] {
    switch (type) {
      case CertificateType.APPLE_DEVELOPER:
      case CertificateType.APPLE_DISTRIBUTION:
      case CertificateType.APPLE_INSTALLER:
        return ['Digital Signature', 'Key Encipherment'];
      case CertificateType.MICROSOFT_STORE:
      case CertificateType.MICROSOFT_AUTHENTICODE:
        return ['Digital Signature', 'Code Signing'];
      default:
        return ['Digital Signature'];
    }
  }

  private generateCertificateId(certificate: CertificateInfo): string {
    return crypto.createHash('sha256')
      .update(`${certificate.thumbprint}-${certificate.commonName}`)
      .digest('hex')
      .substring(0, 16);
  }

  private async updateSigningConfiguration(platform: Platform, certificate: CertificateInfo): Promise<void> {
    const config: SigningConfiguration = {
      enabled: true,
      certificate: this.generateCertificateId(certificate),
      identity: certificate.commonName,
      hardenedRuntime: platform === Platform.MAC_APP_STORE,
      notarize: platform === Platform.MAC_APP_STORE,
      timestamp: true,
      requireSigningVerification: true
    };

    this.signingConfigs.set(platform, config);
    await this.saveSigningConfigurations();
  }

  private validateKeyUsage(certificate: CertificateInfo): boolean {
    const requiredUsages = ['Digital Signature'];
    return requiredUsages.every(usage => certificate.keyUsage.includes(usage));
  }

  // Platform-specific signing implementations
  private async codesignApp(
    appPath: string,
    credentials: MacAppStoreCredentials,
    ___certificate?: CertificateInfo
  ): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const args = [
        '--sign',
        credentials.signingIdentity,
        '--verbose',
        '--force',
        '--options', 'runtime',
        '--timestamp',
        '--preserve-metadata=entitlements'
      ];

      if (credentials.provisioningProfile) {
        args.push('--provisioning-profile', credentials.provisioningProfile);
      }

      args.push(appPath);

      const codesign = spawn('codesign', args);
      let output = '';
      let error = '';

      codesign.stdout.on('data', (data) => output += data.toString());
      codesign.stderr.on('data', (data) => error += data.toString());

      codesign.on('close', (code) => {
        if (code === 0) {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.PASSED,
            message: 'App successfully signed for Mac App Store',
            details: [{
              field: 'signature',
              expected: 'Valid signature',
              actual: 'Valid signature applied',
              severity: 'info'
            }]
          });
        } else {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.FAILED,
            message: `Codesign failed: ${error}`,
            suggestions: ['Check signing identity and certificate validity']
          });
        }
      });
    });
  }

  private async verifyMacSigning(appPath: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const codesign = spawn('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
      let output = '';
      let error = '';

      codesign.stdout.on('data', (data) => output += data.toString());
      codesign.stderr.on('data', (data) => error += data.toString());

      codesign.on('close', (code) => {
        if (code === 0) {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.PASSED,
            message: 'Signature verification successful',
            details: [{
              field: 'verification',
              expected: 'Valid signature',
              actual: 'Signature verified successfully',
              severity: 'info'
            }]
          });
        } else {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.FAILED,
            message: `Signature verification failed: ${error}`,
            suggestions: ['Re-sign the application with valid certificate']
          });
        }
      });
    });
  }

  private async notarizeApp(
    appPath: string,
    credentials: { appleId: string; password: string; teamId: string }
  ): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const xcrun = spawn('xcrun', [
        'notarytool',
        'submit',
        appPath,
        '--apple-id', credentials.appleId,
        '--password', credentials.password,
        '--team-id', credentials.teamId,
        '--wait'
      ]);

      let output = '';
      let error = '';

      xcrun.stdout.on('data', (data) => output += data.toString());
      xcrun.stderr.on('data', (data) => error += data.toString());

      xcrun.on('close', (code) => {
        if (code === 0) {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.PASSED,
            message: 'App successfully notarized',
            details: [{
              field: 'notarization',
              expected: 'Accepted by Apple',
              actual: 'Notarization successful',
              severity: 'info'
            }]
          });
        } else {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.FAILED,
            message: `Notarization failed: ${error}`,
            suggestions: ['Check Apple ID credentials and app compliance']
          });
        }
      });
    });
  }

  private async signToolSign(
    appPath: string,
    credentials: MicrosoftStoreCredentials,
    certificate: CertificateInfo
  ): Promise<ValidationResult> {
    return new Promise((resolve) => {
      if (!certificate.path) {
        resolve({
          type: ValidationType.SIGNING,
          status: ValidationStatus.FAILED,
          message: 'Certificate path not found',
          suggestions: ['Re-import the certificate']
        });
        return;
      }

      const signtool = spawn('signtool', [
        'sign',
        '/fd', 'SHA256',
        '/f', certificate.path,
        '/p', certificate.password || '',
        '/t', 'http://timestamp.digicert.com',
        appPath
      ]);

      let output = '';
      let error = '';

      signtool.stdout.on('data', (data) => output += data.toString());
      signtool.stderr.on('data', (data) => error += data.toString());

      signtool.on('close', (code) => {
        if (code === 0) {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.PASSED,
            message: 'App successfully signed for Microsoft Store',
            details: [{
              field: 'signature',
              expected: 'Valid signature',
              actual: 'Digital signature applied',
              severity: 'info'
            }]
          });
        } else {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.FAILED,
            message: `SignTool failed: ${error}`,
            suggestions: ['Check certificate validity and SignTool installation']
          });
        }
      });
    });
  }

  private async verifyWindowsSigning(appPath: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const signtool = spawn('signtool', ['verify', '/pa', appPath]);
      let output = '';
      let error = '';

      signtool.stdout.on('data', (data) => output += data.toString());
      signtool.stderr.on('data', (data) => error += data.toString());

      signtool.on('close', (code) => {
        if (code === 0) {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.PASSED,
            message: 'Signature verification successful',
            details: [{
              field: 'verification',
              expected: 'Valid signature',
              actual: 'Signature verified successfully',
              severity: 'info'
            }]
          });
        } else {
          resolve({
            type: ValidationType.SIGNING,
            status: ValidationStatus.FAILED,
            message: `Signature verification failed: ${error}`,
            suggestions: ['Re-sign the application with valid certificate']
          });
        }
      });
    });
  }

  // Persistence
  private async loadCertificates(): Promise<void> {
    try {
      const certificatesFile = path.join(this.certificatesPath, 'certificates.json');
      const data = await fs.readFile(certificatesFile, 'utf8');
      const certificatesData = JSON.parse(data);

      for (const [id, certData] of Object.entries(certificatesData)) {
        const cert = certData as Partial<CertificateInfo>;
        this.certificates.set(id, {
          ...(cert as CertificateInfo),
          validFrom: new Date(cert.validFrom as string | Date),
          validTo: new Date(cert.validTo as string | Date)
        });
      }
    } catch (error) {
      // No certificates file exists yet
    }
  }

  private async saveCertificates(): Promise<void> {
    try {
      const certificatesFile = path.join(this.certificatesPath, 'certificates.json');
      const certificatesData = Object.fromEntries(this.certificates);
      await fs.writeFile(certificatesFile, JSON.stringify(certificatesData, null, 2));
    } catch (error) {
      console.error('Failed to save certificates:', error);
    }
  }

  private async saveSigningConfigurations(): Promise<void> {
    try {
      const configFile = path.join(this.certificatesPath, 'signing-configs.json');
      const configData = Object.fromEntries(this.signingConfigs);
      await fs.writeFile(configFile, JSON.stringify(configData, null, 2));
    } catch (error) {
      console.error('Failed to save signing configurations:', error);
    }
  }

  private emitEvent(event: DistributionEvent): void {
    this.emit('distribution-event', event);
  }

  public getSigningConfiguration(platform: Platform): SigningConfiguration | null {
    return this.signingConfigs.get(platform) || null;
  }

  public getAllCertificates(): CertificateInfo[] {
    return Array.from(this.certificates.values());
  }

  public async removeCertificate(certificateId: string): Promise<boolean> {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) return false;

    // Remove certificate file
    if (certificate.path) {
      try {
        await fs.unlink(certificate.path);
      } catch (error) {
        console.warn('Failed to remove certificate file:', error);
      }
    }

    // Remove from memory
    this.certificates.delete(certificateId);

    // Update signing configurations
    for (const [platform, config] of this.signingConfigs) {
      if (config.certificate === certificateId) {
        config.enabled = false;
        this.signingConfigs.set(platform, config);
      }
    }

    await this.saveCertificates();
    await this.saveSigningConfigurations();

    this.emit('certificate-removed', certificateId);
    return true;
  }

  public destroy(): void {
    this.removeAllListeners();
    console.log('CodeSigningManager destroyed');
  }
}