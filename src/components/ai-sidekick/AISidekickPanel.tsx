/**
 * AISidekickPanel Component
 * Main AI assistant panel with chat interface
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  InputAdornment,
  Collapse,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAISidekickStore } from '@/stores/useAISidekickStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import type { ChatMessage, AISidekickContext } from '@/types/ai-sidekick';
import { KnoxAvatar, type KnoxState } from './KnoxAvatar';

// ============================================================================
// CONSTANTS
// ============================================================================

const PANEL_WIDTH = 320;
const COLLAPSED_WIDTH = 40;
const HEADER_HEIGHT = 40;
const INPUT_AREA_HEIGHT = 64;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isCollapsed',
})<{ isCollapsed: boolean }>(({ isCollapsed }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: isCollapsed ? COLLAPSED_WIDTH : PANEL_WIDTH,
  minWidth: isCollapsed ? COLLAPSED_WIDTH : PANEL_WIDTH,
  backgroundColor: '#181818',
  borderLeft: '1px solid #252525',
  transition: 'width 150ms ease-in-out, min-width 150ms ease-in-out',
  overflow: 'hidden',
}));

const Header = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: HEADER_HEIGHT,
  minHeight: HEADER_HEIGHT,
  padding: '0 8px',
  borderBottom: '1px solid #252525',
  backgroundColor: '#161616',
});

const HeaderTitle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  overflow: 'hidden',
});

const HeaderActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const ChatArea = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '12px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isUser' && prop !== 'isSystem',
})<{ isUser: boolean; isSystem: boolean }>(({ isUser, isSystem }) => ({
  padding: '8px 12px',
  borderRadius: 8,
  maxWidth: '90%',
  alignSelf: isUser ? 'flex-end' : 'flex-start',
  backgroundColor: isSystem ? '#1a2a2a' : isUser ? 'rgba(25, 171, 181, 0.15)' : '#1e1e1e',
  border: `1px solid ${isSystem ? '#254545' : isUser ? 'rgba(25, 171, 181, 0.3)' : '#252525'}`,
  wordWrap: 'break-word',
  whiteSpace: 'pre-wrap',
}));

const MessageTimestamp = styled(Typography)({
  fontSize: '0.625rem',
  color: '#555',
  marginTop: 4,
});

const InputArea = styled(Box)({
  display: 'flex',
  gap: 8,
  padding: '8px',
  borderTop: '1px solid #252525',
  backgroundColor: '#161616',
  minHeight: INPUT_AREA_HEIGHT,
});

const SearchResultItem = styled(Box)({
  padding: '8px 12px',
  borderRadius: 4,
  backgroundColor: '#1e1e1e',
  border: '1px solid #252525',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#252525',
    borderColor: '#19abb5',
  },
});

const PlaceholderContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  textAlign: 'center',
  color: '#555',
});

const CollapsedContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
});

// ============================================================================
// DUMMY MESSAGES FOR DEMO
// ============================================================================

const DUMMY_MESSAGES: ChatMessage[] = [
  {
    id: 'dummy-1',
    role: 'assistant',
    content: 'Hello! I\'m Knox. I can help you analyze your evidence and understand the tools. What would you like to know?',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: 'dummy-2',
    role: 'user',
    content: 'What can you help me with?',
    timestamp: new Date(Date.now() - 45000),
  },
  {
    id: 'dummy-3',
    role: 'assistant',
    content: 'I can help you with:\n\n- **Understanding tools**: Explain how to use the audio, video, and image analysis features\n- **Analyzing evidence**: Help interpret findings and anomalies\n- **Workflow guidance**: Suggest best practices for your investigation\n- **Context awareness**: I can see which tool you\'re using and what file is loaded\n\nJust ask me anything!',
    timestamp: new Date(Date.now() - 30000),
  },
];

// Dummy responses for testing Knox states
const DUMMY_RESPONSES = [
  "Got it! Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Interesting question! Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.",
  "Let me help with that. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.",
  "Found it! Excepteur sint occaecat cupidatat non proident.",
  "Here's what I found: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Simple markdown rendering (basic support)
function renderMarkdown(text: string): React.ReactNode {
  // Split by lines and process
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    // Bold
    let processedLine: React.ReactNode = line.replace(/\*\*(.*?)\*\*/g, (_, content) => content);

    // Replace bold markers with actual bold spans
    const boldParts = line.split(/(\*\*.*?\*\*)/);
    if (boldParts.length > 1) {
      processedLine = boldParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    }

    // Handle bullet points
    if (line.startsWith('- ')) {
      elements.push(
        <Box key={index} sx={{ pl: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <span style={{ color: '#19abb5' }}></span>
          <span>{typeof processedLine === 'string' ? processedLine.slice(2) : processedLine}</span>
        </Box>
      );
    } else if (line.trim() === '') {
      elements.push(<Box key={index} sx={{ height: 8 }} />);
    } else {
      elements.push(<Box key={index}>{processedLine}</Box>);
    }
  });

  return <>{elements}</>;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface AISidekickPanelProps {
  context?: Partial<AISidekickContext>;
}

