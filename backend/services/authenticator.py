"""
Material authentication service.

Compares two fingerprints and flags potential counterfeits by measuring:
  - Overall cosine distance
  - Illumination-robust intrinsic attribute cluster delta
  - Per-attribute deviation analysis

Thresholds are calibrated on intra-material distance distributions.
"""

import numpy as np
from scipy.spatial.distance import cosine
from models.schemas import ATTRIBUTES, ILLUMINATION_SENSITIVE, MATERIAL_INTRINSIC

# Pre-calibrated thresholds (re-computed at startup from index.intra_distances())
_DEFAULT_THRESHOLD = 0.25   # 95th-percentile intra-material distance
_ATTR_DEVIATION_CUTOFF = 0.28


def calibrate(distances: np.ndarray) -> dict:
    if len(distances) == 0:
        return {"mean": 0.15, "std": 0.08, "threshold_95": _DEFAULT_THRESHOLD}
    return {
        "mean":         float(np.mean(distances)),
        "std":          float(np.std(distances)),
        "threshold_95": float(np.percentile(distances, 95)),
    }


def authenticate(
    fp_reference: np.ndarray,
    fp_query: np.ndarray,
    thresholds: dict,
) -> dict:
    fp_ref = np.array(fp_reference, dtype=np.float32)
    fp_qry = np.array(fp_query,     dtype=np.float32)
    attr_idx = {a: i for i, a in enumerate(ATTRIBUTES)}

    full_dist = float(cosine(fp_ref, fp_qry))
    threshold = thresholds.get("threshold_95", _DEFAULT_THRESHOLD)

    # Intrinsic cluster delta (illumination-robust — should be stable)
    intrinsic_ref = np.array([fp_ref[attr_idx[a]] for a in MATERIAL_INTRINSIC])
    intrinsic_qry = np.array([fp_qry[attr_idx[a]] for a in MATERIAL_INTRINSIC])
    intrinsic_delta = float(np.mean(np.abs(intrinsic_ref - intrinsic_qry)))

    # Illumination-sensitive cluster (expected to vary — ignore for auth)
    illum_ref = np.array([fp_ref[attr_idx[a]] for a in ILLUMINATION_SENSITIVE])
    illum_qry = np.array([fp_qry[attr_idx[a]] for a in ILLUMINATION_SENSITIVE])
    illum_delta = float(np.mean(np.abs(illum_ref - illum_qry)))

    # Per-attribute deviations
    per_attr = {}
    suspicious = []
    for attr in ATTRIBUTES:
        i   = attr_idx[attr]
        dev = float(abs(fp_ref[i] - fp_qry[i]))
        per_attr[attr] = {
            "reference": round(float(fp_ref[i]), 3),
            "query":     round(float(fp_qry[i]), 3),
            "delta":     round(dev, 3),
            "cluster":   "illumination" if attr in ILLUMINATION_SENSITIVE
                         else "intrinsic" if attr in MATERIAL_INTRINSIC
                         else "other",
        }
        if attr in MATERIAL_INTRINSIC and dev > _ATTR_DEVIATION_CUTOFF:
            suspicious.append(attr)

    is_authentic = full_dist < threshold and len(suspicious) == 0
    confidence   = float(np.clip(1.0 - (full_dist / threshold), 0.0, 1.0))

    return {
        "verdict":               "AUTHENTIC" if is_authentic else "FLAGGED",
        "confidence":            round(confidence, 3),
        "fingerprint_distance":  round(full_dist, 4),
        "threshold":             round(threshold, 4),
        "intrinsic_delta":       round(intrinsic_delta, 4),
        "illumination_delta":    round(illum_delta, 4),
        "suspicious_attributes": suspicious,
        "per_attribute":         per_attr,
        "explanation": (
            f"Fingerprint within expected variance range for this material. "
            f"Distance {full_dist:.3f} < threshold {threshold:.3f}."
        ) if is_authentic else (
            f"Material-intrinsic attributes {suspicious} deviated significantly "
            f"(Δ={intrinsic_delta:.3f}). Illumination-sensitive attributes within "
            f"expected range (Δ={illum_delta:.3f}), suggesting material substitution "
            f"rather than lighting variation."
        ),
    }
