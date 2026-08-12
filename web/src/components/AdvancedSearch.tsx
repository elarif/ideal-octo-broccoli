import { useState, useEffect, useMemo, useCallback } from "react";
import { RotateCcw } from "lucide-react";

interface FilterEntry {
  s: string;
  t: string;
  a: string[];
  v: string[];
  g: string[];
  p: string[];
  r: string[];
  l: string[];
  d: number;
  w: number;
}

const PAGE_SIZE = 20;

function parseQueryString(): { genres: string[]; voices: string[]; authors: string[]; dureeMin: number; dureeMax: number } {
  const params = new URLSearchParams(window.location.search);
  const genres = params.get("genres")?.split(",").filter(Boolean) || [];
  const voices = params.get("voix")?.split(",").filter(Boolean) || [];
  const authors = params.get("auteurs")?.split(",").filter(Boolean) || [];
  const duree = params.get("duree");
  let dureeMin = 0;
  let dureeMax = 0;
  if (duree) {
    const [min, max] = duree.split("-").map(Number);
    if (!Number.isNaN(min)) dureeMin = min;
    if (!Number.isNaN(max)) dureeMax = max;
  }
  return { genres, voices, authors, dureeMin, dureeMax };
}

export default function AdvancedSearch() {
  const [entries, setEntries] = useState<FilterEntry[]>([]);
  const [error, setError] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [voices, setVoices] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [dureeMin, setDureeMin] = useState(0);
  const [dureeMax, setDureeMax] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("/search-filters.json", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: FilterEntry[]) => {
        setEntries(data);
        const initial = parseQueryString();
        setGenres(initial.genres);
        setVoices(initial.voices);
        setAuthors(initial.authors);
        setDureeMin(initial.dureeMin);
        setDureeMax(initial.dureeMax);
      })
      .catch(() => setError(true))
      .finally(() => clearTimeout(timeout));
  }, []);

  const allGenres = useMemo(() => [...new Set(entries.flatMap((e) => e.g))].sort(), [entries]);
  const allVoices = useMemo(() => [...new Set(entries.flatMap((e) => e.v))].sort(), [entries]);
  const allAuthors = useMemo(() => [...new Set(entries.flatMap((e) => e.a))].sort(), [entries]);
  const maxDuration = useMemo(() => entries.reduce((m, e) => Math.max(m, e.d), 0), [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (genres.length) result = result.filter((e) => genres.some((g) => e.g.includes(g)));
    if (voices.length) result = result.filter((e) => voices.some((v) => e.v.includes(v)));
    if (authors.length) result = result.filter((e) => authors.some((a) => e.a.includes(a)));
    if (dureeMax > 0) result = result.filter((e) => e.d >= dureeMin && e.d <= dureeMax);
    return [...result].sort((a, b) => b.w - a.w);
  }, [entries, genres, voices, authors, dureeMin, dureeMax]);

  useEffect(() => {
    setPage(0);
  }, [genres, voices, authors, dureeMin, dureeMax]);

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (genres.length) params.set("genres", genres.join(","));
    if (voices.length) params.set("voix", voices.join(","));
    if (authors.length) params.set("auteurs", authors.join(","));
    if (dureeMax > 0) params.set("duree", `${dureeMin}-${dureeMax}`);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [genres, voices, authors, dureeMin, dureeMax]);

  useEffect(() => { syncUrl(); }, [syncUrl]);

  const reset = () => {
    setGenres([]);
    setVoices([]);
    setAuthors([]);
    setDureeMin(0);
    setDureeMax(0);
  };

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (slug: string) => {
    setter((prev) => prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]);
  };

  const pageResults = filtered.slice(0, (page + 1) * PAGE_SIZE);

  if (error) {
    return <p className="text-gray-600">Filtres indisponibles. Réessayez plus tard.</p>;
  }

  if (entries.length === 0) {
    return <p className="text-gray-600">Chargement des filtres…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <fieldset>
          <legend className="font-medium mb-2">Genres</legend>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {allGenres.map((g) => (
              <button
                key={g}
                onClick={() => toggle(setGenres)(g)}
                className={`px-2 py-1 text-sm rounded border ${genres.includes(g) ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium mb-2">Voix</legend>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {allVoices.map((v) => (
              <button
                key={v}
                onClick={() => toggle(setVoices)(v)}
                className={`px-2 py-1 text-sm rounded border ${voices.includes(v) ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium mb-2">Auteurs</legend>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {allAuthors.map((a) => (
              <button
                key={a}
                onClick={() => toggle(setAuthors)(a)}
                className={`px-2 py-1 text-sm rounded border ${authors.includes(a) ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium mb-2">Durée (minutes)</legend>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={maxDuration} value={dureeMin || ""} onChange={(e) => setDureeMin(Number(e.target.value) || 0)} placeholder="min" className="w-20 border rounded px-2 py-1" />
            <span>—</span>
            <input type="number" min={0} max={maxDuration} value={dureeMax || ""} onChange={(e) => setDureeMax(Number(e.target.value) || 0)} placeholder="max" className="w-20 border rounded px-2 py-1" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Max : {Math.round(maxDuration / 60)} min</p>
        </fieldset>
      </div>

      <button onClick={reset} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary">
        <RotateCcw size={14} /> Réinitialiser
      </button>

      <p className="text-sm text-gray-600">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pageResults.map((e) => (
          <a key={e.s} href={`/livre-audio-gratuit-mp3/${e.s}.html`} className="block border rounded p-3 hover:shadow transition">
            <p className="font-medium text-sm truncate">{e.t}</p>
            <p className="text-xs text-gray-600 truncate">{e.a.join(", ") || "—"}</p>
            <p className="text-xs text-gray-500">{Math.round(e.d / 60)} min</p>
          </a>
        ))}
      </div>

      {pageResults.length < filtered.length && (
        <button onClick={() => setPage((p) => p + 1)} className="block mx-auto px-4 py-2 border rounded hover:bg-gray-100">
          Charger plus
        </button>
      )}

      <p className="text-sm text-gray-500">
        <a href="/recherche.html" className="text-primary hover:underline">Recherche plein texte →</a>
      </p>
    </div>
  );
}