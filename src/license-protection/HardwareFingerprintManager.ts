/**
 * Hardware Fingerprint Manager
 * Creates unique hardware fingerprints for license validation and anti-piracy measures
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as os from 'os';
import * as si from 'systeminformation';
import { machineId } from 'machine-id';
import {
  HardwareFingerprint,
  CPUInfo,
  SystemInfo,
  NetworkInfo,
  StorageInfo,
  DisplayInfo,
  BIOSInfo,
  CPUCache,
  NetworkInterface,
  DriveInfo,
  Display
} from './types';

export class HardwareFingerprintManager extends EventEmitter {
  private cached: HardwareFingerprint | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private initialized = false;

  constructor() {
    super();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('HardwareFingerprintManager already initialized');
      return;
    }

    try {
      console.log('Initializing HardwareFingerprintManager...');
      
      // Pre-warm cache by generating initial fingerprint
      await this.generateFingerprint(true);
      
      this.initialized = true;
      console.log('HardwareFingerprintManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize HardwareFingerprintManager:', error);
      throw error;
    }
  }

  /**
   * Generate complete hardware fingerprint
   */
  public async generateFingerprint(forceRefresh: boolean = false): Promise<HardwareFingerprint> {
    // Return cached version if still valid
    if (!forceRefresh && this.cached && this.cacheExpiry && new Date() < this.cacheExpiry) {
      this.cached.lastSeen = new Date();
      return this.cached;
    }

    try {
      console.log('Generating hardware fingerprint...');
      const startTime = Date.now();

      // Collect hardware information in parallel
      const [
        machineIdValue,
        cpuInfo,
        systemInfo,
        networkInfo,
        storageInfo,
        displayInfo,
        biosInfo
      ] = await Promise.all([
        this.getMachineId(),
        this.getCPUInfo(),
        this.getSystemInfo(),
        this.getNetworkInfo(),
        this.getStorageInfo(),
        this.getDisplayInfo(),
        this.getBIOSInfo()
      ]);

      // Generate composite fingerprint
      const fingerprintData = this.createFingerprintData({
        machineIdValue,
        cpuInfo,
        systemInfo,
        networkInfo,
        storageInfo,
        displayInfo,
        biosInfo
      });

      const fingerprint = this.hashFingerprint(fingerprintData);
      const confidence = this.calculateConfidence(fingerprintData);
      const generatedAt = new Date();

      const hardwareFingerprint: HardwareFingerprint = {
        id: crypto.randomUUID(),
        machineId: machineIdValue,
        cpuInfo,
        systemInfo,
        networkInfo,
        storageInfo,
        displayInfo,
        biosInfo,
        fingerprint,
        confidence,
        generatedAt,
        lastSeen: generatedAt
      };

      // Cache the result
      this.cached = hardwareFingerprint;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);

      const duration = Date.now() - startTime;
      console.log(`Hardware fingerprint generated in ${duration}ms`);
      
      this.emit('fingerprint-generated', hardwareFingerprint);
      return hardwareFingerprint;

    } catch (error) {
      console.error('Failed to generate hardware fingerprint:', error);
      throw new Error(`Hardware fingerprinting failed: ${error.message}`);
    }
  }

  /**
   * Get lightweight fingerprint for quick validation
   */
  public async getLightweightFingerprint(): Promise<string> {
    try {
      const [machineIdValue, cpuBrand, platform, arch] = await Promise.all([
        this.getMachineId(),
        si.cpu().then(cpu => cpu.brand),
        Promise.resolve(os.platform()),
        Promise.resolve(os.arch())
      ]);

      const quickData = `${machineIdValue}|${cpuBrand}|${platform}|${arch}`;
      return this.hashString(quickData);
    } catch (error) {
      console.error('Failed to generate lightweight fingerprint:', error);
      throw error;
    }
  }

  /**
   * Compare two fingerprints and return similarity score
   */
  public compareFingerprints(fp1: HardwareFingerprint, fp2: HardwareFingerprint): number {
    let score = 0;
    let maxScore = 0;

    // Machine ID comparison (highest weight)
    maxScore += 30;
    if (fp1.machineId === fp2.machineId) {
      score += 30;
    }

    // CPU comparison
    maxScore += 20;
    if (fp1.cpuInfo.manufacturer === fp2.cpuInfo.manufacturer &&
        fp1.cpuInfo.brand === fp2.cpuInfo.brand &&
        fp1.cpuInfo.family === fp2.cpuInfo.family) {
      score += 20;
    } else if (fp1.cpuInfo.brand === fp2.cpuInfo.brand) {
      score += 15;
    } else if (fp1.cpuInfo.manufacturer === fp2.cpuInfo.manufacturer) {
      score += 10;
    }

    // System comparison
    maxScore += 15;
    if (fp1.systemInfo.platform === fp2.systemInfo.platform &&
        fp1.systemInfo.arch === fp2.systemInfo.arch) {
      score += 15;
    } else if (fp1.systemInfo.platform === fp2.systemInfo.platform) {
      score += 10;
    }

    // Network comparison (MAC addresses)
    maxScore += 15;
    const fp1Macs = fp1.networkInfo.interfaces.map(iface => iface.mac);
    const fp2Macs = fp2.networkInfo.interfaces.map(iface => iface.mac);
    const commonMacs = fp1Macs.filter(mac => fp2Macs.includes(mac));
    if (commonMacs.length > 0) {
      score += Math.min(15, (commonMacs.length / Math.max(fp1Macs.length, fp2Macs.length)) * 15);
    }

    // Storage comparison
    maxScore += 10;
    const fp1Serials = fp1.storageInfo.drives.map(drive => drive.serial).filter(Boolean);
    const fp2Serials = fp2.storageInfo.drives.map(drive => drive.serial).filter(Boolean);
    const commonSerials = fp1Serials.filter(serial => fp2Serials.includes(serial));
    if (commonSerials.length > 0 && fp1Serials.length > 0 && fp2Serials.length > 0) {
      score += Math.min(10, (commonSerials.length / Math.max(fp1Serials.length, fp2Serials.length)) * 10);
    }

    // BIOS comparison
    maxScore += 10;
    if (fp1.biosInfo.vendor === fp2.biosInfo.vendor &&
        fp1.biosInfo.version === fp2.biosInfo.version) {
      score += 10;
    } else if (fp1.biosInfo.vendor === fp2.biosInfo.vendor) {
      score += 5;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Detect significant hardware changes
   */
  public detectHardwareChanges(previous: HardwareFingerprint, current: HardwareFingerprint): string[] {
    const changes: string[] = [];

    // Check critical components
    if (previous.machineId !== current.machineId) {
      changes.push('Machine ID changed');
    }

    if (previous.cpuInfo.brand !== current.cpuInfo.brand ||
        previous.cpuInfo.cores !== current.cpuInfo.cores) {
      changes.push('CPU changed');
    }

    if (previous.systemInfo.platform !== current.systemInfo.platform ||
        previous.systemInfo.arch !== current.systemInfo.arch) {
      changes.push('System platform changed');
    }

    // Check network interfaces
    const prevMacs = new Set(previous.networkInfo.interfaces.map(iface => iface.mac));
    const currMacs = new Set(current.networkInfo.interfaces.map(iface => iface.mac));
    
    const removedMacs = [...prevMacs].filter(mac => !currMacs.has(mac));
    const addedMacs = [...currMacs].filter(mac => !prevMacs.has(mac));

    if (removedMacs.length > 0) {
      changes.push(`Network interfaces removed: ${removedMacs.length}`);
    }
    if (addedMacs.length > 0) {
      changes.push(`Network interfaces added: ${addedMacs.length}`);
    }

    // Check storage changes
    const prevDrives = new Set(previous.storageInfo.drives.map(drive => drive.serial).filter(Boolean));
    const currDrives = new Set(current.storageInfo.drives.map(drive => drive.serial).filter(Boolean));

    const removedDrives = [...prevDrives].filter(serial => !currDrives.has(serial));
    const addedDrives = [...currDrives].filter(serial => !prevDrives.has(serial));

    if (removedDrives.length > 0) {
      changes.push(`Storage drives removed: ${removedDrives.length}`);
    }
    if (addedDrives.length > 0) {
      changes.push(`Storage drives added: ${addedDrives.length}`);
    }

    return changes;
  }

  // Private helper methods
  private async getMachineId(): Promise<string> {
    try {
      return await machineId();
    } catch (error) {
      console.warn('Failed to get machine ID, using fallback:', error);
      // Fallback to hostname + platform
      return this.hashString(`${os.hostname()}-${os.platform()}-${os.arch()}`);
    }
  }

  private async getCPUInfo(): Promise<CPUInfo> {
    const cpu = await si.cpu();
    const cpuCache = await si.cpuCache();

    return {
      manufacturer: cpu.manufacturer || 'Unknown',
      brand: cpu.brand || 'Unknown',
      family: cpu.family || 'Unknown',
      model: cpu.model || 'Unknown',
      stepping: cpu.stepping || 'Unknown',
      speed: cpu.speed || 0,
      cores: cpu.cores || 1,
      cache: {
        l1d: cpuCache.l1d,
        l1i: cpuCache.l1i,
        l2: cpuCache.l2,
        l3: cpuCache.l3
      },
      flags: cpu.flags || []
    };
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    const [osInfo, system] = await Promise.all([
      si.osInfo(),
      si.system()
    ]);

    return {
      platform: osInfo.platform || os.platform(),
      distro: osInfo.distro || 'Unknown',
      release: osInfo.release || os.release(),
      codename: osInfo.codename,
      kernel: osInfo.kernel || 'Unknown',
      arch: osInfo.arch || os.arch(),
      hostname: osInfo.hostname || os.hostname(),
      fqdn: osInfo.fqdn,
      serial: system.serial
    };
  }

  private async getNetworkInfo(): Promise<NetworkInfo> {
    const [interfaces, defaultRoute] = await Promise.all([
      si.networkInterfaces(),
      si.networkGatewayDefault()
    ]);

    const networkInterfaces: NetworkInterface[] = interfaces.map(iface => ({
      iface: iface.iface,
      mac: iface.mac || '',
      ip4: iface.ip4,
      ip6: iface.ip6,
      internal: iface.internal || false,
      virtual: iface.virtual || false,
      operstate: iface.operstate,
      type: iface.type,
      duplex: iface.duplex,
      mtu: iface.mtu,
      speed: iface.speed
    }));

    return {
      interfaces: networkInterfaces,
      defaultInterface: defaultRoute.iface,
      defaultGateway: defaultRoute.gateway
    };
  }

  private async getStorageInfo(): Promise<StorageInfo> {
    const [diskLayout, fsSize] = await Promise.all([
      si.diskLayout(),
      si.fsSize()
    ]);

    const drives: DriveInfo[] = diskLayout.map(disk => ({
      device: disk.device,
      type: disk.type,
      name: disk.name,
      vendor: disk.vendor,
      size: disk.size,
      physical: disk.physical,
      uuid: disk.uuid,
      label: disk.label,
      model: disk.model,
      serial: disk.serial,
      removable: disk.removable || false,
      protocol: disk.interfaceType
    }));

    const totalSize = fsSize.reduce((sum, fs) => sum + fs.size, 0);
    const usedSize = fsSize.reduce((sum, fs) => sum + fs.used, 0);
    const freeSize = totalSize - usedSize;

    return {
      drives,
      totalSize,
      usedSize,
      freeSize
    };
  }

  private async getDisplayInfo(): Promise<DisplayInfo> {
    try {
      const graphics = await si.graphics();
      const displays: Display[] = graphics.displays.map(display => ({
        vendor: display.vendor,
        model: display.model,
        main: display.main || false,
        builtin: display.builtin || false,
        connection: display.connection,
        sizeX: display.sizeX,
        sizeY: display.sizeY,
        pixelDepth: display.pixelDepth,
        resolutionX: display.resolutionX,
        resolutionY: display.resolutionY,
        currentResX: display.currentResX,
        currentResY: display.currentResY
      }));

      const mainDisplay = displays.find(d => d.main) || displays[0];
      
      return {
        displays,
        resolution: mainDisplay ? `${mainDisplay.resolutionX}x${mainDisplay.resolutionY}` : 'Unknown',
        pixelDepth: mainDisplay?.pixelDepth || 0,
        resolutionX: mainDisplay?.resolutionX || 0,
        resolutionY: mainDisplay?.resolutionY || 0
      };
    } catch (error) {
      console.warn('Failed to get display info:', error);
      return {
        displays: [],
        resolution: 'Unknown',
        pixelDepth: 0,
        resolutionX: 0,
        resolutionY: 0
      };
    }
  }

  private async getBIOSInfo(): Promise<BIOSInfo> {
    try {
      const bios = await si.bios();
      return {
        vendor: bios.vendor,
        version: bios.version,
        releaseDate: bios.releaseDate,
        revision: bios.revision
      };
    } catch (error) {
      console.warn('Failed to get BIOS info:', error);
      return {};
    }
  }

  private createFingerprintData(components: any): string {
    // Create a deterministic fingerprint from hardware components
    const criticalData = [
      components.machineIdValue,
      components.cpuInfo.manufacturer,
      components.cpuInfo.brand,
      components.cpuInfo.family,
      components.cpuInfo.cores,
      components.systemInfo.platform,
      components.systemInfo.arch,
      components.systemInfo.serial || '',
      components.biosInfo.vendor || '',
      components.biosInfo.version || '',
      // Include stable network interfaces (non-virtual, non-loopback)
      ...components.networkInfo.interfaces
        .filter((iface: NetworkInterface) => !iface.internal && !iface.virtual)
        .map((iface: NetworkInterface) => iface.mac)
        .sort(),
      // Include primary storage devices
      ...components.storageInfo.drives
        .filter((drive: DriveInfo) => !drive.removable && drive.serial)
        .map((drive: DriveInfo) => `${drive.vendor}-${drive.model}-${drive.serial}`)
        .sort()
    ];

    return criticalData.filter(Boolean).join('|');
  }

  private hashFingerprint(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  private hashString(data: string): string {
    return crypto.createHash('md5').update(data, 'utf8').digest('hex');
  }

  private calculateConfidence(fingerprintData: any): number {
    let confidence = 0;
    const maxConfidence = 100;

    // Machine ID (30 points)
    if (fingerprintData.machineIdValue) {
      confidence += 30;
    }

    // CPU info (20 points)
    if (fingerprintData.cpuInfo.brand && fingerprintData.cpuInfo.cores > 0) {
      confidence += 20;
    }

    // System info (15 points)
    if (fingerprintData.systemInfo.platform && fingerprintData.systemInfo.arch) {
      confidence += 15;
    }

    // Network interfaces (15 points)
    const stableInterfaces = fingerprintData.networkInfo.interfaces.filter(
      (iface: NetworkInterface) => !iface.internal && !iface.virtual && iface.mac
    );
    if (stableInterfaces.length > 0) {
      confidence += Math.min(15, stableInterfaces.length * 5);
    }

    // Storage (10 points)
    const permanentDrives = fingerprintData.storageInfo.drives.filter(
      (drive: DriveInfo) => !drive.removable && drive.serial
    );
    if (permanentDrives.length > 0) {
      confidence += 10;
    }

    // BIOS (10 points)
    if (fingerprintData.biosInfo.vendor && fingerprintData.biosInfo.version) {
      confidence += 10;
    }

    return Math.round((confidence / maxConfidence) * 100);
  }

  public getCachedFingerprint(): HardwareFingerprint | null {
    if (this.cached && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cached;
    }
    return null;
  }

  public clearCache(): void {
    this.cached = null;
    this.cacheExpiry = null;
    this.emit('cache-cleared');
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public destroy(): void {
    this.clearCache();
    this.removeAllListeners();
    this.initialized = false;
    console.log('HardwareFingerprintManager destroyed');
  }
}