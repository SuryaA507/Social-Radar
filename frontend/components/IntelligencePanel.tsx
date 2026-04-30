"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Clock, Globe, Hash, MessageSquare, TrendingUp, X } from "@/components/Icons";
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

interface IntelligencePanelData {
  country: string;
  region?: string;
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

interface IntelligencePanelProps {
  country: string | null;
  onClose: () => void;
  inline?: boolean;
}

const PANEL_TABS = [
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

function MiniTrendChart({ series }: { series: TrendVolumePoint[] }) {
  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-6 text-center text-sm text-muted">
        No volume history captured yet.
      </div>
    );
  }

  const maxCount = Math.max(...series.map((point) => point.count), 1);

  return (
    <div className="rounded-[22px] border border-card-border/80 bg-black/20 p-4">
      <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted">
        <span>Volume Change</span>
        <span>7 Day Window</span>
      </div>
      <div className="flex h-36 items-end gap-3">
        {series.map((point) => {
          const height = `${Math.max((point.count / maxCount) * 100, 14)}%`;
          return (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-2xl border border-cyan-glow/20 bg-gradient-to-t from-cyan-glow/20 via-cyan-glow/55 to-green-glow/85 shadow-[0_0_22px_rgba(92,225,255,0.18)]"
                  style={{ height }}
                />
              </div>
              <div className="text-center">
                <div className="font-mono text-xs text-cyan-glow">{point.count}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                  {point.date.slice(5)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IntelligencePanel({
  country,
  onClose,
  inline = false,
}: IntelligencePanelProps) {
  const [data, setData] = useState<IntelligencePanelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] =
    useState<(typeof PANEL_TABS)[number]["value"]>("all");

  useEffect(() => {
    if (!country) {
      setData(null);
      setSelectedPlatform("all");
      return;
    }

    const fetchIntelligence = async () => {
      setIsLoading(true);
      try {
        const apiBase = getApiBase();
        const searchParams = new URLSearchParams({ name: country });
        if (selectedPlatform !== "all") {
          searchParams.set("platform", selectedPlatform);
        }

        const response = await fetch(`${apiBase}/api/map/country?${searchParams.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch intelligence with ${response.status}`);
        }

        const intelligence: IntelligencePanelData = await response.json();
        setData(intelligence);
      } catch (error) {
        console.error("Failed to fetch country intelligence:", error);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchIntelligence();
  }, [country, selectedPlatform]);

  const activeTrends = useMemo(() => {
    if (!data) {
      return [] as IntelligenceTrend[];
    }
    if (selectedPlatform === "all") {
      return data.top_trends;
    }
    return data.platforms[selectedPlatform] || [];
  }, [data, selectedPlatform]);

  const activeRecentContent = useMemo(() => {
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

  if (!country && !inline) {
    return null;
  }

  const shellClassName = inline
    ? "glass-panel scan-line flex h-full min-h-[26rem] flex-col rounded-[28px] p-5 sm:p-6"
    : "glass-panel scan-line h-screen w-full max-w-[34rem] overflow-y-auto border-l border-cyan-glow/20 bg-[linear-gradient(180deg,rgba(9,18,27,0.96),rgba(5,10,16,0.94))]";

  const contentClassName = inline
    ? "flex-1 space-y-6 overflow-y-auto pr-2"
    : "space-y-6 px-4 py-5 sm:px-6 sm:py-6";

  const selectedCountryName = country || "Map Intelligence";

  const emptyState = (
    <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-12 text-center text-sm text-muted">
      Click a highlighted country on the map to inspect platform trends, hashtag clusters, and recent content for that geography.
    </div>
  );

  const panelBody = (
    <aside className={shellClassName}>
      <div className={inline ? "panel-header mb-6 pb-4" : "sticky top-0 z-20 border-b border-cyan-glow/10 bg-black/55 px-4 py-4 backdrop-blur-md sm:px-6"}>
        <div className={inline ? "flex items-start justify-between gap-4" : "flex items-start justify-between gap-4"}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="tactical-label">Regional Intelligence</div>
              <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
                {selectedCountryName}
              </h2>
              <p className="mt-2 text-sm text-muted">
                Tactical readout across live feeds, regional momentum, and archived signal flow.
              </p>
            </div>
          </div>
          {!inline && (
            <button
              onClick={onClose}
              className="rounded-2xl border border-cyan-glow/20 bg-cyan-glow/10 p-2 text-cyan-glow transition-colors hover:bg-cyan-glow/20"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-card-border/80 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Avg Score</div>
              <div className="mt-2 text-xl font-semibold text-cyan-glow">
                {data ? data.trend_score.average.toFixed(1) : "--"}
              </div>
            </div>
            <div className="rounded-2xl border border-card-border/80 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Peak Score</div>
              <div className="mt-2 text-xl font-semibold text-green-glow">
                {data ? data.trend_score.peak.toFixed(1) : "--"}
              </div>
            </div>
          </div>
      </div>

      <div className={inline ? "mb-5" : "border-b border-cyan-glow/10 px-4 py-3 sm:px-6"}>
          <div className="flex flex-wrap gap-2">
            {PANEL_TABS.map((tab) => {
              const active = selectedPlatform === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedPlatform(tab.value)}
                  className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.2em] transition-all ${
                    active
                      ? "border-cyan-glow/45 bg-cyan-glow text-black shadow-[0_0_18px_rgba(92,225,255,0.2)]"
                      : "border-card-border/80 bg-black/20 text-muted hover:border-cyan-glow/20 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
      </div>

      <div className={contentClassName}>
          {isLoading ? (
            <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.28em] text-cyan-glow">
              Building regional brief...
            </div>
          ) : !country ? (
            emptyState
          ) : !data ? (
            <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-12 text-center text-sm text-muted">
              No intelligence data is available for this selection yet.
            </div>
          ) : (
            <>
              <section className="rounded-[24px] border border-card-border/80 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-glow" />
                  <div className="tactical-label">Trend Score</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-card-border/70 bg-black/25 p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Mentions</div>
                    <div className="mt-2 font-mono text-lg text-foreground">
                      {data.trend_score.mentions.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-card-border/70 bg-black/25 p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Engagement</div>
                    <div className="mt-2 font-mono text-lg text-foreground">
                      {data.trend_score.engagement.toLocaleString()}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-cyan-glow" />
                  <div className="tactical-label">Trending Hashtags</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.hashtags.length === 0 ? (
                    <div className="rounded-full border border-card-border/80 bg-black/20 px-3 py-2 text-xs text-muted">
                      No tags identified yet.
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
                  <Globe className="h-4 w-4 text-cyan-glow" />
                  <div className="tactical-label">Top Trends</div>
                </div>
                <div className="space-y-3">
                  {activeTrends.length === 0 ? (
                    <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-8 text-sm text-muted">
                      No ranked trends for this platform slice.
                    </div>
                  ) : (
                    activeTrends.slice(0, 5).map((trend, index) => {
                      const scoreWidth = Math.max(16, Math.min(100, trend.score));
                      return (
                        <a
                          key={`${trend.source_url}-${index}`}
                          href={trend.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-[22px] border border-card-border/80 bg-black/20 p-4 transition-all hover:border-cyan-glow/25 hover:bg-black/35"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-card-border/70 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-glow">
                                  {trend.keyword}
                                </span>
                                <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
                                  {trend.platform}
                                </span>
                              </div>
                              <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-foreground">
                                {trend.title}
                              </h3>
                            </div>
                            <div className="font-mono text-sm text-green-glow">
                              {trend.score.toFixed(1)}
                            </div>
                          </div>
                          <div className="mt-3 data-bar h-2.5">
                            <span style={{ width: `${scoreWidth}%` }} />
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-muted">
                            <span>{trend.country}</span>
                            <span>{trend.mentions.toLocaleString()} mentions</span>
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-glow" />
                  <div className="tactical-label">Recent Content</div>
                </div>
                <div className="space-y-3">
                  {activeRecentContent.length === 0 ? (
                    <div className="rounded-[22px] border border-card-border/80 bg-black/20 px-4 py-8 text-sm text-muted">
                      No recent content available for this platform slice.
                    </div>
                  ) : (
                    activeRecentContent.slice(0, 4).map((trend, index) => (
                      <div
                        key={`${trend.source_url}-recent-${index}`}
                        className="rounded-[22px] border border-card-border/80 bg-black/20 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-muted">
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
                <MiniTrendChart series={data.trend_volume} />
              </section>

              <section className="rounded-[24px] border border-card-border/80 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-cyan-glow" />
                  <div className="tactical-label">AI Summary</div>
                </div>
                <p className="text-sm leading-7 text-muted">{data.summary}</p>
              </section>
            </>
          )}
      </div>
    </aside>
  );

  if (inline) {
    return panelBody;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close intelligence panel"
        onClick={onClose}
        className="hidden flex-1 bg-black/55 backdrop-blur-[2px] lg:block"
      />
      {panelBody}
    </div>
  );
}
