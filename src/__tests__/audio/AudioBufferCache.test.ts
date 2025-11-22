/**
 * Tests for AudioBufferCache
 *
 * Tests memory management, LRU eviction, and cleanup functionality.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AudioBufferCache } from '@/audio';
import type { LoadResult } from '@/audio';

/**
 * Create a fake LoadResult for testing.
 * Size formula: channels × length × 4 bytes = total bytes
 * For 2 channels: length = (sizeKB × 1024) / 8
 */
function createFakeResult(id: string, sizeKB = 100): LoadResult {
  // Create a fake AudioBuffer with specific size
  // Formula: 2 channels × length × 4 bytes/sample = sizeKB × 1024 bytes
  const length = (sizeKB * 1024) / (2 * 4); // 2 channels, 4 bytes per sample

  const buffer = {
    duration: 1.0,
    length: Math.floor(length),
    numberOfChannels: 2,
    sampleRate: 44100,
    getChannelData: () => new Float32Array(Math.floor(length)),
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as AudioBuffer;

  return {
    id,
    buffer,
    url: `/audio/${id}.mp3`,
    loadTimeMs: 100,
  };
}

describe('AudioBufferCache', () => {
  let cache: AudioBufferCache;

  beforeEach(() => {
    cache = new AudioBufferCache();
  });

  describe('basic operations', () => {
    test('stores and retrieves buffers', () => {
      const result = createFakeResult('test1');
      cache.set('test1', result);

      const retrieved = cache.get('test1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test1');
    });

    test('returns undefined for missing buffers', () => {
      const retrieved = cache.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    test('has() checks existence', () => {
      const result = createFakeResult('test1');
      cache.set('test1', result);

      expect(cache.has('test1')).toBe(true);
      expect(cache.has('test2')).toBe(false);
    });

    test('delete() removes buffers', () => {
      const result = createFakeResult('test1');
      cache.set('test1', result);

      expect(cache.has('test1')).toBe(true);
      cache.delete('test1');
      expect(cache.has('test1')).toBe(false);
    });

    test('clear() removes all buffers', () => {
      cache.set('test1', createFakeResult('test1'));
      cache.set('test2', createFakeResult('test2'));
      cache.set('test3', createFakeResult('test3'));

      expect(cache.getStats().size).toBe(3);
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('LRU eviction by count', () => {
    test('evicts oldest when maxSize exceeded', () => {
      const smallCache = new AudioBufferCache({ maxSize: 3 });

      // Add 3 buffers (at max)
      smallCache.set('old1', createFakeResult('old1'));
      smallCache.set('old2', createFakeResult('old2'));
      smallCache.set('old3', createFakeResult('old3'));

      expect(smallCache.getStats().size).toBe(3);

      // Add a 4th - should evict old1
      smallCache.set('new1', createFakeResult('new1'));

      expect(smallCache.getStats().size).toBe(3);
      expect(smallCache.has('old1')).toBe(false); // Evicted
      expect(smallCache.has('old2')).toBe(true);
      expect(smallCache.has('old3')).toBe(true);
      expect(smallCache.has('new1')).toBe(true);
    });

    test('get() updates LRU order', async () => {
      const smallCache = new AudioBufferCache({ maxSize: 3 });

      smallCache.set('first', createFakeResult('first'));
      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp
      smallCache.set('second', createFakeResult('second'));
      await new Promise((r) => setTimeout(r, 10));
      smallCache.set('third', createFakeResult('third'));
      await new Promise((r) => setTimeout(r, 10));

      // Access 'first' to make it recently used
      smallCache.get('first');
      await new Promise((r) => setTimeout(r, 10));

      // Add a 4th - should evict 'second' (oldest accessed)
      smallCache.set('fourth', createFakeResult('fourth'));

      expect(smallCache.has('first')).toBe(true); // Kept (recently accessed)
      expect(smallCache.has('second')).toBe(false); // Evicted (oldest)
      expect(smallCache.has('third')).toBe(true);
      expect(smallCache.has('fourth')).toBe(true);
    });
  });

  describe('LRU eviction by memory', () => {
    test('evicts oldest when memory limit exceeded', () => {
      // Cache that holds ~300KB
      const memCache = new AudioBufferCache({
        maxSize: 100,
        maxMemoryBytes: 300 * 1024,
      });

      // Add 3 x 100KB buffers = 300KB (at limit)
      memCache.set('buf1', createFakeResult('buf1', 100));
      memCache.set('buf2', createFakeResult('buf2', 100));
      memCache.set('buf3', createFakeResult('buf3', 100));

      const stats1 = memCache.getStats();
      expect(stats1.size).toBe(3);

      // Add 100KB more - should evict buf1
      memCache.set('buf4', createFakeResult('buf4', 100));

      const stats2 = memCache.getStats();
      expect(stats2.size).toBe(3);
      expect(memCache.has('buf1')).toBe(false); // Evicted
      expect(memCache.has('buf4')).toBe(true);
      expect(stats2.memoryBytes).toBeLessThanOrEqual(stats2.maxMemoryBytes);
    });
  });

  describe('statistics', () => {
    test('tracks size correctly', () => {
      cache.set('test1', createFakeResult('test1'));
      cache.set('test2', createFakeResult('test2'));

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    test('tracks memory usage', () => {
      // 100KB buffer
      cache.set('test1', createFakeResult('test1', 100));

      const stats = cache.getStats();
      // Should be approximately 100KB (100 * 1024 bytes)
      expect(stats.memoryBytes).toBeGreaterThan(90 * 1024);
      expect(stats.memoryBytes).toBeLessThan(110 * 1024);
    });

    test('updates memory when replacing', () => {
      // Add 100KB buffer
      cache.set('test1', createFakeResult('test1', 100));
      const stats1 = cache.getStats();

      // Replace with 200KB buffer
      cache.set('test1', createFakeResult('test1', 200));
      const stats2 = cache.getStats();

      expect(stats2.size).toBe(1); // Still 1 entry
      expect(stats2.memoryBytes).toBeGreaterThan(stats1.memoryBytes); // More memory
    });

    test('updates memory when deleting', () => {
      cache.set('test1', createFakeResult('test1', 100));
      const stats1 = cache.getStats();
      expect(stats1.memoryBytes).toBeGreaterThan(0);

      cache.delete('test1');
      const stats2 = cache.getStats();
      expect(stats2.memoryBytes).toBe(0);
    });
  });

  describe('disposal', () => {
    test('dispose() clears cache', () => {
      cache.set('test1', createFakeResult('test1'));
      cache.set('test2', createFakeResult('test2'));

      expect(cache.getStats().size).toBe(2);

      cache.dispose();

      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().memoryBytes).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('handles zero maxSize', () => {
      const zeroCache = new AudioBufferCache({ maxSize: 0 });
      zeroCache.set('test1', createFakeResult('test1'));

      // Should immediately evict
      expect(zeroCache.getStats().size).toBe(0);
    });

    test('handles very small memory limits', () => {
      const tinyCache = new AudioBufferCache({
        maxSize: 100,
        maxMemoryBytes: 1024, // Only 1KB
      });

      // Try to add 100KB buffer
      tinyCache.set('test1', createFakeResult('test1', 100));

      // Should evict immediately
      expect(tinyCache.getStats().size).toBe(0);
    });

    test('handles updating same key multiple times', () => {
      cache.set('test1', createFakeResult('test1'));
      cache.set('test1', createFakeResult('test1'));
      cache.set('test1', createFakeResult('test1'));

      expect(cache.getStats().size).toBe(1);
    });
  });
});
