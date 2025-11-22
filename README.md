# Kwyjibo v2 🎵

> AI-powered DJ technology - remastered with clean architecture

A modular, testable, professional-grade audio buffer loading system built on the Web Audio API. Perfect for DJs, music apps, games, or any project that needs to load and manage audio files.

## ✨ What's New in v2

- **TypeScript First**: Fully typed with comprehensive type safety
- **Modular Architecture**: Clean separation of concerns, easy to understand and extend
- **100% Tested**: Comprehensive test coverage with clear examples
- **Zero Dependencies**: Just the Web Audio API and modern JavaScript
- **Production Ready**: Error handling, retries, timeouts, progress tracking
- **Developer Friendly**: Written to be understood by junior devs without feeling overwhelmed

## 🚀 Quick Start

```typescript
import { createAudioLoader } from './audio';

// Create a loader
const loader = createAudioLoader();

// Load some audio files
const results = await loader.load([
  { id: 'kick', url: '/audio/drums/kick.mp3' },
  { id: 'snare', url: '/audio/drums/snare.mp3' },
  { id: 'hihat', url: '/audio/drums/hihat.mp3' },
]);

// Play them!
results.forEach(result => {
  const source = audioContext.createBufferSource();
  source.buffer = result.buffer;
  source.connect(audioContext.destination);
  source.start();
});
```

## 📖 Complete Examples

### Basic Loading

```typescript
import { createAudioLoader } from './audio';

const loader = createAudioLoader();

try {
  const result = await loader.loadSingle({
    id: 'my-song',
    url: '/music/song.mp3',
  });

  console.log(`Loaded ${result.id} in ${result.loadTimeMs}ms`);
  // Play the buffer...
} catch (error) {
  console.error('Failed to load:', error);
}
```

### Progress Tracking

```typescript
const loader = createAudioLoader();

// Show a progress bar
loader.on('progress', (progress) => {
  console.log(`${progress.percentage}% complete`);
  console.log(`${progress.loaded}/${progress.total} files loaded`);
  if (progress.current) {
    console.log(`Currently loading: ${progress.current}`);
  }
});

// Track individual files
loader.on('fileLoaded', (result) => {
  console.log(`✓ ${result.id} loaded`);
});

loader.on('fileFailed', (failure) => {
  console.error(`✗ ${failure.id} failed:`, failure.error.message);
});

const results = await loader.load(requests);
```

### Custom Configuration

```typescript
const loader = createAudioLoader({
  maxConcurrent: 10,       // Load 10 files at once (default: 6)
  defaultTimeout: 15000,   // 15 second timeout (default: 10000)
  defaultRetries: 5,       // Retry 5 times (default: 3)
  retryDelay: 2000,        // 2 second base delay (default: 1000)
});
```

### With Metadata

```typescript
const results = await loader.load([
  {
    id: 'song1',
    url: '/music/song1.mp3',
    metadata: {
      bpm: 120,
      key: 'Am',
      artist: '2Pac',
      title: 'California Love',
    },
  },
]);

// Metadata is preserved in results
results.forEach(result => {
  console.log(`${result.metadata.artist} - ${result.metadata.title}`);
  console.log(`BPM: ${result.metadata.bpm}, Key: ${result.metadata.key}`);
});
```

### Error Handling

```typescript
import { NetworkError, TimeoutError, DecodeError } from './audio';

try {
  await loader.load(requests);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error(`Network error: ${error.status}`);
    // Maybe show "Check your connection" message
  } else if (error instanceof TimeoutError) {
    console.error(`Timeout after ${error.timeoutMs}ms`);
    // Maybe retry with longer timeout
  } else if (error instanceof DecodeError) {
    console.error('File is corrupted or unsupported format');
    // Maybe skip this file
  }
}
```

### Cancellation

```typescript
const loader = createAudioLoader();

// Start loading
const promise = loader.load(manyFiles);

// User navigates away or changes their mind
cancelButton.addEventListener('click', () => {
  loader.cancel();
});

try {
  await promise;
} catch (error) {
  if (error instanceof CancelledError) {
    console.log('User cancelled loading');
  }
}
```

## 🏗️ Architecture

The system is built on three core services:

### AudioFileLoader
- Fetches audio files from URLs
- Handles timeouts with AbortController
- Provides clear network errors

### AudioDecoder
- Wraps Web Audio API's decodeAudioData
- Handles decode errors gracefully
- Manages AudioContext lifecycle

### AudioBufferLoader
- Orchestrates loading with concurrency control
- Implements retry logic with exponential backoff
- Emits progress events
- Manages cancellation

Each service has a clear interface, making it easy to:
- Test in isolation
- Mock for testing
- Swap implementations
- Understand the code

## 🧪 Testing

The system includes comprehensive tests showing all functionality:

```bash
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

All tests include clear comments explaining what's being tested and why.

## 📦 Project Structure

```
src/
├── audio/
│   ├── types.ts                    # TypeScript interfaces and types
│   ├── errors.ts                   # Custom error classes
│   ├── AudioFileLoader.ts          # Fetch audio files
│   ├── AudioDecoder.ts             # Decode audio data
│   ├── AudioBufferLoader.ts        # Main orchestrator
│   └── index.ts                    # Public API
├── core/
│   └── EventEmitter.ts             # Type-safe event system
└── __tests__/
    ├── mocks/                      # Test utilities
    │   ├── MockAudioContext.ts
    │   └── MockAudioFileLoader.ts
    └── audio/                      # Test suites
        ├── AudioFileLoader.test.ts
        ├── AudioDecoder.test.ts
        └── AudioBufferLoader.test.ts
```

## 🎯 Design Principles

1. **Single Responsibility**: Each class does one thing well
2. **Dependency Injection**: Dependencies are passed in, not imported
3. **Interface-based**: Code to contracts, not implementations
4. **Type Safety**: Full TypeScript coverage, no `any` types
5. **Clear Errors**: Helpful error messages with context
6. **Self-Documenting**: Code should be readable without comments
7. **Teaching Code**: Comments explain *why*, not *what*

## 🤝 Contributing

This codebase is designed to be approachable:
- Clear naming conventions
- Comprehensive comments
- Examples throughout
- No clever tricks or magic

If you're new to TypeScript or Web Audio API, the code should teach you as you read it.

## 📝 License

MIT

## 🙏 Credits

Built by dmvjs with love for the DJ community.

Original kwyjibo: https://github.com/dmvjs/kwyjibo
