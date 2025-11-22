/**
 * Audio File Loader
 *
 * Handles fetching audio files from URLs with timeout support.
 * Simple, focused, and easy to test.
 *
 * What it does:
 * 1. Fetch a file from a URL
 * 2. Handle timeouts gracefully
 * 3. Convert response to ArrayBuffer
 * 4. Provide clear errors if something goes wrong
 */

import { NetworkError, TimeoutError } from './errors.js';
import type { IAudioFileLoader } from './types.js';

/**
 * Fetches audio files using the modern fetch API.
 *
 * Why a class?
 * - Easy to mock in tests (just implement IAudioFileLoader)
 * - Could be extended with caching, retries, etc.
 * - Keeps all fetch logic in one place
 *
 * Example:
 *   const loader = new AudioFileLoader();
 *   const data = await loader.fetch('/audio/kick.mp3', 5000);
 */
export class AudioFileLoader implements IAudioFileLoader {
  /**
   * Fetch an audio file from a URL.
   *
   * @param url - Where to fetch the file from
   * @param timeout - How long to wait before giving up (milliseconds)
   * @returns Raw audio file data
   * @throws NetworkError if the request fails
   * @throws TimeoutError if it takes too long
   *
   * How it works:
   * 1. Create AbortController for timeout handling
   * 2. Start fetch request
   * 3. Start timeout timer
   * 4. If timeout fires first → abort and throw TimeoutError
   * 5. If fetch completes first → return data
   * 6. Always cleanup the timer
   */
  async fetch(url: string, timeout: number): Promise<ArrayBuffer> {
    // AbortController lets us cancel the fetch if it times out
    const controller = new AbortController();
    const signal = controller.signal;

    // Set up the timeout
    const timeoutId = setTimeout(() => {
      controller.abort(); // This cancels the fetch
    }, timeout);

    try {
      // Start the fetch request
      const response = await fetch(url, { signal });

      // Check if the request was successful (status 200-299)
      if (!response.ok) {
        throw NetworkError.fromResponse(url, response);
      }

      // Convert the response to an ArrayBuffer
      // This is the raw binary data of the audio file
      const arrayBuffer = await response.arrayBuffer();

      return arrayBuffer;
    } catch (error) {
      // If the fetch was aborted, it was our timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw TimeoutError.create(url, timeout);
      }

      // If it's already a NetworkError, just re-throw it
      if (error instanceof NetworkError) {
        throw error;
      }

      // Otherwise, wrap it in a NetworkError
      if (error instanceof Error) {
        throw NetworkError.fromError(url, error);
      }

      // This should never happen, but TypeScript makes us handle it
      throw new NetworkError(`Unknown error fetching ${url}`, url);
    } finally {
      // Always clear the timeout, even if an error occurred
      // This prevents memory leaks
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Helper function to check if an error is a network error.
 * Useful when you want to handle network errors differently from other errors.
 *
 * Example:
 *   try {
 *     await loader.fetch(url, timeout);
 *   } catch (error) {
 *     if (isNetworkError(error)) {
 *       console.log('Network problem - maybe retry?');
 *     }
 *   }
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Helper function to check if an error is a timeout error.
 *
 * Example:
 *   try {
 *     await loader.fetch(url, timeout);
 *   } catch (error) {
 *     if (isTimeoutError(error)) {
 *       console.log('Too slow - try with longer timeout');
 *     }
 *   }
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
