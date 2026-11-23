import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { WikiArticle } from "../lib/article";
import { articleLabel } from "../lib/article";
import type { Language } from "../languages";
import { searchArticles } from "../lib/wikiFeed";
import { useDialogBehavior } from "../hooks/useDialogBehavior";

interface SearchDialogProps {
  language: Language;
  hideSensitive: boolean;
  onClose: () => void;
  onOpen: (article: WikiArticle) => void;
}

export function SearchDialog({ language, hideSensitive, onClose, onOpen }: SearchDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<WikiArticle[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useDialogBehavior(true, onClose, dialogRef);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchArticles(language, query, controller.signal, hideSensitive)
        .then((articles) => {
          if (controller.signal.aborted) return;
          setResults(articles);
          setMessage(articles.length === 0 ? "No matching articles." : null);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setMessage("Search failed. Try again.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, language, hideSensitive]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
        tabIndex={-1}
        className="relative bg-gray-900 border border-white/10 p-6 rounded-2xl w-full max-w-2xl h-[80dvh] flex flex-col outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 end-4 p-1.5 text-white/60 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 id="search-title" className="text-xl font-bold mb-4 pe-10">
          Search Wikipedia
        </h2>
        <div className="relative mb-4">
          <label htmlFor="wiki-search" className="sr-only">
            Search Wikipedia
          </label>
          <input
            id="wiki-search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={`Search ${language.name} Wikipedia`}
            className="w-full bg-gray-800 text-white px-4 py-2.5 ps-10 rounded-xl border border-white/5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
          <Search className="w-4 h-4 text-white/50 absolute start-3.5 top-1/2 -translate-y-1/2" />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {term.trim().length >= 2 && searching && <p className="text-sm text-white/50">Searching...</p>}
          {term.trim().length >= 2 && message && <p className="text-sm text-white/50">{message}</p>}
          {(term.trim().length < 2 ? [] : results).map((article) => (
            <button
              key={`${article.lang}-${article.pageid}`}
              type="button"
              onClick={() => onOpen(article)}
              className="w-full text-start p-3 rounded-xl bg-white/5 hover:bg-white/10"
            >
              <span className="block font-semibold text-sm">{articleLabel(article)}</span>
              <span className="block text-xs text-white/60 line-clamp-2 mt-1">{article.extract}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
