import { useState, useRef, useEffect, useCallback } from "react";
import {
  Share2,
  Heart,
  Volume2,
  VolumeX,
  BookOpen,
  Maximize2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useLikedArticles } from "../contexts/LikedArticlesContext";
import { useLocalization } from "../hooks/useLocalization";
import { LightboxModal } from "./LightboxModal";
import { ReaderModal } from "./ReaderModal";
import "../assets/heartAnimation.css";

export interface WikiArticle {
  title: string;
  displaytitle: string;
  extract: string;
  pageid: number;
  url: string;
  thumbnail: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikiCardProps {
  article: WikiArticle;
  isActive?: boolean;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

export function WikiCard({ article, isActive }: WikiCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);

  const { toggleLike, isLiked } = useLikedArticles();
  const { currentLanguage } = useLocalization();

  const lastTapRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Stop speaking when speech ends or component unmounts
  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  // Text to Speech narration handler
  const toggleSpeech = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    if (isSpeaking) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = `${article.displaytitle}. ${article.extract}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);

    // Set utterance language and match voices
    utterance.lang = currentLanguage.id;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) =>
      v.lang.toLowerCase().startsWith(currentLanguage.id.toLowerCase())
    );
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Floating heart spawner on double tap/click
  const spawnFloatingHeart = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setFloatingHearts((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 900);
  };

  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (!isLiked(article.pageid)) {
      toggleLike(article);
    }
    spawnFloatingHeart(clientX, clientY);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // Ignored
      }
    }
  };

  const [isTransparent, setIsTransparent] = useState(() => {
    return /\.(svg|png)(\?|$)/i.test(article.thumbnail?.source || "");
  });

  const [aspectRatio, setAspectRatio] = useState<string | undefined>(() => {
    if (article.thumbnail?.width && article.thumbnail?.height) {
      return `${article.thumbnail.width} / ${article.thumbnail.height}`;
    }
    return undefined;
  });

  // Reset imageLoaded and transparency state when article thumbnail changes
  useEffect(() => {
    setImageLoaded(false);
    setIsTransparent(
      /\.(svg|png)(\?|$)/i.test(article.thumbnail?.source || "")
    );
    if (article.thumbnail?.width && article.thumbnail?.height) {
      setAspectRatio(`${article.thumbnail.width} / ${article.thumbnail.height}`);
    } else {
      setAspectRatio(undefined);
    }
  }, [
    article.thumbnail?.source,
    article.thumbnail?.width,
    article.thumbnail?.height,
  ]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
    }
    if (/\.(svg|png)(\?|$)/i.test(article.thumbnail?.source || "")) {
      setIsTransparent(true);
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 240) {
            setIsTransparent(true);
            break;
          }
        }
      }
    } catch {
      // Ignored for cross-origin safety
    }
  };

  // Touch gesture handler for mobile double tap
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const touch = e.changedTouches[0];
      handleDoubleTap(touch.clientX, touch.clientY);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  return (
    <div
      ref={cardRef}
      className="h-[100dvh] min-h-[100dvh] w-full flex flex-col justify-between snap-start relative overflow-hidden bg-black select-none pt-26 sm:pt-20 md:pt-18"
      onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Ambient blurred background layer */}
      {article.thumbnail ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={article.thumbnail.source}
            alt=""
            aria-hidden="true"
            className={`w-full h-full object-cover blur-3xl scale-125 transition-opacity duration-700 ${
              isTransparent ? "opacity-15 brightness-125" : "opacity-40"
            } ${imageLoaded ? "opacity-40" : "opacity-0"}`}
          />
          {/* Top and bottom subtle dark vignettes */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/85" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
      )}

      {/* 2. Floating interactive hearts */}
      {floatingHearts.map((heart) => (
        <div
          key={heart.id}
          style={{ left: heart.x, top: heart.y }}
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50 animate-heart-burst"
        >
          <Heart className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-2xl" />
        </div>
      ))}

      {/* 3. Foreground Image Container: Flexes strictly between category bar and article text */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center px-4 md:px-8 py-2 relative z-10 overflow-hidden">
        {article.thumbnail ? (
          <div
            style={aspectRatio ? { aspectRatio } : undefined}
            className={`relative max-h-full max-w-full flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 group cursor-zoom-in ${
              isTransparent
                ? "bg-white border border-white/40 p-3 sm:p-4"
                : "bg-neutral-900/40 border border-white/10 p-0"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(true);
            }}
          >
            {/* Loading placeholder: stays centered and matches aspect ratio */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
              </div>
            )}

            {/* Complete, uncropped article image from Wikipedia */}
            <img
              loading={isActive ? "eager" : "lazy"}
              fetchPriority={isActive ? "high" : "auto"}
              crossOrigin="anonymous"
              src={article.thumbnail.source}
              alt={article.displaytitle}
              width={article.thumbnail.width}
              height={article.thumbnail.height}
              className={`w-full h-full object-contain transition-all duration-300 group-hover:scale-[1.02] ${
                isTransparent ? "rounded-lg" : "rounded-2xl sm:rounded-3xl"
              } ${
                imageLoaded
                  ? "opacity-100 block"
                  : "opacity-0 absolute pointer-events-none"
              }`}
              onLoad={handleImageLoad}
              onError={() => setImageLoaded(true)}
            />

            {/* Tap to zoom badge */}
            {imageLoaded && (
              <div className="absolute bottom-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                <Maximize2 className="w-4 h-4" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 text-sm">
            <span>No image available</span>
          </div>
        )}
      </div>

      {/* 4. Article Information & Action Sheet in layout flow */}
      <div className="flex-shrink-0 w-full relative z-20 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] px-4 sm:px-6 md:px-8 pt-6 bg-gradient-to-t from-black via-black/95 to-black/40">
        <div className="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header Row: Title & Action Buttons */}
          <div className="flex justify-between items-start mb-2.5 gap-4">
            <button
              onClick={() => setShowReader(true)}
              className="text-left group/title hover:opacity-90 transition-opacity min-w-0"
            >
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow-md text-white group-hover/title:text-blue-300 transition-colors line-clamp-2">
                {article.displaytitle}
              </h2>
            </button>

            {/* Action buttons bar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Text-to-Speech button */}
              <button
                onClick={toggleSpeech}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  isSpeaking
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white"
                }`}
                aria-label={isSpeaking ? "Stop listening" : "Listen to article"}
                title={isSpeaking ? "Stop listening" : "Listen to article"}
              >
                {isSpeaking ? (
                  <VolumeX className="w-5 h-5 animate-pulse" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              {/* Like button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike(article);
                }}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  isLiked(article.pageid)
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 scale-105"
                    : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white"
                }`}
                aria-label="Like article"
              >
                <Heart
                  className={`w-5 h-5 ${
                    isLiked(article.pageid) ? "fill-white" : ""
                  }`}
                />
              </button>

              {/* Share button */}
              <button
                onClick={handleShare}
                className="p-2.5 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white/90 hover:text-white transition-all"
                aria-label="Share article"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Extract text preview */}
          <p className="text-gray-200 text-xs sm:text-sm md:text-base mb-3 drop-shadow line-clamp-3 sm:line-clamp-4 leading-relaxed">
            {article.extract}
          </p>

          {/* Read article links */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReader(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors drop-shadow"
            >
              <BookOpen className="w-4 h-4" />
              <span>Read article</span>
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white/90 transition-colors"
            >
              <span>Wikipedia</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 5. Modals */}
      {showLightbox && article.thumbnail && (
        <LightboxModal
          article={article}
          onClose={() => setShowLightbox(false)}
        />
      )}

      {showReader && (
        <ReaderModal article={article} onClose={() => setShowReader(false)} />
      )}
    </div>
  );
}
