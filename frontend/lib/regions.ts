export interface RegionProfile {
  id: string;
  name: string;
  lat: number;
  lng: number;
  projects: string[];
  dominantSegments: number[];
  approxHouseholds: number;
  typicalRisk: "low" | "medium" | "high";
  avgRiskScore: number;
  description: string;
  livelihoods: string;
  challenges: string;
}

export const REGIONS: RegionProfile[] = [
  {
    id: "lake_region",
    name: "Lake Region",
    lat: -0.09,
    lng: 34.77,
    projects: ["CM2", "adn", "LTE", "G2C", "LSE"],
    dominantSegments: [1, 2],
    approxHouseholds: 1580,
    typicalRisk: "medium",
    avgRiskScore: 0.28,
    description: "Nyanza and Western Kenya — Lake Victoria basin",
    livelihoods: "Mixed farming, fishing, dairy, sorghum/maize",
    challenges: "Food security pressure, limited off-farm income diversification",
  },
  {
    id: "highlands",
    name: "Central Highlands",
    lat: 0.28,
    lng: 36.08,
    projects: ["LCS"],
    dominantSegments: [3, 1],
    approxHouseholds: 590,
    typicalRisk: "low",
    avgRiskScore: 0.18,
    description: "Rift Valley and Central highlands — high-potential agricultural zone",
    livelihoods: "Dairy, tea, horticulture, mixed food crops",
    challenges: "Land fragmentation, input cost volatility, market price risk",
  },
  {
    id: "mixed",
    name: "Mixed Farming Zone",
    lat: 0.72,
    lng: 37.15,
    projects: ["CAN"],
    dominantSegments: [1, 3],
    approxHouseholds: 395,
    typicalRisk: "low",
    avgRiskScore: 0.20,
    description: "Central Kenya — mixed crop-livestock systems near Mt. Kenya",
    livelihoods: "Mixed crops, cash crops (coffee/tea), small ruminants",
    challenges: "Market access, post-harvest losses, input supply chains",
  },
  {
    id: "semi_arid_east",
    name: "Semi-Arid East",
    lat: -1.37,
    lng: 38.01,
    projects: ["SRL", "CM1", "STU"],
    dominantSegments: [2, 1],
    approxHouseholds: 1187,
    typicalRisk: "high",
    avgRiskScore: 0.38,
    description: "Eastern and North Eastern Kenya — arid and semi-arid lands (ASAL)",
    livelihoods: "Pastoralism, agropastoralism, drought-tolerant crops (sorghum, cowpea)",
    challenges: "Rainfall variability, chronic food insecurity, limited financial infrastructure",
  },
  {
    id: "coastal_hinterland",
    name: "Coastal Hinterland",
    lat: -3.63,
    lng: 39.85,
    projects: ["ESS"],
    dominantSegments: [2, 1],
    approxHouseholds: 200,
    typicalRisk: "medium",
    avgRiskScore: 0.31,
    description: "Coastal strip and hinterland — diversified coastal farming systems",
    livelihoods: "Cassava, coconut, small livestock, fishing-adjacent activities",
    challenges: "Seasonality, limited irrigation, poor road access to markets",
  },
];

export const REGION_BY_ID: Record<string, RegionProfile> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r])
);

export const PROJECT_TO_REGION: Record<string, string> = {
  SRL: "semi_arid_east",
  CM1: "semi_arid_east",
  STU: "semi_arid_east",
  CAN: "mixed",
  CM2: "lake_region",
  adn: "lake_region",
  LTE: "lake_region",
  G2C: "lake_region",
  LSE: "lake_region",
  ESS: "coastal_hinterland",
  LCS: "highlands",
};

export const RISK_FILL: Record<string, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#dc2626",
};

export const SEGMENT_COLORS: Record<number, string> = {
  0: "#16a34a",
  1: "#2563eb",
  2: "#dc2626",
  3: "#7c3aed",
};
