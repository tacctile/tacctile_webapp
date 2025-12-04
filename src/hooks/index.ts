/**
 * Hooks Index
 * Re-exports all custom hooks
 */

// Subscription
export { useSubscription, useRequirePro, useQuotaStatus } from './useSubscription';

// Cloud Storage
export { useCloudStorage, useFileBrowser } from './useCloudStorage';

// Investigations & Evidence
export {
  useInvestigations,
  useInvestigation,
  useEvidence,
  useTeamMembers,
  useSyncedPlayback,
} from './useInvestigation';

// Evidence Flags
export {
  useEvidenceFlags,
  useFlagComments,
  useFlagTypeSuggestion,
  useFlagTypes,
  useFlagExport,
} from './useEvidenceFlags';

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
