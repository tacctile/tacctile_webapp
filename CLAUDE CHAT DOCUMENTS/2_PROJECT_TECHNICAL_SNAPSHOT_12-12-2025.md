0) Snapshot Metadata
Repo name: tacctile_webapp
Snapshot date/time (local): 2025-12-14
Primary languages: TypeScript, TSX
Frameworks/libraries: React 19.1.1, Material-UI 7.3.2, Vite 6.0.7, Zustand 5.0.8
Primary runtime targets: Web (PWA)
Package managers: npm
Monorepo: No
Tooling assumptions: Node.js ≥18, npm, Vercel for deployment
1) One-Paragraph Executive Summary
Tacctile is a collaborative timeline platform for organizing, reviewing, and annotating media files (video, audio, images). It implements a BYOS (Bring Your Own Storage) model where users connect their own cloud storage providers (Google Drive, Dropbox, OneDrive). The web app provides specialized tools for media analysis including an audio waveform tool, video player with GPU filters, image viewer, timeline visualization, and a streaming/capture tool. Knox AI assistant (powered by Gemini) provides context-aware help. Authentication uses Firebase with Supabase PostgreSQL for data persistence (with RLS), and Stripe for subscription billing (free/pro tiers).

2) Current Status (Truth Table)
Module / Domain	Status	Notes
Authentication (Firebase + Supabase)	Done	Google OAuth, email/password
Home / Project Dashboard	Done	Project listing, creation
Timeline Tool	Done	Chronological media display, flags
Audio Tool	Done	Waveform view, filters, recipes, findings
Video Tool	Done	Player, adjustments, camera grid
Image Tool	Done	Gallery view, metadata
Streaming Tool	Done	Scene manager, recording, audio mixer
Knox AI Sidekick	Done	Gemini integration, chat interface
Multi-View Mode	Done	Synchronized multi-panel layout
Flags System	Done	Multi-user flags, filtering, keyboard nav
Cloud Storage OAuth	WIP	TODO: Implement OAuth flows
API Cloud Sync	WIP	TODO: Autosave cloud sync
Hub Import	Planned	TODO: Implement hub import
Clock Verification	Planned	TODO: Implement clock sync
Export Tool	Placeholder	UI stub only
Notes Tool	Placeholder	UI stub only
Team Management	Placeholder	UI stub only
Settings	Placeholder	UI stub only
Top 5 Active Work Items (from TODOs):

src/stores/useAutosave.ts:217 - Implement cloud sync via API
src/components/home/HomePage.tsx:507 - Implement OAuth flow for cloud storage
src/stores/useTimelineStore.ts:369,426 - Replace mock data with actual API calls
src/stores/useTimelineStore.ts:447 - Implement hub import
src/stores/useTimelineStore.ts:603 - Implement actual clock verification
3) Repository Map (Trimmed Tree)
tacctile_webapp/
├── src/                           # Main application source
│   ├── main.tsx                   # Entry point with Sentry init
│   ├── App.tsx                    # Root component, theme, routing
│   ├── index.css                  # Global styles
│   ├── components/                # React components (60+)
│   │   ├── layout/                # VS Code-inspired layout (IconRail, BottomBar, etc.)
│   │   ├── timeline/              # Timeline visualization (Timeline, FlagMarker, etc.)
│   │   ├── audio-tool/            # Audio analysis (AudioTool, WaveformView, FilterPanel)
│   │   ├── video-tool/            # Video playback (VideoTool, VideoPlayer, CameraGrid)
│   │   ├── image-tool/            # Image viewer (ImageTool)
│   │   ├── streaming-tool/        # Live capture (StreamingTool, SceneManager)
│   │   ├── ai-sidekick/           # Knox AI (AISidekickPanel, KnoxAvatar)
│   │   ├── home/                  # Dashboard (HomePage, NewProjectDialog)
│   │   ├── multiview/             # Multi-panel layout (MultiViewPage, viewers/)
│   │   ├── common/                # Shared components (ErrorBoundary, LoadingSkeleton)
│   │   └── file-library/          # File browser
│   ├── stores/                    # Zustand state stores (12 stores)
│   ├── services/                  # Business logic services (20 files)
│   │   ├── auth/                  # FirebaseAuthService
│   │   ├── supabase/              # SupabaseService (DB + RLS)
│   │   ├── storage/               # StorageService, FileSystemService
│   │   ├── cloud-storage/         # CloudStorageService, TokenManager
│   │   ├── video/                 # FFmpegService, GPUVideoFilters
│   │   ├── audio/                 # AudioService (Web Audio API)
│   │   ├── ai/                    # GeminiService
│   │   ├── billing/               # StripeService
│   │   ├── file-flagging/         # FileFlaggingService
│   │   └── multiview/             # MultiViewSyncService
│   ├── hooks/                     # Custom React hooks (11 hooks)
│   ├── contexts/                  # React contexts (AuthContext, LayoutContext)
│   ├── types/                     # TypeScript type definitions (8 files)
│   ├── config/                    # Environment config and validation
│   ├── utils/                     # Utility functions
│   └── pages/                     # Route pages (WorkspaceDemo)
├── public/                        # Static assets, PWA icons
├── supabase/                      # Database schema
│   └── schema.sql                 # PostgreSQL schema with RLS
├── index.html                     # HTML entry with security headers
├── vite.config.ts                 # Build config with code splitting
├── tsconfig.json                  # TypeScript strict config
├── package.json                   # Dependencies and scripts
├── vercel.json                    # Vercel deployment config
├── CLAUDE.md                      # Project guidelines
└── .env.example                   # Environment template

