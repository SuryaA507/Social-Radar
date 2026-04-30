"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import ExportMenu from "@/components/ExportMenu";
import TrendCard from "@/components/TrendCard";
import {
  applyTrendFilters,
  normalizeTrend,
  type TrendCategory,
} from "@/lib/trends";

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function offsetIsoDate(daysBack: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function enumerateDates(fromDate: string, toDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

interface HistoryItem {
  id: number;
  title: string;
  keyword: string;
  platform: string;
  country: string;
  mentions: number;
  engagement: number;
  score: number;
  created_at: string | null;
  snapshot_time: string | null;
}

interface HistoryResponse {
  date: string;
  count: number;
  items: HistoryItem[];
}

interface VolumePoint {
  date: string;
  mentions: number;
  items: number;
}

export default function HistoricalPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [rangeFrom, setRangeFrom] = useState(offsetIsoDate(6));
  const [rangeTo, setRangeTo] = useState(getTodayIsoDate());
  const [category, setCategory] = useState<TrendCategory | "All">("All");
  const [dayItems, setDayItems] = useState<HistoryItem[]>([]);
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState<string | null>(null);

  const [volumeSeries, setVolumeSeries] = useState<VolumePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchDay = async () => {
      setDayLoading(true);
      setDayError(null);
      try {
        const response = await fetch(
          `${apiBase}/api/history?date=${encodeURIComponent(selectedDate)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(`History fetch failed with ${response.status}`);
        }
        const payload: HistoryResponse = await response.json();
        if (alive) {
          setDayItems(payload.items || []);
        }
      } catch (error) {
        if (alive) {
          setDayItems([]);
          setDayError(error instanceof Error ? error.message : "Failed to load historical data");
        }
      } finally {
        if (alive) {
          setDayLoading(false);
        }
      }
    };

    void fetchDay();

    return () => {
      alive = false;
    };
  }, [apiBase, selectedDate]);

  useEffect(() => {
    let alive = true;

    const fetchVolumeSeries = async () => {
      if (!rangeFrom || !rangeTo) {
        setVolumeSeries([]);
        return;
      }
      if (rangeFrom > rangeTo) {
        setChartError("Start date must be before or equal to end date");
        setVolumeSeries([]);
        setChartLoading(false);
        return;
      }

      setChartLoading(true);
      setChartError(null);
      try {
        const dates = enumerateDates(rangeFrom, rangeTo);
        const responses = await Promise.all(
          dates.map(async (date) => {
            const response = await fetch(
              `${apiBase}/api/history?date=${encodeURIComponent(date)}`,
              { cache: "no-store" },
            );
            if (!response.ok) {
              throw new Error(`Range history fetch failed with ${response.status}`);
            }
            const payload: HistoryResponse = await response.json();
            const mentions = (payload.items || []).reduce(
              (sum, item) => sum + Number(item.mentions || 0),
              0,
            );
            return {
              date,
              mentions,
              items: payload.count || 0,
            } as VolumePoint;
          }),
        );

        if (alive) {
          setVolumeSeries(responses);
        }
      } catch (error) {
        if (alive) {
          setVolumeSeries([]);
          setChartError(error instanceof Error ? error.message : "Failed to load range volume");
        }
      } finally {
        if (alive) {
          setChartLoading(false);
        }
      }
    };

    void fetchVolumeSeries();

    return () => {
      alive = false;
    };
  }, [apiBase, rangeFrom, rangeTo]);

  const archivedTrends = useMemo(() => {
    const normalized = dayItems.map((item) =>
      normalizeTrend({
        keyword: item.keyword,
        title: item.title,
        platform: item.platform,
        country: item.country,
        mentions: item.mentions,
        engagement: item.engagement,
        created_at: item.created_at || "",
        score: item.score,
        source_url: `#history-${item.id}`,
      }),
    );
    return applyTrendFilters(normalized, { category }).slice(0, 12);
  }, [dayItems, category]);

  const peakMentions = useMemo(
    () => Math.max(1, ...volumeSeries.map((point) => point.mentions)),
    [volumeSeries],
  );

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[28px] p-5 sm:p-6">
        <div className="panel-header mb-6 flex flex-col gap-4 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="tactical-label">Historical</div>
            <h1 className="text-2xl font-semibold">Archive Playback</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Explore persisted trend snapshots for a selected day and monitor volume movement across a date range.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <ExportMenu type="historical" date={selectedDate} />
            <div className="grid gap-3 sm:grid-cols-3">
            <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
              <span className="tactical-label">Snapshot Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
              />
            </label>
            <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
              <span className="tactical-label">Range From</span>
              <input
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
              />
            </label>
            <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
              <span className="tactical-label">Range To</span>
              <input
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
              />
            </label>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
          <div>
            <CategoryFilter selected={category} onSelect={setCategory} />

            <div className="mt-6">
              {dayLoading ? (
                <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
                  Loading historical snapshot...
                </div>
              ) : dayError ? (
                <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.18em] text-danger">
                  {dayError}
                </div>
              ) : archivedTrends.length === 0 ? (
                <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-muted">
                  No trends stored for selected date
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {archivedTrends.map((trend, index) => (
                    <TrendCard
                      key={`${trend.source_url}-${selectedDate}-${index}`}
                      trend={trend}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <section className="rounded-[24px] border border-card-border/90 bg-black/20 p-5">
            <div className="panel-header mb-4 flex items-center justify-between pb-3">
              <div>
                <div className="tactical-label">Volume Chart</div>
                <h2 className="text-lg font-semibold">Trend Volume by Day</h2>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.2em] text-muted">
                {rangeFrom} to {rangeTo}
              </div>
            </div>

            {chartLoading ? (
              <div className="grid h-[320px] place-items-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
                Building range chart...
              </div>
            ) : chartError ? (
              <div className="grid h-[320px] place-items-center text-center font-mono text-sm uppercase tracking-[0.18em] text-danger">
                {chartError}
              </div>
            ) : volumeSeries.length === 0 ? (
              <div className="grid h-[320px] place-items-center font-mono text-sm uppercase tracking-[0.28em] text-muted">
                No volume data in selected range
              </div>
            ) : (
              <div className="chart-grid rounded-2xl border border-card-border/70 bg-[rgba(2,8,13,0.72)] p-4">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
                  <span>Peak mentions: {peakMentions.toLocaleString()}</span>
                  <span>
                    Total: {volumeSeries.reduce((sum, point) => sum + point.mentions, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex h-[250px] items-end gap-2">
                  {volumeSeries.map((point) => {
                    const height = Math.max(8, Math.round((point.mentions / peakMentions) * 100));
                    return (
                      <div key={point.date} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="relative flex h-[200px] w-full items-end justify-center">
                          <div
                            className="w-full rounded-t-md border border-cyan-glow/25 bg-gradient-to-t from-cyan-glow/25 to-green-glow/70 transition-opacity duration-200 group-hover:opacity-100"
                            style={{ height: `${height}%`, opacity: 0.8 }}
                            title={`${point.date}: ${point.mentions.toLocaleString()} mentions (${point.items} records)`}
                          />
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-muted">
                          {point.date.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
