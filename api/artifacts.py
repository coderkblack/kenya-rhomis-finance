"""Load and hold all sklearn artifacts from artifacts_kenya/."""
import json
import logging
import os
import warnings
from pathlib import Path
from typing import Any

import joblib
import numpy as np

logger = logging.getLogger(__name__)

_default_dir = str(Path(__file__).parent.parent / "artifacts_kenya")
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", _default_dir))

# Filled on startup
models: dict[str, Any] = {}
scalers: dict[str, Any] = {}
meta: dict = {}
caps: dict = {}
imputation: dict = {}
region_dummy_cols: list[str] = []
rf_feature_importances: np.ndarray | None = None


def _try_load(path: Path, label: str) -> Any | None:
    try:
        obj = joblib.load(path)
        logger.info("Loaded %s", label)
        return obj
    except Exception as exc:
        logger.warning("Skipped %s — %s", label, exc)
        return None


def load_all() -> None:
    global rf_feature_importances

    # ── JSON config files ──────────────────────────────────────────────────
    with open(ARTIFACTS_DIR / "feature_metadata.json") as f:
        meta.update(json.load(f))

    with open(ARTIFACTS_DIR / "caps_v3.json") as f:
        caps.update(json.load(f))

    with open(ARTIFACTS_DIR / "imputation_v3.json") as f:
        imputation.update(json.load(f))

    with open(ARTIFACTS_DIR / "region_dummy_cols_v3.json") as f:
        region_dummy_cols.extend(json.load(f))

    # ── Models ─────────────────────────────────────────────────────────────
    _model_files = {
        "rf":       "model_rf.joblib",
        "xgb":      "model_xgb.joblib",
        "lr":       "model_lr.joblib",
        "dt":       "model_dt.joblib",
        "gb":       "model_gb_noppi.joblib",
        "stacking": "model_stacking.joblib",
    }
    for key, fname in _model_files.items():
        obj = _try_load(ARTIFACTS_DIR / fname, fname)
        if obj is not None:
            models[key] = obj

    # ── Scalers ────────────────────────────────────────────────────────────
    for key, fname in [("feature", "feature_scaler.joblib"),
                       ("cluster", "cluster_scaler.joblib")]:
        obj = _try_load(ARTIFACTS_DIR / fname, fname)
        if obj is not None:
            scalers[key] = obj

    # ── Imputer & KMeans ───────────────────────────────────────────────────
    obj = _try_load(ARTIFACTS_DIR / "imputer.joblib", "imputer.joblib")
    if obj is not None:
        models["imputer"] = obj

    obj = _try_load(ARTIFACTS_DIR / "kmeans_kenya_segments.joblib", "kmeans_kenya_segments.joblib")
    if obj is not None:
        models["kmeans"] = obj

    # ── RF feature importances (for top_risk_drivers) ─────────────────────
    if "rf" in models:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                rf_feature_importances = models["rf"].named_steps["clf"].feature_importances_
            except Exception:
                rf_feature_importances = None

    loaded = list(models.keys())
    logger.info("Startup complete. Models loaded: %s", loaded)
