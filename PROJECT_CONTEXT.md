# Tacctile - Project Context

## Project Overview
Professional ghost hunting evidence analysis software built with Electron for Windows/Mac desktop.

## Core Features
- **Video Analysis**: Anomaly detection, frame-by-frame analysis, timeline scrubbing
- **Audio Processing**: EVP detection, spectral analysis, noise reduction (Pro Tools style)
- **Image Enhancement**: Lightroom-style filters, anomaly highlighting
- **Live Camera Monitoring**: Multi-camera feeds, motion detection, recording
- **Hardware Integration**: EMF sensors, magnetometers, thermometers via Bluetooth/USB
- **AI Analysis**: Computer vision and audio AI for pattern detection

## Tech Stack
- **Framework**: Electron (main + renderer processes)
- **Frontend**: React with TypeScript
- **Build Tool**: Vite
- **Media Processing**: FFmpeg, WebAudio API, Canvas API
- **AI/ML**: TensorFlow.js, ONNX Runtime
- **Hardware**: Node.js native modules, WebBluetooth, WebUSB
- **Database**: SQLite for evidence cataloging
- **Streaming**: WebRTC for live cameras

## Architecture
```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── services/       # Business logic
├── hardware/       # Sensor integrations
├── ai/            # ML models and processing
├── components/     # React UI components
└── utils/         # Shared utilities
```

## Critical Requirements
1. **Real-time Performance**: 60fps video, low-latency audio
2. **Professional UI**: Sleek, snappy, webapp feel but native
3. **Cross-platform**: Windows primary, Mac secondary
4. **Offline Capable**: Core features work without internet
5. **Mobile Integration**: Receives evidence from Flutter mobile app via Bluetooth/WiFi

## Development Standards
- Use agents from `.claude_agents.yaml` for focused expertise
- TypeScript for type safety
- Modular architecture with clear separation of concerns
- Performance-first approach for media processing
- Comprehensive error handling for hardware integration

## Current Status
- Project initialized with Electron + Vite + TypeScript
- Agent system configured for specialized development
- Ready for feature implementation