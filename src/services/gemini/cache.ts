/**
 * Response Cache for Gemini API
 * LRU cache implementation for API responses
 */

import { GeminiResponse } from './types';
import { logger } from '../../utils/logger';

interface CacheEntry {
  response: GeminiResponse;
  timestamp: Date;
  hits: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private maxSize = 100;
  private ttl: number; // Time to live in seconds
  private hits = 0;
  private misses = 0;

  constructor(ttlSeconds = 3600) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanExpired();
    }, 60 * 1000); // Run every minute
  }

  /**
   * Get cached response
   */
  get(key: string): GeminiResponse | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Update hit count and move to end (LRU)
    entry.hits++;
    this.hits++;
    
    // Re-insert to maintain LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    logger.debug('Cache hit', { key, hits: entry.hits });
    return entry.response;
  }

  /**
   * Set cached response
   */
  set(key: string, response: GeminiResponse): void {
    // Check cache size limit
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Remove least recently used item (first item in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug('Cache eviction (LRU)', { key: firstKey });
    }
    
    const entry: CacheEntry = {
      response,
      timestamp: new Date(),
      hits: 0
    };
    
    this.cache.set(key, entry);
    logger.debug('Cache set', { key, size: this.cache.size });
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age > this.ttl;
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cache cleanup', { cleaned, remaining: this.cache.size });
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    
    for (const entry of this.cache.values()) {
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }
    
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Get detailed cache entries
   */
  getEntries(): Array<{
    key: string;
    timestamp: Date;
    hits: number;
    age: number;
  }> {
    const entries = [];
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        timestamp: entry.timestamp,
        hits: entry.hits,
        age: now - entry.timestamp.getTime()
      });
    }
    
    return entries;
  }

  /**
   * Update TTL
   */
  updateTTL(seconds: number): void {
    this.ttl = seconds * 1000;
    logger.info('Cache TTL updated', { ttl: seconds });
  }

  /**
   * Update max size
   */
  updateMaxSize(size: number): void {
    this.maxSize = size;
    
    // Evict entries if necessary
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    logger.info('Cache max size updated', { maxSize: size });
  }
}