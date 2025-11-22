/**
 * Tests for AudioDecoder
 *
 * Shows how the decoder works and handles errors.
 */

import { describe, test, expect } from '@jest/globals';
import { AudioDecoder } from '@/audio';
import { DecodeError } from '@/audio';
import { MockAudioContext } from '../mocks/MockAudioContext.js';

describe('AudioDecoder', () => {
  describe('successful decoding', () => {
    test('decodes audio data', async () => {
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);

      const testData = new ArrayBuffer(1024);
      const buffer = await decoder.decode(testData);

      // Verify we got a buffer back
      expect(buffer).toBeDefined();
      expect(buffer.duration).toBeGreaterThan(0);
      expect(buffer.sampleRate).toBe(44100);
    });

    test('passes data to AudioContext.decodeAudioData', async () => {
      const mockContext = new MockAudioContext();
      const decodeSpy = jest.spyOn(mockContext, 'decodeAudioData');
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);

      const testData = new ArrayBuffer(1024);
      await decoder.decode(testData);

      expect(decodeSpy).toHaveBeenCalledWith(testData);
    });
  });

  describe('error handling', () => {
    test('throws DecodeError when decoding fails', async () => {
      const mockContext = new MockAudioContext();
      mockContext.setFailure(new Error('Corrupt file'));

      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      const testData = new ArrayBuffer(1024);

      await expect(decoder.decode(testData)).rejects.toThrow(DecodeError);
    });
  });

  describe('context management', () => {
    test('getContextInfo returns context information', () => {
      const mockContext = new MockAudioContext();
      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);

      const info = decoder.getContextInfo();

      expect(info.sampleRate).toBe(44100);
      expect(info.state).toBe('running');
      expect(info.currentTime).toBeDefined();
    });

    test('resume() resumes suspended context', async () => {
      const mockContext = new MockAudioContext();
      mockContext.state = 'suspended';

      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      await decoder.resume();

      expect(mockContext.state).toBe('running');
    });

    test('resume() does nothing if already running', async () => {
      const mockContext = new MockAudioContext();
      const resumeSpy = jest.spyOn(mockContext, 'resume');

      const decoder = new AudioDecoder(mockContext as unknown as AudioContext);
      await decoder.resume();

      expect(resumeSpy).not.toHaveBeenCalled();
    });
  });
});
