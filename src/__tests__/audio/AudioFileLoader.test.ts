/**
 * Tests for AudioFileLoader
 *
 * These tests show how the file loader works and verify it handles
 * all the edge cases correctly.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AudioFileLoader } from '@/audio';
import { NetworkError, TimeoutError } from '@/audio';

/**
 * Mock fetch for testing.
 * We'll replace the global fetch with our own version.
 */
let originalFetch: typeof fetch;
let mockFetch: jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  originalFetch = global.fetch;
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('AudioFileLoader', () => {
  describe('successful fetching', () => {
    test('fetches a file successfully', async () => {
      const loader = new AudioFileLoader();
      const testData = new ArrayBuffer(1024);

      // Configure mock to return success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => testData,
      } as Response);

      const result = await loader.fetch('/test.mp3', 5000);

      expect(result).toBe(testData);
      expect(mockFetch).toHaveBeenCalledWith('/test.mp3', expect.any(Object));
    });

    test('includes abort signal in fetch', async () => {
      const loader = new AudioFileLoader();
      const testData = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => testData,
      } as Response);

      await loader.fetch('/test.mp3', 5000);

      // Verify that fetch was called with an AbortSignal
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs?.[1]).toHaveProperty('signal');
      expect(callArgs?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('error handling', () => {
    test('throws NetworkError on 404', async () => {
      const loader = new AudioFileLoader();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(loader.fetch('/missing.mp3', 5000)).rejects.toThrow(NetworkError);
    });

    test('throws NetworkError on 500', async () => {
      const loader = new AudioFileLoader();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as Response);

      await expect(loader.fetch('/error.mp3', 5000)).rejects.toThrow(NetworkError);
    });

    test('throws NetworkError on network failure', async () => {
      const loader = new AudioFileLoader();

      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(loader.fetch('/test.mp3', 5000)).rejects.toThrow(NetworkError);
    });
  });

  describe('timeout handling', () => {
    test('throws TimeoutError when fetch takes too long', async () => {
      const loader = new AudioFileLoader();

      // Simulate a slow response that will trigger the abort
      mockFetch.mockImplementationOnce(
        (_url, options) =>
          new Promise((resolve, reject) => {
            // Listen for abort signal
            options?.signal?.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });

            // This would resolve after 2 seconds, but abort happens first
            setTimeout(() => {
              resolve({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(1024),
              } as Response);
            }, 2000);
          })
      );

      // But we only wait 100ms - should timeout
      await expect(loader.fetch('/slow.mp3', 100)).rejects.toThrow(TimeoutError);
    });

    test('succeeds if fetch completes before timeout', async () => {
      const loader = new AudioFileLoader();
      const testData = new ArrayBuffer(1024);

      // Simulate a fast response (50ms)
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                arrayBuffer: async () => testData,
              } as Response);
            }, 50);
          })
      );

      // Timeout is 1000ms, should be plenty of time
      const result = await loader.fetch('/fast.mp3', 1000);
      expect(result).toBe(testData);
    });
  });
});
