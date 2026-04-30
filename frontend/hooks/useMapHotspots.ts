"use client";

import { useEffect, useRef, useState } from "react";
import { getApiBase } from "@/lib/api";

export interface HotspotData {
  country: string;
  lat: number;
  lng: number;
  score: number;
  category: string;
}

export interface MapHotspotsResponse {
  count: number;
  hotspots: HotspotData[];
}

const REFRESH_INTERVAL_MS = 120_000; // Refresh every 2 mins

export function useMapHotspots() {
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const apiBase = getApiBase();

    const fetchHotspots = async () => {
      try {
        const url = `${apiBase}/api/map/hotspots`;
        console.debug(`Fetching hotspots from: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}`;
          try {
            const errorBody = await response.json();
            if (errorBody.detail) {
              errorDetail += `: ${errorBody.detail}`;
            }
          } catch {
            // If response body is not JSON, try to get text
            try {
              const textBody = await response.text();
              if (textBody) {
                errorDetail += `: ${textBody}`;
              }
            } catch {
              // Ignore
            }
          }
          throw new Error(`Failed to fetch hotspots - ${errorDetail}`);
        }
        const data: MapHotspotsResponse = await response.json();
        
        if (mountedRef.current) {
          setHotspots(data.hotspots);
          setError(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to fetch map hotspots:", errorMessage);
        if (mountedRef.current) {
          setError(true);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    void fetchHotspots();
    const intervalId = window.setInterval(() => {
      void fetchHotspots();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return { hotspots, isLoading, error };
}
