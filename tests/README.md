# Tacctile Testing Guide

This document provides comprehensive guidance for testing the Tacctile webapp. Follow these patterns when writing new tests to maintain consistency across the codebase.

## Table of Contents

- [Running Tests](#running-tests)
- [Writing Store Tests](#writing-store-tests)
- [Writing Service Tests](#writing-service-tests)
- [Writing Component Tests](#writing-component-tests)
- [Mocking Zustand Stores](#mocking-zustand-stores)
- [Coverage Requirements](#coverage-requirements)
- [E2E Test Patterns](#e2e-test-patterns)
- [Test File Organization](#test-file-organization)

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests (single run)
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with Vitest UI (interactive browser interface)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with Playwright UI (interactive debugging)
npm run test:e2e:ui

# Run all tests (unit + E2E)
npm run test:all
```

### Test Output

- **Coverage reports**: Generated in `./coverage/` directory
- **E2E reports**: Generated in `./playwright-report/` directory
- **Test results**: Generated in `./test-results/` directory

---

## Writing Store Tests

Zustand stores are the backbone of Tacctile's state management. Follow this pattern when testing stores.

### Pattern

1. **Reset store before each test** to ensure test isolation
2. **Test initial state** to verify defaults
3. **Test each action** individually
4. **Test edge cases** (boundary values, empty states)
5. **Test derived state/selectors** if applicable

### Example: AudioTool Store Test

```typescript
// src/stores/__tests__/useAudioToolStore.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useAudioToolStore } from '../useAudioToolStore';

describe('useAudioToolStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useAudioToolStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      const state = useAudioToolStore.getState();

      expect(state.fileId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.playback.isPlaying).toBe(false);
    });
  });

  describe('Playback Controls', () => {
    it('should toggle play state', () => {
      const store = useAudioToolStore.getState();

      expect(store.playback.isPlaying).toBe(false);

      act(() => {
        store.play();
      });

      expect(useAudioToolStore.getState().playback.isPlaying).toBe(true);
    });

    it('should clamp volume to valid range', () => {
      act(() => {
        useAudioToolStore.getState().setVolume(1.5);
      });

      expect(useAudioToolStore.getState().playback.volume).toBe(1); // Clamped to max
    });
  });
});
```

### Key Points

- Always wrap store mutations in `act()` from `@testing-library/react`
- Use `useStore.getState()` to access current state
- Test both happy path and edge cases
- Reset store in `beforeEach` to prevent test pollution

---

## Writing Service Tests

Services handle business logic and external API interactions. Mock dependencies and test each method.

### Pattern

1. **Create fresh instance** in beforeEach for isolation
2. **Mock browser APIs** (AudioContext, MediaRecorder, etc.)
3. **Test async methods** with proper await/expect
4. **Test error handling** with rejected promises

### Example: AudioService Test

```typescript
// src/services/audio/__tests__/AudioService.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioService } from '../AudioService';

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(() => {
    service = new AudioService();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('Initialization', () => {
    it('should initialize AudioContext on init()', async () => {
      await service.init();
      expect(global.AudioContext).toHaveBeenCalled();
    });

    it('should throw error when getContext called before init', () => {
      expect(() => service.getContext()).toThrow('AudioContext not initialized');
    });
  });

  describe('Recording', () => {
    it('should start recording with default options', async () => {
      await service.startRecording();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          sampleRate: 48000,
          channelCount: 1,
        }),
      });
    });

    it('should reject stopRecording when no active recording', async () => {
      await expect(service.stopRecording()).rejects.toThrow('No active recording');
    });
  });

  describe('Error Handling', () => {
    it('should handle getUserMedia rejection', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockRejectedValueOnce(new Error('Permission denied'));

      await expect(service.startRecording()).rejects.toThrow('Permission denied');
    });
  });
});
```

### Key Points

- Mock browser APIs in `src/test/setup.ts`
- Test both success and error paths
- Clean up resources in `afterEach`
- Use `vi.fn()` for mock functions

---

## Writing Component Tests

Component tests verify rendering and user interactions. Use React Testing Library's queries and user-event.

### Pattern

1. **Mock child components** to isolate the component under test
2. **Use custom render** from `src/test/utils.tsx`
3. **Test rendering** - what the user sees
4. **Test interactions** - clicks, typing, etc.
5. **Test store integration** - state changes

### Example: AudioTool Component Test

```typescript
// src/components/audio-tool/__tests__/AudioTool.test.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { useAudioToolStore } from '@/stores/useAudioToolStore';

// Mock heavy child components
vi.mock('../WaveformCanvas', () => ({
  WaveformCanvas: () => <div data-testid="waveform-canvas">Waveform</div>,
}));

describe('AudioTool', () => {
  beforeEach(() => {
    act(() => {
      useAudioToolStore.getState().reset();
    });
  });

  it('should render the workspace layout', async () => {
    const AudioTool = (await import('../AudioTool')).default;
    renderWithProviders(<AudioTool />);

    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument();
  });

  it('should toggle play/pause when button clicked', async () => {
    const AudioTool = (await import('../AudioTool')).default;
    const { user } = renderWithProviders(<AudioTool />);

    const playButton = screen.getByTestId('play-pause-button');
    await user.click(playButton);

    await waitFor(() => {
      expect(useAudioToolStore.getState().playback.isPlaying).toBe(true);
    });
  });

  it('should reflect store state changes', async () => {
    const AudioTool = (await import('../AudioTool')).default;
    renderWithProviders(<AudioTool />);

    act(() => {
      useAudioToolStore.getState().play();
    });

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });
  });
});
```

### Key Points

- Use `renderWithProviders()` for Router and Theme context
- Use `user` from render result for interactions
- Await async operations with `waitFor()`
- Mock complex child components to simplify tests
- Use `screen.getByTestId()`, `screen.getByRole()`, etc.

---

## Mocking Zustand Stores

Use the utilities in `src/test/mocks/zustand.ts` for store mocking.

### Available Utilities

```typescript
import {
  registerStoreForReset,
  resetStore,
  resetAllStores,
  setStoreState,
  createMockState,
  mockStoreActions,
  waitForStoreChange,
  createStoreTestHelpers,
  useStoreTestSetup,
} from '@/test/mocks/zustand';
```

### Example: Resetting Stores

```typescript
import { useAudioToolStore } from '@/stores/useAudioToolStore';
import { registerStoreForReset, resetStore } from '@/test/mocks/zustand';

