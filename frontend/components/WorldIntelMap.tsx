"use client";

import dynamic from "next/dynamic";

const GlobalHeatMap = dynamic(() => import("@/components/GlobalHeatMap"), {
  ssr: false,
});

interface WorldIntelMapProps {
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
}

export default function WorldIntelMap({
  selectedRegion,
  onSelectRegion,
}: WorldIntelMapProps) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-[30px] p-4 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(92,225,255,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(125,255,179,0.06),transparent_24%)]" />
      <div className="relative z-10">
        <div className="panel-header mb-5 flex items-center justify-between pb-4">
          <div>
            <div className="tactical-label">Global Map</div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Regional Command Surface</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Select an operational theater to inspect the dominant narratives and platform-specific activity.
            </p>
          </div>
          <div className="rounded-full border border-green-glow/25 bg-green-glow/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-green-glow">
            Interactive
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-card-border/80 bg-[linear-gradient(180deg,rgba(2,10,16,0.96),rgba(5,14,22,0.90))] p-3 sm:p-5">
          <div className="pointer-events-none absolute inset-0 chart-grid opacity-55" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(92,225,255,0.07),transparent_58%)]" />

          <div className="relative z-10 h-[24rem] w-full overflow-hidden rounded-[22px] border border-card-border/70 bg-black/20 sm:h-[30rem]">
            <GlobalHeatMap onCountrySelect={(country) => country && onSelectRegion(country)} />
          </div>

          <div className="relative z-10 mt-4 flex items-center justify-between gap-4 rounded-[22px] border border-card-border/70 bg-black/20 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted">
            <span>Selected Geography</span>
            <span className="text-cyan-glow">{selectedRegion || "None"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
