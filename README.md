# Kwyjibo v2 🎵

> Hamiltonian DJ Player - Infinite quantum-powered mixing

**Kwyjibo** is an intelligent DJ player that continuously mixes songs using a Hamiltonian path algorithm with quantum randomness. It plays two tracks simultaneously (with optional 3rd and 4th tracks in Mannie Fresh Mode) and seamlessly transitions between song pairs, creating an endless mix that explores your entire library.

## What is a Hamiltonian DJ Player?

A Hamiltonian path visits every node in a graph exactly once. In Kwyjibo, each song is a node, and the player finds a path through your entire music library, playing songs in pairs that create perfect continuous mixes. You get:

- **Infinite playback** - Quantum-shuffled Hamiltonian path through all songs
- **Seamless transitions** - Songs play intro and main sections simultaneously
- **Key/tempo progression** - Musical formula: 10 keys at each tempo, then switch tempo
- **Quantum randomness** - True unpredictability using quantum random number generation
- **Mannie Fresh Mode** - Play up to 4 tracks simultaneously for maximum energy

## Features

- 🎲 **Quantum Randomness** - True random shuffle using ANU Quantum Random Numbers Server
- 🎹 **Key Transposition** - Change musical key across 10 positions (1-10)
- 🥁 **BPM Control** - Switch between 84, 94, and 102 BPM
- 🔥 **Mannie Fresh Mode** - Toggle 3rd and 4th tracks for 4-track mashups
- 🔄 **Smart Transitions** - Automatic intro/main section playback
- 📱 **Wake Lock** - Keeps screen awake during performance (pauses when screen locks)
- 🎛️ **Real-time Controls** - All changes apply instantly without interruption
- 🎵 **273 Hip-Hop Instrumentals** - Beat-gridded and key-tagged library

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check