export const AISidekickPanel: React.FC<AISidekickPanelProps> = ({ context }) => {
  const [input, setInput] = useState('');
  const [knoxState, setKnoxState] = useState<KnoxState>('idle');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store state
  const {
    messages,
    isLoading,
    error,
    isCollapsed,
    isSearchMode,
    searchQuery,
    searchResults,
    apiKey,
    sendMessage,
    clearMessages,
    toggleCollapse,
    toggleSearchMode,
    setSearchQuery,
    searchMessages,
    loadMessages,
  } = useAISidekickStore();

  // Get current tool context from navigation store
  const activeTool = useNavigationStore((state) => state.activeTool);
  const loadedFiles = useNavigationStore((state) => state.loadedFiles);

  // Build context for API calls
  const fullContext: AISidekickContext = useMemo(() => ({
    currentTool: context?.currentTool || activeTool,
    loadedFileName: context?.loadedFileName || loadedFiles.video || loadedFiles.audio || loadedFiles.images || null,
    flagCount: context?.flagCount || 0,
    sessionId: context?.sessionId || null,
  }), [context, activeTool, loadedFiles]);

  // Display messages (use dummy if empty and no API key, or local messages in demo mode)
  const displayMessages = useMemo(() => {
    // If we have local messages (demo mode), show those
    if (localMessages.length > 0) {
      return [...DUMMY_MESSAGES, ...localMessages];
    }
    // If no API key and no messages, show dummy messages
    if (messages.length === 0 && !apiKey) {
      return DUMMY_MESSAGES;
    }
    return messages;
  }, [messages, apiKey, localMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatEndRef.current && !isSearchMode) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, isSearchMode]);

  // Load dummy messages on first render if no API key
  useEffect(() => {
    if (messages.length === 0 && !apiKey) {
      // Messages will show dummy data via displayMessages
    }
  }, [messages.length, apiKey]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    };
  }, []);

  // Handle Knox state based on typing
  useEffect(() => {
    if (isTyping && input.trim()) {
      setKnoxState('typing');
    } else if (knoxState === 'typing' && !isTyping) {
      // Return to idle when typing stops
      setKnoxState('idle');
    }
  }, [isTyping, input, knoxState]);

  // Handle input change with typing detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Mark as typing
    setIsTyping(true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing state after 1.5s of no input
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  }, []);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    if (knoxState === 'idle') {
      setKnoxState('typing');
    }
  }, [knoxState]);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    if (knoxState === 'typing' && !input.trim()) {
      setKnoxState('idle');
    }
  }, [knoxState, input]);

  // Simulate dummy response with Knox states
  const simulateDummyResponse = useCallback((userMessage: string) => {
    // Add user message to local messages
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setLocalMessages(prev => [...prev, userMsg]);

    // Set thinking state
    setKnoxState('thinking');

    // Simulate thinking delay (1-2 seconds)
    const thinkingDelay = 1000 + Math.random() * 1000;

    setTimeout(() => {
      // Pick random response
      const response = DUMMY_RESPONSES[Math.floor(Math.random() * DUMMY_RESPONSES.length)];

      // Set responding state
      setKnoxState('responding');

      // Add assistant message
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setLocalMessages(prev => [...prev, assistantMsg]);

      // After a short delay, show complete state
      setTimeout(() => {
        setKnoxState('complete');

        // Clear complete timeout ref if exists
        if (completeTimeoutRef.current) {
          clearTimeout(completeTimeoutRef.current);
        }

        // Return to idle after complete animation
        completeTimeoutRef.current = setTimeout(() => {
          setKnoxState('idle');
        }, 500);
      }, 300);
    }, thinkingDelay);
  }, []);

  // Handle send message
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || knoxState === 'thinking' || knoxState === 'responding') return;

    setInput('');
    setIsTyping(false);

    // Use dummy mode if no API key
    if (!apiKey || isDemoMode) {
      simulateDummyResponse(trimmedInput);
      return;
    }

    // Real API mode
    setKnoxState('thinking');
    await sendMessage(trimmedInput, fullContext);
    setKnoxState('complete');

    // Return to idle after complete animation
    setTimeout(() => {
      setKnoxState('idle');
    }, 500);
  }, [input, isLoading, knoxState, apiKey, isDemoMode, simulateDummyResponse, sendMessage, fullContext]);

  // Handle key press (Enter to send, Shift+Enter for newline)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      searchMessages(query);
    }
  }, [setSearchQuery, searchMessages]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  // Render collapsed state
  if (isCollapsed) {
    return (
      <PanelContainer isCollapsed={true}>
        <CollapsedContent onClick={toggleCollapse}>
          <Tooltip title="Expand Knox" placement="left">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KnoxAvatar state={knoxState} size={24} />
            </Box>
          </Tooltip>
        </CollapsedContent>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer isCollapsed={false}>
      {/* Header */}
      <Header>
        <HeaderTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: -0.5 }}>
            <KnoxAvatar state={knoxState} size={22} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 500, color: '#ccc' }} noWrap>
            Knox
          </Typography>
        </HeaderTitle>

        <HeaderActions>
          <Tooltip title="Search conversations">
            <IconButton
              size="small"
              onClick={toggleSearchMode}
              sx={{
                color: isSearchMode ? '#19abb5' : '#808080',
                '&:hover': { color: '#19abb5' },
              }}
            >
              <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 18 }}>
                search
              </Box>
            </IconButton>
          </Tooltip>

          <Tooltip title="New conversation">
            <IconButton
              size="small"
              onClick={handleNewConversation}
              sx={{ color: '#808080', '&:hover': { color: '#19abb5' } }}
            >
              <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 18 }}>
                add_comment
              </Box>
            </IconButton>
          </Tooltip>

          <Tooltip title="Collapse panel">
            <IconButton
              size="small"
              onClick={toggleCollapse}
              sx={{ color: '#808080', '&:hover': { color: '#19abb5' } }}
            >
              <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 18 }}>
                chevron_right
              </Box>
            </IconButton>
          </Tooltip>
        </HeaderActions>
      </Header>

      {/* Search Mode */}
      <Collapse in={isSearchMode}>
        <Box sx={{ p: 1, borderBottom: '1px solid #252525', backgroundColor: '#161616' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 18, color: '#555' }}>
                    search
                  </Box>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#1e1e1e',
                fontSize: '0.8125rem',
              },
            }}
          />
        </Box>
      </Collapse>

      {/* Chat Area or Search Results */}
      <ChatArea>
        {isSearchMode && searchQuery ? (
          // Search Results
          searchResults.length > 0 ? (
            searchResults.map((result) => (
              <SearchResultItem key={result.messageId}>
                <Typography variant="caption" sx={{ color: '#808080' }}>
                  {result.role === 'user' ? 'You' : 'AI'} - {formatTime(new Date(result.timestamp))}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc', mt: 0.5 }}>
                  {result.content.length > 100 ? `${result.content.slice(0, 100)}...` : result.content}
                </Typography>
              </SearchResultItem>
            ))
          ) : (
            <PlaceholderContainer>
              <Typography variant="body2">No results found</Typography>
            </PlaceholderContainer>
          )
        ) : !apiKey ? (
          // Placeholder when no API key
          <>
            {displayMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                isUser={msg.role === 'user'}
                isSystem={msg.role === 'system'}
              >
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  {renderMarkdown(msg.content)}
                </Typography>
                <MessageTimestamp>
                  {formatTime(new Date(msg.timestamp))}
                </MessageTimestamp>
              </MessageBubble>
            ))}

            <PlaceholderContainer sx={{ mt: 2, py: 2, backgroundColor: '#1a1a1a', borderRadius: 1 }}>
              <Box
                component="span"
                className="material-symbols-outlined"
                sx={{ fontSize: 32, mb: 1, color: '#555' }}
              >
                key
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                Configure API Key
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                Set your Gemini API key in settings to enable AI features
              </Typography>
            </PlaceholderContainer>

            <div ref={chatEndRef} />
          </>
        ) : (
          // Chat Messages
          <>
            {displayMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                isUser={msg.role === 'user'}
                isSystem={msg.role === 'system'}
              >
                <Typography variant="body2" sx={{ color: '#ccc' }} component="div">
                  {renderMarkdown(msg.content)}
                </Typography>
                <MessageTimestamp>
                  {formatTime(new Date(msg.timestamp))}
                </MessageTimestamp>
              </MessageBubble>
            ))}

            {(isLoading || knoxState === 'thinking') && (
              <MessageBubble isUser={false} isSystem={false}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                  <KnoxAvatar state="thinking" size={18} />
                  <Typography variant="body2" sx={{ color: '#808080' }}>
                    Thinking...
                  </Typography>
                </Box>
              </MessageBubble>
            )}

            {error && (
              <Box sx={{
                p: 1.5,
                backgroundColor: 'rgba(196, 92, 92, 0.1)',
                border: '1px solid rgba(196, 92, 92, 0.3)',
                borderRadius: 1,
              }}>
                <Typography variant="caption" sx={{ color: '#c45c5c' }}>
                  {error}
                </Typography>
              </Box>
            )}

            <div ref={chatEndRef} />
          </>
        )}
      </ChatArea>

      {/* Input Area */}
      {!isSearchMode && (
        <InputArea>
          <TextField
            inputRef={inputRef}
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder="Ask Knox..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            disabled={knoxState === 'thinking' || knoxState === 'responding'}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#1e1e1e',
                fontSize: '0.8125rem',
                transition: 'border-color 180ms ease-out, box-shadow 180ms ease-out',
                '&.Mui-focused': {
                  boxShadow: '0 0 0 2px rgba(25, 171, 181, 0.15)',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#151515',
                },
              },
            }}
          />
          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                onClick={handleSend}
                disabled={knoxState === 'thinking' || knoxState === 'responding' || !input.trim()}
                sx={{
                  color: input.trim() ? '#19abb5' : '#555',
                  '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
                  '&.Mui-disabled': { color: '#333' },
                  transition: 'color 180ms ease-out',
                }}
              >
                <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 20 }}>
                  send
                </Box>
              </IconButton>
            </span>
          </Tooltip>
        </InputArea>
      )}
    </PanelContainer>
  );
};

export default AISidekickPanel;
