/**
 * Tests for MercadoLibre Cache
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MLCache } from '../_cache';

describe('MLCache', () => {
  beforeEach(() => {
    // Clear cache before each test
    MLCache.clear();
    // Reset stats
    MLCache['hits'] = 0;
    MLCache['misses'] = 0;
  });

  describe('get/set', () => {
    test('should return null for non-existent key', () => {
      expect(MLCache.get('nonexistent')).toBeNull();
    });

    test('should store and retrieve data', () => {
      const testData = { products: [{ id: '1', title: 'Test' }] };
      MLCache.set('turbina led', testData);
      
      const result = MLCache.get('turbina led');
      expect(result).toEqual(testData);
    });

    test('should normalize query for cache key', () => {
      const testData = { products: [] };
      MLCache.set('TURBINA LED', testData);
      
      // Should find with different casing
      expect(MLCache.get('turbina led')).toEqual(testData);
      expect(MLCache.get('Turbina LED')).toEqual(testData);
    });

    test('should normalize query with extra spaces', () => {
      const testData = { products: [] };
      MLCache.set('turbina   led  dental', testData);
      
      // Should find with normalized spaces
      expect(MLCache.get('turbina led dental')).toEqual(testData);
    });
  });

  describe('expiration', () => {
    test('should return null for expired entries', () => {
      const testData = { products: [] };
      MLCache.set('test-query', testData);
      
      // Mock Date.now to simulate time passing
      const originalNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(originalNow + 6 * 60 * 1000); // 6 minutes later
      
      // Should be expired (TTL is 5 minutes)
      expect(MLCache.get('test-query')).toBeNull();
      
      vi.restoreAllMocks();
    });

    test('should return data within TTL', () => {
      const testData = { products: [] };
      MLCache.set('test-query', testData);
      
      const originalNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(originalNow + 4 * 60 * 1000); // 4 minutes later
      
      // Should still be valid
      expect(MLCache.get('test-query')).toEqual(testData);
      
      vi.restoreAllMocks();
    });
  });

  describe('size limit', () => {
    test('should evict oldest entry when limit reached', () => {
      // Set MAX_SIZE entries + 1
      const MAX_SIZE = 50;
      
      for (let i = 0; i < MAX_SIZE; i++) {
        MLCache.set(`query-${i}`, { index: i });
      }
      
      // All should be present
      expect(MLCache.get('query-0')).toEqual({ index: 0 });
      expect(MLCache.get('query-49')).toEqual({ index: 49 });
      
      // Add one more - should evict first
      MLCache.set('query-new', { index: 'new' });
      
      // First one should be evicted
      expect(MLCache.get('query-0')).toBeNull();
      // New one should be present
      expect(MLCache.get('query-new')).toEqual({ index: 'new' });
    });
  });

  describe('invalidate', () => {
    test('should remove specific entry', () => {
      MLCache.set('query-1', { data: 1 });
      MLCache.set('query-2', { data: 2 });
      
      const result = MLCache.invalidate('query-1');
      expect(result).toBe(true);
      
      expect(MLCache.get('query-1')).toBeNull();
      expect(MLCache.get('query-2')).toEqual({ data: 2 });
    });

    test('should return false for non-existent key', () => {
      const result = MLCache.invalidate('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    test('should remove all entries', () => {
      MLCache.set('query-1', { data: 1 });
      MLCache.set('query-2', { data: 2 });
      
      MLCache.clear();
      
      expect(MLCache.get('query-1')).toBeNull();
      expect(MLCache.get('query-2')).toBeNull();
    });
  });

  describe('stats', () => {
    test('should track hits and misses', () => {
      MLCache.set('exists', { data: true });
      
      // Hit
      MLCache.get('exists');
      // Miss
      MLCache.get('not-exists');
      // Another hit
      MLCache.get('exists');
      
      const stats = MLCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      // hitRate is returned as percentage (66.66%) not decimal (0.666)
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });
  });
});
