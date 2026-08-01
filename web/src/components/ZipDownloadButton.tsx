import { useState } from "react";
import JSZip from "jszip";
import { Download } from "lucide-react";

interface Track {
  title: string;
  url: string;
}

interface Props {
  title: string;
  tracks: Track[];
}

function safeFileName(input: string): string {
  return input.replace(/[/\\:?*"<>|]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function ZipDownloadButton({ title, tracks }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || tracks.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const folderName = safeFileName(title) || "livre-audio";
      const folder = zip.folder(folderName) || zip;
      await Promise.all(
        tracks.map(async (track, i) => {
          const resp = await fetch(track.url);
          if (!resp.ok) throw new Error(`Failed to fetch ${track.url}`);
          const blob = await resp.blob();
          const rawExt = track.url.split(".").pop()?.replace(/\?.*$/, "") || "mp3";
          const ext = /^(mp3|m4a|ogg|wav|flac)$/i.test(rawExt) ? rawExt : "mp3";
          const fileName = `${String(i + 1).padStart(2, "0")}_${safeFileName(track.title) || `piste-${i + 1}`}.${ext}`;
          folder.file(fileName, blob);
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Le téléchargement du ZIP a échoué.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || tracks.length === 0}
      className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
    >
      <Download size={18} />
      {busy ? "Préparation…" : "Télécharger tout (ZIP)"}
    </button>
  );
}
