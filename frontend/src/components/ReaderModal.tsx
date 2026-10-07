import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  X,
  ExternalLink,
  Share2,
  Heart,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import type { WikiArticle } from "./WikiCard";
import { useLikedArticles } from "../hooks/useLikedArticles";
import { useLocalization } from "../hooks/useLocalization";
import { useDialogBehavior } from "../hooks/useDialogBehavior";
import { useShareArticle } from "../hooks/useShareArticle";
import { prepareWikipediaHtml } from "../lib/wikiHtml";
import { isRtlLanguage, languageFromId, languageIdFromArticle } from "../lib/language";
import { prefersReducedMotion } from "../lib/motion";

interface WikiParseResponse {
  parse?: {
    title?: string;
    pageid?: number;
    text?: {
      "*"?: string;
    };
  };
  error?: {
    code?: string;
    info?: string;
  };
}

interface ReaderModalProps {
  article: WikiArticle;
  onClose: () => void;
}

export function ReaderModal({ article, onClose }: ReaderModalProps) {
  const { toggleLike, isLiked } = useLikedArticles();
  const { currentLanguage } = useLocalization();
  const { message: shareMessage, share } = useShareArticle();
  const liked = isLiked(article);
  const articleLanguageId = languageIdFromArticle(article);
  const articleLanguage = languageFromId(articleLanguageId) ?? currentLanguage;

  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isEligibleHeaderDragRef = useRef(false);
  const isContentTopDragRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, prefersReducedMotion() ? 0 : 280);
  }, [isClosing, onClose]);

  useDialogBehavior(true, handleClose, dialogRef);

  const handleHeaderTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    touchStartYRef.current = event.touches[0].clientY;
    touchStartXRef.current = event.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
    currentDragYRef.current = 0;
    isEligibleHeaderDragRef.current = true;
    setIsDragging(true);
  };

  const handleHeaderTouchMove = (event: React.TouchEvent) => {
    if (!isEligibleHeaderDragRef.current) return;
    const deltaY = event.touches[0].clientY - touchStartYRef.current;
    if (deltaY > 0) {
      currentDragYRef.current = deltaY;
      setDragY(deltaY);
    } else {
      const dampened = Math.max(-20, deltaY * 0.15);
      currentDragYRef.current = dampened;
      setDragY(dampened);
    }
  };

  const handleHeaderTouchEnd = () => {
    if (!isEligibleHeaderDragRef.current) return;
    isEligibleHeaderDragRef.current = false;
    setIsDragging(false);

    const elapsed = Date.now() - touchStartTimeRef.current;
    const finalDragY = currentDragYRef.current;
    const velocity = finalDragY / Math.max(elapsed, 1);

    if (finalDragY > 80 || (finalDragY > 35 && velocity > 0.4)) {
      handleClose();
    } else {
      currentDragYRef.current = 0;
      setDragY(0);
    }
  };

  const handleContentTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    touchStartYRef.current = event.touches[0].clientY;
    touchStartXRef.current = event.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
    currentDragYRef.current = 0;
    isContentTopDragRef.current = !contentRef.current || contentRef.current.scrollTop <= 0;
  };

  const handleContentTouchMove = (event: React.TouchEvent) => {
    if (!isContentTopDragRef.current) return;
    const deltaY = event.touches[0].clientY - touchStartYRef.current;
    const deltaX = Math.abs(event.touches[0].clientX - touchStartXRef.current);

    if (!isDragging) {
      if (deltaY > 10 && deltaY > deltaX && (!contentRef.current || contentRef.current.scrollTop <= 0)) {
        setIsDragging(true);
        currentDragYRef.current = deltaY;
        setDragY(deltaY);
      }
    } else {
      const positiveDelta = Math.max(0, deltaY);
      currentDragYRef.current = positiveDelta;
      setDragY(positiveDelta);
    }
  };

  const handleContentTouchEnd = () => {
    isContentTopDragRef.current = false;
    if (!isDragging) return;
    setIsDragging(false);
    const elapsed = Date.now() - touchStartTimeRef.current;
    const finalDragY = currentDragYRef.current;
    const velocity = finalDragY / Math.max(elapsed, 1);

    if (finalDragY > 80 || (finalDragY > 35 && velocity > 0.4)) {
      handleClose();
    } else {
      currentDragYRef.current = 0;
      setDragY(0);
    }
  };

  const handleShare = () => {
    void share({
      title: article.displaytitle,
      text: article.extract || "",
      url: article.url,
    });
  };

  const fetchFullArticle = async () => {
    if (fullHtml) {
      setIsExpanded(true);
      return;
    }

    setLoadingFullText(true);
    setLoadError(null);

    try {
      let rawHtml = "";
      const load = async (query: Record<string, string>) => {
        const params = new URLSearchParams({
          action: "parse",
          format: "json",
          prop: "text",
          origin: "*",
          variant: articleLanguage.id,
          ...query,
        });
        const response = await fetch(`${articleLanguage.api}${params.toString()}`);
        if (!response.ok) return "";
        const data = (await response.json()) as WikiParseResponse;
        return data?.parse?.text?.["*"] || "";
      };

      if (article.pageid) rawHtml = await load({ pageid: String(article.pageid) });
      if (!rawHtml && article.title) rawHtml = await load({ page: article.title });

      if (rawHtml.trim().length > 0) {
        setFullHtml(prepareWikipediaHtml(rawHtml, article.url));
        setIsExpanded(true);
      } else {
        setLoadError(
          "Could not retrieve full article text. You can still read the entire article on Wikipedia."
        );
      }
    } catch (error) {
      console.error("Error loading full Wikipedia text:", error);
      setLoadError(
        "Network error loading full article. Please check your connection or read on Wikipedia."
      );
    } finally {
      setLoadingFullText(false);
    }
  };

  const onRichTextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement | null)?.closest("a");
    const href = anchor?.getAttribute("href");
    if (!anchor || !href?.startsWith("#")) return;
    event.preventDefault();
    const id = decodeURIComponent(href.slice(1));
    const target = contentRef.current?.querySelector(`[id="${CSS.escape(id)}"]`);
    target?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  const initialParagraphs = useMemo(() => {
    return article.extract
      ? article.extract
          .split("\n\n")
          .flatMap((paragraph) => paragraph.split("\n"))
          .filter((paragraph) => paragraph.trim().length > 0)
      : [];
  }, [article.extract]);

  const sheetStyle: React.CSSProperties = {
    ...(isDragging
      ? {
          transform: `translate3d(0, ${Math.max(0, dragY)}px, 0)`,
          transition: "none",
        }
      : isClosing && dragY > 0
        ? {
            transform: "translate3d(0, 100%, 0)",
            transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          }
        : dragY > 0
          ? {
              transform: "translate3d(0, 0px, 0)",
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }
          : {}),
  };

  const backdropStyle: React.CSSProperties =
    isDragging && dragY > 0
      ? {
          opacity: Math.max(0.2, 1 - dragY / 300),
          transition: "none",
        }
      : {};

  return (
    <div
      style={backdropStyle}
      className={`fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 transition-all duration-300 ease-out ${
        isVisible
          ? "bg-black/80 backdrop-blur-sm opacity-100 pointer-events-auto"
          : "bg-black/0 backdrop-blur-none opacity-0 pointer-events-none"
      }`}
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-title"
        tabIndex={-1}
        style={sheetStyle}
        lang={articleLanguageId}
        dir={isRtlLanguage(articleLanguageId) ? "rtl" : "ltr"}
        className={`w-full md:max-w-2xl bg-gray-900 border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pb-[env(safe-area-inset-bottom,0px)] md:pb-0 outline-none ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-full md:translate-y-8 opacity-0 md:scale-95"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none md:hidden flex-shrink-0 select-none"
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
          onTouchCancel={handleHeaderTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/30 rounded-full hover:bg-white/50 transition-colors" />
        </div>

        <div
          className="flex items-center justify-between p-4 md:p-5 border-b border-white/10 bg-gray-900/90 backdrop-blur-md sticky top-0 z-10 touch-none select-none"
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
          onTouchCancel={handleHeaderTouchEnd}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span className="text-xs uppercase tracking-wider font-semibold text-white/50">
              Article Reader
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleLike(article);
              }}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                liked
                  ? "bg-red-500/20 text-red-400"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              aria-label={liked ? "Unlike article" : "Like article"}
              aria-pressed={liked}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleShare();
              }}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Share article"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleClose();
              }}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors ms-1 cursor-pointer"
              aria-label="Close reader"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
          onTouchCancel={handleContentTouchEnd}
          onClick={onRichTextClick}
          className="overflow-y-auto p-5 md:p-8 pb-[max(3.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] md:pb-8 space-y-5 text-white/90 overscroll-contain"
        >
          {article.thumbnail?.source && (
            <div
              className={`w-full max-h-64 rounded-xl overflow-hidden flex items-center justify-center shadow-lg ${
                /\.svg(\?|$)/i.test(article.thumbnail.source)
                  ? "bg-white p-3 border border-white/20"
                  : "bg-black/40"
              }`}
            >
              <img
                crossOrigin="anonymous"
                src={article.thumbnail.source}
                alt={article.displaytitle}
                className="max-h-60 w-auto object-contain mx-auto rounded-lg"
              />
            </div>
          )}

          <h1 id="reader-title" className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {article.displaytitle}
          </h1>

          {shareMessage && (
            <p role="status" className="text-xs text-white/70">
              {shareMessage}
            </p>
          )}

          {isExpanded && fullHtml ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs text-white/60">
                <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Full Article Text</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show summary only</span>
                </button>
              </div>

              <div
                className="wiki-content space-y-4"
                dangerouslySetInnerHTML={{ __html: fullHtml }}
              />

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Back to summary view</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4 text-base md:text-lg leading-relaxed text-gray-200">
                {initialParagraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              <div className="pt-2 pb-1 flex flex-col items-center">
                <button
                  type="button"
                  onClick={fetchFullArticle}
                  disabled={loadingFullText}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  {loadingFullText ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading full article...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>Read Full Article</span>
                    </>
                  )}
                </button>
                {loadError && (
                  <p className="text-xs text-red-400 mt-2 text-center max-w-sm">{loadError}</p>
                )}
              </div>
            </div>
          )}

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
