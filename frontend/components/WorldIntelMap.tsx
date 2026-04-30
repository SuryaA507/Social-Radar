"use client";

import { useEffect, useMemo } from "react";
import {
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import { feature as topojsonFeature } from "topojson-client";
import { geoJSON, Path } from "leaflet";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { Layer, LeafletMouseEvent, PathOptions } from "leaflet";
import countriesTopology from "world-atlas/countries-110m.json";
import "leaflet/dist/leaflet.css";
import { useMapHotspots } from "@/hooks/useMapHotspots";

type RegionName =
  | "North America"
  | "South America"
  | "Europe"
  | "Africa"
  | "Middle East"
  | "Asia"
  | "Oceania";

type CountryFeature = Feature<Geometry, GeoJsonProperties & { name?: string }>;

const REGION_NAMES: RegionName[] = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Middle East",
  "Asia",
  "Oceania",
];

const REGION_COUNTRIES: Record<RegionName, Set<string>> = {
  "North America": new Set([
    "Bahamas",
    "Belize",
    "Canada",
    "Costa Rica",
    "Cuba",
    "Dominican Rep.",
    "El Salvador",
    "Greenland",
    "Guatemala",
    "Haiti",
    "Honduras",
    "Jamaica",
    "Mexico",
    "Nicaragua",
    "Panama",
    "Puerto Rico",
    "Trinidad and Tobago",
    "United States of America",
  ]),
  "South America": new Set([
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Ecuador",
    "Falkland Is.",
    "Guyana",
    "Paraguay",
    "Peru",
    "Suriname",
    "Uruguay",
    "Venezuela",
  ]),
  Europe: new Set([
    "Albania",
    "Austria",
    "Belarus",
    "Belgium",
    "Bosnia and Herz.",
    "Bulgaria",
    "Croatia",
    "Czechia",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Iceland",
    "Ireland",
    "Italy",
    "Kosovo",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Macedonia",
    "Moldova",
    "Montenegro",
    "Netherlands",
    "Norway",
    "Poland",
    "Portugal",
    "Romania",
    "Russia",
    "Serbia",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
    "Switzerland",
    "Turkey",
    "Ukraine",
    "United Kingdom",
  ]),
  Africa: new Set([
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cameroon",
    "Central African Rep.",
    "Chad",
    "Congo",
    "Côte d'Ivoire",
    "Dem. Rep. Congo",
    "Djibouti",
    "Egypt",
    "Eq. Guinea",
    "Eritrea",
    "Ethiopia",
    "Gabon",
    "Gambia",
    "Ghana",
    "Guinea",
    "Guinea-Bissau",
    "Kenya",
    "Lesotho",
    "Liberia",
    "Libya",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Morocco",
    "Mozambique",
    "Namibia",
    "Niger",
    "Nigeria",
    "Rwanda",
    "S. Sudan",
    "Senegal",
    "Sierra Leone",
    "Somalia",
    "Somaliland",
    "South Africa",
    "Sudan",
    "Tanzania",
    "Togo",
    "Tunisia",
    "Uganda",
    "W. Sahara",
    "Zambia",
    "Zimbabwe",
    "eSwatini",
  ]),
  "Middle East": new Set([
    "Armenia",
    "Azerbaijan",
    "Cyprus",
    "Georgia",
    "Iran",
    "Iraq",
    "Israel",
    "Jordan",
    "Kuwait",
    "Lebanon",
    "N. Cyprus",
    "Oman",
    "Palestine",
    "Qatar",
    "Saudi Arabia",
    "Syria",
    "United Arab Emirates",
    "Yemen",
  ]),
  Asia: new Set([
    "Afghanistan",
    "Bangladesh",
    "Bhutan",
    "Brunei",
    "Cambodia",
    "China",
    "India",
    "Indonesia",
    "Japan",
    "Kazakhstan",
    "Kyrgyzstan",
    "Laos",
    "Malaysia",
    "Mongolia",
    "Myanmar",
    "Nepal",
    "North Korea",
    "Pakistan",
    "Philippines",
    "South Korea",
    "Sri Lanka",
    "Taiwan",
    "Tajikistan",
    "Thailand",
    "Timor-Leste",
    "Turkmenistan",
    "Uzbekistan",
    "Vietnam",
  ]),
  Oceania: new Set([
    "Australia",
    "Fiji",
    "Fr. S. Antarctic Lands",
    "New Caledonia",
    "New Zealand",
    "Papua New Guinea",
    "Solomon Is.",
    "Vanuatu",
  ]),
};

