# Tacctile WebApp

Professional ghost hunting evidence analysis and investigation management **web application**.

This is the web version of the Tacctile application, migrated from Electron desktop to a modern Vite + React + TypeScript webapp that can be deployed to Vercel or any static hosting platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📋 Migration from Electron Desktop

This webapp is a migration from the Electron desktop application. Key changes:

### ✅ What Stayed the Same
- **React 19.1.1** with TypeScript
- **Material-UI (MUI) v7.3.2** for UI components
- **Zustand** for state management
- **Wavesurfer.js**, **Chart.js**, **Three.js** for visualizations
- **React components** from the renderer process
- **VS Code-inspired layout** (ActivityBar, SidePanel, EditorArea, etc.)
- **Tacctile brand colors** and theming

### 🔄 What Changed

#### Storage Layer
- **Old**: `electron-store` (Node.js file system)
- **New**: `IndexedDB` via `idb` library
- **Location**: `src/services/storage/StorageService.ts`

```typescript
import { storageService } from '@/services/storage/StorageService';

// Same API as electron-store
await storageService.set('key', value);
const value = await storageService.get('key');
```

#### File System Access
- **Old**: Node.js `fs` module
- **New**: File System Access API + fallback to downloads
- **Location**: `src/services/storage/FileSystemService.ts`

```typescript
import { fileSystemService } from '@/services/storage/FileSystemService';

// Open files
const files = await fileSystemService.openFile();

// Save files
await fileSystemService.saveFile(data, 'filename.json');

// Import/Export JSON
await fileSystemService.exportJSON(data, 'backup.json');
const data = await fileSystemService.importJSON();
```

#### Video Processing
- **Old**: Native FFmpeg binary
- **New**: ffmpeg.wasm (WebAssembly)
- **Location**: `src/services/video/FFmpegService.ts`

```typescript
import { ffmpegService } from '@/services/video/FFmpegService';

// Extract frames
const frames = await ffmpegService.extractFrames(videoFile, { fps: 1 });

// Convert video
const blob = await ffmpegService.convertVideo(videoFile, 'mp4');

// Extract audio
const audioBlob = await ffmpegService.extractAudio(videoFile, 'mp3');

// Create thumbnail
const thumb = await ffmpegService.createThumbnail(videoFile, 5);
```

#### Audio Processing
- **Old**: Node.js `node-web-audio-api` + native modules
- **New**: Browser Web Audio API only
- **Location**: `src/services/audio/AudioService.ts`

```typescript
import { audioService } from '@/services/audio/AudioService';

// Record audio
await audioService.startRecording({ sampleRate: 48000 });
const blob = await audioService.stopRecording();

// Analyze audio
const analysis = await audioService.analyzeAudio();

// Load and play
const buffer = await audioService.loadAudioFile(file);
await audioService.playAudioBuffer(buffer);
```

### ❌ What Was Removed

1. **Electron main process** (`src/main/index.ts`)
2. **Preload scripts** (`src/preload/index.ts`)
3. **IPC communication** (all `ipcMain.handle()` and `ipcRenderer.invoke()`)
4. **Native modules**:
   - `keytar` (credential storage) → Use Web Crypto API
   - `serialport` → Use Web Serial API (limited browser support)
   - `better-sqlite3` → IndexedDB
   - `electron-store` → StorageService
   - `node-cron` → Use `setInterval()` or Web Workers

## 🏗️ Project Structure