describe('MyTest', () => {
  beforeEach(() => {
    registerStoreForReset(useAudioToolStore);
  });

  afterEach(() => {
    resetStore(useAudioToolStore);
  });
});
```

### Example: Setting Store State

```typescript
import { setStoreState } from '@/test/mocks/zustand';

it('should handle loading state', () => {
  setStoreState(useAudioToolStore, {
    isLoading: true,
    fileId: 'test-file',
  });

  // Now test with this state
});
```

### Example: Mocking Actions

```typescript
import { mockStoreActions } from '@/test/mocks/zustand';

it('should call play action', async () => {
  const mockActions = mockStoreActions(useAudioToolStore, {
    play: vi.fn(),
    pause: vi.fn(),
  });

  // Trigger play action
  await user.click(playButton);

  expect(mockActions.play).toHaveBeenCalled();
});
```

---

## Coverage Requirements

The project requires **80% minimum coverage** across all metrics:

| Metric | Threshold |
|--------|-----------|
| Statements | 80% |
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |

### Checking Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in `./coverage/`:
- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI integration
- `coverage/coverage-final.json` - JSON format

### What to Cover

Priority order for testing:
1. **Stores** - All state mutations and selectors
2. **Services** - All public methods
3. **Utilities** - All helper functions
4. **Components** - Rendering and interactions
5. **Hooks** - Custom hook logic

---

## E2E Test Patterns

E2E tests verify complete user flows in a real browser. They're located in the `e2e/` directory.

### Example: Navigation Test

```typescript
// e2e/example.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Tacctile/i);
  });

  test('should navigate to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Dashboard');

    await expect(page).toHaveURL(/dashboard/);
  });
});
```

### Example: User Flow Test

```typescript
test.describe('Audio Tool', () => {
  test('should upload and play audio file', async ({ page }) => {
    await page.goto('/audio-tool');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-fixtures/audio.mp3');

    // Wait for file to load
    await expect(page.locator('[data-testid="waveform"]')).toBeVisible();

    // Click play
    await page.click('[data-testid="play-button"]');

    // Verify playing state
    await expect(page.locator('[data-testid="pause-button"]')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/example.spec.ts

# Run in headed mode
npx playwright test --headed
```

---

## Test File Organization

```
tacctile_webapp/
├── src/
│   ├── stores/
│   │   ├── __tests__/
│   │   │   ├── useAudioToolStore.test.ts
│   │   │   ├── useTimelineStore.test.ts
│   │   │   └── useHomeStore.test.ts
│   │   └── useAudioToolStore.ts
│   ├── services/
│   │   └── audio/
│   │       ├── __tests__/
│   │       │   └── AudioService.test.ts
│   │       └── AudioService.ts
│   ├── components/
│   │   └── audio-tool/
│   │       ├── __tests__/
│   │       │   └── AudioTool.test.tsx
│   │       └── AudioTool.tsx
│   └── test/
│       ├── setup.ts          # Global test setup
│       ├── utils.tsx         # Custom render, helpers
│       └── mocks/
│           ├── zustand.ts    # Zustand mocking utilities
│           └── handlers.ts   # MSW handlers (template)
├── e2e/
│   └── example.spec.ts       # E2E tests
├── tests/
│   └── README.md             # This file
├── vitest.config.ts          # Vitest configuration
└── playwright.config.ts      # Playwright configuration
```

### Naming Conventions

- Unit tests: `*.test.ts` or `*.test.tsx`
- E2E tests: `*.spec.ts`
- Test utilities: No suffix (just `.ts`)

---

## Quick Reference

### Vitest Matchers

```typescript
expect(value).toBe(expected)           // Strict equality
expect(value).toEqual(expected)        // Deep equality
expect(value).toBeTruthy()             // Truthy value
expect(value).toBeNull()               // Null value
expect(array).toHaveLength(n)          // Array length
expect(fn).toHaveBeenCalled()          // Function was called
expect(fn).toHaveBeenCalledWith(args)  // Function called with args
```

### Testing Library Queries

```typescript
screen.getByText('Hello')              // Exact text match
screen.getByRole('button')             // By ARIA role
screen.getByTestId('my-element')       // By data-testid
screen.queryByText('Hello')            // Returns null if not found
screen.findByText('Hello')             // Async, returns promise
```

### Playwright Locators

```typescript
page.locator('button')                 // CSS selector
page.locator('text=Click me')          // Text content
page.locator('[data-testid="my-id"]')  // Data attribute
page.getByRole('button', { name: 'Submit' })  // ARIA role
```

---

## Need Help?

- Check existing test files for patterns
- Consult the [Vitest documentation](https://vitest.dev/)
- Consult the [Testing Library documentation](https://testing-library.com/)
- Consult the [Playwright documentation](https://playwright.dev/)
