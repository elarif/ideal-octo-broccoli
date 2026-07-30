import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { AudioActions, AudioContextValue, AudioState, AudioTrack } from "../../types/audio";

const state: AudioState = {
  isPlaying: false,
  currentBook: null,
  currentTrackIndex: 0,
  currentTime: 0,
  duration: 0,
  volume: 1,
};

const listeners = new Set<() => void>();

function getState(): AudioState {
  return { ...state };
}

function setState(updates: Partial<AudioState>): void {
  Object.assign(state, updates);
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

interface AudioController {
  seek: (time: number) => void;
}

let controller: AudioController | null = null;

const actions: AudioActions = {
  playBook: (book, trackIndex = 0) => {
    setState({
      currentBook: book,
      currentTrackIndex: Math.max(0, Math.min(trackIndex, book.tracks.length - 1)),
      isPlaying: true,
      currentTime: 0,
      duration: 0,
    });
  },
  togglePlay: () => {
    setState({ isPlaying: !state.isPlaying });
  },
  playNext: () => {
    const book = state.currentBook;
    if (!book) return;
    const next = state.currentTrackIndex + 1;
    if (next < book.tracks.length) {
      setState({ currentTrackIndex: next, isPlaying: true, currentTime: 0, duration: 0 });
    } else {
      setState({ isPlaying: false });
    }
  },
  playPrevious: () => {
    const book = state.currentBook;
    if (!book) return;
    const prev = Math.max(0, state.currentTrackIndex - 1);
    setState({ currentTrackIndex: prev, isPlaying: true, currentTime: 0, duration: 0 });
  },
  seek: (time) => {
    setState({ currentTime: time });
    controller?.seek(time);
  },
  setVolume: (volume) => {
    setState({ volume: Math.max(0, Math.min(1, volume)) });
  },
  close: () => {
    setState({
      currentBook: null,
      currentTrackIndex: 0,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    });
  },
};

export function useAudio(): AudioContextValue {
  const snapshot = useSyncExternalStore(subscribe, getState);
  return { ...snapshot, ...actions };
}

interface Props {
  children: ReactNode;
}

export function AudioProvider({ children }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { currentBook, currentTrackIndex, isPlaying, volume } = useAudio();
  const currentTrack: AudioTrack | null = currentBook?.tracks[currentTrackIndex] ?? null;

  useEffect(() => {
    controller = {
      seek: (time) => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = time;
      },
    };
    return () => {
      controller = null;
    };
  }, []);

  useEffect(() => {
    if (!currentTrack) return;
    const audio = new Audio(currentTrack.url);
    audio.volume = getState().volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setState({ currentTime: audio.currentTime });
    const onLoadedMetadata = () => setState({ duration: audio.duration || 0 });
    const onEnded = () => actions.playNext();
    const onPlay = () => setState({ isPlaying: true });
    const onPause = () => setState({ isPlaying: false });

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    if (isPlaying) {
      audio.play().catch(() => setState({ isPlaying: false }));
    }

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audioRef.current = null;
    };
  }, [currentTrack?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying && audio.paused) {
      audio.play().catch(() => setState({ isPlaying: false }));
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return <>{children}</>;
}