# Run linting
npm run lint
```

## How It Works

### 1. Song Data Structure

Each song has:
- **ID** - Unique identifier
- **Title & Artist** - Metadata
- **Intro & Main tracks** - Two MP3 files for each song (16-beat intro, 64-beat main)
- **Key & Tempo** - Musical properties (Keys 1-10, Tempos 84/94/102 BPM)
- **Duration** - Precise beat counts for perfect transitions

### 2. Quantum Hamiltonian Path

The `HamiltonianPlayer` shuffles all songs using quantum randomness for true unpredictability:
- Initial shuffle uses ANU Quantum Random Numbers Server (quantum vacuum fluctuations)
- Musical key relationships calculated with quantum random choice
- No pseudo-random patterns or predictability

### 3. Playback Engine

- Loads and decodes audio files using Web Audio API
- Plays pairs of songs simultaneously (intro + main sections)
- Each song plays: **Intro (16 beats) → Main (64 beats)** = 80 beats total
- Seamless transitions between pairs with perfect timing
- Gain nodes manage volume for each track independently

### 4. Musical Progression Formula

**Kwyjibo follows a specific progression pattern:**
1. Start at random tempo (84, 94, or 102 BPM)
2. Play 10 pairs, cycling through keys 1→2→3→...→10
3. After 10 keys, switch to next tempo (84→94→102→84→...)
4. Repeat indefinitely

**Example progression:**
- Pairs 1-10: Key 1→10 at 84 BPM
- Pairs 11-20: Key 1→10 at 94 BPM
- Pairs 21-30: Key 1→10 at 102 BPM
- Pairs 31-40: Key 1→10 at 84 BPM (cycle continues)

### 5. Mannie Fresh Mode

Inspired by legendary producer Mannie Fresh's multi-track layering technique:
- **OFF**: 2 tracks playing (standard DJ mix)
- **ON**: 4 tracks playing (2 main + 2 hidden tracks at musically related keys)
- Hidden tracks rotate randomly for unpredictable energy
- Named after the Cash Money Records producer known for complex instrumental layering

## Project Structure

```
src/
├── music/
│   ├── types.ts              # Key, Tempo, Song interfaces
│   └── songdata.ts           # Song database (273 songs)
├── random/
│   └── QuantumRandom.ts      # Quantum RNG using ANU QRNG API
└── index.ts                  # Main exports
demo/
├── player/
│   └── HamiltonianPlayer.ts  # Main playback engine (1500+ lines)
├── App.tsx                    # React UI component
├── config.ts                 # Music base URL configuration
└── styles.css                # UI styling
music/
└── *.mp3                      # Audio files (intro/main tracks)
```

## Usage

### Basic Controls

- **Play** - Start playback (loads first pair)
- **Pause** - Pause playback
- **Stop** - Stop and reset to beginning

### Mixing Controls

- **Key Strip** - Click keys 1-10 to transpose all audio
  - Changes apply immediately to next pair
  - Current key highlighted in cyan
- **BPM Strip** - Click 84, 94, or 102 to change tempo
  - Instantly switches to new tempo
  - Current BPM highlighted in cyan
- **MF Toggle** - Switch Mannie Fresh Mode on/off
  - When ON: 2 additional hidden tracks play at musically related keys
  - Inactive hidden tracks appear dimmed

### Status Display

- **Status Bar** - Current key, BPM, and track section (Intro/Main)
- **Now Playing** - Shows all active tracks with their original keys
  - Track 1 & 2: Always playing
  - Track 3 & 4: Only visible/active in Mannie Fresh Mode
- **Up Next** - Preview of next song pair

## Technical Details

### Audio Processing

- Uses Web Audio API `AudioContext` for sample-accurate playback
- Implements gain nodes for independent track volume control
- Pitch shifting via `playbackRate` property
- Dual-section system (intro/main) for seamless transitions
- Precise scheduling prevents gaps or overlaps

### Quantum Randomness

**Why quantum?**
- Traditional `Math.random()` is pseudo-random (deterministic patterns)
- Linear Congruential Generators (LCG) have predictable cycles
- Quantum randomness uses physical phenomena (quantum vacuum fluctuations)

**Implementation:**
- Uses ANU Quantum Random Numbers Server API
- Fisher-Yates shuffle with true quantum random numbers
- Musical key relationships chosen with quantum random selection
- Provides perfect, flawless randomness for unpredictable mixes

### State Management

- Event-driven architecture with custom `EventEmitter`
- Player state includes: playing status, current key/tempo, track pairs
- React hooks for UI updates
- Wake Lock API integration pauses playback when screen locks

### Progression Algorithm

- Generates cyclic progression: 10 keys × 3 tempos = 30 pairs per cycle
- Maintains separate path indexes for each tempo
- Handles key/tempo changes by regenerating progression from new starting point
- Artist avoidance prevents same artist in consecutive pairs

### Mannie Fresh Mode

- Hidden tracks use musically related keys (perfect 5th, 4th, relative minor, tritone, etc.)
- One hidden track randomly active at a time
- Quantum random selection for unpredictable layering
- Independent gain control per track

## Browser Support

Requires modern browser with:
- Web Audio API
- ES2022+ JavaScript
- Wake Lock API (optional, for screen wake)
- Async/await support

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)

## Song Library

Currently includes **273 hip-hop instrumentals** with both intro and main tracks (546 total MP3 files). Songs span Keys 1-10 and tempos 84, 94, 102 BPM for maximum mixing compatibility.

**Beat structure:**
- Intro: 16 beats (short hook/intro section)
- Main: 64 beats (full instrumental body)
- Total: 80 beats per song

## Development

Built with:
- **TypeScript** - Strict type-safe code
- **React** - UI framework with hooks
- **Vite** - Build tool and dev server
- **Web Audio API** - Audio playback
- **ANU QRNG** - Quantum random number generation

TypeScript configuration:
- Strict mode enabled
- Path aliases for clean imports
- Declaration maps for debugging
- ESNext module system

## Configuration

Edit `demo/config.ts` to change music file location:

```typescript
export const MUSIC_BASE_URL = '/music/'; // relative path
// or
export const MUSIC_BASE_URL = 'https://cdn.example.com/music/'; // CDN
```

Set via environment variable:
```bash
VITE_MUSIC_BASE_URL=https://cdn.example.com/music/ npm run dev
```

## License

MIT

## Credits

Built by dmvjs with love for the DJ community.

Original Kwyjibo: https://github.com/dmvjs/kwyjibo

**Mannie Fresh Mode** - Inspired by Byron "Mannie Fresh" Thomas, legendary Cash Money Records producer known for his innovative multi-track instrumental layering and energetic production style.

**Quantum Randomness** - Powered by the ANU Quantum Random Numbers Server, Australian National University.

---

**Fun fact**: "Kwyjibo" is a word Bart Simpson made up in Scrabble, claiming it means "a big, dumb, balding North American ape with no chin."
