/**
 * Measure actual audio file durations to calculate real playthrough time
 */

import { promisify } from 'util';
import mp3Duration from 'mp3-duration';
import { songdata } from './songdata.js';
import fs from 'fs';
import path from 'path';

const getMp3Duration = promisify(mp3Duration);
const ALL_TEMPOS = [84, 94, 102];

// Sample songs from each tempo to get average durations
async function sampleDurations() {
  console.log('\n🎵 MEASURING ACTUAL AUDIO FILE DURATIONS\n');

  const samples = {
    84: [],
    94: [],
    102: []
  };

  // Sample 10 songs from each tempo
  for (const tempo of ALL_TEMPOS) {
    const songsAtTempo = songdata.filter(s => s.bpm === tempo);
    const sampleSize = Math.min(10, songsAtTempo.length);

    console.log(`Sampling ${sampleSize} songs at ${tempo} BPM...`);

    for (let i = 0; i < sampleSize; i++) {
      const song = songsAtTempo[i];
      const songId = String(song.id).padStart(8, '0');
      const leadPath = path.join(process.cwd(), 'music', `${songId}-lead.mp3`);
      const bodyPath = path.join(process.cwd(), 'music', `${songId}-body.mp3`);

      try {
        // Check if files exist
        if (!fs.existsSync(leadPath) || !fs.existsSync(bodyPath)) {
          console.log(`  ⚠️  Missing files for song ${song.id}: ${song.artist} - ${song.title}`);
          continue;
        }

        const leadDuration = await getMp3Duration(leadPath);
        const bodyDuration = await getMp3Duration(bodyPath);
        const totalDuration = leadDuration + bodyDuration;

        samples[tempo].push({
          song,
          leadDuration,
          bodyDuration,
          totalDuration
        });

        console.log(`  ✓ Song ${song.id}: ${totalDuration.toFixed(1)}s (intro: ${leadDuration.toFixed(1)}s, main: ${bodyDuration.toFixed(1)}s)`);
      } catch (error) {
        console.log(`  ✗ Error reading song ${song.id}: ${error.message}`);
      }
    }
  }

  return samples;
}

// Calculate statistics
async function calculateRealTime() {
  const samples = await sampleDurations();

  console.log('\n📊 DURATION STATISTICS BY TEMPO:\n');

  const avgDurations = {};

  for (const tempo of ALL_TEMPOS) {
    const tempoSamples = samples[tempo];
    if (tempoSamples.length === 0) {
      console.log(`${tempo} BPM: No valid samples`);
      continue;
    }

    const totalDurations = tempoSamples.map(s => s.totalDuration);
    const leadDurations = tempoSamples.map(s => s.leadDuration);
    const bodyDurations = tempoSamples.map(s => s.bodyDuration);

    const avgTotal = totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length;
    const avgLead = leadDurations.reduce((a, b) => a + b, 0) / leadDurations.length;
    const avgBody = bodyDurations.reduce((a, b) => a + b, 0) / bodyDurations.length;

    const minTotal = Math.min(...totalDurations);
    const maxTotal = Math.max(...totalDurations);

    avgDurations[tempo] = avgTotal;

    console.log(`${tempo} BPM (${tempoSamples.length} samples):`);
    console.log(`  Avg intro: ${avgLead.toFixed(1)}s`);
    console.log(`  Avg main:  ${avgBody.toFixed(1)}s`);
    console.log(`  Avg total: ${avgTotal.toFixed(1)}s`);
    console.log(`  Range: ${minTotal.toFixed(1)}s - ${maxTotal.toFixed(1)}s`);

    // Compare to theoretical
    const theoreticalTotal = (16 + 64) * (60 / tempo);
    const difference = avgTotal - theoreticalTotal;
    const percentDiff = (difference / theoreticalTotal * 100);
    console.log(`  Theoretical: ${theoreticalTotal.toFixed(1)}s`);
    console.log(`  Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(1)}s (${percentDiff > 0 ? '+' : ''}${percentDiff.toFixed(1)}%)\n`);
  }

  // Calculate weighted pair counts
  console.log('📊 WEIGHTED PROGRESSION:\n');

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
    console.log(`  ${tempo} BPM: ${pairCount} pairs per cycle (${songCount} songs)`);
  }

  // Calculate time per cycle with REAL durations
  console.log('\n⏱️  REAL TIME CALCULATIONS:\n');

  let totalSecondsPerCycle = 0;
  let totalPairsPerCycle = 0;

  for (const tempo of ALL_TEMPOS) {
    const pairCount = tempoPairCounts.get(tempo);
    const avgPairDuration = avgDurations[tempo] || 0;
    const tempoDuration = pairCount * avgPairDuration;

    totalSecondsPerCycle += tempoDuration;
    totalPairsPerCycle += pairCount;

    console.log(`  ${tempo} BPM: ${pairCount} pairs × ${avgPairDuration.toFixed(1)}s = ${(tempoDuration / 60).toFixed(1)} minutes`);
  }

  const minutesPerCycle = totalSecondsPerCycle / 60;

  console.log(`\n  Total per cycle: ${totalPairsPerCycle} pairs = ${minutesPerCycle.toFixed(1)} minutes\n`);

  // Calculate how many pairs needed to play all songs
  const totalSongs = songdata.length;
  const songsPerPair = 4; // 2 main + 2 MF
  const songsPerCycle = totalPairsPerCycle * songsPerPair;

  console.log('🎵 TIME TO PLAY ALL SONGS:\n');
  console.log(`  Total songs: ${totalSongs}`);
  console.log(`  Songs per cycle: ${songsPerCycle} (${totalPairsPerCycle} pairs × 4 songs)`);

  // Need to account for tempo-specific cycling
  let maxCyclesNeeded = 0;
  for (const tempo of ALL_TEMPOS) {
    const songsAtTempo = songCountsByTempo.get(tempo);
    const pairsPerCycle = tempoPairCounts.get(tempo);
    const songsPlayedPerCycle = pairsPerCycle * songsPerPair;
    const cyclesNeeded = Math.ceil(songsAtTempo / songsPlayedPerCycle);
    maxCyclesNeeded = Math.max(maxCyclesNeeded, cyclesNeeded);
    console.log(`  ${tempo} BPM: ${songsAtTempo} songs ÷ ${songsPlayedPerCycle} per cycle = ${cyclesNeeded} cycles needed`);
  }

  const totalMinutes = maxCyclesNeeded * minutesPerCycle;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = Math.round(totalMinutes % 60);

  console.log(`\n  Cycles needed: ${maxCyclesNeeded}`);
  console.log(`  Total time: ${totalHours} hours ${remainingMinutes} minutes`);
  console.log(`  (${totalMinutes.toFixed(1)} minutes total)\n`);
}

calculateRealTime().catch(console.error);
