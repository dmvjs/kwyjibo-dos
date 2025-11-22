/**
 * Key Manager
 *
 * Manages musical key progression and harmonic compatibility scoring
 * for the kwyjibo mixing algorithm.
 *
 * Key Progression:
 * - Keys progress sequentially: 1→2→3...→12→1 (forward)
 * - Or reverse: 12→11→10...→1→12 (reverse)
 * - Direction can change dynamically
 *
 * Harmonic Compatibility:
 * - Each key has compatibility scores with other keys
 * - Based on music theory (circle of fifths, relative keys)
 * - Higher score = more harmonically compatible
 *
 * Responsibilities:
 * - Track current key
 * - Progress to next key
 * - Score key compatibility
 * - Change direction
 */

import type { Key, Direction } from './types.js';

/**
 * Harmonic compatibility scores between keys.
 *
 * Based on circle of fifths and music theory:
 * - 10: Perfect match (same key)
 * - 8-9: Very compatible (relative major/minor, adjacent in circle of fifths)
 * - 5-7: Compatible (nearby keys)
 * - 2-4: Less compatible (distant keys)
 * - 1: Least compatible (tritone, opposite in circle)
 *
 * Example: Key 1 (C) is very compatible with Key 8 (Am, relative minor)
 */
const HARMONIC_SCORES: Record<Key, Record<Key, number>> = {
  1: { 1: 10, 2: 7, 3: 5, 4: 3, 5: 2, 6: 1, 7: 2, 8: 9, 9: 6, 10: 4, 11: 3, 12: 8 },
  2: { 1: 7, 2: 10, 3: 8, 4: 6, 5: 4, 6: 2, 7: 1, 8: 3, 9: 9, 10: 7, 11: 5, 12: 4 },
  3: { 1: 5, 2: 8, 3: 10, 4: 9, 5: 7, 6: 4, 7: 2, 8: 1, 9: 4, 10: 9, 11: 8, 12: 6 },
  4: { 1: 3, 2: 6, 3: 9, 4: 10, 5: 9, 6: 7, 7: 4, 8: 2, 9: 1, 10: 5, 11: 9, 12: 8 },
  5: { 1: 2, 2: 4, 3: 7, 4: 9, 5: 10, 6: 9, 7: 7, 8: 4, 9: 2, 10: 1, 11: 6, 12: 9 },
  6: { 1: 1, 2: 2, 3: 4, 4: 7, 5: 9, 6: 10, 7: 9, 8: 7, 9: 4, 10: 2, 11: 1, 12: 5 },
  7: { 1: 2, 2: 1, 3: 2, 4: 4, 5: 7, 6: 9, 7: 10, 8: 9, 9: 7, 10: 4, 11: 2, 12: 1 },
  8: { 1: 9, 2: 3, 3: 1, 4: 2, 5: 4, 6: 7, 7: 9, 8: 10, 9: 9, 10: 7, 11: 4, 12: 2 },
  9: { 1: 6, 2: 9, 3: 4, 4: 1, 5: 2, 6: 4, 7: 7, 8: 9, 9: 10, 10: 9, 11: 7, 12: 4 },
  10: { 1: 4, 2: 7, 3: 9, 4: 5, 5: 1, 6: 2, 7: 4, 8: 7, 9: 9, 10: 10, 11: 9, 12: 7 },
  11: { 1: 3, 2: 5, 3: 8, 4: 9, 5: 6, 6: 1, 7: 2, 8: 4, 9: 7, 10: 9, 11: 10, 12: 9 },
  12: { 1: 8, 2: 4, 3: 6, 4: 8, 5: 9, 6: 5, 7: 1, 8: 2, 9: 4, 10: 7, 11: 9, 12: 10 },
};

/**
 * Manages key progression and harmonic compatibility.
 *
 * Example:
 *   const keyManager = new KeyManager();
 *
 *   // Start at key 1
 *   keyManager.getCurrentKey(); // 1
 *
 *   // Move forward
 *   keyManager.next(); // 2
 *   keyManager.next(); // 3
 *
 *   // Change direction
 *   keyManager.setDirection('reverse');
 *   keyManager.next(); // 2
 *
 *   // Score compatibility
 *   keyManager.scoreCompatibility(1, 8); // 9 (very compatible)
 */
export class KeyManager {
  private currentKey: Key;
  private direction: Direction;

  /**
   * Create a new key manager.
   *
   * @param startKey - Starting key (default: 1)
   * @param direction - Initial direction (default: 'forward')
   */
  constructor(startKey: Key = 1, direction: Direction = 'forward') {
    this.currentKey = startKey;
    this.direction = direction;
  }

  /**
   * Get the current key.
   */
  getCurrentKey(): Key {
    return this.currentKey;
  }

  /**
   * Get the current direction.
   */
  getDirection(): Direction {
    return this.direction;
  }

  /**
   * Set the direction.
   */
  setDirection(direction: Direction): void {
    this.direction = direction;
  }

