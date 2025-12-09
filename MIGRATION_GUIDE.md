# Tacctile Desktop → WebApp Migration Guide

Complete guide for migrating from Electron desktop application to Vite + React webapp.

## 📊 Migration Overview

| Component | Desktop (Electron) | WebApp (Browser) | Status |
|-----------|-------------------|------------------|--------|
| **React Components** | ✅ Renderer Process | ✅ Browser | ✅ Direct Copy |
| **Storage** | electron-store | IndexedDB (idb) | ✅ Service Created |
| **File System** | Node.js fs | File System Access API | ✅ Service Created |
| **Video Processing** | Native FFmpeg | ffmpeg.wasm | ✅ Service Created |
| **Audio Processing** | node-web-audio-api | Web Audio API | ✅ Service Created |
| **IPC Communication** | ipcMain/ipcRenderer | ❌ Removed | ✅ Not Needed |
| **Native Modules** | keytar, serialport | Web APIs | ⚠️ Limited Support |

## 🔧 Step-by-Step Migration

### 1. Component Migration

#### ✅ No Changes Needed
Most React components work as-is:
- Layout components (ActivityBar, SidePanel, etc.)
- Dashboard components
- Blueprint editor
- Visualization components

#### ⚠️ Minor Changes Required
Components that use Electron APIs need updates:

**Before (Electron):**
```typescript
// Using Electron IPC
const result = await window.desktopAPI.investigation.load(id);
```

**After (Browser):**
```typescript
// Using Storage Service
import { storageService } from '@/services/storage/StorageService';
const result = await storageService.getInvestigation(id);
```

### 2. Storage Migration

#### Replace electron-store with StorageService

**Before:**
```typescript
import Store from 'electron-store';

const store = new Store({
  schema: {
    investigations: { type: 'object' },
    settings: { type: 'object' }
  }
});

// Get/Set
const value = store.get('settings.theme');
store.set('settings.theme', 'dark');
```

**After:**
```typescript
import { storageService } from '@/services/storage/StorageService';

// Get/Set (now async)
const value = await storageService.get('settings.theme');
await storageService.set('settings.theme', 'dark');

// Structured data
await storageService.saveInvestigation(investigation);
const investigation = await storageService.getInvestigation(id);
```

#### Migration Script Example

```typescript
// migrate-storage.ts
import { storageService } from '@/services/storage/StorageService';

async function migrateFromElectronStore(oldData: any) {
  // Import old data
  if (oldData.investigations) {
    for (const [id, investigation] of Object.entries(oldData.investigations)) {
      await storageService.saveInvestigation({
        id,
        ...investigation as any
      });
    }
  }

  if (oldData.settings) {
    for (const [key, value] of Object.entries(oldData.settings)) {
      await storageService.set(`settings.${key}`, value);
    }
  }

  console.log('Migration complete!');
}

// Usage:
// 1. Export data from desktop app
// 2. Import JSON file in webapp
// 3. Run migration function
```

### 3. File System Migration

#### Replace Node.js fs with FileSystemService

**Before (Electron/Node.js):**
```typescript
import fs from 'fs/promises';
import path from 'path';

// Read file
const data = await fs.readFile(filePath, 'utf-8');

// Write file
await fs.writeFile(filePath, data);

// Save dialog
const result = await dialog.showSaveDialog({
  defaultPath: path.join(os.homedir(), 'export.json')
});
if (!result.canceled) {
  await fs.writeFile(result.filePath, data);
}
```

**After (Browser):**
```typescript
import { fileSystemService } from '@/services/storage/FileSystemService';

// Open file (user picks)
const files = await fileSystemService.openFile({
  accept: { 'application/json': ['.json'] }
});
const text = await fileSystemService.readAsText(files[0]);

// Save file (user picks location)
await fileSystemService.saveFile(data, 'export.json', {
  accept: { 'application/json': ['.json'] }
});

// Quick JSON export
await fileSystemService.exportJSON(dataObject, 'export.json');
```

#### File Upload/Download Patterns

```typescript
// Pattern 1: Open and process file
async function importInvestigation() {
  const files = await fileSystemService.openFile({
    accept: { 'application/json': ['.json'] }
  });

  if (files.length === 0) return;

  const json = await fileSystemService.readAsText(files[0]);
  const investigation = JSON.parse(json);

  await storageService.saveInvestigation(investigation);
}

// Pattern 2: Export data
async function exportInvestigation(id: string) {
  const investigation = await storageService.getInvestigation(id);

  await fileSystemService.saveFile(
    JSON.stringify(investigation, null, 2),
    `investigation-${id}.json`,
    { accept: { 'application/json': ['.json'] } }
  );
}

// Pattern 3: Batch operations
async function exportAllInvestigations() {
  const investigations = await storageService.getAllInvestigations();

  const data = {
    investigations,
    exportedAt: new Date().toISOString()
  };

  await fileSystemService.exportJSON(data, 'all-investigations.json');
}
```

