"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Clock, Globe, Hash, MessageSquare, TrendingUp } from "@/components/Icons";
import { getApiBase } from "@/lib/api";

interface IntelligenceTrend {
  keyword: string;
  title: string;
  platform: string;
  country: string;
  mentions: number;
  engagement: number;
  created_at: string;
  source_url: string;
  score: number;
}

interface TrendVolumePoint {
  date: string;
  count: number;
  avg_score: number;
}

interface RegionIntelligenceResponse {
  country: string;
  region: string;
  top_trends: IntelligenceTrend[];
  hashtags: Array<{ tag: string; count: number }>;
  platforms: Record<string, IntelligenceTrend[]>;
  recent_content: IntelligenceTrend[];
  summary: string;
  trend_volume: TrendVolumePoint[];
  trend_score: {
    average: number;
    peak: number;
    mentions: number;
    engagement: number;
  };
}

const PLATFORM_TABS = [
  { label: "All", value: "all" },
  { label: "YouTube", value: "youtube" },
  { label: "Reddit", value: "reddit" },
  { label: "X", value: "x" },
  { label: "Facebook", value: "facebook" },
] as const;

function formatUtcTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Live";
  }
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

function MiniTrendChart({ points }: { points: TrendVolumePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border/80 bg-black/20 p-4 text-sm text-muted">
        No trend volume history available yet.
      </div>
    );
  }

  const maxCount = Math.max(...points.map((point) => point.count), 1);

  return (
    <div className="rounded-[22px] border border-card-border/80 bg-black/20 p-4">
      <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Volume</span>
        <span>7 Day Snapshot</span>
      </div>
      <div className="flex h-28 items-end gap-2">
        {points.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-full w-full items-end">
              <div
                className="w-full rounded-t-2xl border border-cyan-glow/20 bg-gradient-to-t from-cyan-glow/20 via-cyan-glow/50 to-green-glow/85"
                style={{
                  height: `${Math.max((point.count / maxCount) * 100, 14)}%`,
                }}
              />
            </div>
            <div className="text-center text-[10px] uppercase tracking-[0.16em] text-muted">
              {point.date.slice(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MapRegionPanel({
  name,
  scope = "region",
}: {
  name: string;
  scope?: "country" | "region";
}) {
  const [selectedPlatform, setSelectedPlatform] =
    useState<(typeof PLATFORM_TABS)[number]["value"]>("all");
  const [data, setData] = useState<RegionIntelligenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchLocationIntelligence = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const apiBase = getApiBase();
        const params = new URLSearchParams({ name });
        if (selectedPlatform !== "all") {
          params.set("platform", selectedPlatform);
        }

        const endpoint = scope === "country" ? "/api/map/country" : "/api/map/region";
        const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Location intelligence failed with ${response.status}`);
        }

        const payload: RegionIntelligenceResponse = await response.json();
        if (active) {
          setData(payload);
        }
      } catch (fetchError) {
        if (active) {
          setData(null);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load location intelligence",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void fetchLocationIntelligence();

    return () => {
      active = false;
    };
  }, [name, scope, selectedPlatform]);

  const visibleTopTrends = useMemo(() => {
    if (!data) {
      return [] as IntelligenceTrend[];
    }
    if (selectedPlatform === "all") {
      return data.top_trends;
    }
    return data.platforms[selectedPlatform] || [];
  }, [data, selectedPlatform]);

  const visibleRecentContent = useMemo(() => {
    if (!data) {
      return [] as IntelligenceTrend[];
    }
    if (selectedPlatform === "all") {
      return data.recent_content;
    }
    return data.recent_content.filter(
      (trend) => trend.platform.toLowerCase() === selectedPlatform,
    );
  }, [data, selectedPlatform]);

  return (
    <aside className="glass-panel h-full rounded-[30px] p-5 sm:p-6">
      <div className="panel-header mb-5 pb-4">
        <div className="tactical-label">Regional Intelligence</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{name}</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          {scope === "country" ? "Country-specific" : "Region-specific"} narrative analysis across active social channels.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {PLATFORM_TABS.map((tab) => {
          const active = selectedPlatform === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedPlatform(tab.value)}
              className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition-all ${
                active
                  ? "border-cyan-glow/40 bg-cyan-glow/12 text-cyan-glow"
                  : "border-card-border/80 bg-black/20 text-muted hover:border-cyan-glow/20 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="rounded-[24px] border border-card-border/80 bg-black/20 px-4 py-14 text-center font-mono text-xs uppercase tracking-[0.28em] text-cyan-glow">
          Analyzing {name}...
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-danger/30 bg-danger/8 px-4 py-10 text-center text-sm text-danger">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-[24px] border border-card-border/80 bg-black/20 px-4 py-10 text-center text-sm text-muted">
          No intelligence available for this selection.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-card-border/80 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Avg Score</div>
              <div className="mt-2 text-xl font-semibold text-cyan-glow">
                {data.trend_score.average.toFixed(1)}
              </div>
            </div>
            <div className="rounded-2xl border border-card-border/80 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Peak Score</div>
              <div className="mt-2 text-xl font-semibold text-green-glow">
                {data.trend_score.peak.toFixed(1)}
              </div>
            </div>
            <div className="rounded-2xl border border-card-border/80 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Mentions</div>
              <div className="mt-2 font-mono text-lg text-foreground">
                {data.trend_score.mentions.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-card-border/80 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Engagement</div>
              <div className="mt-2 font-mono text-lg text-foreground">
                {data.trend_score.engagement.toLocaleString()}
              </div>
            </div>
          </div>

          <section className="rounded-[24px] border border-card-border/80 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-glow" />
              <div className="tactical-label">AI Summary</div>
            </div>
            <p className="text-sm leading-7 text-muted">{data.summary}</p>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Hash className="h-4 w-4 text-cyan-glow" />
              <div className="tactical-label">Trending Hashtags</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.hashtags.length === 0 ? (
                <div className="rounded-full border border-card-border/80 bg-black/20 px-3 py-2 text-xs text-muted">
                  No hashtags detected
                </div>
              ) : (
                data.hashtags.map((hashtag) => (
                  <span
                    key={hashtag.tag}
                    className="rounded-full border border-cyan-glow/25 bg-cyan-glow/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-cyan-glow"
                  >
                    {hashtag.tag} <span className="text-muted">({hashtag.count})</span>
                  </span>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-glow" />
              <div className="tactical-label">Top Trends</div>
            </div>
            <div className="space-y-3">
              {visibleTopTrends.length === 0 ? (
                <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-8 text-sm text-muted">
                  No platform-specific trend data for this selection.
                </div>
              ) : (
                visibleTopTrends.slice(0, 5).map((trend, index) => (
                  <a
                    key={`${trend.source_url}-${index}`}
                    href={trend.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-[22px] border border-card-border/80 bg-black/20 p-4 transition-all hover:border-cyan-glow/25 hover:bg-black/30"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-card-border/70 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-glow">
                        {trend.keyword}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        {trend.platform}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold leading-6 text-foreground">{trend.title}</h3>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <span>{trend.country}</span>
                      <span>{trend.score.toFixed(1)} score</span>
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-glow" />
              <div className="tactical-label">Recent Content</div>
            </div>
            <div className="space-y-3">
              {visibleRecentContent.length === 0 ? (
                <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-8 text-sm text-muted">
                  No recent content found.
                </div>
              ) : (
                visibleRecentContent.slice(0, 4).map((trend, index) => (
                  <div
                    key={`${trend.source_url}-content-${index}`}
                    className="rounded-[22px] border border-card-border/80 bg-black/20 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-muted">
                      <span>{trend.platform}</span>
                      <span>{formatUtcTime(trend.created_at)}</span>
                    </div>
                    <p className="text-sm leading-6 text-foreground">{trend.title}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-cyan-glow" />
              <div className="tactical-label">Mini Trend Chart</div>
            </div>
            <MiniTrendChart points={data.trend_volume} />
          </section>

          <section className="rounded-[24px] border border-card-border/80 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-glow" />
              <div className="tactical-label">Coverage Scope</div>
            </div>
            <p className="text-sm leading-7 text-muted">
              {data.region} intelligence is being assembled from live cross-platform trends and recent historical snapshots for fast regional comparison.
            </p>
          </section>
        </div>
      )}
    </aside>
  );
}
