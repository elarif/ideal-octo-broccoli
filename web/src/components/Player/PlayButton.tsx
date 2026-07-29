import { Play, Pause } from "lucide-react";
import { useAudio } from "./AudioProvider";
import type { AudioBook } from "../../types/audio";

interface Props {
  book: AudioBook;
  trackIndex?: number;
  className?: string;
  label?: string;
}

export function PlayButton({ book, trackIndex = 0, className = "", label }: Props) {
  const { currentBook, currentTrackIndex, isPlaying, playBook, togglePlay } = useAudio();
  const isThis = currentBook?.slug === book.slug && (trackIndex === undefined || currentBook.tracks[currentTrackIndex]?.id === book.tracks[trackIndex]?.id);

  const handleClick = () => {
    if (isThis) togglePlay();
    else playBook(book, trackIndex);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition ${className}`}
      aria-label={isThis && isPlaying ? "Pause" : "Lire"}
    >
      {isThis && isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
      {label && <span className="ml-2">{label}</span>}
    </button>
  );
}
