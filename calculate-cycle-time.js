/**
 * Calculate how long it takes to play through all songs once
 */

import { songdata } from './songdata.js';

const ALL_TEMPOS = [84, 94, 102];
const BEAT_COUNTS = {
  lead: 16,  // intro
  body: 64   // main
};

// Calculate weighted pair counts (same as player)
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

// Calculate pair duration at a given tempo
function calculatePairDuration(tempo) {
  const totalBeats = BEAT_COUNTS.lead + BEAT_COUNTS.body; // 16 + 64 = 80 beats
  const secondsPerBeat = 60 / tempo;
  return totalBeats * secondsPerBeat;
}

// Main calculation
console.log('\n⏱️  CALCULATING TIME TO PLAY ALL SONGS\n');

const totalSongs = songdata.length;
const songsPerPair = 4; // 2 main tracks + 2 MF tracks

console.log(`Total songs in library: ${totalSongs}`);
console.log(`Songs per pair (2 main + 2 MF): ${songsPerPair}\n`);

// Calculate weighted progression
const tempoPairCounts = calculateWeightedPairCounts();

console.log('📊 Weighted Pairs Per Cycle:');
let totalPairsPerCycle = 0;
const durationByTempo = {};

for (const tempo of ALL_TEMPOS) {
  const pairCount = tempoPairCounts.get(tempo);
  const songsAtTempo = songdata.filter(s => s.bpm === tempo).length;
  const pairDuration = calculatePairDuration(tempo);
  const tempoDuration = pairCount * pairDuration;

  totalPairsPerCycle += pairCount;
  durationByTempo[tempo] = tempoDuration;

  console.log(`  ${tempo} BPM: ${pairCount} pairs (${songsAtTempo} songs available)`);
  console.log(`    → ${(pairDuration).toFixed(1)}s per pair`);
  console.log(`    → ${(tempoDuration / 60).toFixed(1)} minutes total at this tempo`);
}

console.log(`\n  Total pairs per cycle: ${totalPairsPerCycle}`);

const songsPerCycle = totalPairsPerCycle * songsPerPair;
const cyclesNeeded = Math.ceil(totalSongs / songsPerCycle);

console.log(`  Songs played per cycle: ${songsPerCycle}`);
console.log(`  Cycles needed to play all songs: ${cyclesNeeded}\n`);

// Calculate total time per cycle
const totalSecondsPerCycle = Object.values(durationByTempo).reduce((a, b) => a + b, 0);
const minutesPerCycle = totalSecondsPerCycle / 60;
const hoursPerCycle = minutesPerCycle / 60;

console.log('⏱️  Duration Per Cycle:');
console.log(`  ${totalSecondsPerCycle.toFixed(0)} seconds`);
console.log(`  ${minutesPerCycle.toFixed(1)} minutes`);
console.log(`  ${hoursPerCycle.toFixed(2)} hours\n`);

// Calculate total time to play all songs
const totalSeconds = totalSecondsPerCycle * cyclesNeeded;
const totalMinutes = totalSeconds / 60;
const totalHours = totalMinutes / 60;

console.log('🎵 TIME TO PLAY ALL 378 SONGS ONCE:\n');
console.log(`  ${Math.floor(totalHours)} hours ${Math.round((totalHours - Math.floor(totalHours)) * 60)} minutes`);
console.log(`  (${totalMinutes.toFixed(1)} minutes total)`);
console.log(`  (${totalSeconds.toFixed(0)} seconds total)\n`);

// Calculate breakdown
console.log('📊 Breakdown:');
for (const tempo of ALL_TEMPOS) {
  const pairCount = tempoPairCounts.get(tempo);
  const duration = durationByTempo[tempo] * cyclesNeeded;
  const songsAtTempo = songdata.filter(s => s.bpm === tempo).length;
  const pairsNeeded = Math.ceil(songsAtTempo / songsPerPair);

  console.log(`  ${tempo} BPM: ${(duration / 60).toFixed(1)} min (${songsAtTempo} songs, ~${pairsNeeded} pairs needed)`);
}
console.log('');
