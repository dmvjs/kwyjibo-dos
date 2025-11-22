/**
 * Song Library
 *
 * Manages the collection of 273 songs with filtering, searching,
 * and played-song tracking.
 *
 * Responsibilities:
 * - Load and validate song data
 * - Filter by tempo, key, artist
 * - Track played songs (avoid repeats)
 * - Reset for new sessions
 * - Provide statistics
 */

import type { Song, Tempo, Key, SongFilter, LibraryStats } from './types.js';

/**
 * Manages the song library with filtering and state.
 *
 * Example:
 *   const library = new SongLibrary(songs);
 *
 *   // Get songs at 94 BPM in key 2
 *   const matches = library.filter({ tempo: 94, key: 2 });
 *
 *   // Mark as played
 *   library.markPlayed(matches[0].id);
 *
 *   // Reset for new session
 *   library.reset();
 */
export class SongLibrary {
  private readonly allSongs: readonly Song[];
  private playedIds = new Set<number>();

  /**
   * Create a new song library.
   *
   * @param songs - Array of all songs
   * @throws Error if songs array is empty or invalid
   */
  constructor(songs: readonly Song[]) {
    if (!Array.isArray(songs) || songs.length === 0) {
      throw new Error('Songs array must be non-empty');
    }

    this.allSongs = songs;
    this.validateSongs();
  }

  /**
   * Get all songs (immutable).
   */
  getAllSongs(): readonly Song[] {
    return this.allSongs;
  }

  /**
   * Get total number of songs.
   */
  getTotalCount(): number {
    return this.allSongs.length;
  }

  /**
   * Get number of songs played.
   */
  getPlayedCount(): number {
    return this.playedIds.size;
  }

  /**
   * Get number of songs remaining (not played).
   */
  getRemainingCount(): number {
    return this.allSongs.length - this.playedIds.size;
  }

  /**
   * Check if a song has been played.
   */
  isPlayed(songId: number): boolean {
    return this.playedIds.has(songId);
  }

  /**
   * Mark a song as played.
   */
  markPlayed(songId: number): void {
    this.playedIds.add(songId);
  }

  /**
   * Mark multiple songs as played.
   */
  markManyPlayed(songIds: number[]): void {
    songIds.forEach((id) => this.playedIds.add(id));
  }

  /**
   * Reset played songs (start fresh).
   */
  reset(): void {
    this.playedIds.clear();
  }

  /**
   * Get a song by ID.
   *
   * @param id - Song ID
   * @returns Song or undefined if not found
   */
  getSongById(id: number): Song | undefined {
    return this.allSongs.find((s) => s.id === id);
  }

  /**
   * Filter songs by criteria.
   *
   * @param filter - Filter criteria
   * @returns Array of matching songs
   *
   * Example:
   *   // Get all songs at 94 BPM in key 2, excluding played songs
   *   const songs = library.filter({
   *     tempo: 94,
   *     key: 2,
   *     excludeIds: Array.from(playedIds)
   *   });
   */
  filter(filter: SongFilter): Song[] {
    let results = [...this.allSongs];

    // Filter by tempo
    if (filter.tempo !== undefined) {
      results = results.filter((s) => s.bpm === filter.tempo);
    }

    // Filter by key
    if (filter.key !== undefined) {
      results = results.filter((s) => s.key === filter.key);
    }

    // Filter by artist
    if (filter.artist !== undefined) {
      results = results.filter((s) => s.artist === filter.artist);
    }

    // Exclude specific IDs
    if (filter.excludeIds && filter.excludeIds.length > 0) {
      const excludeSet = new Set(filter.excludeIds);
      results = results.filter((s) => !excludeSet.has(s.id));
    }

    return results;
  }

  /**
   * Get songs, excluding already played ones.
   *
   * @param filter - Optional additional filter criteria
   * @returns Unplayed songs matching criteria
   */
  getUnplayed(filter?: Omit<SongFilter, 'excludeIds'>): Song[] {
    return this.filter({
      ...filter,
      excludeIds: Array.from(this.playedIds),
    });
  }

  /**
   * Get all songs by a specific artist.
   */
  getSongsByArtist(artist: string): Song[] {
    return this.filter({ artist });
  }

  /**
   * Get all songs at a specific tempo.
   */
  getSongsByTempo(tempo: Tempo): Song[] {
    return this.filter({ tempo });
  }

  /**
   * Get all songs in a specific key.
   */
  getSongsByKey(key: Key): Song[] {
    return this.filter({ key });
  }

  /**
   * Get all unique artists.
   */
  getUniqueArtists(): string[] {
    const artists = new Set(this.allSongs.map((s) => s.artist));
    return Array.from(artists).sort();
  }

  /**
   * Get library statistics.
   */
  getStats(): LibraryStats {
    const songsByTempo: Record<Tempo, number> = { 84: 0, 94: 0, 102: 0 };
    const songsByKey: Record<Key, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
      7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    };

    // Count songs by tempo and key
    for (const song of this.allSongs) {
      songsByTempo[song.bpm]++;
      songsByKey[song.key]++;
    }

    // Find most common tempo
    let mostCommonTempo: Tempo = 94;
    let maxTempoCount = 0;
    for (const [tempo, count] of Object.entries(songsByTempo)) {
      if (count > maxTempoCount) {
        maxTempoCount = count;
        mostCommonTempo = parseInt(tempo) as Tempo;
      }
    }

    // Find most common key
    let mostCommonKey: Key = 1;
    let maxKeyCount = 0;
    for (const [key, count] of Object.entries(songsByKey)) {
      if (count > maxKeyCount) {
        maxKeyCount = count;
        mostCommonKey = parseInt(key) as Key;
      }
    }

    return {
      totalSongs: this.allSongs.length,
      songsByTempo,
      songsByKey,
      uniqueArtists: this.getUniqueArtists().length,
      mostCommonKey,
      mostCommonTempo,
    };
  }

  /**
   * Search songs by title or artist (case-insensitive).
   *
   * @param query - Search query
   * @returns Matching songs
   */
  search(query: string): Song[] {
    const lowerQuery = query.toLowerCase();
    return this.allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.artist.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Validate all songs have required fields.
   */
  private validateSongs(): void {
    const seenIds = new Set<number>();

    for (const song of this.allSongs) {
      // Check ID
      if (typeof song.id !== 'number' || song.id < 1) {
        throw new Error(`Invalid song ID: ${song.id}`);
      }

      if (seenIds.has(song.id)) {
        throw new Error(`Duplicate song ID: ${song.id}`);
      }
      seenIds.add(song.id);

      // Check artist
      if (typeof song.artist !== 'string' || song.artist.length === 0) {
        throw new Error(`Song ${song.id} has invalid artist`);
      }

      // Check title
      if (typeof song.title !== 'string' || song.title.length === 0) {
        throw new Error(`Song ${song.id} has invalid title`);
      }

      // Check key (1-12)
      if (!Number.isInteger(song.key) || song.key < 1 || song.key > 12) {
        throw new Error(`Song ${song.id} has invalid key: ${song.key}`);
      }

      // Check BPM (84, 94, or 102)
      if (![84, 94, 102].includes(song.bpm)) {
        throw new Error(`Song ${song.id} has invalid BPM: ${song.bpm}`);
      }
    }
  }
}
