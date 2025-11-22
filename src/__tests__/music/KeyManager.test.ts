/**
 * Tests for KeyManager
 *
 * Tests key progression, direction changes, harmonic compatibility scoring,
 * and all utility methods.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { KeyManager } from '../../music/KeyManager.js';
import type { Key } from '../../music/types.js';

describe('KeyManager', () => {
  describe('initialization', () => {
    test('starts at key 1 by default', () => {
      const km = new KeyManager();

      expect(km.getCurrentKey()).toBe(1);
      expect(km.getDirection()).toBe('forward');
    });

    test('accepts custom start key', () => {
      const km = new KeyManager(5);

      expect(km.getCurrentKey()).toBe(5);
    });

    test('accepts custom direction', () => {
      const km = new KeyManager(1, 'reverse');

      expect(km.getDirection()).toBe('reverse');
    });

    test('accepts both custom key and direction', () => {
      const km = new KeyManager(8, 'reverse');

      expect(km.getCurrentKey()).toBe(8);
      expect(km.getDirection()).toBe('reverse');
    });
  });

  describe('key progression - forward', () => {
    let km: KeyManager;

    beforeEach(() => {
      km = new KeyManager(1, 'forward');
    });

    test('progresses forward through keys', () => {
      expect(km.next()).toBe(2);
      expect(km.next()).toBe(3);
      expect(km.next()).toBe(4);
      expect(km.getCurrentKey()).toBe(4);
    });

    test('wraps from 12 to 1', () => {
      km.setKey(11);

      expect(km.next()).toBe(12);
      expect(km.next()).toBe(1);
      expect(km.next()).toBe(2);
    });

    test('completes full cycle', () => {
      const visited: Key[] = [];

      for (let i = 0; i < 12; i++) {
        visited.push(km.getCurrentKey());
        km.next();
      }

      expect(visited).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(km.getCurrentKey()).toBe(1); // Back to start
    });
  });

  describe('key progression - reverse', () => {
    let km: KeyManager;

    beforeEach(() => {
      km = new KeyManager(12, 'reverse');
    });

    test('progresses backward through keys', () => {
      expect(km.next()).toBe(11);
      expect(km.next()).toBe(10);
      expect(km.next()).toBe(9);
      expect(km.getCurrentKey()).toBe(9);
    });

    test('wraps from 1 to 12', () => {
      km.setKey(2);

      expect(km.next()).toBe(1);
      expect(km.next()).toBe(12);
      expect(km.next()).toBe(11);
    });

    test('completes full cycle', () => {
      const visited: Key[] = [];

      for (let i = 0; i < 12; i++) {
        visited.push(km.getCurrentKey());
        km.next();
      }

      expect(visited).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      expect(km.getCurrentKey()).toBe(12); // Back to start
    });
  });

  describe('direction management', () => {
    test('changes direction', () => {
      const km = new KeyManager(5, 'forward');

      km.setDirection('reverse');

      expect(km.getDirection()).toBe('reverse');
      expect(km.next()).toBe(4); // Moves backward
    });

    test('toggles direction', () => {
      const km = new KeyManager(5, 'forward');

      km.toggleDirection();
      expect(km.getDirection()).toBe('reverse');

      km.toggleDirection();
      expect(km.getDirection()).toBe('forward');
    });

    test('affects next key', () => {
      const km = new KeyManager(5, 'forward');

      expect(km.next()).toBe(6);

      km.setDirection('reverse');
      expect(km.next()).toBe(5);
      expect(km.next()).toBe(4);
    });
  });

  describe('setKey', () => {
    test('jumps to specific key', () => {
      const km = new KeyManager(1);

      km.setKey(8);

      expect(km.getCurrentKey()).toBe(8);
    });

    test('works with all keys', () => {
      const km = new KeyManager();

      for (let key = 1; key <= 12; key++) {
        km.setKey(key as Key);
        expect(km.getCurrentKey()).toBe(key);
      }
    });
  });

  describe('peekNext', () => {
    test('previews next key without changing state', () => {
      const km = new KeyManager(5, 'forward');

      const peeked = km.peekNext();

      expect(peeked).toBe(6);
      expect(km.getCurrentKey()).toBe(5); // Unchanged
    });

    test('respects direction', () => {
      const km = new KeyManager(5, 'reverse');

      expect(km.peekNext()).toBe(4);
    });

    test('handles wrapping', () => {
      const km = new KeyManager(12, 'forward');

      expect(km.peekNext()).toBe(1);
    });
  });

  describe('scoreCompatibility', () => {
    let km: KeyManager;

    beforeEach(() => {
      km = new KeyManager();
    });

    test('scores same key as 10', () => {
      expect(km.scoreCompatibility(1, 1)).toBe(10);
      expect(km.scoreCompatibility(5, 5)).toBe(10);
      expect(km.scoreCompatibility(12, 12)).toBe(10);
    });

    test('scores relative keys highly', () => {
      // Key 1 (C) and Key 8 (Am) are relative major/minor
      expect(km.scoreCompatibility(1, 8)).toBe(9);
      expect(km.scoreCompatibility(8, 1)).toBe(9);
    });

    test('scores tritone keys low', () => {
      // Key 1 (C) and Key 6 (F#/Gb) are tritones (least compatible)
      expect(km.scoreCompatibility(1, 6)).toBe(1);
    });

    test('is symmetric for some pairs', () => {
      // Many relationships are symmetric
      expect(km.scoreCompatibility(1, 8)).toBe(km.scoreCompatibility(8, 1));
      expect(km.scoreCompatibility(3, 10)).toBe(km.scoreCompatibility(10, 3));
    });

    test('returns values between 1 and 10', () => {
      for (let from = 1; from <= 12; from++) {
        for (let to = 1; to <= 12; to++) {
          const score = km.scoreCompatibility(from as Key, to as Key);
          expect(score).toBeGreaterThanOrEqual(1);
          expect(score).toBeLessThanOrEqual(10);
        }
      }
    });
  });

  describe('scoreFromCurrent', () => {
    test('scores from current key', () => {
      const km = new KeyManager(1);

      expect(km.scoreFromCurrent(8)).toBe(9);
      expect(km.scoreFromCurrent(6)).toBe(1);
    });

    test('updates when current key changes', () => {
      const km = new KeyManager(1);

      const score1 = km.scoreFromCurrent(5);

      km.setKey(5);
      const score2 = km.scoreFromCurrent(1);

      // Scores should be symmetric
      expect(score1).toBe(score2);
    });
  });

  describe('getCompatibleKeys', () => {
    let km: KeyManager;

    beforeEach(() => {
      km = new KeyManager();
    });

    test('returns all 12 keys', () => {
      const compatible = km.getCompatibleKeys(1);

      expect(compatible).toHaveLength(12);
    });

    test('sorts by compatibility (highest first)', () => {
      const compatible = km.getCompatibleKeys(1);

      // First key should have highest score
      expect(compatible[0]).toBe(1); // Same key = 10

      // Each subsequent key should have equal or lower score
      for (let i = 0; i < compatible.length - 1; i++) {
        const score1 = km.scoreCompatibility(1, compatible[i]!);
        const score2 = km.scoreCompatibility(1, compatible[i + 1]!);
        expect(score1).toBeGreaterThanOrEqual(score2);
      }
    });

    test('last key has lowest score', () => {
      const compatible = km.getCompatibleKeys(1);

      const lastKey = compatible[compatible.length - 1]!;
      const lastScore = km.scoreCompatibility(1, lastKey);

      // Should be the tritone (score 1)
      expect(lastScore).toBe(1);
    });

    test('works for all keys', () => {
      for (let key = 1; key <= 12; key++) {
        const compatible = km.getCompatibleKeys(key as Key);
        expect(compatible).toHaveLength(12);
        expect(compatible[0]).toBe(key); // Same key always first
      }
    });
  });

  describe('getCompatibleKeysFromCurrent', () => {
    test('uses current key', () => {
      const km = new KeyManager(5);

      const compatible = km.getCompatibleKeysFromCurrent();

      expect(compatible[0]).toBe(5); // Same key first
      expect(compatible).toHaveLength(12);
    });

    test('updates with current key', () => {
      const km = new KeyManager(1);

      const compatible1 = km.getCompatibleKeysFromCurrent();

      km.setKey(6);
      const compatible2 = km.getCompatibleKeysFromCurrent();

      expect(compatible1[0]).toBe(1);
      expect(compatible2[0]).toBe(6);
    });
  });

  describe('isHighlyCompatible', () => {
    let km: KeyManager;

    beforeEach(() => {
      km = new KeyManager();
    });

    test('returns true for score >= 8', () => {
      expect(km.isHighlyCompatible(1, 1)).toBe(true); // 10
      expect(km.isHighlyCompatible(1, 8)).toBe(true); // 9
      expect(km.isHighlyCompatible(1, 12)).toBe(true); // 8
    });

    test('returns false for score < 8', () => {
      expect(km.isHighlyCompatible(1, 2)).toBe(false); // 7
      expect(km.isHighlyCompatible(1, 6)).toBe(false); // 1
    });

    test('checks all pairs correctly', () => {
      for (let from = 1; from <= 12; from++) {
        for (let to = 1; to <= 12; to++) {
          const score = km.scoreCompatibility(from as Key, to as Key);
          const isHighly = km.isHighlyCompatible(from as Key, to as Key);

          expect(isHighly).toBe(score >= 8);
        }
      }
    });
  });

  describe('reset', () => {
    test('resets to default state', () => {
      const km = new KeyManager(8, 'reverse');

      km.reset();

      expect(km.getCurrentKey()).toBe(1);
      expect(km.getDirection()).toBe('forward');
    });

    test('accepts custom reset values', () => {
      const km = new KeyManager();

      km.reset(7, 'reverse');

      expect(km.getCurrentKey()).toBe(7);
      expect(km.getDirection()).toBe('reverse');
    });

    test('clears progression state', () => {
      const km = new KeyManager(1, 'forward');

      km.next();
      km.next();
      km.next();

      km.reset();

      expect(km.getCurrentKey()).toBe(1);
    });
  });

  describe('getDistance', () => {
    let km: KeyManager;

    beforeEach(() => {
      km = new KeyManager(1, 'forward');
    });

    test('returns 0 for same key', () => {
      expect(km.getDistance(5, 5)).toBe(0);
    });

    test('calculates forward distance', () => {
      expect(km.getDistance(1, 3, 'forward')).toBe(2); // 1→2→3
      expect(km.getDistance(1, 5, 'forward')).toBe(4); // 1→2→3→4→5
    });

    test('calculates reverse distance', () => {
      expect(km.getDistance(5, 3, 'reverse')).toBe(2); // 5→4→3
      expect(km.getDistance(5, 1, 'reverse')).toBe(4); // 5→4→3→2→1
    });

    test('handles wrapping in forward direction', () => {
      expect(km.getDistance(11, 2, 'forward')).toBe(3); // 11→12→1→2
      expect(km.getDistance(12, 1, 'forward')).toBe(1); // 12→1
    });

    test('handles wrapping in reverse direction', () => {
      expect(km.getDistance(2, 11, 'reverse')).toBe(3); // 2→1→12→11
      expect(km.getDistance(1, 12, 'reverse')).toBe(1); // 1→12
    });

    test('uses current direction if not specified', () => {
      km.setDirection('forward');
      expect(km.getDistance(1, 5)).toBe(4);

      km.setDirection('reverse');
      expect(km.getDistance(5, 1)).toBe(4);
    });

    test('full cycle is 12 steps', () => {
      expect(km.getDistance(1, 1, 'forward')).toBe(0); // Same key
      expect(km.getDistance(1, 12, 'forward')).toBe(11); // Almost full cycle
    });
  });

  describe('integration - realistic usage', () => {
    test('simulates kwyjibo mixing session', () => {
      const km = new KeyManager(1, 'forward');

      // Track 1: Start at key 1
      expect(km.getCurrentKey()).toBe(1);

      // Track 2: Move to next key
      km.next();
      expect(km.getCurrentKey()).toBe(2);

      // Track 3: Check compatibility before moving
      const nextKey = km.peekNext();
      const compatibility = km.scoreFromCurrent(nextKey);
      expect(compatibility).toBeGreaterThan(0);

      km.next();
      expect(km.getCurrentKey()).toBe(3);

      // Track 4: Change direction
      km.toggleDirection();
      km.next();
      expect(km.getCurrentKey()).toBe(2);

      // Track 5: Jump to highly compatible key
      const compatibleKeys = km.getCompatibleKeysFromCurrent();
      const mostCompatible = compatibleKeys[1]!; // Second (first is current)
      km.setKey(mostCompatible);

      expect(km.isHighlyCompatible(2, mostCompatible)).toBe(true);
    });

    test('completes multiple cycles', () => {
      const km = new KeyManager(1, 'forward');

      // Complete 3 full cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < 12; i++) {
          km.next();
        }
      }

      expect(km.getCurrentKey()).toBe(1); // Back to start
    });

    test('handles direction changes mid-cycle', () => {
      const km = new KeyManager(1, 'forward');

      // Forward: 1→2→3→4→5
      for (let i = 0; i < 4; i++) km.next();
      expect(km.getCurrentKey()).toBe(5);

      // Reverse: 5→4→3
      km.setDirection('reverse');
      km.next();
      km.next();
      expect(km.getCurrentKey()).toBe(3);

      // Forward again: 3→4→5
      km.setDirection('forward');
      km.next();
      km.next();
      expect(km.getCurrentKey()).toBe(5);
    });
  });

  describe('edge cases', () => {
    test('handles rapid direction changes', () => {
      const km = new KeyManager(5);

      for (let i = 0; i < 100; i++) {
        km.toggleDirection();
      }

      expect(km.getDirection()).toBe('forward'); // Even number of toggles
      expect(km.getCurrentKey()).toBe(5); // Unchanged
    });

    test('handles many consecutive next calls', () => {
      const km = new KeyManager(1, 'forward');

      // Move 1000 times (83+ full cycles)
      for (let i = 0; i < 1000; i++) {
        km.next();
      }

      // 1000 % 12 = 4, so should be at key 5 (1 + 4)
      expect(km.getCurrentKey()).toBe(5);
    });

    test('setKey and next are consistent', () => {
      const km = new KeyManager(1, 'forward');

      for (let key = 1; key <= 12; key++) {
        km.setKey(key as Key);
        const next1 = km.peekNext();

        km.next();
        const current = km.getCurrentKey();

        expect(current).toBe(next1);

        km.setKey(key as Key); // Reset for next iteration
      }
    });
  });
});
