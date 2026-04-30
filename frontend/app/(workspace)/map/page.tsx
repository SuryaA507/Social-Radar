"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import MapRegionPanel from "@/components/MapRegionPanel";

const WorldIntelMap = dynamic(() => import("@/components/WorldIntelMap"), {
  ssr: false,
  loading: () => (
    <div className="glass-panel flex min-h-[36rem] items-center justify-center rounded-[30px] p-6">
      <div className="font-mono text-sm uppercase tracking-[0.3em] text-cyan-glow">
        Loading world map...
      </div>
    </div>
  ),
});

export default function MapPage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="glass-panel scan-line relative overflow-hidden rounded-[30px] px-6 py-6 sm:px-8">
        <div className="absolute inset-y-0 right-0 hidden w-[36%] bg-[radial-gradient(circle_at_center,rgba(92,225,255,0.12),transparent_60%)] lg:block" />
        <div className="relative z-10">
          <div className="tactical-label">Map Intelligence</div>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Global command map for regional social intelligence and cross-platform trend analysis.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
            Select a region on the world map to pull top narratives, hashtag clusters, recent content, and tactical trend scoring across supported social feeds.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.94fr_1.4fr]">
        <div className="order-2 xl:order-1">
          {selectedCountry ? (
            <MapRegionPanel name={selectedCountry} scope="country" />
          ) : (
            <aside className="glass-panel h-full rounded-[30px] p-5 sm:p-6">
            <div className="panel-header mb-5 pb-4">
              <div className="tactical-label">Regional Intelligence</div>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">Select a Country</h1>
              <p className="mt-2 text-sm leading-7 text-muted">
                Click any country boundary on the world map to highlight that exact country and load only its trends.
              </p>
            </div>
            <div className="rounded-[24px] border border-card-border/80 bg-black/20 px-4 py-14 text-center font-mono text-xs uppercase tracking-[0.24em] text-muted">
              No country selected
            </div>
            </aside>
          )}
        </div>
        <div className="order-1 xl:order-2">
          <WorldIntelMap selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
        </div>
      </div>
    </div>
  );
}
