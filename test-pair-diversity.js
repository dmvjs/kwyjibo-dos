/**
 * Test if 4-song combinations have good variety (not always same pairs)
 */

import { songdata } from './songdata.js';

const ALL_TEMPOS = [84, 94, 102];

// Simulate the scoring algorithm
function scoreSong(song, tempo, key, playedSongIds, recentSongs, avoidSongIds = [], partnerSong = null, avoidArtists = []) {
  let score = 100;

  // Tempo compatibility - strict matching
  if (song.bpm === tempo) {
    score += 60;
  } else {
    return -1000;
  }

  // Key compatibility
  if (song.key === key) {
    score += 50;
  } else {
    const keyDiff = Math.abs(song.key - key);
    const circularDiff = Math.min(keyDiff, 12 - keyDiff);

    if (circularDiff === 0) score += 50;
    else if (circularDiff === 5 || circularDiff === 7) score += 30;
    else if (circularDiff === 3 || circularDiff === 4) score += 20;
    else if (circularDiff === 2) score += 10;
    else score -= circularDiff * 5;
  }

  // Avoid specific song IDs
  if (avoidSongIds.includes(song.id)) {
    return -1000;
  }

  // Artist diversity
  for (const avoidArtist of avoidArtists) {
    if (song.artist.toLowerCase() === avoidArtist.toLowerCase()) {
      score -= 80;
    }
  }

  // Partner song checks
  if (partnerSong) {
    if (song.artist.toLowerCase() === partnerSong.artist.toLowerCase()) {
      return -1000;
    }
    score += 30;
  }

  // Recency penalty
  const recentIndex = recentSongs.findIndex(s => s.id === song.id);
  if (recentIndex !== -1) {
    const recencyPenalty = Math.max(0, 50 - recentIndex * 2);
    score -= recencyPenalty;
  }

  // MASSIVE bonus for unplayed songs
  if (!playedSongIds.has(song.id)) {
    score += 200;
  }

  // Random variance (0-80)
  const randomVariance = Math.random() * 80;
  score += randomVariance;

  return score;
}

// Simulate song selection
function selectNextSong(tempo, key, songs, playedSongIds, recentSongs, avoidArtists = [], avoidSongIds = []) {
  const unplayedSongs = songs.filter(song => !playedSongIds.has(song.id) && !avoidSongIds.includes(song.id));
  const unplayedAtTempo = unplayedSongs.filter(song => song.bpm === tempo);
  const allSongsAtTempo = songs.filter(song => song.bpm === tempo && !avoidSongIds.includes(song.id));

  let candidates = unplayedAtTempo.length > 0 ? unplayedAtTempo : allSongsAtTempo;

  const scored = candidates
    .map(song => ({
      song,
      score: scoreSong(song, tempo, key, playedSongIds, recentSongs, avoidSongIds, null, avoidArtists)
    }))
    .filter(item => item.score > -1000)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return null;
  }

  const topCandidates = scored.slice(0, Math.min(20, scored.length));
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return selected.song;
}

// Calculate weighted pair counts
function calculateWeightedPairCounts() {
  const songCountsByTempo = new Map();
  for (const tempo of ALL_TEMPOS) {
    const count = songdata.filter(s => s.bpm === tempo).length;
    songCountsByTempo.set(tempo, count);
  }

  const minSongCount = Math.min(...Array.from(songCountsByTempo.values()));
  const basePairCount = 10;
  const tempoPairCounts = new Map();

  for (const tempo of ALL_TEMPOS) {
    const songCount = songCountsByTempo.get(tempo);
    const pairCount = Math.round(basePairCount * (songCount / minSongCount));
    tempoPairCounts.set(tempo, pairCount);
  }

  return tempoPairCounts;
}

// Generate weighted progression
function generateWeightedProgression(tempoPairCounts, length) {
  const progression = [];
  const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  while (progression.length < length) {
    for (const tempo of ALL_TEMPOS) {
      const pairCount = tempoPairCounts.get(tempo);
      for (let i = 0; i < pairCount && progression.length < length; i++) {
        const key = KEYS[i % KEYS.length];
        progression.push({ tempo, key });
      }
    }
  }

  return progression;
}

