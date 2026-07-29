import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AudioActions, AudioBook, AudioContextValue, AudioTrack } from "../../types/audio";

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used inside AudioProvider");
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function AudioProvider({ children }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBook, setCurrentBook] = useState<AudioBook | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const currentTrack: AudioTrack | null = currentBook?.tracks[currentTrackIndex] ?? null;

  useEffect(() => {
    if (!currentTrack) return;
    const audio = new Audio(currentTrack.url);
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => actions.playNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    audio.play().catch(() => setIsPlaying(false));

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
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const actions = useMemo<AudioActions>(() => ({
    playBook: (book, trackIndex = 0) => {
      setCurrentBook(book);
      setCurrentTrackIndex(Math.max(0, Math.min(trackIndex, book.tracks.length - 1)));
    },
    togglePlay: () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    },
    playNext: () => {
      if (!currentBook) return;
      const next = currentTrackIndex + 1;
      if (next < currentBook.tracks.length) setCurrentTrackIndex(next);
      else setIsPlaying(false);
    },
    playPrevious: () => {
      if (!currentBook) return;
      const prev = Math.max(0, currentTrackIndex - 1);
      setCurrentTrackIndex(prev);
    },
    seek: (time) => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = time;
    },
    setVolume: (v) => setVolumeState(Math.max(0, Math.min(1, v))),
    close: () => {
      audioRef.current?.pause();
      setCurrentBook(null);
      setCurrentTrackIndex(0);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    },
  }), [currentBook, currentTrackIndex]);

  const value: AudioContextValue = {
    isPlaying,
    currentBook,
    currentTrackIndex,
    currentTime,
    duration,
    volume,
    ...actions,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}
