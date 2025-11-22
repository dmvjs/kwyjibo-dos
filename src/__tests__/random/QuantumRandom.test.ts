/**
 * Tests for QuantumRandom
 *
 * Tests quantum random number generation with mocked API,
 * cache management, fallback behavior, and all utility methods.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { QuantumRandom } from '@/random/QuantumRandom';

/**
 * Mock storage for testing (replaces localStorage).
 * Currently unused but kept for potential future storage tests.
 */
// class MockStorage implements RandomStorage {
//   private data = new Map<string, string>();
//
//   getItem(key: string): string | null {
//     return this.data.get(key) ?? null;
//   }
//
//   setItem(key: string, value: string): void {
//     this.data.set(key, value);
//   }
//
//   removeItem(key: string): void {
//     this.data.delete(key);
//   }
//
//   clear(): void {
//     this.data.clear();
//   }
// }

/**
 * Mock fetch for testing API calls.
 */
let mockFetch: jest.MockedFunction<typeof fetch>;
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('QuantumRandom', () => {
  describe('initialization', () => {
    test('creates instance with default options', () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const stats = qrng.getCacheStats();

      expect(stats.maxSize).toBe(2048);
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });

    test('accepts custom options', () => {
      const qrng = new QuantumRandom({
        cacheSize: 1000,
        useLocalStorage: false,
      });

      const stats = qrng.getCacheStats();
      expect(stats.maxSize).toBe(1000);
    });
  });

  describe('getInteger', () => {
    test('returns integer in range', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      for (let i = 0; i < 10; i++) {
        const value = await qrng.getInteger(1, 10);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    test('handles single value range', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const value = await qrng.getInteger(5, 5);
      expect(value).toBe(5);
    });

    test('throws on invalid range', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      await expect(qrng.getInteger(10, 1)).rejects.toThrow();
    });

    test('throws on non-integer', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      await expect(qrng.getInteger(1.5, 10)).rejects.toThrow();
    });
  });

  describe('getFloat', () => {
    test('returns float between 0 and 1', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      for (let i = 0; i < 10; i++) {
        const value = await qrng.getFloat();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    test('returns different values', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      const values = await Promise.all([
        qrng.getFloat(),
        qrng.getFloat(),
        qrng.getFloat(),
      ]);

      // Extremely unlikely all three are the same
      const unique = new Set(values);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('getHexadecimal', () => {
    test('returns hex string of correct length', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      const hex = await qrng.getHexadecimal(16);
      expect(hex).toHaveLength(16);
      expect(hex).toMatch(/^[0-9a-f]+$/);
    });

    test('throws on invalid length', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      await expect(qrng.getHexadecimal(0)).rejects.toThrow();
      await expect(qrng.getHexadecimal(-1)).rejects.toThrow();
    });
  });

  describe('getChoice', () => {
    test('returns element from array', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = ['a', 'b', 'c', 'd', 'e'];

      const choice = await qrng.getChoice(array);
      expect(array).toContain(choice);
    });

    test('works with single element', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const choice = await qrng.getChoice(['only']);
      expect(choice).toBe('only');
    });

    test('throws on empty array', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      await expect(qrng.getChoice([])).rejects.toThrow();
    });

    test('eventually returns all elements', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = ['a', 'b', 'c'];
      const chosen = new Set<string>();

      // Try 20 times - should get all 3 elements
      for (let i = 0; i < 20; i++) {
        const choice = await qrng.getChoice(array);
        chosen.add(choice);
      }

      expect(chosen.size).toBe(3);
    });
  });

  describe('getUniqueChoices', () => {
    test('returns correct number of unique elements', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = [1, 2, 3, 4, 5];

      const choices = await qrng.getUniqueChoices(array, 3);

      expect(choices).toHaveLength(3);
      const unique = new Set(choices);
      expect(unique.size).toBe(3);
      choices.forEach((c) => expect(array).toContain(c));
    });

    test('throws if count > array length', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      await expect(qrng.getUniqueChoices([1, 2], 3)).rejects.toThrow();
    });

    test('handles count = 0', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const choices = await qrng.getUniqueChoices([1, 2, 3], 0);
      expect(choices).toHaveLength(0);
    });
  });

  describe('shuffle', () => {
    test('returns array of same length', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = [1, 2, 3, 4, 5];

      const shuffled = await qrng.shuffle(array);

      expect(shuffled).toHaveLength(array.length);
    });

    test('contains all original elements', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = [1, 2, 3, 4, 5];

      const shuffled = await qrng.shuffle(array);

      expect(shuffled.sort()).toEqual(array.sort());
    });

    test('does not modify original array', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = [1, 2, 3, 4, 5];
      const original = [...array];

      await qrng.shuffle(array);

      expect(array).toEqual(original);
    });

    test('produces different orders', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const results = await Promise.all([
        qrng.shuffle(array),
        qrng.shuffle(array),
        qrng.shuffle(array),
      ]);

      // At least one should be different from original
      const different = results.some(
        (r) => JSON.stringify(r) !== JSON.stringify(array)
      );
      expect(different).toBe(true);
    });
  });

  describe('getBoolean', () => {
    test('returns boolean', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      const value = await qrng.getBoolean();
      expect(typeof value).toBe('boolean');
    });

    test('returns both true and false eventually', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });
      const results = new Set<boolean>();

      for (let i = 0; i < 20; i++) {
        const value = await qrng.getBoolean();
        results.add(value);
      }

      expect(results.size).toBe(2);
      expect(results.has(true)).toBe(true);
      expect(results.has(false)).toBe(true);
    });
  });

  describe('cache management', () => {
    test('tracks cache statistics', () => {
      const qrng = new QuantumRandom({ useLocalStorage: false, cacheSize: 100 });

      const stats = qrng.getCacheStats();

      expect(stats.maxSize).toBe(100);
      expect(stats.percentage).toBeGreaterThanOrEqual(0);
      expect(stats.percentage).toBeLessThanOrEqual(100);
      expect(typeof stats.isRefilling).toBe('boolean');
    });

    test('clears cache', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      await qrng.getHexadecimal(10); // Fill cache
      qrng.clearCache();

      const stats = qrng.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('uses crypto fallback when cache empty', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false, cacheSize: 10 });

      qrng.clearCache();

      // Should still work using crypto fallback
      const value = await qrng.getHexadecimal(20);
      expect(value).toHaveLength(20);
    });
  });

  describe('API integration', () => {
    test('handles API success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'abcdef0123456789' }),
      } as Response);

      const qrng = new QuantumRandom({
        useLocalStorage: false,
        cacheSize: 100,
      });

      // Give it time to refill
      await new Promise((r) => setTimeout(r, 100));

      const stats = qrng.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('handles API failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const qrng = new QuantumRandom({
        useLocalStorage: false,
        apiTimeout: 100,
      });

      // Should still work with crypto fallback
      const value = await qrng.getInteger(1, 10);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    });

    test('handles API timeout', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ data: 'test' }),
                } as Response),
              1000
            );
          })
      );

      const qrng = new QuantumRandom({
        useLocalStorage: false,
        apiTimeout: 100, // Short timeout
      });

      // Should fall back to crypto
      const value = await qrng.getInteger(1, 10);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    });
  });

  describe('edge cases', () => {
    test('handles very large ranges', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      const value = await qrng.getInteger(1, 1000000);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(1000000);
    });

    test('handles negative ranges', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      const value = await qrng.getInteger(-10, -1);
      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThanOrEqual(-1);
    });

    test('handles rapid successive calls', async () => {
      const qrng = new QuantumRandom({ useLocalStorage: false });

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(qrng.getInteger(1, 100));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      results.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(100);
      });
    });
  });
});
