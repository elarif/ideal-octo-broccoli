import { Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { useAudio } from "./AudioProvider";
import { formatMediaTime } from "../../lib/format-media-time";

export function GlobalPlayer() {
  const { currentBook, currentTrackIndex, isPlaying, currentTime, duration, volume, togglePlay, playNext, playPrevious, seek, setVolume, close } = useAudio();

  if (!currentBook) return null;

  const track = currentBook.tracks[currentTrackIndex];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg p-3">
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {currentBook.coverUrl && (
            <img src={currentBook.coverUrl} alt="" className="w-12 h-12 object-cover rounded" />
          )}
          <div className="min-w-0">
            <p className="font-medium truncate">{track?.title || currentBook.title}</p>
            <p className="text-sm text-gray-600 truncate">{currentBook.authorsLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={playPrevious} aria-label="Précédent"><SkipBack size={20} /></button>
          <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Lire"} className="p-2 rounded-full bg-primary text-white">
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button onClick={playNext} aria-label="Suivant"><SkipForward size={20} /></button>
        </div>

        <div className="hidden sm:flex items-center gap-2 flex-1">
          <span className="text-xs tabular-nums">{formatMediaTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="flex-1"
            aria-label="Progression"
          />
          <span className="text-xs tabular-nums">{formatMediaTime(duration)}</span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Volume2 size={18} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24"
            aria-label="Volume"
          />
        </div>

        <button onClick={close} aria-label="Fermer le lecteur"><X size={20} /></button>
      </div>
    </div>
  );
}
