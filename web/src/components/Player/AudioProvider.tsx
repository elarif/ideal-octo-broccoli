import { useSyncExternalStore } from "react";
import type { AudioActions, AudioBook, AudioState, AudioTrack } from "../../types/audio";

interface AudioStore extends AudioState, AudioActions {}

const initialState: AudioState = {
  isPlaying: false,
  currentBook: null,
  currentTrackIndex: 0,
  currentTime: 0,
  duration: 0,
  volume: 1,
};

let state: AudioState = initialState;
const listeners = new Set<() => void>();
let audioEl: HTMLAudioElement | null = null;

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

function setState(updater: (prev: AudioState) => AudioState) {
  state = updater(state);
  emit();
}

let currentTrackUrl: string | null = null;

function ensureAudio(url: string) {
  if (currentTrackUrl === url && audioEl) return audioEl;
  if (audioEl) {
    audioEl.pause();
    audioEl.src = "";
    audioEl = null;
  }
  const audio = new Audio(url);
  audio.preload = "auto";
  audioEl = audio;
  currentTrackUrl = url;

  audio.addEventListener("timeupdate", () => setState((p) => ({ ...p, currentTime: audio.currentTime })));
  audio.addEventListener("loadedmetadata", () => setState((p) => ({ ...p, duration: audio.duration || 0 })));
  audio.addEventListener("ended", () => store.playNext());
  audio.addEventListener("play", () => setState((p) => ({ ...p, isPlaying: true })));
  audio.addEventListener("pause", () => setState((p) => ({ ...p, isPlaying: false })));

  return audio;
}

export const store: AudioStore = {
  ...initialState,

  playBook(book: AudioBook, trackIndex = 0) {
    const idx = Math.max(0, Math.min(trackIndex, book.tracks.length - 1));
    const track = book.tracks[idx];
    if (!track) return;
    setState(() => ({
      isPlaying: true,
      currentBook: book,
      currentTrackIndex: idx,
      currentTime: 0,
      duration: 0,
      volume: state.volume,
    }));
    const audio = ensureAudio(track.url);
    audio.volume = state.volume;
    audio.currentTime = 0;
    audio.play().catch(() => setState((p) => ({ ...p, isPlaying: false })));
  },

  togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) audioEl.play().catch(() => {});
    else audioEl.pause();
  },

  playNext() {
    if (!state.currentBook) return;
    const next = state.currentTrackIndex + 1;
    if (next < state.currentBook.tracks.length) {
      const track = state.currentBook.tracks[next];
      setState((p) => ({ ...p, currentTrackIndex: next, currentTime: 0, duration: 0, isPlaying: true }));
      const audio = ensureAudio(track.url);
      audio.volume = state.volume;
      audio.play().catch(() => setState((p) => ({ ...p, isPlaying: false })));
    } else {
      setState((p) => ({ ...p, isPlaying: false }));
    }
  },

  playPrevious() {
    if (!state.currentBook) return;
    const prev = Math.max(0, state.currentTrackIndex - 1);
    const track = state.currentBook.tracks[prev];
    setState((p) => ({ ...p, currentTrackIndex: prev, currentTime: 0, duration: 0, isPlaying: true }));
    const audio = ensureAudio(track.url);
    audio.volume = state.volume;
    audio.play().catch(() => setState((p) => ({ ...p, isPlaying: false })));
  },

  seek(time: number) {
    if (audioEl) audioEl.currentTime = time;
    setState((p) => ({ ...p, currentTime: time }));
  },

  setVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    if (audioEl) audioEl.volume = vol;
    setState((p) => ({ ...p, volume: vol }));
  },

  close() {
    audioEl?.pause();
    audioEl = null;
    currentTrackUrl = null;
    setState(() => ({ ...initialState, volume: state.volume }));
  },
};

export function useAudio(): AudioStore {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snapshot, ...store };
}