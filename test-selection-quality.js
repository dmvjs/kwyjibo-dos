/**
 * Test the quality of song selections
 * Measures how well selected songs match the target key/tempo
 */

import { songdata } from './songdata.js';

const ALL_TEMPOS = [84, 94, 102];

// Simulate the scoring algorithm
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

function selectNextSongWithMetrics(tempo, key, songs, playedSongIds, recentSongs, avoidArtists = [], avoidSongIds = []) {
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
  const selectedIndex = Math.floor(Math.random() * topCandidates.length);
  const selected = topCandidates[selectedIndex];

  // Calculate key relationship
  const keyDiff = Math.abs(selected.song.key - key);
  const circularDiff = Math.min(keyDiff, 12 - keyDiff);

  let keyQuality;
  if (circularDiff === 0) keyQuality = 'perfect';
  else if (circularDiff === 5 || circularDiff === 7) keyQuality = 'excellent';
  else if (circularDiff === 3 || circularDiff === 4) keyQuality = 'good';
  else if (circularDiff === 2) keyQuality = 'fair';
  else keyQuality = 'poor';

  return {
    song: selected.song,
    score: selected.score,
    keyDiff: circularDiff,
    keyQuality,
    candidateCount: scored.length,
    topCandidateCount: topCandidates.length,
    selectedRank: selectedIndex + 1,
    highestScore: scored[0].score,
    lowestTopScore: topCandidates[topCandidates.length - 1].score
  };
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

function testSelectionQuality() {
  console.log('\n🎯 TESTING SELECTION QUALITY\n');

  const playedSongIds = new Set();
  const recentSongs = [];
  const recentArtists = [];
  const selections = [];
  const numPairs = 1000;

  const tempoPairCounts = calculateWeightedPairCounts();
  const progression = generateWeightedProgression(tempoPairCounts, numPairs);

  console.log(`Analyzing ${numPairs} song selections...\n`);

  // Track metrics
  const keyQualityCounts = {
    perfect: 0,
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0
  };

  let totalScore = 0;
  let totalKeyDiff = 0;
  let totalCandidates = 0;
  let forcedSelections = 0; // When we have < 5 candidates

  // Simulate selections (just main tracks, not MF tracks)
  for (let i = 0; i < numPairs; i++) {
    const { tempo, key } = progression[i];

    const result = selectNextSongWithMetrics(tempo, key, songdata, playedSongIds, recentSongs, recentArtists.slice(0, 10), []);
    if (!result) continue;

    selections.push(result);
    keyQualityCounts[result.keyQuality]++;
    totalScore += result.score;
    totalKeyDiff += result.keyDiff;
    totalCandidates += result.candidateCount;

    if (result.candidateCount < 5) {
      forcedSelections++;
    }

    // Update tracking
    playedSongIds.add(result.song.id);
    recentSongs.unshift(result.song);
    if (recentSongs.length > 50) recentSongs.length = 50;
    recentArtists.unshift(result.song.artist);
    if (recentArtists.length > 30) recentArtists.length = 30;

    // Auto-reset
    const unplayedCount = songdata.length - playedSongIds.size;
    if (unplayedCount < 20 && playedSongIds.size > 0) {
      playedSongIds.clear();
    }
  }

  console.log('═══════════════════════════════════════════════\n');
  console.log('📊 KEY COMPATIBILITY ANALYSIS:\n');

  const totalSelections = selections.length;
  console.log(`  Perfect match (same key): ${keyQualityCounts.perfect} (${(keyQualityCounts.perfect / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  Excellent (5th/7th): ${keyQualityCounts.excellent} (${(keyQualityCounts.excellent / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  Good (3rd/4th): ${keyQualityCounts.good} (${(keyQualityCounts.good / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  Fair (2nd): ${keyQualityCounts.fair} (${(keyQualityCounts.fair / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  Poor (tritone/dissonant): ${keyQualityCounts.poor} (${(keyQualityCounts.poor / totalSelections * 100).toFixed(1)}%)\n`);

  const goodOrBetter = keyQualityCounts.perfect + keyQualityCounts.excellent + keyQualityCounts.good;
  console.log(`  Total good or better: ${goodOrBetter} (${(goodOrBetter / totalSelections * 100).toFixed(1)}%)\n`);

  console.log('═══════════════════════════════════════════════\n');
  console.log('🎲 SELECTION SCORE ANALYSIS:\n');

  const avgScore = totalScore / totalSelections;
  const avgKeyDiff = totalKeyDiff / totalSelections;
  const avgCandidates = totalCandidates / totalSelections;

  console.log(`  Average selection score: ${avgScore.toFixed(1)}`);
  console.log(`  Average key distance: ${avgKeyDiff.toFixed(2)} semitones`);
  console.log(`  Average candidates available: ${avgCandidates.toFixed(1)}`);
  console.log(`  Forced selections (<5 options): ${forcedSelections} (${(forcedSelections / totalSelections * 100).toFixed(1)}%)\n`);

  console.log('═══════════════════════════════════════════════\n');
  console.log('📈 SCORE DISTRIBUTION:\n');

  const scoreBuckets = {
    '350+': 0,
    '300-349': 0,
    '250-299': 0,
    '200-249': 0,
    '150-199': 0,
    '100-149': 0,
    '<100': 0
  };

  for (const sel of selections) {
    if (sel.score >= 350) scoreBuckets['350+']++;
    else if (sel.score >= 300) scoreBuckets['300-349']++;
    else if (sel.score >= 250) scoreBuckets['250-299']++;
    else if (sel.score >= 200) scoreBuckets['200-249']++;
    else if (sel.score >= 150) scoreBuckets['150-199']++;
    else if (sel.score >= 100) scoreBuckets['100-149']++;
    else scoreBuckets['<100']++;
  }

  console.log(`  350+ (excellent): ${scoreBuckets['350+']} (${(scoreBuckets['350+'] / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  300-349 (very good): ${scoreBuckets['300-349']} (${(scoreBuckets['300-349'] / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  250-299 (good): ${scoreBuckets['250-299']} (${(scoreBuckets['250-299'] / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  200-249 (fair): ${scoreBuckets['200-249']} (${(scoreBuckets['200-249'] / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  150-199 (mediocre): ${scoreBuckets['150-199']} (${(scoreBuckets['150-199'] / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  100-149 (poor): ${scoreBuckets['100-149']} (${(scoreBuckets['100-149'] / totalSelections * 100).toFixed(1)}%)`);
  console.log(`  <100 (very poor): ${scoreBuckets['<100']} (${(scoreBuckets['<100'] / totalSelections * 100).toFixed(1)}%)\n`);

  console.log('═══════════════════════════════════════════════\n');
  console.log('🎼 SAMPLE SELECTIONS:\n');

  // Show some examples of each quality level
  const samplesByQuality = {
    poor: selections.filter(s => s.keyQuality === 'poor').slice(0, 3),
    fair: selections.filter(s => s.keyQuality === 'fair').slice(0, 3),
    good: selections.filter(s => s.keyQuality === 'good').slice(0, 3),
  };

  if (samplesByQuality.poor.length > 0) {
    console.log('  Poor matches (dissonant keys):');
    for (const sel of samplesByQuality.poor) {
      console.log(`    ${sel.song.artist} - ${sel.song.title}`);
      console.log(`    Target key: ${sel.keyDiff === 0 ? sel.song.key : '?'}, Song key: ${sel.song.key}, Distance: ${sel.keyDiff} semitones, Score: ${sel.score.toFixed(1)}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════\n');
  console.log('✅ OVERALL ASSESSMENT:\n');

  const excellentPercent = (goodOrBetter / totalSelections * 100);

  if (excellentPercent >= 90) {
    console.log('  ✅ EXCELLENT: Over 90% of selections are musically compatible!');
    console.log('  The algorithm consistently finds good matches.\n');
  } else if (excellentPercent >= 75) {
    console.log('  ✓ VERY GOOD: Most selections are musically compatible.');
    console.log('  Occasional compromises but generally strong matches.\n');
  } else if (excellentPercent >= 60) {
    console.log('  ✓ GOOD: Majority of selections are compatible.');
    console.log('  Some compromises needed for diversity.\n');
  } else if (excellentPercent >= 40) {
    console.log('  ⚠️  MODERATE: Many selections are musical compromises.');
    console.log('  Consider adjusting scoring weights.\n');
  } else {
    console.log('  ❌ POOR: Too many incompatible selections.');
    console.log('  Scoring algorithm may need rebalancing.\n');
  }

  if (avgScore >= 300) {
    console.log('  ✅ High average scores indicate quality selections.\n');
  } else if (avgScore >= 250) {
    console.log('  ✓ Moderate average scores - acceptable quality.\n');
  } else {
    console.log('  ⚠️  Low average scores - algorithm often settling for poor matches.\n');
  }

  if (forcedSelections / totalSelections < 0.05) {
    console.log('  ✅ Rarely forced to choose from limited options.\n');
  } else if (forcedSelections / totalSelections < 0.15) {
    console.log('  ✓ Occasionally limited in candidate choices.\n');
  } else {
    console.log('  ⚠️  Frequently constrained to few candidates.\n');
  }
}

testSelectionQuality();
