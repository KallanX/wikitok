import { useRef } from "react";
import { X, BookOpen } from "lucide-react";
import type { WikiArticle } from "../lib/article";
import { articleLabel } from "../lib/article";
import { likeKey } from "../lib/likeKey";
import { useDialogBehavior } from "../hooks/useDialogBehavior";

interface HistoryDialogProps {
  articles: WikiArticle[];
  onClose: () => void;
  onOpen: (article: WikiArticle) => void;
}

export function HistoryDialog({ articles, onClose, onOpen }: HistoryDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(true, onClose, dialogRef);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        tabIndex={-1}
        className="relative bg-gray-900 border border-white/10 p-6 rounded-2xl w-full max-w-2xl h-[80dvh] flex flex-col outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 end-4 p-1.5 text-white/60 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 id="history-title" className="text-xl font-bold mb-4 pe-10">
          Recently viewed
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {articles.length === 0 && (
            <p className="text-sm text-white/50 h-40 flex items-center justify-center">
              Articles you stop on will show up here.
            </p>
          )}
          {articles.map((article) => (
            <button
              key={likeKey(article)}
              type="button"
              onClick={() => onOpen(article)}
              className="w-full flex gap-3 text-start p-3 rounded-xl bg-white/5 hover:bg-white/10"
            >
              {article.thumbnail?.source && (
                <img src={article.thumbnail.source} alt="" className="w-14 h-14 object-cover rounded-lg" />
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold text-sm">
                  <BookOpen className="w-3.5 h-3.5 text-blue-300" />
                  {articleLabel(article)}
                </span>
                <span className="block text-xs text-white/60 line-clamp-2 mt-1">{article.extract}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
