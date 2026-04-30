"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapHotspots, type HotspotData } from "@/hooks/useMapHotspots";

interface GlobalHeatMapProps {
  onCountrySelect?: (country: string | null) => void;
}

const getCategoryColor = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes("politic")) return "#ff6b6b"; // Red
  if (cat.includes("tech")) return "#5ce1ff"; // Cyan
  if (cat.includes("sport") || cat.includes("entertainment")) return "#f8d36d"; // Amber
  return "#7dffb3"; // Green
};

function InteractiveMapLayer({ onCountrySelect }: { onCountrySelect?: (country: string | null) => void }) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const map = useMapEvents({
    click() {
      // Handle map clicks to close intelligence panel
      setSelectedCountry(null);
      onCountrySelect?.(null);
    },
  });

  return (
    selectedCountry && (
      <div className="z-[1000]">
        {/* Invisible layer - actual highlighting is handled by CircleMarker update */}
      </div>
    )
  );
}

export default function GlobalHeatMap({ onCountrySelect }: GlobalHeatMapProps) {
  const { hotspots, isLoading, error } = useMapHotspots();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleCountryClick = (country: string, e: any) => {
    e.originalEvent.stopPropagation();
    setSelectedCountry(country);
    onCountrySelect?.(country);
  };

  useEffect(() => {
    // Allow pressing Escape to close panel
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCountry(null);
        onCountrySelect?.(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCountrySelect]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-[0.35em] text-cyan-glow animate-pulse">
          Calibrating map sensors...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-[0.35em] text-danger">
          Map telemetry offline
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px]">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        style={{ height: "100%", width: "100%", background: "#061019" }}
        zoomControl={false}
        maxBounds={[
          [-90, -180],
          [90, 180],
        ]}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <InteractiveMapLayer onCountrySelect={onCountrySelect} />

        {hotspots.map((hotspot: HotspotData, i: number) => {
          const color = getCategoryColor(hotspot.category);
          const isSelected = selectedCountry === hotspot.country;
          const radius = Math.max(5, Math.min(25, hotspot.score / 2));
          const selectedRadius = isSelected ? radius * 1.4 : radius;

          return (
            <CircleMarker
              key={`${hotspot.country}-${i}`}
              center={[hotspot.lat, hotspot.lng]}
              radius={selectedRadius}
              pathOptions={{
                color: isSelected ? "#ff00ff" : color,
                fillColor: isSelected ? "#ff00ff" : color,
                fillOpacity: isSelected ? 0.8 : 0.6,
                weight: isSelected ? 2.5 : 1,
              }}
              eventHandlers={{
                click: (e) => handleCountryClick(hotspot.country, e),
              }}
              className="cursor-pointer transition-all hover:opacity-80"
            >
              <Popup className="tactical-popup">
                <div className="p-2 min-w-[200px]">
                  <div className="mb-1 text-xs uppercase tracking-widest text-muted">
                    Geopolitical Signal
                  </div>
                  <div className="mb-3 text-lg font-bold text-foreground cursor-pointer hover:text-cyan-glow"
                    onClick={() => handleCountryClick(hotspot.country, { originalEvent: { stopPropagation: () => {} } })}>
                    {hotspot.country}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Activity Score</span>
                      <span style={{ color }}>{hotspot.score.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Primary Category</span>
                      <span style={{ color }}>{hotspot.category}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <button
                      className="w-full px-3 py-2 rounded-lg bg-cyan-glow/20 text-cyan-glow text-xs uppercase tracking-wider hover:bg-cyan-glow/30 transition-colors"
                      onClick={() => handleCountryClick(hotspot.country, { originalEvent: { stopPropagation: () => {} } })}
                    >
                      View Intelligence
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Tactical overlay effects */}
      <div className="pointer-events-none absolute inset-0 z-[400] bg-[radial-gradient(circle_at_center,transparent_40%,rgba(6,16,25,0.4)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-[400] bg-[linear-gradient(rgba(92,225,255,0.03)_1px,transparent_1px)] bg-[size:100%_4px]" />
    </div>
  );
}
