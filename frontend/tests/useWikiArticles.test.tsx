import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalizationProvider } from "../src/contexts/LocalizationContext";
import { useLocalization } from "../src/hooks/useLocalization";
import { useWikiArticles } from "../src/hooks/useWikiArticles";

interface PendingFetch {
  url: string;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
}

const pending: PendingFetch[] = [];

function jsonResponse(title: string, pageid: number, langHost: string) {
  return new Response(
    JSON.stringify({
      query: {
        pages: {
          [pageid]: {
            pageid,
            title,
            extract: `${title} has a long enough introduction for the feed filter.`,
            canonicalurl: `https://${langHost}/wiki/${encodeURIComponent(title)}`,
            thumbnail: {
              source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/800px-Cat.jpg",
              width: 800,
              height: 600,
            },
          },
        },
      },
      continue: { gsroffset: 20 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function Harness() {
  const feed = useWikiArticles();
  const { setLanguage } = useLocalization();
  const [topicLabel, setTopicLabel] = useState(feed.topic);
  return (
    <div>
      <button type="button" onClick={() => setLanguage("fr")}>
        switch-fr
      </button>
      <button
        type="button"
        onClick={() => {
          feed.setTopic("science");
          setTopicLabel("science");
        }}
      >
        topic-science
      </button>
      <button type="button" onClick={feed.retry}>
        retry
      </button>
      <p data-testid="titles">{feed.articles.map((article) => `${article.lang}:${article.title}`).join("|")}</p>
      <p data-testid="error">{feed.error ?? ""}</p>
      <p data-testid="topic">{topicLabel}</p>
    </div>
  );
}

describe("useWikiArticles", () => {
  beforeEach(() => {
    pending.length = 0;
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init?.signal;
          const entry: PendingFetch = { url: String(input), resolve, reject };
          pending.push(entry);
          signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    );
  });

  it("drops articles from a request that started in another language", async () => {
    render(
      <LocalizationProvider>
        <Harness />
      </LocalizationProvider>
    );

    await waitFor(() => {
      expect(pending.some((entry) => entry.url.includes("en.wikipedia.org"))).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "switch-fr" }));

    await waitFor(() => {
      expect(pending.some((entry) => entry.url.includes("fr.wikipedia.org") && !entry.url.includes("gsrsearch"))).toBe(
        true
      );
    });

    pending
      .filter((entry) => entry.url.includes("fr.wikipedia.org"))
      .forEach((entry) => entry.resolve(jsonResponse("Paris", 123, "fr.wikipedia.org")));

    await waitFor(() => {
      expect(screen.getByTestId("titles").textContent).toContain("fr:Paris");
    });

    pending
      .filter((entry) => entry.url.includes("en.wikipedia.org"))
      .forEach((entry) => entry.resolve(jsonResponse("Earth", 123, "en.wikipedia.org")));

    await waitFor(() => {
      expect(screen.getByTestId("titles").textContent).toBe("fr:Paris");
    });
  });

  it("searches topics in the active language and can retry after a failure", async () => {
    localStorage.setItem("lang", "ja");
    render(
      <LocalizationProvider>
        <Harness />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "topic-science" }));

    await waitFor(() => {
      expect(pending.some((entry) => entry.url.includes("gsrsearch"))).toBe(true);
    });
    const topicCall = pending.find((entry) => entry.url.includes("gsrsearch"));
    expect(topicCall).toBeTruthy();
    expect(new URL(topicCall!.url).searchParams.get("gsrsearch")).toBe("科学");

    pending.forEach((entry) => entry.reject(new Error("offline")));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toMatch(/Couldn't load articles/);
    });

    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => {
      expect(pending.some((entry) => entry.url.includes("gsrsearch") && entry.url.includes("ja.wikipedia.org"))).toBe(
        true
      );
    });
  });
});
