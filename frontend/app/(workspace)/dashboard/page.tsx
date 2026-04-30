"use client";

import TrendCard from "@/components/TrendCard";
import CategoryFilter from "@/components/CategoryFilter";
import ExportMenu from "@/components/ExportMenu";
import MapRegionPanel from "@/components/MapRegionPanel";
import WorldIntelMap from "@/components/WorldIntelMap";
import { useTrendFeed } from "@/hooks/useTrendFeed";
import { applyTrendFilters, type TrendCategory } from "@/lib/trends";
import { Activity, Map, Refresh } from "@/components/Icons";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const { trends, isLoading, feedError, refresh } = useTrendFeed("all");
  const [category, setCategory] = useState<TrendCategory | "All">("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("Asia");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const filteredTrends = useMemo(
    () => applyTrendFilters(trends, { category }).slice(0, 8),
    [trends, category],
  );
  const categoryCount = new Set(trends.map((trend) => trend.category)).size;
  const regionCount = new Set(trends.map((trend) => trend.country)).size;
  const topScore = filteredTrends[0]?.score.toFixed(1) || "0.0";

  const metrics = [
    { label: "Live Signals", value: String(trends.length), delta: "Unified" },
    { label: "Tracked Regions", value: String(regionCount), delta: "Realtime" },
    { label: "Categories Active", value: String(categoryCount), delta: "Global" },
    { label: "Top Signal Score", value: topScore, delta: "Ranked" },
  ];

  return (
    <div className="space-y-6">
      <section className="glass-panel fade-up scan-line relative overflow-hidden rounded-[30px] px-6 py-6 sm:px-8">
        <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[radial-gradient(circle_at_center,rgba(92,225,255,0.12),transparent_60%)] lg:block" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="tactical-label">Live Overview</div>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              Mission control for global narratives, category shifts, and platform signal velocity.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">
              Dashboard overview now spans politics, sports, finance, health, memes, technology, and emerging crisis signals across the active connectors.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[44rem]">
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-card-border/90 bg-black/20 px-4 py-4 fade-up"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="tactical-label">{metric.label}</div>
                <div className="mt-3 text-2xl font-semibold text-foreground">{metric.value}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-green-glow">{metric.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.5fr_0.72fr]">
        <section className="glass-panel fade-up flex h-[42rem] flex-col rounded-[28px] p-5 sm:p-6">
          <div className="panel-header mb-6 flex flex-col gap-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-glow/20 bg-cyan-glow/10">
                  <Activity className="w-5 h-5 text-cyan-glow" />
                </div>
                <div>
                  <div className="tactical-label">Dashboard</div>
                  <h2 className="text-xl font-semibold">Category Signal Board</h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 rounded-full border border-cyan-glow/30 bg-cyan-glow/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-cyan-glow hover:bg-cyan-glow/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="Refresh trends"
                >
                  <Refresh className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <ExportMenu type="live" />
              </div>
            </div>
            <CategoryFilter selected={category} onSelect={setCategory} />
          </div>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
              Scanning global signals...
            </div>
          ) : feedError ? (
            <div className="flex flex-1 items-center justify-center py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-danger">
              Signal feed unavailable
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto pr-2 md:grid-cols-2">
                {filteredTrends.map((trend, index) => (
                  <TrendCard key={`${trend.source_url}-${index}`} trend={trend} index={index} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel fade-up flex h-[42rem] flex-col rounded-[28px] p-5 sm:p-6">
          <div className="panel-header mb-6 flex items-center gap-3 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-green-glow/20 bg-green-glow/10">
              <span className="h-2.5 w-2.5 rounded-full bg-green-glow shadow-[0_0_18px_rgba(125,255,179,0.7)]"></span>
            </span>
            <div>
              <div className="tactical-label">AI Analyst</div>
              <h2 className="text-xl font-semibold">Executive Summary</h2>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            <div className="rounded-2xl border border-card-border/90 bg-black/20 p-4">
              <div className="tactical-label">Primary Narrative</div>
              <p className="mt-2 text-sm leading-7 text-muted">
                {filteredTrends[0]
                  ? `${filteredTrends[0].category} signals are currently led by "${filteredTrends[0].keyword}" across ${filteredTrends[0].platform} coverage in ${filteredTrends[0].country}.`
                  : "Live trend ranking will populate once the signal feed responds."}
              </p>
            </div>
            <div className="rounded-2xl border border-card-border/90 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-muted">
                <span>Category Emphasis</span>
                <span>Auto-tagged</span>
              </div>
              <div className="space-y-3">
                {["Politics", "Technology", "Emergencies"].map((name, index) => (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm text-gray-300">
                      <span>{name}</span>
                      <span className="text-cyan-glow">{Math.max(34, 82 - index * 16)}%</span>
                    </div>
                    <div className="data-bar h-2.5"><span style={{ width: `${Math.max(34, 82 - index * 16)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.9fr_0.92fr]">
        <section className="glass-panel fade-up relative min-h-[30rem] overflow-hidden rounded-[28px] p-5 sm:p-6">
          <div className="panel-header relative z-10 mb-6 flex items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-glow/20 bg-cyan-glow/10">
                <Map className="w-5 h-5 text-cyan-glow" />
              </div>
              <div>
                <div className="tactical-label">Regions</div>
                <h2 className="text-xl font-semibold">Global Activity Map</h2>
              </div>
            </div>
            <div className="rounded-full border border-green-glow/20 bg-green-glow/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-green-glow">
              Live
            </div>
          </div>
          <div className="relative z-10">
            <WorldIntelMap
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
            />
          </div>
        </section>

        <MapRegionPanel region={selectedRegion} />
      </div>
    </div>
  );
}
