/**
 * Audio Buffer Cache
 *
 * Manages loaded audio buffers with memory-conscious features:
 * - LRU eviction when size limits are reached
 * - Manual disposal of buffers
 * - Memory usage tracking
 * - Clear all functionality
 *
 * Why?
 * AudioBuffers can be large (5-10MB each). Loading 273 songs could use 1-2GB.
 * This cache helps manage memory by evicting old buffers when needed.
 */

import type { LoadResult } from './types.js';

/**
 * Options for the cache.
 */
export interface CacheOptions {
  /** Maximum number of buffers to keep in cache. Default: 50 */
  maxSize?: number;

  /** Maximum memory in bytes (approximate). Default: 100MB */
  maxMemoryBytes?: number;
}

/**
 * Cache entry with metadata for LRU eviction.
 */
interface CacheEntry {
  result: LoadResult;
  lastAccessed: number;
  sizeBytes: number;
}

/**
 * Audio buffer cache with LRU eviction.
 *
 * Example:
 *   const cache = new AudioBufferCache({ maxSize: 50 });
 *   cache.set('kick', result);
 *   const cached = cache.get('kick');
 *   cache.dispose(); // Clean up when done
 */
export class AudioBufferCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly maxMemoryBytes: number;
  private currentMemoryBytes = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 50;
    this.maxMemoryBytes = options.maxMemoryBytes ?? 100 * 1024 * 1024; // 100MB
  }

  /**
   * Add a buffer to the cache.
   * Automatically evicts old entries if limits are exceeded.
   *
   * @param id - Unique identifier for this buffer
   * @param result - The loaded audio result
   */
  set(id: string, result: LoadResult): void {
    const sizeBytes = this.estimateBufferSize(result.buffer);

    // Update if already exists
    const existing = this.cache.get(id);
    if (existing) {
      this.currentMemoryBytes -= existing.sizeBytes;
    }

    // Add to cache
    this.cache.set(id, {
      result,
      lastAccessed: Date.now(),
      sizeBytes,
    });
    this.currentMemoryBytes += sizeBytes;

    // Evict if needed
    this.evictIfNeeded();
  }

  /**
   * Get a buffer from the cache.
   * Updates last accessed time for LRU.
   *
   * @param id - The buffer identifier
   * @returns The cached result, or undefined if not found
   */
  get(id: string): LoadResult | undefined {
    const entry = this.cache.get(id);
    if (!entry) {
      return undefined;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    return entry.result;
  }

  /**
   * Check if a buffer exists in cache.
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Remove a specific buffer from cache.
   *
   * @param id - The buffer identifier
   * @returns True if removed, false if not found
   */
  delete(id: string): boolean {
    const entry = this.cache.get(id);
    if (!entry) {
      return false;
    }

    this.currentMemoryBytes -= entry.sizeBytes;
    return this.cache.delete(id);
  }

  /**
   * Clear all buffers from cache.
   * Call this when you're done to free memory.
   */
  clear(): void {
    this.cache.clear();
    this.currentMemoryBytes = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    memoryBytes: number;
    memoryMB: number;
    maxSize: number;
    maxMemoryBytes: number;
    maxMemoryMB: number;
  } {
    return {
      size: this.cache.size,
      memoryBytes: this.currentMemoryBytes,
      memoryMB: Math.round(this.currentMemoryBytes / 1024 / 1024),
      maxSize: this.maxSize,
      maxMemoryBytes: this.maxMemoryBytes,
      maxMemoryMB: Math.round(this.maxMemoryBytes / 1024 / 1024),
    };
  }

  /**
   * Evict old entries if cache limits are exceeded.
   * Uses LRU (Least Recently Used) strategy.
   */
  private evictIfNeeded(): void {
    // Evict by count
    while (this.cache.size > this.maxSize) {
      this.evictOldest();
    }

    // Evict by memory
    while (this.currentMemoryBytes > this.maxMemoryBytes && this.cache.size > 0) {
      this.evictOldest();
    }
  }

  /**
   * Evict the least recently used entry.
   */
  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    // Find the oldest entry
    for (const [id, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.delete(oldestId);
    }
  }

  /**
   * Estimate the memory size of an AudioBuffer.
   * Formula: channels × length × 4 bytes per float32 sample
   *
   * @param buffer - The audio buffer
   * @returns Estimated size in bytes
   */
  private estimateBufferSize(buffer: AudioBuffer): number {
    return buffer.numberOfChannels * buffer.length * 4;
  }

  /**
   * Dispose of the cache and free resources.
   * Call this when you're completely done with audio.
   */
  dispose(): void {
    this.clear();
  }
}
