import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AudioActions, AudioContextValue, AudioState, AudioTrack } from "../../types/audio";

const AudioContext = createContext<AudioContextValue | null>(null);

const SSR_DEFAULT: AudioContextValue = {
  isPlaying: false,
  currentBook: null,
  currentTrackIndex: 0,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playBook: () => {},
  togglePlay: () => {},
  playNext: () => {},
  playPrevious: () => {},
  seek: () => {},
  setVolume: () => {},
  close: () => {},
};

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    if (typeof window === "undefined") return SSR_DEFAULT;
    throw new Error("useAudio must be used inside AudioProvider");
  }
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function AudioProvider({ children }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentBook: null,
    currentTrackIndex: 0,
    currentTime: 0,
    duration: 0,
    volume: 1,
  });

  const currentTrack: AudioTrack | null = state.currentBook?.tracks[state.currentTrackIndex] ?? null;

  const actions = useMemo<AudioActions>(
    () => ({
      playBook: (book, trackIndex = 0) => {
        setState((prev) => ({
          ...prev,
          currentBook: book,
          currentTrackIndex: Math.max(0, Math.min(trackIndex, book.tracks.length - 1)),
          isPlaying: true,
          currentTime: 0,
          duration: 0,
        }));
      },
      togglePlay: () => {
        setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
      },
      playNext: () => {
        setState((prev) => {
          const book = prev.currentBook;
          if (!book) return prev;
          const next = prev.currentTrackIndex + 1;
          if (next < book.tracks.length) {
            return { ...prev, currentTrackIndex: next, isPlaying: true, currentTime: 0, duration: 0 };
          }
          return { ...prev, isPlaying: false };
        });
      },
      playPrevious: () => {
        setState((prev) => {
          const book = prev.currentBook;
          if (!book) return prev;
          const previous = Math.max(0, prev.currentTrackIndex - 1);
          return { ...prev, currentTrackIndex: previous, isPlaying: true, currentTime: 0, duration: 0 };
        });
      },
      seek: (time) => {
        setState((prev) => ({ ...prev, currentTime: time }));
        const audio = audioRef.current;
        if (audio) audio.currentTime = time;
      },
      setVolume: (volume) => {
        setState((prev) => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
      },
      close: () => {
        audioRef.current?.pause();
        setState((prev) => ({
          ...prev,
          currentBook: null,
          currentTrackIndex: 0,
          currentTime: 0,
          duration: 0,
          isPlaying: false,
        }));
      },
    }),
    [],
  );

  useEffect(() => {
    if (!currentTrack) return;
    const audio = new Audio(currentTrack.url);
    audio.volume = state.volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
    const onLoadedMetadata = () => setState((prev) => ({ ...prev, duration: audio.duration || 0 }));
    const onEnded = () => actions.playNext();
    const onPlay = () => setState((prev) => ({ ...prev, isPlaying: true }));
    const onPause = () => setState((prev) => ({ ...prev, isPlaying: false }));

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    if (state.isPlaying) {
      audio.play().catch(() => setState((prev) => ({ ...prev, isPlaying: false })));
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
    if (state.isPlaying && audio.paused) {
      audio.play().catch(() => setState((prev) => ({ ...prev, isPlaying: false })));
    } else if (!state.isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [state.isPlaying, currentTrack?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume;
  }, [state.volume]);

  const value: AudioContextValue = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}
