/**
 * AI Sidekick Types
 * Types for the AI assistant panel integrated with investigation tools
 */

// ============================================================================
// CHAT MESSAGE TYPES
// ============================================================================

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;

  // Optional metadata for context-aware messages
  metadata?: {
    toolContext?: string;
    loadedFileName?: string;
    flagCount?: number;
    analysisType?: 'analysis' | 'note' | 'finding';
  };
}

export interface ChatHistory {
  id: string;
  sessionId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface AISidekickContext {
  currentTool: string;
  loadedFileName: string | null;
  flagCount: number;
  sessionId: string | null;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface ChatSearchResult {
  messageId: string;
  content: string;
  timestamp: Date;
  role: ChatMessageRole;
  highlightIndices: { start: number; end: number }[];
}

// ============================================================================
// ACTION TYPES (for future use)
// ============================================================================

export type ActionType = 'save_note' | 'create_flag' | 'export' | 'navigate';

export interface ActionButton {
  id: string;
  type: ActionType;
  label: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface GeminiOptions {
  apiKey: string;
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro';
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  id: string;
  content: string;
  role: 'assistant';
  timestamp: Date;
  tokensUsed?: number;
}

// ============================================================================
// STORE STATE TYPES
// ============================================================================

export interface AISidekickState {
  // Chat data
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // UI state
  isCollapsed: boolean;
  isSearchMode: boolean;
  searchQuery: string;
  searchResults: ChatSearchResult[];

  // Settings (persisted separately)
  apiKey: string | null;
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro';
}

export interface AISidekickActions {
  // Chat operations
  sendMessage: (content: string, context: AISidekickContext) => Promise<void>;
  addSystemMessage: (content: string, metadata?: ChatMessage['metadata']) => void;
  clearMessages: () => void;
  loadMessages: (messages: ChatMessage[]) => void;

  // UI operations
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleSearchMode: () => void;
  setSearchQuery: (query: string) => void;
  searchMessages: (query: string) => void;

  // Settings
  setApiKey: (key: string) => void;
  setModel: (model: 'gemini-1.5-flash' | 'gemini-1.5-pro') => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// ============================================================================
// HOOK FOR TOOL INTEGRATION
// ============================================================================

/**
 * Function signature for sending analysis results to AI Sidekick
 * Tools can import and use this to push content to the chat
 */
export type SendToAISidekickFn = (
  type: 'analysis' | 'note' | 'finding',
  content: string
) => void;
