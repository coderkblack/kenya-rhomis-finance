"""Feature engineering: raw household inputs → 27-feature vector."""
import math
from typing import Any

import numpy as np

from artifacts import caps, imputation, meta, region_dummy_cols

REGION_MAP: dict[str, str] = {
    "SRL": "semi_arid_east", "CM1": "semi_arid_east", "STU": "semi_arid_east",
    "CAN": "mixed",
    "CM2": "lake_region",    "adn": "lake_region", "LTE": "lake_region",
    "G2C": "lake_region",    "LSE": "lake_region",
    "ESS": "coastal_hinterland",
    "LCS": "highlands",
}

HH_TYPE_MAP: dict[str, int] = {
    "married_couple": 0, "polygamous": 1,
    "woman_single":   2, "man_single":  3, "widowed": 4,
}


def engineer(raw: dict[str, Any]) -> dict[str, float]:
    """Return a flat dict of all named engineered features."""

    # ── PPP conversion ─────────────────────────────────────────────────────
    conv = max(float(raw.get("currency_conversion_lcu_to_ppp") or 1), 1e-9)
    total_income_ppp     = float(raw.get("total_income_lcu") or 0) / conv
    crop_income_ppp      = float(raw.get("crop_income_lcu")  or 0) / conv
    livestock_income_ppp = float(raw.get("livestock_income_lcu") or 0) / conv
    offfarm_income_ppp   = float(raw.get("offfarm_income_lcu") or 0) / conv

    # ── Species TLU ────────────────────────────────────────────────────────
    cattle  = float(raw.get("cattle")  or 0)
    goats   = float(raw.get("goats")   or 0)
    sheep   = float(raw.get("sheep")   or 0)
    pigs    = float(raw.get("pigs")    or 0)
    chicken = float(raw.get("chicken") or 0)

    cattle_tlu        = cattle * 0.7
    small_ruminant_tlu = goats * 0.1 + sheep * 0.1
    tlu_total = cattle_tlu + small_ruminant_tlu + pigs * 0.3 + chicken * 0.01

    # ── Outlier caps ───────────────────────────────────────────────────────
    tlu_cap  = caps.get("livestock_tlu",   51.527)
    land_cap = caps.get("land_cultivated_ha", 36.914)

    livestock_tlu_capped      = min(tlu_total, tlu_cap)
    land_ha                   = float(raw.get("land_ha") or 0)
    land_cultivated_ha_capped = min(land_ha, land_cap)
    cattle_tlu_capped         = min(cattle_tlu, caps.get("cattle_tlu", 42.0))
    small_ruminant_tlu_capped = min(small_ruminant_tlu, caps.get("small_ruminant_tlu", 6.0))

    # ── Composite economic indicators ──────────────────────────────────────
    asset_index = (
        livestock_tlu_capped / (tlu_cap + 1e-9) +
        land_cultivated_ha_capped / (land_cap + 1e-9)
    ) / 2

    farm_output        = max(crop_income_ppp, 1e-9)
    market_orientation = crop_income_ppp / farm_output  # simplification: no crop_consumed

    safe_income        = max(total_income_ppp, 1e-9)
    offfarm_income_share  = offfarm_income_ppp / safe_income
    livestock_income_share = livestock_income_ppp / safe_income
    income_div_index  = (int(crop_income_ppp > 0) * 0.5 +
                         int(offfarm_income_ppp > 0) * 0.5)
    asset_x_market    = asset_index * market_orientation

    hh_size           = max(int(raw.get("hh_size") or 1), 1)
    land_per_member   = land_cultivated_ha_capped / hh_size
    log_total_income_ppp = math.log1p(max(total_income_ppp, 0))

    # ── Demographic encoding ───────────────────────────────────────────────
    edu_level        = float(raw.get("edu_level") if raw.get("edu_level") is not None
                             else imputation.get("edu_level", 2.0))
    hh_type_encoded  = float(HH_TYPE_MAP.get(str(raw.get("hh_type") or ""), 0))
    is_female_headed = float(bool(raw.get("is_female_headed")))
    female_income_control = float(raw.get("female_income_control") or 0)

    # ── Binary agricultural features ───────────────────────────────────────
    land_tenure   = str(raw.get("land_tenure") or "")
    land_formal   = 1.0 if "certificate" in land_tenure.lower() else 0.0
    has_homegarden = 1.0 if raw.get("homegarden") else 0.0
    has_irrigation = 1.0 if raw.get("land_irrigated") else 0.0
    manages_trees  = 1.0 if raw.get("manage_trees") else 0.0
    has_agroforestry = 1.0 if raw.get("agroforestry") else 0.0
    receives_aid   = 1.0 if raw.get("aidreceived") else 0.0
    uses_improved_seeds = 1.0 if raw.get("improvedseeds") else 0.0

    crop_count_raw = raw.get("crop_count")
    crop_count_num = (float(crop_count_raw)
                      if crop_count_raw is not None
                      else imputation.get("crop_count_num", 2.0))

    agric_modern_index = has_irrigation + uses_improved_seeds + has_agroforestry + manages_trees
    resilience_buffer  = has_homegarden + manages_trees + has_agroforestry

    # ── Region dummy ───────────────────────────────────────────────────────
    id_proj = str(raw.get("id_proj") or "")
    region  = REGION_MAP.get(id_proj, "unknown")
    region_feats: dict[str, float] = {}
    for col in region_dummy_cols:
        region_feats[col] = 1.0 if col == f"region_{region}" else 0.0
    # Ensure region_unknown exists (default = 1 when no known project)
    if "region_unknown" not in region_feats:
        region_feats["region_unknown"] = 1.0 if region == "unknown" else 0.0

    # ── Apply imputation defaults to sparse market_orientation ─────────────
    if total_income_ppp == 0 and crop_income_ppp == 0:
        market_orientation = imputation.get("market_orientation", 0.136)

    feats: dict[str, float] = {
        "asset_index":              asset_index,
        "market_orientation":       market_orientation,
        "offfarm_income_share":     offfarm_income_share,
        "income_div_index":         income_div_index,
        "asset_x_market":           asset_x_market,
        "land_per_member":          land_per_member,
        "livestock_income_share":   livestock_income_share,
        "livestock_tlu_capped":     livestock_tlu_capped,
        "land_cultivated_ha_capped": land_cultivated_ha_capped,
        "log_total_income_ppp":     log_total_income_ppp,
        "hh_size_members":          float(hh_size),
        "edu_level":                edu_level,
        "hh_type_encoded":          hh_type_encoded,
        "is_female_headed":         is_female_headed,
        "female_income_control":    female_income_control,
        "land_formal":              land_formal,
        "has_homegarden":           has_homegarden,
        "has_irrigation":           has_irrigation,
        "manages_trees":            manages_trees,
        "has_agroforestry":         has_agroforestry,
        "receives_aid":             receives_aid,
        "agric_modern_index":       agric_modern_index,
        "resilience_buffer":        resilience_buffer,
        "crop_count_num":           crop_count_num,
        "cattle_tlu_capped":        cattle_tlu_capped,
        "small_ruminant_tlu_capped": small_ruminant_tlu_capped,
        **region_feats,
    }
    return feats


