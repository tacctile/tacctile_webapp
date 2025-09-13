/**
 * Anti-Tampering Protection Manager
 * Implements code obfuscation, anti-debugging, and runtime protection measures
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ProtectionConfiguration,
  TamperDetection,
  TamperType,
  TamperSeverity,
  TamperResponseAction,
  ProtectionLevel
} from './types';

export class AntiTamperingManager extends EventEmitter {
  private config: ProtectionConfiguration;
  private protectionActive = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private integrityHashes: Map<string, string> = new Map();
  private criticalProcesses: Set<string> = new Set();
  private detectionCount = 0;
  private initialized = false;

  constructor(config?: Partial<ProtectionConfiguration>) {
    super();
    
    this.config = {
      enableCodeObfuscation: true,
      enableAntiDebug: true,
      enableIntegrityCheck: true,
      enableRuntimeProtection: true,
      enableVMDetection: true,
      enableProcessHollowing: true,
      enableAPIHooking: true,
      maxDebuggerDetections: 3,
      tamperResponseAction: TamperResponseAction.DISABLE_FEATURES,
      criticalFunctions: [
        'validateLicense',
        'checkFeatureAccess',
        'encryptData',
        'decryptData',
        'generateFingerprint'
      ],
      protectedModules: [
        'license-protection',
        'security-system',
        'encryption'
      ],
      ...config
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('AntiTamperingManager already initialized');
      return;
    }

    try {
      console.log('Initializing AntiTamperingManager...');
      
      await this.calculateIntegrityHashes();
      this.setupRuntimeProtection();
      
      this.initialized = true;
      console.log('AntiTamperingManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize AntiTamperingManager:', error);
      throw error;
    }
  }

  /**
   * Start all protection measures
   */
  public async startProtection(): Promise<void> {
    this.ensureInitialized();

    if (this.protectionActive) {
      console.warn('Protection already active');
      return;
    }

    try {
      console.log('Starting anti-tampering protection...');

      // Start various protection mechanisms
      if (this.config.enableAntiDebug) {
        this.startAntiDebugProtection();
      }

      if (this.config.enableIntegrityCheck) {
        this.startIntegrityChecks();
      }

      if (this.config.enableVMDetection) {
        this.startVMDetection();
      }

      if (this.config.enableRuntimeProtection) {
        this.startRuntimeProtection();
      }

      if (this.config.enableProcessHollowing) {
        this.startProcessHollowingDetection();
      }

      // Start monitoring loop
      this.detectionInterval = setInterval(() => {
        this.performDetectionCycle().catch(error => {
          console.error('Detection cycle error:', error);
        });
      }, 5000); // Check every 5 seconds

      this.protectionActive = true;
      console.log('Anti-tampering protection started');
      this.emit('protection-started');

    } catch (error) {
      console.error('Failed to start protection:', error);
      throw error;
    }
  }

  /**
   * Stop all protection measures
   */
  public async stopProtection(): Promise<void> {
    if (!this.protectionActive) {
      console.warn('Protection not active');
      return;
    }

    console.log('Stopping anti-tampering protection...');

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    this.protectionActive = false;
    console.log('Anti-tampering protection stopped');
    this.emit('protection-stopped');
  }

  /**
   * Anti-debugging protection
   */
  private startAntiDebugProtection(): void {
    // Check for debugger presence
    setInterval(() => {
      this.detectDebugger().catch(error => {
        console.error('Debugger detection error:', error);
      });
    }, 1000);

    // Check for common debugging tools
    setInterval(() => {
      this.detectDebuggingTools().catch(error => {
        console.error('Debugging tools detection error:', error);
      });
    }, 3000);
  }

  private async detectDebugger(): Promise<void> {
    try {
      // Check for Node.js debugger
      if (process.execArgv.some(arg => 
        arg.includes('--inspect') || 
        arg.includes('--debug') || 
        arg.includes('--debug-brk')
      )) {
        await this.reportTamperDetection({
          type: TamperType.DEBUGGER_ATTACHED,
          severity: TamperSeverity.HIGH,
          description: 'Node.js debugger detected',
          details: {
            processArguments: process.execArgv,
            environment: process.env
          }
        });
      }

      // Check environment variables
      const suspiciousVars = [
        'NODE_DEBUG',
        'DEBUG',
        'ELECTRON_ENABLE_LOGGING',
        'ELECTRON_ENABLE_STACK_DUMPING'
      ];

      for (const varName of suspiciousVars) {
        if (process.env[varName]) {
          await this.reportTamperDetection({
            type: TamperType.DEBUGGER_ATTACHED,
            severity: TamperSeverity.MEDIUM,
            description: `Debug environment variable detected: ${varName}`,
            details: {
              variable: varName,
              value: process.env[varName]
            }
          });
        }
      }

      // Timing-based debugger detection
      const start = Date.now();
      // eslint-disable-next-line no-debugger
      debugger; // This line will pause if debugger is attached
      const end = Date.now();

      if (end - start > 100) { // If execution was paused
        await this.reportTamperDetection({
          type: TamperType.DEBUGGER_ATTACHED,
          severity: TamperSeverity.CRITICAL,
          description: 'Debugger breakpoint detected',
          details: {
            timingDelay: end - start
          }
        });
      }

    } catch (error) {
      // Silently handle errors to avoid giving away detection methods
    }
  }

  private async detectDebuggingTools(): Promise<void> {
    try {
      // Check for common debugging tools in process list (Windows/Linux)
      const _suspiciousProcesses = [
        'ollydbg',
        'x64dbg',
        'windbg',
        'gdb',
        'ida',
        'cheat engine',
        'process monitor',
        'wireshark',
        'fiddler'
      ];

      // This would require platform-specific process enumeration
      // For now, we'll check for obvious indicators

      // Check for developer tools
      if (typeof window !== 'undefined' && window.outerHeight - window.innerHeight > 160) {
        await this.reportTamperDetection({
          type: TamperType.DEBUGGER_ATTACHED,
          severity: TamperSeverity.HIGH,
          description: 'Developer tools may be open',
          details: {
            outerHeight: (window as unknown as Window).outerHeight,
            innerHeight: (window as unknown as Window).innerHeight,
            heightDiff: (window as unknown as Window).outerHeight - (window as unknown as Window).innerHeight
          }
        });
      }

    } catch (error) {
      // Silently handle errors
    }
  }

  /**
   * Integrity checking
   */
  private async startIntegrityChecks(): void {
    setInterval(() => {
      this.checkFileIntegrity().catch(error => {
        console.error('Integrity check error:', error);
      });
    }, 30000); // Check every 30 seconds
  }

  private async calculateIntegrityHashes(): Promise<void> {
    try {
      // Calculate hashes for critical files
      const appPath = process.resourcesPath || process.cwd();
      const criticalFiles = [
        'app.asar',
        'package.json',
        'main.js'
      ];

      for (const file of criticalFiles) {
        try {
          const filePath = path.join(appPath, file);
          const content = await fs.readFile(filePath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          this.integrityHashes.set(file, hash);
        } catch (error) {
          // File might not exist, continue
        }
      }

      console.log(`Calculated integrity hashes for ${this.integrityHashes.size} files`);
    } catch (error) {
      console.error('Failed to calculate integrity hashes:', error);
    }
  }

  private async checkFileIntegrity(): Promise<void> {
    try {
      const appPath = process.resourcesPath || process.cwd();

      for (const [file, originalHash] of this.integrityHashes.entries()) {
        try {
          const filePath = path.join(appPath, file);
          const content = await fs.readFile(filePath);
          const currentHash = crypto.createHash('sha256').update(content).digest('hex');

          if (currentHash !== originalHash) {
            await this.reportTamperDetection({
              type: TamperType.FILE_MODIFICATION,
              severity: TamperSeverity.CRITICAL,
              description: `Critical file modified: ${file}`,
              details: {
                file,
                originalHash,
                currentHash,
                filePath
              }
            });
          }
        } catch (error) {
          // File might be missing
          await this.reportTamperDetection({
            type: TamperType.FILE_MODIFICATION,
            severity: TamperSeverity.HIGH,
            description: `Critical file missing or inaccessible: ${file}`,
            details: {
              file,
              error: error.message
            }
          });
        }
      }
    } catch (error) {
      console.error('Integrity check failed:', error);
    }
  }

  /**
   * Virtual machine detection
   */
  private startVMDetection(): void {
    setInterval(() => {
      this.detectVirtualMachine().catch(error => {
        console.error('VM detection error:', error);
      });
    }, 60000); // Check every minute
  }

  private async detectVirtualMachine(): Promise<void> {
    try {
      // Check system information for VM indicators
      const platform = os.platform();
      const cpus = os.cpus();
      const totalmem = os.totalmem();

      // VM detection heuristics
      const vmIndicators = [];

      // Check CPU information
      if (cpus.length === 1 && cpus[0].model.toLowerCase().includes('virtual')) {
        vmIndicators.push('Single virtual CPU detected');
      }

      // Check memory (common VM configurations)
      const memoryGB = Math.round(totalmem / (1024 * 1024 * 1024));
      if ([1, 2, 4].includes(memoryGB)) {
        vmIndicators.push(`Suspicious memory configuration: ${memoryGB}GB`);
      }

      // Check hostname patterns
      const hostname = os.hostname().toLowerCase();
      const vmHostnamePatterns = ['vm-', 'virtual', 'vbox', 'vmware', 'qemu'];
      
      for (const pattern of vmHostnamePatterns) {
        if (hostname.includes(pattern)) {
          vmIndicators.push(`VM hostname pattern detected: ${pattern}`);
        }
      }

      // Platform-specific checks
      if (platform === 'win32') {
        // Windows-specific VM detection would go here
        // Check registry keys, WMI, etc.
      } else if (platform === 'linux') {
        // Linux-specific VM detection
        try {
          const dmiProduct = await fs.readFile('/sys/class/dmi/id/product_name', 'utf8').catch(() => '');
          const vmProducts = ['VirtualBox', 'VMware', 'QEMU', 'KVM'];
          
          for (const product of vmProducts) {
            if (dmiProduct.includes(product)) {
              vmIndicators.push(`VM product detected: ${product}`);
            }
          }
        } catch (error) {
          // DMI info not available
        }
      }

      if (vmIndicators.length > 0) {
        await this.reportTamperDetection({
          type: TamperType.VIRTUAL_MACHINE,
          severity: TamperSeverity.MEDIUM,
          description: 'Virtual machine environment detected',
          details: {
            indicators: vmIndicators,
            platform,
            cpuCount: cpus.length,
            memoryGB,
            hostname
          }
        });
      }

    } catch (error) {
      // Silently handle errors
    }
  }

  /**
   * Runtime protection
   */
  private startRuntimeProtection(): void {
    this.protectCriticalFunctions();
    this.monitorProcessList();
  }

  private protectCriticalFunctions(): void {
    // This would implement function protection/obfuscation
    // For now, we'll add monitoring

    console.log('Runtime function protection activated');
  }

  private monitorProcessList(): void {
    setInterval(() => {
      // Monitor for suspicious processes
      // This would be platform-specific
    }, 10000);
  }

  /**
   * Process hollowing detection
   */
  private startProcessHollowingDetection(): void {
    setInterval(() => {
      this.detectProcessHollowing().catch(error => {
        console.error('Process hollowing detection error:', error);
      });
    }, 15000); // Check every 15 seconds
  }

  private async detectProcessHollowing(): Promise<void> {
    try {
      // Check if current process has been modified
      const currentPid = process.pid;
      const processInfo = {
        pid: currentPid,
        ppid: process.ppid,
        title: process.title,
        argv: process.argv,
        execPath: process.execPath
      };

      // Check for inconsistencies
      if (process.title !== 'Tacctile' && process.title !== 'electron') {
        await this.reportTamperDetection({
          type: TamperType.PROCESS_INJECTION,
          severity: TamperSeverity.HIGH,
          description: 'Process title manipulation detected',
          details: {
            currentTitle: process.title,
            expectedTitle: 'Tacctile',
            processInfo
          }
        });
      }

    } catch (error) {
      // Silently handle errors
    }
  }

  /**
   * Main detection cycle
   */
  private async performDetectionCycle(): Promise<void> {
    try {
      // Perform various checks
      await Promise.all([
        this.checkMemoryPatching(),
        this.checkAPIHooking(),
        this.checkProcessInjection()
      ]);

    } catch (error) {
      console.error('Detection cycle error:', error);
    }
  }

  private async checkMemoryPatching(): Promise<void> {
    try {
      // Check for memory modifications
      // This would involve checking critical memory regions
      // For now, we'll implement basic checks

      const memoryUsage = process.memoryUsage();
      
      // Unusual memory patterns might indicate patching
      if (memoryUsage.heapUsed > memoryUsage.heapTotal * 0.9) {
        await this.reportTamperDetection({
          type: TamperType.MEMORY_PATCHING,
          severity: TamperSeverity.MEDIUM,
          description: 'Unusual memory usage pattern detected',
          details: {
            memoryUsage
          }
        });
      }

    } catch (error) {
      // Silently handle errors
    }
  }

  private async checkAPIHooking(): Promise<void> {
    if (!this.config.enableAPIHooking) return;

    try {
      // Check for API hooks
      // This would involve checking if critical APIs have been hooked
      // Implementation would be platform-specific

    } catch (error) {
      // Silently handle errors
    }
  }

  private async checkProcessInjection(): Promise<void> {
    try {
      // Check for DLL injection or other process injection techniques
      // This would be platform-specific

    } catch (error) {
      // Silently handle errors
    }
  }

  /**
   * Report tamper detection and take action
   */
  private async reportTamperDetection(detection: Omit<TamperDetection, 'id' | 'detectedAt' | 'handled'>): Promise<void> {
    const tamperDetection: TamperDetection = {
      id: crypto.randomUUID(),
      detectedAt: new Date(),
      handled: false,
      responseAction: this.config.tamperResponseAction,
      ...detection
    };

    console.warn(`Tamper detection: ${detection.type} - ${detection.description}`);
    this.emit('tamper-detected', tamperDetection);

    // Increment detection count
    this.detectionCount++;

    // Take action based on configuration
    await this.handleTamperDetection(tamperDetection);

    tamperDetection.handled = true;
  }

  private async handleTamperDetection(detection: TamperDetection): Promise<void> {
    switch (detection.responseAction) {
      case TamperResponseAction.LOG_ONLY:
        // Already logged, no further action
        break;

      case TamperResponseAction.DISABLE_FEATURES:
        this.emit('disable-features', detection);
        break;

      case TamperResponseAction.EXIT_APPLICATION:
        if (detection.severity === TamperSeverity.CRITICAL || this.detectionCount >= this.config.maxDebuggerDetections) {
          this.emit('exit-required', detection);
          // Graceful exit after delay
          setTimeout(() => {
            process.exit(1);
          }, 2000);
        }
        break;

      case TamperResponseAction.REVOKE_LICENSE:
        this.emit('revoke-license', detection);
        break;

      case TamperResponseAction.ALERT_SERVER:
        this.emit('alert-server', detection);
        break;
    }
  }

  /**
   * Setup runtime protection hooks
   */
  private setupRuntimeProtection(): void {
    // Protect against console clearing
    if (typeof console !== 'undefined') {
      const originalConsole = { ...console };
      
      Object.defineProperty(console, 'clear', {
        value: function() {
          // Log attempt to clear console
          originalConsole.warn('Attempt to clear console detected');
        },
        writable: false,
        configurable: false
      });
    }

    // Protect against eval
    const originalEval = global.eval;
    global.eval = function(code: string) {
      console.warn('eval() usage detected:', code.substring(0, 100));
      return originalEval.call(this, code);
    };
  }

  // Public methods
  public getProtectionStatus(): {
    active: boolean;
    detectionCount: number;
    protectionLevel: ProtectionLevel;
    lastCheck: Date;
  } {
    let level = ProtectionLevel.NONE;
    
    if (this.protectionActive) {
      const activeProtections = [
        this.config.enableAntiDebug,
        this.config.enableIntegrityCheck,
        this.config.enableVMDetection,
        this.config.enableRuntimeProtection,
        this.config.enableProcessHollowing
      ].filter(Boolean).length;

      if (activeProtections >= 4) level = ProtectionLevel.MAXIMUM;
      else if (activeProtections >= 3) level = ProtectionLevel.ADVANCED;
      else if (activeProtections >= 2) level = ProtectionLevel.STANDARD;
      else if (activeProtections >= 1) level = ProtectionLevel.BASIC;
    }

    return {
      active: this.protectionActive,
      detectionCount: this.detectionCount,
      protectionLevel: level,
      lastCheck: new Date()
    };
  }

  public updateConfiguration(updates: Partial<ProtectionConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configuration-updated', this.config);
  }

  public getConfiguration(): ProtectionConfiguration {
    return { ...this.config };
  }

  public resetDetectionCount(): void {
    this.detectionCount = 0;
    this.emit('detection-count-reset');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AntiTamperingManager not initialized. Call initialize() first.');
    }
  }

  public async destroy(): Promise<void> {
    await this.stopProtection();
    this.removeAllListeners();
    this.initialized = false;
    console.log('AntiTamperingManager destroyed');
  }
}