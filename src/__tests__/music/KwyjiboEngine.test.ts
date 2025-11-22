/**
 * Tests for KwyjiboEngine
 *
 * Tests the main public API that orchestrates all kwyjibo components.
 * This is an integration test suite that verifies the complete system.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { KwyjiboEngine } from '../../music/KwyjiboEngine.js';
import type { Song, TrackRequest } from '../../music/types.js';
import type { IAudioBufferLoader, LoadRequest, LoadResult } from '../../audio/types.js';

/**
 * Mock audio buffer loader for testing.
 */
class MockAudioLoader implements IAudioBufferLoader {
  loadSingle = jest.fn<(request: LoadRequest) => Promise<LoadResult>>();
  load = jest.fn<(requests: LoadRequest[]) => Promise<LoadResult[]>>();
  cancel = jest.fn<() => void>();
  on = jest.fn<() => () => void>();

  constructor() {
    // Default implementation: return mock results
    this.load.mockImplementation(async (requests: LoadRequest[]) => {
      return requests.map((req) => ({
        id: req.id,
        url: req.url,
        buffer: {} as AudioBuffer, // Mock buffer
        loadTimeMs: 100,
        metadata: req.metadata,
      }));
    });
  }
}

/**
 * Create test songs.
 */
function createTestSongs(): Song[] {
  const songs: Song[] = [];

  for (let key = 1; key <= 12; key++) {
    songs.push(
      { id: key * 100 + 1, artist: `Artist ${key}`, title: `Song ${key}-1`, key: key as any, bpm: 84 },
      { id: key * 100 + 2, artist: `Artist ${key}`, title: `Song ${key}-2`, key: key as any, bpm: 94 },
      { id: key * 100 + 3, artist: `Artist ${key}`, title: `Song ${key}-3`, key: key as any, bpm: 102 }
    );
  }

  return songs;
}

