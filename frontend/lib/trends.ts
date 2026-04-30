export const PLATFORM_OPTIONS = [
  { label: "All", value: "all" },
  { label: "YouTube", value: "youtube" },
  { label: "Reddit", value: "reddit" },
  { label: "X", value: "x" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
] as const;

export const CATEGORY_OPTIONS = [
  "Politics",
  "Sports",
  "Entertainment",
  "Technology",
  "Finance",
  "Health",
  "Lifestyle",
  "Emergencies",
  "Memes",
  "General",
] as const;

export const SORT_OPTIONS = [
  { label: "Score", value: "score" },
  { label: "Views", value: "views" },
  { label: "Likes", value: "likes" },
  { label: "Newest", value: "newest" },
  { label: "Mentions", value: "mentions" },
] as const;

export type PlatformValue = (typeof PLATFORM_OPTIONS)[number]["value"];
export type TrendCategory = (typeof CATEGORY_OPTIONS)[number];
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface LiveTrend {
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

export interface SocialTrend extends LiveTrend {
  category: TrendCategory;
}

type RawTrend = Partial<SocialTrend> & {
  engagement?: number;
};

const CATEGORY_RULES: Record<TrendCategory, RegExp> = {
  Politics: /\b(election|president|prime minister|modi|trump|senate|parliament|policy|government|politic|vote)\b/i,
  Sports: /\b(match|league|cup|goal|cricket|football|nba|ipl|fifa|tennis|sport)\b/i,
  Entertainment: /\b(movie|film|actor|music|show|celebrity|netflix|trailer|hollywood|bollywood)\b/i,
  Technology: /\b(ai|tech|software|chip|openai|google|microsoft|startup|robot|cyber)\b/i,
  Finance: /\b(stock|market|finance|bank|ipo|inflation|bitcoin|crypto|economy|trade)\b/i,
  Health: /\b(health|disease|virus|vaccine|hospital|medical|doctor|wellness)\b/i,
  Lifestyle: /\b(style|travel|food|fashion|home|culture|family|life)\b/i,
  Emergencies: /\b(fire|flood|earthquake|storm|explosion|evacuation|crash|disaster|war|attack|ceasefire)\b/i,
  Memes: /\b(meme|viral|funny|joke|lol|laugh|shitpost)\b/i,
  General: /.^/,
};

export function normalizeMetric(value: number) {
  const numericValue = Math.max(value || 0, 0);
  if (numericValue === 0) {
    return 0;
  }
  return Math.log10(numericValue + 1) * 100;
}

export function computeScore(mentions: number, engagement: number) {
  const normalizedMentions = normalizeMetric(mentions);
  const normalizedEngagement = normalizeMetric(engagement);
  return Number(((normalizedMentions * 0.6) + (normalizedEngagement * 0.4)).toFixed(2));
}

export function categorizeTrend(item: { title: string; keyword: string }): TrendCategory {
  const haystack = `${item.title} ${item.keyword}`;
  for (const category of CATEGORY_OPTIONS) {
    if (category === "General") {
      continue;
    }
    if (CATEGORY_RULES[category].test(haystack)) {
      return category;
    }
  }
  return "General";
}

export function normalizeTrend(item: RawTrend): SocialTrend {
  const mentions = Number(item.mentions || 0);
  const engagement = Number(item.engagement || 0);
  const keyword = item.keyword || "Signal";
  const title = item.title || "Untitled trend";

  return {
    keyword,
    title,
    platform: item.platform || "Unknown",
    country: item.country || "Global",
    mentions,
    engagement,
    created_at: item.created_at || "",
    source_url: item.source_url || "#",
    score:
      typeof item.score === "number" && !Number.isNaN(item.score)
        ? item.score
        : computeScore(mentions, engagement),
    category: categorizeTrend({ title, keyword }),
  };
}

export function buildTrendEndpoint(platform: PlatformValue) {
  switch (platform) {
    case "youtube":
      return "/api/trends/youtube";
    case "reddit":
      return "/api/trends/reddit";
    case "x":
    case "instagram":
    case "facebook":
      return "/api/trends/live";
    case "all":
      return "/api/trends/live";
    default:
      return "";
  }
}

export async function fetchTrendFeed(
  apiBase: string,
  platform: PlatformValue,
  query?: string,
) {
  const endpoint = buildTrendEndpoint(platform);
  if (!endpoint) {
    return [] as SocialTrend[];
  }

  const params = new URLSearchParams();
  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  if (platform === "youtube") {
    params.set("limit", "25");
  }
  if (endpoint === "/api/trends/live") {
    params.set("platform", platform);
  }

  const requestUrl = `${apiBase}${endpoint}${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(requestUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Trend fetch failed with ${response.status}`);
  }

  const data: RawTrend[] = await response.json();
  return data.map(normalizeTrend);
}

export function applyTrendFilters(
  trends: SocialTrend[],
  {
    category,
    hashtag,
    keyword,
    region,
    sortBy,
  }: {
    category?: TrendCategory | "All";
    hashtag?: string;
    keyword?: string;
    region?: string;
    sortBy?: SortValue;
  },
) {
  const normalizedKeyword = keyword?.trim().toLowerCase() || "";
  const normalizedHashtag = hashtag?.trim().toLowerCase().replace(/^#/, "") || "";
  const normalizedRegion = region?.trim().toLowerCase() || "";

  const filtered = trends
    .filter((trend) => !category || category === "All" || trend.category === category)
    .filter((trend) => !normalizedRegion || trend.country.toLowerCase() === normalizedRegion)
    .filter((trend) => {
      if (!normalizedKeyword) {
        return true;
      }
      return (
        trend.keyword.toLowerCase().includes(normalizedKeyword) ||
        trend.title.toLowerCase().includes(normalizedKeyword)
      );
    })
    .filter((trend) => {
      if (!normalizedHashtag) {
        return true;
      }
      const haystack = `${trend.title} ${trend.keyword} ${trend.category}`.toLowerCase();
      return haystack.includes(normalizedHashtag);
    });

  const selectedSort = sortBy || "score";
  filtered.sort((left, right) => {
    switch (selectedSort) {
      case "views":
        return right.mentions - left.mentions;
      case "likes":
        return right.engagement - left.engagement;
      case "newest":
        return (
          new Date(right.created_at || 0).getTime() -
          new Date(left.created_at || 0).getTime()
        );
      case "mentions":
        return right.mentions - left.mentions;
      case "score":
      default:
        return right.score - left.score;
    }
  });

  return filtered;
}

export function buildHistoricalSnapshot(trends: SocialTrend[], date: string) {
  if (!date) {
    return trends;
  }

  const selectedDate = new Date(date).getTime();
  return trends.map((trend, index) => {
    const decay = Math.max(0.45, 1 - (index + 1) * 0.035);
    return {
      ...trend,
      mentions: Math.round(trend.mentions * decay),
      engagement: Math.round(trend.engagement * decay),
      score: Number((trend.score * decay).toFixed(2)),
      created_at: new Date(selectedDate - index * 86_400_000).toISOString(),
    };
  });
}
