"use client";

import { useMemo, useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import PlatformTabs from "@/components/PlatformTabs";
import TrendCard from "@/components/TrendCard";
import TrendToolbar from "@/components/TrendToolbar";
import ExportMenu from "@/components/ExportMenu";
import { Refresh } from "@/components/Icons";
import { useTrendFeed } from "@/hooks/useTrendFeed";
import {
  applyTrendFilters,
  type PlatformValue,
  type SortValue,
  type TrendCategory,
} from "@/lib/trends";

const INITIAL_VISIBLE_TRENDS = 8;
const SHOW_MORE_INCREMENT = 8;

export default function TrendsPage() {
  const [platform, setPlatform] = useState<PlatformValue>("all");
  const [category, setCategory] = useState<TrendCategory | "All">("All");
  const [sortBy, setSortBy] = useState<SortValue>("score");
  const [hashtag, setHashtag] = useState("");
  const [keyword, setKeyword] = useState("");
  const [visibleState, setVisibleState] = useState({
    key: "",
    count: INITIAL_VISIBLE_TRENDS,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchQuery = hashtag.trim() || keyword.trim();
  const { trends, isLoading, feedError, refresh } = useTrendFeed(platform, searchQuery);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const filteredTrends = useMemo(
    () => applyTrendFilters(trends, { category, hashtag, keyword, sortBy }),
    [trends, category, hashtag, keyword, sortBy],
  );

  const filterKey = `${platform}|${category}|${hashtag}|${keyword}|${sortBy}`;
  const visibleCount =
    visibleState.key === filterKey ? visibleState.count : INITIAL_VISIBLE_TRENDS;

  const visibleTrends = useMemo(
    () => filteredTrends.slice(0, visibleCount),
    [filteredTrends, visibleCount],
  );

  const remainingCount = Math.max(filteredTrends.length - visibleTrends.length, 0);

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[28px] p-5 sm:p-6">
        <div className="panel-header mb-6 flex flex-col gap-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="tactical-label">Trends</div>
              <h1 className="text-2xl font-semibold">Sortable Signal Browser</h1>
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
          <PlatformTabs selected={platform} onSelect={setPlatform} />
          <TrendToolbar
            sortBy={sortBy}
            hashtag={hashtag}
            keyword={keyword}
            onSortChange={setSortBy}
            onHashtagChange={setHashtag}
            onKeywordChange={setKeyword}
          />
          <CategoryFilter selected={category} onSelect={setCategory} />
        </div>

        {isLoading ? (
          <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-cyan-glow">
            Scanning global signals...
          </div>
        ) : feedError ? (
          <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-danger">
            Signal feed unavailable
          </div>
        ) : filteredTrends.length === 0 ? (
          <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.28em] text-muted">
            No matching signals found
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {visibleTrends.map((trend, index) => (
                <TrendCard key={`${trend.source_url}-${index}`} trend={trend} index={index} />
              ))}
            </div>

            {remainingCount > 0 && (
              <div className="flex justify-center border-t border-card-border/70 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleState({
                      key: filterKey,
                      count: Math.min(
                        visibleCount + SHOW_MORE_INCREMENT,
                        filteredTrends.length,
                      ),
                    })
                  }
                  className="rounded-full border border-cyan-glow/30 bg-cyan-glow/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-glow transition-all hover:bg-cyan-glow/20"
                >
                  Show More Signals ({remainingCount})
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