4) Entry Points & Boot Sequence
4.1 Primary Entry Point
File: src/main.tsx
Purpose: Bootstraps React app, initializes Sentry in production, routes to main App or MultiViewPage based on URL path
4.2 Application Initialization Flow
index.html loads with security headers (CSP, X-Frame-Options)
main.tsx checks if route is /multiview for separate window
Sentry initialized in production mode
App.tsx renders with:
MUI ThemeProvider (dark theme, #19abb5 primary)
LayoutProvider (panel visibility state)
useNavigationStore (tool selection)
useAppPersistence (persisted app state)
useKeyboardShortcuts (global shortcuts)
IconRail + selected tool component + AISidekickPanel + BottomBar rendered
Tools lazy-loaded on demand via React.lazy()
4.3 Routing
Type: In-app state-based routing via Zustand store
File: src/stores/useNavigationStore.ts
Tools: home, timeline, video, audio, images, streaming, export, notes, team, settings
4.4 Service Initialization
AuthContext (src/contexts/AuthContext.tsx) initializes:
FirebaseAuthService.init()
SupabaseService.init()
StripeService.init()
Auth state listener syncs user to Supabase
5) Core Architecture
5.1 Layers / Boundaries
Layer	Description	Location
UI Layer	React components with MUI	src/components/
State Layer	Zustand stores with persist/immer	src/stores/
Hook Layer	Custom hooks encapsulating logic	src/hooks/
Service Layer	Business logic, API integrations	src/services/
Context Layer	Auth and Layout providers	src/contexts/
Type Layer	TypeScript definitions	src/types/
Config Layer	Environment variables	src/config/
5.2 Design Patterns in Use
State Management: Zustand stores with persist middleware + Immer for immutable updates
Service Pattern: Singleton services for external integrations (Firebase, Supabase, Stripe, Gemini)
Context Pattern: React Context for auth state and layout state
Lazy Loading: React.lazy() for tool components
Error Boundaries: Per-tool error isolation
PWA: Service Worker with Workbox caching strategies
5.3 Primary Data Flow (Happy Path)
User Action (UI Component)
    ↓
Custom Hook (useFileFlags, useCloudStorage, etc.)
    ↓
Zustand Store Action (dispatch with immer)
    ↓
Service Layer (SupabaseService, CloudStorageService)
    ↓
External API (Supabase PostgreSQL, Cloud Provider)
    ↓
Store Update + Component Re-render (via selector subscription)

