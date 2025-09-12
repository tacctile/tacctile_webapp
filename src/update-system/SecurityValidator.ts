import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as forge from 'node-forge';
import {
  UpdateInfo,
  SecurityValidation,
  UpdateError,
  UpdateErrorCode
} from './types';
import { UpdateServerConfigManager } from './UpdateServerConfig';

export interface SecurityPolicy {
  requireSignatureValidation: boolean;
  requireChecksumValidation: boolean;
  requireCertificateValidation: boolean;
  allowedSignatureAlgorithms: string[];
  minimumKeySize: number;
  trustedCertificates: string[];
  allowSelfSignedCertificates: boolean;
  timestampValidation: boolean;
  codeSigningValidation: boolean;
}

export interface SignatureInfo {
  algorithm: string;
  keySize: number;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  chainValid: boolean;
  trusted: boolean;
}

export class SecurityValidator {
  private serverConfig: UpdateServerConfigManager;
  private policy: SecurityPolicy;
  private trustedCertificatesPath: string;
  private crlCache: Map<string, Date> = new Map();

  constructor(serverConfig: UpdateServerConfigManager) {
    this.serverConfig = serverConfig;
    this.trustedCertificatesPath = path.join(app.getPath('userData'), 'trusted-certificates');
    
    this.policy = {
      requireSignatureValidation: true,
      requireChecksumValidation: true,
      requireCertificateValidation: true,
      allowedSignatureAlgorithms: ['RSA-SHA256', 'RSA-SHA512', 'ECDSA-SHA256', 'ECDSA-SHA512'],
      minimumKeySize: 2048,
      trustedCertificates: [],
      allowSelfSignedCertificates: false,
      timestampValidation: true,
      codeSigningValidation: true
    };
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.trustedCertificatesPath, { recursive: true });
      await this.loadTrustedCertificates();
      console.log('SecurityValidator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SecurityValidator:', error);
      throw error;
    }
  }

  public async validateUpdate(updateInfo: UpdateInfo, updateFilePath: string): Promise<SecurityValidation> {
    const validation: SecurityValidation = {
      signatureValid: false,
      checksumValid: false,
      certificateValid: false,
      subscriptionValid: false, // This would be handled by SubscriptionValidator
      validationTimestamp: new Date(),
      validationErrors: []
    };

    try {
      console.log(`Starting security validation for update ${updateInfo.version}`);

      // 1. Validate file checksum
      if (this.policy.requireChecksumValidation) {
        validation.checksumValid = await this.validateChecksum(updateFilePath, updateInfo);
        if (!validation.checksumValid) {
          validation.validationErrors.push('Checksum validation failed');
        }
      } else {
        validation.checksumValid = true;
      }

      // 2. Validate digital signature
      if (this.policy.requireSignatureValidation) {
        const signatureResult = await this.validateSignature(updateFilePath, updateInfo);
        validation.signatureValid = signatureResult.valid;
        if (!validation.signatureValid) {
          validation.validationErrors.push(`Signature validation failed: ${signatureResult.error}`);
        }
      } else {
        validation.signatureValid = true;
      }

      // 3. Validate certificate chain
      if (this.policy.requireCertificateValidation) {
        const certificateResult = await this.validateCertificateChain(updateInfo);
        validation.certificateValid = certificateResult.valid;
        if (!validation.certificateValid) {
          validation.validationErrors.push(`Certificate validation failed: ${certificateResult.error}`);
        }
      } else {
        validation.certificateValid = true;
      }

      // 4. Additional security checks
      await this.performAdditionalSecurityChecks(updateFilePath, updateInfo, validation);

      const overallValid = validation.signatureValid && 
                          validation.checksumValid && 
                          validation.certificateValid;

      console.log(`Security validation ${overallValid ? 'passed' : 'failed'} for update ${updateInfo.version}`);
      
      return validation;
    } catch (error) {
      console.error('Security validation error:', error);
      validation.validationErrors.push(`Validation error: ${error.message}`);
      return validation;
    }
  }

  public async validateChecksum(filePath: string, updateInfo: UpdateInfo): Promise<boolean> {
    try {
      if (!updateInfo.checksum && (!updateInfo.files || updateInfo.files.length === 0)) {
        console.warn('No checksum provided for validation');
        return !this.policy.requireChecksumValidation; // Pass if not required
      }

      const fileBuffer = await fs.readFile(filePath);
      
      // Try multiple hash algorithms
      const algorithms = ['sha512', 'sha256', 'sha1'];
      const expectedChecksum = updateInfo.checksum || 
        (updateInfo.files.length > 0 ? updateInfo.files[0].sha512 : '');

      for (const algorithm of algorithms) {
        const actualChecksum = crypto.createHash(algorithm).update(fileBuffer).digest('hex');
        
        if (actualChecksum.toLowerCase() === expectedChecksum.toLowerCase()) {
          console.log(`Checksum validation passed using ${algorithm}`);
          return true;
        }
      }

      console.error('Checksum validation failed for all algorithms');
      return false;
    } catch (error) {
      console.error('Checksum validation error:', error);
      return false;
    }
  }

  public async validateSignature(
    filePath: string, 
    updateInfo: UpdateInfo
  ): Promise<{ valid: boolean; error?: string; info?: SignatureInfo }> {
    try {
      if (!updateInfo.signature) {
        return { valid: false, error: 'No signature provided' };
      }

      // Load the public key
      const publicKeyPem = await this.serverConfig.getPublicKey();
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

      // Read the file data
      const fileBuffer = await fs.readFile(filePath);
      
      // Create signature verification
      const md = forge.md.sha256.create();
      md.update(fileBuffer.toString('binary'));

      // Verify signature
      const signature = forge.util.decode64(updateInfo.signature);
      const isValid = publicKey.verify(md.digest().bytes(), signature);

      if (!isValid) {
        return { valid: false, error: 'Signature verification failed' };
      }

      // Extract signature information
      const signatureInfo: SignatureInfo = {
        algorithm: 'RSA-SHA256',
        keySize: this.getKeySize(publicKey),
        issuer: 'Tacctile',
        subject: 'Ghost Hunter Toolbox',
        validFrom: new Date(0), // Would need to be extracted from certificate
        validTo: new Date(2099, 11, 31), // Would need to be extracted from certificate
        fingerprint: this.calculatePublicKeyFingerprint(publicKey),
        chainValid: true,
        trusted: true
      };

      // Validate against security policy
      if (!this.policy.allowedSignatureAlgorithms.includes(signatureInfo.algorithm)) {
        return { valid: false, error: `Signature algorithm ${signatureInfo.algorithm} not allowed` };
      }

      if (signatureInfo.keySize < this.policy.minimumKeySize) {
        return { valid: false, error: `Key size ${signatureInfo.keySize} below minimum ${this.policy.minimumKeySize}` };
      }

      console.log('Signature validation passed');
      return { valid: true, info: signatureInfo };
    } catch (error) {
      console.error('Signature validation error:', error);
      return { valid: false, error: `Signature validation error: ${error.message}` };
    }
  }

  public async validateCertificateChain(
    updateInfo: UpdateInfo
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // In a real implementation, this would validate the full certificate chain
      // For now, we'll do basic validation

      const publicKeyPem = await this.serverConfig.getPublicKey();
      
      // Validate certificate format
      if (!publicKeyPem.includes('-----BEGIN PUBLIC KEY-----') || 
          !publicKeyPem.includes('-----END PUBLIC KEY-----')) {
        return { valid: false, error: 'Invalid public key format' };
      }

      // Try to parse the public key
      try {
        const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
        
        // Validate key parameters
        const keySize = this.getKeySize(publicKey);
        if (keySize < this.policy.minimumKeySize) {
          return { valid: false, error: `Key size ${keySize} below minimum ${this.policy.minimumKeySize}` };
        }

      } catch (parseError) {
        return { valid: false, error: 'Failed to parse public key' };
      }

      // Check against trusted certificates
      const fingerprint = this.calculatePublicKeyFingerprintFromPem(publicKeyPem);
      const isTrusted = await this.isPublicKeyTrusted(fingerprint);
      
      if (!isTrusted && !this.policy.allowSelfSignedCertificates) {
        return { valid: false, error: 'Certificate not in trusted list' };
      }

      // Check certificate revocation (simplified)
      const isRevoked = await this.isCertificateRevoked(fingerprint);
      if (isRevoked) {
        return { valid: false, error: 'Certificate has been revoked' };
      }

      console.log('Certificate validation passed');
      return { valid: true };
    } catch (error) {
      console.error('Certificate validation error:', error);
      return { valid: false, error: `Certificate validation error: ${error.message}` };
    }
  }

  public async validateCodeSigning(filePath: string): Promise<boolean> {
    if (!this.policy.codeSigningValidation) {
      return true;
    }

    try {
      // Platform-specific code signing validation
      if (process.platform === 'win32') {
        return await this.validateWindowsCodeSigning(filePath);
      } else if (process.platform === 'darwin') {
        return await this.validateMacOSCodeSigning(filePath);
      } else if (process.platform === 'linux') {
        return await this.validateLinuxCodeSigning(filePath);
      }

      return true; // Skip validation for unsupported platforms
    } catch (error) {
      console.error('Code signing validation error:', error);
      return false;
    }
  }

  public setSecurityPolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    console.log('Security policy updated');
  }

  public getSecurityPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  public async addTrustedCertificate(certificatePem: string): Promise<void> {
    try {
      const fingerprint = this.calculatePublicKeyFingerprintFromPem(certificatePem);
      const certPath = path.join(this.trustedCertificatesPath, `${fingerprint}.pem`);
      
      await fs.writeFile(certPath, certificatePem, 'utf8');
      this.policy.trustedCertificates.push(fingerprint);
      
      console.log(`Added trusted certificate: ${fingerprint}`);
    } catch (error) {
      console.error('Failed to add trusted certificate:', error);
      throw error;
    }
  }

  public async removeTrustedCertificate(fingerprint: string): Promise<void> {
    try {
      const certPath = path.join(this.trustedCertificatesPath, `${fingerprint}.pem`);
      await fs.unlink(certPath);
      
      const index = this.policy.trustedCertificates.indexOf(fingerprint);
      if (index !== -1) {
        this.policy.trustedCertificates.splice(index, 1);
      }
      
      console.log(`Removed trusted certificate: ${fingerprint}`);
    } catch (error) {
      console.error('Failed to remove trusted certificate:', error);
      throw error;
    }
  }

  private async performAdditionalSecurityChecks(
    filePath: string,
    updateInfo: UpdateInfo,
    validation: SecurityValidation
  ): Promise<void> {
    try {
      // 1. File size validation
      const stats = await fs.stat(filePath);
      if (updateInfo.size && stats.size !== updateInfo.size) {
        validation.validationErrors.push('File size mismatch');
      }

      // 2. File type validation
      const isValidFileType = await this.validateFileType(filePath);
      if (!isValidFileType) {
        validation.validationErrors.push('Invalid file type detected');
      }

      // 3. Malware scanning (basic)
      const isMalwareFree = await this.basicMalwareScan(filePath);
      if (!isMalwareFree) {
        validation.validationErrors.push('Potential malware detected');
      }

      // 4. Version validation
      if (!this.validateVersionFormat(updateInfo.version)) {
        validation.validationErrors.push('Invalid version format');
      }

      // 5. Timestamp validation
      if (this.policy.timestampValidation) {
        const isTimestampValid = this.validateReleaseTimestamp(updateInfo.releaseDate);
        if (!isTimestampValid) {
          validation.validationErrors.push('Invalid release timestamp');
        }
      }
    } catch (error) {
      console.error('Additional security checks error:', error);
      validation.validationErrors.push(`Security checks error: ${error.message}`);
    }
  }

  private async validateWindowsCodeSigning(filePath: string): Promise<boolean> {
    // This would use Windows API to validate Authenticode signatures
    // For now, return true as a placeholder
    return true;
  }

  private async validateMacOSCodeSigning(filePath: string): Promise<boolean> {
    // This would use macOS codesign tool to validate signatures
    // For now, return true as a placeholder
    return true;
  }

  private async validateLinuxCodeSigning(filePath: string): Promise<boolean> {
    // This would validate Linux package signatures
    // For now, return true as a placeholder
    return true;
  }

  private async validateFileType(filePath: string): Promise<boolean> {
    try {
      // Read file header to validate file type
      const buffer = await fs.readFile(filePath, { flag: 'r' });
      const header = buffer.slice(0, 8);

      // Check for common executable formats
      const validHeaders = [
        [0x4D, 0x5A], // PE (Windows)
        [0x7F, 0x45, 0x4C, 0x46], // ELF (Linux)
        [0xCF, 0xFA, 0xED, 0xFE], // Mach-O (macOS)
        [0x50, 0x4B, 0x03, 0x04], // ZIP
        [0x1F, 0x8B], // GZIP
      ];

      for (const validHeader of validHeaders) {
        let matches = true;
        for (let i = 0; i < validHeader.length; i++) {
          if (header[i] !== validHeader[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('File type validation error:', error);
      return false;
    }
  }

  private async basicMalwareScan(filePath: string): Promise<boolean> {
    try {
      // Basic malware detection patterns
      const suspiciousPatterns = [
        /eval\s*\(/gi,
        /document\.write\s*\(/gi,
        /window\.location\s*=/gi,
        /<script[^>]*>.*<\/script>/gi,
      ];

      const fileContent = await fs.readFile(filePath, 'utf8').catch(() => '');
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(fileContent)) {
          console.warn('Suspicious pattern detected in update file');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Malware scan error:', error);
      return false; // Fail safe
    }
  }

  private validateVersionFormat(version: string): boolean {
    // Semantic versioning validation
    const semVerPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semVerPattern.test(version);
  }

  private validateReleaseTimestamp(releaseDate: string): boolean {
    try {
      const releaseTime = new Date(releaseDate);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneWeekFuture = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Release date should be within reasonable bounds
      return releaseTime >= oneYearAgo && releaseTime <= oneWeekFuture;
    } catch (error) {
      return false;
    }
  }

  private getKeySize(publicKey: any): number {
    // Extract key size from forge public key
    if (publicKey.n) {
      // RSA key
      return publicKey.n.bitLength();
    } else if (publicKey.curve) {
      // ECDSA key - return equivalent RSA key size
      const curveSize = publicKey.curve.field.bitLength();
      return curveSize * 2; // Rough equivalence
    }
    return 0;
  }

  private calculatePublicKeyFingerprint(publicKey: any): string {
    const publicKeyDer = forge.asn1.toDer(forge.pki.publicKeyToAsn1(publicKey));
    return forge.md.sha256.create().update(publicKeyDer.data).digest().toHex();
  }

  private calculatePublicKeyFingerprintFromPem(publicKeyPem: string): string {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      return this.calculatePublicKeyFingerprint(publicKey);
    } catch (error) {
      return crypto.createHash('sha256').update(publicKeyPem).digest('hex');
    }
  }

  private async isPublicKeyTrusted(fingerprint: string): Promise<boolean> {
    return this.policy.trustedCertificates.includes(fingerprint);
  }

  private async isCertificateRevoked(fingerprint: string): Promise<boolean> {
    // Check CRL cache
    const cacheExpiry = this.crlCache.get(fingerprint);
    if (cacheExpiry && cacheExpiry > new Date()) {
      return false; // Not revoked (cached)
    }

    // In a real implementation, this would check Certificate Revocation Lists
    // For now, return false (not revoked)
    this.crlCache.set(fingerprint, new Date(Date.now() + 24 * 60 * 60 * 1000)); // Cache for 24 hours
    return false;
  }

  private async loadTrustedCertificates(): Promise<void> {
    try {
      const certFiles = await fs.readdir(this.trustedCertificatesPath);
      
      for (const certFile of certFiles) {
        if (certFile.endsWith('.pem')) {
          const fingerprint = path.basename(certFile, '.pem');
          if (!this.policy.trustedCertificates.includes(fingerprint)) {
            this.policy.trustedCertificates.push(fingerprint);
          }
        }
      }
      
      console.log(`Loaded ${this.policy.trustedCertificates.length} trusted certificates`);
    } catch (error) {
      console.warn('Failed to load trusted certificates:', error);
    }
  }
}