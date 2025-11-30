/**
 * Test if play order is evenly distributed (not biased by song ID)
 */

import { songdata } from './songdata.js';

const ALL_TEMPOS = [84, 94, 102];

// Simulate the scoring algorithm
function scoreSong(song, tempo, key, playedSongIds, recentSongs, partnerSong = null, avoidArtists = []) {
  let score = 100;

  // Tempo compatibility - strict matching
  if (song.bpm === tempo) {
    score += 60;
  } else {
    return -1000; // Invalid
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
function selectNextSong(tempo, key, songs, playedSongIds, recentSongs, avoidArtists = []) {
  const unplayedSongs = songs.filter(song => !playedSongIds.has(song.id));
  const unplayedAtTempo = unplayedSongs.filter(song => song.bpm === tempo);
  const allSongsAtTempo = songs.filter(song => song.bpm === tempo);

  let candidates = unplayedAtTempo.length > 0 ? unplayedAtTempo : allSongsAtTempo;

  const scored = candidates
    .map(song => ({
      song,
      score: scoreSong(song, tempo, key, playedSongIds, recentSongs, null, avoidArtists)
    }))
    .filter(item => item.score > -1000)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return null;
  }

  // Select from top 20
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

// Test play order distribution
function testPlayOrder() {
  console.log('\n🔀 TESTING PLAY ORDER DISTRIBUTION\n');

  const playedSongIds = new Set();
  const recentSongs = [];
  const recentArtists = [];
  const playOrder = []; // Track order songs are played: { song, position }

  const tempoPairCounts = calculateWeightedPairCounts();
  const progression = generateWeightedProgression(tempoPairCounts, 2000);

  // Simulate selections
  for (let i = 0; i < 2000; i++) {
    const { tempo, key } = progression[i];
    const song = selectNextSong(tempo, key, songdata, playedSongIds, recentSongs, recentArtists.slice(0, 10));

    if (song) {
      // Track when this song was first played
      if (!playOrder.some(p => p.song.id === song.id)) {
        playOrder.push({ song, position: i });
      }

      playedSongIds.add(song.id);
      recentSongs.unshift(song);
      if (recentSongs.length > 50) recentSongs.length = 50;
      recentArtists.unshift(song.artist);
      if (recentArtists.length > 30) recentArtists.length = 30;

      // Auto-reset
      const unplayedCount = songdata.length - playedSongIds.size;
      if (unplayedCount < 20 && playedSongIds.size > 0) {
        playedSongIds.clear();
      }
    }
  }

  console.log(`📊 Analyzed first appearance of ${playOrder.length} songs\n`);

  // Analyze correlation between song ID and play position
  // Divide songs into quartiles by ID
  const sortedByPosition = [...playOrder].sort((a, b) => a.position - b.position);

  const quartile1 = sortedByPosition.slice(0, Math.floor(sortedByPosition.length / 4));
  const quartile2 = sortedByPosition.slice(Math.floor(sortedByPosition.length / 4), Math.floor(sortedByPosition.length / 2));
  const quartile3 = sortedByPosition.slice(Math.floor(sortedByPosition.length / 2), Math.floor(sortedByPosition.length * 3 / 4));
  const quartile4 = sortedByPosition.slice(Math.floor(sortedByPosition.length * 3 / 4));

  const avgIdQ1 = quartile1.reduce((sum, p) => sum + p.song.id, 0) / quartile1.length;
  const avgIdQ2 = quartile2.reduce((sum, p) => sum + p.song.id, 0) / quartile2.length;
  const avgIdQ3 = quartile3.reduce((sum, p) => sum + p.song.id, 0) / quartile3.length;
  const avgIdQ4 = quartile4.reduce((sum, p) => sum + p.song.id, 0) / quartile4.length;

  console.log('🎲 Play Order Analysis by Quartile:\n');
  console.log('  First 25% of songs played:');
  console.log(`    Average song ID: ${avgIdQ1.toFixed(1)}`);
  console.log(`    ID range: ${Math.min(...quartile1.map(p => p.song.id))} - ${Math.max(...quartile1.map(p => p.song.id))}`);
  console.log('');
  console.log('  Second 25% (26-50%):');
  console.log(`    Average song ID: ${avgIdQ2.toFixed(1)}`);
  console.log(`    ID range: ${Math.min(...quartile2.map(p => p.song.id))} - ${Math.max(...quartile2.map(p => p.song.id))}`);
  console.log('');
  console.log('  Third 25% (51-75%):');
  console.log(`    Average song ID: ${avgIdQ3.toFixed(1)}`);
  console.log(`    ID range: ${Math.min(...quartile3.map(p => p.song.id))} - ${Math.max(...quartile3.map(p => p.song.id))}`);
  console.log('');
  console.log('  Last 25% (76-100%):');
  console.log(`    Average song ID: ${avgIdQ4.toFixed(1)}`);
  console.log(`    ID range: ${Math.min(...quartile4.map(p => p.song.id))} - ${Math.max(...quartile4.map(p => p.song.id))}`);
  console.log('');

  // Calculate correlation coefficient
  const meanId = playOrder.reduce((sum, p) => sum + p.song.id, 0) / playOrder.length;
  const meanPos = playOrder.reduce((sum, p) => sum + p.position, 0) / playOrder.length;

  let numerator = 0;
  let denomId = 0;
  let denomPos = 0;

  for (const p of playOrder) {
    const idDiff = p.song.id - meanId;
    const posDiff = p.position - meanPos;
    numerator += idDiff * posDiff;
    denomId += idDiff * idDiff;
    denomPos += posDiff * posDiff;
  }

  const correlation = numerator / Math.sqrt(denomId * denomPos);

  console.log('📈 Correlation Analysis:\n');
  console.log(`  Correlation coefficient: ${correlation.toFixed(3)}`);
  console.log(`  (0 = no correlation, 1 = perfect positive, -1 = perfect negative)`);
  console.log('');

  if (Math.abs(correlation) < 0.1) {
    console.log('  ✅ EXCELLENT: Play order is well-shuffled!');
    console.log('  Song IDs have no correlation with play position.');
  } else if (Math.abs(correlation) < 0.3) {
    console.log('  ✓ GOOD: Play order has weak correlation.');
    console.log('  Minor bias but generally well distributed.');
  } else if (Math.abs(correlation) < 0.5) {
    console.log('  ⚠️  MODERATE: Noticeable correlation detected.');
    console.log('  Some bias in play order by song ID.');
  } else {
    console.log('  ❌ POOR: Strong correlation detected!');
    console.log('  Play order is heavily biased by song ID.');
  }
  console.log('');

  // Show some examples
  console.log('📝 Sample Play Order (first 20 songs):');
  for (let i = 0; i < Math.min(20, sortedByPosition.length); i++) {
    const p = sortedByPosition[i];
    console.log(`  Position ${p.position}: Song #${p.song.id} - ${p.song.artist} - ${p.song.title} (${p.song.bpm} BPM, Key ${p.song.key})`);
  }
  console.log('');
}

testPlayOrder();