```
webapp/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Main app component
│   ├── index.css                # Global styles
│   ├── components/
│   │   ├── layout/              # Layout components (copied from renderer)
│   │   │   ├── ActivityBar.tsx
│   │   │   ├── SidePanel.tsx
│   │   │   ├── EditorArea.tsx
│   │   │   ├── BottomPanel.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── blueprint/           # Blueprint editor components
│   │   ├── dashboard/           # Dashboard components
│   │   ├── social-hub/          # Social media integration
│   │   └── streaming/           # Video streaming UI
│   ├── services/
│   │   ├── storage/
│   │   │   ├── StorageService.ts      # IndexedDB wrapper
│   │   │   └── FileSystemService.ts   # File System Access API
│   │   ├── video/
│   │   │   └── FFmpegService.ts       # ffmpeg.wasm wrapper
│   │   └── audio/
│   │       └── AudioService.ts        # Web Audio API service
│   ├── contexts/
│   │   └── LayoutContext.tsx    # Layout state context
│   ├── utils/                   # Utility functions
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── assets/                  # Static assets
├── public/                      # Public assets
├── index.html                   # HTML entry point
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── vercel.json                 # Vercel deployment config
├── package.json                # Dependencies
└── .env.example                # Environment variables template

```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
VITE_SENTRY_DSN=your-sentry-dsn
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_API_URL=https://api.tacctile.com
```

### Vite Configuration

The `vite.config.ts` includes:
- React plugin with Emotion support (for MUI)
- PWA plugin for offline support
- Path aliases (`@/`, `@components/`, etc.)
- Code splitting for optimal bundle size
- Security headers (CORS, CSP)

## 🚢 Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. For production:
```bash
vercel --prod
```

### Other Platforms

The app can be deployed to any static hosting:
- **Netlify**: `npm run build` → deploy `dist/`
- **GitHub Pages**: Use GitHub Actions to build and deploy
- **AWS S3 + CloudFront**: Upload `dist/` to S3 bucket
- **Firebase Hosting**: `firebase deploy`

## 📦 Dependencies

### Core
- **React 19.1.1** - UI framework
- **TypeScript 5.7.2** - Type safety
- **Vite 6.0.7** - Build tool

### UI Framework
- **@mui/material 7.3.2** - Material-UI components
- **@emotion/react** - CSS-in-JS
- **@fontsource/manrope** - Manrope font family

### Data Visualization
- **three 0.180.0** - 3D graphics
- **@react-three/fiber 9.3.0** - React Three.js renderer
- **chart.js 4.5.0** - Charts and graphs
- **wavesurfer.js 7.10.1** - Audio waveforms
- **konva 10.0.2** - Canvas drawing
- **pixi.js 8.13.2** - 2D WebGL renderer

### Storage
- **idb 8.0.1** - IndexedDB wrapper
- **dexie 4.0.10** - Advanced IndexedDB library
- **localforage 1.10.0** - Storage abstraction

### Media Processing
- **@ffmpeg/ffmpeg 0.12.10** - Video processing (WebAssembly)
- **tone 15.1.22** - Audio synthesis
- **meyda 5.6.3** - Audio feature extraction

### State & Routing
- **zustand 5.0.8** - State management
- **react-router-dom 6.30.1** - Routing

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm run lint             # ESLint
npm run type-check       # TypeScript type checking
npm test                 # Run unit tests
npm run test:watch       # Watch mode

# Type Coverage
npm run test:unit:coverage  # Generate coverage report
```

### Path Aliases

Use path aliases in imports:

```typescript
import Component from '@/components/Component';
import { service } from '@services/service';
import { useHook } from '@hooks/useHook';
import type { Type } from '@types/types';
```

## 🔒 Security

### Browser Security Features
- Content Security Policy (CSP) headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict HTTPS enforcement (production)
- Subresource Integrity (SRI) for CDN assets

### Data Storage
- IndexedDB for structured data (investigations, evidence)
- localStorage for small settings
- File System Access API for user files (requires permission)
- No sensitive data in localStorage (use IndexedDB encryption if needed)

## 🌐 Browser Compatibility

### Required Browser Features
- ✅ ES2020+ (Chrome 91+, Firefox 89+, Safari 15+)
- ✅ Web Audio API (all modern browsers)
- ✅ IndexedDB (all modern browsers)
- ✅ File System Access API (Chrome 86+, Edge 86+) *with fallback*
- ✅ WebAssembly (all modern browsers)

### Optional Features
- 🔸 Web Serial API (Chrome 89+, Edge 89+) - for hardware integration
- 🔸 WebUSB (Chrome 61+, Edge 79+) - for USB devices
- 🔸 WebBluetooth (Chrome 56+, Edge 79+) - for Bluetooth devices

### Fallbacks
- File System Access API → File download/upload inputs
- Native notifications → Browser notifications API
- Clipboard API → `document.execCommand()` fallback

## 📚 API Documentation

### StorageService

```typescript
// Get/Set values
await storageService.set('key', value);
const value = await storageService.get('key', defaultValue);

// Investigations
await storageService.saveInvestigation(investigation);
const investigations = await storageService.getAllInvestigations();
const investigation = await storageService.getInvestigation(id);
await storageService.deleteInvestigation(id);

// Evidence
await storageService.saveEvidence(evidence);
const evidence = await storageService.getEvidenceByInvestigation(id);

// Export/Import
const data = await storageService.exportData();
await storageService.importData(data);
```

### FileSystemService

