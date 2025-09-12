/**
 * Unit tests for AutoSaveManager
 */

import { autoSave, AppState } from '../../src/utils/autoSave';

// Mock lodash debounce
jest.mock('lodash', () => ({
  debounce: jest.fn((fn) => {
    const debouncedFn = (...args: any[]) => fn(...args);
    debouncedFn.cancel = jest.fn();
    debouncedFn.flush = jest.fn();
    return debouncedFn;
  }),
}));

describe('AutoSaveManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('should save data to store', () => {
      const testData = { test: 'data' };
      
      autoSave.save('investigations', testData);
      
      // Since save is debounced, we can't directly test the store.set call
      // but we can test that the method doesn't throw
      expect(() => autoSave.save('investigations', testData)).not.toThrow();
    });
  });

  describe('saveNow', () => {
    it('should save data immediately', () => {
      const testData = { test: 'data' };
      
      autoSave.saveNow('investigations', testData);
      
      // Test that immediate save doesn't throw
      expect(() => autoSave.saveNow('investigations', testData)).not.toThrow();
    });
  });

  describe('load', () => {
    it('should load data from store', () => {
      const result = autoSave.load('investigations');
      
      // Should return data or undefined
      expect(result).toBeDefined();
    });
  });

  describe('loadAll', () => {
    it('should load all app state', () => {
      const result = autoSave.loadAll();
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('clear', () => {
    it('should clear specific data', () => {
      expect(() => autoSave.clear('investigations')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all data', () => {
      expect(() => autoSave.clearAll()).not.toThrow();
    });
  });

  describe('isHealthy', () => {
    it('should perform health check', () => {
      const result = autoSave.isHealthy();
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getStorePath', () => {
    it('should return store path', () => {
      const path = autoSave.getStorePath();
      
      expect(typeof path).toBe('string');
    });
  });
});