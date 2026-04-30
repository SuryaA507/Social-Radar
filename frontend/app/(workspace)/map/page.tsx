"use client";

import { useState } from "react";
import MapRegionPanel from "@/components/MapRegionPanel";
import WorldIntelMap from "@/components/WorldIntelMap";

export default function MapPage() {
  const [selectedRegion, setSelectedRegion] = useState("Asia");

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
        <MapRegionPanel region={selectedRegion} />
        <WorldIntelMap selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
      </div>
    </div>
  );
}
