import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { prefersReducedMotion } from "../lib/motion";

export interface TopicItem {
  id: string;
  label: string;
}

interface TopicSelectorProps {
  topics: TopicItem[];
  activeTopic: string;
  onSelectTopic: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function TopicSelector({
  topics,
  activeTopic,
  onSelectTopic,
  size = "md",
  className = "",
}: TopicSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const [hasInitialized, setHasInitialized] = useState(false);

  const updateIndicator = useCallback(() => {
    const activeEl = buttonRefs.current.get(activeTopic);
    const containerEl = containerRef.current;
    if (activeEl && containerEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        ready: true,
      });
    }
  }, [activeTopic]);

  // Synchronous layout calculation before paint
  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    if (!hasInitialized) {
      const timer = setTimeout(() => setHasInitialized(true), 50);
      return () => clearTimeout(timer);
    }
  }, [hasInitialized]);

  // Auto-update when fonts load, window resizes, or layout shifts
  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateIndicator);
    }

    const containerEl = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerEl) {
      observer = new ResizeObserver(() => updateIndicator());
      observer.observe(containerEl);
      buttonRefs.current.forEach((btn) => {
        if (btn) observer?.observe(btn);
      });
    }

    return () => {
      window.removeEventListener("resize", updateIndicator);
      observer?.disconnect();
    };
  }, [updateIndicator]);

  const handleSelect = (id: string) => {
    onSelectTopic(id);
    const activeEl = buttonRefs.current.get(id);
    const scroller = activeEl?.closest("[data-topic-scroll]");
    if (!activeEl || !scroller) return;
    const elementRect = activeEl.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const delta = elementRect.left - scrollerRect.left - (scrollerRect.width - elementRect.width) / 2;
    scroller.scrollBy({
      left: delta,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const isSmall = size === "sm";

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Category filter"
      className={`relative inline-flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg select-none flex-shrink-0 ${className}`}
    >
      {/* Sliding Active Pill Indicator */}
      <span
        aria-hidden="true"
        className={`absolute rounded-full bg-white shadow-md pointer-events-none ${
          hasInitialized
            ? "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            : "transition-opacity duration-150"
        } ${indicatorStyle.ready ? "opacity-100" : "opacity-0"}`}
        style={{
          left: `${indicatorStyle.left}px`,
          top: `${indicatorStyle.top}px`,
          width: `${indicatorStyle.width}px`,
          height: `${indicatorStyle.height}px`,
        }}
      />

      {/* Category Buttons */}
      {topics.map((t) => {
        const isActive = activeTopic === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            ref={(el) => {
              if (el) buttonRefs.current.set(t.id, el);
              else buttonRefs.current.delete(t.id);
            }}
            onClick={() => handleSelect(t.id)}
            className={`relative z-10 rounded-full font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap flex-shrink-0 ${
              isSmall ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
            } ${
              isActive
                ? "text-black font-semibold"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
