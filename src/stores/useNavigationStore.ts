import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ToolType = 'home' | 'timeline' | 'video' | 'audio' | 'images' | 'streaming' | 'export' | 'notes' | 'team' | 'settings' | 'workspace-demo';

interface NavigationState {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // Active project ID (for project-based navigation)
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  // Quick analyze mode (no project overhead)
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

      activeProjectId: null,
      isQuickAnalyzeMode: false,
      quickAnalyzeFile: null,

      loadedFiles: {
        video: null,
        audio: null,
        images: null,
      },

      setActiveTool: (tool) => set({ activeTool: tool }),

      setActiveProjectId: (id) => set({ activeProjectId: id }),

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
        activeProjectId: state.activeProjectId,
        isQuickAnalyzeMode: state.isQuickAnalyzeMode,
        // Don't persist quickAnalyzeFile URL as it's a blob URL
      }),
    }
  )
);

// Helper hook for components
export const useNavigateToFile = () => {
  const navigateToTool = useNavigationStore((state) => state.navigateToTool);

  return (file: { id: string; type: 'video' | 'audio' | 'image' }) => {
    const toolMap = {
      video: 'video' as const,
      audio: 'audio' as const,
      image: 'images' as const, // Map 'image' file type to 'images' tool
    };
    navigateToTool(toolMap[file.type], file.id);
  };
};
