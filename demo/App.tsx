import React, { useEffect, useState, useRef } from 'react';
import { HamiltonianPlayer } from './player/HamiltonianPlayer';
import type { PlayerState, TrackPair } from './player/HamiltonianPlayer';
import { songs } from '../src/music/songdata';
import type { Key, Tempo } from '../src/music/types';
import { ALL_KEYS, ALL_TEMPOS } from '../src/music/types';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Wake Lock API types
interface WakeLockSentinel {
  release(): Promise<void>;
}

function App() {
  const [player] = useState(() => new HamiltonianPlayer(songs as any[]));
  const [playerState, setPlayerState] = useState<PlayerState>(player.getState());
  const [currentTrack, setCurrentTrack] = useState<'intro' | 'main'>('intro');
  const [crossfader, setCrossfader] = useState(0.5); // 0 = all A, 0.5 = center, 1 = all B
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Wake Lock functionality
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock active');
        }
      } catch (err) {
        console.log('Wake Lock not supported or denied');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
      }
    };
  }, []);

  useEffect(() => {
    // Subscribe to player events
    const unsubscribeState = player.on('stateChange', (state) => {
      setPlayerState(state);
    });

    const unsubscribeIntro = player.on('introStart', () => {
      setCurrentTrack('intro');
    });

    const unsubscribeMain = player.on('mainStart', () => {
      setCurrentTrack('main');
    });

    const unsubscribeError = player.on('error', (error) => {
      console.error('Player error:', error);
    });

    return () => {
      unsubscribeState();
      unsubscribeIntro();
      unsubscribeMain();
      unsubscribeError();
    };
  }, [player]);

  const handlePlay = () => {
    void player.play();
  };

  const handlePause = () => {
    void player.pause();
  };

  const handleStop = () => {
    player.stop();
  };

  const handleSkipForward = () => {
    void player.skipForward();
  };

  const handleSkipBack = () => {
    void player.skipBack();
  };

  const handleKeyChange = (key: Key) => {
    player.setKey(key);
  };

  const handleTempoChange = (tempo: Tempo) => {
    player.setTempo(tempo);
  };

  const handleCrossfaderChange = (value: number) => {
    setCrossfader(value);
    player.setCrossfader(value);
  };

  return (
    <div className="app">
      {/* Playback Controls - Top */}
      <div className="controls">
        <button
          className="ctrl-btn"
          onClick={handleSkipBack}
          disabled={!playerState.canSkipBack || !playerState.isPlaying}
        >
          ⏮
        </button>
        {!playerState.isPlaying ? (
          <button className="ctrl-btn play" onClick={handlePlay}>▶</button>
        ) : (
          <button className="ctrl-btn" onClick={handlePause}>⏸</button>
        )}
        <button className="ctrl-btn" onClick={handleStop}>⏹</button>
        <button
          className="ctrl-btn"
          onClick={handleSkipForward}
          disabled={!playerState.canSkipForward || !playerState.isPlaying}
        >
          ⏭
        </button>
      </div>

      {/* Crossfader - Full Width */}
      <div className="crossfader-container">
        <div className="crossfader-label">A</div>
        <div className="crossfader-track">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crossfader}
            onChange={(e) => handleCrossfaderChange(parseFloat(e.target.value))}
            className="crossfader-slider"
          />
        </div>
        <div className="crossfader-label">B</div>
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
        </div>
      </div>

      {/* Now Playing */}
      {playerState.currentPair && (
        <div className="track-section">
          <div className="section-label">NOW PLAYING</div>
          <div className="track-row">
            <div className="track-num">1</div>
            <div className="track-info">
              <div className="track-title">{playerState.currentPair.track1.song.title}</div>
              <div className="track-artist">{playerState.currentPair.track1.song.artist}</div>
            </div>
          </div>
          <div className="track-row">
            <div className="track-num">2</div>
            <div className="track-info">
              <div className="track-title">{playerState.currentPair.track2.song.title}</div>
              <div className="track-artist">{playerState.currentPair.track2.song.artist}</div>
            </div>
          </div>
        </div>
      )}

      {/* Up Next */}
      {playerState.nextPair && (
        <div className="track-section">
          <div className="section-label">UP NEXT</div>
          <div className="track-row">
            <div className="track-num">1</div>
            <div className="track-info">
              <div className="track-title">{playerState.nextPair.track1.song.title}</div>
              <div className="track-artist">{playerState.nextPair.track1.song.artist}</div>
            </div>
          </div>
          <div className="track-row">
            <div className="track-num">2</div>
            <div className="track-info">
              <div className="track-title">{playerState.nextPair.track2.song.title}</div>
              <div className="track-artist">{playerState.nextPair.track2.song.artist}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
