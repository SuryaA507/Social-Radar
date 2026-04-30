"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchAnalystSummary,
  type AnalystBreakdownItem,
  type AnalystSummaryResponse,
  type AnalystMode,
  ANALYST_MODES,
} from "@/lib/aiAnalyst";

const REGION_OPTIONS = [
  "Global",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Africa",
  "Oceania",
  "Middle East",
] as const;

const DEFAULT_QUERY = "What is trending globally today?";

interface AnalystHistoryItem {
  id: number;
  query: string;
  region: string;
  days: number;
}

function riskBadgeClass(risk: string) {
  const normalized = risk.toLowerCase();
  if (normalized === "high") {
    return "border-danger/50 bg-danger/10 text-danger";
  }
  if (normalized === "medium") {
    return "border-amber-400/50 bg-amber-400/10 text-amber-300";
  }
  return "border-emerald-400/50 bg-emerald-400/10 text-emerald-300";
}

function sentimentBadgeClass(sentiment: string) {
  const normalized = sentiment.toLowerCase();
  if (normalized === "negative") {
    return "border-danger/50 bg-danger/10 text-danger";
  }
  if (normalized === "positive") {
    return "border-emerald-400/50 bg-emerald-400/10 text-emerald-300";
  }
  return "border-cyan-glow/50 bg-cyan-glow/12 text-cyan-glow";
}

