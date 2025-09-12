/**
 * Content Security Policy configuration for Ghost Hunter Toolbox
 * Implements strict CSP headers to prevent XSS and code injection attacks
 */

export interface CSPConfig {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'media-src': string[];
  'object-src': string[];
  'child-src': string[];
  'worker-src': string[];
  'frame-src': string[];
  'form-action': string[];
  'base-uri': string[];
  'manifest-src': string[];
}

/**
 * Production CSP configuration - Most restrictive
 */
export const PRODUCTION_CSP: CSPConfig = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for React hot reload in dev - remove in production build
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for CSS-in-JS libraries like Material-UI
    'https://fonts.googleapis.com',
  ],
  'img-src': [
    "'self'",
    'data:', // For base64 encoded images
    'blob:', // For uploaded/processed images
    'https:', // Allow HTTPS images for evidence
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'data:',
  ],
  'connect-src': [
    "'self'",
    'https://api.amplitude.com', // Analytics
    'wss://localhost:*', // WebSocket for development
    'ws://localhost:*', // WebSocket for development
  ],
  'media-src': [
    "'self'",
    'blob:', // For recorded audio/video
    'data:', // For embedded media
  ],
  'object-src': ["'none'"], // Prevent Flash, Java, etc.
  'child-src': ["'self'"], // For iframes if needed
  'worker-src': [
    "'self'",
    'blob:', // For web workers
  ],
  'frame-src': ["'self'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'manifest-src': ["'self'"],
};

/**
 * Development CSP configuration - Less restrictive for development tools
 */
export const DEVELOPMENT_CSP: CSPConfig = {
  ...PRODUCTION_CSP,
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'", // Required for development tools
    'http://localhost:*',
    'https://localhost:*',
  ],
  'connect-src': [
    ...PRODUCTION_CSP['connect-src'],
    'http://localhost:*',
    'https://localhost:*',
    'ws://localhost:*',
    'wss://localhost:*',
  ],
};

/**
 * Convert CSP config object to CSP header string
 */
export function buildCSPHeader(config: CSPConfig): string {
  return Object.entries(config)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Get CSP configuration based on environment
 */
export function getCSPConfig(isDevelopment: boolean = false): CSPConfig {
  return isDevelopment ? DEVELOPMENT_CSP : PRODUCTION_CSP;
}

/**
 * Get CSP header string for current environment
 */
export function getCSPHeader(isDevelopment: boolean = false): string {
  const config = getCSPConfig(isDevelopment);
  return buildCSPHeader(config);
}

/**
 * Validate CSP configuration
 */
export function validateCSPConfig(config: CSPConfig): boolean {
  const requiredDirectives = [
    'default-src',
    'script-src',
    'style-src',
    'object-src',
  ];

  return requiredDirectives.every(directive => 
    config[directive] && config[directive].length > 0
  );
}

/**
 * Create nonce for inline scripts (if needed)
 */
export function createNonce(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('base64');
}

/**
 * CSP violation reporting endpoint configuration
 */
export interface CSPReportConfig {
  'report-uri'?: string;
  'report-to'?: string;
}

/**
 * Add reporting to CSP configuration
 */
export function addCSPReporting(config: CSPConfig, reportConfig: CSPReportConfig): string {
  const baseCSP = buildCSPHeader(config);
  const reportDirectives = Object.entries(reportConfig)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');
  
  return reportDirectives ? `${baseCSP}; ${reportDirectives}` : baseCSP;
}

/**
 * Default CSP for Ghost Hunter Toolbox
 */
export const DEFAULT_CSP = getCSPHeader(process.env.NODE_ENV === 'development');