/**
 * Hooks Index
 * Re-exports all custom hooks
 */

// Subscription
export { useSubscription, useRequirePro, useQuotaStatus } from './useSubscription';

// Cloud Storage
export { useCloudStorage, useFileBrowser } from './useCloudStorage';

// Investigations & Project Files
export {
  useInvestigations,
  useInvestigation,
  useProjectFiles,
  useTeamMembers,
  useSyncedPlayback,
} from './useInvestigation';

// File Flags
export {
  useFileFlags,
  useFlagComments,
  useFlagTypeSuggestion,
  useFlagTypes,
  useFlagExport,
} from './useFileFlags';

// Keyboard Shortcuts
export {
  useKeyboardShortcuts,
  createPlaybackShortcuts,
  createEditingShortcuts,
  createViewShortcuts,
  createNavigationShortcuts,
  formatShortcut,
} from './useKeyboardShortcuts';
export type { KeyboardShortcut } from './useKeyboardShortcuts';

// Optimized Media Playback
export {
  useOptimizedVideo,
  useOptimizedAudio,
  useOptimizedMediaPlayback,
} from './useOptimizedMedia';