```typescript
// File operations
const files = await fileSystemService.openFile({
  accept: { 'image/*': ['.jpg', '.png'] },
  multiple: true
});

await fileSystemService.saveFile(data, 'filename.txt', {
  accept: { 'text/plain': ['.txt'] }
});

// Read file content
const text = await fileSystemService.readAsText(file);
const dataURL = await fileSystemService.readAsDataURL(file);
const buffer = await fileSystemService.readAsArrayBuffer(file);

// JSON operations
await fileSystemService.exportJSON(data, 'backup.json');
const data = await fileSystemService.importJSON();

// Storage info
const isPersisted = await fileSystemService.isPersisted();
const { usage, quota } = await fileSystemService.estimateStorage();
```

### FFmpegService

```typescript
// Initialize (loads WebAssembly)
await ffmpegService.load();

// Extract frames
const frames = await ffmpegService.extractFrames(videoFile, {
  fps: 1,
  startTime: 0,
  duration: 10,
  quality: 2
});

// Convert video
const mp4 = await ffmpegService.convertVideo(videoFile, 'mp4', {
  codec: 'libx264',
  bitrate: '1M',
  scale: '1280:720'
});

// Extract audio
const audio = await ffmpegService.extractAudio(videoFile, 'mp3');

// Create thumbnail
const thumbnail = await ffmpegService.createThumbnail(videoFile, 5);

// Trim video
const trimmed = await ffmpegService.trimVideo(videoFile, 10, 60);

// Concatenate videos
const combined = await ffmpegService.concatenateVideos([video1, video2]);
```

### AudioService

```typescript
// Initialize
await audioService.init();

// Record audio
await audioService.startRecording({
  sampleRate: 48000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true
});
const audioBlob = await audioService.stopRecording();

// Analyze audio (real-time)
const analysis = await audioService.analyzeAudio();
// Returns: { frequencyData, timeDomainData, rms, peak, spectralCentroid, spectralFlux }

// Load and play
const buffer = await audioService.loadAudioFile(audioFile);
const source = await audioService.playAudioBuffer(buffer);

// Effects
const { gain, filter, compressor } = audioService.createEffectChain();
gain.gain.value = 1.5;
filter.frequency.value = 1000;

// Device management
const inputDevices = await audioService.getAudioInputDevices();
const outputDevices = await audioService.getAudioOutputDevices();
const hasPermission = await audioService.checkMicrophoneAccess();
```

## 🐛 Known Issues & Limitations

### Current Limitations

1. **FFmpeg.wasm Performance**
   - Slower than native FFmpeg (3-5x)
   - Large WebAssembly file (~30MB) on first load
   - Limited codec support compared to native FFmpeg

2. **File System Access**
   - Not available in Firefox/Safari (uses fallback downloads)
   - Requires user permission for each file operation
   - No automatic background saving

3. **Hardware Integration**
   - Web Serial API: Chrome/Edge only
   - WebUSB: Limited device support
   - No direct serial port access like desktop version

4. **Storage Limitations**
   - IndexedDB storage quota varies by browser
   - Typically 50-60% of available disk space
   - Can be cleared by browser if storage is low

### Workarounds

1. **Large Files**: Use cloud storage API for files > 50MB
2. **Hardware**: Provide REST API bridge for hardware devices
3. **Persistent Storage**: Request persistent storage permission:
   ```typescript
   await fileSystemService.requestPersistentStorage();
   ```

## 🔄 Migration Checklist

If migrating from Electron desktop:

- [ ] Replace `window.ghostHunterAPI.xxx` with new service calls
- [ ] Convert all `ipcRenderer.invoke()` to direct service calls
- [ ] Replace `electron-store` with `StorageService`
- [ ] Update file I/O to use `FileSystemService`
- [ ] Replace native FFmpeg with `FFmpegService`
- [ ] Update audio processing to use `AudioService`
- [ ] Remove Node.js-specific imports (`fs`, `path`, `child_process`, etc.)
- [ ] Test all features in Chrome, Firefox, Safari
- [ ] Set up CI/CD for automatic deployment
- [ ] Configure environment variables for production
- [ ] Test offline PWA functionality

## 📝 License

MIT

## 👥 Contributors

Tacctile Team - https://github.com/tacctile

## 🔗 Links

- [GitHub Repository](https://github.com/tacctile/tacctile_webapp)
- [Report Issues](https://github.com/tacctile/tacctile_webapp/issues)
- [Documentation](https://github.com/tacctile/tacctile_webapp/wiki)
