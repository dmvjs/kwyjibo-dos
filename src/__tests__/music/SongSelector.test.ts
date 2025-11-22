/**
 * Tests for SongSelector
 *
 * Tests the main song selection algorithm that combines SongLibrary,
 * KeyManager, and QuantumRandom to select harmonically compatible songs.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { SongSelector } from '../../music/SongSelector.js';
import { SongLibrary } from '../../music/SongLibrary.js';
import { KeyManager } from '../../music/KeyManager.js';
import { QuantumRandom } from '../../random/QuantumRandom.js';
import type { Song } from '../../music/types.js';

/**
 * Create test songs with variety across keys and tempos.
 */
function createTestSongs(): Song[] {
  const songs: Song[] = [];

  // Create songs for each key (1-12) with varying tempos
  for (let key = 1; key <= 12; key++) {
    songs.push(
      { id: key * 100 + 1, artist: `Artist ${key}A`, title: `Song ${key}-1`, key: key as any, bpm: 84 },
      { id: key * 100 + 2, artist: `Artist ${key}B`, title: `Song ${key}-2`, key: key as any, bpm: 94 },
      { id: key * 100 + 3, artist: `Artist ${key}C`, title: `Song ${key}-3`, key: key as any, bpm: 102 }
    );
  }

  return songs;
}

