/**
 * AI Sidekick Store
 * Zustand store for AI assistant panel state management
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { geminiService } from '@/services/ai/GeminiService';
import type {
  ChatMessage,
  ChatSearchResult,
  AISidekickContext,
  AISidekickState,
  AISidekickActions,
} from '@/types/ai-sidekick';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function searchInMessages(messages: ChatMessage[], query: string): ChatSearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: ChatSearchResult[] = [];

  for (const message of messages) {
    const lowerContent = message.content.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index !== -1) {
      results.push({
        messageId: message.id,
        content: message.content,
        timestamp: message.timestamp,
        role: message.role,
        highlightIndices: [{ start: index, end: index + query.length }],
      });
    }
  }

  return results;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AISidekickState = {
  messages: [],
  isLoading: false,
  error: null,
  isCollapsed: false,
  isSearchMode: false,
  searchQuery: '',
  searchResults: [],
  apiKey: null,
  model: 'gemini-1.5-flash',
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useAISidekickStore = create<AISidekickState & AISidekickActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ======================================================================
      // CHAT OPERATIONS
      // ======================================================================

      sendMessage: async (content: string, context: AISidekickContext) => {
        const { apiKey, model, messages } = get();

        if (!apiKey) {
          set({ error: 'API key not configured. Please set your Gemini API key in settings.' });
          return;
        }

        // Add user message
        const userMessage: ChatMessage = {
          id: generateId(),
          role: 'user',
          content,
          timestamp: new Date(),
          metadata: {
            toolContext: context.currentTool,
            loadedFileName: context.loadedFileName || undefined,
            flagCount: context.flagCount,
          },
        };

        set((state) => {
          state.messages.push(userMessage);
          state.isLoading = true;
          state.error = null;
        });

        try {
          // Initialize service if needed
          if (!geminiService.isReady()) {
            geminiService.init(apiKey, model);
          }

          // Send message and get response
          const response = await geminiService.sendMessage(content, context, [...messages, userMessage]);

          // Add assistant message
          const assistantMessage: ChatMessage = {
            id: response.id,
            role: 'assistant',
            content: response.content,
            timestamp: response.timestamp,
          };

          set((state) => {
            state.messages.push(assistantMessage);
            state.isLoading = false;
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
          set({ error: errorMessage, isLoading: false });
        }
      },

      addSystemMessage: (content: string, metadata?: ChatMessage['metadata']) => {
        const systemMessage: ChatMessage = {
          id: generateId(),
          role: 'system',
          content,
          timestamp: new Date(),
          metadata,
        };

        set((state) => {
          state.messages.push(systemMessage);
        });
      },

      clearMessages: () => {
        set((state) => {
          state.messages = [];
          state.searchResults = [];
          state.searchQuery = '';
        });
        geminiService.resetChat();
      },

      loadMessages: (messages: ChatMessage[]) => {
        set((state) => {
          state.messages = messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp), // Ensure Date objects
          }));
        });
      },

      // ======================================================================
      // UI OPERATIONS
      // ======================================================================

      toggleCollapse: () => {
        set((state) => {
          state.isCollapsed = !state.isCollapsed;
        });
      },

      setCollapsed: (collapsed: boolean) => {
        set({ isCollapsed: collapsed });
      },

      toggleSearchMode: () => {
        set((state) => {
          state.isSearchMode = !state.isSearchMode;
          if (!state.isSearchMode) {
            state.searchQuery = '';
            state.searchResults = [];
          }
        });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      searchMessages: (query: string) => {
        const { messages } = get();
        const results = searchInMessages(messages, query);
        set({ searchResults: results, searchQuery: query });
      },

      // ======================================================================
      // SETTINGS
      // ======================================================================

      setApiKey: (key: string) => {
        set({ apiKey: key });
        if (key) {
          geminiService.init(key, get().model);
        }
      },

      setModel: (model: 'gemini-1.5-flash' | 'gemini-1.5-pro') => {
        set({ model });
        geminiService.setModel(model);
      },

      // ======================================================================
      // STATE MANAGEMENT
      // ======================================================================

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      reset: () => {
        set(initialState);
        geminiService.resetChat();
      },
    })),
    {
      name: 'tacctile-ai-sidekick',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist settings and UI preferences, not chat messages
        apiKey: state.apiKey,
        model: state.model,
        isCollapsed: state.isCollapsed,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AISidekickState> | undefined;
        if (!persisted) return currentState;
        return {
          ...currentState,
          apiKey: persisted.apiKey ?? currentState.apiKey,
          model: persisted.model ?? currentState.model,
          isCollapsed: persisted.isCollapsed ?? currentState.isCollapsed,
        };
      },
    }
  )
);

// ============================================================================
// SELECTORS (for performance optimization with useShallow)
// ============================================================================

export const selectMessages = (state: AISidekickState & AISidekickActions) => state.messages;
export const selectIsLoading = (state: AISidekickState & AISidekickActions) => state.isLoading;
export const selectError = (state: AISidekickState & AISidekickActions) => state.error;
export const selectIsCollapsed = (state: AISidekickState & AISidekickActions) => state.isCollapsed;
export const selectIsSearchMode = (state: AISidekickState & AISidekickActions) => state.isSearchMode;
export const selectSearchResults = (state: AISidekickState & AISidekickActions) => state.searchResults;
export const selectApiKey = (state: AISidekickState & AISidekickActions) => state.apiKey;

// ============================================================================
// HOOK FOR TOOL INTEGRATION
// ============================================================================

/**
 * Hook for tools to send analysis results to AI Sidekick
 * Usage: const sendToAI = useSendToAISidekick();
 *        sendToAI('analysis', 'Found anomaly at timestamp 00:05:23...');
 */
export const useSendToAISidekick = () => {
  const addSystemMessage = useAISidekickStore((state) => state.addSystemMessage);

  return (type: 'analysis' | 'note' | 'finding', content: string) => {
    addSystemMessage(content, { analysisType: type });
  };
};

export default useAISidekickStore;
