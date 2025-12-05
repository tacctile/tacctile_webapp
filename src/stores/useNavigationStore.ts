import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ToolType = 'home' | 'session' | 'video' | 'audio' | 'images' | 'streaming' | 'workspace-demo';

interface NavigationState {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // Active session ID (for session-based navigation)
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  // Quick analyze mode (no session overhead)
  isQuickAnalyzeMode: boolean;
  quickAnalyzeFile: { name: string; type: 'video' | 'audio' | 'image'; url: string } | null;
  setQuickAnalyzeMode: (enabled: boolean, file?: { name: string; type: 'video' | 'audio' | 'image'; url: string } | null) => void;

  // Track which file is loaded in each tool
  loadedFiles: {
    video: string | null;
    audio: string | null;
    images: string | null;
  };
  setLoadedFile: (tool: 'video' | 'audio' | 'images', fileId: string | null) => void;

  // Navigate to tool and optionally load a file
  navigateToTool: (tool: ToolType, fileId?: string) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set, get) => ({
      activeTool: 'home',

      activeSessionId: null,
      isQuickAnalyzeMode: false,
      quickAnalyzeFile: null,

      loadedFiles: {
        video: null,
        audio: null,
        images: null,
      },

      setActiveTool: (tool) => set({ activeTool: tool }),

      setActiveSessionId: (id) => set({ activeSessionId: id }),

      setQuickAnalyzeMode: (enabled, file) => set({
        isQuickAnalyzeMode: enabled,
        quickAnalyzeFile: file || null,
      }),

      setLoadedFile: (tool, fileId) => set((state) => ({
        loadedFiles: { ...state.loadedFiles, [tool]: fileId },
      })),

      navigateToTool: (tool, fileId) => {
        set({ activeTool: tool });
        if (fileId && (tool === 'video' || tool === 'audio' || tool === 'images')) {
          set((state) => ({
            loadedFiles: { ...state.loadedFiles, [tool]: fileId },
          }));
        }
      },
    }),
    {
      name: 'tacctile-navigation',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeTool: state.activeTool,
        activeSessionId: state.activeSessionId,
        isQuickAnalyzeMode: state.isQuickAnalyzeMode,
        // Don't persist quickAnalyzeFile URL as it's a blob URL
      }),
    }
  )
);

// Helper hook for components
export const useNavigateToEvidence = () => {
  const navigateToTool = useNavigationStore((state) => state.navigateToTool);

  return (evidence: { id: string; type: 'video' | 'audio' | 'image' }) => {
    const toolMap = {
      video: 'video' as const,
      audio: 'audio' as const,
      image: 'images' as const, // Map 'image' evidence type to 'images' tool
    };
    navigateToTool(toolMap[evidence.type], evidence.id);
  };
};
