import { useState, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";

interface PagefindResult {
  id: string;
  data: () => Promise<{
    meta: { title?: string; author?: string; duration?: string; url: string };
    excerpt: string;
  }>;
  url: string;
}

interface PagefindModule {
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

let pagefind: PagefindModule | null = null;

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ title: string; author?: string; duration?: string; url: string; excerpt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadPagefind = useCallback(async () => {
    if (pagefind) return pagefind;
    try {
      pagefind = await import(/* @vite-ignore */ "/pagefind/pagefind.js");
      setLoaded(true);
      return pagefind;
    } catch {
      return null;
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const pf = await loadPagefind();
    if (!pf) {
      setLoading(false);
      return;
    }
    try {
      const { results: raw } = await pf.search(q);
      const enriched = await Promise.all(
        raw.slice(0, 30).map(async (r) => {
          const data = await r.data();
          return {
            title: data.meta.title || "(sans titre)",
            author: data.meta.author,
            duration: data.meta.duration,
            url: r.url,
            excerpt: data.excerpt,
          };
        })
      );
      setResults(enriched);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [loadPagefind]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  };

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={query}
            onChange={onChange}
            onFocus={loadPagefind}
            placeholder="Recherchez parmi 5000+ livres audio gratuits"
            className="w-full border rounded pl-10 pr-3 py-2"
            aria-label="Rechercher"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={18} />}
        </div>
      </form>

      {!query && loaded && <p className="text-gray-600">Tapez un mot-clé pour rechercher dans le contenu des livres audio.</p>}

      {query && !loading && results.length === 0 && loaded && (
        <p className="text-gray-600">Aucun résultat pour « {query} ».</p>
      )}

      {query && !loaded && !loading && (
        <p className="text-gray-600">Index de recherche indisponible. Réessayez plus tard.</p>
      )}

      <ul className="space-y-3">
        {results.map((r, i) => (
          <li key={i}>
            <a href={r.url} className="block border rounded p-3 hover:shadow transition">
              <p className="font-medium">{r.title}</p>
              {r.author && <p className="text-sm text-gray-600">{r.author}</p>}
              {r.duration && <p className="text-xs text-gray-500">{r.duration}</p>}
              <p className="text-sm text-gray-600 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: r.excerpt }} />
            </a>
          </li>
        ))}
      </ul>

      {results.length > 0 && (
        <p className="text-sm text-gray-500">
          <a href="/recherche-avancee.html" className="text-primary hover:underline">Recherche par filtres →</a>
        </p>
      )}
    </div>
  );
}