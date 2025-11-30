import React, { useEffect, useState, useRef } from 'react';
import { HamiltonianPlayer, TrackPair } from './player/HamiltonianPlayer';
import type { PlayerState } from './player/HamiltonianPlayer';
import { songs } from '../src';
import type { Key, Tempo } from '../src';
import { ALL_TEMPOS } from '../src';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Wake Lock API types
interface WakeLockSentinel {
  release(): Promise<void>;
}

function App(): React.ReactElement {
  const [player] = useState(() => new HamiltonianPlayer([...songs]));
  const [playerState, setPlayerState] = useState<PlayerState>(player.getState());
  const [currentTrack, setCurrentTrack] = useState<'intro' | 'main'>('intro');
  const [playHistory, setPlayHistory] = useState<TrackPair[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Initialize player with quantum randomness
  useEffect(() => {
    void player.init();
  }, [player]);

  // Wake Lock functionality
  useEffect(() => {
    const requestWakeLock = async (): Promise<void> => {
      try {
        if ('wakeLock' in navigator) {
          const nav = navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } };
          wakeLockRef.current = await nav.wakeLock.request('screen');
          console.log('Wake Lock active');
        }
      } catch (err) {
        console.log('Wake Lock not supported or denied');
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      } else {
        // Pause playback when page becomes hidden (phone locks, tab switched, etc.)
        if (playerState.isPlaying) {
          void player.pause();
        }
      }
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
      }
    };
  }, [player, playerState.isPlaying]);

  useEffect(() => {
    // Subscribe to player events
    const unsubscribeState = player.on('stateChange', (state): void => {
      setPlayerState(state);
    });

    const unsubscribeIntro = player.on('introStart', (): void => {
      setCurrentTrack('intro');
    });

    const unsubscribeMain = player.on('mainStart', (): void => {
      setCurrentTrack('main');
    });

    const unsubscribePairStart = player.on('pairStart', (pair): void => {
      // Add the starting pair to history
      setPlayHistory(prev => [...prev, pair]);
    });

    const unsubscribeError = player.on('error', (error): void => {
      console.error('Player error:', error);
    });

    return (): void => {
      unsubscribeState();
      unsubscribeIntro();
      unsubscribeMain();
      unsubscribePairStart();
      unsubscribeError();
    };
  }, [player]);

  const handlePlay = (): void => {
    void player.play();
  };

  const handlePause = (): void => {
    void player.pause();
  };

  const handleStop = (): void => {
    player.stop();
  };

  const handleKeyChange = (key: Key): void => {
    player.setKey(key);
  };

  const handleTempoChange = (tempo: Tempo): void => {
    player.setTempo(tempo);
  };

  const handleMannieFreshToggle = (): void => {
    player.toggleMannieFreshMode();
  };

  const handle808Toggle = (): void => {
    player.toggle808Mode();
  };

  return (
    <div className="app">
      {/* Playback Controls - Top */}
      <div className="controls">
        {!playerState.isPlaying ? (
          <button className="ctrl-btn play" onClick={handlePlay}>▶︎</button>
        ) : (
          <button className="ctrl-btn" onClick={handlePause}>⏸︎</button>
        )}
        <button className="ctrl-btn" onClick={handleStop}>⏹︎</button>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <span>{KEY_NAMES[playerState.key - 1]}</span>
        <span>{playerState.tempo} BPM</span>
        <span>{currentTrack === 'intro' ? 'Intro' : 'Main'}</span>
      </div>

      {/* Key Strip */}
      <div className="strip">
        <div className="strip-label">KEY</div>
        <div className="strip-buttons">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((key) => (
            <button
              key={key}
              className={`strip-btn ${playerState.key === key ? 'active' : ''}`}
              onClick={() => handleKeyChange(key as Key)}
            >
              {KEY_NAMES[key - 1]}
            </button>
          ))}
        </div>
      </div>

      {/* Tempo Strip */}
      <div className="strip">
        <div className="strip-label">BPM</div>
        <div className="strip-buttons">
          {ALL_TEMPOS.map((tempo) => (
            <button
              key={tempo}
              className={`strip-btn ${playerState.tempo === tempo ? 'active' : ''}`}
              onClick={() => handleTempoChange(tempo)}
            >
              {tempo}
            </button>
          ))}
          {/* Mannie Fresh Mode Toggle */}
          <div className="mf-toggle-container" style={{ marginLeft: 'auto', paddingLeft: '32px' }}>
            <span className="mf-label">MF</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={playerState.mannieFreshMode}
                onChange={handleMannieFreshToggle}
              />
              <span className="slider"></span>
            </label>
          </div>
          {/* 808 Mode Toggle */}
          <div className="mf-toggle-container" style={{ paddingLeft: '16px' }}>
            <span className="mf-label">808</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={playerState.eightZeroEightMode}
                onChange={handle808Toggle}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </div>

      {/* Now Playing */}
      {playerState.currentPair && (
        <div className="track-section">
          <div className="section-label">NOW PLAYING</div>
          <div className="track-row compact">
            <div className="track-num">1</div>
            <div className="track-info-compact">
              {playerState.currentPair.track1.song.artist} - {playerState.currentPair.track1.song.title}
            </div>
            <div className="track-key">{KEY_NAMES[playerState.currentPair.track1.song.key - 1]}</div>
          </div>
          <div className="track-row compact">
            <div className="track-num">2</div>
            <div className="track-info-compact">
              {playerState.currentPair.track2.song.artist} - {playerState.currentPair.track2.song.title}
            </div>
            <div className="track-key">{KEY_NAMES[playerState.currentPair.track2.song.key - 1]}</div>
          </div>
          {playerState.currentPair.track3 && (
            <div className={`track-row compact ${
              playerState.eightZeroEightMode
                ? ''
                : (!playerState.mannieFreshMode || (playerState.mannieFreshMode && playerState.activeHiddenTrack !== 3) ? 'inactive-mf' : '')
            }`}>
              <div className="track-num">3</div>
              <div className="track-info-compact">
                {playerState.currentPair.track3.song.artist} - {playerState.currentPair.track3.song.title}
              </div>
              <div className="track-key">{KEY_NAMES[playerState.currentPair.track3.song.key - 1]}</div>
            </div>
          )}
          {playerState.currentPair.track4 && (
            <div className={`track-row compact ${
              playerState.eightZeroEightMode
                ? ''
                : (!playerState.mannieFreshMode || (playerState.mannieFreshMode && playerState.activeHiddenTrack !== 4) ? 'inactive-mf' : '')
            }`}>
              <div className="track-num">4</div>
              <div className="track-info-compact">
                {playerState.currentPair.track4.song.artist} - {playerState.currentPair.track4.song.title}
              </div>
              <div className="track-key">{KEY_NAMES[playerState.currentPair.track4.song.key - 1]}</div>
            </div>
          )}
        </div>
      )}

      {/* Up Next */}
      {playerState.nextPair && (
        <div className="track-section">
          <div className="section-label">UP NEXT</div>
          <div className="track-row compact">
            <div className="track-num">1</div>
            <div className="track-info-compact">
              {playerState.nextPair.track1.song.artist} - {playerState.nextPair.track1.song.title}
            </div>
          </div>
          <div className="track-row compact">
            <div className="track-num">2</div>
            <div className="track-info-compact">
              {playerState.nextPair.track2.song.artist} - {playerState.nextPair.track2.song.title}
            </div>
          </div>
          {playerState.nextPair.track3 && (
            <div className="track-row compact">
              <div className="track-num">3</div>
              <div className="track-info-compact">
                {playerState.nextPair.track3.song.artist} - {playerState.nextPair.track3.song.title}
              </div>
            </div>
          )}
          {playerState.nextPair.track4 && (
            <div className="track-row compact">
              <div className="track-num">4</div>
              <div className="track-info-compact">
                {playerState.nextPair.track4.song.artist} - {playerState.nextPair.track4.song.title}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Play History */}
      {playHistory.length > 0 && (
        <div className="playlist-container">
          <div className="playlist-section">
            <div className="section-label played-label">HISTORY ({playHistory.length} PAIRS)</div>
            {playHistory.map((pair, idx) => (
              <div key={`played-${idx}`} className="playlist-pair played">
                <div className="pair-meta">
                  <span className="pair-key">{KEY_NAMES[pair.key - 1]}</span>
                  <span className="pair-tempo">{pair.tempo}</span>
                </div>
                <div className="pair-tracks">
                  <div className="playlist-track">
                    1. {pair.track1.song.artist} - {pair.track1.song.title}
                  </div>
                  <div className="playlist-track">
                    2. {pair.track2.song.artist} - {pair.track2.song.title}
                  </div>
                  {pair.track3 && (
                    <div className="playlist-track">
                      3. {pair.track3.song.artist} - {pair.track3.song.title}
                    </div>
                  )}
                  {pair.track4 && (
                    <div className="playlist-track">
                      4. {pair.track4.song.artist} - {pair.track4.song.title}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