  /**
   * Toggle direction between forward and reverse.
   */
  toggleDirection(): void {
    this.direction = this.direction === 'forward' ? 'reverse' : 'forward';
  }

  /**
   * Move to the next key in the current direction.
   *
   * @returns The new current key
   *
   * Example:
   *   keyManager.setDirection('forward');
   *   keyManager.next(); // 1→2
   *   keyManager.next(); // 2→3
   *   keyManager.next(); // ...→12→1 (wraps around)
   */
  next(): Key {
    if (this.direction === 'forward') {
      this.currentKey = (this.currentKey === 12 ? 1 : (this.currentKey + 1)) as Key;
    } else {
      this.currentKey = (this.currentKey === 1 ? 12 : (this.currentKey - 1)) as Key;
    }
    return this.currentKey;
  }

  /**
   * Jump directly to a specific key.
   *
   * @param key - Key to jump to
   *
   * Example:
   *   keyManager.setKey(5);
   *   keyManager.getCurrentKey(); // 5
   */
  setKey(key: Key): void {
    this.currentKey = key;
  }

  /**
   * Preview what the next key would be without changing state.
   *
   * @returns Next key in current direction
   */
  peekNext(): Key {
    if (this.direction === 'forward') {
      return (this.currentKey === 12 ? 1 : (this.currentKey + 1)) as Key;
    } else {
      return (this.currentKey === 1 ? 12 : (this.currentKey - 1)) as Key;
    }
  }

  /**
   * Get harmonic compatibility score between two keys.
   *
   * @param fromKey - Source key
   * @param toKey - Target key
   * @returns Score from 1 (incompatible) to 10 (perfect match)
   *
   * Example:
   *   keyManager.scoreCompatibility(1, 1); // 10 (same key)
   *   keyManager.scoreCompatibility(1, 8); // 9 (very compatible)
   *   keyManager.scoreCompatibility(1, 6); // 1 (tritone, incompatible)
   */
  scoreCompatibility(fromKey: Key, toKey: Key): number {
    return HARMONIC_SCORES[fromKey]![toKey]!;
  }

  /**
   * Score compatibility from current key to another key.
   *
   * @param toKey - Target key to score
   * @returns Score from 1 to 10
   *
   * Example:
   *   keyManager.setKey(1);
   *   keyManager.scoreFromCurrent(8); // 9
   */
  scoreFromCurrent(toKey: Key): number {
    return this.scoreCompatibility(this.currentKey, toKey);
  }

  /**
   * Get all keys sorted by compatibility with a given key.
   *
   * @param fromKey - Key to compare against
   * @returns Keys sorted by score (highest first)
   *
   * Example:
   *   keyManager.getCompatibleKeys(1);
   *   // [1, 8, 12, 2, 9, 3, ...]
   */
  getCompatibleKeys(fromKey: Key): Key[] {
    const keys: Key[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    return keys.sort((a, b) => {
      const scoreA = this.scoreCompatibility(fromKey, a);
      const scoreB = this.scoreCompatibility(fromKey, b);
      return scoreB - scoreA; // Descending order
    });
  }

  /**
   * Get all keys sorted by compatibility with current key.
   *
   * @returns Keys sorted by score (highest first)
   */
  getCompatibleKeysFromCurrent(): Key[] {
    return this.getCompatibleKeys(this.currentKey);
  }

  /**
   * Check if two keys are highly compatible (score >= 8).
   *
   * @param fromKey - Source key
   * @param toKey - Target key
   * @returns True if highly compatible
   */
  isHighlyCompatible(fromKey: Key, toKey: Key): boolean {
    return this.scoreCompatibility(fromKey, toKey) >= 8;
  }

  /**
   * Reset to starting state.
   *
   * @param startKey - Key to reset to (default: 1)
   * @param direction - Direction to reset to (default: 'forward')
   */
  reset(startKey: Key = 1, direction: Direction = 'forward'): void {
    this.currentKey = startKey;
    this.direction = direction;
  }

  /**
   * Get distance between two keys (number of steps).
   *
   * @param fromKey - Source key
   * @param toKey - Target key
   * @param direction - Direction to measure (default: current direction)
   * @returns Number of steps
   *
   * Example:
   *   keyManager.getDistance(1, 3, 'forward'); // 2 (1→2→3)
   *   keyManager.getDistance(3, 1, 'forward'); // 10 (3→4→...→12→1)
   *   keyManager.getDistance(3, 1, 'reverse'); // 2 (3→2→1)
   */
  getDistance(fromKey: Key, toKey: Key, direction?: Direction): number {
    const dir = direction ?? this.direction;

    if (fromKey === toKey) return 0;

    if (dir === 'forward') {
      return toKey > fromKey ? toKey - fromKey : 12 - fromKey + toKey;
    }
    return fromKey > toKey ? fromKey - toKey : 12 - toKey + fromKey;
  }
}
