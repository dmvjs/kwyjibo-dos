/**
 * Music Domain Types
 *
 * Type definitions for songs, keys, tempos, and music selection.
 * These types define the structure of kwyjibo's music library.
 *
 * Key concepts:
 * - Songs have musical keys (1-12 representing chromatic scale)
 * - Songs are available at multiple tempos (84, 94, 102 BPM)
 * - Each song has "lead" (intro) and "body" (main) versions
 */

// ============================================================================
// CORE MUSIC TYPES
// ============================================================================

/**
 * Musical key (1-12).
 * Represents the 12 notes of the chromatic scale.
 *
 * 1 = C, 2 = C#/Db, 3 = D, ..., 12 = B
 */
export type Key = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Tempo in BPM (beats per minute).
 * Kwyjibo uses three fixed tempos.
 */
export type Tempo = 84 | 94 | 102;

/**
 * Track type - lead (intro) or body (main).
 *
 * - lead: 16-beat intro version
 * - body: 64-beat main version
 */
export type TrackType = 'lead' | 'body';

/**
 * Direction for key traversal.
 *
 * - forward: 1 → 2 → 3 → ... → 12 → 1
 * - reverse: 12 → 11 → 10 → ... → 1 → 12
 */
export type Direction = 'forward' | 'reverse';

// ============================================================================
// SONG DATA
// ============================================================================

/**
 * A song in the kwyjibo library.
 *
 * Each song has metadata about its musical properties.
 * The actual audio files are stored separately.
 *
 * Example:
 *   {
 *     id: 1,
 *     artist: "2Pac",
 *     title: "California Love",
 *     key: 2,
 *     bpm: 94
 *   }
 */
export interface Song {
  /** Unique identifier (1-273) */
  id: number;

  /** Artist name */
  artist: string;

  /** Song title */
  title: string;

  /** Musical key (1-12) */
  key: Key;

  /** Native tempo before time-stretching */
  bpm: Tempo;
}

/**
 * A track request combines a song with playback parameters.
 *
 * This tells the audio loader which specific file to load.
 *
 * Example:
 *   {
 *     song: { id: 1, artist: "2Pac", ... },
 *     tempo: 94,
 *     type: "lead"
 *   }
 *   → Loads: /music/00000001-lead.mp3 at 94 BPM
 */
export interface TrackRequest {
  /** The song to play */
  song: Song;

  /** Which tempo version to use */
  tempo: Tempo;

  /** Lead (intro) or body (main) */
  type: TrackType;
}

// ============================================================================
// FILTERING & SELECTION
// ============================================================================

/**
 * Criteria for filtering songs.
 *
 * Example:
 *   { tempo: 94, key: 2 }
 *   → Returns all songs at 94 BPM in key 2
 */
export interface SongFilter {
  /** Filter by tempo */
  tempo?: Tempo;

  /** Filter by key */
  key?: Key;

  /** Filter by artist (exact match) */
  artist?: string;

  /** Exclude specific song IDs */
  excludeIds?: number[];
}

/**
 * Options for song selection.
 */
export interface SelectionOptions {
  /** Current key to match */
  key: Key;

  /** Current tempo */
  tempo: Tempo;

  /** IDs of songs already played (to avoid repeats) */
  excludeIds?: number[];

  /** Prefer songs from same artist as previous? */
  preferSameArtist?: string;
}

// ============================================================================
// KEY SCORING
// ============================================================================

/**
 * Key compatibility score.
 *
 * Measures how well two keys harmonize.
 * Higher score = better compatibility.
 *
 * Example:
 *   Key 1 → Key 1: score = 12/12 (perfect match)
 *   Key 1 → Key 2: score = 11/12 (one step away)
 *   Key 1 → Key 7: score = 6/12 (furthest away)
 */
export interface KeyScore {
  /** The key being scored */
  key: Key;

  /** Compatibility score (1-12) */
  score: number;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Current state of the music selection system.
 *
 * Tracks what's playing, what's next, and how to progress.
 */
export interface MusicState {
  /** Current tempo */
  currentTempo: Tempo;

  /** Current key */
  currentKey: Key;

  /** Direction of key progression */
  direction: Direction;

  /** IDs of songs already played */
  playedSongIds: number[];

  /** Total tracks played in current set */
  tracksPlayed: number;

  /** Index for tempo transitions */
  tempoIndex: number;
}

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

/**
 * Statistics about the song library.
 */
export interface LibraryStats {
  /** Total number of songs */
  totalSongs: number;

  /** Songs per tempo */
  songsByTempo: Record<Tempo, number>;

  /** Songs per key */
  songsByKey: Record<Key, number>;

  /** Unique artists */
  uniqueArtists: number;

  /** Most common key */
  mostCommonKey: Key;

  /** Most common tempo */
  mostCommonTempo: Tempo;
}

// ============================================================================
// UTILITY FUNCTIONS (TYPE GUARDS)
// ============================================================================

/**
 * Check if a number is a valid key (1-12).
 */
export function isValidKey(value: number): value is Key {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

/**
 * Check if a number is a valid tempo (84, 94, or 102).
 */
export function isValidTempo(value: number): value is Tempo {
  return value === 84 || value === 94 || value === 102;
}

/**
 * Check if a string is a valid track type.
 */
export function isValidTrackType(value: string): value is TrackType {
  return value === 'lead' || value === 'body';
}

/**
 * Check if a string is a valid direction.
 */
export function isValidDirection(value: string): value is Direction {
  return value === 'forward' || value === 'reverse';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All valid keys.
 */
export const ALL_KEYS: readonly Key[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * All valid tempos.
 */
export const ALL_TEMPOS: readonly Tempo[] = [84, 94, 102] as const;

/**
 * All valid track types.
 */
export const ALL_TRACK_TYPES: readonly TrackType[] = ['lead', 'body'] as const;

/**
 * Beat counts for each track type.
 */
export const BEAT_COUNTS: Record<TrackType, number> = {
  lead: 16,
  body: 64,
} as const;
