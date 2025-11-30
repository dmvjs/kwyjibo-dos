/**
 * Test diversity of 2-song pairs and 3-song triplets within 4-song combinations
 */

import { songdata } from './songdata.js';

const ALL_TEMPOS = [84, 94, 102];

// Simulate the scoring algorithm (same as before)
function scoreSong(song, tempo, key, playedSongIds, recentSongs, avoidSongIds = [], partnerSong = null, avoidArtists = []) {
  let score = 100;

  if (song.bpm === tempo) {
    score += 60;
  } else {
    return -1000;
  }

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

  if (avoidSongIds.includes(song.id)) return -1000;

  for (const avoidArtist of avoidArtists) {
    if (song.artist.toLowerCase() === avoidArtist.toLowerCase()) {
      score -= 80;
    }
  }

  if (partnerSong) {
    if (song.artist.toLowerCase() === partnerSong.artist.toLowerCase()) {
      return -1000;
    }
    score += 30;
  }

  const recentIndex = recentSongs.findIndex(s => s.id === song.id);
  if (recentIndex !== -1) {
    const recencyPenalty = Math.max(0, 50 - recentIndex * 2);
    score -= recencyPenalty;
  }

  if (!playedSongIds.has(song.id)) {
    score += 200;
  }

  const randomVariance = Math.random() * 80;
  score += randomVariance;

  return score;
}

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

  if (scored.length === 0) return null;

  const topCandidates = scored.slice(0, Math.min(20, scored.length));
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return selected.song;
}

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

// Generate all possible pairs from a 4-song set
function getAllPairs(songs) {
  const pairs = [];
  for (let i = 0; i < songs.length; i++) {
    for (let j = i + 1; j < songs.length; j++) {
      const ids = [songs[i].id, songs[j].id].sort((a, b) => a - b);
      pairs.push({
        id: ids.join('-'),
        songs: [songs[i], songs[j]]
      });
    }
  }
  return pairs;
}

// Generate all possible triplets from a 4-song set
function getAllTriplets(songs) {
  const triplets = [];
  for (let i = 0; i < songs.length; i++) {
    for (let j = i + 1; j < songs.length; j++) {
      for (let k = j + 1; k < songs.length; k++) {
        const ids = [songs[i].id, songs[j].id, songs[k].id].sort((a, b) => a - b);
        triplets.push({
          id: ids.join('-'),
          songs: [songs[i], songs[j], songs[k]]
        });
      }
    }
  }
  return triplets;
}

