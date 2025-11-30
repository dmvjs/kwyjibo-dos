/**
 * Test script to analyze song selection distribution
 * Simulates the HamiltonianPlayer's getNextSongSmart algorithm
 */

import { songdata } from './songdata.js';

// Available tempos
const ALL_TEMPOS = [84, 94, 102];

// Simulate the scoring algorithm
function scoreSong(song, tempo, key, playedSongIds, recentSongs, partnerSong = null, avoidArtists = []) {
  let score = 100;

  // Tempo compatibility - strict matching
  if (song.bpm === tempo) {
    score += 60;
  } else {
    return -1000; // Invalid - we enforce strict tempo matching now
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

  // Artist diversity
  for (const avoidArtist of avoidArtists) {
    if (song.artist.toLowerCase() === avoidArtist.toLowerCase()) {
      score -= 80;
    }
  }

  // Partner song checks
  if (partnerSong) {
    if (song.artist.toLowerCase() === partnerSong.artist.toLowerCase()) {
      return -1000; // Invalid
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
function selectNextSong(tempo, key, songs, playedSongIds, recentSongs, avoidArtists = []) {
  // Filter to unplayed songs at tempo
  const unplayedSongs = songs.filter(song => !playedSongIds.has(song.id));
  const unplayedAtTempo = unplayedSongs.filter(song => song.bpm === tempo);
  const allSongsAtTempo = songs.filter(song => song.bpm === tempo);

  let candidates = unplayedAtTempo.length > 0 ? unplayedAtTempo : allSongsAtTempo;

  // Score all candidates
  const scored = candidates
    .map(song => ({
      song,
      score: scoreSong(song, tempo, key, playedSongIds, recentSongs, null, avoidArtists)
    }))
    .filter(item => item.score > -1000)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    console.log(`⚠️ No candidates for tempo ${tempo}, key ${key}`);
    return null;
  }

  // Select from top 20
  const topCandidates = scored.slice(0, Math.min(20, scored.length));
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return selected.song;
}

// Calculate weighted pair counts (same logic as HamiltonianPlayer)
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
    console.log(`🎵 Tempo ${tempo} BPM: ${songCount} songs → ${pairCount} pairs per cycle`);
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

// Run distribution test
function testDistribution(numSelections = 1000) {
  console.log(`\n🧪 Testing WEIGHTED song selection distribution with ${numSelections} selections...\n`);

  const playedSongIds = new Set();
  const recentSongs = [];
  const recentArtists = [];
  const songSelectionCount = new Map(); // Track how many times each song is selected
  const tempoSelectionCount = new Map(); // Track selections per tempo
  const keySelectionCount = new Map(); // Track selections per key

  // Initialize counters
  for (const song of songdata) {
    songSelectionCount.set(song.id, 0);
  }

  for (const tempo of ALL_TEMPOS) {
    tempoSelectionCount.set(tempo, 0);
  }

  let resetCount = 0;

  // Calculate weighted pair counts
  const tempoPairCounts = calculateWeightedPairCounts();
  const progression = generateWeightedProgression(tempoPairCounts, numSelections);
  console.log('');

  // Simulate selections using weighted progression
  for (let i = 0; i < numSelections; i++) {
    const { tempo, key } = progression[i];

    const song = selectNextSong(tempo, key, songdata, playedSongIds, recentSongs, recentArtists.slice(0, 10));

    if (song) {
      // Track selection
      songSelectionCount.set(song.id, songSelectionCount.get(song.id) + 1);
      tempoSelectionCount.set(tempo, tempoSelectionCount.get(tempo) + 1);
      keySelectionCount.set(key, (keySelectionCount.get(key) || 0) + 1);

      // Update tracking
      playedSongIds.add(song.id);
      recentSongs.unshift(song);
      if (recentSongs.length > 50) recentSongs.length = 50;
      recentArtists.unshift(song.artist);
      if (recentArtists.length > 30) recentArtists.length = 30;

      // Auto-reset when low on unplayed songs
      const unplayedCount = songdata.length - playedSongIds.size;
      if (unplayedCount < 20 && playedSongIds.size > 0) {
        playedSongIds.clear();
        resetCount++;
      }
    }
  }

  // Analyze results
  console.log('📊 DISTRIBUTION ANALYSIS\n');
  console.log(`Total selections: ${numSelections}`);
  console.log(`Cycles completed (resets): ${resetCount}`);
  console.log(`Unique songs in library: ${songdata.length}\n`);

  // Tempo distribution
  console.log('🎵 Selections by Tempo:');
  for (const [tempo, count] of tempoSelectionCount.entries()) {
    const songsAtTempo = songdata.filter(s => s.bpm === tempo).length;
    console.log(`  ${tempo} BPM: ${count} selections (${songsAtTempo} songs available)`);
  }
  console.log('');

  // Song selection stats
  const selections = Array.from(songSelectionCount.entries()).map(([id, count]) => ({
    id,
    count,
    song: songdata.find(s => s.id === id)
  }));

  selections.sort((a, b) => b.count - a.count);

  const neverPlayed = selections.filter(s => s.count === 0);
  const playedOnce = selections.filter(s => s.count === 1);
  const mostPlayed = selections.slice(0, 10);
  const leastPlayed = selections.filter(s => s.count > 0).slice(-10).reverse();

  console.log(`📈 Song Selection Statistics:`);
  console.log(`  Never played: ${neverPlayed.length} songs (${(neverPlayed.length/songdata.length*100).toFixed(1)}%)`);
  console.log(`  Played once: ${playedOnce.length} songs`);
  console.log(`  Average plays per song: ${(numSelections / songdata.length).toFixed(2)}`);
  console.log(`  Max plays: ${mostPlayed[0].count}`);
  console.log(`  Min plays (excluding 0): ${leastPlayed[leastPlayed.length - 1]?.count || 0}\n`);

  // Show most played songs
  console.log('🔥 Top 10 Most Selected Songs:');
  for (let i = 0; i < Math.min(10, mostPlayed.length); i++) {
    const s = mostPlayed[i];
    console.log(`  ${i + 1}. [${s.count}x] ${s.song.artist} - ${s.song.title} (Key ${s.song.key}, ${s.song.bpm} BPM)`);
  }
  console.log('');

  // Show least played songs (excluding never played)
  if (leastPlayed.length > 0) {
    console.log('❄️  Bottom 10 Least Selected Songs (excluding never played):');
    for (let i = 0; i < Math.min(10, leastPlayed.length); i++) {
      const s = leastPlayed[i];
      console.log(`  ${i + 1}. [${s.count}x] ${s.song.artist} - ${s.song.title} (Key ${s.song.key}, ${s.song.bpm} BPM)`);
    }
    console.log('');
  }

  // Show some never played songs
  if (neverPlayed.length > 0) {
    console.log(`🚫 Sample of Never Played Songs (showing first 20 of ${neverPlayed.length}):`);
    for (let i = 0; i < Math.min(20, neverPlayed.length); i++) {
      const s = neverPlayed[i];
      console.log(`  ${s.song.artist} - ${s.song.title} (Key ${s.song.key}, ${s.song.bpm} BPM)`);
    }
    console.log('');
  }

  // Analyze by tempo
  console.log('📊 Distribution by Tempo:');
  for (const tempo of ALL_TEMPOS) {
    const songsAtTempo = songdata.filter(s => s.bpm === tempo);
    const selectionsAtTempo = selections.filter(s => s.song.bpm === tempo);
    const neverPlayedAtTempo = selectionsAtTempo.filter(s => s.count === 0).length;
    const avgPlaysAtTempo = selectionsAtTempo.reduce((sum, s) => sum + s.count, 0) / songsAtTempo.length;

    console.log(`  ${tempo} BPM:`);
    console.log(`    Total songs: ${songsAtTempo.length}`);
    console.log(`    Never played: ${neverPlayedAtTempo} (${(neverPlayedAtTempo/songsAtTempo.length*100).toFixed(1)}%)`);
    console.log(`    Avg plays per song: ${avgPlaysAtTempo.toFixed(2)}`);
  }
  console.log('');

  // Standard deviation calculation
  const counts = selections.map(s => s.count);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  console.log('📉 Statistical Measures:');
  console.log(`  Mean plays per song: ${mean.toFixed(2)}`);
  console.log(`  Standard deviation: ${stdDev.toFixed(2)}`);
  console.log(`  Coefficient of variation: ${(stdDev / mean * 100).toFixed(1)}%`);
  console.log(`  (Lower is better - indicates more even distribution)\n`);
}

// Run the test
testDistribution(2000);
