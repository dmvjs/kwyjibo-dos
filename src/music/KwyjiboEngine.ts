/**
 * Kwyjibo Engine
 *
 * The main public API for the kwyjibo mixing system. Orchestrates all components
 * to provide a clean interface for UI developers.
 *
 * This is the entry point that UI code will interact with. It handles:
 * - Song selection (library + key manager + quantum random)
 * - Audio loading and playback
 * - Event emission for UI updates
 * - Session management
 *
 * Example:
 *   const engine = new KwyjiboEngine({ songs, audioLoader });
 *   await engine.start();
 *   engine.on('trackPlaying', (track) => console.log(`Now playing: ${track.song.title}`));
 *   engine.on('trackComplete', () => engine.next());
 */

import { SongLibrary } from './SongLibrary.js';
import { KeyManager } from './KeyManager.js';
import { SongSelector } from './SongSelector.js';
import { QuantumRandom, getQuantumRandom } from '../random/QuantumRandom.js';
import { EventEmitter } from '../core/EventEmitter.js';
import type { Song, Key, Tempo, TrackRequest, Direction } from './types.js';
import type { IAudioBufferLoader, LoadResult } from '../audio/types.js';
import type { SongSelectorOptions, SelectionResult } from './SongSelector.js';
import type { QuantumRandomOptions } from '../random/QuantumRandom.js';

/**
 * Options for KwyjiboEngine initialization.
 */
export interface KwyjiboEngineOptions {
  /** Array of all songs to mix from */
  songs: readonly Song[];

  /** Audio buffer loader for loading audio files */
  audioLoader: IAudioBufferLoader;

  /** Starting key (1-12). Default: 1 */
  startKey?: Key;

  /** Key progression direction. Default: 'forward' */
  direction?: Direction;

  /** Starting tempo (84, 94, 102). Default: 94 */
  tempo?: Tempo;

  /** Song selector options */
  selectorOptions?: SongSelectorOptions;

  /** Quantum random options */
  quantumOptions?: QuantumRandomOptions;
}

/**
 * Engine state.
 */
export type EngineState = 'idle' | 'running' | 'paused' | 'stopped';

/**
 * Engine events for UI subscriptions.
 */
export interface EngineEvents {
  /** Engine state changed */
  stateChange: { state: EngineState; previousState: EngineState };

  /** New track selected */
  trackSelected: SelectionResult;

  /** Track is now playing */
  trackPlaying: { track: TrackRequest; buffer: LoadResult };

  /** Track playback started */
  trackStart: { track: TrackRequest };

  /** Track playback completed */
  trackComplete: { track: TrackRequest };

  /** Tempo changed */
  tempoChange: { tempo: Tempo; previousTempo: Tempo };

  /** Key changed */
  keyChange: { key: Key; previousKey: Key; direction: Direction };

  /** Error occurred */
  error: { error: Error; context: string };

  /** Session statistics updated */
  statsUpdate: EngineStatistics;
}

/**
 * Engine statistics.
 */
export interface EngineStatistics {
  /** Total tracks played */
  tracksPlayed: number;

  /** Current session duration (ms) */
  sessionDuration: number;

  /** Current key */
  currentKey: Key;

  /** Current tempo */
  currentTempo: Tempo;

  /** Songs played */
  songsPlayed: number;

  /** Songs remaining */
  songsRemaining: number;

  /** Current direction */
  direction: Direction;

  /** Last track type */
  lastTrackType: 'lead' | 'body';
}

/**
 * Main kwyjibo mixing engine.
 *
 * Example:
 *   const engine = new KwyjiboEngine({
 *     songs: songData,
 *     audioLoader: new AudioBufferLoader(...)
 *   });
 *
 *   // Subscribe to events
 *   engine.on('trackPlaying', (data) => {
 *     console.log(`Playing: ${data.track.song.artist} - ${data.track.song.title}`);
 *   });
 *
 *   // Start mixing
 *   const firstTrack = await engine.start();
 *
 *   // Get next track
 *   const nextTrack = await engine.next();
 *
 *   // Change tempo
 *   engine.setTempo(102);
 *
 *   // Pause/resume
 *   engine.pause();
 *   engine.resume();
 *
 *   // Stop and reset
 *   engine.stop();
 */
