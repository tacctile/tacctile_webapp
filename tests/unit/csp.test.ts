/**
 * Unit tests for Content Security Policy configuration
 */

import {
  buildCSPHeader,
  getCSPConfig,
  getCSPHeader,
  validateCSPConfig,
  createNonce,
  PRODUCTION_CSP,
  DEVELOPMENT_CSP,
} from '../../src/security/csp';

describe('CSP Configuration', () => {
  describe('buildCSPHeader', () => {
    it('should build CSP header string from config object', () => {
      const config = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
      };

      const header = buildCSPHeader(config);

      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src 'self' 'unsafe-inline'");
      expect(header).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should join directives with semicolons', () => {
      const config = {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
      };

      const header = buildCSPHeader(config);

      expect(header).toMatch(/default-src 'self'; script-src 'self'/);
    });
  });

  describe('getCSPConfig', () => {
    it('should return development config when isDevelopment is true', () => {
      const config = getCSPConfig(true);

      expect(config).toEqual(DEVELOPMENT_CSP);
    });

    it('should return production config when isDevelopment is false', () => {
      const config = getCSPConfig(false);

      expect(config).toEqual(PRODUCTION_CSP);
    });

    it('should default to production config', () => {
      const config = getCSPConfig();

      expect(config).toEqual(PRODUCTION_CSP);
    });
  });

  describe('getCSPHeader', () => {
    it('should return development CSP header string', () => {
      const header = getCSPHeader(true);

      expect(typeof header).toBe('string');
      expect(header).toContain("default-src 'self'");
      expect(header).toContain("'unsafe-eval'"); // Development only
    });

    it('should return production CSP header string', () => {
      const header = getCSPHeader(false);

      expect(typeof header).toBe('string');
      expect(header).toContain("default-src 'self'");
      expect(header).not.toContain("'unsafe-eval'"); // Not in production
    });
  });

  describe('validateCSPConfig', () => {
    it('should validate valid CSP configuration', () => {
      const validConfig = {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'object-src': ["'none'"],
      };

      expect(validateCSPConfig(validConfig)).toBe(true);
    });

    it('should reject configuration missing required directives', () => {
      const invalidConfig = {
        'default-src': ["'self'"],
        // Missing required directives
      };

      expect(validateCSPConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with empty directive arrays', () => {
      const invalidConfig = {
        'default-src': [],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'object-src': ["'none'"],
      };

      expect(validateCSPConfig(invalidConfig)).toBe(false);
    });
  });

  describe('createNonce', () => {
    it('should create a base64 nonce', () => {
      const nonce = createNonce();

      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      // Base64 encoded string should only contain valid characters
      expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should create unique nonces', () => {
      const nonce1 = createNonce();
      const nonce2 = createNonce();

      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('Production CSP', () => {
    it('should have restrictive default-src', () => {
      expect(PRODUCTION_CSP['default-src']).toEqual(["'self'"]);
    });

    it('should not allow unsafe-eval in script-src', () => {
      expect(PRODUCTION_CSP['script-src']).not.toContain("'unsafe-eval'");
    });

    it('should block all object-src', () => {
      expect(PRODUCTION_CSP['object-src']).toEqual(["'none'"]);
    });
  });

  describe('Development CSP', () => {
    it('should allow unsafe-eval in script-src for development tools', () => {
      expect(DEVELOPMENT_CSP['script-src']).toContain("'unsafe-eval'");
    });

    it('should allow localhost connections', () => {
      expect(DEVELOPMENT_CSP['connect-src']).toContain('http://localhost:*');
      expect(DEVELOPMENT_CSP['connect-src']).toContain('ws://localhost:*');
    });
  });
});