def to_vector(feats: dict[str, float], feat_order: list[str]) -> np.ndarray:
    """Convert feature dict → numpy row vector in the correct column order."""
    return np.array([[feats.get(f, 0.0) for f in feat_order]], dtype=float)


def to_cluster_vector(feats: dict[str, float], cluster_feats: list[str]) -> np.ndarray:
    return np.array([[feats.get(f, 0.0) for f in cluster_feats]], dtype=float)


def top_risk_drivers(
    feats: dict[str, float],
    feat_order: list[str],
    importances: np.ndarray,
    n: int = 3,
) -> list[dict]:
    """Return top-n features by importance × |normalised value|."""
    LABELS = {
        "asset_index":           "Asset base (livestock + land)",
        "market_orientation":    "Market orientation",
        "log_total_income_ppp":  "Total income",
        "livestock_tlu_capped":  "Livestock holding",
        "land_cultivated_ha_capped": "Land cultivated",
        "offfarm_income_share":  "Off-farm income share",
        "income_div_index":      "Income diversification",
        "edu_level":             "Education level",
        "is_female_headed":      "Female-headed household",
        "land_formal":           "Formal land title",
        "has_irrigation":        "Irrigation access",
        "agric_modern_index":    "Agricultural modernisation",
        "resilience_buffer":     "Resilience buffer",
        "receives_aid":          "Aid dependency",
        "cattle_tlu_capped":     "Cattle holding",
        "crop_count_num":        "Crop diversity",
        "hh_size_members":       "Household size",
    }
    scores = []
    for i, feat in enumerate(feat_order):
        if i >= len(importances):
            break
        val = feats.get(feat, 0.0)
        scores.append({
            "feature": feat,
            "label":   LABELS.get(feat, feat.replace("_", " ").title()),
            "importance": float(importances[i]),
            "value":  float(val),
            "score":  float(importances[i] * abs(val)),
        })
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores[:n]
