/**
 * Native API Wrappers
 * Cross-platform hardware and system access
 */

import { app, dialog, systemPreferences, powerMonitor, screen, Notification } from 'electron';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { networkInterfaces, cpus, totalmem, freemem, uptime, hostname } from 'os';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { Platform, Paths } from '../utils/platform';

const execAsync = promisify(exec);

// Audio API wrapper
export const AudioAPI = {
  // Get available audio devices
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    // This would be implemented with WebRTC in renderer process
    return [];
  },
  
  // System volume control (platform-specific)
  async getSystemVolume(): Promise<number> {
    if (Platform.isWindows) {
      try {
        const { stdout } = await execAsync('wmic path Win32_SoundDevice get StatusInfo');
        // Parse Windows audio info
        return 100;
      } catch (error) {
        console.error('Failed to get system volume:', error);
        return 100;
      }
    } else if (Platform.isMac) {
      try {
        const { stdout } = await execAsync('osascript -e "output volume of (get volume settings)"');
        return parseInt(stdout.trim());
      } catch (error) {
        console.error('Failed to get system volume:', error);
        return 100;
      }
    }
    return 100;
  },
  
  async setSystemVolume(volume: number): Promise<void> {
    if (Platform.isWindows) {
      // Windows volume control via nircmd or PowerShell
      await execAsync(`powershell -Command "Add-Type -TypeDefinition @'
        using System.Runtime.InteropServices;
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
          int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
        }
        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDevice {
          int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
        }
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDeviceEnumerator {
          int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        }
        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
        public static class Audio {
          static IAudioEndpointVolume Vol() {
            var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
            IMMDevice dev = null;
            Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
            IAudioEndpointVolume epv = null;
            var epvid = typeof(IAudioEndpointVolume).GUID;
            Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
            return epv;
          }
          public static void SetVolume(float v) {
            Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(v, System.Guid.Empty));
          }
        }
      '@; [Audio]::SetVolume(${volume / 100})"`);
    } else if (Platform.isMac) {
      await execAsync(`osascript -e "set volume output volume ${volume}"`);
    }
  }
};

// Camera API wrapper
export const CameraAPI = {
  async getCameras(): Promise<MediaDeviceInfo[]> {
    // This would be implemented with WebRTC in renderer process
    return [];
  },
  
  async checkCameraPermission(): Promise<boolean> {
    if (Platform.isMac) {
      const status = systemPreferences.getMediaAccessStatus('camera');
      return status === 'granted';
    }
    // Windows doesn't require explicit permission
    return true;
  },
  
  async requestCameraPermission(): Promise<boolean> {
    if (Platform.isMac) {
      return await systemPreferences.askForMediaAccess('camera');
    }
    return true;
  }
};

// Microphone API wrapper
export const MicrophoneAPI = {
  async getMicrophones(): Promise<MediaDeviceInfo[]> {
    // This would be implemented with WebRTC in renderer process
    return [];
  },
  
  async checkMicrophonePermission(): Promise<boolean> {
    if (Platform.isMac) {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      return status === 'granted';
    }
    return true;
  },
  
  async requestMicrophonePermission(): Promise<boolean> {
    if (Platform.isMac) {
      return await systemPreferences.askForMediaAccess('microphone');
    }
    return true;
  }
};

// Serial Port API wrapper (for EMF detectors, etc.)
export const SerialAPI = {
  async getSerialPorts(): Promise<string[]> {
    if (Platform.isWindows) {
      try {
        const { stdout } = await execAsync('wmic path Win32_SerialPort get DeviceID');
        return stdout.split('\n')
          .map(line => line.trim())
          .filter(line => line && line !== 'DeviceID');
      } catch (error) {
        console.error('Failed to get serial ports:', error);
        return [];
      }
    } else if (Platform.isMac) {
      try {
        const { stdout } = await execAsync('ls /dev/tty.*');
        return stdout.split('\n').filter(Boolean);
      } catch (error) {
        console.error('Failed to get serial ports:', error);
        return [];
      }
    } else if (Platform.isLinux) {
      try {
        const { stdout } = await execAsync('ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null');
        return stdout.split('\n').filter(Boolean);
      } catch (error) {
        return [];
      }
    }
    return [];
  }
};

