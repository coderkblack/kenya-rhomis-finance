import type { HouseholdInput, Metadata, ScoreResult } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Module-level cache — avoids re-fetching metadata on every page navigation
let _cachedMetadata: Metadata | null = null;

export async function fetchMetadata(): Promise<Metadata> {
  if (_cachedMetadata) return _cachedMetadata;
  const res = await fetch(`${BASE}/metadata`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch metadata");
  _cachedMetadata = await res.json();
  return _cachedMetadata!;
}

export async function scoreHousehold(input: HouseholdInput): Promise<ScoreResult> {
  const res = await fetch(`${BASE}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Scoring failed");
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}
