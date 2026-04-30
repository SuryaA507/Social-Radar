"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import TrendCard from "@/components/TrendCard";
import {
  applyTrendFilters,
  normalizeTrend,
  type SocialTrend,
  type TrendCategory,
} from "@/lib/trends";

interface RegionOption {
  name: string;
  trend_count: number;
}

interface RegionsApiResponse {
  count: number;
  regions: RegionOption[];
}

interface RegionTrendItem {
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

interface RegionTrendsResponse {
  region: string;
  country: string | null;
  available_regions: string[];
  count: number;
  items: RegionTrendItem[];
}

export default function RegionsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [trends, setTrends] = useState<SocialTrend[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("Global");
  const [category, setCategory] = useState<TrendCategory | "All">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log("RegionsPage loaded. apiBase:", apiBase, "selectedRegion:", selectedRegion, "isLoading:", isLoading);
  }, [apiBase, selectedRegion, isLoading]);

  useEffect(() => {
    let alive = true;

    const loadRegions = async () => {
      try {
        const response = await fetch(`${apiBase}/api/trends/regions`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Regions fetch failed with ${response.status}`);
        }
        const payload: RegionsApiResponse = await response.json();
        if (alive) {
          setRegions(payload.regions || []);
        }
      } catch (error) {
        if (alive) {
          setFeedError(error instanceof Error ? error.message : "Failed to load regions");
        }
      }
    };

    void loadRegions();

    return () => {
      alive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let alive = true;

    const loadRegionTrends = async () => {
      setIsLoading(true);
      setFeedError(null);

      try {
        const params = new URLSearchParams({
          name: selectedRegion,
          limit: "24",
        });
        const response = await fetch(`${apiBase}/api/trends/region?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Regional trends fetch failed with ${response.status}`);
        }

        const payload: RegionTrendsResponse = await response.json();
        if (alive) {
          setTrends((payload.items || []).map((item) => normalizeTrend(item)));
        }
      } catch (error) {
        if (alive) {
          setTrends([]);
          setFeedError(
            error instanceof Error ? error.message : "Failed to load regional trends",
          );
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    };

    void loadRegionTrends();

    return () => {
      alive = false;
    };
  }, [apiBase, selectedRegion]);

  const regionFiltered = useMemo(() => {
    return applyTrendFilters(trends, { category });
  }, [trends, category]);

  const selectedRegionCount =
    regions.find((region) => region.name === selectedRegion)?.trend_count ?? regionFiltered.length;

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[28px] p-5 sm:p-6">
        <div className="panel-header mb-6 flex flex-col gap-4 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="tactical-label">Regions</div>
            <h1 className="text-2xl font-semibold">Regional Signal Selector</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Inspect active narratives by selected geography and category clusters.
            </p>
          </div>

          <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
            <span className="tactical-label">Region Selector</span>
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="mt-2 w-full min-w-52 bg-transparent text-sm text-foreground outline-none"
            >
              {regions.length === 0 ? (
                <option value="Global" className="bg-[#0a1620] text-foreground">
                  Global
                </option>
              ) : (
                regions.map((region) => (
                  <option key={region.name} value={region.name} className="bg-[#0a1620] text-foreground">
                    {region.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <CategoryFilter selected={category} onSelect={setCategory} />

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
            <div className="tactical-label">Active Region</div>
            <div className="mt-3 text-2xl font-semibold text-foreground">{selectedRegion}</div>
          </div>
          <div className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
            <div className="tactical-label">Visible Trends</div>
            <div className="mt-3 text-2xl font-semibold text-foreground">{regionFiltered.length}</div>
          </div>
          <div className="rounded-2xl border border-card-border/80 bg-black/20 p-4">
            <div className="tactical-label">Region Inventory</div>
            <div className="mt-3 text-2xl font-semibold text-foreground">
              {selectedRegionCount}
            </div>
          </div>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
              Loading region intelligence...
            </div>
          ) : feedError ? (
            <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.18em] text-danger">
              {feedError}
            </div>
          ) : regionFiltered.length === 0 ? (
            <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-muted">
              No regional signals found
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {regionFiltered.slice(0, 12).map((trend, index) => (
                <TrendCard key={`${trend.source_url}-${index}`} trend={trend} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