export class KwyjiboEngine {
  private readonly library: SongLibrary;
  private readonly keyManager: KeyManager;
  private readonly selector: SongSelector;
  private readonly audioLoader: IAudioBufferLoader;
  private readonly events: EventEmitter<EngineEvents>;

  private state: EngineState = 'idle';
  private sessionStartTime: number = 0;
  private currentTrack: TrackRequest | null = null;

  /**
   * Create a new kwyjibo engine.
   *
   * @param options - Engine configuration
   */
  constructor(options: KwyjiboEngineOptions) {
    // Validate options
    if (!Array.isArray(options.songs) || options.songs.length === 0) {
      throw new Error('songs array must be non-empty');
    }
    if (!options.audioLoader) {
      throw new Error('audioLoader is required');
    }

    // Create components
    this.library = new SongLibrary(options.songs);
    this.keyManager = new KeyManager(
      options.startKey ?? 1,
      options.direction ?? 'forward'
    );

    // Get or create quantum random instance
    const qrng = options.quantumOptions
      ? new QuantumRandom(options.quantumOptions)
      : getQuantumRandom();

    this.selector = new SongSelector(
      this.library,
      this.keyManager,
      qrng,
      options.selectorOptions
    );

    if (options.tempo) {
      this.selector.setTempo(options.tempo);
    }

    this.audioLoader = options.audioLoader;
    this.events = new EventEmitter();
  }

  /**
   * Start the mixing session.
   *
   * @returns First track selection result
   *
   * Example:
   *   const firstTrack = await engine.start();
   *   console.log(`Starting with: ${firstTrack.track.song.title}`);
   */
  async start(): Promise<SelectionResult> {
    if (this.state !== 'idle' && this.state !== 'stopped') {
      throw new Error(`Cannot start from state: ${this.state}`);
    }

    this.setState('running');
    this.sessionStartTime = Date.now();

    try {
      return await this.next();
    } catch (error) {
      this.emitError(error as Error, 'start');
      throw error;
    }
  }

  /**
   * Select and prepare the next track.
   *
   * @returns Track selection result with audio loaded
   *
   * Example:
   *   const track = await engine.next();
   *   // Play track.buffer in your audio player
   */
  async next(): Promise<SelectionResult> {
    if (this.state !== 'running') {
      throw new Error(`Cannot select next track in state: ${this.state}`);
    }

    try {
      // Select next track
      const selection = await this.selector.selectTrack();
      this.currentTrack = selection.track;

      // Emit selection event
      this.events.emit('trackSelected', selection);

      // Emit stats
      this.emitStats();

      return selection;
    } catch (error) {
      this.emitError(error as Error, 'next');
      throw error;
    }
  }

  /**
   * Load audio for a track.
   *
   * @param track - Track to load audio for
   * @returns Loaded audio buffer
   *
   * Example:
   *   const result = await engine.next();
   *   const buffer = await engine.loadTrack(result.track);
   */
  async loadTrack(track: TrackRequest): Promise<LoadResult> {
    try {
      const url = this.buildTrackUrl(track);

      const [result] = await this.audioLoader.load([
        {
          id: `${track.song.id}-${track.type}`,
          url,
          metadata: { song: track.song, type: track.type },
        },
      ]);

      if (!result) {
        throw new Error(`Failed to load track: ${url}`);
      }

      return result;
    } catch (error) {
      this.emitError(error as Error, 'loadTrack');
      throw error;
    }
  }

  /**
   * Pause the mixing session.
   */
  pause(): void {
    if (this.state !== 'running') {
      throw new Error(`Cannot pause from state: ${this.state}`);
    }

    this.setState('paused');
  }

