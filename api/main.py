"""FastAPI — Kenya RHoMIS Finance scoring API."""
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import artifacts as art
from pipeline import (
    engineer,
    to_cluster_vector,
    to_vector,
    top_risk_drivers,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    art.load_all()
    yield


app = FastAPI(title="Kenya RHoMIS Finance API", version="1.0.0", lifespan=lifespan)

# CORS — read allowed origins from ALLOWED_ORIGINS env var (comma-separated).
# In production, set ALLOWED_ORIGINS to your actual frontend URL.
# Example: ALLOWED_ORIGINS=https://yourapp.example.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class HouseholdInput(BaseModel):
    # Income (LCU)
    total_income_lcu:     float = Field(default=0, ge=0)
    crop_income_lcu:      float = Field(default=0, ge=0)
    livestock_income_lcu: float = Field(default=0, ge=0)
    offfarm_income_lcu:   float = Field(default=0, ge=0)
    currency_conversion_lcu_to_ppp: float = Field(default=1.0, gt=0)

    # Land
    land_ha:        float  = Field(default=0, ge=0)
    land_irrigated: bool   = False
    land_tenure:    str    = ""

    # Livestock
    cattle:  float = Field(default=0, ge=0)
    goats:   float = Field(default=0, ge=0)
    sheep:   float = Field(default=0, ge=0)
    pigs:    float = Field(default=0, ge=0)
    chicken: float = Field(default=0, ge=0)

    # Demographics
    hh_size:               int   = Field(default=4, ge=1)
    edu_level:             Optional[int]   = None   # 0-3
    hh_type:               str   = "married_couple"
    is_female_headed:      bool  = False
    female_income_control: float = Field(default=0.5, ge=0, le=1)

    # Agricultural practices
    homegarden:   bool = False
    agroforestry: bool = False
    manage_trees: bool = False
    improvedseeds: bool = False
    crop_count:   Optional[int] = None
    aidreceived:  bool = False

    # Optional enrichment
    ppi_likelihood: Optional[float] = Field(default=None, ge=0, le=1)
    has_debt:       Optional[bool]  = None

    # Region
    id_proj: str = ""


class ScoreResponse(BaseModel):
    probability:        float
    risk_band:          str
    risk_band_color:    str
    segment:            int
    segment_name:       str
    segment_profile:    dict
    recommended_product: dict
    model_scores:       dict[str, float]
    top_risk_drivers:   list[dict]
    is_female_headed:   bool
    hunger_gap_month:   str
    unclassified:       bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def risk_band(prob: float) -> tuple[str, str]:
    thresholds = art.meta.get("risk_band_thresholds", {"low": 0.146, "high": 0.387})
    if prob < thresholds["low"]:
        return "low", "#16a34a"
    if prob < thresholds["high"]:
        return "medium", "#f59e0b"
    return "high", "#dc2626"


def _predict_proba(model_key: str, X: np.ndarray) -> float:
    model = art.models.get(model_key)
    if model is None:
        return float("nan")
    try:
        return float(model.predict_proba(X)[0, 1])
    except Exception as exc:
        logger.warning("predict_proba failed for %s: %s", model_key, exc)
        return float("nan")


def _assign_segment(feats: dict) -> int:
    kmeans = art.models.get("kmeans")
    cluster_scaler = art.scalers.get("cluster")
    if kmeans is None:
        return -1
    cluster_feats = art.meta.get("cluster_feats", [])
    Xc = to_cluster_vector(feats, cluster_feats)
    if cluster_scaler is not None:
        Xc = cluster_scaler.transform(Xc)
    label = int(kmeans.predict(Xc)[0])
    return label


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": list(art.models.keys()),
    }


def _sanitize(obj: Any) -> Any:
    """Recursively replace NaN/Inf floats with None for JSON compliance."""
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


@app.get("/metadata")
def metadata():
    data = _sanitize(art.meta)
    response = JSONResponse(content=data)
    response.headers["Cache-Control"] = "public, max-age=300"
    return response


@app.post("/score", response_model=ScoreResponse)
def score(inp: HouseholdInput):
    if not art.models:
        raise HTTPException(status_code=503, detail="Models not loaded")

    # ── Income consistency check ───────────────────────────────────────────
    component_sum = inp.crop_income_lcu + inp.livestock_income_lcu + inp.offfarm_income_lcu
    if inp.total_income_lcu > 0 and component_sum > inp.total_income_lcu * 1.1:
        raise HTTPException(
            status_code=422,
            detail={
                "field": "total_income_lcu",
                "message": (
                    "The sum of crop, livestock, and off-farm income "
                    f"({component_sum:,.0f} KES) exceeds total income "
                    f"({inp.total_income_lcu:,.0f} KES) by more than 10%. "
                    "Check that the income figures are correct before scoring."
                ),
            },
        )

    raw = inp.model_dump()
    feats = engineer(raw)

    feat_order = art.meta.get("independent_feats", list(feats.keys()))
    X = to_vector(feats, feat_order)

    # ── Scores from each model ────────────────────────────────────────────
    model_scores: dict[str, float] = {}
    for key in ("rf", "xgb", "lr", "dt", "gb", "stacking"):
        p = _predict_proba(key, X)
        if not np.isnan(p):
            model_scores[key] = round(p, 4)

    # Primary = GB if available (best Kenya AUC), else RF → XGB → LR
    primary_prob = model_scores.get("gb",
                   model_scores.get("rf",
                   model_scores.get("xgb",
                   model_scores.get("lr", 0.5))))

    band, color = risk_band(primary_prob)

    # ── Segment ───────────────────────────────────────────────────────────
    seg_idx  = _assign_segment(feats)
    is_unclassified = seg_idx == -1

    seg_names     = art.meta.get("segment_names", {})
    seg_profiles  = art.meta.get("segment_profiles", {})
    product_map   = art.meta.get("product_map", {})

    if is_unclassified:
        seg_name    = "Unclassified"
        seg_profile = {}
        recommended = {}
        hunger_gap  = "unknown"
    else:
        seg_name    = seg_names.get(str(seg_idx), f"Segment {seg_idx}")
        seg_profile = seg_profiles.get(str(seg_idx), {})
        hunger_gap  = seg_profile.get("worst_month", "unknown")

        # Match product by segment name prefix (A/B/C/D)
        seg_letter  = seg_name[0] if seg_name else "?"
        product_key = next(
            (k for k in product_map if k.startswith(seg_letter)), None
        )
        recommended = product_map.get(product_key, {}) if product_key else {}

    # ── Top risk drivers ──────────────────────────────────────────────────
    drivers: list[dict] = []
    if art.rf_feature_importances is not None:
        drivers = top_risk_drivers(feats, feat_order, art.rf_feature_importances)

    return ScoreResponse(
        probability=round(primary_prob, 4),
        risk_band=band,
        risk_band_color=color,
        segment=seg_idx,
        segment_name=seg_name,
        segment_profile=seg_profile,
        recommended_product=recommended,
        model_scores=model_scores,
        top_risk_drivers=drivers,
        is_female_headed=bool(inp.is_female_headed),
        hunger_gap_month=hunger_gap,
        unclassified=is_unclassified,
    )
