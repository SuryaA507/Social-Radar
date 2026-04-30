export type AnalystMode = "summary" | "compare_regions" | "forecast" | "risk_detection" | "viral_opportunity";

export const ANALYST_MODES: Record<AnalystMode, { label: string; description: string }> = {
  summary: { label: "Summary", description: "Executive overview of trends" },
  compare_regions: { label: "Compare Regions", description: "Regional trend analysis" },
  forecast: { label: "Forecast", description: "Predict emerging trend trajectories" },
  risk_detection: { label: "Risk Detection", description: "Identify potential risk factors" },
  viral_opportunity: { label: "Viral Opportunity", description: "Find viral content opportunities" },
};

export interface AnalystSummaryRequest {
  query: string;
  region: string;
  days: number;
  mode?: AnalystMode;
}

export interface AnalystBreakdownItem {
  name: string;
  count: number;
  momentum?: number;
}

export interface AnalystSummaryResponse {
  summary: string;
  mode: AnalystMode;
  top_topics: AnalystBreakdownItem[];
  top_regions: AnalystBreakdownItem[];
  top_platforms: AnalystBreakdownItem[];
  sentiment: "Positive" | "Negative" | "Mixed" | string;
  risk_level: "Low" | "Medium" | "High" | string;
}

export async function fetchAnalystSummary(
  apiBase: string,
  payload: AnalystSummaryRequest,
): Promise<AnalystSummaryResponse> {
  const response = await fetch(`${apiBase}/api/ai/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AI summary failed with ${response.status}`);
  }

  return response.json() as Promise<AnalystSummaryResponse>;
}
