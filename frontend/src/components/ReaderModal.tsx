import { useEffect, useState, useRef, useCallback } from "react";
import { X, ExternalLink, Share2, Heart, BookOpen } from "lucide-react";
import type { WikiArticle } from "./WikiCard";
import { useLikedArticles } from "../contexts/LikedArticlesContext";

interface ReaderModalProps {
  article: WikiArticle;
  onClose: () => void;
}

export function ReaderModal({ article, onClose }: ReaderModalProps) {
  const { toggleLike, isLiked } = useLikedArticles();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger smooth enter transition on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Smooth exit transition handler
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, 280);
  }, [isClosing, onClose]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.displaytitle,
          text: article.extract || "",
          url: article.url,
        });
      } catch {
        // Ignored
      }
    } else {
      await navigator.clipboard.writeText(article.url);
      alert("Link copied to clipboard!");
    }
  };

  // Split extract into clean paragraphs
  const paragraphs = article.extract
    ? article.extract
        .split("\n\n")
        .flatMap((p) => p.split("\n"))
        .filter((p) => p.trim().length > 0)
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-title"
      className={`fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 transition-all duration-300 ease-out ${
        isVisible
          ? "bg-black/80 backdrop-blur-sm opacity-100 pointer-events-auto"
          : "bg-black/0 backdrop-blur-none opacity-0 pointer-events-none"
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full md:max-w-2xl bg-gray-900 border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-full md:translate-y-8 opacity-0 md:scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Drag Indicator */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-2.5 -mb-1 md:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10 bg-gray-900/90 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span className="text-xs uppercase tracking-wider font-semibold text-white/50">
              Article Reader
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleLike(article)}
              className={`p-2 rounded-full transition-colors ${
                isLiked(article.pageid)
                  ? "bg-red-500/20 text-red-400"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              aria-label="Like article"
            >
              <Heart
                className={`w-4 h-4 ${
                  isLiked(article.pageid) ? "fill-current" : ""
                }`}
              />
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Share article"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-1"
              aria-label="Close reader"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="overflow-y-auto p-5 md:p-8 space-y-5 text-white/90">
          {article.thumbnail?.source && (
            <div className="w-full max-h-64 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
              <img
                src={article.thumbnail.source}
                alt={article.displaytitle}
                className="max-h-64 w-auto object-contain mx-auto"
              />
            </div>
          )}

          <h1
            id="reader-title"
            className="text-2xl md:text-3xl font-extrabold text-white tracking-tight"
          >
            {article.displaytitle}
          </h1>

          <div className="space-y-4 text-base md:text-lg leading-relaxed text-gray-200">
            {paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <span className="text-xs text-white/40">
              Source: Wikipedia contributors under CC BY-SA 4.0
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-600/20"
            >
              <span>Read on Wikipedia</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
