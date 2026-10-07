import { useEffect, useRef, useCallback, useState } from "react";
import { WikiCard, WikiArticle } from "./components/WikiCard";
import { Loader2, Search, X, Download, ChevronUp, BookOpen } from "lucide-react";
import { LanguageSelector } from "./components/LanguageSelector";
import { useLikedArticles } from "./hooks/useLikedArticles";
import { useLocalization } from "./hooks/useLocalization";
import { useWikiArticles } from "./hooks/useWikiArticles";
import { useDialogBehavior } from "./hooks/useDialogBehavior";
import { ReaderModal } from "./components/ReaderModal";
import { TopicSelector } from "./components/TopicSelector";
import { LANGUAGES } from "./languages";
import { likeKey } from "./lib/likeKey";
import { prefersReducedMotion } from "./lib/motion";
import { APP_VERSION } from "./version";

const TOPICS = [
  { id: "all", label: "Random" },
  { id: "science", label: "Science" },
  { id: "history", label: "History" },
  { id: "nature", label: "Nature" },
  { id: "space", label: "Space" },
  { id: "art", label: "Art" },
];

const RENDER_WINDOW = 2;

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [activeArticleForReader, setActiveArticleForReader] = useState<WikiArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasScrolled, setHasScrolled] = useState(false);
  const [activeArticleIndex, setActiveArticleIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const likesRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);

  const {
    articles,
    loading,
    isFetchingMore,
    error,
    exhausted,
    topic,
    setTopic,
    fetchArticles,
    retry,
  } = useWikiArticles();
  const { likedArticles, toggleLike } = useLikedArticles();
  const { currentLanguage } = useLocalization();

  const closeAbout = useCallback(() => setShowAbout(false), []);
  const closeLikes = useCallback(() => setShowLikes(false), []);
  useDialogBehavior(showAbout, closeAbout, aboutRef);
  useDialogBehavior(showLikes, closeLikes, likesRef);

  const rememberIndex = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveArticleIndex(index);
  }, []);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting) fetchArticles();
    },
    [fetchArticles]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.05,
      rootMargin: "2500px",
    });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    if (error || exhausted) return;
    if (articles.length > 0 && articles.length - activeArticleIndex <= 8) {
      fetchArticles();
    }
  }, [activeArticleIndex, articles.length, fetchArticles, error, exhausted]);

  useEffect(() => {
    rememberIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [topic, currentLanguage.id, rememberIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (scrollTop > 50 && !hasScrolled) setHasScrolled(true);
    const index = Math.round(scrollTop / (clientHeight || 1));
    if (index !== activeIndexRef.current && index >= 0 && index < articles.length) {
      rememberIndex(index);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (showAbout || showLikes || activeArticleForReader) return;

      const behavior = prefersReducedMotion() ? "auto" : "smooth";
      const scrollToIndex = (index: number) => {
        if (!containerRef.current || index < 0 || index >= articles.length) return;
        if (index === activeIndexRef.current) return;
        rememberIndex(index);
        containerRef.current.scrollTo({
          top: index * containerRef.current.clientHeight,
          behavior,
        });
      };

      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        scrollToIndex(activeIndexRef.current + 1);
      } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        scrollToIndex(activeIndexRef.current - 1);
      } else if (event.key.toLowerCase() === "l") {
        if (event.repeat) return;
        event.preventDefault();
        const currentArticle = articles[activeIndexRef.current];
        if (currentArticle) toggleLike(currentArticle);
      } else if (event.key === "Escape") {
        setShowAbout(false);
        setShowLikes(false);
        setActiveArticleForReader(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [articles, showAbout, showLikes, activeArticleForReader, toggleLike, rememberIndex]);

  const query = searchQuery.trim().toLowerCase();
  const filteredLikedArticles = likedArticles.filter((article) => {
    if (!query) return true;
    const title = article.title?.toLowerCase() ?? "";
    const extract = article.extract?.toLowerCase() ?? "";
    return title.includes(query) || extract.includes(query);
  });

  const handleExport = () => {
    const simplifiedArticles = likedArticles.map((article) => ({
      title: article.title,
      lang: article.lang ?? null,
      url: article.url,
      extract: article.extract,
      thumbnail: article.thumbnail?.source || null,
    }));

    const dataStr = JSON.stringify(simplifiedArticles, null, 2);
    const linkElement = document.createElement("a");
    linkElement.setAttribute(
      "href",
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    );
    linkElement.setAttribute(
      "download",
      `wikitok-favorites-${new Date().toISOString().split("T")[0]}.json`
    );
    linkElement.click();
  };

  const scrollToTop = () => {
    rememberIndex(0);
    containerRef.current?.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <div
      id="feed"
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[100dvh] min-h-[100dvh] w-full bg-black text-white overflow-y-scroll snap-y snap-mandatory hide-scroll relative"
    >
      <header className="fixed top-0 left-0 right-0 z-40 p-4 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={scrollToTop}
            className="text-2xl font-black text-white drop-shadow-md hover:opacity-85 transition-opacity tracking-tight"
          >
            WikiTok
          </button>
        </div>

        <div className="pointer-events-auto hidden sm:flex absolute left-1/2 -translate-x-1/2 top-4 z-10">
          <TopicSelector
            topics={TOPICS}
            activeTopic={topic}
            onSelectTopic={(id) => {
              setTopic(id);
              scrollToTop();
            }}
            size="md"
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setShowAbout(true)}
            className="px-2.5 py-1 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-xs text-white/80 hover:text-white transition-all backdrop-blur-md"
          >
            About
          </button>
          <button
            onClick={() => setShowLikes(true)}
            className="px-2.5 py-1 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-xs text-white/80 hover:text-white transition-all backdrop-blur-md flex items-center gap-1.5"
          >
            <span>Likes</span>
            {likedArticles.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {likedArticles.length > 99 ? "99+" : likedArticles.length}
              </span>
            )}
          </button>
          <LanguageSelector />
        </div>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 sm:hidden flex items-center justify-center pointer-events-none px-4">
        <div
          data-topic-scroll
          className="pointer-events-auto overflow-x-auto max-w-full hide-scroll"
        >
          <TopicSelector
            topics={TOPICS}
            activeTopic={topic}
            onSelectTopic={(id) => {
              setTopic(id);
              scrollToTop();
            }}
            size="sm"
          />
        </div>
      </div>

      {!hasScrolled && articles.length > 0 && (
        <div className="fixed top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-1 rounded-full bg-black/55 px-3 py-2 text-white/80 animate-bounce">
          <span className="text-[11px] uppercase tracking-wider font-semibold">
            Swipe up for next
          </span>
          <ChevronUp className="w-4 h-4" />
        </div>
      )}

      {showAbout && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 fade-in"
          onClick={closeAbout}
        >
          <div
            ref={aboutRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            tabIndex={-1}
            className="bg-gray-900 border border-white/10 z-50 p-6 md:p-8 rounded-2xl max-w-md w-full max-h-[85dvh] overflow-y-auto relative shadow-2xl outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={closeAbout}
              className="absolute top-4 right-4 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 mb-3 pe-8">
              <h2 id="about-title" className="text-xl md:text-2xl font-bold">
                About WikiTok
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-mono font-medium tracking-wide">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-gray-300 text-sm md:text-base mb-4 leading-relaxed">
              A TikTok-style vertical feed for discovering and exploring random Wikipedia articles
              in multiple languages.
            </p>

            <div className="space-y-2 text-sm text-gray-400 border-t border-white/10 pt-4">
              <p>
                Maintained &amp; updated by{" "}
                <a
                  href="https://github.com/KallanX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline font-medium"
                >
                  KallanX
                </a>
              </p>
              <p>
                Originally created with ❤️ by{" "}
                <a
                  href="https://x.com/Aizkmusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline font-medium"
                >
                  @Aizkmusic
                </a>
              </p>
              <p>
                Check out the code on{" "}
                <a
                  href="https://github.com/KallanX/wikitok"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline font-medium"
                >
                  GitHub
                </a>{" "}
                (forked from{" "}
                <a
                  href="https://github.com/IsaacGemal/wikitok"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline"
                >
                  IsaacGemal/wikitok
                </a>
                )
              </p>
              <p className="pt-2">
                Support the original creator on{" "}
                <a
                  href="https://buymeacoffee.com/aizk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline font-medium"
                >
                  Buy Me a Coffee
                </a>
                ! ☕
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-xs text-white/40 flex justify-between">
              <span>Keyboard: ↓/↑ or J/K to browse</span>
              <span>L to like</span>
            </div>
          </div>
        </div>
      )}

      {showLikes && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 fade-in"
          onClick={closeLikes}
        >
          <div
            ref={likesRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="likes-title"
            tabIndex={-1}
            className="bg-gray-900 border border-white/10 z-50 p-6 rounded-2xl w-full max-w-2xl h-[80dvh] max-h-[85dvh] flex flex-col relative shadow-2xl outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={closeLikes}
              className="absolute top-4 end-4 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-between items-center mb-4 pe-10">
              <h2 id="likes-title" className="text-xl font-bold flex items-center gap-2">
                <span>Liked Articles</span>
                <span className="text-xs font-normal text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                  {likedArticles.length}
                </span>
              </h2>
              {likedArticles.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                  title="Export liked articles to JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              )}
            </div>

            <div className="relative mb-4">
              <label htmlFor="likes-search" className="sr-only">
                Search liked articles
              </label>
              <input
                id="likes-search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search liked articles..."
                className="w-full bg-gray-800 text-white px-4 py-2.5 ps-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/5 text-sm"
              />
              <Search className="w-4 h-4 text-white/50 absolute start-3.5 top-1/2 transform -translate-y-1/2" />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pe-1">
              {filteredLikedArticles.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-white/50 text-sm">
                  {searchQuery ? "No matches found." : "No liked articles yet."}
                </div>
              ) : (
                filteredLikedArticles.map((article) => {
                  const languageName = LANGUAGES.find((language) => language.id === article.lang)?.name;
                  return (
                    <div
                      key={likeKey(article)}
                      className="flex gap-4 items-start p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      {article.thumbnail?.source && (
                        <img
                          src={article.thumbnail.source}
                          alt=""
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer"
                          onClick={() => {
                            setActiveArticleForReader(article);
                            setShowLikes(false);
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <button
                            onClick={() => {
                              setActiveArticleForReader(article);
                              setShowLikes(false);
                            }}
                            className="font-bold text-sm text-start hover:text-blue-300 transition-colors truncate"
                          >
                            {article.title}
                          </button>
                          <button
                            onClick={() => toggleLike(article)}
                            className="text-white/40 hover:text-red-400 p-1 rounded-full transition-colors flex-shrink-0"
                            aria-label="Remove from likes"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {languageName && (
                          <p className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">
                            {languageName}
                          </p>
                        )}
                        <p className="text-xs text-white/70 line-clamp-2 mt-1">{article.extract}</p>
                        <button
                          onClick={() => {
                            setActiveArticleForReader(article);
                            setShowLikes(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 mt-2 font-medium"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Read in app</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {articles.map((article, index) => {
        const key = `${article.lang ?? "article"}-${article.pageid}`;
        if (Math.abs(index - activeArticleIndex) > RENDER_WINDOW) {
          return (
            <div
              key={key}
              className="h-[100dvh] min-h-[100dvh] w-full snap-start"
              aria-hidden="true"
            />
          );
        }
        return (
          <WikiCard key={key} article={article} isActive={index === activeArticleIndex} />
        );
      })}

      <div ref={observerTarget} className="h-10 -mt-1" />

      {exhausted && (
        <div className="h-[100dvh] min-h-[100dvh] w-full snap-start flex flex-col items-center justify-center gap-3 text-white/70 px-6 text-center">
          <p className="text-sm">You've reached the end of this topic.</p>
          <button
            type="button"
            onClick={() => setTopic("all")}
            className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold"
          >
            Back to random
          </button>
        </div>
      )}

      {isFetchingMore && articles.length > 0 && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2 rounded-full bg-black/70 border border-white/10 px-3 py-1.5 text-white/70">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span className="text-[11px] uppercase tracking-wider font-semibold">Loading</span>
        </div>
      )}

      {loading && articles.length === 0 && !error && (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-sm font-medium tracking-wide">Discovering articles...</span>
        </div>
      )}

      {error && (
        <div
          className={`${
            articles.length === 0
              ? "h-[100dvh] w-full"
              : "fixed bottom-[max(4.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 max-w-sm w-[calc(100%-2rem)]"
          } flex flex-col items-center justify-center gap-3 text-center text-white/80 px-6`}
        >
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      {activeArticleForReader && (
        <ReaderModal
          article={activeArticleForReader}
          onClose={() => setActiveArticleForReader(null)}
        />
      )}
    </div>
  );
}

export default App;
