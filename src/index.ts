/**
 * Kwyjibo v2 - AI-Powered DJ System
 *
 * Main entry point for the kwyjibo mixing engine.
 * Exports the public API for UI developers.
 *
 * Example:
 *   import { KwyjiboEngine, createAudioLoader, songs } from 'kwyjibo-v2';
 *
 *   const audioLoader = createAudioLoader();
 *   const engine = new KwyjiboEngine({ songs, audioLoader });
 *
 *   engine.on('trackSelected', (result) => {
 *     console.log(`Selected: ${result.track.song.title}`);
 *   });
 *
 *   await engine.start();
 */

// ============================================================================
// MAIN API
// ============================================================================

export { KwyjiboEngine } from './music/KwyjiboEngine.js';
export type {
  KwyjiboEngineOptions,
  EngineState,
  EngineEvents,
  EngineStatistics,
} from './music/KwyjiboEngine.js';

// ============================================================================
// AUDIO SYSTEM
// ============================================================================

export { createAudioLoader } from './audio/index.js';
export { AudioBufferLoader } from './audio/AudioBufferLoader.js';
export { AudioFileLoader } from './audio/AudioFileLoader.js';
export { AudioDecoder } from './audio/AudioDecoder.js';
export { AudioBufferCache } from './audio/AudioBufferCache.js';

export type {
  IAudioBufferLoader,
  IAudioFileLoader,
  IAudioDecoder,
  LoadRequest,
  LoadResult,
  LoadProgress,
  LoadFailure,
  LoaderOptions,
  LoaderEvent,
  LoaderEventMap,
} from './audio/types.js';

export type { CacheOptions } from './audio/AudioBufferCache.js';

// ============================================================================
// MUSIC TYPES
// ============================================================================

export type {
  Song,
  Key,
  Tempo,
  TrackType,
  Direction,
  TrackRequest,
  SongFilter,
  LibraryStats,
} from './music/types.js';

export {
  isValidKey,
  isValidTempo,
  isValidTrackType,
  isValidDirection,
  ALL_KEYS,
  ALL_TEMPOS,
  BEAT_COUNTS,
} from './music/types.js';

// ============================================================================
// SONG DATA
// ============================================================================

export { songs } from './music/songdata.js';
export {
  getSongById,
  getSongsByArtist,
  getSongsByTempo,
  getSongsByKey,
  getRandomSong,
} from './music/songdata.js';

// ============================================================================
// MUSIC COMPONENTS (Advanced Usage)
// ============================================================================

export { SongLibrary } from './music/SongLibrary.js';
export { KeyManager } from './music/KeyManager.js';
export { SongSelector } from './music/SongSelector.js';

export type {
  SongSelectorOptions,
  SelectionResult,
} from './music/SongSelector.js';

// ============================================================================
// QUANTUM RANDOM (Advanced Usage)
// ============================================================================

export { QuantumRandom, getQuantumRandom, resetQuantumRandom } from './random/QuantumRandom.js';
export type { QuantumRandomOptions, RandomStorage } from './random/QuantumRandom.js';
export { EnhancedRandom, enhancedRandom } from './random/EnhancedRandom.js';

// ============================================================================
// UTILITIES
// ============================================================================

export { EventEmitter } from './core/EventEmitter.js';

// ============================================================================
// ERROR TYPES
// ============================================================================

export {
  AudioError,
  NetworkError,
  TimeoutError,
  DecodeError,
  LoadError,
} from './audio/errors.js';
