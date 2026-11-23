import { useEffect, useRef, useState } from "react";

interface RegisterOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("virtual:pwa-register")
      .then((mod: { registerSW: (options?: RegisterOptions) => (reload?: boolean) => Promise<void> }) => {
        if (cancelled) return;
        updateRef.current = mod.registerSW({
          onNeedRefresh() {
            setNeedRefresh(true);
          },
          onOfflineReady() {
            setOfflineReady(true);
          },
        });
      })
      .catch(() => {
        // Dev without a service worker has nothing to register.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] start-4 z-40 max-w-xs rounded-2xl border border-white/15 bg-gray-900/95 px-4 py-3 text-sm shadow-2xl">
      <p>{needRefresh ? "A new version of WikiTok is ready." : "WikiTok is ready to open offline."}</p>
      <div className="mt-2 flex gap-2">
        {needRefresh && (
          <button
            type="button"
            className="px-3 py-1 rounded-full bg-white text-black text-xs font-semibold"
            onClick={() => void updateRef.current?.(true)}
          >
            Reload
          </button>
        )}
        <button
          type="button"
          className="px-3 py-1 rounded-full bg-white/10 text-xs"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
