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
import { useLikedArticles } from "../contexts/LikedArticlesContext";
import { useLocalization } from "../hooks/useLocalization";

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

// Clean and sanitize Wikipedia HTML to preserve tables, lists, and media while neutralizing XSS vectors
function cleanWikipediaHtml(rawHtml: string, articleUrl: string): string {
  if (typeof DOMParser === "undefined") return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  // 1. Remove dangerous active elements and non-reader elements
  const selectorsToRemove = [
    "script",
    "style",
    "link",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "meta",
    "base",
    ".mw-editsection",
    ".navbox",
    ".vertical-navbox",
    ".sidebar",
    ".noprint",
    ".metadata",
    ".ambox",
    ".tombstone",
    ".mw-jump-link",
  ];
  selectorsToRemove.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // 2. Strip all inline event handlers (e.g. onclick, onerror, onload) across all elements
  doc.querySelectorAll("*").forEach((el) => {
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i];
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // 3. Extract base domain from article url or default to en.wikipedia.org
  let domain = "https://en.wikipedia.org";
  try {
    const parsedUrl = new URL(articleUrl);
    domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    // fallback
  }

  // 4. Sanitize and rewrite links to safe targets
  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href")?.trim();
    if (href) {
      const lowerHref = href.toLowerCase();
      // Block unsafe protocols (javascript:, data:, vbscript:)
      if (
        lowerHref.startsWith("javascript:") ||
        lowerHref.startsWith("data:") ||
        lowerHref.startsWith("vbscript:")
      ) {
        a.removeAttribute("href");
        return;
      }

      if (href.startsWith("/wiki/") || href.startsWith("./")) {
        const cleanHref = href.startsWith("./") ? href.slice(2) : href.slice(6);
        a.setAttribute("href", `${domain}/wiki/${cleanHref}`);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } else if (href.startsWith("#")) {
        // internal anchors remain
      } else if (href.startsWith("//")) {
        a.setAttribute("href", `https:${href}`);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } else if (href.startsWith("http://") || href.startsWith("https://")) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } else {
        a.removeAttribute("href");
      }
    }
  });

  // 5. Sanitize and rewrite image sources
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src")?.trim();
    if (src) {
      const lowerSrc = src.toLowerCase();
      if (lowerSrc.startsWith("javascript:") || lowerSrc.startsWith("vbscript:")) {
        img.remove();
        return;
      }
      if (src.startsWith("//")) {
        img.setAttribute("src", `https:${src}`);
      }
    }
    img.setAttribute("loading", "lazy");
  });

  // 6. Wrap all tables in horizontal scroll containers to preserve columns on mobile
  doc.querySelectorAll("table").forEach((tbl) => {
    if (
      tbl.parentElement &&
      !tbl.parentElement.classList.contains("wiki-table-wrapper")
    ) {
      const wrapper = doc.createElement("div");
      wrapper.className =
        "wiki-table-wrapper overflow-x-auto my-4 rounded-xl border border-white/10 bg-white/[0.02]";
      tbl.parentNode?.insertBefore(wrapper, tbl);
      wrapper.appendChild(tbl);
    }
  });

  const outputContainer = doc.querySelector(".mw-parser-output");
  return outputContainer ? outputContainer.innerHTML : doc.body.innerHTML;
}

