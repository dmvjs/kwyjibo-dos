/**
 * Tests for AudioBufferLoader
 *
 * This is the main orchestrator, so we test:
 * - Loading single and multiple files
 * - Concurrent loading with limits
 * - Retry logic
 * - Progress events
 * - Error handling
 * - Cancellation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AudioBufferLoader } from '../../audio/AudioBufferLoader.js';
import { AudioDecoder } from '../../audio/AudioDecoder.js';
import { CancelledError, LoadError, NetworkError } from '../../audio/errors.js';
import { MockAudioContext } from '../mocks/MockAudioContext.js';
import {
  MockAudioFileLoader,
  createFakeAudioData,
} from '../mocks/MockAudioFileLoader.js';
import type { LoadProgress, LoadResult, LoadFailure } from '../../audio/types.js';

describe('AudioBufferLoader', () => {
  let mockFileLoader: MockAudioFileLoader;
  let mockContext: MockAudioContext;
  let loader: AudioBufferLoader;

  beforeEach(() => {
    mockFileLoader = new MockAudioFileLoader();
    mockContext = new MockAudioContext();
    const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
    loader = new AudioBufferLoader(mockFileLoader, decoder);
  });

  describe('loading single files', () => {
    test('loads a single file successfully', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
      });

      expect(result.id).toBe('test');
      expect(result.url).toBe('/test.mp3');
      expect(result.buffer).toBeDefined();
      expect(result.loadTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('includes metadata in result', async () => {
      mockFileLoader.addFile('/test.mp3', createFakeAudioData());

      const result = await loader.loadSingle({
        id: 'test',
        url: '/test.mp3',
        metadata: { bpm: 120, artist: 'Test Artist' },
      });

      expect(result.metadata).toEqual({ bpm: 120, artist: 'Test Artist' });
    });

    test('throws LoadError when file fails', async () => {
      mockFileLoader.addFailure('/missing.mp3', new NetworkError('Not found', '/missing.mp3', 404));

      await expect(
        loader.loadSingle({
          id: 'missing',
          url: '/missing.mp3',
          retries: 0, // No retries for faster test
        })
      ).rejects.toThrow(LoadError);
    });
  });

  describe('loading multiple files', () => {
    test('loads multiple files successfully', async () => {
      mockFileLoader.addFile('/file1.mp3', createFakeAudioData());
      mockFileLoader.addFile('/file2.mp3', createFakeAudioData());
      mockFileLoader.addFile('/file3.mp3', createFakeAudioData());

      const results = await loader.load([
        { id: 'file1', url: '/file1.mp3' },
        { id: 'file2', url: '/file2.mp3' },
        { id: 'file3', url: '/file3.mp3' },
      ]);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.id)).toEqual(['file1', 'file2', 'file3']);
    });

    test('returns empty array for empty request', async () => {
      const results = await loader.load([]);
      expect(results).toEqual([]);
    });

    test('continues loading even if some files fail', async () => {
      mockFileLoader.addFile('/good1.mp3', createFakeAudioData());
      mockFileLoader.addFailure('/bad.mp3', new NetworkError('Failed', '/bad.mp3'));
      mockFileLoader.addFile('/good2.mp3', createFakeAudioData());

      const results = await loader.load([
        { id: 'good1', url: '/good1.mp3' },
        { id: 'bad', url: '/bad.mp3', retries: 0 },
        { id: 'good2', url: '/good2.mp3' },
      ]);

      // Should get the 2 successful files
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain('good1');
      expect(results.map((r) => r.id)).toContain('good2');
    });

    test('throws if all files fail', async () => {
      mockFileLoader.addFailure('/bad1.mp3', new NetworkError('Failed', '/bad1.mp3'));
      mockFileLoader.addFailure('/bad2.mp3', new NetworkError('Failed', '/bad2.mp3'));

      await expect(
        loader.load([
          { id: 'bad1', url: '/bad1.mp3', retries: 0 },
          { id: 'bad2', url: '/bad2.mp3', retries: 0 },
        ])
      ).rejects.toThrow(LoadError);
    });
  });

  describe('concurrency control', () => {
    test('respects maxConcurrent limit', async () => {
      // Track how many files are being loaded simultaneously
      let concurrent = 0;
      let maxConcurrent = 0;

      // Create a loader with maxConcurrent = 2
      const customLoader = new AudioBufferLoader(mockFileLoader, new AudioDecoder(mockContext as unknown as AudioContext), {
        maxConcurrent: 2,
      });

      // Add files with delays to track concurrency
      for (let i = 1; i <= 5; i++) {
        mockFileLoader.addFile(`/file${i}.mp3`, createFakeAudioData(), 50);
      }

      // Spy on the fetch to track concurrency
      const originalFetch = mockFileLoader.fetch.bind(mockFileLoader);
      mockFileLoader.fetch = async (url: string, timeout: number) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        const result = await originalFetch(url, timeout);
        concurrent--;
        return result;
      };

      await customLoader.load([
        { id: 'file1', url: '/file1.mp3' },
        { id: 'file2', url: '/file2.mp3' },
        { id: 'file3', url: '/file3.mp3' },
        { id: 'file4', url: '/file4.mp3' },
        { id: 'file5', url: '/file5.mp3' },
      ]);

      // Should never exceed maxConcurrent
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('retry logic', () => {
    test('retries failed requests', async () => {
      let attempts = 0;

      // Fail twice, then succeed
      mockFileLoader.fetch = async (url: string, _timeout: number): Promise<ArrayBuffer> => {
        attempts++;
        if (attempts <= 2) {
          throw new NetworkError('Temporary failure', url);
        }
        return createFakeAudioData();
      };

      const result = await loader.loadSingle({
        id: 'flaky',
        url: '/flaky.mp3',
        retries: 3,
      });

      expect(result.id).toBe('flaky');
      expect(attempts).toBe(3); // Failed twice, succeeded on third
    });

    test('gives up after max retries', async () => {
      let attempts = 0;

      mockFileLoader.fetch = async () => {
        attempts++;
        throw new NetworkError('Always fails', '/bad.mp3');
      };

      await expect(
        loader.loadSingle({
          id: 'bad',
          url: '/bad.mp3',
          retries: 2,
        })
      ).rejects.toThrow(LoadError);

      expect(attempts).toBe(3); // Initial attempt + 2 retries
    });
  });

  describe('progress events', () => {
    test('emits progress events', async () => {
      mockFileLoader.addFile('/file1.mp3', createFakeAudioData());
      mockFileLoader.addFile('/file2.mp3', createFakeAudioData());

      const progressEvents: LoadProgress[] = [];
      loader.on('progress', (progress) => {
        progressEvents.push(progress);
      });

      await loader.load([
        { id: 'file1', url: '/file1.mp3' },
        { id: 'file2', url: '/file2.mp3' },
      ]);

      // Should have multiple progress events
      expect(progressEvents.length).toBeGreaterThan(0);

      // First event should be 0%
      expect(progressEvents[0]?.percentage).toBe(0);

      // Last event should be 100%
      const last = progressEvents[progressEvents.length - 1];
      expect(last?.percentage).toBe(100);
      expect(last?.loaded).toBe(2);
    });

    test('emits fileLoaded events', async () => {
      mockFileLoader.addFile('/file1.mp3', createFakeAudioData());
      mockFileLoader.addFile('/file2.mp3', createFakeAudioData());

      const loadedFiles: LoadResult[] = [];
      loader.on('fileLoaded', (result) => {
        loadedFiles.push(result);
      });

      await loader.load([
        { id: 'file1', url: '/file1.mp3' },
        { id: 'file2', url: '/file2.mp3' },
      ]);

      expect(loadedFiles).toHaveLength(2);
      expect(loadedFiles.map((f) => f.id)).toEqual(['file1', 'file2']);
    });

    test('emits fileFailed events', async () => {
      mockFileLoader.addFile('/good.mp3', createFakeAudioData());
      mockFileLoader.addFailure('/bad.mp3', new NetworkError('Failed', '/bad.mp3'));

      const failures: LoadFailure[] = [];
      loader.on('fileFailed', (failure) => {
        failures.push(failure);
      });

      await loader.load([
        { id: 'good', url: '/good.mp3' },
        { id: 'bad', url: '/bad.mp3', retries: 0 },
      ]);

      expect(failures).toHaveLength(1);
      expect(failures[0]?.id).toBe('bad');
    });

    test('emits complete event', async () => {
      mockFileLoader.addFile('/file.mp3', createFakeAudioData());

      let completed = false;
      loader.on('complete', () => {
        completed = true;
      });

      await loader.load([{ id: 'file', url: '/file.mp3' }]);

      expect(completed).toBe(true);
    });
  });

  describe('cancellation', () => {
    test('cancels in-progress loading', async () => {
      mockFileLoader.addFile('/file1.mp3', createFakeAudioData(), 100);
      mockFileLoader.addFile('/file2.mp3', createFakeAudioData(), 100);
      mockFileLoader.addFile('/file3.mp3', createFakeAudioData(), 100);

      const promise = loader.load([
        { id: 'file1', url: '/file1.mp3' },
        { id: 'file2', url: '/file2.mp3' },
        { id: 'file3', url: '/file3.mp3' },
      ]);

      // Cancel after a short delay
      setTimeout(() => loader.cancel(), 50);

      await expect(promise).rejects.toThrow(CancelledError);
    });

    test('emits cancelled event', async () => {
      mockFileLoader.addFile('/file.mp3', createFakeAudioData(), 100);

      let cancelled = false;
      loader.on('cancelled', () => {
        cancelled = true;
      });

      const promise = loader.load([{ id: 'file', url: '/file.mp3' }]);

      setTimeout(() => loader.cancel(), 50);

      await expect(promise).rejects.toThrow(CancelledError);
      expect(cancelled).toBe(true);
    });
  });

  describe('event unsubscribing', () => {
    test('unsubscribe function stops receiving events', async () => {
      mockFileLoader.addFile('/file.mp3', createFakeAudioData());

      let eventCount = 0;
      const unsubscribe = loader.on('progress', () => {
        eventCount++;
      });

      // Unsubscribe immediately
      unsubscribe();

      await loader.load([{ id: 'file', url: '/file.mp3' }]);

      // Should not have received any events
      expect(eventCount).toBe(0);
    });
  });
});