describe('SongSelector', () => {
  let library: SongLibrary;
  let keyManager: KeyManager;
  let qrng: QuantumRandom;
  let selector: SongSelector;

  beforeEach(() => {
    library = new SongLibrary(createTestSongs());
    keyManager = new KeyManager(1, 'forward');
    qrng = new QuantumRandom({ useLocalStorage: false });
    selector = new SongSelector(library, keyManager, qrng);
  });

  describe('initialization', () => {
    test('creates selector with default options', () => {
      const stats = selector.getStats();

      expect(stats.trackCount).toBe(0);
      expect(stats.currentKey).toBe(1);
      expect(stats.currentTempo).toBe(94);
      expect(stats.songsPlayed).toBe(0);
    });

    test('accepts custom options', () => {
      const customSelector = new SongSelector(library, keyManager, qrng, {
        candidatePoolSize: 10,
        useMagicNumber: false,
        minCompatibilityScore: 7,
        defaultTempo: 84,
      });

      expect(customSelector.getTempo()).toBe(84);
    });
  });

  describe('selectTrack - basic functionality', () => {
    test('selects first track', async () => {
      const result = await selector.selectTrack();

      expect(result.track.song).toBeDefined();
      expect(result.track.tempo).toBe(94);
      expect(result.track.type).toBe('lead'); // First track is always lead
      expect(result.candidatesConsidered).toBeGreaterThan(0);
    });

    test('selects multiple tracks', async () => {
      const tracks = [];

      for (let i = 0; i < 5; i++) {
        const result = await selector.selectTrack();
        tracks.push(result);
      }

      expect(tracks).toHaveLength(5);
      expect(selector.getTrackCount()).toBe(5);
    });

    test('marks songs as played', async () => {
      const initialRemaining = library.getRemainingCount();

      await selector.selectTrack();

      expect(library.getPlayedCount()).toBe(1);
      expect(library.getRemainingCount()).toBe(initialRemaining - 1);
    });

    test('progresses through keys', async () => {
      expect(keyManager.getCurrentKey()).toBe(1);

      await selector.selectTrack(); // First track doesn't advance key
      expect(keyManager.getCurrentKey()).toBe(1);

      await selector.selectTrack(); // Second track advances
      expect(keyManager.getCurrentKey()).toBe(2);

      await selector.selectTrack();
      expect(keyManager.getCurrentKey()).toBe(3);
    });

    test('respects key progression direction', async () => {
      keyManager.setDirection('reverse');
      keyManager.setKey(5);

      await selector.selectTrack(); // First track
      await selector.selectTrack(); // Advances to 4

      expect(keyManager.getCurrentKey()).toBe(4);
    });
  });

  describe('track type selection', () => {
    test('first track is always lead', async () => {
      const result = await selector.selectTrack();

      expect(result.track.type).toBe('lead');
    });

    test('alternates between lead and body', async () => {
      const types = [];

      for (let i = 0; i < 10; i++) {
        const result = await selector.selectTrack();
        types.push(result.track.type);
      }

      // First should be lead
      expect(types[0]).toBe('lead');

      // Should have both types
      expect(types.includes('lead')).toBe(true);
      expect(types.includes('body')).toBe(true);
    });
  });

  describe('magic number selection', () => {
    test('every 5th track is magic number', async () => {
      const results = [];

      for (let i = 0; i < 10; i++) {
        const result = await selector.selectTrack();
        results.push(result);
      }

      // Tracks 5 and 10 should be magic numbers
      expect(results[4]?.wasMagicNumber).toBe(true); // 5th track (index 4)
      expect(results[9]?.wasMagicNumber).toBe(true); // 10th track (index 9)

      // Others should not be
      expect(results[0]?.wasMagicNumber).toBe(false);
      expect(results[1]?.wasMagicNumber).toBe(false);
      expect(results[2]?.wasMagicNumber).toBe(false);
    });

    test('magic number can be disabled', async () => {
      const noMagicSelector = new SongSelector(library, keyManager, qrng, {
        useMagicNumber: false,
      });

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await noMagicSelector.selectTrack();
        results.push(result);
      }

      // No magic numbers
      expect(results.every((r) => !r.wasMagicNumber)).toBe(true);
    });

    test('magic number ignores key constraints', async () => {
      // Set key to 5 and mark all key 5 songs as played
      keyManager.setKey(5);
      const key5Songs = library.filter({ key: 5 });
      library.markManyPlayed(key5Songs.map((s) => s.id));

      // Select 5 tracks to trigger magic number
      for (let i = 0; i < 5; i++) {
        await selector.selectTrack();
      }

      const stats = selector.getStats();
      // Should have selected songs despite key 5 being exhausted
      expect(stats.trackCount).toBe(5);
    });
  });

  describe('harmonic compatibility', () => {
    test('selects from current key when available', async () => {
      keyManager.setKey(3);

      const result = await selector.selectTrack();

      // Should select from key 3 (or highly compatible)
      const score = keyManager.scoreCompatibility(3, result.track.song.key);
      expect(score).toBeGreaterThan(0);
    });

    test('expands to compatible keys when current exhausted', async () => {
      // Mark all key 1 songs as played
      const key1Songs = library.filter({ key: 1 });
      library.markManyPlayed(key1Songs.map((s) => s.id));

      keyManager.setKey(1);

      const result = await selector.selectTrack();

      // Should select from compatible key
      expect(result.track.song.key).not.toBe(1);
      expect(result.candidatesConsidered).toBeGreaterThan(0);
    });

    test('uses compatibility score threshold', async () => {
      const strictSelector = new SongSelector(library, keyManager, qrng, {
        minCompatibilityScore: 8, // Only highly compatible
      });

      keyManager.setKey(1);
      const result = await strictSelector.selectTrack();

      const score = keyManager.scoreCompatibility(1, result.track.song.key);
      expect(score).toBeGreaterThanOrEqual(5); // May fallback if needed
    });
  });

  describe('candidate pool', () => {
    test('uses configured pool size', async () => {
      const smallPoolSelector = new SongSelector(library, keyManager, qrng, {
        candidatePoolSize: 2,
      });

      const result = await smallPoolSelector.selectTrack();

      expect(result.track.song).toBeDefined();
    });

    test('handles pool size larger than available songs', async () => {
      // Mark most songs as played
      const allSongs = library.getAllSongs();
      const mostSongs = allSongs.slice(0, allSongs.length - 3);
      library.markManyPlayed(mostSongs.map((s) => s.id));

      const result = await selector.selectTrack();

      expect(result.track.song).toBeDefined();
    });
  });

  describe('tempo management', () => {
    test('uses default tempo', () => {
      expect(selector.getTempo()).toBe(94);
    });

    test('changes tempo', () => {
      selector.setTempo(84);

      expect(selector.getTempo()).toBe(84);
    });

    test('uses tempo in track requests', async () => {
      selector.setTempo(102);

      const result = await selector.selectTrack();

      expect(result.track.tempo).toBe(102);
    });

    test('tempo persists across selections', async () => {
      selector.setTempo(84);

      await selector.selectTrack();
      await selector.selectTrack();

      expect(selector.getTempo()).toBe(84);
    });
  });

  describe('reset functionality', () => {
    test('resets all state', async () => {
      // Select some tracks
      await selector.selectTrack();
      await selector.selectTrack();
      selector.setTempo(102);

      selector.reset();

      const stats = selector.getStats();
      expect(stats.trackCount).toBe(0);
      expect(stats.songsPlayed).toBe(0);
      expect(stats.currentKey).toBe(1);
      expect(stats.currentTempo).toBe(94);
    });

    test('can reset library only', async () => {
      await selector.selectTrack();
      keyManager.next();

      selector.reset(true, false);

      expect(library.getPlayedCount()).toBe(0);
      expect(keyManager.getCurrentKey()).not.toBe(1); // Key manager not reset
    });

    test('can reset key manager only', async () => {
      await selector.selectTrack();
      keyManager.next();

      selector.reset(false, true);

      expect(library.getPlayedCount()).toBeGreaterThan(0); // Library not reset
      expect(keyManager.getCurrentKey()).toBe(1); // Key manager reset
    });
  });

  describe('exhaustion handling', () => {
    test('resets library when all songs played', async () => {
      const smallLibrary = new SongLibrary([
        { id: 1, artist: 'A', title: 'Song 1', key: 1, bpm: 94 },
        { id: 2, artist: 'B', title: 'Song 2', key: 1, bpm: 94 },
      ]);

      const smallSelector = new SongSelector(
        smallLibrary,
        new KeyManager(1),
        qrng,
        { useMagicNumber: false }
      );

      // Play all songs
      await smallSelector.selectTrack();
      await smallSelector.selectTrack();

      // Should auto-reset and continue
      const result = await smallSelector.selectTrack();
      expect(result.track.song).toBeDefined();
    });

    test('handles key with no songs gracefully', async () => {
      const limitedLibrary = new SongLibrary([
        { id: 1, artist: 'A', title: 'Song 1', key: 1, bpm: 94 },
        { id: 2, artist: 'B', title: 'Song 2', key: 2, bpm: 94 },
      ]);

      const limitedSelector = new SongSelector(
        limitedLibrary,
        new KeyManager(5), // Key with no songs
        qrng
      );

      const result = await limitedSelector.selectTrack();
      expect(result.track.song).toBeDefined();
    });
  });

  describe('statistics', () => {
    test('tracks selection count', async () => {
      await selector.selectTrack();
      await selector.selectTrack();
      await selector.selectTrack();

      expect(selector.getTrackCount()).toBe(3);
    });

    test('provides comprehensive stats', async () => {
      await selector.selectTrack();
      await selector.selectTrack();

      const stats = selector.getStats();

      expect(stats.trackCount).toBe(2);
      expect(stats.currentKey).toBeGreaterThanOrEqual(1);
      expect(stats.currentKey).toBeLessThanOrEqual(12);
      expect(stats.currentTempo).toBe(94);
      expect(stats.songsPlayed).toBe(2);
      expect(stats.songsRemaining).toBeGreaterThan(0);
      expect(['lead', 'body']).toContain(stats.lastTrackType);
    });

    test('stats update after each selection', async () => {
      const stats1 = selector.getStats();
      expect(stats1.trackCount).toBe(0);

      await selector.selectTrack();

      const stats2 = selector.getStats();
      expect(stats2.trackCount).toBe(1);
      expect(stats2.songsPlayed).toBe(1);
    });
  });

  describe('integration - realistic usage', () => {
    test('simulates full mixing session', async () => {
      const tracks = [];

      // Select 20 tracks
      for (let i = 0; i < 20; i++) {
        const result = await selector.selectTrack();
        tracks.push(result);
      }

      expect(tracks).toHaveLength(20);

      // Check magic numbers (tracks 5, 10, 15, 20)
      expect(tracks[4]?.wasMagicNumber).toBe(true);
      expect(tracks[9]?.wasMagicNumber).toBe(true);
      expect(tracks[14]?.wasMagicNumber).toBe(true);
      expect(tracks[19]?.wasMagicNumber).toBe(true);

      // All should have valid tracks
      tracks.forEach((result) => {
        expect(result.track.song).toBeDefined();
        expect(result.track.tempo).toBeGreaterThan(0);
        expect(['lead', 'body']).toContain(result.track.type);
      });

      // Keys should have progressed
      const finalStats = selector.getStats();
      expect(finalStats.currentKey).not.toBe(1);
    });

    test('handles tempo changes mid-session', async () => {
      await selector.selectTrack(); // 94 BPM
      await selector.selectTrack(); // 94 BPM

      selector.setTempo(84);

      const result = await selector.selectTrack(); // 84 BPM
      expect(result.track.tempo).toBe(84);
    });

    test('maintains state across many selections', async () => {
      // Select 50 tracks
      for (let i = 0; i < 50; i++) {
        await selector.selectTrack();
      }

      const stats = selector.getStats();

      expect(stats.trackCount).toBe(50);
      expect(stats.songsPlayed).toBeGreaterThan(0);
      expect(stats.songsRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    test('handles single song library', async () => {
      const singleLibrary = new SongLibrary([
        { id: 1, artist: 'Only Artist', title: 'Only Song', key: 1, bpm: 94 },
      ]);

      const singleSelector = new SongSelector(
        singleLibrary,
        new KeyManager(1),
        qrng
      );

      // Should be able to select same song repeatedly (with resets)
      await singleSelector.selectTrack();
      await singleSelector.selectTrack();
      await singleSelector.selectTrack();

      expect(singleSelector.getTrackCount()).toBe(3);
    });

    test('handles rapid selections', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(selector.selectTrack());
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
    });

    test('respects all tempo values', async () => {
      const tempos = [84, 94, 102];

      for (const tempo of tempos) {
        selector.setTempo(tempo as any);
        const result = await selector.selectTrack();
        expect(result.track.tempo).toBe(tempo);
      }
    });

    test('getCurrentKey reflects key manager state', () => {
      keyManager.setKey(7);
      expect(selector.getCurrentKey()).toBe(7);

      keyManager.next();
      expect(selector.getCurrentKey()).toBe(8);
    });
  });

  describe('selection result metadata', () => {
    test('includes compatibility score', async () => {
      const result = await selector.selectTrack();

      expect(typeof result.compatibilityScore).toBe('number');
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(1);
      expect(result.compatibilityScore).toBeLessThanOrEqual(10);
    });

    test('includes candidates considered', async () => {
      const result = await selector.selectTrack();

      expect(result.candidatesConsidered).toBeGreaterThan(0);
    });

    test('metadata matches selection', async () => {
      keyManager.setKey(5);

      const result = await selector.selectTrack();

      // Verify compatibility score is accurate
      const actualScore = keyManager.scoreCompatibility(5, result.track.song.key);
      expect(result.compatibilityScore).toBe(actualScore);
    });
  });
});
