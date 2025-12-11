/**
 * Stores Index
 * Zustand stores for global state management
 */

export { useAudioToolStore, default as audioToolStore } from './useAudioToolStore';
export {
  useAudioUrl,
  usePlayback,
  useViewMode,
  useSelections,
  useCurrentSelection,
  useLoopRegions,
  useFilterSettings,
  useRecipes,
  useIterations,
  useFindings,
  useWaveformSettings,
  useIsLoading,
  useIsProcessing,
  useAudioError,
  useFiltersBypassed,
} from './useAudioToolStore';
export * from './usePlayheadStore';

// AI Sidekick
export {
  useAISidekickStore,
  useSendToAISidekick,
  selectMessages,
  selectIsLoading,
  selectError,
  selectIsCollapsed,
  selectIsSearchMode,
  selectSearchResults,
  selectApiKey,
} from './useAISidekickStore';