function BreakdownList({
  title,
  items,
  showMomentum,
}: {
  title: string;
  items: AnalystBreakdownItem[];
  showMomentum?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
      <div className="panel-header mb-4 pb-3">
        <div className="tactical-label">{title}</div>
      </div>
      {items.length === 0 ? (
        <div className="py-4 text-center text-xs uppercase tracking-[0.2em] text-muted">
          No signals
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 6).map((item) => (
            <div
              key={`${title}-${item.name}`}
              className="flex items-center justify-between rounded-xl border border-card-border/70 bg-[#07131d] px-3 py-2"
            >
              <div className="text-sm text-foreground">{item.name}</div>
              <div className="text-xs text-muted">
                {showMomentum && typeof item.momentum === "number"
                  ? `momentum ${item.momentum.toFixed(1)} | `
                  : ""}
                count {item.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AiAnalystPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [region, setRegion] = useState("Global");
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState<AnalystMode>("summary");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnalystSummaryResponse | null>(null);
  const [history, setHistory] = useState<AnalystHistoryItem[]>([]);

  const lastPrompt = useMemo(() => {
    if (!history[0]) {
      return "No prompts submitted yet.";
    }
    const item = history[0];
    return `${item.query} | ${item.region} | ${item.days} day(s)`;
  }, [history]);

  const submitPrompt = async (payload: { query: string; region: string; days: number; mode: AnalystMode }) => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchAnalystSummary(apiBase, payload);
      setResponse(next);
      setHistory((previous) => [
        {
          id: Date.now(),
          query: payload.query,
          region: payload.region,
          days: payload.days,
        },
        ...previous,
      ].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate analyst brief");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void submitPrompt({
      query: DEFAULT_QUERY,
      region: "Global",
      days: 7,
      mode: "summary",
    });
    // Run once to hydrate the page with an initial analyst brief.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuery = query.trim() || DEFAULT_QUERY;
    void submitPrompt({
      query: normalizedQuery,
      region,
      days,
      mode,
    });
  };

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[28px] p-5 sm:p-6">
        <div className="panel-header mb-6 flex flex-col gap-4 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="tactical-label">AI Analyst</div>
            <h1 className="text-2xl font-semibold">Analyst Query Console</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Generate structured intelligence briefs from live plus historical trend signals.
            </p>
          </div>
          <div className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
            <div className="tactical-label">Last Prompt</div>
            <div className="mt-2 max-w-sm text-xs text-muted">{lastPrompt}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.15fr]">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-[24px] border border-card-border/80 bg-black/20 p-5"
          >
            <div>
              <div className="tactical-label">Chat Input</div>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="What is trending globally today?"
                className="mt-3 min-h-40 w-full rounded-2xl border border-card-border/70 bg-[#07131d] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-card-border/70 bg-[#07131d] px-4 py-3">
                <span className="tactical-label">Region</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-[#07131d] text-foreground">
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rounded-2xl border border-card-border/70 bg-[#07131d] px-4 py-3">
                <span className="tactical-label">Lookback Days</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    const safe = Number.isFinite(parsed) ? Math.min(30, Math.max(1, parsed)) : 7;
                    setDays(safe);
                  }}
                  className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
                />
              </label>
            </div>

            <label className="rounded-2xl border border-card-border/70 bg-[#07131d] px-4 py-3">
              <span className="tactical-label">Analysis Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as AnalystMode)}
                className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
              >
                {(Object.entries(ANALYST_MODES) as [AnalystMode, typeof ANALYST_MODES[AnalystMode]][]).map(
                  ([modeKey, modeInfo]) => (
                    <option key={modeKey} value={modeKey} className="bg-[#07131d] text-foreground">
                      {modeInfo.label} - {modeInfo.description}
                    </option>
                  )
                )}
              </select>
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-full border border-cyan-glow/30 bg-cyan-glow/12 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-glow transition hover:bg-cyan-glow/18"
            >
              {isLoading ? "Generating..." : "Generate Brief"}
            </button>

            <div className="rounded-2xl border border-card-border/70 bg-[#07131d] p-4">
              <div className="tactical-label">Recent Prompts</div>
              <div className="mt-3 space-y-2">
                {history.length === 0 ? (
                  <div className="text-xs uppercase tracking-[0.16em] text-muted">
                    Waiting for first analyst query
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setQuery(item.query);
                        setRegion(item.region);
                        setDays(item.days);
                      }}
                      className="w-full rounded-xl border border-card-border/70 bg-black/20 px-3 py-2 text-left text-xs text-muted transition hover:text-foreground"
                    >
                      {item.query}
                    </button>
                  ))
                )}
              </div>
            </div>
          </form>

          <div className="space-y-4">
            <section className="rounded-[24px] border border-card-border/80 bg-black/20 p-5">
              <div className="panel-header mb-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="tactical-label">Analyst Response</div>
                    <h2 className="text-lg font-semibold">Strategic Summary</h2>
                  </div>
                  {response && (
                    <span className="rounded-full border border-cyan-glow/30 bg-cyan-glow/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-glow">
                      {ANALYST_MODES[response.mode]?.label || response.mode}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-card-border/70 bg-[#07131d] p-4 text-sm leading-7 text-gray-300">
                {isLoading ? (
                  "Scanning live and historical trend signals..."
                ) : error ? (
                  <span className="text-danger">{error}</span>
                ) : response ? (
                  response.summary
                ) : (
                  "Submit a prompt to generate an analyst brief."
                )}
              </div>
              {response ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${sentimentBadgeClass(response.sentiment)}`}
                  >
                    Sentiment: {response.sentiment}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${riskBadgeClass(response.risk_level)}`}
                  >
                    Risk: {response.risk_level}
                  </span>
                </div>
              ) : null}
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <BreakdownList
                title="Top Topics"
                items={response?.top_topics || []}
                showMomentum
              />
              <BreakdownList title="Top Regions" items={response?.top_regions || []} />
              <BreakdownList title="Top Platforms" items={response?.top_platforms || []} />
            </div>

            {response?.top_topics?.length ? (
              <section className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
                <div className="panel-header mb-4 pb-3">
                  <div className="tactical-label">Analyst Cards</div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {response.top_topics.slice(0, 4).map((topic, index) => (
                    <div
                      key={`${topic.name}-${index}`}
                      className="rounded-xl border border-card-border/70 bg-[#07131d] p-4"
                    >
                      <div className="text-xs uppercase tracking-[0.18em] text-cyan-glow">Topic #{index + 1}</div>
                      <div className="mt-2 text-sm font-medium text-foreground">{topic.name}</div>
                      <div className="mt-1 text-xs text-muted">
                        Count {topic.count}
                        {typeof topic.momentum === "number"
                          ? ` | Momentum ${topic.momentum.toFixed(1)}`
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
