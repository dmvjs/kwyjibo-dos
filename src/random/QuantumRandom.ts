/**
 * Quantum Random Number Generator
 *
 * Uses quantum-generated random data from an external API with intelligent caching
 * and cryptographic fallback. This provides true randomness (not pseudo-random)
 * for song selection, making each kwyjibo mix genuinely unique and unpredictable.
 *
 * Features:
 * - Quantum random API integration
 * - Smart caching with localStorage
 * - Automatic refill when cache runs low
 * - Cryptographic fallback when API unavailable
 * - Multiple random methods (integer, float, choice, shuffle)
 *
 * Why quantum?
 * "DJing is really fun but 'not DJing' is even more fun" - dmvjs
 * Quantum randomness creates unexpected, emotionally-resonant mixes.
 */

/**
 * Options for QuantumRandom initialization.
 */
export interface QuantumRandomOptions {
  /** API endpoint for quantum random data. Default: 'https://api.shitchell.com/qrng' */
  apiUrl?: string;

  /** Cache size in characters. Default: 2048 */
  cacheSize?: number;

  /** Refill cache when below this percentage. Default: 0.25 (25%) */
  refillThreshold?: number;

  /** Enable localStorage caching. Default: true */
  useLocalStorage?: boolean;

  /** Timeout for API requests (ms). Default: 5000 */
  apiTimeout?: number;
}

/**
 * Storage interface for caching random data.
 * Allows mocking localStorage in tests.
 */
export interface RandomStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Default storage using localStorage (browser).
 */
class LocalStorageAdapter implements RandomStorage {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  }
}

/**
 * Quantum Random Number Generator.
 *
 * Example:
 *   const qrng = new QuantumRandom();
 *   const random = await qrng.getInteger(1, 10); // 1-10
 *   const choice = await qrng.getChoice(['a', 'b', 'c']); // 'a', 'b', or 'c'
 */
export class QuantumRandom {
  private readonly apiUrl: string;
  private readonly cacheSize: number;
  private readonly refillThreshold: number;
  private readonly apiTimeout: number;
  private readonly storage: RandomStorage | null;

  private cache: string = '';
  private isRefilling: boolean = false;

  constructor(options: QuantumRandomOptions = {}) {
    this.apiUrl = options.apiUrl ?? 'https://api.shitchell.com/qrng';
    this.cacheSize = options.cacheSize ?? 2048;
    this.refillThreshold = options.refillThreshold ?? 0.25;
    this.apiTimeout = options.apiTimeout ?? 5000;

    // Set up storage (localStorage or null)
    if (options.useLocalStorage !== false && typeof localStorage !== 'undefined') {
      this.storage = new LocalStorageAdapter();
      this.loadCacheFromStorage();
    } else {
      this.storage = null;
    }

    // Start with initial fill
    this.refillIfNeeded();
  }

  /**
   * Get a random integer between min and max (inclusive).
   *
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns Random integer in range [min, max]
   *
   * Example:
   *   await qrng.getInteger(1, 6); // Dice roll: 1-6
   */
  async getInteger(min: number, max: number): Promise<number> {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('min and max must be integers');
    }
    if (min > max) {
      throw new Error('min must be <= max');
    }

