/**
 * Audio Buffer System - Type Definitions
 *
 * This file contains all the type definitions for loading and managing audio buffers.
 * Think of these as "contracts" - they define what data looks like and what methods do.
 *
 * Reading tip: Start with LoadRequest and LoadResult to understand the flow.
 */

// ============================================================================
// REQUEST & RESPONSE TYPES
// ============================================================================

/**
 * Represents a request to load a single audio file.
 *
 * Example:
 *   {
 *     id: 'kick-drum',
 *     url: '/audio/drums/kick.mp3',
 *     timeout: 5000,
 *     retries: 3
 *   }
 */
export interface LoadRequest {
  /** Unique identifier for this audio file (you choose this) */
  id: string;

  /** Where to fetch the audio file from */
  url: string;

  /** Optional: Any extra data you want to attach (BPM, artist, etc.) */
  metadata?: Record<string, unknown>;

  /** Optional: How long to wait before giving up (milliseconds). Default: 10000 */
  timeout?: number;

  /** Optional: How many times to retry if it fails. Default: 3 */
  retries?: number;
}

/**
 * The result after successfully loading an audio file.
 * Contains the actual audio data plus useful information.
 *
 * Example:
 *   {
 *     id: 'kick-drum',
 *     buffer: AudioBuffer { ... },
 *     url: '/audio/drums/kick.mp3',
 *     loadTimeMs: 245
 *   }
 */
export interface LoadResult {
  /** The ID from your original request */
  id: string;

  /** The decoded audio data, ready to play */
  buffer: AudioBuffer;

  /** The URL it was loaded from */
  url: string;

  /** How long it took to load (milliseconds) */
  loadTimeMs: number;

  /** Any metadata you provided in the request */
  metadata?: Record<string, unknown>;
}

/**
 * Information about an audio file that failed to load.
 * Helps you understand what went wrong and decide what to do.
 */
export interface LoadFailure {
  /** The ID from your original request */
  id: string;

  /** The URL that failed */
  url: string;

  /** What went wrong */
  error: Error;

  /** How many times we tried before giving up */
  attempts: number;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Real-time information about loading progress.
 * Subscribe to this to show loading bars or progress indicators.
 *
 * Example:
 *   {
 *     total: 10,
 *     loaded: 7,
 *     failed: 1,
 *     current: 'snare-drum',
 *     percentage: 70
 *   }
 */
export interface LoadProgress {
  /** Total number of files to load */
  total: number;

  /** How many have loaded successfully */
  loaded: number;

  /** How many failed permanently */
  failed: number;

  /** Which file is currently being loaded (if any) */
  current: string | null;

  /** Completion percentage (0-100) */
  percentage: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Events that the AudioBufferLoader can emit.
 * Use these to react to loading progress and completion.
 */
export type LoaderEvent =
  | 'progress'      // Loading progress updated
  | 'fileLoaded'    // A single file finished loading
  | 'fileFailed'    // A single file failed
  | 'complete'      // All files finished (success or failure)
  | 'cancelled';    // Loading was cancelled

/**
 * Type-safe event data mapping.
 * This ensures you get the right data type for each event.
 */
export interface LoaderEventMap {
  progress: LoadProgress;
  fileLoaded: LoadResult;
  fileFailed: LoadFailure;
  complete: { results: LoadResult[]; failures: LoadFailure[] };
  cancelled: void;
}

// ============================================================================
// OPTIONS & CONFIGURATION
// ============================================================================

/**
 * Configuration options for the AudioBufferLoader.
 * All options are optional - sensible defaults are provided.
 */
export interface LoaderOptions {
  /**
   * Maximum number of files to load simultaneously.
   * Higher = faster but more memory/bandwidth.
   * Default: 6
   */
  maxConcurrent?: number;

  /**
   * Default timeout for requests (milliseconds).
   * Can be overridden per-request.
   * Default: 10000
   */
  defaultTimeout?: number;

  /**
   * Default number of retry attempts.
   * Can be overridden per-request.
   * Default: 3
   */
  defaultRetries?: number;

  /**
   * Delay between retry attempts (milliseconds).
   * Uses exponential backoff: delay * 2^attempt.
   * Default: 1000
   */
  retryDelay?: number;
}

// ============================================================================
// INTERFACES (Contracts for Services)
// ============================================================================

/**
 * Contract for fetching audio files from URLs.
 * Any class implementing this can be used as a file loader.
 *
 * Why? This makes it easy to:
 * - Test with fake data
 * - Switch between fetch/XHR/file system
 * - Add caching, compression, etc.
 */
export interface IAudioFileLoader {
  /**
   * Fetch an audio file and return the raw binary data.
   *
   * @param url - Where to fetch from
   * @param timeout - How long to wait (milliseconds)
   * @returns Raw audio file data as ArrayBuffer
   * @throws NetworkError if the fetch fails
   * @throws TimeoutError if it takes too long
   */
  fetch(url: string, timeout: number): Promise<ArrayBuffer>;
}

/**
 * Contract for decoding audio data into playable buffers.
 * Any class implementing this can be used as a decoder.
 *
 * Why? This lets you:
 * - Mock the AudioContext in tests
 * - Use different audio contexts (offline, etc.)
 * - Add processing during decode (normalize, etc.)
 */
export interface IAudioDecoder {
  /**
   * Decode raw audio data into an AudioBuffer.
   *
   * @param arrayBuffer - Raw audio file data
   * @returns Decoded audio buffer ready to play
   * @throws DecodeError if the file is corrupt or unsupported
   */
  decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer>;
}

/**
 * Contract for the main audio buffer loader.
 * This is the public API that your app will use.
 */
export interface IAudioBufferLoader {
  /**
   * Load multiple audio files at once.
   *
   * @param requests - Array of files to load
   * @returns Array of successfully loaded files
   * @throws LoadError if all files fail (partial failures are in the result)
   *
   * Example:
   *   const results = await loader.load([
   *     { id: 'kick', url: '/kick.mp3' },
   *     { id: 'snare', url: '/snare.mp3' }
   *   ]);
   */
  load(requests: LoadRequest[]): Promise<LoadResult[]>;

  /**
   * Load a single audio file.
   * Convenience method - same as load([request])[0].
   *
   * @param request - File to load
   * @returns The loaded audio buffer
   */
  loadSingle(request: LoadRequest): Promise<LoadResult>;

  /**
   * Cancel all in-progress loading.
   * Files that are already loaded will still be available.
   */
  cancel(): void;

  /**
   * Subscribe to loading events.
   *
   * @param event - Which event to listen for
   * @param handler - Function to call when event fires
   * @returns Function to unsubscribe
   *
   * Example:
   *   const unsubscribe = loader.on('progress', (progress) => {
   *     console.log(`${progress.percentage}% complete`);
   *   });
   *   // Later: unsubscribe();
   */
  on<E extends LoaderEvent>(
    event: E,
    handler: (data: LoaderEventMap[E]) => void
  ): () => void;
}
