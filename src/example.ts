/**
 * Kwyjibo v2 - Usage Example
 *
 * This file demonstrates how to use the audio buffer loading system.
 * Run this to see the system in action!
 *
 * To run:
 *   npm run dev
 */

import { createAudioLoader, NetworkError, TimeoutError, DecodeError } from './audio/index.js';

/**
 * Example 1: Basic loading
 */
async function basicExample(): Promise<void> {
  console.log('\n=== Example 1: Basic Loading ===\n');

  const loader = createAudioLoader();

  try {
    const result = await loader.loadSingle({
      id: 'example-song',
      url: '/audio/song.mp3',
    });

    console.log('✓ Loaded:', result.id);
    console.log('  Duration:', result.buffer.duration, 'seconds');
    console.log('  Load time:', result.loadTimeMs, 'ms');
  } catch (error) {
    console.error('✗ Failed to load:', error);
  }
}

/**
 * Example 2: Loading multiple files with progress
 */
async function progressExample(): Promise<void> {
  console.log('\n=== Example 2: Progress Tracking ===\n');

  const loader = createAudioLoader();

  // Subscribe to progress events
  loader.on('progress', (progress: any) => {
    console.log(`Progress: ${progress.percentage}% (${progress.loaded}/${progress.total})`);
    if (progress.current) {
      console.log(`  Currently loading: ${progress.current}`);
    }
  });

  // Track individual files
  loader.on('fileLoaded', (result: any) => {
    console.log(`  ✓ ${result.id} loaded in ${result.loadTimeMs}ms`);
  });

  loader.on('fileFailed', (failure: any) => {
    console.error(`  ✗ ${failure.id} failed after ${failure.attempts} attempts`);
  });

  try {
    const results = await loader.load([
      { id: 'kick', url: '/audio/drums/kick.mp3' },
      { id: 'snare', url: '/audio/drums/snare.mp3' },
      { id: 'hihat', url: '/audio/drums/hihat.mp3' },
      { id: 'bass', url: '/audio/bass/bass.mp3' },
    ]);

    console.log(`\n✓ Successfully loaded ${results.length} files`);
  } catch (error) {
    console.error('\n✗ Loading failed:', error);
  }
}

/**
 * Example 3: Loading with metadata
 */
async function metadataExample(): Promise<void> {
  console.log('\n=== Example 3: With Metadata ===\n');

  const loader = createAudioLoader();

  const results = await loader.load([
    {
      id: 'song1',
      url: '/audio/song1.mp3',
      metadata: {
        artist: '2Pac',
        title: 'California Love',
        bpm: 94,
        key: 2,
      },
    },
    {
      id: 'song2',
      url: '/audio/song2.mp3',
      metadata: {
        artist: 'Snoop Dogg',
        title: "What's My Name",
        bpm: 94,
        key: 10,
      },
    },
  ]);

  results.forEach((result: any) => {
    const meta = result.metadata as { artist: string; title: string; bpm: number; key: number };
    console.log(`${meta.artist} - ${meta.title}`);
    console.log(`  BPM: ${meta.bpm}, Key: ${meta.key}`);
    console.log(`  Duration: ${result.buffer.duration.toFixed(2)}s`);
  });
}

/**
 * Example 4: Error handling
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Example 4: Error Handling ===\n');

  const loader = createAudioLoader();

  try {
    await loader.loadSingle({
      id: 'missing-file',
      url: '/audio/does-not-exist.mp3',
      retries: 2,
    });
  } catch (error) {
    if (error instanceof NetworkError) {
      console.log('Network error detected:');
      console.log(`  URL: ${error.url}`);
      console.log(`  Status: ${error.status}`);
      console.log(`  Message: ${error.message}`);
    } else if (error instanceof TimeoutError) {
      console.log('Timeout error detected:');
      console.log(`  URL: ${error.url}`);
      console.log(`  Timeout: ${error.timeoutMs}ms`);
    } else if (error instanceof DecodeError) {
      console.log('Decode error detected:');
      console.log(`  URL: ${error.url}`);
      console.log(`  Message: ${error.message}`);
    } else {
      console.log('Unknown error:', error);
    }
  }
}

/**
 * Example 5: Custom configuration
 */
async function configExample(): Promise<void> {
  console.log('\n=== Example 5: Custom Configuration ===\n');

  createAudioLoader({
    maxConcurrent: 10, // Load 10 files at once
    defaultTimeout: 15000, // 15 second timeout
    defaultRetries: 5, // Retry 5 times
    retryDelay: 2000, // 2 second base delay
  });

  console.log('Loader configured with:');
  console.log('  - Max concurrent: 10');
  console.log('  - Default timeout: 15000ms');
  console.log('  - Default retries: 5');
  console.log('  - Retry delay: 2000ms');

  // Use the configured loader...
}

/**
 * Example 6: Cancellation
 */
async function cancellationExample(): Promise<void> {
  console.log('\n=== Example 6: Cancellation ===\n');

  const loader = createAudioLoader();

  // Start loading many files
  const promise = loader.load([
    { id: 'file1', url: '/audio/file1.mp3' },
    { id: 'file2', url: '/audio/file2.mp3' },
    { id: 'file3', url: '/audio/file3.mp3' },
    // ... many more files
  ]);

  // Cancel after 1 second
  setTimeout(() => {
    console.log('Cancelling...');
    loader.cancel();
  }, 1000);

  try {
    await promise;
  } catch (error) {
    console.log('Loading was cancelled (expected)');
  }
}

/**
 * Example 7: Playing loaded audio
 */
async function playingExample(): Promise<void> {
  console.log('\n=== Example 7: Playing Audio ===\n');

  const loader = createAudioLoader();

  try {
    const result = await loader.loadSingle({
      id: 'sample',
      url: '/audio/sample.mp3',
    });

    console.log('✓ Audio loaded, ready to play');
    console.log('\nTo play this audio:');
    console.log('```javascript');
    console.log('const source = audioContext.createBufferSource();');
    console.log('source.buffer = result.buffer;');
    console.log('source.connect(audioContext.destination);');
    console.log('source.start();');
    console.log('```');

    // Example: Create an audio graph
    const audioContext = new AudioContext();
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = result.buffer;
    gainNode.gain.value = 0.5; // 50% volume

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    console.log('\nAudio graph created:');
    console.log('  Source → Gain (50%) → Destination');
    console.log('\nCall source.start() to play!');
  } catch (error) {
    console.error('Failed to load audio:', error);
  }
}

/**
 * Run all examples
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Kwyjibo v2 - Usage Examples         ║');
  console.log('╚════════════════════════════════════════╝');

  // Note: These examples assume audio files exist at the specified paths
  // In a real app, you'd replace these with actual file URLs

  await basicExample();
  await progressExample();
  await metadataExample();
  await errorHandlingExample();
  await configExample();
  await cancellationExample();
  await playingExample();

  console.log('\n✨ All examples complete!\n');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
