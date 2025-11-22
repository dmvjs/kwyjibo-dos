/**
 * Audio Loading Errors
 *
 * Custom error classes that provide clear information about what went wrong.
 * Each error includes helpful context so you can handle failures gracefully.
 *
 * Why custom errors?
 * - Clear error types (catch specific problems)
 * - Extra context (URL, ID, etc.)
 * - Better error messages for debugging
 */

/**
 * Base class for all audio loading errors.
 * You can catch this to handle any audio-related error.
 */
export class AudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8 engines (Chrome, Node)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when a network request fails.
 *
 * Common causes:
 * - File doesn't exist (404)
 * - No internet connection
 * - Server error (500)
 * - CORS issues
 *
 * Example:
 *   try {
 *     await loader.load([{ id: 'song', url: '/missing.mp3' }]);
 *   } catch (error) {
 *     if (error instanceof NetworkError) {
 *       console.log(`Failed to fetch ${error.url}: ${error.status}`);
 *     }
 *   }
 */
export class NetworkError extends AudioError {
  public readonly url: string;
  public readonly status?: number;

  constructor(
    message: string,
    url: string,
    status?: number
  ) {
    super(message);
    this.url = url;
    this.status = status;
  }

  /**
   * Create a NetworkError from a fetch Response
   */
  static fromResponse(url: string, response: Response): NetworkError {
    return new NetworkError(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      url,
      response.status
    );
  }

  /**
   * Create a NetworkError from a generic Error
   */
  static fromError(url: string, error: Error): NetworkError {
    return new NetworkError(`Failed to fetch ${url}: ${error.message}`, url);
  }
}

/**
 * Thrown when a request takes too long.
 *
 * Common causes:
 * - Slow internet connection
 * - Large file size
 * - Server not responding
 * - Timeout setting too low
 *
 * Solution: Try again or increase the timeout
 *
 * Example:
 *   try {
 *     await loader.load([{ id: 'song', url: '/huge.mp3', timeout: 1000 }]);
 *   } catch (error) {
 *     if (error instanceof TimeoutError) {
 *       // Retry with longer timeout
 *       await loader.load([{ id: 'song', url: '/huge.mp3', timeout: 10000 }]);
 *     }
 *   }
 */
export class TimeoutError extends AudioError {
  public readonly url: string;
  public readonly timeoutMs: number;

  constructor(
    message: string,
    url: string,
    timeoutMs: number
  ) {
    super(message);
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  static create(url: string, timeoutMs: number): TimeoutError {
    return new TimeoutError(
      `Request to ${url} timed out after ${timeoutMs}ms`,
      url,
      timeoutMs
    );
  }
}

/**
 * Thrown when audio data can't be decoded into a playable buffer.
 *
 * Common causes:
 * - File is corrupted
 * - Unsupported audio format
 * - File isn't actually audio (e.g., HTML error page)
 * - Incomplete download
 *
 * Solution: Check the file and try a different format (MP3, WAV, etc.)
 *
 * Example:
 *   try {
 *     await loader.load([{ id: 'song', url: '/corrupted.mp3' }]);
 *   } catch (error) {
 *     if (error instanceof DecodeError) {
 *       console.log('File is corrupted, skipping');
 *     }
 *   }
 */
export class DecodeError extends AudioError {
  public readonly url: string;
  public readonly originalError?: Error;

  constructor(
    message: string,
    url: string,
    originalError?: Error
  ) {
    super(message);
    this.url = url;
    this.originalError = originalError;
  }

  static create(url: string, originalError?: Error): DecodeError {
    const message = originalError
      ? `Failed to decode audio from ${url}: ${originalError.message}`
      : `Failed to decode audio from ${url}`;
    return new DecodeError(message, url, originalError);
  }
}

/**
 * Thrown when loading was cancelled by calling loader.cancel().
 *
 * This is not really an error - it's expected behavior.
 * Your code might catch this if you're awaiting load() when cancel() is called.
 *
 * Example:
 *   const promise = loader.load(files);
 *   // User navigates away
 *   loader.cancel();
 *   // promise will reject with CancelledError
 */
export class CancelledError extends AudioError {
  constructor(message = 'Loading was cancelled') {
    super(message);
  }
}

/**
 * Thrown when multiple files fail and we can't proceed.
 *
 * This includes details about each failure so you can handle them individually.
 *
 * Example:
 *   try {
 *     await loader.load(manyFiles);
 *   } catch (error) {
 *     if (error instanceof LoadError) {
 *       console.log(`${error.failures.length} files failed to load`);
 *       error.failures.forEach(f => console.log(`- ${f.id}: ${f.error.message}`));
 *     }
 *   }
 */
export class LoadError extends AudioError {
  public readonly failures: Array<{
    id: string;
    url: string;
    error: Error;
    attempts: number;
  }>;

  constructor(
    message: string,
    failures: Array<{
      id: string;
      url: string;
      error: Error;
      attempts: number;
    }>
  ) {
    super(message);
    this.failures = failures;
  }

  static fromFailures(
    failures: Array<{ id: string; url: string; error: Error; attempts: number }>
  ): LoadError {
    const count = failures.length;
    const message =
      count === 1
        ? `Failed to load audio file: ${failures[0]?.id}`
        : `Failed to load ${count} audio files`;

    return new LoadError(message, failures);
  }
}
