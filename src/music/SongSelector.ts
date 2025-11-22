/**
 * Song Selector
 *
 * The heart of the kwyjibo mixing algorithm. Combines SongLibrary,
 * KeyManager, and QuantumRandom to select songs that flow harmonically
 * while maintaining unpredictability.
 *
 * Algorithm:
 * 1. Filter songs by current key and tempo
 * 2. Score each song by harmonic compatibility
 * 3. Remove already-played songs
 * 4. Select randomly from top-scored candidates
 * 5. Handle "magic number" (every 5th track special selection)
 *
 * Responsibilities:
 * - Implement selection algorithm
 * - Track selection state
 * - Handle tempo changes
 * - Manage "lead" vs "body" track types
 */

import type { Song, Tempo, TrackRequest, Key } from './types.js';
import type { SongLibrary } from './SongLibrary.js';
import type { KeyManager } from './KeyManager.js';
import type { QuantumRandom } from '../random/QuantumRandom.js';

/**
 * Options for song selection.
 */
export interface SongSelectorOptions {
  /**
   * How many top-scored songs to consider for random selection.
   * Default: 5
   *
   * Example: If 3, select randomly from the 3 most compatible songs.
   */
  candidatePoolSize?: number;

  /**
   * Whether to use "magic number" special selection.
   * Every 5th track uses different selection logic.
   * Default: true
   */
  useMagicNumber?: boolean;

  /**
   * Minimum compatibility score to consider a song.
   * Songs below this score are excluded.
   * Default: 5 (out of 10)
   */
  minCompatibilityScore?: number;

  /**
   * Default tempo for new sessions.
   * Default: 94
   */
  defaultTempo?: Tempo;
}

/**
 * Selection result with chosen song and metadata.
 */
export interface SelectionResult {
  /** The selected track request */
  track: TrackRequest;

  /** Whether this was a "magic number" selection */
  wasMagicNumber: boolean;

  /** Number of candidates considered */
  candidatesConsidered: number;

  /** Compatibility score of selected song */
  compatibilityScore: number;
}

/**
 * Selects songs using quantum randomness and harmonic compatibility.
 *
 * Example:
 *   const selector = new SongSelector(library, keyManager, quantumRandom);
 *
 *   // Select first track
 *   const result = await selector.selectTrack();
 *   console.log(`Playing: ${result.track.song.artist} - ${result.track.song.title}`);
 *
 *   // Select next track
 *   const next = await selector.selectTrack();
 */
export class SongSelector {
  private readonly library: SongLibrary;
  private readonly keyManager: KeyManager;
  private readonly qrng: QuantumRandom;
  private readonly options: Required<SongSelectorOptions>;

  private currentTempo: Tempo;
  private trackCount: number = 0;
  private lastTrackType: 'lead' | 'body' = 'body';

  /**
   * Create a new song selector.
   *
   * @param library - Song library to select from
   * @param keyManager - Key manager for harmonic progression
   * @param quantumRandom - Quantum random number generator
   * @param options - Selection options
   */
  constructor(
    library: SongLibrary,
    keyManager: KeyManager,
    quantumRandom: QuantumRandom,
    options: SongSelectorOptions = {}
  ) {
    this.library = library;
    this.keyManager = keyManager;
    this.qrng = quantumRandom;

    this.options = {
      candidatePoolSize: options.candidatePoolSize ?? 5,
      useMagicNumber: options.useMagicNumber ?? true,
      minCompatibilityScore: options.minCompatibilityScore ?? 5,
      defaultTempo: options.defaultTempo ?? 94,
    };

    this.currentTempo = this.options.defaultTempo;
  }

  /**
   * Select the next track to play.
   *
   * @returns Selection result with track and metadata
   *
   * Example:
   *   const result = await selector.selectTrack();
   *   // result.track.song = { id, artist, title, key, bpm }
   *   // result.track.tempo = 94 (adjusted BPM)
   *   // result.track.type = 'lead' or 'body'
   */
  async selectTrack(): Promise<SelectionResult> {
    this.trackCount++;

    // Check if this is a "magic number" track
    const isMagicNumber = this.options.useMagicNumber && this.trackCount % 5 === 0;

    let song: Song;
    let candidatesConsidered: number;

    if (isMagicNumber) {
      // Magic number: select from all unplayed songs (no key constraint)
      const result = await this.selectMagicNumber();
      song = result.song;
      candidatesConsidered = result.candidatesConsidered;
    } else {
      // Normal selection: filter by key, score by compatibility
      const result = await this.selectNormal();
      song = result.song;
      candidatesConsidered = result.candidatesConsidered;
    }

    // Determine track type (lead vs body)
    const trackType = this.determineTrackType(song);

    // Mark song as played
    this.library.markPlayed(song.id);

    // Move to next key (unless this was first track)
    if (this.trackCount > 1) {
      this.keyManager.next();
    }

    // Calculate compatibility score
    const compatibilityScore = this.keyManager.scoreFromCurrent(song.key);

    return {
      track: {
        song,
        tempo: this.currentTempo,
        type: trackType,
      },
      wasMagicNumber: isMagicNumber,
      candidatesConsidered,
      compatibilityScore,
    };
  }

