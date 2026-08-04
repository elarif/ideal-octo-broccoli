import { useEffect } from "react";
import { Volume2, Pause, X } from "lucide-react";
import { useAudio } from "./AudioProvider";
import { formatMediaTime } from "../../lib/format-media-time";

export function QueueDrawer() {
  const { currentBook, currentTrackIndex, isPlaying, isQueueOpen, playBook, closeQueue } = useAudio();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeQueue();
    }
    if (isQueueOpen) document.addEventListener("keydown", onKey);
    return () => { if (isQueueOpen) document.removeEventListener("keydown", onKey); };
  }, [isQueueOpen, closeQueue]);

  if (!isQueueOpen || !currentBook) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closeQueue}
        aria-hidden="true"
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-80 max-w-sm bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col transition-transform duration-200"
        role="dialog"
        aria-label="File d'attente"
      >
        <header className="flex items-center justify-between p-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="font-semibold">File d'attente</p>
            <p className="text-sm text-gray-600 truncate">{currentBook.title}</p>
          </div>
          <button onClick={closeQueue} aria-label="Fermer la file d'attente" className="p-1 text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </header>

        <ul className="flex-1 overflow-y-auto">
          {currentBook.tracks.map((track, index) => {
            const isCurrent = currentTrackIndex === index;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => playBook(currentBook, index)}
                  className={`flex items-center gap-3 w-full p-3 text-left border-b border-gray-100 hover:bg-gray-50 ${isCurrent ? "bg-primary/10" : ""}`}
                >
                  <span className="w-6 text-sm text-gray-500 tabular-nums text-right">{String(index + 1).padStart(2, "0")}</span>
                  {isCurrent && (isPlaying ? <Volume2 size={16} className="text-primary flex-shrink-0 animate-pulse" /> : <Pause size={16} className="text-primary flex-shrink-0" />)}
                  <span className={`flex-1 truncate ${isCurrent ? "font-medium" : ""}`}>{track.title}</span>
                  <span className="text-sm text-gray-500 tabular-nums">{formatMediaTime(track.duration)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}