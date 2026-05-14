export interface HouseholdInput {
  // Income
  total_income_lcu: number;
  crop_income_lcu: number;
  livestock_income_lcu: number;
  offfarm_income_lcu: number;
  currency_conversion_lcu_to_ppp: number;
  // Land
  land_ha: number;
  land_irrigated: boolean;
  land_tenure: string;
  // Livestock
  cattle: number;
  goats: number;
  sheep: number;
  pigs: number;
  chicken: number;
  // Demographics
  hh_size: number;
  edu_level: number | null;
  hh_type: string;
  is_female_headed: boolean;
  female_income_control: number;
  // Agricultural
  homegarden: boolean;
  agroforestry: boolean;
  manage_trees: boolean;
  improvedseeds: boolean;
  crop_count: number | null;
  aidreceived: boolean;
  // Optional
  ppi_likelihood?: number | null;
  has_debt?: boolean | null;
  // Region
  id_proj: string;
}

export interface RiskDriver {
  feature: string;
  label: string;
  importance: number;
  value: number;
  score: number;
}

export interface ScoreResult {
  probability: number;
  risk_band: "low" | "medium" | "high";
  risk_band_color: string;
  segment: number;
  segment_name: string;
  segment_profile: SegmentProfile;
  recommended_product: ProductRecommendation;
  model_scores: Record<string, number>;
  top_risk_drivers: RiskDriver[];
  is_female_headed: boolean;
  hunger_gap_month: string;
  unclassified?: boolean;
}

export interface SegmentProfile {
  asset_index: number;
  market_orientation: number;
  income_div_index: number;
  log_total_income_ppp: number;
  livestock_tlu_capped: number;
  land_cultivated_ha_capped: number;
  female_income_control: number;
  n: number;
  pct: number;
  name: string;
  worst_month: string;
  female_headed_pct: number;
  agric_modern_index?: number;
}

export interface ProductRecommendation {
  primary: string;
  delivery: string;
  risk_band: string;
}

export interface Metadata {
  country_deployment: string;
  train_countries: string[];
  kenya_test_year: number;
  independent_feats: string[];
  cluster_feats: string[];
  segment_names: Record<string, string>;
  segment_profiles: Record<string, SegmentProfile>;
  product_map: Record<string, ProductRecommendation>;
  risk_band_thresholds: { low: number; high: number };
  all_results: ModelResult[];
  n_train: number;
  n_kenya: number;
  noppi_train_cv_auc: number;
  noppi_kenya_auc: number;
  noppi_kenya_2019_auc: number;
  ppi_kenya_auc: number;
  train_positive_rate: number;
  kenya_positive_rate: number;
}

export interface ModelResult {
  name: string;
  auc_std_mean: number;
  auc_rep_mean: number;
  auc_rep_ci_lo: number;
  auc_rep_ci_hi: number;
  kenya_auc: number;
  kenya_test_auc: number;
  kenya_gap: number;
  f1_w_mean: number;
  pr_auc_mean: number;
}

export const DEFAULT_INPUT: HouseholdInput = {
  total_income_lcu: 0,
  crop_income_lcu: 0,
  livestock_income_lcu: 0,
  offfarm_income_lcu: 0,
  currency_conversion_lcu_to_ppp: 90,
  land_ha: 0,
  land_irrigated: false,
  land_tenure: "",
  cattle: 0, goats: 0, sheep: 0, pigs: 0, chicken: 0,
  hh_size: 4,
  edu_level: null,
  hh_type: "married_couple",
  is_female_headed: false,
  female_income_control: 0.5,
  homegarden: false,
  agroforestry: false,
  manage_trees: false,
  improvedseeds: false,
  crop_count: null,
  aidreceived: false,
  ppi_likelihood: null,
  has_debt: null,
  id_proj: "",
};