// Create a unique ID for a 4-song combination
function getPairId(song1, song2, song3, song4) {
  const ids = [song1.id, song2.id, song3.id, song4.id].sort((a, b) => a - b);
  return ids.join('-');
}

// Test pair diversity
function testPairDiversity(numPairs = 500, printDetails = true) {
  if (printDetails) {
    console.log('\n🎲 TESTING 4-SONG PAIR DIVERSITY\n');
  }

  const playedSongIds = new Set();
  const recentSongs = [];
  const recentArtists = [];
  const pairCombinations = new Map(); // Track which 4-song combos appear

  const tempoPairCounts = calculateWeightedPairCounts();
  const progression = generateWeightedProgression(tempoPairCounts, numPairs);

  if (printDetails) {
    console.log(`Generating ${numPairs} pairs (${numPairs * 4} song selections)...\n`);
  }

  // Simulate pair generation
  for (let i = 0; i < numPairs; i++) {
    const { tempo, key } = progression[i];

    // Select 4 songs for the pair (2 main + 2 MF)
    const song1 = selectNextSong(tempo, key, songdata, playedSongIds, recentSongs, recentArtists.slice(0, 10), []);
    if (!song1) continue;

    const song2 = selectNextSong(tempo, key, songdata, playedSongIds, recentSongs, [...recentArtists.slice(0, 10), song1.artist], [song1.id]);
    if (!song2) continue;

    // MF tracks with related keys
    const relatedKey3 = ((key - 1 + 5) % 12) + 1; // Simple related key calculation
    const relatedKey4 = ((key - 1 + 7) % 12) + 1;

    const song3 = selectNextSong(tempo, relatedKey3, songdata, playedSongIds, recentSongs, [song1.artist, song2.artist], [song1.id, song2.id]);
    if (!song3) continue;

    const song4 = selectNextSong(tempo, relatedKey4, songdata, playedSongIds, recentSongs, [song1.artist, song2.artist, song3.artist], [song1.id, song2.id, song3.id]);
    if (!song4) continue;

    // Track this 4-song combination
    const pairId = getPairId(song1, song2, song3, song4);

    if (!pairCombinations.has(pairId)) {
      pairCombinations.set(pairId, {
        songs: [song1, song2, song3, song4],
        count: 0,
        positions: []
      });
    }

    const combo = pairCombinations.get(pairId);
    combo.count++;
    combo.positions.push(i);

    // Update tracking
    playedSongIds.add(song1.id);
    playedSongIds.add(song2.id);
    playedSongIds.add(song3.id);
    playedSongIds.add(song4.id);

    recentSongs.unshift(song1, song2, song3, song4);
    if (recentSongs.length > 50) recentSongs.length = 50;

    recentArtists.unshift(song1.artist, song2.artist, song3.artist, song4.artist);
    if (recentArtists.length > 30) recentArtists.length = 30;

    // Auto-reset
    const unplayedCount = songdata.length - playedSongIds.size;
    if (unplayedCount < 20 && playedSongIds.size > 0) {
      playedSongIds.clear();
    }
  }

  // Analyze diversity
  const totalPairs = numPairs;
  const uniqueCombinations = pairCombinations.size;
  const repeatedCombinations = Array.from(pairCombinations.values()).filter(c => c.count > 1);
  const maxRepeats = pairCombinations.size > 0 ? Math.max(...Array.from(pairCombinations.values()).map(c => c.count)) : 0;
  const diversityRatio = uniqueCombinations / totalPairs;

  if (printDetails) {
    console.log('📊 PAIR DIVERSITY RESULTS:\n');
    console.log(`  Total pairs generated: ${totalPairs}`);
    console.log(`  Unique 4-song combinations: ${uniqueCombinations}`);
    console.log(`  Diversity ratio: ${(diversityRatio * 100).toFixed(1)}%`);
    console.log(`  (100% = every pair is unique, 0% = all same)\n`);

    console.log(`  Repeated combinations: ${repeatedCombinations.length}`);
    console.log(`  Max times any combo repeated: ${maxRepeats}x`);
    console.log('');

    // Interpret results
    if (diversityRatio > 0.95) {
      console.log('  ✅ EXCELLENT: Almost every pair is unique!');
      console.log('  Virtually no repeated 4-song combinations.');
    } else if (diversityRatio > 0.80) {
      console.log('  ✓ VERY GOOD: Most pairs are unique.');
      console.log('  Minimal repetition of combinations.');
    } else if (diversityRatio > 0.60) {
      console.log('  ✓ GOOD: Good variety in combinations.');
      console.log('  Some repetition but generally diverse.');
    } else if (diversityRatio > 0.40) {
      console.log('  ⚠️  MODERATE: Noticeable repetition.');
      console.log('  Some combinations appearing multiple times.');
    } else {
      console.log('  ❌ POOR: High repetition of combinations.');
      console.log('  Same 4-song sets appearing frequently.');
    }
    console.log('');
  }

  if (printDetails) {
    // Show most repeated combinations
    if (repeatedCombinations.length > 0) {
      const mostRepeated = repeatedCombinations
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      console.log('🔁 Most Repeated Combinations:\n');
      for (let i = 0; i < Math.min(5, mostRepeated.length); i++) {
        const combo = mostRepeated[i];
        console.log(`  ${i + 1}. Appeared ${combo.count}x (positions: ${combo.positions.join(', ')})`);
        for (let j = 0; j < combo.songs.length; j++) {
          const song = combo.songs[j];
          console.log(`     ${j + 1}. ${song.artist} - ${song.title}`);
        }
        console.log('');
      }
    } else {
      console.log('  ✨ No repeated combinations found!\n');
    }

    // Sample some unique combinations
    const samples = Array.from(pairCombinations.values())
      .filter(c => c.count === 1)
      .slice(0, 3);

    console.log('📝 Sample Unique Combinations:\n');
    for (let i = 0; i < samples.length; i++) {
      const combo = samples[i];
      console.log(`  Example ${i + 1}:`);
      for (let j = 0; j < combo.songs.length; j++) {
        const song = combo.songs[j];
        console.log(`    ${j + 1}. ${song.artist} - ${song.title} (${song.bpm} BPM, Key ${song.key})`);
      }
      console.log('');
    }
  }

  // Return results for statistical analysis
  return {
    totalPairs,
    uniqueCombinations,
    repeatedCount: repeatedCombinations.length,
    maxRepeats,
    diversityRatio
  };
}

