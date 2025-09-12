import { app } from 'electron';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as aesjs from 'aes-js';
import * as keytar from 'keytar';
import {
  EncryptionKey,
  EncryptedData,
  EncryptionAlgorithm,
  KeyPurpose
} from './types';

export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  keySize?: number;
  compressionEnabled?: boolean;
  integrityCheck?: boolean;
}

export interface KeyDerivationOptions {
  salt?: Buffer;
  iterations?: number;
  keyLength?: number;
  digest?: string;
}

export class EncryptionManager extends EventEmitter {
  private keys: Map<string, EncryptionKey> = new Map();
  private keyCache: Map<string, Buffer> = new Map(); // In-memory key cache
  private keysPath: string;
  private masterKeyId: string;
  private keyRotationTimer: NodeJS.Timeout | null = null;
  private readonly keyRotationInterval = 24 * 60 * 60 * 1000; // 24 hours

  private readonly defaultOptions: EncryptionOptions = {
    algorithm: 'AES-256-GCM',
    keySize: 32, // 256 bits
    compressionEnabled: true,
    integrityCheck: true
  };

  private readonly keyDerivationDefaults: KeyDerivationOptions = {
    iterations: 100000,
    keyLength: 32,
    digest: 'sha256'
  };

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.keysPath = path.join(userDataPath, 'encryption-keys.json');
    this.masterKeyId = 'master-key';
  }

  public async initialize(): Promise<void> {
    try {
      await this.loadKeys();
      await this.initializeMasterKey();
      this.startKeyRotation();
      
      console.log('EncryptionManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize EncryptionManager:', error);
      throw error;
    }
  }

  public async encrypt(data: string | Buffer, options: EncryptionOptions = {}): Promise<EncryptedData> {
    try {
      const opts = { ...this.defaultOptions, ...options };
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

      // Compress if enabled
      let processedData = dataBuffer;
      if (opts.compressionEnabled && dataBuffer.length > 1024) { // Only compress if > 1KB
        processedData = await this.compressData(dataBuffer);
      }

      // Generate or get key
      const keyId = await this.getOrCreateKey('user-data', opts.algorithm!);
      const key = await this.getKeyData(keyId);
      
      if (!key) {
        throw new Error('Encryption key not found');
      }

      // Encrypt based on algorithm
      let encryptedResult: { data: Buffer; iv: Buffer; tag?: Buffer };
      
      switch (opts.algorithm) {
        case 'AES-256-GCM':
          encryptedResult = this.encryptAESGCM(processedData, key);
          break;
        case 'AES-256-CBC':
          encryptedResult = this.encryptAESCBC(processedData, key);
          break;
        case 'ChaCha20-Poly1305':
          encryptedResult = this.encryptChaCha20(processedData, key);
          break;
        default:
          throw new Error(`Unsupported encryption algorithm: ${opts.algorithm}`);
      }

      // Calculate integrity checksum
      const checksum = crypto.createHash('sha256')
        .update(encryptedResult.data)
        .update(encryptedResult.iv)
        .digest('hex');

      const encrypted: EncryptedData = {
        algorithm: opts.algorithm!,
        data: encryptedResult.data.toString('base64'),
        iv: encryptedResult.iv.toString('base64'),
        salt: crypto.randomBytes(16).toString('base64'),
        keyId,
        checksum,
        metadata: {
          compressed: opts.compressionEnabled,
          originalSize: dataBuffer.length,
          encryptedSize: encryptedResult.data.length,
          timestamp: new Date().toISOString()
        }
      };

      // Add authentication tag if available (GCM mode)
      if (encryptedResult.tag) {
        encrypted.metadata!.authTag = encryptedResult.tag.toString('base64');
      }

      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  public async decrypt(encryptedData: EncryptedData): Promise<Buffer> {
    try {
      // Get decryption key
      const key = await this.getKeyData(encryptedData.keyId || this.masterKeyId);
      if (!key) {
        throw new Error('Decryption key not found');
      }

      // Verify integrity
      const dataBuffer = Buffer.from(encryptedData.data, 'base64');
      const ivBuffer = Buffer.from(encryptedData.iv, 'base64');
      
      const expectedChecksum = crypto.createHash('sha256')
        .update(dataBuffer)
        .update(ivBuffer)
        .digest('hex');

      if (expectedChecksum !== encryptedData.checksum) {
        throw new Error('Data integrity check failed');
      }

      // Decrypt based on algorithm
      let decryptedData: Buffer;
      
      switch (encryptedData.algorithm) {
        case 'AES-256-GCM':
          const authTag = encryptedData.metadata?.authTag ? 
            Buffer.from(encryptedData.metadata.authTag, 'base64') : undefined;
          decryptedData = this.decryptAESGCM(dataBuffer, key, ivBuffer, authTag);
          break;
        case 'AES-256-CBC':
          decryptedData = this.decryptAESCBC(dataBuffer, key, ivBuffer);
          break;
        case 'ChaCha20-Poly1305':
          decryptedData = this.decryptChaCha20(dataBuffer, key, ivBuffer);
          break;
        default:
          throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
      }

      // Decompress if needed
      if (encryptedData.metadata?.compressed) {
        decryptedData = await this.decompressData(decryptedData);
      }

      return decryptedData;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  public async encryptFile(filePath: string, outputPath: string, options: EncryptionOptions = {}): Promise<EncryptedData> {
    try {
      const fileData = await fs.readFile(filePath);
      const encryptedData = await this.encrypt(fileData, options);
      
      // Save encrypted data to file
      await fs.writeFile(outputPath, JSON.stringify(encryptedData, null, 2));
      
      console.log(`File encrypted: ${filePath} -> ${outputPath}`);
      return encryptedData;
    } catch (error) {
      console.error('File encryption error:', error);
      throw error;
    }
  }

  public async decryptFile(encryptedFilePath: string, outputPath: string): Promise<void> {
    try {
      const encryptedDataJson = await fs.readFile(encryptedFilePath, 'utf8');
      const encryptedData: EncryptedData = JSON.parse(encryptedDataJson);
      
      const decryptedData = await this.decrypt(encryptedData);
      await fs.writeFile(outputPath, decryptedData);
      
      console.log(`File decrypted: ${encryptedFilePath} -> ${outputPath}`);
    } catch (error) {
      console.error('File decryption error:', error);
      throw error;
    }
  }

  public async generateKey(purpose: KeyPurpose, algorithm: EncryptionAlgorithm = 'AES-256-GCM'): Promise<string> {
    try {
      const keyId = crypto.randomUUID();
      const keySize = this.getKeySize(algorithm);
      const keyData = crypto.randomBytes(keySize);
      const salt = crypto.randomBytes(16);

      const encryptionKey: EncryptionKey = {
        id: keyId,
        algorithm,
        keyData: keyData.toString('base64'),
        salt: salt.toString('base64'),
        createdAt: new Date(),
        expiresAt: null, // Set based on policy
        purpose,
        metadata: {
          keySize,
          generated: true
        }
      };

      // Store key securely
      await this.storeKey(encryptionKey);
      
      this.emit('key-generated', keyId, purpose);
      console.log(`Generated ${algorithm} key for ${purpose}: ${keyId}`);
      
      return keyId;
    } catch (error) {
      console.error('Key generation error:', error);
      throw error;
    }
  }

  public async deriveKey(
    password: string, 
    purpose: KeyPurpose,
    options: KeyDerivationOptions = {}
  ): Promise<string> {
    try {
      const opts = { ...this.keyDerivationDefaults, ...options };
      const salt = opts.salt || crypto.randomBytes(16);
      
      const derivedKey = crypto.pbkdf2Sync(
        password,
        salt,
        opts.iterations!,
        opts.keyLength!,
        opts.digest!
      );

      const keyId = crypto.randomUUID();
      
      const encryptionKey: EncryptionKey = {
        id: keyId,
        algorithm: 'AES-256-GCM',
        keyData: derivedKey.toString('base64'),
        salt: salt.toString('base64'),
        createdAt: new Date(),
        expiresAt: null,
        purpose,
        metadata: {
          derived: true,
          iterations: opts.iterations,
          keyLength: opts.keyLength,
          digest: opts.digest
        }
      };

      await this.storeKey(encryptionKey);
      
      this.emit('key-derived', keyId, purpose);
      console.log(`Derived key for ${purpose}: ${keyId}`);
      
      return keyId;
    } catch (error) {
      console.error('Key derivation error:', error);
      throw error;
    }
  }

  public async rotateKey(keyId: string): Promise<string> {
    try {
      const oldKey = this.keys.get(keyId);
      if (!oldKey) {
        throw new Error('Key not found for rotation');
      }

      // Generate new key with same parameters
      const newKeyId = await this.generateKey(oldKey.purpose, oldKey.algorithm);
      
      // Mark old key as expired
      oldKey.expiresAt = new Date();
      oldKey.metadata = { ...oldKey.metadata, rotated: true, newKeyId };
      
      await this.saveKeys();
      
      this.emit('key-rotated', keyId, newKeyId);
      console.log(`Key rotated: ${keyId} -> ${newKeyId}`);
      
      return newKeyId;
    } catch (error) {
      console.error('Key rotation error:', error);
      throw error;
    }
  }

  public async getKeyInfo(keyId: string): Promise<{
    id: string;
    algorithm: EncryptionAlgorithm;
    purpose: KeyPurpose;
    createdAt: Date;
    expiresAt: Date | null;
    isExpired: boolean;
    metadata: Record<string, any>;
  } | null> {
    const key = this.keys.get(keyId);
    if (!key) {
      return null;
    }

    const isExpired = key.expiresAt ? new Date() > key.expiresAt : false;

    return {
      id: key.id,
      algorithm: key.algorithm,
      purpose: key.purpose,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      isExpired,
      metadata: key.metadata
    };
  }

  public async listKeys(): Promise<Array<{
    id: string;
    algorithm: EncryptionAlgorithm;
    purpose: KeyPurpose;
    createdAt: Date;
    expiresAt: Date | null;
    isExpired: boolean;
  }>> {
    const keyList = [];
    const now = new Date();

    for (const key of this.keys.values()) {
      keyList.push({
        id: key.id,
        algorithm: key.algorithm,
        purpose: key.purpose,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        isExpired: key.expiresAt ? now > key.expiresAt : false
      });
    }

    return keyList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async deleteKey(keyId: string): Promise<boolean> {
    try {
      const key = this.keys.get(keyId);
      if (!key) {
        return false;
      }

      // Remove from keytar
      await keytar.deletePassword('ghost-hunter-encryption', keyId);
      
      // Remove from memory
      this.keys.delete(keyId);
      this.keyCache.delete(keyId);
      
      await this.saveKeys();
      
      this.emit('key-deleted', keyId);
      console.log(`Key deleted: ${keyId}`);
      
      return true;
    } catch (error) {
      console.error('Key deletion error:', error);
      return false;
    }
  }

  private encryptAESGCM(data: Buffer, key: Buffer): { data: Buffer; iv: Buffer; tag: Buffer } {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipherGCM('aes-256-gcm', key);
    cipher.setAAD(Buffer.from('ghost-hunter-toolbox'));
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return { data: encrypted, iv, tag };
  }

  private decryptAESGCM(data: Buffer, key: Buffer, iv: Buffer, tag?: Buffer): Buffer {
    if (!tag) {
      throw new Error('Authentication tag required for GCM decryption');
    }
    
    const decipher = crypto.createDecipherGCM('aes-256-gcm', key);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from('ghost-hunter-toolbox'));
    
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private encryptAESCBC(data: Buffer, key: Buffer): { data: Buffer; iv: Buffer } {
    const iv = crypto.randomBytes(16); // 128-bit IV for CBC
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return { data: encrypted, iv };
  }

  private decryptAESCBC(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private encryptChaCha20(data: Buffer, key: Buffer): { data: Buffer; iv: Buffer } {
    // Using Node.js built-in ChaCha20-Poly1305
    const iv = crypto.randomBytes(12); // 96-bit nonce for ChaCha20
    const cipher = crypto.createCipher('chacha20-poly1305', key);
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return { data: encrypted, iv };
  }

  private decryptChaCha20(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    const decipher = crypto.createDecipher('chacha20-poly1305', key);
    
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  private getKeySize(algorithm: EncryptionAlgorithm): number {
    switch (algorithm) {
      case 'AES-256-GCM':
      case 'AES-256-CBC':
      case 'ChaCha20-Poly1305':
        return 32; // 256 bits
      case 'RSA-2048':
        return 256; // 2048 bits
      case 'RSA-4096':
        return 512; // 4096 bits
      default:
        return 32;
    }
  }

  private async getOrCreateKey(purpose: KeyPurpose, algorithm: EncryptionAlgorithm): Promise<string> {
    // Look for existing key with same purpose
    for (const [keyId, key] of this.keys) {
      if (key.purpose === purpose && key.algorithm === algorithm) {
        const isExpired = key.expiresAt ? new Date() > key.expiresAt : false;
        if (!isExpired) {
          return keyId;
        }
      }
    }

    // Create new key
    return await this.generateKey(purpose, algorithm);
  }

  private async getKeyData(keyId: string): Promise<Buffer | null> {
    // Check cache first
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    try {
      // Get from keytar
      const keyData = await keytar.getPassword('ghost-hunter-encryption', keyId);
      if (keyData) {
        const keyBuffer = Buffer.from(keyData, 'base64');
        this.keyCache.set(keyId, keyBuffer);
        return keyBuffer;
      }
    } catch (error) {
      console.error('Error retrieving key:', error);
    }

    return null;
  }

  private async storeKey(key: EncryptionKey): Promise<void> {
    // Store key data securely in keytar
    await keytar.setPassword('ghost-hunter-encryption', key.id, key.keyData);
    
    // Store key metadata (without actual key data)
    const keyMetadata = { ...key };
    keyMetadata.keyData = '[PROTECTED]';
    this.keys.set(key.id, keyMetadata as EncryptionKey);
    
    // Cache key data in memory
    this.keyCache.set(key.id, Buffer.from(key.keyData, 'base64'));
    
    await this.saveKeys();
  }

  private async loadKeys(): Promise<void> {
    try {
      await fs.access(this.keysPath);
      const keysData = await fs.readFile(this.keysPath, 'utf8');
      const keys = JSON.parse(keysData);
      
      for (const keyData of keys) {
        this.keys.set(keyData.id, {
          ...keyData,
          createdAt: new Date(keyData.createdAt),
          expiresAt: keyData.expiresAt ? new Date(keyData.expiresAt) : null
        });
      }
      
      console.log(`Loaded ${this.keys.size} encryption keys`);
    } catch (error) {
      console.log('No existing keys found, starting fresh');
    }
  }

  private async saveKeys(): Promise<void> {
    try {
      const keysData = Array.from(this.keys.values());
      await fs.writeFile(this.keysPath, JSON.stringify(keysData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save keys:', error);
    }
  }

  private async initializeMasterKey(): Promise<void> {
    try {
      // Check if master key exists
      const masterKey = await keytar.getPassword('ghost-hunter-encryption', this.masterKeyId);
      
      if (!masterKey) {
        console.log('Generating master encryption key...');
        await this.generateKey('user-data', 'AES-256-GCM');
      }
      
    } catch (error) {
      console.error('Master key initialization error:', error);
      throw error;
    }
  }

  private startKeyRotation(): void {
    // Check for key rotation every 24 hours
    this.keyRotationTimer = setInterval(async () => {
      try {
        await this.performScheduledKeyRotation();
      } catch (error) {
        console.error('Scheduled key rotation error:', error);
      }
    }, this.keyRotationInterval);
  }

  private async performScheduledKeyRotation(): Promise<void> {
    const now = new Date();
    const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 days

    for (const [keyId, key] of this.keys) {
      const keyAge = now.getTime() - key.createdAt.getTime();
      
      // Rotate keys older than 90 days
      if (keyAge > rotationThreshold && !key.expiresAt) {
        try {
          await this.rotateKey(keyId);
        } catch (error) {
          console.error(`Failed to rotate key ${keyId}:`, error);
        }
      }
    }
  }

  public destroy(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = null;
    }

    // Clear key cache
    this.keyCache.clear();
    
    this.removeAllListeners();
    console.log('EncryptionManager destroyed');
  }
}