/**
 * Mock Audio File Loader for Testing
 *
 * A fake file loader that doesn't make real network requests.
 * Perfect for fast, reliable tests.
 */

import { NetworkError } from '@/audio';
import type { IAudioFileLoader } from '@/audio';

/**
 * Configuration for how a mock file should behave.
 */
interface MockFileConfig {
  /** Data to return (or null to fail) */
  data: ArrayBuffer | null;
  /** How long to simulate loading (milliseconds) */
  delay?: number;
  /** Error to throw (if any) */
  error?: Error;
}

/**
 * Mock file loader that simulates fetching audio files.
 *
 * Example:
 *   const mock = new MockAudioFileLoader();
 *   mock.addFile('/song.mp3', createFakeAudioData());
 *   const data = await mock.fetch('/song.mp3', 5000);
 */
export class MockAudioFileLoader implements IAudioFileLoader {
  private files = new Map<string, MockFileConfig>();

  /**
   * Register a mock file that will succeed.
   *
   * @param url - The URL to mock
   * @param data - The data to return
   * @param delay - Optional delay in milliseconds
   */
  addFile(url: string, data: ArrayBuffer, delay = 0): void {
    this.files.set(url, { data, delay });
  }

  /**
   * Register a mock file that will fail.
   *
   * @param url - The URL to mock
   * @param error - The error to throw
   * @param delay - Optional delay before throwing
   */
  addFailure(url: string, error: Error, delay = 0): void {
    this.files.set(url, { data: null, error, delay });
  }

  /**
   * Mock implementation of fetch.
   */
  async fetch(url: string, _timeout: number): Promise<ArrayBuffer> {
    const config = this.files.get(url);

    // File not registered - simulate 404
    if (!config) {
      throw new NetworkError(`File not found: ${url}`, url, 404);
    }

    // Simulate network delay
    if (config.delay) {
      await new Promise((resolve) => setTimeout(resolve, config.delay));
    }

    // Throw configured error
    if (config.error) {
      throw config.error;
    }

    // Return configured data
    if (!config.data) {
      throw new NetworkError(`No data configured for ${url}`, url);
    }

    return config.data;
  }

  /**
   * Clear all registered files.
   */
  clear(): void {
    this.files.clear();
  }
}

/**
 * Create fake audio data for testing.
 * This isn't real audio, but it's the right shape.
 */
export function createFakeAudioData(sizeBytes = 1024): ArrayBuffer {
  const buffer = new ArrayBuffer(sizeBytes);
  const view = new Uint8Array(buffer);

  // Fill with some fake data
  for (let i = 0; i < sizeBytes; i++) {
    view[i] = i % 256;
  }

  return buffer;
}
