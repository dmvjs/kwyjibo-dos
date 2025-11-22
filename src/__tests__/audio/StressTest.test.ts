/**
 * Stress Tests
 *
 * Tests system behavior under heavy load and unusual conditions.
 * These tests verify performance, memory handling, and stability.
 */

import { describe, test, expect } from '@jest/globals';
import { AudioBufferLoader } from '@/audio';
import { AudioDecoder } from '@/audio';
import { AudioBufferCache } from '@/audio';
import { MockAudioContext } from '../mocks/MockAudioContext.js';
import {
  MockAudioFileLoader,
  createFakeAudioData,
} from '../mocks/MockAudioFileLoader.js';

describe('Stress Tests', () => {
  describe('high volume loading', () => {
    test('loads 273 files (real kwyjibo size)', async () => {
      const mockFileLoader = new MockAudioFileLoader();
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      const loader = new AudioBufferLoader(mockFileLoader, decoder, {
        maxConcurrent: 10,
      });

      // Simulate kwyjibo's 273 songs
      const requests = [];
      for (let i = 1; i <= 273; i++) {
        const id = String(i).padStart(8, '0');
        mockFileLoader.addFile(`/music/${id}-lead.mp3`, createFakeAudioData(50)); // 50 bytes
        mockFileLoader.addFile(`/music/${id}-body.mp3`, createFakeAudioData(200)); // 200 bytes

        requests.push(
          { id: `${id}-lead`, url: `/music/${id}-lead.mp3` },
          { id: `${id}-body`, url: `/music/${id}-body.mp3` }
        );
      }

      // 546 files total (273 songs × 2 versions)
      expect(requests).toHaveLength(546);

      const startTime = Date.now();
      const results = await loader.load(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(546);
      console.log(`Loaded 546 files in ${endTime - startTime}ms`);
    }, 30000); // 30 second timeout for this heavy test

    test('handles rapid successive loads', async () => {
      const mockFileLoader = new MockAudioFileLoader();
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      const loader = new AudioBufferLoader(mockFileLoader, decoder);

      // Add some files
      for (let i = 0; i < 10; i++) {
        mockFileLoader.addFile(`/file${i}.mp3`, createFakeAudioData());
      }

      // Fire off 5 rapid loads
      const promises = [];
      for (let batch = 0; batch < 5; batch++) {
        const requests = [];
        for (let i = 0; i < 10; i++) {
          requests.push({ id: `batch${batch}-file${i}`, url: `/file${i}.mp3` });
        }
        promises.push(loader.load(requests));
      }

      const allResults = await Promise.all(promises);

      expect(allResults).toHaveLength(5);
      allResults.forEach((results) => {
        expect(results).toHaveLength(10);
      });
    });
  });

  describe('memory management stress', () => {
    test('cache handles many entries without crash', () => {
      const cache = new AudioBufferCache({
        maxSize: 100,
        maxMemoryBytes: 10 * 1024 * 1024, // 10MB
      });

      // Add 500 entries (will trigger many evictions)
      for (let i = 0; i < 500; i++) {
        const buffer = {
          duration: 1.0,
          length: 44100,
          numberOfChannels: 2,
          sampleRate: 44100,
          getChannelData: () => new Float32Array(44100),
          copyFromChannel: () => {},
          copyToChannel: () => {},
        } as AudioBuffer;

        cache.set(`buffer${i}`, {
          id: `buffer${i}`,
          buffer,
          url: `/audio/buffer${i}.mp3`,
          loadTimeMs: 100,
        });
      }

      const stats = cache.getStats();

      // Should have evicted to stay under limit
      expect(stats.size).toBeLessThanOrEqual(100);
      expect(stats.memoryBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
    });

    test('cache handles rapid set/get/delete cycles', () => {
      const cache = new AudioBufferCache({ maxSize: 50 });

      const buffer = {
        duration: 1.0,
        length: 44100,
        numberOfChannels: 2,
        sampleRate: 44100,
        getChannelData: () => new Float32Array(44100),
        copyFromChannel: () => {},
        copyToChannel: () => {},
      } as AudioBuffer;

      const result = {
        id: 'test',
        buffer,
        url: '/test.mp3',
        loadTimeMs: 100,
      };

      // Rapid operations
      for (let i = 0; i < 1000; i++) {
        const key = `item${i % 20}`;
        cache.set(key, result);
        cache.get(key);
        if (i % 3 === 0) {
          cache.delete(key);
        }
      }

      // Should still be functional
      cache.set('final', result);
      expect(cache.get('final')).toBeDefined();
    });
  });

  describe('concurrency stress', () => {
    test('handles maximum concurrency correctly', async () => {
      const mockFileLoader = new MockAudioFileLoader();
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);

      let currentConcurrent = 0;
      let maxConcurrent = 0;
      const concurrencyLog: number[] = [];

      // Track concurrency
      mockFileLoader.fetch = async (_url: string, _timeout: number): Promise<ArrayBuffer> => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        concurrencyLog.push(currentConcurrent);

        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 50));

        const result = createFakeAudioData();
        currentConcurrent--;
        return result;
      };

      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push({ id: `file${i}`, url: `/file${i}.mp3` });
      }

      const loader = new AudioBufferLoader(mockFileLoader, decoder, {
        maxConcurrent: 8,
      });

      await loader.load(requests);

      // Verify concurrency never exceeded limit
      expect(maxConcurrent).toBeLessThanOrEqual(8);
      expect(maxConcurrent).toBeGreaterThan(0);

      console.log(`Max concurrent requests: ${maxConcurrent}`);
      console.log(`Average concurrency: ${(concurrencyLog.reduce((a, b) => a + b, 0) / concurrencyLog.length).toFixed(2)}`);
    }, 15000);
  });

  describe('failure stress', () => {
    test('handles mix of successes and failures', async () => {
      const mockFileLoader = new MockAudioFileLoader();
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      const loader = new AudioBufferLoader(mockFileLoader, decoder, {
        defaultRetries: 1, // Fail fast
      });

      // Add 50 good files and 50 bad files
      for (let i = 0; i < 50; i++) {
        mockFileLoader.addFile(`/good${i}.mp3`, createFakeAudioData());
        mockFileLoader.addFailure(`/bad${i}.mp3`, new Error('Failed'));
      }

      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push({ id: `good${i}`, url: `/good${i}.mp3` });
        requests.push({ id: `bad${i}`, url: `/bad${i}.mp3`, retries: 0 });
      }

      const results = await loader.load(requests);

      // Should get 50 successful results
      expect(results).toHaveLength(50);
      results.forEach((result) => {
        expect(result.id).toMatch(/^good/);
      });
    });

    test('handles all failures gracefully', async () => {
      const mockFileLoader = new MockAudioFileLoader();
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      const loader = new AudioBufferLoader(mockFileLoader, decoder);

      // All files fail
      for (let i = 0; i < 20; i++) {
        mockFileLoader.addFailure(`/bad${i}.mp3`, new Error('Failed'));
      }

      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push({ id: `bad${i}`, url: `/bad${i}.mp3`, retries: 0 });
      }

      await expect(loader.load(requests)).rejects.toThrow();
    });
  });

  describe('event stress', () => {
    test('handles thousands of progress events', async () => {
      const mockFileLoader = new MockAudioFileLoader();
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      const loader = new AudioBufferLoader(mockFileLoader, decoder);

      let eventCount = 0;
      loader.on('progress', () => {
        eventCount++;
      });

      // Add 100 files
      const requests = [];
      for (let i = 0; i < 100; i++) {
        mockFileLoader.addFile(`/file${i}.mp3`, createFakeAudioData());
        requests.push({ id: `file${i}`, url: `/file${i}.mp3` });
      }

      await loader.load(requests);

      // Should have received many progress events
      expect(eventCount).toBeGreaterThan(100);
      console.log(`Received ${eventCount} progress events for 100 files`);
    });
  });
});
