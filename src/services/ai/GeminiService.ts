/**
 * GeminiService - AI capabilities integration
 * Handles all interactions with Google Generative AI API
 */

import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import type { ChatMessage, AISidekickContext, GeminiResponse } from '@/types/ai-sidekick';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SYSTEM_PROMPT_FREE = `You are Tacctile AI Sidekick. Help users understand the app and their workflow. You can see their current context: {toolName}, {loadedFileName}, {flagCount}. Be concise and helpful.`;

const SYSTEM_PROMPT_PAID = `You are Tacctile AI Sidekick. Help users understand the app and their workflow. You can see their current context: {toolName}, {loadedFileName}, {flagCount}. Be concise and helpful.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function buildSystemPrompt(context: AISidekickContext, isPaidTier: boolean = false): string {
  const template = isPaidTier ? SYSTEM_PROMPT_PAID : SYSTEM_PROMPT_FREE;
  return template
    .replace('{toolName}', context.currentTool || 'unknown')
    .replace('{loadedFileName}', context.loadedFileName || 'none')
    .replace('{flagCount}', String(context.flagCount || 0));
}

function formatHistoryForGemini(messages: ChatMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  return messages
    .filter(msg => msg.role !== 'system')
    .map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    }));
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class GeminiService {
  private client: GoogleGenerativeAI | null = null;
  private chat: ChatSession | null = null;
  private modelName: string = 'gemini-1.5-flash';
  private isInitialized: boolean = false;

  /**
   * Initialize the Gemini service with API key
   */
  init(apiKey: string, model: string = 'gemini-1.5-flash'): void {
    if (!apiKey) {
      throw new Error('API key is required to initialize GeminiService');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
    this.isInitialized = true;
    this.chat = null; // Reset chat session
  }

  /**
   * Check if the service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Start a new chat session with context
   */
  private startChat(context: AISidekickContext, history: ChatMessage[]): ChatSession {
    if (!this.client) {
      throw new Error('GeminiService not initialized. Call init() first.');
    }

    const systemPrompt = buildSystemPrompt(context);
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
    });

    const formattedHistory = formatHistoryForGemini(history);

    this.chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    return this.chat;
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(
    userMessage: string,
    context: AISidekickContext,
    history: ChatMessage[] = []
  ): Promise<GeminiResponse> {
    if (!this.client) {
      throw new Error('GeminiService not initialized. Call init() first.');
    }

    try {
      // Start or use existing chat session
      const chat = this.startChat(context, history);

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      const text = response.text();

      const geminiResponse: GeminiResponse = {
        id: generateId(),
        content: text,
        role: 'assistant',
        timestamp: new Date(),
      };

      return geminiResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  /**
   * Send a message with streaming response
   */
  async sendMessageStreaming(
    userMessage: string,
    context: AISidekickContext,
    history: ChatMessage[] = [],
    onChunk: (chunk: string) => void
  ): Promise<GeminiResponse> {
    if (!this.client) {
      throw new Error('GeminiService not initialized. Call init() first.');
    }

    try {
      const chat = this.startChat(context, history);

      const result = await chat.sendMessageStream(userMessage);

      let fullText = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(chunkText);
      }

      const geminiResponse: GeminiResponse = {
        id: generateId(),
        content: fullText,
        role: 'assistant',
        timestamp: new Date(),
      };

      return geminiResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  /**
   * Analyze content with AI (for future tool integration)
   */
  async analyzeContent(
    content: string,
    analysisType: 'audio' | 'video' | 'image' | 'general',
    context: AISidekickContext
  ): Promise<string> {
    if (!this.client) {
      throw new Error('GeminiService not initialized.');
    }

    const prompts: Record<string, string> = {
      audio: `Analyze this audio analysis data and provide insights:\n${content}`,
      video: `Analyze this video analysis data and provide insights:\n${content}`,
      image: `Analyze this image analysis data and provide insights:\n${content}`,
      general: `Analyze this data and provide insights:\n${content}`,
    };

    const response = await this.sendMessage(prompts[analysisType], context);
    return response.content;
  }

  /**
   * Reset the chat session
   */
  resetChat(): void {
    this.chat = null;
  }

  /**
   * Update the model being used
   */
  setModel(model: string): void {
    this.modelName = model;
    this.chat = null; // Reset chat when model changes
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const geminiService = new GeminiService();

export default GeminiService;