// Bluetooth API wrapper
export const BluetoothAPI = {
  async checkBluetoothStatus(): Promise<boolean> {
    if (Platform.isWindows) {
      try {
        const { stdout } = await execAsync('powershell -Command "Get-PnpDevice | Where-Object {$_.Class -eq \'Bluetooth\'} | Select-Object Status"');
        return stdout.includes('OK');
      } catch (error) {
        return false;
      }
    } else if (Platform.isMac) {
      try {
        const { stdout } = await execAsync('system_profiler SPBluetoothDataType');
        return stdout.includes('Bluetooth: On');
      } catch (error) {
        return false;
      }
    }
    return false;
  },
  
  async getBluetoothDevices(): Promise<any[]> {
    // Platform-specific Bluetooth device enumeration
    return [];
  }
};

// File System API wrapper
export const FileSystemAPI = {
  async selectDirectory(title?: string): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: title || 'Select Directory',
      properties: ['openDirectory', 'createDirectory']
    });
    
    return result.canceled ? null : result.filePaths[0];
  },
  
  async selectFile(options?: {
    title?: string;
    filters?: Electron.FileFilter[];
    multiSelections?: boolean;
  }): Promise<string[] | null> {
    const result = await dialog.showOpenDialog({
      title: options?.title || 'Select File',
      filters: options?.filters || [],
      properties: options?.multiSelections ? ['openFile', 'multiSelections'] : ['openFile']
    });
    
    return result.canceled ? null : result.filePaths;
  },
  
  async saveFile(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Electron.FileFilter[];
  }): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      title: options?.title || 'Save File',
      defaultPath: options?.defaultPath,
      filters: options?.filters || []
    });
    
    return result.canceled ? null : result.filePath;
  },
  
  async checkFileExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  },
  
  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  },
  
  async readTextFile(path: string): Promise<string> {
    return await readFile(path, 'utf-8');
  },
  
  async writeTextFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8');
  }
};

// System Info API wrapper
export const SystemAPI = {
  getSystemInfo(): {
    platform: string;
    version: string;
    architecture: string;
    cpus: any[];
    memory: { total: number; free: number; used: number };
    uptime: number;
    hostname: string;
  } {
    const totalMem = totalmem();
    const freeMem = freemem();
    
    return {
      platform: Platform.name,
      version: Platform.version,
      architecture: Platform.architecture,
      cpus: cpus(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem
      },
      uptime: uptime(),
      hostname: hostname()
    };
  },
  
  getNetworkInterfaces(): any {
    return networkInterfaces();
  },
  
  getDisplays(): Electron.Display[] {
    return screen.getAllDisplays();
  },
  
  getPrimaryDisplay(): Electron.Display {
    return screen.getPrimaryDisplay();
  }
};

// Power Management API wrapper
export const PowerAPI = {
  onBatteryPowerChange(callback: (onBattery: boolean) => void): void {
    powerMonitor.on('on-ac', () => callback(false));
    powerMonitor.on('on-battery', () => callback(true));
  },
  
  onSuspend(callback: () => void): void {
    powerMonitor.on('suspend', callback);
  },
  
  onResume(callback: () => void): void {
    powerMonitor.on('resume', callback);
  },
  
  preventSleep(): number {
    return powerMonitor.getSystemIdleTime();
  },
  
  allowSleep(id: number): void {
    // Implementation would use powerSaveBlocker
  }
};

// Notification API wrapper
export const NotificationAPI = {
  async showNotification(options: {
    title: string;
    body: string;
    icon?: string;
    sound?: boolean;
  }): Promise<void> {
    
    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon,
      silent: !options.sound
    });
    
    notification.show();
  },
  
  async showErrorDialog(title: string, content: string): Promise<void> {
    dialog.showErrorBox(title, content);
  },
  
  async showMessageDialog(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
    return await dialog.showMessageBox(options);
  }
};

// Export all APIs
export default {
  AudioAPI,
  CameraAPI,
  MicrophoneAPI,
  SerialAPI,
  BluetoothAPI,
  FileSystemAPI,
  SystemAPI,
  PowerAPI,
  NotificationAPI
};