const countryCollection = topojsonFeature(
  countriesTopology as unknown as Parameters<typeof topojsonFeature>[0],
  countriesTopology.objects.countries as Parameters<typeof topojsonFeature>[1],
) as unknown as FeatureCollection<Geometry, GeoJsonProperties & { name?: string }>;

const RAW_COUNTRY_FEATURES = countryCollection.features.filter(
  (country): country is CountryFeature => country.properties?.name !== "Antarctica",
);

function unwrapRing(ring: Position[]) {
  if (ring.length === 0) {
    return ring;
  }

  let offset = 0;
  let previousLng = ring[0][0];

  return ring.map((position, index) => {
    const [lng, lat, altitude] = position;
    if (index === 0) {
      return altitude === undefined ? [lng, lat] : [lng, lat, altitude];
    }

    let adjustedLng = lng + offset;
    const delta = adjustedLng - previousLng;
    if (delta > 180) {
      offset -= 360;
      adjustedLng = lng + offset;
    } else if (delta < -180) {
      offset += 360;
      adjustedLng = lng + offset;
    }

    previousLng = adjustedLng;
    return altitude === undefined ? [adjustedLng, lat] : [adjustedLng, lat, altitude];
  });
}

function unwrapGeometry(geometry: Geometry): Geometry {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(unwrapRing),
    } satisfies Polygon;
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map(unwrapRing)),
    } satisfies MultiPolygon;
  }

  return geometry;
}

const COUNTRY_FEATURES = RAW_COUNTRY_FEATURES.map((country) => ({
  ...country,
  geometry: unwrapGeometry(country.geometry),
}));

function getCountryName(country: CountryFeature) {
  return String(country.properties?.name || "Unknown");
}

function getCountryRegion(countryName: string): RegionName | null {
  for (const region of REGION_NAMES) {
    if (REGION_COUNTRIES[region].has(countryName)) {
      return region;
    }
  }
  return null;
}

function normalizeCountrySelection(countryName: string) {
  if (countryName === "United States") {
    return "United States of America";
  }
  return countryName;
}

function getCountryFeatures(countryName: string | null) {
  if (!countryName) {
    return [];
  }
  const selectedName = normalizeCountrySelection(countryName);
  return COUNTRY_FEATURES.filter(
    (country) => getCountryName(country) === selectedName,
  );
}

function countryFeatureCollection(countryName: string | null): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: getCountryFeatures(countryName),
  };
}

function CountryFocus({ selectedCountry }: { selectedCountry: string | null }) {
  const map = useMap();

  useEffect(() => {
    const features = getCountryFeatures(selectedCountry);
    if (features.length === 0) {
      map.setView([20, 10], 2, { animate: true });
      return;
    }

    const bounds = geoJSON(countryFeatureCollection(selectedCountry)).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        animate: true,
        duration: 0.65,
        padding: [34, 34],
      });
    }
  }, [map, selectedCountry]);

  return null;
}

interface WorldIntelMapProps {
  selectedCountry: string | null;
  onSelectCountry: (country: string) => void;
}

