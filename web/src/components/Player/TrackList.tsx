import { Play, Pause, Download } from "lucide-react";
import { useAudio } from "./AudioProvider";
import { formatMediaTime } from "../../lib/format-media-time";
import type { AudioBook } from "../../types/audio";

interface Props {
  book: AudioBook;
}

export function TrackList({ book }: Props) {
  const { currentBook, currentTrackIndex, isPlaying, playBook, togglePlay } = useAudio();
  const isThisBook = currentBook?.slug === book.slug;

  return (
    <ul className="space-y-2">
      {book.tracks.map((track, index) => {
        const isCurrent = isThisBook && currentTrackIndex === index;
        return (
          <li key={track.id} className="flex items-center gap-3 p-2 rounded border hover:bg-gray-50">
            <button
              onClick={() => (isCurrent ? togglePlay() : playBook(book, index))}
              className="p-2 rounded-full bg-primary text-white"
              aria-label={isCurrent && isPlaying ? "Pause" : `Lire ${track.title}`}
            >
              {isCurrent && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <span className="flex-1">{track.title}</span>
            {track.duration > 0 && <span className="text-sm text-gray-600">{formatMediaTime(track.duration)}</span>}
            <a href={track.url} download className="p-2 text-primary hover:text-primary/80" aria-label="Télécharger">
              <Download size={18} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
