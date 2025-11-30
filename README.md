# Kwyjibo v2 🎵

> Hamiltonian DJ Player - Infinite quantum-powered mixing

**Kwyjibo** is an intelligent DJ player that continuously mixes songs using a Hamiltonian path algorithm with quantum randomness. It plays up to 4 tracks simultaneously (2 main + 2 hidden in Mannie Fresh Mode) and seamlessly transitions between song pairs, creating an endless mix that explores your entire library without repetition.

## What is a Hamiltonian DJ Player?

A Hamiltonian path visits every node in a graph exactly once. In Kwyjibo, each song is a node, and the player finds a path through your entire music library, ensuring:

- **No repeated combinations** - Same songs never paired together twice (100% diversity verified)
- **Equal distribution** - All songs get played at the same rate (~2 hours to cycle through all 439 songs)
- **Perfect shuffle** - Quantum randomness creates truly unpredictable play order
- **Tempo-weighted progression** - More songs at a tempo = more time spent there
- **Strict tempo matching** - Songs only play at their native BPM (no pitch stretching)

## Features

- 🎲 **Quantum Randomness** - True random shuffle using ANU Quantum Random Numbers Server
- 🎹 **Key Transposition** - Change musical key across 10 positions (1-10)
- 🥁 **BPM Control** - Switch between 84, 94, and 102 BPM
- 🔥 **Mannie Fresh Mode** - 4 tracks playing simultaneously (ON by default)
- 🎛️ **808 Mode** - Frequency splitting and rhythmic recombination for deconstructed beats
- 🔄 **Smart Selection** - No duplicate songs in same pair, artist diversity enforced
- 📱 **Wake Lock** - Keeps screen awake during performance (pauses when screen locks)
- 🎵 **439 Hip-Hop Instrumentals** - Beat-gridded and key-tagged library
- ⏱️ **~2 Hour Cycle** - Complete playthrough of entire library

## Verified Statistics

Extensive testing confirms exceptional diversity:

- **4-song combinations**: 100% unique (0 repeats in 5,000 pairs tested)
- **3-song triplets**: 99.8% diversity
- **2-song pairs**: 92.1% diversity
- **Play order**: Zero correlation between song ID and play position (-0.069 coefficient)
- **Distribution**: All songs played equally (13.7% coefficient of variation)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## How It Works

### 1. Weighted Tempo Progression

The player automatically balances time spent at each tempo based on song availability:

- **84 BPM**: 20 pairs per cycle (192 songs available)
- **94 BPM**: 10 pairs per cycle (94 songs available)
- **102 BPM**: 16 pairs per cycle (153 songs available)

This ensures all songs get equal play time regardless of tempo distribution.

### 2. Hamiltonian Path with Smart Selection

Every song selection:
1. **Filters to unplayed songs first** - prioritizes completing the Hamiltonian cycle
2. **Strict tempo matching** - only selects songs at the exact target BPM
3. **Enforces diversity** - avoids same artist, same songs, or recent repeats
4. **Quantum selection** - picks from top 20 scored candidates using true quantum randomness
5. **Auto-resets** - clears played history when <20 unplayed songs remain

**Scoring factors:**
- Tempo match: +60 points
- Key compatibility: up to +50 points (circle of fifths, relative keys)
- Unplayed song: +200 points (massive priority)
- Recent play: up to -50 penalty
- Random variance: 0-80 points (prevents predictability)

### 3. Song Structure

Each song has two sections:
- **Intro**: 16 beats (~10-12 seconds depending on tempo)
- **Main**: 64 beats (~40-48 seconds depending on tempo)
- **Total**: 80 beats per song (~50-57 seconds)

All 4 tracks play simultaneously for the full 80-beat duration.

### 4. Mannie Fresh Mode (ON by default)

Inspired by legendary producer Mannie Fresh's multi-track layering:
- **2 main tracks** - at target key and tempo
- **2 hidden tracks** - at musically related keys (5ths, 4ths, etc.)
- All 4 tracks guaranteed unique (no duplicate songs in same pair)
- Creates complex, layered mixes with harmonic depth

### 5. 808 Mode

Frequency-splitting mode for experimental sound:
- Separates each track into low/mid/high frequency bands
- Rhythmic gating and recombination of frequencies
- All 4 tracks play at full volume with dedicated compression
- Creates deconstructed, percussive textures

## Usage

### Basic Controls