  /**
   * Normal selection: filter by key, score by compatibility.
   */
  private async selectNormal(): Promise<{ song: Song; candidatesConsidered: number }> {
    const currentKey = this.keyManager.getCurrentKey();

    // Get unplayed songs in current key
    let candidates = this.library.getUnplayed({
      key: currentKey,
    });

    // If no candidates in current key, expand to compatible keys
    if (candidates.length === 0) {
      candidates = this.getCompatibleCandidates();
    }

    // If still no candidates, reset and try again
    if (candidates.length === 0) {
      this.library.reset();
      candidates = this.library.filter({ key: currentKey });
    }

    // If STILL no candidates, get any unplayed song
    if (candidates.length === 0) {
      candidates = this.library.getUnplayed();
    }

    // Last resort: reset everything
    if (candidates.length === 0) {
      this.library.reset();
      candidates = this.library.getAllSongs() as Song[];
    }

    const candidatesConsidered = candidates.length;

    // Score and filter by compatibility
    const scored = this.scoreCandidates(candidates);

    // Select from top candidates
    const song = await this.selectFromTopCandidates(scored);

    return { song, candidatesConsidered };
  }

  /**
   * Magic number selection: broader selection from all unplayed songs.
   */
  private async selectMagicNumber(): Promise<{ song: Song; candidatesConsidered: number }> {
    // Get all unplayed songs (no key filter)
    let candidates = this.library.getUnplayed();

    // If no unplayed songs, reset
    if (candidates.length === 0) {
      this.library.reset();
      candidates = this.library.getAllSongs() as Song[];
    }

    const candidatesConsidered = candidates.length;

    // For magic number, select completely randomly (no scoring)
    const song = await this.qrng.getChoice(candidates);

    return { song, candidatesConsidered };
  }

  /**
   * Get candidates from compatible keys when current key has no songs.
   */
  private getCompatibleCandidates(): Song[] {
    const currentKey = this.keyManager.getCurrentKey();
    const compatibleKeys = this.keyManager
      .getCompatibleKeys(currentKey)
      .filter((key) => this.keyManager.scoreCompatibility(currentKey, key) >= this.options.minCompatibilityScore);

    const candidates: Song[] = [];

    for (const key of compatibleKeys) {
      const songs = this.library.getUnplayed({ key });
      candidates.push(...songs);

      // Stop once we have enough candidates
      if (candidates.length >= this.options.candidatePoolSize * 2) {
        break;
      }
    }

    return candidates;
  }

  /**
   * Score candidates by harmonic compatibility.
   */
  private scoreCandidates(candidates: Song[]): Array<{ song: Song; score: number }> {
    const currentKey = this.keyManager.getCurrentKey();

    return candidates
      .map((song) => ({
        song,
        score: this.keyManager.scoreCompatibility(currentKey, song.key),
      }))
      .filter((item) => item.score >= this.options.minCompatibilityScore)
      .sort((a, b) => b.score - a.score); // Highest score first
  }

  /**
   * Select randomly from top-scored candidates.
   */
  private async selectFromTopCandidates(
    scored: Array<{ song: Song; score: number }>
  ): Promise<Song> {
    // If no scored candidates, should never happen but fallback
    if (scored.length === 0) {
      const allSongs = this.library.getAllSongs() as Song[];
      return this.qrng.getChoice(allSongs);
    }

    // Take top N candidates
    const topCandidates = scored.slice(0, this.options.candidatePoolSize);

    // Select randomly from top candidates
    const selected = await this.qrng.getChoice(topCandidates);

    return selected.song;
  }

  /**
   * Determine track type (lead or body) based on context.
   *
   * Lead tracks are 16-beat intros, body tracks are 64-beat loops.
   * Strategy: Alternate between lead and body, with occasional double bodies.
   */
  private determineTrackType(_song: Song): 'lead' | 'body' {
    // First track is always a lead (intro)
    if (this.trackCount === 1) {
      this.lastTrackType = 'lead';
      return 'lead';
    }

    // After a lead, always play a body
    if (this.lastTrackType === 'lead') {
      this.lastTrackType = 'body';
      return 'body';
    }

    // After a body, usually play a lead, but sometimes another body
    // Use quantum randomness: 70% lead, 30% body
    const useBody = Math.random() < 0.3; // Using Math.random for speed

    this.lastTrackType = useBody ? 'body' : 'lead';
    return this.lastTrackType;
  }

  /**
   * Change the current tempo.
   *
   * @param tempo - New tempo (84, 94, or 102)
   */
  setTempo(tempo: Tempo): void {
    this.currentTempo = tempo;
  }

  /**
   * Get the current tempo.
   */
  getTempo(): Tempo {
    return this.currentTempo;
  }

  /**
   * Get the current key from key manager.
   */
  getCurrentKey(): Key {
    return this.keyManager.getCurrentKey();
  }

  /**
   * Get number of tracks selected so far.
   */
  getTrackCount(): number {
    return this.trackCount;
  }

  /**
   * Reset selector to initial state.
   *
   * @param resetLibrary - Whether to reset played songs in library (default: true)
   * @param resetKeyManager - Whether to reset key manager (default: true)
   */
  reset(resetLibrary: boolean = true, resetKeyManager: boolean = true): void {
    if (resetLibrary) {
      this.library.reset();
    }

    if (resetKeyManager) {
      this.keyManager.reset();
    }

    this.trackCount = 0;
    this.lastTrackType = 'body';
    this.currentTempo = this.options.defaultTempo;
  }

  /**
   * Get selection statistics.
   */
  getStats(): {
    trackCount: number;
    currentKey: Key;
    currentTempo: Tempo;
    songsPlayed: number;
    songsRemaining: number;
    lastTrackType: 'lead' | 'body';
  } {
    return {
      trackCount: this.trackCount,
      currentKey: this.keyManager.getCurrentKey(),
      currentTempo: this.currentTempo,
      songsPlayed: this.library.getPlayedCount(),
      songsRemaining: this.library.getRemainingCount(),
      lastTrackType: this.lastTrackType,
    };
  }
}
