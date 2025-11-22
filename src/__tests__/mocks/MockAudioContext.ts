/**
 * Mock AudioContext for Testing
 *
 * A fake AudioContext that doesn't require real audio hardware.
 * Perfect for unit tests that need to decode audio.
 *
 * Why mock?
 * - Tests run faster (no real audio processing)
 * - Tests work in environments without audio (CI servers)
 * - You control the behavior (test error cases)
 */

/**
 * Mock implementation of AudioContext for testing.
 *
 * Example:
 *   const mockContext = new MockAudioContext();
 *   const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
 *   const buffer = await decoder.decode(data);
 */
export class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  currentTime = 0;

  private shouldFail = false;
  private failureError: Error | null = null;

  /**
   * Mock implementation of decodeAudioData.
   * Returns a fake AudioBuffer instead of doing real decoding.
   */
  async decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    // Simulate decoding delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    // If configured to fail, throw error
    if (this.shouldFail) {
      throw this.failureError ?? new Error('Decoding failed');
    }

    // Return a fake AudioBuffer
    return this.createFakeBuffer();
  }

  /**
   * Create a fake AudioBuffer for testing.
   * This is not a real buffer, but it has the same shape.
   */
  private createFakeBuffer(): AudioBuffer {
    // We can't create a real AudioBuffer without a real AudioContext,
    // but we can create an object that looks like one
    return {
      duration: 1.0,
      length: 44100,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(44100),
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as AudioBuffer;
  }

  /**
   * Resume the mock context (for testing resume logic).
   */
  async resume(): Promise<void> {
    this.state = 'running';
  }

  /**
   * Suspend the mock context (for testing).
   */
  async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  /**
   * Close the mock context (for testing cleanup).
   */
  async close(): Promise<void> {
    this.state = 'closed';
  }

  /**
   * Configure this mock to fail on next decode.
   * Useful for testing error handling.
   *
   * Example:
   *   mockContext.setFailure(new Error('Corrupt file'));
   *   // Next decode() will throw that error
   */
  setFailure(error: Error | null): void {
    this.shouldFail = error !== null;
    this.failureError = error;
  }

  /**
   * Reset the mock to successful state.
   */
  clearFailure(): void {
    this.shouldFail = false;
    this.failureError = null;
  }
}
