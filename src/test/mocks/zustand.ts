/**
 * Zustand Store Mocking Utilities
 *
 * This file provides utilities for mocking Zustand stores in tests.
 * It handles the unique challenges of testing Zustand stores, including:
 * - Resetting store state between tests
 * - Partial state mocking
 * - Action mocking
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import type { StoreApi, UseBoundStore } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

type StoreState<T> = T extends UseBoundStore<StoreApi<infer S>> ? S : never;

// ============================================================================
// STORE RESET UTILITIES
// ============================================================================

/**
 * Map to store initial states of stores for reset functionality
 */
const initialStates = new Map<UseBoundStore<StoreApi<unknown>>, unknown>();

/**
 * Register a store's initial state for automatic reset between tests
 *
 * @example
 * ```tsx
 * import { useAudioToolStore } from '@/stores/useAudioToolStore';
 * import { registerStoreForReset } from '@/test/mocks/zustand';
 *
 * beforeAll(() => {
 *   registerStoreForReset(useAudioToolStore);
 * });
 * ```
 */
export function registerStoreForReset<T>(store: UseBoundStore<StoreApi<T>>): void {
  if (!initialStates.has(store as UseBoundStore<StoreApi<unknown>>)) {
    initialStates.set(store as UseBoundStore<StoreApi<unknown>>, store.getState());
  }
}

/**
 * Reset a store to its initial state
 *
 * @example
 * ```tsx
 * afterEach(() => {
 *   resetStore(useAudioToolStore);
 * });
 * ```
 */
export function resetStore<T>(store: UseBoundStore<StoreApi<T>>): void {
  const initialState = initialStates.get(store as UseBoundStore<StoreApi<unknown>>);
  if (initialState) {
    act(() => {
      store.setState(initialState as T, true);
    });
  }
}

/**
 * Reset all registered stores to their initial states
 *
 * @example
 * ```tsx
 * afterEach(() => {
 *   resetAllStores();
 * });
 * ```
 */
export function resetAllStores(): void {
  initialStates.forEach((initialState, store) => {
    act(() => {
      store.setState(initialState, true);
    });
  });
}

// ============================================================================
// STATE MOCKING UTILITIES
// ============================================================================

/**
 * Set a store's state with partial updates (wrapped in act)
 *
 * @example
 * ```tsx
 * setStoreState(useAudioToolStore, { isPlaying: true, currentTime: 30 });
 * ```
 */
export function setStoreState<T>(
  store: UseBoundStore<StoreApi<T>>,
  partialState: Partial<T>
): void {
  act(() => {
    store.setState(partialState as T);
  });
}

/**
 * Create a mock store state with partial overrides
 *
 * @example
 * ```tsx
 * const mockState = createMockState(useAudioToolStore, {
 *   isLoading: false,
 *   audioUrl: 'blob:test-url',
 * });
 * ```
 */
export function createMockState<T>(
  store: UseBoundStore<StoreApi<T>>,
  overrides: Partial<T> = {}
): T {
  return {
    ...store.getState(),
    ...overrides,
  };
}

// ============================================================================
// ACTION MOCKING UTILITIES
// ============================================================================

/**
 * Mock specific actions in a store
 *
 * @example
 * ```tsx
 * const mockActions = mockStoreActions(useAudioToolStore, {
 *   play: vi.fn(),
 *   pause: vi.fn(),
 * });
 *
 * // Later verify calls
 * expect(mockActions.play).toHaveBeenCalled();
 * ```
 */
export function mockStoreActions<T extends Record<string, unknown>>(
  store: UseBoundStore<StoreApi<T>>,
  actionMocks: Partial<{ [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? ReturnType<typeof vi.fn> : never }>
): typeof actionMocks {
  const originalState = store.getState();

  act(() => {
    store.setState({
      ...originalState,
      ...actionMocks,
    } as T, true);
  });

  return actionMocks;
}

// ============================================================================
// SUBSCRIPTION UTILITIES
// ============================================================================

/**
 * Wait for a store state change
 *
 * @example
 * ```tsx
 * const unsubscribe = await waitForStoreChange(
 *   useAudioToolStore,
 *   (state) => state.isLoading === false
 * );
 * ```
 */
export function waitForStoreChange<T>(
  store: UseBoundStore<StoreApi<T>>,
  predicate: (state: T) => boolean,
  timeout = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if condition is already met
    if (predicate(store.getState())) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timeout waiting for store change'));
    }, timeout);

    const unsubscribe = store.subscribe((state) => {
      if (predicate(state)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      }
    });
  });
}

// ============================================================================
// TEST SETUP HELPERS
// ============================================================================

/**
 * Create setup and teardown functions for a set of stores
 *
 * @example
 * ```tsx
 * const { setupStores, teardownStores } = createStoreTestHelpers([
 *   useAudioToolStore,
 *   useTimelineStore,
 * ]);
 *
 * beforeEach(setupStores);
 * afterEach(teardownStores);
 * ```
 */
export function createStoreTestHelpers(stores: UseBoundStore<StoreApi<unknown>>[]) {
  return {
    setupStores: () => {
      stores.forEach((store) => registerStoreForReset(store));
    },
    teardownStores: () => {
      stores.forEach((store) => resetStore(store));
    },
  };
}

/**
 * Hook for setting up store tests with automatic cleanup
 *
 * @example
 * ```tsx
 * describe('AudioTool', () => {
 *   useStoreTestSetup([useAudioToolStore]);
 *
 *   it('should play audio', () => {
 *     // Store is automatically reset after each test
 *   });
 * });
 * ```
 */
export function useStoreTestSetup(stores: UseBoundStore<StoreApi<unknown>>[]): void {
  beforeEach(() => {
    stores.forEach((store) => registerStoreForReset(store));
  });

  afterEach(() => {
    stores.forEach((store) => resetStore(store));
  });
}

// ============================================================================
// SELECTOR TESTING UTILITIES
// ============================================================================

/**
 * Test a selector function with mock state
 *
 * @example
 * ```tsx
 * const result = testSelector(
 *   selectVisibleItems,
 *   { items: mockItems, dataLayers: mockLayers }
 * );
 * expect(result).toHaveLength(5);
 * ```
 */
export function testSelector<T, R>(
  selector: (state: T) => R,
  mockState: T
): R {
  return selector(mockState);
}