describe('KwyjiboEngine', () => {
  let engine: KwyjiboEngine;
  let audioLoader: MockAudioLoader;

  beforeEach(() => {
    audioLoader = new MockAudioLoader();
    engine = new KwyjiboEngine({
      songs: createTestSongs(),
      audioLoader,
    });
  });

  describe('initialization', () => {
    test('creates engine with valid options', () => {
      expect(engine.getState()).toBe('idle');

      const stats = engine.getStatistics();
      expect(stats.tracksPlayed).toBe(0);
      expect(stats.currentKey).toBe(1);
      expect(stats.currentTempo).toBe(94);
    });

    test('throws on empty songs array', () => {
      expect(() => new KwyjiboEngine({ songs: [], audioLoader })).toThrow(
        'songs array must be non-empty'
      );
    });

    test('throws on missing audio loader', () => {
      expect(() => new KwyjiboEngine({ songs: createTestSongs(), audioLoader: null as any })).toThrow(
        'audioLoader is required'
      );
    });

    test('accepts custom start key', () => {
      const customEngine = new KwyjiboEngine({
        songs: createTestSongs(),
        audioLoader,
        startKey: 5,
      });

      const stats = customEngine.getStatistics();
      expect(stats.currentKey).toBe(5);
    });

    test('accepts custom tempo', () => {
      const customEngine = new KwyjiboEngine({
        songs: createTestSongs(),
        audioLoader,
        tempo: 102,
      });

      const stats = customEngine.getStatistics();
      expect(stats.currentTempo).toBe(102);
    });

    test('accepts custom direction', () => {
      const customEngine = new KwyjiboEngine({
        songs: createTestSongs(),
        audioLoader,
        direction: 'reverse',
      });

      const stats = customEngine.getStatistics();
      expect(stats.direction).toBe('reverse');
    });
  });

  describe('start', () => {
    test('starts engine and selects first track', async () => {
      expect(engine.getState()).toBe('idle');

      const result = await engine.start();

      expect(engine.getState()).toBe('running');
      expect(result.track.song).toBeDefined();
      expect(result.track.type).toBe('lead'); // First track is always lead
    });

    test('throws if already running', async () => {
      await engine.start();

      await expect(engine.start()).rejects.toThrow('Cannot start from state: running');
    });

    test('can start after stop', async () => {
      await engine.start();
      engine.stop();

      await engine.start();

      expect(engine.getState()).toBe('running');
    });

    test('emits stateChange event', async () => {
      const handler = jest.fn();
      engine.on('stateChange', handler);

      await engine.start();

      expect(handler).toHaveBeenCalledWith({
        state: 'running',
        previousState: 'idle',
      });
    });

    test('emits trackSelected event', async () => {
      const handler = jest.fn();
      engine.on('trackSelected', handler);

      await engine.start();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0]).toHaveProperty('track');
      expect(handler.mock.calls[0]?.[0]).toHaveProperty('wasMagicNumber');
    });
  });

  describe('next', () => {
    test('selects next track', async () => {
      await engine.start();

      const next = await engine.next();

      expect(next.track.song).toBeDefined();
      expect(engine.getStatistics().tracksPlayed).toBe(2);
    });

    test('throws if not running', async () => {
      await expect(engine.next()).rejects.toThrow('Cannot select next track in state: idle');
    });

    test('progresses through tracks', async () => {
      await engine.start();

      const tracks = [];
      for (let i = 0; i < 5; i++) {
        const track = await engine.next();
        tracks.push(track);
      }

      expect(tracks).toHaveLength(5);
      expect(engine.getStatistics().tracksPlayed).toBe(6); // start + 5 more
    });

    test('emits trackSelected for each track', async () => {
      const handler = jest.fn();
      engine.on('trackSelected', handler);

      await engine.start();
      await engine.next();
      await engine.next();

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('loadTrack', () => {
    test('loads audio for track', async () => {
      const result = await engine.start();
      const buffer = await engine.loadTrack(result.track);

      expect(buffer).toBeDefined();
      expect(buffer.url).toContain(result.track.song.id.toString());
      expect(buffer.url).toContain(result.track.type);
    });

    test('builds correct URL format', async () => {
      const result = await engine.start();
      await engine.loadTrack(result.track);

      expect(audioLoader.load).toHaveBeenCalled();
      const request = audioLoader.load.mock.calls[0]?.[0]?.[0];

      // Format: /music/{tempo}/{id}-{type}.mp3
      expect(request?.url).toMatch(/^\/music\/\d+\/\d{8}-(lead|body)\.mp3$/);
    });

    test('includes metadata', async () => {
      const result = await engine.start();
      await engine.loadTrack(result.track);

      const request = audioLoader.load.mock.calls[0]?.[0]?.[0];

      expect(request?.metadata).toHaveProperty('song');
      expect(request?.metadata).toHaveProperty('type');
    });
  });

  describe('pause and resume', () => {
    test('pauses running engine', async () => {
      await engine.start();

      engine.pause();

      expect(engine.getState()).toBe('paused');
    });

    test('throws on pause if not running', () => {
      expect(() => engine.pause()).toThrow('Cannot pause from state: idle');
    });

    test('resumes paused engine', async () => {
      await engine.start();
      engine.pause();

      engine.resume();

      expect(engine.getState()).toBe('running');
    });

    test('throws on resume if not paused', () => {
      expect(() => engine.resume()).toThrow('Cannot resume from state: idle');
    });

    test('emits stateChange events', async () => {
      const handler = jest.fn();
      engine.on('stateChange', handler);

      await engine.start();
      handler.mockClear();

      engine.pause();
      expect(handler).toHaveBeenCalledWith({ state: 'paused', previousState: 'running' });

      engine.resume();
      expect(handler).toHaveBeenCalledWith({ state: 'running', previousState: 'paused' });
    });
  });

  describe('stop', () => {
    test('stops running engine', async () => {
      await engine.start();

      engine.stop();

      expect(engine.getState()).toBe('stopped');
    });

    test('can stop from any state', async () => {
      await engine.start();
      engine.pause();
      engine.stop();

      expect(engine.getState()).toBe('stopped');
    });

    test('clears current track', async () => {
      await engine.start();

      engine.stop();

      expect(engine.getCurrentTrack()).toBeNull();
    });

    test('emits stateChange event', async () => {
      const handler = jest.fn();
      await engine.start();

      engine.on('stateChange', handler);
      engine.stop();

      expect(handler).toHaveBeenCalledWith({ state: 'stopped', previousState: 'running' });
    });
  });

  describe('reset', () => {
    test('resets engine state', async () => {
      await engine.start();
      await engine.next();
      await engine.next();

      engine.reset();

      expect(engine.getState()).toBe('idle');
      expect(engine.getStatistics().tracksPlayed).toBe(0);
      expect(engine.getStatistics().songsPlayed).toBe(0);
    });

    test('resets to starting key', async () => {
      const customEngine = new KwyjiboEngine({
        songs: createTestSongs(),
        audioLoader,
        startKey: 5,
      });

      await customEngine.start();
      await customEngine.next();

      customEngine.reset();

      expect(customEngine.getStatistics().currentKey).toBe(1); // Default reset to 1
    });

    test('can reset library only', async () => {
      await engine.start();
      await engine.next();

      const keyBefore = engine.getStatistics().currentKey;

      engine.reset(true, false);

      expect(engine.getStatistics().songsPlayed).toBe(0); // Library reset
      expect(engine.getStatistics().currentKey).toBe(keyBefore); // Key manager NOT reset
    });

    test('can reset key manager only', async () => {
      await engine.start();
      await engine.next();

      engine.reset(false, true);

      expect(engine.getStatistics().songsPlayed).toBeGreaterThan(0); // Library NOT reset
      expect(engine.getStatistics().currentKey).toBe(1); // Key manager reset
    });
  });

  describe('tempo management', () => {
    test('changes tempo', () => {
      engine.setTempo(84);

      expect(engine.getStatistics().currentTempo).toBe(84);
    });

    test('affects track selection', async () => {
      engine.setTempo(102);

      const result = await engine.start();

      expect(result.track.tempo).toBe(102);
    });

    test('emits tempoChange event', () => {
      const handler = jest.fn();
      engine.on('tempoChange', handler);

      engine.setTempo(102);

      expect(handler).toHaveBeenCalledWith({ tempo: 102, previousTempo: 94 });
    });

    test('does not emit if tempo unchanged', () => {
      const handler = jest.fn();
      engine.on('tempoChange', handler);

      engine.setTempo(94); // Same as default

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('key and direction management', () => {
    test('sets key', () => {
      engine.setKey(7);

      expect(engine.getStatistics().currentKey).toBe(7);
    });

    test('emits keyChange event', () => {
      const handler = jest.fn();
      engine.on('keyChange', handler);

      engine.setKey(8);

      expect(handler).toHaveBeenCalledWith({
        key: 8,
        previousKey: 1,
        direction: 'forward',
      });
    });

    test('sets direction', () => {
      engine.setDirection('reverse');

      expect(engine.getStatistics().direction).toBe('reverse');
    });

    test('toggles direction', () => {
      engine.toggleDirection();
      expect(engine.getStatistics().direction).toBe('reverse');

      engine.toggleDirection();
      expect(engine.getStatistics().direction).toBe('forward');
    });
  });

  describe('statistics', () => {
    test('provides comprehensive statistics', async () => {
      await engine.start();

      const stats = engine.getStatistics();

      expect(stats).toHaveProperty('tracksPlayed');
      expect(stats).toHaveProperty('sessionDuration');
      expect(stats).toHaveProperty('currentKey');
      expect(stats).toHaveProperty('currentTempo');
      expect(stats).toHaveProperty('songsPlayed');
      expect(stats).toHaveProperty('songsRemaining');
      expect(stats).toHaveProperty('direction');
      expect(stats).toHaveProperty('lastTrackType');
    });

    test('tracks session duration', async () => {
      await engine.start();

      await new Promise((r) => setTimeout(r, 100));

      const stats = engine.getStatistics();
      expect(stats.sessionDuration).toBeGreaterThan(0);
    });

    test('session duration is 0 when idle', () => {
      const stats = engine.getStatistics();
      expect(stats.sessionDuration).toBe(0);
    });

    test('emits statsUpdate events', async () => {
      const handler = jest.fn();
      engine.on('statsUpdate', handler);

      await engine.start();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('event system', () => {
    test('subscribes to events', () => {
      const handler = jest.fn();

      const unsubscribe = engine.on('stateChange', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    test('unsubscribes via returned function', async () => {
      const handler = jest.fn();

      const unsubscribe = engine.on('stateChange', handler);
      unsubscribe();

      await engine.start();

      expect(handler).not.toHaveBeenCalled();
    });

    test('unsubscribes via off method', async () => {
      const handler = jest.fn();

      engine.on('stateChange', handler);
      engine.off('stateChange', handler);

      await engine.start();

      expect(handler).not.toHaveBeenCalled();
    });

    test('multiple handlers on same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      engine.on('stateChange', handler1);
      engine.on('stateChange', handler2);

      await engine.start();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('emits error event on failure', async () => {
      const handler = jest.fn();
      engine.on('error', handler);

      // Make audio loader fail
      audioLoader.load.mockRejectedValueOnce(new Error('Load failed'));

      const result = await engine.start();

      await expect(engine.loadTrack(result.track)).rejects.toThrow();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          context: 'loadTrack',
        })
      );
    });
  });

  describe('integration - realistic usage', () => {
    test('simulates complete mixing session', async () => {
      const selectedTracks: TrackRequest[] = [];

      engine.on('trackSelected', (result) => {
        selectedTracks.push(result.track);
      });

      // Start session
      await engine.start();

      // Play 10 tracks
      for (let i = 0; i < 10; i++) {
        await engine.next();
      }

      expect(selectedTracks).toHaveLength(11); // start + 10 more
      expect(engine.getStatistics().tracksPlayed).toBe(11);
      expect(engine.getState()).toBe('running');
    });

    test('handles tempo changes mid-session', async () => {
      await engine.start();

      engine.setTempo(84);
      const track1 = await engine.next();
      expect(track1.track.tempo).toBe(84);

      engine.setTempo(102);
      const track2 = await engine.next();
      expect(track2.track.tempo).toBe(102);
    });

    test('pause and resume during session', async () => {
      await engine.start();
      await engine.next();

      engine.pause();
      expect(engine.getState()).toBe('paused');

      engine.resume();
      await engine.next();

      expect(engine.getState()).toBe('running');
      expect(engine.getStatistics().tracksPlayed).toBe(3);
    });

    test('stop and restart session', async () => {
      await engine.start();
      await engine.next();

      engine.stop();
      expect(engine.getState()).toBe('stopped');

      await engine.start();
      expect(engine.getState()).toBe('running');
    });

    test('complete session with all features', async () => {
      const events: string[] = [];

      engine.on('stateChange', () => events.push('stateChange'));
      engine.on('trackSelected', () => events.push('trackSelected'));
      engine.on('tempoChange', () => events.push('tempoChange'));
      engine.on('keyChange', () => events.push('keyChange'));

      await engine.start();
      await engine.next();

      engine.setTempo(102);
      engine.setKey(5);

      engine.pause();
      engine.resume();

      expect(events.length).toBeGreaterThan(0);
      expect(events).toContain('stateChange');
      expect(events).toContain('trackSelected');
      expect(events).toContain('tempoChange');
      expect(events).toContain('keyChange');
    });
  });

  describe('edge cases', () => {
    test('handles rapid next() calls', async () => {
      await engine.start();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(engine.next());
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
    });

    test('handles small song library', async () => {
      const smallEngine = new KwyjiboEngine({
        songs: [
          { id: 1, artist: 'A', title: 'Song 1', key: 1, bpm: 94 },
          { id: 2, artist: 'B', title: 'Song 2', key: 1, bpm: 94 },
        ],
        audioLoader,
        selectorOptions: { useMagicNumber: false },
      });

      await smallEngine.start();
      await smallEngine.next();
      await smallEngine.next(); // Should auto-reset library

      expect(smallEngine.getState()).toBe('running');
    });

    test('getCurrentTrack returns null initially', () => {
      expect(engine.getCurrentTrack()).toBeNull();
    });

    test('getCurrentTrack returns current after start', async () => {
      await engine.start();

      const current = engine.getCurrentTrack();
      expect(current).not.toBeNull();
      expect(current?.song).toBeDefined();
    });
  });
});