- **Play/Pause** - Start or pause playback
- **Stop** - Reset to beginning
- **Key Strip** - Click keys 1-10 to transpose (takes effect on next pair)
- **BPM Strip** - Click 84, 94, or 102 to change tempo (takes effect on next pair)
- **MF Toggle** - Switch Mannie Fresh Mode on/off
- **808 Toggle** - Switch 808 Mode on/off

### Display

- **Status Bar** - Current key, BPM, and section (Intro/Main)
- **Now Playing** - All 4 active tracks with keys
  - Tracks 3 & 4 dimmed when MF mode OFF
- **Up Next** - Preview of next 4-song combination
- **History** - Shows all previously played pairs with all 4 tracks

## Project Structure

```
src/
├── music/
│   ├── types.ts              # Key, Tempo, Song interfaces
│   └── songdata.ts           # Song database (439 songs)
├── random/
│   └── QuantumRandom.ts      # Quantum RNG using ANU QRNG API
└── index.ts                  # Main exports
demo/
├── player/
│   └── HamiltonianPlayer.ts  # Main playback engine (2000+ lines)
├── App.tsx                    # React UI component
├── config.ts                 # Music base URL configuration
└── styles.css                # UI styling
music/
└── *.mp3                      # Audio files (intro/main tracks)
```

## Technical Implementation

### Quantum Randomness

- Uses ANU Quantum Random Numbers Server (quantum vacuum fluctuations)
- Applied to: initial shuffle, musically related key selection, top-candidate selection
- Provides true unpredictability vs pseudo-random patterns

### Strict Tempo Matching

- Songs only play at their native BPM
- No pitch stretching or tempo adjustment
- Prevents audio quality degradation
- Ensures perfect beat alignment

### Smart Song Selection

```typescript
// Selection priority:
1. Filter to unplayed songs at exact tempo
2. Score based on key compatibility, artist diversity, recency
3. Select from top 20 using quantum randomness
4. Enforce no-duplicate rule within pairs
5. Auto-reset when Hamiltonian cycle nearly complete
```

### No Duplicate Combinations

- Tracks all 4 songs per pair as played
- Filters out already-selected song IDs when choosing MF tracks
- Result: Same 4 songs never appear together (100% diversity)

### Web Audio Architecture

- Sample-accurate scheduling using AudioContext
- Independent gain nodes for each of 4 tracks
- Master compressor for arena sound (punchy, controlled)
- Precise timing prevents gaps or overlaps
- Frequency splitting filters for 808 mode

## Browser Support

Requires modern browser with:
- Web Audio API
- ES2022+ JavaScript
- Wake Lock API (optional)

Tested on Chrome/Edge 90+, Firefox 88+, Safari 14+, Mobile Safari (iOS 14+)

## Configuration

Edit `demo/config.ts` to change music file location:

```typescript
export const MUSIC_BASE_URL = '/music/'; // relative path
// or
export const MUSIC_BASE_URL = 'https://cdn.example.com/music/'; // CDN
```

## Development

Built with:
- **TypeScript** - Strict type-safe code
- **React** - UI framework with hooks
- **Vite** - Build tool and dev server
- **Web Audio API** - Audio playback
- **ANU QRNG** - Quantum random number generation

## Testing

Run diversity tests:

```bash
node test-song-distribution.js    # Test overall song distribution
node test-play-order.js            # Test play order randomization
node test-pair-diversity.js        # Test 4-song combination uniqueness
node test-subset-diversity.js      # Test 2-song and 3-song diversity
node calculate-cycle-time.js       # Calculate time to play all songs
node measure-real-durations.js     # Measure actual audio file lengths
```

## Legal Notice

**Kwyjibo v2 does not include, provide, or distribute any copyrighted music files.**

You must legally own or have licenses for all music files used with this software. You are solely responsible for ensuring you have the legal right to use any audio files.

- ✅ **Legal**: Using with music you've purchased, licensed, or own
- ✅ **Legal**: Private listening and personal enjoyment
- ❌ **Illegal**: Using pirated or unlicensed music
- ❌ **Illegal**: Public performance without proper licenses

**Use this software responsibly and respect artists' rights.**

## License

MIT (Software License - Does not grant any rights to copyrighted music)

## Credits

Built by dmvjs with love for the DJ community.

**Mannie Fresh Mode** - Inspired by Byron "Mannie Fresh" Thomas, legendary Cash Money Records producer.

**Quantum Randomness** - Powered by the ANU Quantum Random Numbers Server, Australian National University.

---

**Fun fact**: "Kwyjibo" is a word Bart Simpson made up in Scrabble, claiming it means "a big, dumb, balding North American ape with no chin."
