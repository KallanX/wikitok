import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import type { WikiArticle } from "./WikiCard";

interface LightboxModalProps {
  article: WikiArticle;
  onClose: () => void;
}

export function LightboxModal({ article, onClose }: LightboxModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-md"
        aria-label="Close image lightbox"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={article.thumbnail.source}
          alt={article.displaytitle}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
        />

        <div className="mt-4 flex items-center justify-between w-full px-2 text-white/80 text-sm">
          <span className="font-medium truncate max-w-md">
            {article.displaytitle}
          </span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors ml-4"
          >
            <span>View on Wikipedia</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
