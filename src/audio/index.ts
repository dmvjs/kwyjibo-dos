/**
 * Audio Buffer Loading System
 *
 * Clean, modular, testable audio file loading for the Web Audio API.
 *
 * Quick Start:
 *   import { createAudioLoader } from './audio';
 *
 *   const loader = createAudioLoader();
 *   const results = await loader.load([
 *     { id: 'kick', url: '/audio/kick.mp3' },
 *     { id: 'snare', url: '/audio/snare.mp3' }
 *   ]);
 */

// Core classes
export { AudioBufferLoader } from './AudioBufferLoader.js';
export { AudioDecoder, getAudioContext, closeAudioContext } from './AudioDecoder.js';
export { AudioFileLoader, isNetworkError, isTimeoutError } from './AudioFileLoader.js';
export { AudioBufferCache } from './AudioBufferCache.js';
export type { CacheOptions } from './AudioBufferCache.js';

// Import the classes for use in createAudioLoader
import { AudioBufferLoader } from './AudioBufferLoader.js';
import { AudioDecoder, getAudioContext } from './AudioDecoder.js';
import { AudioFileLoader } from './AudioFileLoader.js';

// Types and interfaces
export type {
  IAudioBufferLoader,
  IAudioDecoder,
  IAudioFileLoader,
  LoaderEvent,
  LoaderEventMap,
  LoaderOptions,
  LoadFailure,
  LoadProgress,
  LoadRequest,
  LoadResult,
} from './types.js';

// Import LoaderOptions for use in createAudioLoader
import type { LoaderOptions } from './types.js';

// Errors
export {
  AudioError,
  CancelledError,
  DecodeError,
  LoadError,
  NetworkError,
  TimeoutError,
} from './errors.js';

/**
 * Convenience function to create a fully configured loader.
 * This is the easiest way to get started!
 *
 * @param options - Optional configuration
 * @returns Ready-to-use audio buffer loader
 *
 * Example:
 *   const loader = createAudioLoader({ maxConcurrent: 10 });
 *   const results = await loader.load(requests);
 */
export function createAudioLoader(options?: LoaderOptions): AudioBufferLoader {
  const context = getAudioContext();
  const fileLoader = new AudioFileLoader();
  const decoder = new AudioDecoder(context);

  return new AudioBufferLoader(fileLoader, decoder, options);
}