export function ReaderModal({ article, onClose }: ReaderModalProps) {
  const { toggleLike, isLiked } = useLikedArticles();
  const { currentLanguage } = useLocalization();

  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Full article text expansion state
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Swipe-down to dismiss gesture state for mobile bottom sheet
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isEligibleHeaderDragRef = useRef(false);
  const isContentTopDragRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);

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

  // Header / Handle touch drag handlers
  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
    currentDragYRef.current = 0;
    isEligibleHeaderDragRef.current = true;
    setIsDragging(true);
  };

  const handleHeaderTouchMove = (e: React.TouchEvent) => {
    if (!isEligibleHeaderDragRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    if (deltaY > 0) {
      currentDragYRef.current = deltaY;
      setDragY(deltaY);
    } else {
      // Gentle rubber-band resistance when pulling up
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

  // Content scroll area touch handlers (active only when scrolled to top)
  const handleContentTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
    currentDragYRef.current = 0;
    isContentTopDragRef.current =
      !contentRef.current || contentRef.current.scrollTop <= 0;
  };

  const handleContentTouchMove = (e: React.TouchEvent) => {
    if (!isContentTopDragRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartXRef.current);

    if (!isDragging) {
      // Must be predominantly downward gesture while at top of content
      if (
        deltaY > 10 &&
        deltaY > deltaX &&
        (!contentRef.current || contentRef.current.scrollTop <= 0)
      ) {
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
    if (isDragging) {
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
    }
  };

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

  // Fetch full article content from Wikipedia including all tables and lists
  const fetchFullArticle = async () => {
    if (fullHtml) {
      setIsExpanded(true);
      return;
    }

    setLoadingFullText(true);
    setLoadError(null);

    try {
      const apiBase =
        currentLanguage?.api || "https://en.wikipedia.org/w/api.php?";
      let rawHtml = "";

      // 1. Try querying by pageid using parse API for complete article content
      if (article.pageid) {
        const params = new URLSearchParams({
          action: "parse",
          format: "json",
          prop: "text",
          origin: "*",
          pageid: String(article.pageid),
        });
        const res = await fetch(`${apiBase}${params.toString()}`);
        const data = (await res.json()) as WikiParseResponse;
        if (data?.parse?.text?.["*"]) {
          rawHtml = data.parse.text["*"];
        }
      }

      // 2. Fallback to title if needed
      if (!rawHtml && article.title) {
        const params = new URLSearchParams({
          action: "parse",
          format: "json",
          prop: "text",
          origin: "*",
          page: article.title,
        });
        const res = await fetch(`${apiBase}${params.toString()}`);
        const data = (await res.json()) as WikiParseResponse;
        if (data?.parse?.text?.["*"]) {
          rawHtml = data.parse.text["*"];
        }
      }

      if (rawHtml && rawHtml.trim().length > 0) {
        const cleaned = cleanWikipediaHtml(rawHtml, article.url);
        setFullHtml(cleaned);
        setIsExpanded(true);
      } else {
        setLoadError(
          "Could not retrieve full article text. You can still read the entire article on Wikipedia."
        );
      }
    } catch (err) {
      console.error("Error loading full Wikipedia text:", err);
      setLoadError(
        "Network error loading full article. Please check your connection or read on Wikipedia."
      );
    } finally {
      setLoadingFullText(false);
    }
  };

  // Split initial extract into clean paragraphs
  const initialParagraphs = useMemo(() => {
    return article.extract
      ? article.extract
          .split("\n\n")
          .flatMap((p) => p.split("\n"))
          .filter((p) => p.trim().length > 0)
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-title"
      style={backdropStyle}
      className={`fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 transition-all duration-300 ease-out ${
        isVisible
          ? "bg-black/80 backdrop-blur-sm opacity-100 pointer-events-auto"
          : "bg-black/0 backdrop-blur-none opacity-0 pointer-events-none"
      }`}
      onClick={handleClose}
    >
      <div
        style={sheetStyle}
        className={`w-full md:max-w-2xl bg-gray-900 border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pb-[env(safe-area-inset-bottom,0px)] md:pb-0 ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-full md:translate-y-8 opacity-0 md:scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Drag Handle Area */}
        <div
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none md:hidden flex-shrink-0 select-none"
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
          onTouchCancel={handleHeaderTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/30 rounded-full hover:bg-white/50 transition-colors" />
        </div>

        {/* Header */}
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
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(article);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
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
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Share article"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
              aria-label="Close reader"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div
          ref={contentRef}
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
          onTouchCancel={handleContentTouchEnd}
          className="overflow-y-auto p-5 md:p-8 pb-[max(3.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] md:pb-8 space-y-5 text-white/90 overscroll-contain"
        >
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

          {/* Expanded full article vs Initial summary extract */}
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

              {/* Render rich sanitized Wikipedia HTML with tables, lists, and formatting */}
              <div
                className="wiki-content space-y-4"
                dangerouslySetInnerHTML={{ __html: fullHtml }}
              />

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    if (contentRef.current) {
                      contentRef.current.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }
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
                {initialParagraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {/* Expander button to load full article */}
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
                  <p className="text-xs text-red-400 mt-2 text-center max-w-sm">
                    {loadError}
                  </p>
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