    const range = max - min + 1;
    const randomFloat = await this.getFloat();
    return Math.floor(randomFloat * range) + min;
  }

  /**
   * Get a random float between 0 (inclusive) and 1 (exclusive).
   *
   * @returns Random float in range [0, 1)
   *
   * Example:
   *   await qrng.getFloat(); // 0.724891...
   */
  async getFloat(): Promise<number> {
    // Get 16 hex characters (64 bits) for high precision
    const hex = await this.getHexadecimal(16);

    // Convert to number between 0 and 1
    const value = parseInt(hex, 16);
    const max = Math.pow(16, 16);
    return value / max;
  }

  /**
   * Get random hexadecimal string of specified length.
   *
   * @param length - Number of hex characters
   * @returns Hex string
   *
   * Example:
   *   await qrng.getHexadecimal(8); // 'a4f8b2c1'
   */
  async getHexadecimal(length: number): Promise<string> {
    if (length <= 0) {
      throw new Error('length must be positive');
    }

    this.ensureCacheSize(length);

    // Take from cache
    const hex = this.cache.slice(0, length);
    this.cache = this.cache.slice(length);

    // Save cache state
    this.saveCacheToStorage();

    // Refill if needed (async, don't wait)
    this.refillIfNeeded();

    return hex;
  }

  /**
   * Get a random element from an array.
   *
   * @param array - Array to choose from
   * @returns Random element
   *
   * Example:
   *   await qrng.getChoice(['rock', 'paper', 'scissors']); // 'paper'
   */
  async getChoice<T>(array: readonly T[]): Promise<T> {
    if (array.length === 0) {
      throw new Error('array must not be empty');
    }

    const index = await this.getInteger(0, array.length - 1);
    const item = array[index];
    if (item === undefined) {
      throw new Error('Failed to get choice');
    }
    return item;
  }

  /**
   * Get multiple unique random elements from an array.
   *
   * @param array - Array to choose from
   * @param count - Number of elements to choose
   * @returns Array of unique random elements
   *
   * Example:
   *   await qrng.getUniqueChoices([1,2,3,4,5], 3); // [2, 5, 1]
   */
  async getUniqueChoices<T>(array: readonly T[], count: number): Promise<T[]> {
    if (count > array.length) {
      throw new Error('count must be <= array.length');
    }
    if (count < 0) {
      throw new Error('count must be >= 0');
    }

    const shuffled = await this.shuffle([...array]);
    return shuffled.slice(0, count);
  }

  /**
   * Shuffle an array using quantum randomness (Fisher-Yates algorithm).
   *
   * @param array - Array to shuffle (creates a copy)
   * @returns Shuffled array
   *
   * Example:
   *   await qrng.shuffle([1, 2, 3, 4, 5]); // [3, 1, 5, 2, 4]
   */
  async shuffle<T>(array: readonly T[]): Promise<T[]> {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = await this.getInteger(0, i);
      // Swap elements
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }

    return result;
  }

  /**
   * Get a random boolean.
   *
   * @returns true or false
   *
   * Example:
   *   await qrng.getBoolean(); // true
   */
  async getBoolean(): Promise<boolean> {
    const value = await this.getFloat();
    return value < 0.5;
  }

  /**
   * Get current cache statistics.
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    percentage: number;
    isRefilling: boolean;
  } {
    return {
      size: this.cache.length,
      maxSize: this.cacheSize,
      percentage: (this.cache.length / this.cacheSize) * 100,
      isRefilling: this.isRefilling,
    };
  }

  /**
   * Clear the cache (both memory and storage).
   */
  clearCache(): void {
    this.cache = '';
    this.storage?.removeItem('qrng-cache');
  }

  /**
   * Ensure cache has at least the specified size.
   * If not, use crypto fallback for immediate needs.
   */
  private ensureCacheSize(needed: number): void {
    if (this.cache.length >= needed) {
      return;
    }

    // Not enough in cache - use crypto fallback
    const additional = needed - this.cache.length;
    this.cache += this.getCryptoHex(additional);
  }

  /**
   * Refill cache if below threshold.
   */
  private refillIfNeeded(): void {
    const threshold = this.cacheSize * this.refillThreshold;

    if (this.cache.length < threshold && !this.isRefilling) {
      this.refillCache().catch((error) => {
        console.warn('Failed to refill quantum cache:', error);
      });
    }
  }

  /**
   * Refill the cache from quantum API.
   */
  private async refillCache(): Promise<void> {
    if (this.isRefilling) return;

    this.isRefilling = true;

    try {
      // Calculate how much we need
      const needed = this.cacheSize - this.cache.length;
      if (needed <= 0) return;

      // Fetch from API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

      try {
        const response = await fetch(`${this.apiUrl}?length=${needed}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = (await response.json()) as { data?: string };
        if (typeof data.data === 'string') {
          this.cache += data.data;
          this.saveCacheToStorage();
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Fallback to crypto if quantum API fails
      console.warn('Quantum API unavailable, using crypto fallback');
      const needed = this.cacheSize - this.cache.length;
      this.cache += this.getCryptoHex(needed);
      this.saveCacheToStorage();
    } finally {
      this.isRefilling = false;
    }
  }

  /**
   * Get cryptographic random hex (fallback).
   */
  private getCryptoHex(length: number): string {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);

    let hex = '';
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, '0');
    }

    return hex.slice(0, length);
  }

  /**
   * Load cache from localStorage.
   */
  private loadCacheFromStorage(): void {
    const stored = this.storage?.getItem('qrng-cache');
    if (stored) {
      this.cache = stored.slice(0, this.cacheSize);
    }
  }

  /**
   * Save cache to localStorage.
   */
  private saveCacheToStorage(): void {
    if (this.storage && this.cache.length > 0) {
      this.storage.setItem('qrng-cache', this.cache);
    }
  }
}

/**
 * Create a singleton instance for convenience.
 * Most apps only need one QRNG instance.
 */
let defaultInstance: QuantumRandom | null = null;

export function getQuantumRandom(options?: QuantumRandomOptions): QuantumRandom {
  if (!defaultInstance) {
    defaultInstance = new QuantumRandom(options);
  }
  return defaultInstance;
}

/**
 * Reset the default instance (useful for testing).
 */
export function resetQuantumRandom(): void {
  defaultInstance = null;
}
