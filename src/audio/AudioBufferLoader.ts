/**
 * Audio Buffer Loader
 *
 * The main orchestrator for loading audio files.
 * Coordinates file loading, decoding, retry logic, and progress tracking.
 *
 * Features:
 * - Load multiple files concurrently (with limit)
 * - Automatic retry with exponential backoff
 * - Real-time progress events
 * - Cancellation support
 * - Comprehensive error handling
 * - Type-safe throughout
 *
 * This is the class you'll use in your app!
 */

import { EventEmitter } from '@core/EventEmitter';
import { CancelledError, LoadError } from './errors.js';
import type {
  IAudioBufferLoader,
  IAudioDecoder,
  IAudioFileLoader,
  LoaderEvent,
  LoaderEventMap,
  LoaderOptions,
  LoadProgress,
  LoadRequest,
  LoadResult,
  LoadFailure,
} from './types.js';

/**
 * Default configuration values.
 * These provide sensible defaults while allowing customization.
 */
const DEFAULT_OPTIONS: Required<LoaderOptions> = {
  maxConcurrent: 6, // Same as browser's default for HTTP/1.1
  defaultTimeout: 10000, // 10 seconds
  defaultRetries: 3, // Retry up to 3 times
  retryDelay: 1000, // Start with 1 second, then 2s, 4s, 8s...
};

/**
 * Main audio buffer loader class.
 *
 * Example usage:
 *   const loader = new AudioBufferLoader(fileLoader, decoder);
 *
 *   // Subscribe to progress
 *   loader.on('progress', (p) => console.log(`${p.percentage}%`));
 *
 *   // Load files
 *   const results = await loader.load([
 *     { id: 'kick', url: '/audio/kick.mp3' },
 *     { id: 'snare', url: '/audio/snare.mp3' },
 *   ]);
 *
 *   // Play them!
 *   results.forEach(r => playSample(r.buffer));
 */
export class AudioBufferLoader implements IAudioBufferLoader {
  /** Event emitter for progress and status updates */
  private readonly events = new EventEmitter<LoaderEventMap>();

  /** Configuration options */
  private readonly options: Required<LoaderOptions>;

  /** Flag to track if loading has been cancelled */
  private cancelled = false;

