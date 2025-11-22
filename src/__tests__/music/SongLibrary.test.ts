/**
 * Tests for SongLibrary
 *
 * Tests the song library management system including filtering,
 * played-song tracking, statistics, and search functionality.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { SongLibrary } from '../../music/SongLibrary.js';
import type { Song } from '../../music/types.js';

/**
 * Create test songs for testing.
 */
function createTestSongs(): Song[] {
  return [
    { id: 1, artist: 'Artist A', title: 'Song One', key: 1, bpm: 84 },
    { id: 2, artist: 'Artist A', title: 'Song Two', key: 2, bpm: 94 },
    { id: 3, artist: 'Artist B', title: 'Song Three', key: 1, bpm: 102 },
    { id: 4, artist: 'Artist B', title: 'Song Four', key: 3, bpm: 84 },
    { id: 5, artist: 'Artist C', title: 'Song Five', key: 2, bpm: 94 },
    { id: 6, artist: 'Artist C', title: 'Song Six', key: 1, bpm: 84 },
    { id: 7, artist: 'Artist A', title: 'Song Seven', key: 4, bpm: 102 },
    { id: 8, artist: 'Artist B', title: 'Song Eight', key: 5, bpm: 94 },
  ];
}

describe('SongLibrary', () => {
  describe('initialization', () => {
    test('creates library with valid songs', () => {
      const songs = createTestSongs();
      const library = new SongLibrary(songs);

      expect(library.getTotalCount()).toBe(8);
      expect(library.getPlayedCount()).toBe(0);
      expect(library.getRemainingCount()).toBe(8);
    });

    test('throws on empty array', () => {
      expect(() => new SongLibrary([])).toThrow('Songs array must be non-empty');
    });

    test('throws on non-array', () => {
      expect(() => new SongLibrary(null as any)).toThrow('Songs array must be non-empty');
      expect(() => new SongLibrary(undefined as any)).toThrow('Songs array must be non-empty');
    });

    test('validates song IDs', () => {
      const invalidSongs = [
        { id: 0, artist: 'Test', title: 'Test', key: 1, bpm: 94 },
      ] as Song[];

      expect(() => new SongLibrary(invalidSongs)).toThrow('Invalid song ID: 0');
    });

    test('detects duplicate IDs', () => {
      const duplicateSongs = [
        { id: 1, artist: 'Artist A', title: 'Song One', key: 1, bpm: 84 },
        { id: 1, artist: 'Artist B', title: 'Song Two', key: 2, bpm: 94 },
      ];

      expect(() => new SongLibrary(duplicateSongs as Song[])).toThrow('Duplicate song ID: 1');
    });

    test('validates artist field', () => {
      const invalidSongs = [
        { id: 1, artist: '', title: 'Test', key: 1, bpm: 94 },
      ] as Song[];

      expect(() => new SongLibrary(invalidSongs)).toThrow('Song 1 has invalid artist');
    });

    test('validates title field', () => {
      const invalidSongs = [
        { id: 1, artist: 'Test', title: '', key: 1, bpm: 94 },
      ] as Song[];

      expect(() => new SongLibrary(invalidSongs)).toThrow('Song 1 has invalid title');
    });

    test('validates key range', () => {
      const invalidSongs = [
        { id: 1, artist: 'Test', title: 'Test', key: 0, bpm: 94 },
      ] as unknown as Song[];

      expect(() => new SongLibrary(invalidSongs)).toThrow('Song 1 has invalid key: 0');
    });

    test('validates BPM values', () => {
      const invalidSongs = [
        { id: 1, artist: 'Test', title: 'Test', key: 1, bpm: 120 },
      ] as unknown as Song[];

      expect(() => new SongLibrary(invalidSongs)).toThrow('Song 1 has invalid BPM: 120');
    });
  });

  describe('getAllSongs', () => {
    test('returns all songs', () => {
      const songs = createTestSongs();
      const library = new SongLibrary(songs);

      const allSongs = library.getAllSongs();

      expect(allSongs).toHaveLength(8);
      expect(allSongs).toEqual(songs);
    });

    test('returns same reference each time', () => {
      const songs = createTestSongs();
      const library = new SongLibrary(songs);

      const allSongs1 = library.getAllSongs();
      const allSongs2 = library.getAllSongs();

      // Same reference since songs are immutable
      expect(allSongs1).toBe(allSongs2);
    });
  });

  describe('getSongById', () => {
    test('returns song when found', () => {
      const songs = createTestSongs();
      const library = new SongLibrary(songs);

      const song = library.getSongById(3);

      expect(song).toBeDefined();
      expect(song?.id).toBe(3);
      expect(song?.artist).toBe('Artist B');
      expect(song?.title).toBe('Song Three');
    });

    test('returns undefined when not found', () => {
      const songs = createTestSongs();
      const library = new SongLibrary(songs);

      const song = library.getSongById(999);

      expect(song).toBeUndefined();
    });
  });

  describe('filter', () => {
    let library: SongLibrary;

    beforeEach(() => {
      library = new SongLibrary(createTestSongs());
    });

    test('filters by tempo', () => {
      const results = library.filter({ tempo: 84 });

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.bpm === 84)).toBe(true);
    });

    test('filters by key', () => {
      const results = library.filter({ key: 1 });

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.key === 1)).toBe(true);
    });

    test('filters by artist', () => {
      const results = library.filter({ artist: 'Artist A' });

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.artist === 'Artist A')).toBe(true);
    });

    test('filters by multiple criteria', () => {
      const results = library.filter({ tempo: 84, key: 1 });

      expect(results).toHaveLength(2); // Songs 1 and 6
      expect(results.every((s) => s.bpm === 84 && s.key === 1)).toBe(true);
    });

    test('excludes specific IDs', () => {
      const results = library.filter({ excludeIds: [1, 2, 3] });

      expect(results).toHaveLength(5);
      expect(results.every((s) => ![1, 2, 3].includes(s.id))).toBe(true);
    });

    test('combines all filter options', () => {
      const results = library.filter({
        tempo: 94,
        key: 2,
        artist: 'Artist A',
        excludeIds: [2],
      });

      expect(results).toHaveLength(0); // Song 2 matches but is excluded
    });

    test('returns empty array when no matches', () => {
      const results = library.filter({ tempo: 84, key: 5 });

      expect(results).toHaveLength(0);
    });

    test('returns all songs when no filters', () => {
      const results = library.filter({});

      expect(results).toHaveLength(8);
    });

    test('handles empty excludeIds array', () => {
      const results = library.filter({ excludeIds: [] });

      expect(results).toHaveLength(8);
    });
  });

  describe('played song tracking', () => {
    let library: SongLibrary;

    beforeEach(() => {
      library = new SongLibrary(createTestSongs());
    });

    test('tracks played songs', () => {
      expect(library.isPlayed(1)).toBe(false);

      library.markPlayed(1);

      expect(library.isPlayed(1)).toBe(true);
      expect(library.getPlayedCount()).toBe(1);
      expect(library.getRemainingCount()).toBe(7);
    });

    test('marks multiple songs as played', () => {
      library.markManyPlayed([1, 2, 3]);

      expect(library.getPlayedCount()).toBe(3);
      expect(library.isPlayed(1)).toBe(true);
      expect(library.isPlayed(2)).toBe(true);
      expect(library.isPlayed(3)).toBe(true);
      expect(library.isPlayed(4)).toBe(false);
    });

    test('handles duplicate markPlayed calls', () => {
      library.markPlayed(1);
      library.markPlayed(1);
      library.markPlayed(1);

      expect(library.getPlayedCount()).toBe(1);
    });

    test('resets played songs', () => {
      library.markManyPlayed([1, 2, 3]);
      expect(library.getPlayedCount()).toBe(3);

      library.reset();

      expect(library.getPlayedCount()).toBe(0);
      expect(library.getRemainingCount()).toBe(8);
      expect(library.isPlayed(1)).toBe(false);
    });
  });

  describe('getUnplayed', () => {
    let library: SongLibrary;

    beforeEach(() => {
      library = new SongLibrary(createTestSongs());
    });

    test('returns all songs when none played', () => {
      const results = library.getUnplayed();

      expect(results).toHaveLength(8);
    });

    test('excludes played songs', () => {
      library.markManyPlayed([1, 2, 3]);

      const results = library.getUnplayed();

      expect(results).toHaveLength(5);
      expect(results.every((s) => ![1, 2, 3].includes(s.id))).toBe(true);
    });

    test('combines with tempo filter', () => {
      library.markPlayed(1); // BPM 84, Key 1

      const results = library.getUnplayed({ tempo: 84 });

      expect(results).toHaveLength(2); // Songs 4 and 6 (song 1 is played)
      expect(results.every((s) => s.bpm === 84)).toBe(true);
      expect(results.every((s) => s.id !== 1)).toBe(true);
    });

    test('combines with key filter', () => {
      library.markPlayed(1); // Key 1

      const results = library.getUnplayed({ key: 1 });

      expect(results).toHaveLength(2); // Songs 3 and 6 (song 1 is played)
      expect(results.every((s) => s.key === 1)).toBe(true);
    });

    test('combines with artist filter', () => {
      library.markPlayed(2); // Artist A

      const results = library.getUnplayed({ artist: 'Artist A' });

      expect(results).toHaveLength(2); // Songs 1 and 7 (song 2 is played)
      expect(results.every((s) => s.artist === 'Artist A')).toBe(true);
    });

    test('returns empty when all matching songs played', () => {
      library.markManyPlayed([1, 3, 6]); // All key 1 songs

      const results = library.getUnplayed({ key: 1 });

      expect(results).toHaveLength(0);
    });
  });

  describe('helper methods', () => {
    let library: SongLibrary;

    beforeEach(() => {
      library = new SongLibrary(createTestSongs());
    });

    test('getSongsByArtist', () => {
      const results = library.getSongsByArtist('Artist B');

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.artist === 'Artist B')).toBe(true);
    });

    test('getSongsByTempo', () => {
      const results = library.getSongsByTempo(94);

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.bpm === 94)).toBe(true);
    });

    test('getSongsByKey', () => {
      const results = library.getSongsByKey(1);

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.key === 1)).toBe(true);
    });
  });

  describe('getUniqueArtists', () => {
    test('returns sorted unique artists', () => {
      const library = new SongLibrary(createTestSongs());

      const artists = library.getUniqueArtists();

      expect(artists).toEqual(['Artist A', 'Artist B', 'Artist C']);
    });

    test('handles single artist', () => {
      const songs: Song[] = [
        { id: 1, artist: 'Solo Artist', title: 'Song One', key: 1, bpm: 84 },
        { id: 2, artist: 'Solo Artist', title: 'Song Two', key: 2, bpm: 94 },
      ];
      const library = new SongLibrary(songs);

      const artists = library.getUniqueArtists();

      expect(artists).toEqual(['Solo Artist']);
    });
  });

  describe('search', () => {
    let library: SongLibrary;

    beforeEach(() => {
      library = new SongLibrary(createTestSongs());
    });

    test('searches by title (case-insensitive)', () => {
      const results = library.search('three');

      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('Song Three');
    });

    test('searches by artist (case-insensitive)', () => {
      const results = library.search('artist b');

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.artist === 'Artist B')).toBe(true);
    });

    test('matches partial strings', () => {
      const results = library.search('song');

      expect(results).toHaveLength(8); // All songs have "Song" in title
    });

    test('returns empty for no matches', () => {
      const results = library.search('nonexistent');

      expect(results).toHaveLength(0);
    });

    test('handles empty query', () => {
      const results = library.search('');

      expect(results).toHaveLength(8); // Empty string matches all
    });
  });

  describe('getStats', () => {
    test('calculates statistics correctly', () => {
      const library = new SongLibrary(createTestSongs());

      const stats = library.getStats();

      expect(stats.totalSongs).toBe(8);

      // Check tempo distribution
      expect(stats.songsByTempo[84]).toBe(3);
      expect(stats.songsByTempo[94]).toBe(3);
      expect(stats.songsByTempo[102]).toBe(2);

      // Check key distribution
      expect(stats.songsByKey[1]).toBe(3);
      expect(stats.songsByKey[2]).toBe(2);
      expect(stats.songsByKey[3]).toBe(1);
      expect(stats.songsByKey[4]).toBe(1);
      expect(stats.songsByKey[5]).toBe(1);

      // Check unique artists
      expect(stats.uniqueArtists).toBe(3);

      // Check most common (84 and 94 tied at 3, key 1 most common at 3)
      expect([84, 94]).toContain(stats.mostCommonTempo);
      expect(stats.mostCommonKey).toBe(1);
    });

    test('handles single song library', () => {
      const songs: Song[] = [{ id: 1, artist: 'Artist', title: 'Song', key: 5, bpm: 102 }];
      const library = new SongLibrary(songs);

      const stats = library.getStats();

      expect(stats.totalSongs).toBe(1);
      expect(stats.mostCommonTempo).toBe(102);
      expect(stats.mostCommonKey).toBe(5);
      expect(stats.uniqueArtists).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('handles large library', () => {
      const largeSongs: Song[] = [];
      for (let i = 1; i <= 1000; i++) {
        largeSongs.push({
          id: i,
          artist: `Artist ${i % 10}`,
          title: `Song ${i}`,
          key: ((i % 12) + 1) as any,
          bpm: [84, 94, 102][i % 3] as any,
        });
      }

      const library = new SongLibrary(largeSongs);

      expect(library.getTotalCount()).toBe(1000);

      // Filter should still be fast
      const results = library.filter({ tempo: 94, key: 5 });
      expect(results.length).toBeGreaterThan(0);
    });

    test('handles all keys (1-12)', () => {
      const allKeySongs: Song[] = [];
      for (let key = 1; key <= 12; key++) {
        allKeySongs.push({
          id: key,
          artist: 'Artist',
          title: `Song in Key ${key}`,
          key: key as any,
          bpm: 94,
        });
      }

      const library = new SongLibrary(allKeySongs);

      for (let key = 1; key <= 12; key++) {
        const results = library.filter({ key: key as any });
        expect(results).toHaveLength(1);
      }
    });

    test('handles all tempos', () => {
      const songs: Song[] = [
        { id: 1, artist: 'A', title: 'Slow', key: 1, bpm: 84 },
        { id: 2, artist: 'A', title: 'Medium', key: 1, bpm: 94 },
        { id: 3, artist: 'A', title: 'Fast', key: 1, bpm: 102 },
      ];

      const library = new SongLibrary(songs);

      expect(library.filter({ tempo: 84 })).toHaveLength(1);
      expect(library.filter({ tempo: 94 })).toHaveLength(1);
      expect(library.filter({ tempo: 102 })).toHaveLength(1);
    });

    test('played tracking with all songs', () => {
      const library = new SongLibrary(createTestSongs());

      const allIds = library.getAllSongs().map((s) => s.id);
      library.markManyPlayed(allIds);

      expect(library.getPlayedCount()).toBe(8);
      expect(library.getRemainingCount()).toBe(0);
      expect(library.getUnplayed()).toHaveLength(0);
    });
  });

  describe('immutability', () => {
    test('filter returns new array', () => {
      const library = new SongLibrary(createTestSongs());

      const results1 = library.filter({ tempo: 84 });
      const results2 = library.filter({ tempo: 84 });

      expect(results1).not.toBe(results2); // Different array instances
      expect(results1).toEqual(results2); // Same content
    });

    test('getUnplayed returns new array', () => {
      const library = new SongLibrary(createTestSongs());

      const results1 = library.getUnplayed();
      const results2 = library.getUnplayed();

      expect(results1).not.toBe(results2);
      expect(results1).toEqual(results2);
    });

    test('search returns new array', () => {
      const library = new SongLibrary(createTestSongs());

      const results1 = library.search('song');
      const results2 = library.search('song');

      expect(results1).not.toBe(results2);
      expect(results1).toEqual(results2);
    });
  });
});
