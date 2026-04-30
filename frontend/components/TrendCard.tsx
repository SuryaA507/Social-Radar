import React from "react";
import { TrendingUp, MessageSquare, Globe } from "@/components/Icons";
import type { SocialTrend } from "@/lib/trends";

export default function TrendCard({
  trend,
  index,
}: {
  trend: SocialTrend;
  index: number;
}) {
  const scoreWidth = Math.min(100, Math.max(12, trend.score / 7));

  return (
    <a
      href={trend.source_url}
      target="_blank"
      rel="noreferrer"
      className="glass-panel fade-up group block rounded-[24px] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-glow/30 hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-glow/15 bg-cyan-glow/8 font-bold text-sm text-cyan-glow group-hover:border-cyan-glow/35">
            #{index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-card-border/80 bg-black/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-glow">
                {trend.keyword}
              </span>
              <span className="rounded-full border border-green-glow/20 bg-green-glow/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-green-glow">
                {trend.category}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Globe className="h-3 w-3" />
                <span>{trend.country}</span>
              </div>
            </div>
            <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-foreground sm:text-lg">
              {trend.title}
            </h3>
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-card-border/80 bg-black/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-muted">
          {trend.platform}
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted">
          <span>Trend Score</span>
          <span className="text-cyan-glow">{trend.score.toFixed(2)}</span>
        </div>
        <div className="data-bar h-2.5">
          <span style={{ width: `${scoreWidth}%` }} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-muted">
            <MessageSquare className="h-3 w-3" /> Mentions
          </span>
          <span className="font-mono text-lg text-foreground">
            {trend.mentions.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-muted">
            <TrendingUp className="h-3 w-3" /> Score
          </span>
          <span className="font-mono text-lg text-foreground">
            {trend.score.toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted">
            Platform
          </span>
          <span className="text-sm font-medium text-green-glow">{trend.platform}</span>
        </div>
      </div>
    </a>
  );
}