// Test subset diversity
function testSubsetDiversity() {
  console.log('\n🔍 TESTING 2-SONG PAIRS & 3-SONG TRIPLETS DIVERSITY\n');

  const playedSongIds = new Set();
  const recentSongs = [];
  const recentArtists = [];
  const pairCombinations = new Map(); // 2-song pairs
  const tripletCombinations = new Map(); // 3-song triplets
  const numPairs = 1000;

  const tempoPairCounts = calculateWeightedPairCounts();
  const progression = generateWeightedProgression(tempoPairCounts, numPairs);

  console.log(`Generating ${numPairs} 4-song combinations...\n`);

  // Simulate pair generation
  for (let i = 0; i < numPairs; i++) {
    const { tempo, key } = progression[i];

    // Select 4 songs
    const song1 = selectNextSong(tempo, key, songdata, playedSongIds, recentSongs, recentArtists.slice(0, 10), []);
    if (!song1) continue;

    const song2 = selectNextSong(tempo, key, songdata, playedSongIds, recentSongs, [...recentArtists.slice(0, 10), song1.artist], [song1.id]);
    if (!song2) continue;

    const relatedKey3 = ((key - 1 + 5) % 12) + 1;
    const relatedKey4 = ((key - 1 + 7) % 12) + 1;

    const song3 = selectNextSong(tempo, relatedKey3, songdata, playedSongIds, recentSongs, [song1.artist, song2.artist], [song1.id, song2.id]);
    if (!song3) continue;

    const song4 = selectNextSong(tempo, relatedKey4, songdata, playedSongIds, recentSongs, [song1.artist, song2.artist, song3.artist], [song1.id, song2.id, song3.id]);
    if (!song4) continue;

    const fourSongs = [song1, song2, song3, song4];

    // Extract all 2-song pairs (6 total: 4 choose 2)
    const pairs = getAllPairs(fourSongs);
    for (const pair of pairs) {
      if (!pairCombinations.has(pair.id)) {
        pairCombinations.set(pair.id, { songs: pair.songs, count: 0, positions: [] });
      }
      const combo = pairCombinations.get(pair.id);
      combo.count++;
      combo.positions.push(i);
    }

    // Extract all 3-song triplets (4 total: 4 choose 3)
    const triplets = getAllTriplets(fourSongs);
    for (const triplet of triplets) {
      if (!tripletCombinations.has(triplet.id)) {
        tripletCombinations.set(triplet.id, { songs: triplet.songs, count: 0, positions: [] });
      }
      const combo = tripletCombinations.get(triplet.id);
      combo.count++;
      combo.positions.push(i);
    }

    // Update tracking
    playedSongIds.add(song1.id);
    playedSongIds.add(song2.id);
    playedSongIds.add(song3.id);
    playedSongIds.add(song4.id);

    recentSongs.unshift(song1, song2, song3, song4);
    if (recentSongs.length > 50) recentSongs.length = 50;

    recentArtists.unshift(song1.artist, song2.artist, song3.artist, song4.artist);
    if (recentArtists.length > 30) recentArtists.length = 30;

    const unplayedCount = songdata.length - playedSongIds.size;
    if (unplayedCount < 20 && playedSongIds.size > 0) {
      playedSongIds.clear();
    }
  }

  // Analyze 2-song pairs
  console.log('═══════════════════════════════════════════════\n');
  console.log('📊 2-SONG PAIR ANALYSIS:\n');

  const totalPairSlots = numPairs * 6; // 6 pairs per 4-song combo
  const uniquePairs = pairCombinations.size;
  const repeatedPairs = Array.from(pairCombinations.values()).filter(c => c.count > 1);
  const maxPairRepeats = Math.max(...Array.from(pairCombinations.values()).map(c => c.count));

  console.log(`  Total 2-song pair slots: ${totalPairSlots}`);
  console.log(`  Unique 2-song pairs: ${uniquePairs}`);
  console.log(`  Repeated pairs: ${repeatedPairs.length}`);
  console.log(`  Max times any pair repeated: ${maxPairRepeats}x\n`);

  const avgPairAppearances = totalPairSlots / uniquePairs;
  console.log(`  Average appearances per pair: ${avgPairAppearances.toFixed(2)}x`);
  console.log(`  Diversity score: ${(1 / avgPairAppearances * 100).toFixed(1)}%`);
  console.log(`  (Higher = more diverse, 100% = each pair appears once)\n`);

  // Show most repeated pairs
  const mostRepeatedPairs = repeatedPairs
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  console.log('🔁 Most Repeated 2-Song Pairs:\n');
  for (let i = 0; i < Math.min(5, mostRepeatedPairs.length); i++) {
    const combo = mostRepeatedPairs[i];
    console.log(`  ${i + 1}. Appeared ${combo.count}x`);
    console.log(`     ${combo.songs[0].artist} - ${combo.songs[0].title}`);
    console.log(`     ${combo.songs[1].artist} - ${combo.songs[1].title}`);
    console.log('');
  }

  // Analyze 3-song triplets
  console.log('═══════════════════════════════════════════════\n');
  console.log('📊 3-SONG TRIPLET ANALYSIS:\n');

  const totalTripletSlots = numPairs * 4; // 4 triplets per 4-song combo
  const uniqueTriplets = tripletCombinations.size;
  const repeatedTriplets = Array.from(tripletCombinations.values()).filter(c => c.count > 1);
  const maxTripletRepeats = Math.max(...Array.from(tripletCombinations.values()).map(c => c.count));

  console.log(`  Total 3-song triplet slots: ${totalTripletSlots}`);
  console.log(`  Unique 3-song triplets: ${uniqueTriplets}`);
  console.log(`  Repeated triplets: ${repeatedTriplets.length}`);
  console.log(`  Max times any triplet repeated: ${maxTripletRepeats}x\n`);

  const avgTripletAppearances = totalTripletSlots / uniqueTriplets;
  console.log(`  Average appearances per triplet: ${avgTripletAppearances.toFixed(2)}x`);
  console.log(`  Diversity score: ${(1 / avgTripletAppearances * 100).toFixed(1)}%`);
  console.log(`  (Higher = more diverse, 100% = each triplet appears once)\n`);

  // Show most repeated triplets
  const mostRepeatedTriplets = repeatedTriplets
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  console.log('🔁 Most Repeated 3-Song Triplets:\n');
  for (let i = 0; i < Math.min(5, mostRepeatedTriplets.length); i++) {
    const combo = mostRepeatedTriplets[i];
    console.log(`  ${i + 1}. Appeared ${combo.count}x`);
    console.log(`     ${combo.songs[0].artist} - ${combo.songs[0].title}`);
    console.log(`     ${combo.songs[1].artist} - ${combo.songs[1].title}`);
    console.log(`     ${combo.songs[2].artist} - ${combo.songs[2].title}`);
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════\n');
  console.log('📈 SUMMARY:\n');
  console.log(`  4-song combinations: 100% unique (from previous test)`);
  console.log(`  3-song triplets: ${(1 / avgTripletAppearances * 100).toFixed(1)}% diversity`);
  console.log(`  2-song pairs: ${(1 / avgPairAppearances * 100).toFixed(1)}% diversity\n`);

  if (avgPairAppearances < 1.5) {
    console.log('  ✅ EXCELLENT: Even 2-song pairs rarely repeat!');
  } else if (avgPairAppearances < 2.5) {
    console.log('  ✓ VERY GOOD: Minimal repetition in smaller subsets.');
  } else if (avgPairAppearances < 4) {
    console.log('  ✓ GOOD: Some pairs appear together multiple times.');
  } else {
    console.log('  ⚠️  MODERATE: Certain song pairs appear frequently together.');
  }
  console.log('');
}

testSubsetDiversity();