6) Key Modules (Top 10)
6.1 useNavigationStore
Responsibility: Global navigation state (active tool, active project, loaded files)
Main files: src/stores/useNavigationStore.ts
Internal deps: None
External deps: Zustand, Immer
6.2 AuthContext
Responsibility: Firebase auth state, Supabase user sync, Stripe subscription
Main files: src/contexts/AuthContext.tsx
Internal deps: FirebaseAuthService, SupabaseService, StripeService
External deps: Firebase, Supabase
6.3 useAudioToolStore
Responsibility: Audio tool state (waveform, filters, recipes, findings)
Main files: src/stores/useAudioToolStore.ts (~22KB)
Internal deps: usePlayheadStore
External deps: Zustand, Immer
6.4 useTimelineStore
Responsibility: Timeline state (investigations, files, flags, playback)
Main files: src/stores/useTimelineStore.ts (~22KB)
Internal deps: usePlayheadStore
External deps: Zustand, Immer
6.5 SupabaseService
Responsibility: Database operations with RLS (users, investigations, flags, subscriptions)
Main files: src/services/supabase/SupabaseService.ts
Internal deps: None
External deps: @supabase/supabase-js
6.6 CloudStorageService
Responsibility: Cloud provider abstraction (Google Drive, Dropbox, OneDrive)
Main files: src/services/cloud-storage/CloudStorageService.ts, TokenManager.ts
Internal deps: None
External deps: None (native fetch)
6.7 AudioTool
Responsibility: Audio analysis UI (waveform, filters, recipes, findings)
Main files: src/components/audio-tool/AudioTool.tsx, WaveformView.tsx, FilterPanel.tsx
Internal deps: useAudioToolStore, usePlayheadStore, useAudioPlayback
External deps: Wavesurfer.js, Chart.js
6.8 Timeline
Responsibility: Chronological media visualization with flags
Main files: src/components/timeline/Timeline.tsx, TimelineTrack.tsx, FlagMarker.tsx
Internal deps: useTimelineStore, usePlayheadStore
External deps: MUI
6.9 GeminiService
Responsibility: Knox AI assistant integration
Main files: src/services/ai/GeminiService.ts
Internal deps: None
External deps: @google/generative-ai
6.10 FFmpegService
Responsibility: Browser video processing (frame extraction, conversion, thumbnails)
Main files: src/services/video/FFmpegService.ts
Internal deps: None
External deps: @ffmpeg/ffmpeg, @ffmpeg/core, @ffmpeg/util
7) Public Interfaces & Contracts
7.1 APIs
External APIs consumed:

Firebase Auth (Google OAuth, email/password)
Supabase (PostgreSQL with RLS)
Stripe (subscriptions)
Google Gemini (AI chat)
Google Drive / Dropbox / OneDrive (cloud storage)
Auth approach: Firebase ID tokens, Supabase RLS policies

Error shape: Custom error classes in src/types/index.ts (TacctileError, AuthError, StorageError)

7.2 Events / Messaging
Supabase Realtime: Enabled for evidence, evidence_flags, flag_comments tables
Auth state changes: Firebase onAuthStateChange → AuthContext listener
Store subscriptions: Zustand selector-based reactivity
7.3 Persistence
Datastore	Purpose	Location
Supabase PostgreSQL	Users, subscriptions, investigations, files, flags	Cloud
IndexedDB	Local caching, offline data	Browser
localStorage	Zustand store persistence	Browser
Primary Tables:

users - User profiles
subscriptions - Billing status (free/pro)
investigations - Projects
team_members - Collaboration
evidence - Media files
evidence_flags - Annotations
flag_comments - Flag comments
cloud_storage_connections - OAuth tokens
Schema location: supabase/schema.sql

Migration strategy: Manual SQL execution in Supabase SQL Editor

8) State, Configuration & Environment
8.1 Configuration Location
File: src/config/index.ts
Validation: validateConfig() function checks required vars
8.2 Environment Variables
# Firebase
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
VITE_FIREBASE_APP_ID, VITE_FIREBASE_MEASUREMENT_ID

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_PRO_MONTHLY_PRICE_ID,
VITE_STRIPE_PRO_YEARLY_PRICE_ID, VITE_STRIPE_CUSTOMER_PORTAL_URL

# Supabase
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Cloud Storage
VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY, VITE_DROPBOX_CLIENT_ID,
VITE_DROPBOX_REDIRECT_URI, VITE_ONEDRIVE_CLIENT_ID, VITE_ONEDRIVE_REDIRECT_URI

# AI
VITE_GEMINI_API_KEY, VITE_GEMINI_MODEL, VITE_GEMINI_MAX_OUTPUT_TOKENS,
VITE_GEMINI_TEMPERATURE

# App
VITE_APP_VERSION, VITE_BASE_URL, VITE_API_URL, VITE_SENTRY_DSN

# Feature Flags
VITE_ENABLE_AI_SUMMARIZATION, VITE_ENABLE_REALTIME_COLLAB,
VITE_ENABLE_OFFLINE_MODE, VITE_ENABLE_DEBUG

8.3 Feature Flags
Located in src/config/index.ts:

enableAISummarization - Knox AI features
enableRealTimeCollaboration - Multi-user sync
enableOfflineMode - PWA offline
enableDebugMode - Dev logging
8.4 Logging / Telemetry
Sentry: Error tracking in production (@sentry/react)
Console: Removed in production build (Terser drop_console)
9) Testing & Quality
9.1 Test Types Present
Unit tests: Framework configured (Vitest)
Test files: None written yet (scaffolded but intentionally incomplete per CLAUDE.md)
9.2 Test Frameworks
Vitest 2.1.8 - Unit testing
@vitest/coverage-v8 2.1.8 - Coverage
9.3 Test Location
Tests would go in src/**/*.test.ts or src/**/*.spec.ts
9.4 How to Run Tests
npm run test           # Lint + type-check
npm run test:unit      # Run Vitest
npm run test:unit:watch    # Watch mode
npm run test:unit:coverage # Coverage report

