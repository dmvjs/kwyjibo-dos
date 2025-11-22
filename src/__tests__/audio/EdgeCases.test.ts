/**
 * Edge Case Tests
 *
 * Tests for unusual scenarios, error conditions, and boundary cases.
 * These tests ensure the system is robust under stress and unusual conditions.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AudioBufferLoader } from '@/audio';
import { AudioDecoder } from '@/audio';
import { MockAudioContext } from '../mocks/MockAudioContext.js';
import {
  MockAudioFileLoader,
  createFakeAudioData,
} from '../mocks/MockAudioFileLoader.js';

describe('Edge Cases', () => {
  let mockFileLoader: MockAudioFileLoader;
  let mockContext: MockAudioContext;
  let loader: AudioBufferLoader;

  beforeEach(() => {
    mockFileLoader = new MockAudioFileLoader();
    mockContext = new MockAudioContext();
    const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
    loader = new AudioBufferLoader(mockFileLoader, decoder);
  });

  describe('AudioContext states', () => {
    test('handles suspended context', async () => {
      mockContext.state = 'suspended';
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      // Should auto-resume
      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
      });

      expect(result.id).toBe('test');
      expect(mockContext.state).toBe('running');
    });

    test('throws error for closed context', async () => {
      mockContext.state = 'closed';
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      // loadSingle wraps DecodeError in LoadError
      await expect(
        loader.loadSingle({
          id: 'test',
          url: '/test.mp3',
          retries: 0, // Fail fast
        })
      ).rejects.toThrow(); // Just check it throws
    });
  });

  describe('extreme loads', () => {
    test('handles loading many files concurrently', async () => {
      const fileCount = 100;
      const requests = [];

      for (let i = 0; i < fileCount; i++) {
        mockFileLoader.addFile(`/file${i}.mp3`, createFakeAudioData());
        requests.push({
          id: `file${i}`,
          url: `/file${i}.mp3`,
        });
      }

      const results = await loader.load(requests);

      expect(results).toHaveLength(fileCount);
    });

    test('respects concurrency limits with many files', async () => {
      const fileCount = 50;
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const customLoader = new AudioBufferLoader(
        mockFileLoader,
        new AudioDecoder(mockContext as unknown as AudioContext),
        { maxConcurrent: 5 }
      );

      // Track concurrency
      const originalFetch = mockFileLoader.fetch.bind(mockFileLoader);
      mockFileLoader.fetch = async (url: string, timeout: number) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        const result = await originalFetch(url, timeout);
        currentConcurrent--;
        return result;
      };

      const requests = [];
      for (let i = 0; i < fileCount; i++) {
        mockFileLoader.addFile(`/file${i}.mp3`, createFakeAudioData(), 50);
        requests.push({ id: `file${i}`, url: `/file${i}.mp3` });
      }

      await customLoader.load(requests);

      expect(maxConcurrent).toBeLessThanOrEqual(5);
      expect(maxConcurrent).toBeGreaterThan(0);
    });
  });

  describe('empty and invalid inputs', () => {
    test('handles empty request array', async () => {
      const results = await loader.load([]);
      expect(results).toEqual([]);
    });

    test('handles empty URL', async () => {
      mockFileLoader.addFile('', createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'empty-url',
        url: '',
      });

      expect(result.id).toBe('empty-url');
    });

    test('handles very long URLs', async () => {
      const longUrl = '/audio/' + 'a'.repeat(1000) + '.mp3';
      mockFileLoader.addFile(longUrl, createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'long-url',
        url: longUrl,
      });

      expect(result.id).toBe('long-url');
    });

    test('handles special characters in URL', async () => {
      const specialUrl = '/audio/song with spaces & symbols!@#$.mp3';
      mockFileLoader.addFile(specialUrl, createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'special',
        url: specialUrl,
      });

      expect(result.id).toBe('special');
    });
  });

  describe('retry behavior', () => {
    test('retries correct number of times', async () => {
      // Create loader with faster retries for testing
      const fastLoader = new AudioBufferLoader(
        mockFileLoader,
        new AudioDecoder(mockContext as unknown as AudioContext),
        { retryDelay: 100 } // 100ms instead of 1000ms
      );

      let attempts = 0;

      mockFileLoader.fetch = async () => {
        attempts++;
        throw new Error('Always fails');
      };

      await expect(
        fastLoader.loadSingle({
          id: 'test',
          url: '/test.mp3',
          retries: 5,
        })
      ).rejects.toThrow();

      expect(attempts).toBe(6); // Initial + 5 retries
    });

    test('stops retrying after success', async () => {
      // Create loader with faster retries for testing
      const fastLoader = new AudioBufferLoader(
        mockFileLoader,
        new AudioDecoder(mockContext as unknown as AudioContext),
        { retryDelay: 100 }
      );

      let attempts = 0;

      mockFileLoader.fetch = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return createFakeAudioData();
      };

      const result = await fastLoader.loadSingle({
        id: 'test',
        url: '/test.mp3',
        retries: 5,
      });

      expect(result.id).toBe('test');
      expect(attempts).toBe(3); // Stopped after success
    });
  });

  describe('timeout behavior', () => {
    test('respects custom timeout per request', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData(), 500);

      // Short timeout should work if file loads fast enough
      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
        timeout: 1000,
      });

      expect(result.id).toBe('test');
    });

    test('uses default timeout when not specified', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
        // No timeout specified - should use default (10000ms)
      });

      expect(result.id).toBe('test');
    });
  });

  describe('metadata handling', () => {
    test('preserves complex metadata', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      const complexMetadata = {
        artist: 'Test Artist',
        title: 'Test Song',
        bpm: 120,
        key: 5,
        nested: {
          data: {
            deep: true,
          },
        },
        array: [1, 2, 3],
      };

      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
        metadata: complexMetadata,
      });

      expect(result.metadata).toEqual(complexMetadata);
    });

    test('handles undefined metadata', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
        // No metadata
      });

      expect(result.metadata).toBeUndefined();
    });
  });

  describe('event handling edge cases', () => {
    test('handles unsubscribing during event emission', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      let eventCount = 0;
      const unsubscribe = loader.on('progress', () => {
        eventCount++;
        // Unsubscribe immediately
        unsubscribe();
      });

      await loader.loadSingle({ id: 'test', url: '/test.mp3' });

      // Should only receive one event
      expect(eventCount).toBe(1);
    });

    test('handles multiple subscribers to same event', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      let count1 = 0;
      let count2 = 0;
      let count3 = 0;

      loader.on('progress', () => count1++);
      loader.on('progress', () => count2++);
      loader.on('progress', () => count3++);

      await loader.loadSingle({ id: 'test', url: '/test.mp3' });

      // All should receive events
      expect(count1).toBeGreaterThan(0);
      expect(count2).toBe(count1);
      expect(count3).toBe(count1);
    });

    test('handles error in event handler gracefully', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      let goodHandlerCalled = false;

      // Mock console.error to avoid test output noise
      const originalError = console.error;
      console.error = jest.fn();

      try {
        // Bad handler that throws
        loader.on('progress', () => {
          throw new Error('Handler error');
        });

        // Good handler that should still run
        loader.on('progress', () => {
          goodHandlerCalled = true;
        });

        // Should not throw despite bad handler
        await loader.loadSingle({ id: 'test', url: '/test.mp3' });

        // Good handler should still have been called
        expect(goodHandlerCalled).toBe(true);

        // Verify error was logged
        expect(console.error).toHaveBeenCalled();
      } finally {
        console.error = originalError;
      }
    });
  });
});
