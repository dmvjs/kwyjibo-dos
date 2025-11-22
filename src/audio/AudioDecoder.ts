/**
 * Audio Decoder
 *
 * Converts raw audio file data into playable AudioBuffers.
 * Wraps the Web Audio API's decodeAudioData method with better error handling.
 *
 * What it does:
 * 1. Takes an ArrayBuffer (raw file data)
 * 2. Decodes it using the Web Audio API
 * 3. Returns an AudioBuffer (ready to play)
 * 4. Provides clear errors if decoding fails
 */

import { DecodeError } from './errors.js';
import type { IAudioDecoder } from './types.js';

/**
 * Decodes audio data using the Web Audio API.
 *
 * Why wrap AudioContext?
 * - Easy to mock in tests (no real audio needed)
 * - Consistent error handling
 * - Could add preprocessing (normalization, etc.) later
 * - Single place to manage the AudioContext
 *
 * Example:
 *   const decoder = new AudioDecoder(audioContext);
 *   const buffer = await decoder.decode(arrayBuffer);
 *   // Now you can play buffer with audioContext.createBufferSource()
 */
export class AudioDecoder implements IAudioDecoder {
  /**
   * Create a new decoder.
   *
   * @param context - The Web Audio API context to use for decoding
   *
   * Note: You typically create ONE AudioContext for your entire app
   * and reuse it everywhere. Creating multiple contexts can cause issues.
   */
  constructor(private readonly context: AudioContext) {}

  /**
   * Decode raw audio data into a playable buffer.
   *
   * @param arrayBuffer - Raw audio file data (from fetch, file read, etc.)
   * @returns Decoded audio buffer ready to play
   * @throws DecodeError if the data can't be decoded
   *
   * Common decode failures:
   * - File is corrupted
   * - Unsupported format
   * - File is not actually audio (e.g., an HTML error page)
   * - Incomplete file (partial download)
   * - AudioContext is closed
   *
   * How it works:
   * 1. Check AudioContext state
   * 2. Resume if suspended (required by browsers)
   * 3. Pass the data to AudioContext.decodeAudioData()
   * 4. Wait for decoding to complete (happens in a separate thread)
   * 5. Return the decoded buffer
   * 6. If decoding fails, wrap the error in a DecodeError
   */
  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    // Check if context is closed
    if (this.context.state === 'closed') {
      throw DecodeError.create('unknown', new Error('AudioContext is closed'));
    }

    // Resume if suspended (browsers suspend contexts by default)
    if (this.context.state === 'suspended') {
      await this.resume();
    }

    try {
      // decodeAudioData is the Web Audio API method that does the heavy lifting
      // It works with MP3, WAV, OGG, AAC, and other formats
      // Decoding happens off the main thread, so it won't freeze the UI
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      return audioBuffer;
    } catch (error) {
      // Decoding failed - the file is probably corrupted or unsupported
      // Wrap it in our custom error type for consistent error handling
      throw DecodeError.create('unknown', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get information about the audio context.
   * Useful for debugging and understanding the audio setup.
   *
   * @returns Object with context information
   */
  getContextInfo(): {
    sampleRate: number;
    state: AudioContextState;
    currentTime: number;
  } {
    return {
      sampleRate: this.context.sampleRate,
      state: this.context.state,
      currentTime: this.context.currentTime,
    };
  }

  /**
   * Resume the audio context if it's suspended.
   *
   * Why?
   * Browsers often suspend the AudioContext by default (to save resources).
   * You usually need to resume it after a user interaction (click, tap, etc.)
   *
   * Example:
   *   playButton.addEventListener('click', async () => {
   *     await decoder.resume();
   *     // Now you can play audio
   *   });
   */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}

/**
 * Helper function to create and manage a singleton AudioContext.
 * This ensures you only have one context for your entire app.
 *
 * Why singleton?
 * - AudioContext is a heavy object (system resources)
 * - Browsers limit how many you can create
 * - All audio should share the same context for proper mixing
 *
 * Example:
 *   const context = getAudioContext();
 *   const decoder = new AudioDecoder(context);
 *
 * Note: This is exported for convenience, but you can manage
 * the AudioContext yourself if you prefer.
 */
let globalAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
}

/**
 * Close the global audio context.
 * Call this when you're completely done with audio (e.g., app shutdown).
 *
 * Example:
 *   window.addEventListener('beforeunload', () => {
 *     closeAudioContext();
 *   });
 */
export async function closeAudioContext(): Promise<void> {
  if (globalAudioContext) {
    await globalAudioContext.close();
    globalAudioContext = null;
  }
}