9.5 Linting / Formatting
ESLint 8.57.1 with TypeScript plugin
Config: .eslintrc (implied, standard Vite setup)
Command: npm run lint
10) Build, Deploy, and Validation (Cloud-Only)

This project is developed and validated entirely through cloud-based workflows.
There is no local development or localhost execution.

CI / Build Process
- Builds are executed by the CI system on repository events (e.g., pull requests, merges).
- The primary build command is:
  npm run build
- Output artifacts are generated for deployment by the hosting platform.

Static Analysis & Quality Checks
- Type checking is performed during CI using:
  npm run type-check
- Linting is performed during CI using:
  npm run lint
- These checks must pass before pull requests are merged.

Preview & Deployment Model
- Preview environments are generated automatically for pull requests.
- Previews are used to validate UI, behavior, and integrations.
- No local preview or watch mode is used.

Production Deployment
- Deployments occur automatically on merges to the main branch.
- Deployment configuration is defined in:
  vercel.json
- The deployment platform executes the build command and serves the output.

Authoritative Validation Source
- Hosted preview deployments and CI results are the sole source of truth
  for determining whether changes are correct and ready to merge.

11) Known Issues, Risks & Tech Debt
Issue	Why It Matters	File Path	Severity
Cloud sync not implemented	Autosave to API doesn't work	src/stores/useAutosave.ts:217	High
OAuth flows missing	Cannot connect cloud storage	src/components/home/HomePage.tsx:507	High
API calls use mock data	Timeline data not persisted	src/stores/useTimelineStore.ts:369,426	High
Hub import not implemented	Cannot import from hub	src/stores/useTimelineStore.ts:447	Medium
Clock verification missing	Multi-device sync unreliable	src/stores/useTimelineStore.ts:603	Medium
Flag creation incomplete	Video/Timeline flag creation TODOs	src/components/video-tool/VideoTool.tsx:260, src/components/timeline/Timeline.tsx:1824	Medium
No unit tests	Code quality risk	N/A	Medium
FFmpeg.wasm performance	3-5x slower than native	src/services/video/FFmpegService.ts	Low
File System Access API	Firefox/Safari use fallback	src/services/storage/FileSystemService.ts	Low
12) "Do Not Break" Invariants
12.1 BYOS Principle
Rule: Never store user files on Tacctile infrastructure
Enforcement: All file operations go through CloudStorageService
Reference: CLAUDE.md - "BYOS is absolute"
12.2 Original Files Sacred
Rule: Never modify source files; all edits produce new exports
Reference: CLAUDE.md - "Never modify original files"
12.3 React Single Instance
Rule: React must be deduplicated to prevent hook errors
Enforcement: vite.config.ts:207 - dedupe: ['react', 'react-dom', ...]
Risk: MUI/React 19 compatibility breaks if violated
12.4 Zustand Store Persistence Keys
Rule: Store persistence keys must remain stable
Location: Each store's persist() middleware name parameter
Risk: Changing keys loses user's persisted state
12.5 Supabase RLS Policies
Rule: Row-level security must be enabled on all tables
Location: supabase/schema.sql
Risk: Data leaks if RLS disabled
12.6 Environment Variable Prefix
Rule: All client-side env vars must use VITE_ prefix
Reference: Vite convention
Risk: Vars without prefix are server-only and undefined in client
12.7 Sector-Agnostic Language
Rule: No domain-specific terminology (no "evidence", "investigation" in UI)
Reference: CLAUDE.md - Use "files" and "projects"
Note: Some code uses legacy naming internally
13) Suggested Next Refactor Targets
Implement Cloud Sync API - Critical for production use; currently all autosave is local-only (src/stores/useAutosave.ts)

Complete OAuth Flows - Cloud storage providers are configured but OAuth not wired (src/components/home/HomePage.tsx)

Add Unit Tests - Testing scaffolding exists but no tests written; high-value targets are stores and services

Rename Internal "Investigation" → "Project" - Code uses "investigation" but CLAUDE.md specifies "project" terminology for sector-agnostic design

Extract Common Flag Logic - Flag creation TODOs exist in multiple tools; consolidate into shared hook/service
