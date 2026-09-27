'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Track } from '../types/track';
import { PLAYLIST } from '../data/playlist';
import { getEventSettings } from '../lib/settings';

interface AudioPlayerContextType {
  tracks: Track[];
  currentTrack: Track;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  isMuted: boolean;
  volume: number;
  isShuffle: boolean;
  isMinimized: boolean;
  isPlaylistOpen: boolean;
  activeFilter: string;
  showAutoplayPrompt: boolean;
  playTrack: (index?: number) => void;
  pauseAudio: () => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (progressPercent: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleMinimize: () => void;
  togglePlaylist: () => void;
  setActiveFilter: (filter: string) => void;
  dismissAutoplayPrompt: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>(PLAYLIST);
  const tracksRef = useRef<Track[]>(PLAYLIST);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.85);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAutoplayPrompt, setShowAutoplayPrompt] = useState(false);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Load custom tracks from event settings
  const refreshTracks = useCallback(async () => {
    try {
      const settings = await getEventSettings();
      if (settings && Array.isArray(settings.customTracks) && settings.customTracks.length > 0) {
        const existingIds = new Set(PLAYLIST.map((t) => t.id));
        const customUnique = settings.customTracks.filter((t) => !existingIds.has(t.id));
        setTracks([...PLAYLIST, ...customUnique]);
      } else {
        setTracks(PLAYLIST);
      }
    } catch (e) {
      console.warn('Error loading custom tracks:', e);
    }
  }, []);

  useEffect(() => {
    refreshTracks();

    const handleUpdate = () => {
      refreshTracks();
    };

    window.addEventListener('quilombo_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('quilombo_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshTracks]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = tracks[currentIndex] || tracks[0] || PLAYLIST[0];

  // Helper to sync Media Session API on mobile devices
  const updateMediaSession = useCallback((track: Track) => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'El Quilombo Oficial 2026',
        artwork: [
          { src: track.cover, sizes: '96x96', type: 'image/jpeg' },
          { src: track.cover, sizes: '128x128', type: 'image/jpeg' },
          { src: track.cover, sizes: '256x256', type: 'image/jpeg' },
          { src: track.cover, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    }
  }, []);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!audio.duration) return;
      const current = audio.currentTime;
      const dur = audio.duration;
      const pct = (current / dur) * 100;
      setCurrentTime(current);
      setDuration(dur);
      setProgress(pct);

      // Update CSS custom property for the slim top progress bar
      const dock = document.getElementById('quilombo-music-player');
      if (dock) {
        dock.style.setProperty('--player-progress', `${pct}%`);
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      // Auto next
      setCurrentIndex((prev) => (prev + 1) % (tracksRef.current.length || 1));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Initial load
    audio.src = currentTrack.src;
    updateMediaSession(currentTrack);

    // Attempt autoplay on mount
    audio.play().then(() => {
      setIsPlaying(true);
      setShowAutoplayPrompt(false);
    }).catch(() => {
      setIsPlaying(false);
      setShowAutoplayPrompt(true);
    });

    // Listen for first user interaction if browser blocked autoplay
    const onFirstGesture = () => {
      if (audioRef.current && !audioRef.current.paused) return;
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          setShowAutoplayPrompt(false);
        }).catch(() => {});
      }
      window.removeEventListener('click', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
    };

    window.addEventListener('click', onFirstGesture, { once: true });
    window.addEventListener('touchstart', onFirstGesture, { once: true });

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      window.removeEventListener('click', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
    };
  }, []);

  // Update track when currentIndex changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = currentTrack.src;
    audio.currentTime = 0;
    setProgress(0);
    const dock = document.getElementById('quilombo-music-player');
    if (dock) dock.style.setProperty('--player-progress', '0%');
    updateMediaSession(currentTrack);

    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentIndex, currentTrack, updateMediaSession]);

  // Sync Media Session playback state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  const playTrack = useCallback((index?: number) => {
    if (typeof index === 'number') {
      setCurrentIndex(index);
    }
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setShowAutoplayPrompt(false);
      }).catch(() => {});
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playTrack();
    }
  }, [isPlaying, pauseAudio, playTrack]);

  const nextTrack = useCallback(() => {
    const list = tracksRef.current;
    if (isShuffle) {
      let nextIdx: number;
      do {
        nextIdx = Math.floor(Math.random() * list.length);
      } while (nextIdx === currentIndex && list.length > 1);
      setCurrentIndex(nextIdx);
    } else {
      setCurrentIndex((prev) => (prev + 1) % list.length);
    }
    setIsPlaying(true);
  }, [isShuffle, currentIndex]);

  const prevTrack = useCallback(() => {
    const list = tracksRef.current;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
    }
    setIsPlaying(true);
  }, []);

  const seek = useCallback((progressPercent: number) => {
    if (audioRef.current && audioRef.current.duration) {
      const seekTime = (progressPercent / 100) * audioRef.current.duration;
      audioRef.current.currentTime = seekTime;
      setProgress(progressPercent);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = false;
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      audioRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const togglePlaylist = useCallback(() => {
    setIsPlaylistOpen((prev) => !prev);
  }, []);

  const dismissAutoplayPrompt = useCallback(() => {
    setShowAutoplayPrompt(false);
    playTrack();
  }, [playTrack]);

  return (
    <AudioPlayerContext.Provider
      value={{
        tracks,
        currentTrack,
        currentIndex,
        isPlaying,
        currentTime,
        duration,
        progress,
        isMuted,
        volume,
        isShuffle,
        isMinimized,
        isPlaylistOpen,
        activeFilter,
        showAutoplayPrompt,
        playTrack,
        pauseAudio,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleMinimize,
        togglePlaylist,
        setActiveFilter,
        dismissAutoplayPrompt,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
