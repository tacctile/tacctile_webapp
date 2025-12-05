import { create } from 'zustand';

export type ToolType = 'session' | 'video' | 'audio' | 'images' | 'streaming' | 'workspace-demo';

interface NavigationState {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

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

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeTool: 'session',

  loadedFiles: {
    video: null,
    audio: null,
    images: null,
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

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
}));

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
