export interface SavedSearch {
  id: number;
  name: string;
  query: string;
  region: string;
  days: number;
  created_at: string;
}

export interface TrackedTopic {
  id: number;
  topic: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
}

export interface SavedRegion {
  id: number;
  region: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface CustomAlert {
  id: number;
  name: string;
  keywords: string[];
  regions: string[];
  alert_type: string;
  min_engagement: number;
  min_mentions: number;
  is_active: boolean;
  created_at: string;
}

// Saved Searches API
export async function createSavedSearch(
  apiBase: string,
  token: string,
  data: Omit<SavedSearch, "id" | "created_at">
): Promise<SavedSearch> {
  const response = await fetch(`${apiBase}/api/watchlist/saved-searches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to create saved search");
  return response.json() as Promise<SavedSearch>;
}

export async function getSavedSearches(apiBase: string, token: string): Promise<SavedSearch[]> {
  const response = await fetch(`${apiBase}/api/watchlist/saved-searches`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to fetch saved searches");
  return response.json() as Promise<SavedSearch[]>;
}

export async function deleteSavedSearch(apiBase: string, token: string, searchId: number): Promise<void> {
  const response = await fetch(`${apiBase}/api/watchlist/saved-searches/${searchId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to delete saved search");
}

// Tracked Topics API
export async function createTrackedTopic(
  apiBase: string,
  token: string,
  data: Omit<TrackedTopic, "id" | "is_active" | "created_at">
): Promise<TrackedTopic> {
  const response = await fetch(`${apiBase}/api/watchlist/tracked-topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to create tracked topic");
  return response.json() as Promise<TrackedTopic>;
}

export async function getTrackedTopics(apiBase: string, token: string): Promise<TrackedTopic[]> {
  const response = await fetch(`${apiBase}/api/watchlist/tracked-topics`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to fetch tracked topics");
  return response.json() as Promise<TrackedTopic[]>;
}

export async function updateTrackedTopic(
  apiBase: string,
  token: string,
  topicId: number,
  data: Partial<Omit<TrackedTopic, "id" | "created_at">>
): Promise<TrackedTopic> {
  const response = await fetch(`${apiBase}/api/watchlist/tracked-topics/${topicId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to update tracked topic");
  return response.json() as Promise<TrackedTopic>;
}

export async function deleteTrackedTopic(apiBase: string, token: string, topicId: number): Promise<void> {
  const response = await fetch(`${apiBase}/api/watchlist/tracked-topics/${topicId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to delete tracked topic");
}

// Saved Regions API
export async function createSavedRegion(
  apiBase: string,
  token: string,
  data: Omit<SavedRegion, "id" | "is_active" | "created_at">
): Promise<SavedRegion> {
  const response = await fetch(`${apiBase}/api/watchlist/saved-regions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to create saved region");
  return response.json() as Promise<SavedRegion>;
}

export async function getSavedRegions(apiBase: string, token: string): Promise<SavedRegion[]> {
  const response = await fetch(`${apiBase}/api/watchlist/saved-regions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to fetch saved regions");
  return response.json() as Promise<SavedRegion[]>;
}

export async function deleteSavedRegion(apiBase: string, token: string, regionId: number): Promise<void> {
  const response = await fetch(`${apiBase}/api/watchlist/saved-regions/${regionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to delete saved region");
}

// Custom Alerts API
export async function createCustomAlert(
  apiBase: string,
  token: string,
  data: Omit<CustomAlert, "id" | "is_active" | "created_at">
): Promise<CustomAlert> {
  const response = await fetch(`${apiBase}/api/watchlist/custom-alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to create custom alert");
  return response.json() as Promise<CustomAlert>;
}

export async function getCustomAlerts(apiBase: string, token: string): Promise<CustomAlert[]> {
  const response = await fetch(`${apiBase}/api/watchlist/custom-alerts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to fetch custom alerts");
  return response.json() as Promise<CustomAlert[]>;
}

export async function updateCustomAlert(
  apiBase: string,
  token: string,
  alertId: number,
  data: Partial<Omit<CustomAlert, "id" | "created_at">>
): Promise<CustomAlert> {
  const response = await fetch(`${apiBase}/api/watchlist/custom-alerts/${alertId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to update custom alert");
  return response.json() as Promise<CustomAlert>;
}

export async function deleteCustomAlert(apiBase: string, token: string, alertId: number): Promise<void> {
  const response = await fetch(`${apiBase}/api/watchlist/custom-alerts/${alertId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to delete custom alert");
}