  /**
   * Resume the mixing session.
   */
  resume(): void {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume from state: ${this.state}`);
    }

    this.setState('running');
  }

  /**
   * Stop the mixing session and reset.
   */
  stop(): void {
    this.setState('stopped');
    this.sessionStartTime = 0;
    this.currentTrack = null;
  }

  /**
   * Reset the engine to initial state.
   *
   * @param resetLibrary - Reset played songs (default: true)
   * @param resetKeyManager - Reset key manager (default: true)
   */
  reset(resetLibrary: boolean = true, resetKeyManager: boolean = true): void {
    this.selector.reset(resetLibrary, resetKeyManager);
    this.state = 'idle';
    this.sessionStartTime = 0;
    this.currentTrack = null;

    this.emitStats();
  }

  /**
   * Change the tempo.
   *
   * @param tempo - New tempo (84, 94, or 102)
   */
  setTempo(tempo: Tempo): void {
    const previousTempo = this.selector.getTempo();

    if (previousTempo === tempo) return;

    this.selector.setTempo(tempo);
    this.events.emit('tempoChange', { tempo, previousTempo });
    this.emitStats();
  }

  /**
   * Change the key progression direction.
   *
   * @param direction - New direction ('forward' or 'reverse')
   */
  setDirection(direction: Direction): void {
    this.keyManager.setDirection(direction);
    this.emitStats();
  }

  /**
   * Toggle direction between forward and reverse.
   */
  toggleDirection(): void {
    this.keyManager.toggleDirection();
    this.emitStats();
  }

  /**
   * Jump to a specific key.
   *
   * @param key - Key to jump to (1-12)
   */
  setKey(key: Key): void {
    const previousKey = this.keyManager.getCurrentKey();

    if (previousKey === key) return;

    this.keyManager.setKey(key);
    this.events.emit('keyChange', {
      key,
      previousKey,
      direction: this.keyManager.getDirection(),
    });
    this.emitStats();
  }

  /**
   * Get current engine state.
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Get current statistics.
   */
  getStatistics(): EngineStatistics {
    const selectorStats = this.selector.getStats();

    return {
      tracksPlayed: selectorStats.trackCount,
      sessionDuration: this.state === 'idle' ? 0 : Date.now() - this.sessionStartTime,
      currentKey: selectorStats.currentKey,
      currentTempo: selectorStats.currentTempo,
      songsPlayed: selectorStats.songsPlayed,
      songsRemaining: selectorStats.songsRemaining,
      direction: this.keyManager.getDirection(),
      lastTrackType: selectorStats.lastTrackType,
    };
  }

  /**
   * Get current track.
   */
  getCurrentTrack(): TrackRequest | null {
    return this.currentTrack;
  }

  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   *
   * Example:
   *   const unsubscribe = engine.on('trackSelected', (selection) => {
   *     console.log(selection.track.song.title);
   *   });
   *
   *   // Later: unsubscribe()
   */
  on<E extends keyof EngineEvents>(
    event: E,
    handler: (data: EngineEvents[E]) => void
  ): () => void {
    return this.events.on(event, handler);
  }

  /**
   * Unsubscribe from an event.
   *
   * @param event - Event name
   * @param handler - Event handler
   */
  off<E extends keyof EngineEvents>(
    event: E,
    handler: (data: EngineEvents[E]) => void
  ): void {
    this.events.off(event, handler);
  }

  /**
   * Build URL for a track's audio file.
   *
   * @param track - Track to build URL for
   * @returns URL to audio file
   *
   * Format: /music/{tempo}/{id}-{type}.mp3
   * Example: /music/94/00000001-lead.mp3
   */
  private buildTrackUrl(track: TrackRequest): string {
    const id = track.song.id.toString().padStart(8, '0');
    return `/music/${track.tempo}/${id}-${track.type}.mp3`;
  }

  /**
   * Set engine state and emit event.
   */
  private setState(newState: EngineState): void {
    const previousState = this.state;

    if (previousState === newState) return;

    this.state = newState;
    this.events.emit('stateChange', { state: newState, previousState });
  }

  /**
   * Emit statistics update event.
   */
  private emitStats(): void {
    this.events.emit('statsUpdate', this.getStatistics());
  }

  /**
   * Emit error event.
   */
  private emitError(error: Error, context: string): void {
    this.events.emit('error', { error, context });
  }
}