export default function WorldIntelMap({
  selectedCountry,
  onSelectCountry,
}: WorldIntelMapProps) {
  const { hotspots, isLoading, error } = useMapHotspots();

  const countryData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: COUNTRY_FEATURES,
    }),
    [],
  );

  const countryStyle = (country?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const countryName = String(country?.properties?.name || "");
    const active = Boolean(
      selectedCountry &&
        countryName === normalizeCountrySelection(selectedCountry),
    );

    return {
      color: active ? "#5ce1ff" : "rgba(180, 215, 224, 0.34)",
      fillColor: active ? "#5ce1ff" : "transparent",
      fillOpacity: active ? 0.32 : 0,
      opacity: active ? 0.95 : 0.5,
      weight: active ? 1.35 : 0.55,
    };
  };

  const bindCountry = (country: Feature<Geometry, GeoJsonProperties>, layer: Layer) => {
    const countryName = String(country.properties?.name || "Unknown");
    const region = getCountryRegion(countryName);

    layer.on({
      click: (event: LeafletMouseEvent) => {
        event.originalEvent.stopPropagation();
        onSelectCountry(countryName);
      },
      mouseover: () => {
        if (countryName !== normalizeCountrySelection(selectedCountry || "") && layer instanceof Path) {
          layer.setStyle({
            color: "rgba(237,247,251,0.8)",
            fillColor: "transparent",
            fillOpacity: 0,
            opacity: 0.85,
            weight: 1,
          });
        }
      },
      mouseout: () => {
        if (layer instanceof Path) {
          layer.setStyle(countryStyle(country));
        }
      },
    });

    layer.bindPopup(
      `<div class="p-2"><div class="tactical-label">Country</div><div class="mt-1 text-base font-semibold">${countryName}</div><div class="mt-2 text-xs text-muted">${region || "Unassigned"}</div></div>`,
      { className: "tactical-popup" },
    );
  };

  return (
    <div className="glass-panel relative overflow-hidden rounded-[30px] p-4 sm:p-6">
      <div className="relative z-10">
        <div className="panel-header mb-5 flex flex-col gap-4 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="tactical-label">Global Map</div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Country-Level Trend Map</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Click any country to highlight only that country and load trends scoped to that exact border.
            </p>
          </div>
          <div className="rounded-full border border-green-glow/25 bg-green-glow/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-green-glow">
            Exact Borders
          </div>
        </div>

        <div className="relative h-[34rem] overflow-hidden rounded-[28px] border border-card-border/80 bg-[#061019]">
          <MapContainer
            center={[20, 10]}
            zoom={2}
            minZoom={2}
            maxZoom={5}
            scrollWheelZoom
            zoomControl={false}
            className="h-full w-full"
            maxBounds={[
              [-85, -180],
              [85, 180],
            ]}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              noWrap
            />
            <CountryFocus selectedCountry={selectedCountry} />

            <GeoJSON
              key={selectedCountry || "no-country"}
              data={countryData}
              style={countryStyle}
              onEachFeature={bindCountry}
            />

          </MapContainer>

          <div className="pointer-events-none absolute inset-0 z-[400] bg-[radial-gradient(circle_at_center,transparent_52%,rgba(6,16,25,0.36)_100%)]" />

          <div className="absolute left-4 top-4 z-[500] rounded-2xl border border-card-border/80 bg-black/55 px-4 py-3 backdrop-blur">
            <div className="tactical-label">Selected Country</div>
            <div className="mt-1 text-sm font-semibold text-cyan-glow">
              {selectedCountry || "None"}
            </div>
            <div className="mt-1 text-xs text-muted">
              {!selectedCountry
                ? "Click a country to select"
                : isLoading
                  ? "Loading mapped signals"
                  : error
                    ? "Map telemetry offline"
                    : "Border selected"}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-3 tactical-label">Mapped Countries</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {hotspots.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-card-border/80 bg-black/20 px-4 py-5 text-sm text-muted">
              No mapped country signals yet. Select any country on the map to inspect it.
            </div>
          ) : (
            hotspots.map((hotspot) => {
            const countryName = normalizeCountrySelection(hotspot.country);
            const active = normalizeCountrySelection(selectedCountry || "") === countryName;
            return (
              <button
                key={countryName}
                type="button"
                onClick={() => onSelectCountry(countryName)}
                className={`min-h-14 rounded-2xl border px-3 py-3 text-left text-xs uppercase tracking-[0.16em] transition-all ${
                  active
                    ? "border-cyan-glow/35 bg-cyan-glow/12 text-cyan-glow shadow-[0_0_18px_rgba(92,225,255,0.14)]"
                    : "border-card-border/80 bg-black/20 text-muted hover:border-cyan-glow/20 hover:text-foreground"
                }`}
              >
                {countryName}
              </button>
            );
            })
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
