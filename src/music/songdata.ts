/**
 * Song Library Data
 *
 * The complete kwyjibo song library - 273 hip-hop instrumentals
 * organized by key and tempo.
 *
 * Each song has been:
 * - Beat-gridded to exact tempos (84, 94, 102 BPM)
 * - Recorded in lead (16-beat) and body (64-beat) versions
 * - Categorized by musical key (1-12)
 *
 * Usage:
 *   import { songs } from './songdata';
 *   const song = songs.find(s => s.id === 1);
 */

import type { Song } from './types.js';

/**
 * The complete song library.
 * Imported from the original songdata.js with TypeScript typing.
 */
const importedData = (await import('../../songdata.js')).songdata as unknown[];
export const songs: readonly Song[] = importedData as Song[];

/**
 * Validate that songs match expected format.
 * Throws error if data is invalid.
 */
function validateSongs(songs: readonly unknown[]): void {
  if (!Array.isArray(songs) || songs.length === 0) {
    throw new Error('songdata must be a non-empty array');
  }

  const seenIds = new Set<number>();

  for (const item of songs) {
    const song = item as Record<string, unknown>;

    // Check required fields
    if (typeof song.id !== 'number' || song.id < 1) {
      throw new Error(`Invalid song ID: ${String(song.id)}`);
    }

    if (seenIds.has(song.id)) {
      throw new Error(`Duplicate song ID: ${song.id}`);
    }
    seenIds.add(song.id);

    if (typeof song.artist !== 'string' || song.artist.length === 0) {
      throw new Error(`Song ${song.id as number} has invalid artist`);
    }

    if (typeof song.title !== 'string' || song.title.length === 0) {
      throw new Error(`Song ${song.id as number} has invalid title`);
    }

    if (typeof song.key !== 'number' || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(song.key)) {
      throw new Error(`Song ${song.id as number} has invalid key: ${String(song.key)}`);
    }

    if (typeof song.bpm !== 'number' || ![84, 94, 102].includes(song.bpm)) {
      throw new Error(`Song ${song.id as number} has invalid BPM: ${String(song.bpm)}`);
    }
  }
}

// Validate on module load
validateSongs(songs);

/**
 * Get a song by ID.
 * Returns undefined if not found.
 */
export function getSongById(id: number): Song | undefined {
  return songs.find((s) => s.id === id);
}

/**
 * Get all songs by an artist.
 */
export function getSongsByArtist(artist: string): readonly Song[] {
  return songs.filter((s) => s.artist === artist);
}

/**
 * Get all songs at a specific tempo.
 */
export function getSongsByTempo(bpm: number): readonly Song[] {
  return songs.filter((s) => s.bpm === bpm);
}

/**
 * Get all songs in a specific key.
 */
export function getSongsByKey(key: number): readonly Song[] {
  return songs.filter((s) => s.key === key);
}

/**
 * Get random song from the library.
 */
export function getRandomSong(): Song {
  const index = Math.floor(Math.random() * songs.length);
  const song = songs[index];
  if (!song) {
    throw new Error('Failed to get random song');
  }
  return song;
}