  /**
   * Create a new audio buffer loader.
   *
   * @param fileLoader - Service to fetch audio files (handles network)
   * @param decoder - Service to decode audio data (handles Web Audio API)
   * @param options - Optional configuration (uses defaults if not provided)
   *
   * Why dependency injection?
   * - Easy to test (mock the dependencies)
   * - Flexible (swap implementations)
   * - Clear dependencies (you see what it needs)
   */
  constructor(
    private readonly fileLoader: IAudioFileLoader,
    private readonly decoder: IAudioDecoder,
    options: LoaderOptions = {}
  ) {
    // Merge provided options with defaults
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Load multiple audio files concurrently.
   *
   * @param requests - Array of files to load
   * @returns Promise that resolves with successfully loaded files
   * @throws LoadError if all files fail (partial failures are NOT thrown)
   * @throws CancelledError if cancelled before completion
   *
   * How it works:
   * 1. Reset cancelled flag
   * 2. Create a queue of requests
   * 3. Process requests with concurrency limit
   * 4. Retry failures with exponential backoff
   * 5. Emit progress events along the way
   * 6. Return successful results (or throw if all failed)
   *
   * Example:
   *   const results = await loader.load([
   *     { id: 'song1', url: '/songs/song1.mp3' },
   *     { id: 'song2', url: '/songs/song2.mp3', timeout: 15000 },
   *   ]);
   *
   *   results.forEach(result => {
   *     console.log(`Loaded ${result.id} in ${result.loadTimeMs}ms`);
   *   });
   */
  async load(requests: LoadRequest[]): Promise<LoadResult[]> {
    // Reset cancellation flag
    this.cancelled = false;

    if (requests.length === 0) {
      return [];
    }

    // Track our progress
    const progress: LoadProgress = {
      total: requests.length,
      loaded: 0,
      failed: 0,
      current: null,
      percentage: 0,
    };

    // Storage for results and failures
    const results: LoadResult[] = [];
    const failures: LoadFailure[] = [];

    // Emit initial progress
    this.emitProgress(progress);

    // Process requests with concurrency control
    await this.processQueue(requests, progress, results, failures);

    // Check if we were cancelled
    if (this.cancelled) {
      this.events.emit('cancelled', undefined);
      throw new CancelledError();
    }

    // Emit completion event
    this.events.emit('complete', { results, failures });

    // If everything failed, throw an error
    if (results.length === 0 && failures.length > 0) {
      throw LoadError.fromFailures(failures);
    }

    return results;
  }

  /**
   * Load a single audio file.
   * Convenience method - equivalent to load([request])[0].
   *
   * @param request - File to load
   * @returns Promise that resolves with the loaded file
   * @throws LoadError if loading fails after all retries
   *
   * Example:
   *   const result = await loader.loadSingle({
   *     id: 'explosion',
   *     url: '/sfx/explosion.mp3'
   *   });
   *
   *   playSample(result.buffer);
   */
  async loadSingle(request: LoadRequest): Promise<LoadResult> {
    const results = await this.load([request]);

    // This should always exist because load() throws if all fail
    const result = results[0];
    if (!result) {
      throw new LoadError('Failed to load file', [
        {
          id: request.id,
          url: request.url,
          error: new Error('Unknown error'),
          attempts: 1,
        },
      ]);
    }

    return result;
  }

  /**
   * Cancel all in-progress loading.
   * Files that are already loaded remain available.
   *
   * This is useful when:
   * - User navigates away
   * - Loading a different set of files
   * - Component unmounts
   *
   * Example:
   *   const promise = loader.load(files);
   *   // User clicks "Back"
   *   loader.cancel();
   *   // promise will reject with CancelledError
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Subscribe to events.
   *
   * @param event - Event name to listen for
   * @param handler - Function to call when event fires
   * @returns Unsubscribe function
   *
   * Available events:
   * - 'progress': Loading progress updated
   * - 'fileLoaded': A file finished loading
   * - 'fileFailed': A file failed permanently
   * - 'complete': All loading finished
   * - 'cancelled': Loading was cancelled
   *
   * Example:
   *   const unsubscribe = loader.on('fileLoaded', (result) => {
   *     console.log(`${result.id} loaded in ${result.loadTimeMs}ms`);
   *   });
   *
   *   // Later, stop listening:
   *   unsubscribe();
   */
  on<E extends LoaderEvent>(
    event: E,
    handler: (data: LoaderEventMap[E]) => void
  ): () => void {
    return this.events.on(event, handler);
  }

  /**
   * Process the queue of requests with concurrency control.
   * This is the heart of the loader.
   *
   * Algorithm:
   * 1. Take up to maxConcurrent requests from queue
   * 2. Load them in parallel
   * 3. When one finishes, grab the next from queue
   * 4. Repeat until queue is empty
   * 5. Update progress along the way
   */
  private async processQueue(
    requests: LoadRequest[],
    progress: LoadProgress,
    results: LoadResult[],
    failures: LoadFailure[]
  ): Promise<void> {
    // Create a queue (we'll shift from the front as we process)
    const queue = [...requests];
    const inProgress = new Set<Promise<void>>();

    // Keep going until queue is empty and nothing in progress
    while (queue.length > 0 || inProgress.size > 0) {
      // Check if cancelled
      if (this.cancelled) {
        break;
      }

      // Fill up to maxConcurrent
      while (queue.length > 0 && inProgress.size < this.options.maxConcurrent) {
        const request = queue.shift();
        if (!request) break;

        // Start loading this file
        const promise = this.loadOne(request, progress, results, failures);
        inProgress.add(promise);

        // Remove from in-progress when done
        void promise.finally(() => inProgress.delete(promise));
      }

      // Wait for at least one to finish before continuing
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }
  }

  /**
   * Load a single file with retry logic.
   */
  private async loadOne(
    request: LoadRequest,
    progress: LoadProgress,
    results: LoadResult[],
    failures: LoadFailure[]
  ): Promise<void> {
    const timeout = request.timeout ?? this.options.defaultTimeout;
    const maxRetries = request.retries ?? this.options.defaultRetries;

    // Update progress to show we're working on this file
    progress.current = request.id;
    this.emitProgress(progress);

    let lastError: Error | null = null;
    const startTime = performance.now();

    // Try loading (with retries)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check if cancelled
      if (this.cancelled) {
        return;
      }

      try {
        // Fetch the file
        const arrayBuffer = await this.fileLoader.fetch(request.url, timeout);

        // Decode the audio data
        const buffer = await this.decoder.decode(arrayBuffer);

        // Success! Create result object
        const endTime = performance.now();
        const result: LoadResult = {
          id: request.id,
          buffer,
          url: request.url,
          loadTimeMs: Math.round(endTime - startTime),
          metadata: request.metadata,
        };

        // Store and emit
        results.push(result);
        progress.loaded++;
        progress.current = null;
        progress.percentage = Math.round((progress.loaded / progress.total) * 100);

        this.events.emit('fileLoaded', result);
        this.emitProgress(progress);

        return; // Success! Exit the retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // If this wasn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          // Exponential backoff: delay * 2^attempt
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const failure: LoadFailure = {
      id: request.id,
      url: request.url,
      error: lastError ?? new Error('Unknown error'),
      attempts: maxRetries + 1,
    };

    failures.push(failure);
    progress.failed++;
    progress.current = null;
    progress.percentage = Math.round(
      ((progress.loaded + progress.failed) / progress.total) * 100
    );

    this.events.emit('fileFailed', failure);
    this.emitProgress(progress);
  }

  /**
   * Emit a progress event.
   * Creates a copy of progress to avoid mutations affecting subscribers.
   */
  private emitProgress(progress: LoadProgress): void {
    this.events.emit('progress', { ...progress });
  }

  /**
   * Sleep for a specified duration.
   * Used for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
