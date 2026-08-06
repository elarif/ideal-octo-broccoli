import { Pause, Play, SkipBack, SkipForward, Volume2, X, Check, Download, ListMusic, Repeat, Repeat1 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAudio } from "./AudioProvider";
import { QueueDrawer } from "./QueueDrawer";
import { formatMediaTime } from "../../lib/format-media-time";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

function formatRate(r: number): string {
  return `${r}x`;
}

function SpeedDropdown({ current, onSelect, onClose }: { current: number; onSelect: (r: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full mb-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[80px]">
      {PLAYBACK_RATES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => { onSelect(r); onClose(); }}
          className="flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          <span>{formatRate(r)}</span>
          {r === current && <Check size={14} className="text-primary" />}
        </button>
      ))}
    </div>
  );
}

export function GlobalPlayer() {
  const { currentBook, currentTrackIndex, isPlaying, currentTime, duration, volume, playbackRate, repeatMode, isQueueOpen, togglePlay, playNext, playPrevious, seek, setVolume, setPlaybackRate, toggleRepeat, toggleQueue, close } = useAudio();
  const [speedOpen, setSpeedOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function downloadCurrentTrack() {
    if (!track || downloading) return;
    setDownloading(true);
    try {
      const resp = await fetch(track.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const order = String(currentTrackIndex + 1).padStart(2, "0");
      a.download = `${order}_${track.slug || track.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Échec du téléchargement.");
    } finally {
      setDownloading(false);
    }
  }

  if (!currentBook) return <div className="global-player-placeholder hidden" aria-hidden="true" />;

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
          <button
            type="button"
            onClick={toggleRepeat}
            aria-label="Répétition"
            className="p-1"
          >
            {repeatMode === "one" ? (
              <Repeat1 size={18} className="text-primary" />
            ) : (
              <Repeat size={18} className={repeatMode === "all" ? "text-primary" : "text-gray-500"} />
            )}
          </button>
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

        <div className="relative">
          <button
            type="button"
            onClick={() => setSpeedOpen((v) => !v)}
            aria-label="Vitesse de lecture"
            className="px-2 py-1 text-sm rounded hover:bg-gray-100 tabular-nums min-w-[44px]"
          >
            {formatRate(playbackRate)}
          </button>
          {speedOpen && (
            <SpeedDropdown
              current={playbackRate}
              onSelect={setPlaybackRate}
              onClose={() => setSpeedOpen(false)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={downloadCurrentTrack}
          disabled={!track || downloading}
          aria-label="Télécharger cette piste"
          className="p-1 text-gray-600 hover:text-primary disabled:opacity-50"
        >
          <Download size={20} className={downloading ? "animate-pulse" : ""} />
        </button>

        <button
          type="button"
          onClick={toggleQueue}
          disabled={!currentBook}
          aria-label="File d'attente"
          className="p-1 text-gray-600 hover:text-primary disabled:opacity-50"
        >
          <ListMusic size={20} />
        </button>

        <button onClick={close} aria-label="Fermer le lecteur"><X size={20} /></button>
      </div>
      <QueueDrawer />
    </div>
  );
}