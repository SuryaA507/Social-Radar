"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  type PlatformValue,
  type SocialTrend,
  fetchTrendFeed,
} from "@/lib/trends";
import { getApiBase } from "@/lib/api";

const REFRESH_INTERVAL_MS = 60_000;

export function useTrendFeed(platform: PlatformValue) {
  const [trends, setTrends] = useState<SocialTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const apiBase = getApiBase();
    setIsLoading(true);
    try {
      const nextTrends = await fetchTrendFeed(apiBase, platform);
      if (mountedRef.current) {
        setTrends(nextTrends);
        setFeedError(false);
      }
    } catch (error) {
      console.error("Failed to fetch trend feed", error);
      if (mountedRef.current) {
        setFeedError(true);
        setTrends([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [platform]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { trends, isLoading, feedError, refresh };
}
