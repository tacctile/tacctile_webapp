/**
 * MSW Request Handlers Template
 *
 * This file provides a template for Mock Service Worker (MSW) request handlers.
 * MSW intercepts network requests and returns mock responses, enabling
 * realistic API testing without actual network calls.
 *
 * Note: MSW is not installed by default. To use this file:
 * 1. Install MSW: npm install --save-dev msw
 * 2. Uncomment the handlers below
 * 3. Set up MSW in your test setup file
 */

// ============================================================================
// PLACEHOLDER - MSW NOT YET INSTALLED
// ============================================================================

/**
 * When MSW is needed, uncomment and configure the handlers below.
 *
 * Installation:
 * ```bash
 * npm install --save-dev msw
 * ```
 *
 * Setup in vitest.setup.ts:
 * ```ts
 * import { server } from './mocks/server';
 *
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */

// Placeholder export for when MSW is installed
export const handlers: unknown[] = [];

// ============================================================================
// EXAMPLE HANDLERS (uncomment when MSW is installed)
// ============================================================================

/*
import { http, HttpResponse } from 'msw';

// Base URL for API requests
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const handlers = [
  // -------------------------------------------------------------------------
  // Authentication Handlers
  // -------------------------------------------------------------------------

  // Mock successful login
  http.post(`${API_BASE_URL}/auth/login`, async () => {
    return HttpResponse.json({
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        emailVerified: true,
      },
      token: 'mock-jwt-token',
    });
  }),

  // Mock logout
  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Mock current user
  http.get(`${API_BASE_URL}/auth/me`, () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
      emailVerified: true,
    });
  }),

  // -------------------------------------------------------------------------
  // Project Handlers
  // -------------------------------------------------------------------------

  // Get projects list
  http.get(`${API_BASE_URL}/projects`, () => {
    return HttpResponse.json({
      projects: [
        {
          id: 'project-1',
          name: 'Test Project 1',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fileCount: 5,
          flagCount: 3,
        },
        {
          id: 'project-2',
          name: 'Test Project 2',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fileCount: 10,
          flagCount: 7,
        },
      ],
    });
  }),

  // Get single project
  http.get(`${API_BASE_URL}/projects/:projectId`, ({ params }) => {
    const { projectId } = params;
    return HttpResponse.json({
      id: projectId,
      name: `Project ${projectId}`,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      fileCount: 5,
      flagCount: 3,
    });
  }),

  // Create project
  http.post(`${API_BASE_URL}/projects`, async ({ request }) => {
    const body = await request.json() as { name: string };
    return HttpResponse.json({
      id: 'new-project-id',
      name: body.name,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      fileCount: 0,
      flagCount: 0,
    }, { status: 201 });
  }),

  // -------------------------------------------------------------------------
  // File Handlers
  // -------------------------------------------------------------------------

  // Get files for project
  http.get(`${API_BASE_URL}/projects/:projectId/files`, () => {
    return HttpResponse.json({
      files: [
        {
          id: 'file-1',
          name: 'audio-sample.mp3',
          type: 'audio',
          size: 1024000,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'file-2',
          name: 'video-clip.mp4',
          type: 'video',
          size: 5120000,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }),

  // Upload file
  http.post(`${API_BASE_URL}/projects/:projectId/files`, () => {
    return HttpResponse.json({
      id: 'new-file-id',
      name: 'uploaded-file.mp3',
      type: 'audio',
      size: 1024000,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // -------------------------------------------------------------------------
  // Flag Handlers
  // -------------------------------------------------------------------------

  // Get flags for file
  http.get(`${API_BASE_URL}/files/:fileId/flags`, () => {
    return HttpResponse.json({
      flags: [
        {
          id: 'flag-1',
          type: 'audio_anomaly',
          timestamp: 30.5,
          title: 'Audio anomaly detected',
          confidence: 'high',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }),

  // Create flag
  http.post(`${API_BASE_URL}/files/:fileId/flags`, async ({ request }) => {
    const body = await request.json() as { type: string; timestamp: number };
    return HttpResponse.json({
      id: 'new-flag-id',
      ...body,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),
];

// ============================================================================
// ERROR HANDLERS (for testing error scenarios)
// ============================================================================

export const errorHandlers = [
  // Simulate network error
  http.get(`${API_BASE_URL}/error/network`, () => {
    return HttpResponse.error();
  }),

  // Simulate 404 error
  http.get(`${API_BASE_URL}/error/not-found`, () => {
    return HttpResponse.json(
      { message: 'Resource not found' },
      { status: 404 }
    );
  }),

  // Simulate 500 error
  http.get(`${API_BASE_URL}/error/server`, () => {
    return HttpResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }),

  // Simulate 401 unauthorized
  http.get(`${API_BASE_URL}/error/unauthorized`, () => {
    return HttpResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    );
  }),
];
*/

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a delayed response handler for testing loading states
 *
 * @example
 * ```ts
 * // When MSW is installed:
 * http.get('/api/slow', createDelayedResponse({ data: 'test' }, 2000));
 * ```
 */
export function createDelayedResponse<T>(data: T, delayMs: number): () => Promise<T> {
  return () => new Promise((resolve) => setTimeout(() => resolve(data), delayMs));
}

/**
 * Create mock file upload response
 */
export function createMockFileUploadResponse(filename: string, type: string) {
  return {
    id: `file-${Date.now()}`,
    name: filename,
    type,
    size: 1024000,
    createdAt: new Date().toISOString(),
    url: `blob:mock-url-${Date.now()}`,
  };
}
