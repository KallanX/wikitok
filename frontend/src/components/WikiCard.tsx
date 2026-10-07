import { useState, useRef, useEffect, useCallback } from "react";
import {
  Share2,
  Heart,
  HeartCrack,
  Volume2,
  VolumeX,
  BookOpen,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useLikedArticles } from "../hooks/useLikedArticles";
import { ReaderModal } from "./ReaderModal";
import { useShareArticle } from "../hooks/useShareArticle";
import { ambientThumb } from "../lib/thumb";
import { isRtlLanguage, languageIdFromArticle } from "../lib/language";
import "../assets/heartAnimation.css";

export interface WikiArticle {
  title: string;
  displaytitle: string;
  extract: string;
  pageid: number;
  url: string;
  lang?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikiCardProps {
  article: WikiArticle;
  isActive?: boolean;
}

interface FloatingReaction {
  id: number;
  x: number;
  y: number;
  type: "heart" | "broken";
}

function isSvg(url: string | undefined): boolean {
  return /\.svg(\?|$)/i.test(url || "");
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const normalize = (value: string) => value.toLowerCase().replace(/_/g, "-");
  const needle = normalize(lang);
  const base = needle.split("-")[0];
  return (
    voices.find((voice) => normalize(voice.lang) === needle) ||
    voices.find((voice) => normalize(voice.lang).startsWith(needle)) ||
    voices.find((voice) => normalize(voice.lang).startsWith(base))
  );
}

function whenVoicesReady(): Promise<void> {
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 400);
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export function WikiCard({ article, isActive }: WikiCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [ambientSrc, setAmbientSrc] = useState(() =>
    article.thumbnail?.source ? ambientThumb(article.thumbnail.source) : ""
  );

  const { toggleLike, isLiked } = useLikedArticles();
  const { message: shareMessage, share } = useShareArticle();
  const liked = isLiked(article);
  const articleLanguage = languageIdFromArticle(article);

  const lastTapRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const lastDoubleTapTimeRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(false);
  const reactionTimers = useRef<number[]>([]);

  const stopOwnSpeech = useCallback(() => {
    if (!speakingRef.current) return;
    speakingRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (!isActive) stopOwnSpeech();
  }, [isActive, stopOwnSpeech]);

  useEffect(() => {
    const timers = reactionTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (speakingRef.current && "speechSynthesis" in window) {
        speakingRef.current = false;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeech = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (speakingRef.current) {
      stopOwnSpeech();
      return;
    }

    await whenVoicesReady();
    if (!isActive) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${article.displaytitle}. ${article.extract || ""}`
    );
    utterance.lang = articleLanguage;
    const voice = pickVoice(articleLanguage);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      speakingRef.current = false;
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      setIsSpeaking(false);
    };

    speakingRef.current = true;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const spawnFloatingReaction = (x: number, y: number, type: "heart" | "broken") => {
    const id = Date.now() + Math.random();
    setFloatingReactions((prev) => [...prev, { id, x, y, type }]);
    const timer = window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((reaction) => reaction.id !== id));
    }, 900);
    reactionTimers.current.push(timer);
  };

  const reactAt = (x: number, y: number, wasLiked: boolean) => {
    spawnFloatingReaction(x, y, wasLiked ? "broken" : "heart");
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(wasLiked ? [30, 40, 30] : 40);
      } catch {
        // Some browsers expose vibrate and still throw.
      }
    }
  };

  const handleDoubleTap = (clientX?: number, clientY?: number) => {
    const now = Date.now();
    if (now - lastDoubleTapTimeRef.current < 450) return;
    lastDoubleTapTimeRef.current = now;

    let x = clientX;
    let y = clientY;
    if (x == null || y == null) {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
      }
    }

    const wasLiked = isLiked(article);
    toggleLike(article);
    reactAt(x, y, wasLiked);
  };

  const [isTransparent, setIsTransparent] = useState(() => isSvg(article.thumbnail?.source));

  const [aspectRatio, setAspectRatio] = useState<string | undefined>(() => {
    if (article.thumbnail?.width && article.thumbnail?.height) {
      return `${article.thumbnail.width} / ${article.thumbnail.height}`;
    }
    return undefined;
  });

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setIsTransparent(isSvg(article.thumbnail?.source));
    setAmbientSrc(article.thumbnail?.source ? ambientThumb(article.thumbnail.source) : "");
    if (article.thumbnail?.width && article.thumbnail?.height) {
      setAspectRatio(`${article.thumbnail.width} / ${article.thumbnail.height}`);
    } else {
      setAspectRatio(undefined);
    }
  }, [article.thumbnail?.source, article.thumbnail?.width, article.thumbnail?.height]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    const img = event.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
    }
    if (isSvg(article.thumbnail?.source)) {
      setIsTransparent(true);
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] < 240) {
          setIsTransparent(true);
          break;
        }
      }
    } catch {
      // Tainted canvases throw. The photo still renders without a white mat.
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if ((event.target as HTMLElement)?.closest("button, a, input")) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const touch = event.changedTouches[0];
      handleDoubleTap(touch.clientX, touch.clientY);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleShare = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    void share({
      title: article.displaytitle,
      text: article.extract || "",
      url: article.url,
    });
  };

  const blurClass = !imageLoaded
    ? "opacity-0"
    : isTransparent
      ? "opacity-15 brightness-125"
      : "opacity-40";

  return (
    <div
      ref={cardRef}
      lang={articleLanguage}
      dir={isRtlLanguage(articleLanguage) ? "rtl" : "ltr"}
      className="h-[100dvh] min-h-[100dvh] w-full flex flex-col justify-between snap-start relative overflow-hidden bg-black select-none pt-26 sm:pt-20 md:pt-18"
      onDoubleClick={(event) => {
        if (Date.now() - lastTouchTimeRef.current < 600) return;
        if ((event.target as HTMLElement)?.closest("button, a, input")) return;
        handleDoubleTap(event.clientX, event.clientY);
      }}
      onTouchEnd={handleTouchEnd}
    >
      {article.thumbnail?.source ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={ambientSrc || article.thumbnail.source}
            alt=""
            aria-hidden="true"
            crossOrigin="anonymous"
            className={`w-full h-full object-cover blur-3xl scale-125 transition-opacity duration-700 ${blurClass}`}
            onError={() => {
              if (ambientSrc && ambientSrc !== article.thumbnail?.source) {
                setAmbientSrc(article.thumbnail?.source || "");
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/85" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
      )}

      {floatingReactions.map((reaction) => (
        <div
          key={reaction.id}
          style={{ left: reaction.x, top: reaction.y }}
          className={`fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50 ${
            reaction.type === "broken" ? "animate-heart-crack-burst" : "animate-heart-burst"
          }`}
        >
          {reaction.type === "broken" ? (
            <HeartCrack className="w-24 h-24 text-white fill-red-600 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] filter" />
          ) : (
            <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-[0_10px_20px_rgba(239,68,68,0.5)]" />
          )}
        </div>
      ))}

      <div className="flex-1 min-h-0 w-full flex items-center justify-center px-4 md:px-8 py-2 relative z-10 overflow-hidden">
        {article.thumbnail?.source ? (
          <div
            style={aspectRatio ? { aspectRatio } : undefined}
            className={`relative max-h-full max-w-full flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${
              isTransparent
                ? "bg-white border border-white/40 p-3 sm:p-4"
                : "bg-neutral-900/40 border border-white/10 p-0"
            }`}
          >
            {!imageLoaded && (
              <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
              </div>
            )}
            {imageFailed ? (
              <div className="w-56 h-56 flex items-center justify-center text-white/50 text-sm">
                Image unavailable
              </div>
            ) : (
            <img
              loading={isActive ? "eager" : "lazy"}
              fetchPriority={isActive ? "high" : "auto"}
              crossOrigin="anonymous"
              src={article.thumbnail.source}
              alt={article.displaytitle}
              width={article.thumbnail.width}
              height={article.thumbnail.height}
              className={`block h-full w-full max-h-full max-w-full object-contain transition-opacity duration-300 ${
                isTransparent ? "rounded-lg" : "rounded-2xl sm:rounded-3xl"
              } ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={handleImageLoad}
              onError={() => {
                setImageFailed(true);
                setImageLoaded(true);
              }}
            />
            )}
          </div>
        ) : (
          <div className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 text-sm">
            <span>No image available</span>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 w-full relative z-20 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] px-4 sm:px-6 md:px-8 pt-6 bg-gradient-to-t from-black via-black/95 to-black/40">
        <div className="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="flex justify-between items-start mb-2.5 gap-4">
            <button
              onClick={() => setShowReader(true)}
              className="text-start group/title hover:opacity-90 transition-opacity min-w-0"
            >
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow-md text-white group-hover/title:text-blue-300 transition-colors line-clamp-2">
                {article.displaytitle}
              </h2>
            </button>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={toggleSpeech}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  isSpeaking
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white"
                }`}
                aria-label={isSpeaking ? "Stop listening" : "Listen to article"}
                aria-pressed={isSpeaking}
                title={isSpeaking ? "Stop listening" : "Listen to article"}
              >
                {isSpeaking ? (
                  <VolumeX className="w-5 h-5 animate-pulse" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  const wasLiked = liked;
                  toggleLike(article);
                  const rect = cardRef.current?.getBoundingClientRect();
                  reactAt(
                    rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
                    rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
                    wasLiked
                  );
                }}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  liked
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 scale-105"
                    : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white"
                }`}
                aria-label={liked ? "Unlike article" : "Like article"}
                aria-pressed={liked}
              >
                <Heart className={`w-5 h-5 ${liked ? "fill-white" : ""}`} />
              </button>

              <button
                onClick={handleShare}
                className="p-2.5 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white/90 hover:text-white transition-all"
                aria-label="Share article"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <p className="text-gray-200 text-xs sm:text-sm md:text-base mb-3 drop-shadow line-clamp-3 sm:line-clamp-4 leading-relaxed">
            {article.extract}
          </p>

          <div className="flex items-center gap-4 flex-wrap">
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
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              CC BY-SA
            </a>
            {shareMessage && (
              <span role="status" className="text-[11px] text-white/80">
                {shareMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {showReader && <ReaderModal article={article} onClose={() => setShowReader(false)} />}
    </div>
  );
}