// Run multiple trials to verify consistency
console.log('🔬 RUNNING MULTIPLE TRIALS FOR STATISTICAL CONFIDENCE\n');

const numTrials = 10;
const results = [];

for (let trial = 0; trial < numTrials; trial++) {
  console.log(`Running trial ${trial + 1}/${numTrials}...`);
  const result = testPairDiversity(500, false); // Don't print details for each trial
  results.push(result);
}

console.log('\n' + '='.repeat(60) + '\n');
console.log('📊 SUMMARY OF ALL TRIALS:\n');

const avgDiversity = results.reduce((sum, r) => sum + r.diversityRatio, 0) / results.length;
const avgRepeats = results.reduce((sum, r) => sum + r.repeatedCount, 0) / results.length;
const maxRepeatsAcrossTrials = Math.max(...results.map(r => r.maxRepeats));

console.log(`  Trials run: ${numTrials}`);
console.log(`  Pairs per trial: 500`);
console.log(`  Total pairs tested: ${numTrials * 500}\n`);

console.log(`  Average diversity ratio: ${(avgDiversity * 100).toFixed(1)}%`);
console.log(`  Average repeated combos per trial: ${avgRepeats.toFixed(1)}`);
console.log(`  Max repeats seen in any trial: ${maxRepeatsAcrossTrials}x\n`);

console.log('  Per-trial diversity ratios:');
results.forEach((r, i) => {
  const percentage = (r.diversityRatio * 100).toFixed(1);
  const stars = r.diversityRatio > 0.95 ? '★★★' : r.diversityRatio > 0.90 ? '★★' : '★';
  console.log(`    Trial ${i + 1}: ${percentage}% ${stars} (${r.repeatedCount} repeats)`);
});
console.log('');