### 4. Video Processing Migration

#### Replace Native FFmpeg with ffmpeg.wasm

**Before (Electron/Native):**
```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegPath.path);

// Extract frames
ffmpeg(videoPath)
  .screenshots({
    count: 10,
    folder: outputFolder,
    filename: 'frame-%04d.jpg'
  });
```

**After (Browser/WebAssembly):**
```typescript
import { ffmpegService } from '@/services/video/FFmpegService';

// Must load first (loads WASM)
await ffmpegService.load();

// Extract frames
const frames = await ffmpegService.extractFrames(videoFile, {
  fps: 1,
  startTime: 0,
  duration: 10
});

// frames is array of Blobs - can display or download
frames.forEach((blob, i) => {
  const url = URL.createObjectURL(blob);
  // Use url in <img src={url} />
});
```

#### Performance Considerations

```typescript
// Load FFmpeg on app start to avoid delay later
import { ffmpegService } from '@/services/video/FFmpegService';

export function App() {
  useEffect(() => {
    // Preload FFmpeg in background
    ffmpegService.load().catch(console.error);
  }, []);

  // ... rest of app
}
```

### 5. Audio Processing Migration

#### Replace node-web-audio-api with Browser Web Audio API

**Before (Electron):**
```typescript
import { AudioContext } from 'node-web-audio-api';
import fs from 'fs';

const audioContext = new AudioContext();
const buffer = fs.readFileSync('audio.wav');
const audioBuffer = await audioContext.decodeAudioData(buffer.buffer);
```

**After (Browser):**
```typescript
import { audioService } from '@/services/audio/AudioService';

await audioService.init();

// From file input
const file = await fileSystemService.openFile({
  accept: { 'audio/*': ['.wav', '.mp3', '.ogg'] }
});
const audioBuffer = await audioService.loadAudioFile(file[0]);

// Play
await audioService.playAudioBuffer(audioBuffer);
```

#### Recording Audio

**Before (Electron):**
```typescript
// Complex setup with native modules
import recorder from 'node-record-lpcm16';

const recording = recorder.record({
  sampleRate: 16000,
  channels: 1
});

recording.stream()
  .pipe(fs.createWriteStream('recording.wav'));
```

**After (Browser):**
```typescript
import { audioService } from '@/services/audio/AudioService';

// Start recording
await audioService.startRecording({
  sampleRate: 48000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true
});

// Stop and get blob
const audioBlob = await audioService.stopRecording();

// Save or process
await fileSystemService.saveFile(audioBlob, 'recording.webm');
```

### 6. IPC Communication Removal

All IPC calls must be replaced with direct service calls.

#### Common IPC Patterns

**Before:**
```typescript
// In renderer
const result = await window.desktopAPI.investigation.load(id);
const files = await window.desktopAPI.file.open();
await window.desktopAPI.settings.set('key', value);
```

**After:**
```typescript
import { storageService } from '@/services/storage/StorageService';
import { fileSystemService } from '@/services/storage/FileSystemService';

const result = await storageService.getInvestigation(id);
const files = await fileSystemService.openFile();
await storageService.set('key', value);
```

### 7. Native Module Replacements

| Electron Module | Browser Alternative | Notes |
|----------------|---------------------|-------|
| `keytar` | Web Crypto API | Encrypt sensitive data before storing |
| `serialport` | Web Serial API | Chrome/Edge only |
| `node-hid` | WebHID | Limited device support |
| `better-sqlite3` | IndexedDB | Async, different API |
| `electron-store` | StorageService | See above |
| `fs` | File System Access API | Requires user permission |
| `path` | URL/String manipulation | No native path module |
| `child_process` | ❌ Not available | Use Web Workers instead |

#### Web Crypto API Example

**Encrypting sensitive data:**
```typescript
async function encryptData(data: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('tacctile-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data)
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}
```

### 8. Testing Migration

#### Unit Tests

```typescript
// storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '@/services/storage/StorageService';

describe('StorageService', () => {
  beforeEach(async () => {
    // Clear database before each test
    await storageService.clear();
  });

  it('should save and retrieve investigation', async () => {
    const investigation = {
      id: 'test-1',
      name: 'Test Investigation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {}
    };

    await storageService.saveInvestigation(investigation);
    const retrieved = await storageService.getInvestigation('test-1');

    expect(retrieved).toEqual(investigation);
  });
});
```

#### Integration Tests

```typescript
// app.test.ts
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Tacctile/i)).toBeInTheDocument();
  });

  it('should load investigations from storage', async () => {
    await storageService.saveInvestigation({
      id: '1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {}
    });

    render(<App />);

    // Wait for async load
    const investigation = await screen.findByText('Test');
    expect(investigation).toBeInTheDocument();
  });
});
```

