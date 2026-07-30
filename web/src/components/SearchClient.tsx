import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

interface SearchDoc {
  slug: string;
  title: string;
  authors: string[];
  voices: string[];
  genres: string[];
}

interface Props {
  docs: SearchDoc[];
}

function normalize(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function SearchClient({ docs }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  const results = useMemo(() => {
    if (!debounced.trim()) return [];
    const terms = normalize(debounced).split(/\s+/).filter(Boolean);
    return docs.filter((doc) => {
      const haystack = normalize([doc.title, ...doc.authors, ...doc.voices, ...doc.genres].join(" "));
      return terms.every((t) => haystack.includes(t));
    }).slice(0, 24);
  }, [debounced, docs]);

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherche un livre audio gratuit"
            className="w-full border rounded pl-10 pr-3 py-2"
            aria-label="Rechercher"
          />
        </div>
      </form>

      {query && !results.length && <p className="text-gray-600">Aucun résultat pour « {query} ».</p>}

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((r) => (
          <li key={r.slug}>
            <a href={`/livre-audio-gratuit-mp3/${r.slug}.html`} className="block border rounded p-3 hover:shadow transition">
              <p className="font-medium">{r.title}</p>
              <p className="text-sm text-gray-600">{r.authors.join(", ")}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
