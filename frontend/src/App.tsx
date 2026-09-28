import { useEffect, useRef, useCallback, useState } from "react";
import { WikiCard, WikiArticle } from "./components/WikiCard";
import {
  Loader2,
  Search,
  X,
  Download,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { LanguageSelector } from "./components/LanguageSelector";
import { useLikedArticles } from "./contexts/LikedArticlesContext";
import { useWikiArticles } from "./hooks/useWikiArticles";
import { ReaderModal } from "./components/ReaderModal";
import { TopicSelector } from "./components/TopicSelector";

const TOPICS = [
  { id: "all", label: "Random" },
  { id: "science", label: "Science" },
  { id: "history", label: "History" },
  { id: "nature", label: "Nature" },
  { id: "space", label: "Space" },
  { id: "art", label: "Art" },
];

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [activeArticleForReader, setActiveArticleForReader] =
    useState<WikiArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasScrolled, setHasScrolled] = useState(false);
  const [activeArticleIndex, setActiveArticleIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const { articles, loading, topic, setTopic, fetchArticles } =
    useWikiArticles();
  const { likedArticles, toggleLike } = useLikedArticles();

  // Intersection observer to automatically fetch more articles when nearing the end
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && !loading) {
        fetchArticles();
      }
    },
    [loading, fetchArticles]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: "300px",
    });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  // Track active article index and scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (scrollTop > 50 && !hasScrolled) {
      setHasScrolled(true);
    }
    const index = Math.round(scrollTop / (clientHeight || 1));
    if (index !== activeArticleIndex && index >= 0 && index < articles.length) {
      setActiveArticleIndex(index);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in search
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (containerRef.current) {
          const nextIndex = activeArticleIndex + 1;
          containerRef.current.scrollTo({
            top: nextIndex * containerRef.current.clientHeight,
            behavior: "smooth",
          });
        }
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (containerRef.current && activeArticleIndex > 0) {
          const prevIndex = activeArticleIndex - 1;
          containerRef.current.scrollTo({
            top: prevIndex * containerRef.current.clientHeight,
            behavior: "smooth",
          });
        }
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        const currentArticle = articles[activeArticleIndex];
        if (currentArticle) {
          toggleLike(currentArticle);
        }
      } else if (e.key === "Escape") {
        setShowAbout(false);
        setShowLikes(false);
        setActiveArticleForReader(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeArticleIndex, articles, toggleLike]);

  // Filtered liked articles
  const filteredLikedArticles = likedArticles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.extract.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    const simplifiedArticles = likedArticles.map((article) => ({
      title: article.title,
      url: article.url,
      extract: article.extract,
      thumbnail: article.thumbnail?.source || null,
    }));

    const dataStr = JSON.stringify(simplifiedArticles, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `wikitok-favorites-${
      new Date().toISOString().split("T")[0]
    }.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[100dvh] min-h-[100dvh] w-full bg-black text-white overflow-y-scroll snap-y snap-mandatory hide-scroll relative"
    >
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 p-4 flex items-center justify-between pointer-events-none">
        {/* Logo and Tagline */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={scrollToTop}
            className="text-2xl font-black text-white drop-shadow-md hover:opacity-85 transition-opacity tracking-tight"
          >
            WikiTok
          </button>
        </div>

        {/* Center: Topic selector pills (Desktop) */}
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

        {/* Right Menu Controls */}
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

      {/* Mobile Topic Selector (under header) */}
      <div className="fixed top-14 left-0 right-0 z-30 sm:hidden flex items-center justify-center pointer-events-none px-4">
        <div className="pointer-events-auto overflow-x-auto max-w-full hide-scroll">
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

      {/* First-time swipe hint */}
      {!hasScrolled && articles.length > 0 && (
        <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1 text-white/60 animate-bounce">
          <span className="text-[11px] uppercase tracking-wider font-semibold drop-shadow">
            Swipe up for next
          </span>
          <ChevronDown className="w-4 h-4" />
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 z-50 p-6 md:p-8 rounded-2xl max-w-md w-full relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl md:text-2xl font-bold mb-3">About WikiTok</h2>
            <p className="text-gray-300 text-sm md:text-base mb-4 leading-relaxed">
              A TikTok-style vertical feed for discovering and exploring random
              Wikipedia articles in multiple languages.
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

      {/* Liked Articles Modal */}
      {showLikes && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowLikes(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 z-50 p-6 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLikes(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-between items-center mb-4 pr-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
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
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search liked articles..."
                className="w-full bg-gray-800 text-white px-4 py-2.5 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/5 text-sm"
              />
              <Search className="w-4 h-4 text-white/50 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
              {filteredLikedArticles.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-white/50 text-sm">
                  {searchQuery ? "No matches found." : "No liked articles yet."}
                </div>
              ) : (
                filteredLikedArticles.map((article) => (
                  <div
                    key={article.pageid}
                    className="flex gap-4 items-start p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    {article.thumbnail?.source && (
                      <img
                        src={article.thumbnail.source}
                        alt={article.title}
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
                          className="font-bold text-sm text-left hover:text-blue-300 transition-colors truncate"
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
                      <p className="text-xs text-white/70 line-clamp-2 mt-1">
                        {article.extract}
                      </p>
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Article Cards Stream */}
      {articles.map((article, idx) => (
        <WikiCard
          key={`${article.pageid}-${idx}`}
          article={article}
          isActive={idx === activeArticleIndex}
        />
      ))}

      {/* Infinite Scroll Sentinel */}
      <div ref={observerTarget} className="h-10 -mt-1" />

      {/* Loading Spinner */}
      {loading && articles.length === 0 && (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-sm font-medium tracking-wide">
            Discovering articles...
          </span>
        </div>
      )}

      {/* Global Reader Modal for Liked Articles */}
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
