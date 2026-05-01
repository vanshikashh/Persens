from fastapi import APIRouter, HTTPException, Request
from models.schemas import EditRequest, ATTRIBUTES
import numpy as np

router = APIRouter()


@router.post("/")
async def attribute_edit(request: Request, body: EditRequest):
    """
    Attribute-directed search: modify specific fingerprint dimensions
    then retrieve nearest neighbours in the edited space.
    """
    index = request.app.state.index

    # Resolve base fingerprint
    if body.base_fingerprint:
        base_fp = np.array(body.base_fingerprint, dtype=np.float32)
    elif body.source_material_id is not None:
        record = index.get(body.source_material_id)
        if not record:
            raise HTTPException(404, f"Material {body.source_material_id} not found")
        base_fp = np.array(record["fingerprint"], dtype=np.float32)
    else:
        raise HTTPException(400, "Provide either base_fingerprint or source_material_id")

    if len(base_fp) != 16:
        raise HTTPException(400, "Fingerprint must have 16 values")

    attr_idx = {a: i for i, a in enumerate(ATTRIBUTES)}
    invalid  = [k for k in body.edits if k not in attr_idx]
    if invalid:
        raise HTTPException(400, f"Unknown attributes: {invalid}. Valid: {ATTRIBUTES}")

    # Apply edits with alpha interpolation
    modified_fp = base_fp.copy()
    deltas = {}
    for attr, target_val in body.edits.items():
        i = attr_idx[attr]
        original = float(base_fp[i])
        modified_fp[i] = float(np.clip(
            body.alpha * original + (1 - body.alpha) * target_val, 0.0, 1.0
        ))
        deltas[attr] = {
            "original": round(original, 3),
            "target":   round(float(target_val), 3),
            "applied":  round(float(modified_fp[i]), 3),
            "delta":    round(float(modified_fp[i]) - original, 3),
        }

    results = index.search(
        modified_fp.tolist(),
        top_k=body.top_k,
        exclude_id=body.source_material_id,
    )

    # Attribute fidelity: how close are results to the targeted attributes?
    fidelity_scores = {}
    for attr, info in deltas.items():
        i = attr_idx[attr]
        target = info["applied"]
        if results:
            actual_vals = [r["fingerprint"][i] for r in results]
            fidelity_scores[attr] = round(
                float(np.mean(np.abs(np.array(actual_vals) - target))), 3
            )

    return {
        "original_fingerprint": dict(zip(ATTRIBUTES, base_fp.tolist())),
        "modified_fingerprint": dict(zip(ATTRIBUTES, modified_fp.tolist())),
        "edits_applied":        deltas,
        "alpha":                body.alpha,
        "attribute_fidelity_mae": fidelity_scores,
        "results":              results,
    }