### 9. Build & Deployment

#### Development

```bash
cd webapp
npm install
npm run dev
```

#### Production Build

```bash
npm run build

# Test production build locally
npm run preview
```

#### Deploy to Vercel

```bash
npm i -g vercel
vercel

# Or for production
vercel --prod
```

#### Environment Variables in Vercel

1. Go to Vercel project settings
2. Add environment variables:
   - `VITE_SENTRY_DSN`
   - `VITE_GEMINI_API_KEY`
   - `VITE_API_URL`
3. Redeploy

### 10. Common Issues & Solutions

#### Issue 1: "localStorage is not defined"

**Problem:** Trying to access localStorage during SSR or in Node.js context.

**Solution:**
```typescript
// Check if in browser
if (typeof window !== 'undefined') {
  localStorage.setItem('key', 'value');
}

// Or use our StorageService which handles this
await storageService.set('key', 'value');
```

#### Issue 2: FFmpeg.wasm loading slowly

**Problem:** First load is slow (~30MB download).

**Solution:**
```typescript
// Preload on app start
useEffect(() => {
  ffmpegService.load().catch(console.error);
}, []);

// Show loading indicator
const [ffmpegReady, setFFmpegReady] = useState(false);

useEffect(() => {
  ffmpegService.load()
    .then(() => setFFmpegReady(true))
    .catch(console.error);
}, []);
```

#### Issue 3: File System Access not working in Firefox

**Problem:** File System Access API not supported.

**Solution:** Service automatically falls back to downloads:
```typescript
// Works in all browsers (with different UX)
await fileSystemService.saveFile(data, 'file.json');

// In Chrome/Edge: Saves to user-selected location
// In Firefox/Safari: Downloads to Downloads folder
```

#### Issue 4: CORS errors with external APIs

**Problem:** CORS blocking requests to external APIs.

**Solution:** Use a proxy or CORS-anywhere:
```typescript
// Option 1: Proxy through your backend
const response = await fetch(`${VITE_API_URL}/proxy?url=${encodedUrl}`);

// Option 2: Use CORS proxy (development only!)
const response = await fetch(`https://cors-anywhere.herokuapp.com/${url}`);
```

## ✅ Migration Checklist

### Pre-Migration
- [ ] Audit all Electron-specific code
- [ ] List all IPC channels used
- [ ] Document all native modules
- [ ] Export all user data from desktop app

### During Migration
- [ ] Copy React components to webapp
- [ ] Replace all IPC calls with service calls
- [ ] Update storage layer
- [ ] Update file I/O
- [ ] Update video/audio processing
- [ ] Remove Node.js imports
- [ ] Update tests

### Post-Migration
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test offline functionality (PWA)
- [ ] Test on mobile devices
- [ ] Verify all features work
- [ ] Performance testing
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

## 📊 Performance Comparison

| Operation | Desktop (Electron) | WebApp (Browser) | Notes |
|-----------|-------------------|------------------|-------|
| **App Startup** | 2-3s | < 1s | WebApp is faster |
| **File Open** | Instant | Requires dialog | Same UX |
| **Video Processing** | Fast | 3-5x slower | FFmpeg.wasm limitation |
| **Audio Processing** | Fast | Same | Web Audio API is mature |
| **Storage Read** | < 1ms | < 5ms | IndexedDB async overhead |
| **Storage Write** | < 1ms | < 10ms | IndexedDB async overhead |
| **Bundle Size** | ~200MB | ~5MB initial | WebApp much smaller |

## 🎯 Best Practices

1. **Lazy Load Heavy Dependencies**
   ```typescript
   // Load FFmpeg only when needed
   const processVideo = async (file: File) => {
     await ffmpegService.load();
     return ffmpegService.extractFrames(file);
   };
   ```

2. **Use Web Workers for Heavy Processing**
   ```typescript
   // Create worker for audio analysis
   const worker = new Worker(
     new URL('./audio-worker.ts', import.meta.url)
   );
   ```

3. **Request Persistent Storage**
   ```typescript
   // On app start
   useEffect(() => {
     fileSystemService.requestPersistentStorage();
   }, []);
   ```

4. **Handle Offline Mode**
   ```typescript
   const [isOnline, setIsOnline] = useState(navigator.onLine);

   useEffect(() => {
     const handleOnline = () => setIsOnline(true);
     const handleOffline = () => setIsOnline(false);

     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);

     return () => {
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
     };
   }, []);
   ```

## 🔗 Resources

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [Vite Documentation](https://vitejs.dev/)
- [React 19](https://react.dev/)
- [Material-UI](https://mui.com/)

## 📞 Support

For migration questions or issues:
- [GitHub Issues](https://github.com/tacctile/tacctile_webapp/issues)
- [Discussions](https://github.com/tacctile/tacctile_webapp/discussions)
