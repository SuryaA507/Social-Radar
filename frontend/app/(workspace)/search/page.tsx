"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CategoryFilter from "@/components/CategoryFilter";
import TrendCard from "@/components/TrendCard";
import { normalizeTrend, type TrendCategory } from "@/lib/trends";

interface SearchMatch {
  keyword: string;
  title: string;
  platform: string;
  country: string;
  mentions: number;
  engagement: number;
  score: number;
  created_at: string;
  source_url: string;
  snapshot_time?: string;
}

interface BreakdownItem {
  name: string;
  count: number;
}

interface SearchResponse {
  live_matches: SearchMatch[];
  historical_matches: SearchMatch[];
  top_regions: BreakdownItem[];
  top_platforms: BreakdownItem[];
  related_keywords: string[];
}

function useSearchResults(query: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

  const [data, setData] = useState<SearchResponse>({
    live_matches: [],
    historical_matches: [],
    top_regions: [],
    top_platforms: [],
    related_keywords: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!query.trim()) {
        setData({
          live_matches: [],
          historical_matches: [],
          top_regions: [],
          top_platforms: [],
          related_keywords: [],
        });
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "24" });
        const response = await fetch(`${apiBase}/api/search?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Search failed with ${response.status}`);
        }

        const payload: SearchResponse = await response.json();
        if (active) {
          setData(payload);
        }
      } catch (err) {
        if (active) {
          setData({
            live_matches: [],
            historical_matches: [],
            top_regions: [],
            top_platforms: [],
            related_keywords: [],
          });
          setError(err instanceof Error ? err.message : "Failed to load search results");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [apiBase, query]);

  return { data, isLoading, error };
}

function dayLabel(value: string) {
  if (!value) {
    return "Unknown";
  }
  return value.slice(0, 10);
}

function SearchPageContent() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const [category, setCategory] = useState<TrendCategory | "All">("All");
  const [platform, setPlatform] = useState("All");
  const { data, isLoading, error } = useSearchResults(query);

  const platformTabs = useMemo(
    () => ["All", ...data.top_platforms.map((item) => item.name)],
    [data.top_platforms],
  );

  const combined = useMemo(
    () => [...data.live_matches, ...data.historical_matches].map((item) => normalizeTrend(item)),
    [data.live_matches, data.historical_matches],
  );

  const filtered = useMemo(() => {
    return combined.filter((item) => {
      const categoryPass = category === "All" || item.category === category;
      const platformPass = platform === "All" || item.platform === platform;
      return categoryPass && platformPass;
    });
  }, [combined, category, platform]);

  const timeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data.historical_matches) {
      const key = dayLabel(item.snapshot_time || item.created_at);
      counts.set(key, (counts.get(key) || 0) + Number(item.mentions || 0));
    }

    return Array.from(counts.entries())
      .map(([date, mentions]) => ({ date, mentions }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [data.historical_matches]);

  const peakTimeline = Math.max(1, ...timeline.map((item) => item.mentions));

  const hasResults = filtered.length > 0;

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[28px] p-5 sm:p-6">
        <div className="panel-header mb-6 flex flex-col gap-4 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="tactical-label">Event Search</div>
            <h1 className="text-2xl font-semibold">Cross-Signal Search Engine</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Query live and historical trends across keywords, titles, platforms, and regional clusters.
            </p>
          </div>
          <div className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
            <div className="tactical-label">Query</div>
            <div className="mt-2 font-mono text-sm text-cyan-glow">{query || "No query"}</div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {platformTabs.map((name) => {
            const active = platform === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setPlatform(name)}
                className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition-all ${
                  active
                    ? "border-cyan-glow/40 bg-cyan-glow/12 text-cyan-glow"
                    : "border-card-border/80 bg-black/20 text-muted hover:text-foreground"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        <CategoryFilter selected={category} onSelect={setCategory} />

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div>
            {isLoading ? (
              <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
                Running event search...
              </div>
            ) : error ? (
              <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.18em] text-danger">
                {error}
              </div>
            ) : !query.trim() ? (
              <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-muted">
                Enter a query in the top search bar
              </div>
            ) : !hasResults ? (
              <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-muted">
                No matching events found
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                {filtered.slice(0, 12).map((trend, index) => (
                  <TrendCard key={`${trend.source_url}-${index}`} trend={trend} index={index} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
              <div className="panel-header mb-4 pb-3">
                <div className="tactical-label">Timeline</div>
                <h2 className="text-lg font-semibold">Historical Mentions</h2>
              </div>

              {timeline.length === 0 ? (
                <div className="py-12 text-center text-xs uppercase tracking-[0.2em] text-muted">
                  No timeline data
                </div>
              ) : (
                <div className="chart-grid rounded-xl border border-card-border/60 p-3">
                  <div className="flex h-44 items-end gap-1.5">
                    {timeline.map((item) => (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-32 w-full items-end justify-center">
                          <div
                            className="w-full rounded-t border border-cyan-glow/30 bg-gradient-to-t from-cyan-glow/25 to-green-glow/70"
                            style={{ height: `${Math.max(8, Math.round((item.mentions / peakTimeline) * 100))}%` }}
                            title={`${item.date}: ${item.mentions.toLocaleString()} mentions`}
                          />
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted">
                          {item.date.slice(5)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
              <div className="panel-header mb-4 pb-3">
                <div className="tactical-label">Region Breakdown</div>
                <h2 className="text-lg font-semibold">Top Regions</h2>
              </div>
              {data.top_regions.length === 0 ? (
                <div className="text-sm text-muted">No region matches</div>
              ) : (
                <div className="space-y-3">
                  {data.top_regions.map((region) => (
                    <div key={region.name}>
                      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
                        <span>{region.name}</span>
                        <span>{region.count}</span>
                      </div>
                      <div className="data-bar h-2.5">
                        <span
                          style={{
                            width: `${Math.max(8, Math.round((region.count / (data.top_regions[0]?.count || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
              <div className="panel-header mb-4 pb-3">
                <div className="tactical-label">Related Keywords</div>
                <h2 className="text-lg font-semibold">Suggested Terms</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.related_keywords.length === 0 ? (
                  <span className="text-sm text-muted">No related keywords</span>
                ) : (
                  data.related_keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-green-glow/30 bg-green-glow/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-green-glow"
                    >
                      {keyword}
                    </span>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <section className="glass-panel rounded-[28px] p-5 sm:p-6">
            <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
              Preparing search workspace...
            </div>
          </section>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
