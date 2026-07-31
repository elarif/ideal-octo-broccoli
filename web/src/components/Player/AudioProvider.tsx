import { useEffect, useState } from "react";
import type { AudioActions, AudioBook, AudioState, AudioTrack } from "../../types/audio";

interface AudioStore extends AudioState, AudioActions {}

declare global {
  interface Window {
    __AUDIO_STORE__?: AudioStore & {
      _state: AudioState;
      _listeners: Set<() => void>;
      _audioEl: HTMLAudioElement | null;
      _version: number;
      _emit: () => void;
      _ensureAudio: (url: string) => HTMLAudioElement;
    };
  }
}

const initialState: AudioState = {
  isPlaying: false,
  currentBook: null,
  currentTrackIndex: 0,
  currentTime: 0,
  duration: 0,
  volume: 1,
};

function createStore(): AudioStore & {
  _state: AudioState;
  _listeners: Set<() => void>;
  _audioEl: HTMLAudioElement | null;
  _version: number;
  _emit: () => void;
  _ensureAudio: (url: string) => HTMLAudioElement;
} {
  const self: AudioStore & {
    _state: AudioState;
    _listeners: Set<() => void>;
    _audioEl: HTMLAudioElement | null;
    _version: number;
    _emit: () => void;
    _ensureAudio: (url: string) => HTMLAudioElement;
  } = {
    ...initialState,
    _state: initialState,
    _listeners: new Set(),
    _audioEl: null,
    _version: 0,

    playBook(book: AudioBook, trackIndex = 0) {
      const idx = Math.max(0, Math.min(trackIndex, book.tracks.length - 1));
      const track = book.tracks[idx];
      if (!track) return;
      self._state = {
        isPlaying: true,
        currentBook: book,
        currentTrackIndex: idx,
        currentTime: 0,
        duration: 0,
        volume: self._state.volume,
      };
      self._emit();
      const audio = self._ensureAudio(track.url);
      audio.volume = self._state.volume;
      audio.currentTime = 0;
      audio.play().catch(() => {
        self._state = { ...self._state, isPlaying: false };
        self._emit();
      });
    },

    togglePlay() {
      const audio = self._audioEl;
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    },

    playNext() {
      const book = self._state.currentBook;
      if (!book) return;
      const next = self._state.currentTrackIndex + 1;
      if (next < book.tracks.length) {
        const track = book.tracks[next];
        self._state = { ...self._state, currentTrackIndex: next, currentTime: 0, duration: 0, isPlaying: true };
        self._emit();
        const audio = self._ensureAudio(track.url);
        audio.volume = self._state.volume;
        audio.play().catch(() => {
          self._state = { ...self._state, isPlaying: false };
          self._emit();
        });
      } else {
        self._state = { ...self._state, isPlaying: false };
        self._emit();
      }
    },

    playPrevious() {
      const book = self._state.currentBook;
      if (!book) return;
      const prev = Math.max(0, self._state.currentTrackIndex - 1);
      const track = book.tracks[prev];
      self._state = { ...self._state, currentTrackIndex: prev, currentTime: 0, duration: 0, isPlaying: true };
      self._emit();
      const audio = self._ensureAudio(track.url);
      audio.volume = self._state.volume;
      audio.play().catch(() => {
        self._state = { ...self._state, isPlaying: false };
        self._emit();
      });
    },

    seek(time: number) {
      if (self._audioEl) self._audioEl.currentTime = time;
      self._state = { ...self._state, currentTime: time };
      self._emit();
    },

    setVolume(v: number) {
      const vol = Math.max(0, Math.min(1, v));
      if (self._audioEl) self._audioEl.volume = vol;
      self._state = { ...self._state, volume: vol };
      self._emit();
    },

    close() {
      self._audioEl?.pause();
      self._audioEl = null;
      self._state = { ...initialState, volume: self._state.volume };
      self._emit();
    },

    _emit() {
      self._version += 1;
      for (const l of self._listeners) l();
    },

    _ensureAudio(url: string) {
      const currentUrl = self._audioEl?.src || null;
      if (currentUrl === url && self._audioEl) return self._audioEl;
      if (self._audioEl) {
        self._audioEl.pause();
        self._audioEl.src = "";
        self._audioEl = null;
      }
      const audio = new Audio(url);
      audio.preload = "auto";
      self._audioEl = audio;

      audio.addEventListener("timeupdate", () => {
        self._state = { ...self._state, currentTime: audio.currentTime };
        self._emit();
      });
      audio.addEventListener("loadedmetadata", () => {
        self._state = { ...self._state, duration: audio.duration || 0 };
        self._emit();
      });
      audio.addEventListener("ended", () => self.playNext());
      audio.addEventListener("play", () => {
        self._state = { ...self._state, isPlaying: true };
        self._emit();
      });
      audio.addEventListener("pause", () => {
        self._state = { ...self._state, isPlaying: false };
        self._emit();
      });

      return audio;
    },
  };

  return self;
}

function getStore() {
  if (typeof window !== "undefined") {
    if (!window.__AUDIO_STORE__) {
      window.__AUDIO_STORE__ = createStore();
    }
    return window.__AUDIO_STORE__;
  }
  return createStore();
}

export const store = getStore();

export function useAudio(): AudioStore {
  const [, forceRender] = useState({});

  useEffect(() => {
    const listener = () => forceRender({});
    store._listeners.add(listener);
    return () => { store._listeners.delete(listener); };
  }, []);

  return { ...store, ...store._state };
}