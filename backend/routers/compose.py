from fastapi import APIRouter, HTTPException, Request
from models.schemas import ComposeRequest, ATTRIBUTES
from services.composer import compose_fingerprints
import numpy as np

router = APIRouter()


@router.post("/")
async def compose(request: Request, body: ComposeRequest):
    """Predict composite perceptual fingerprint from two materials."""
    index = request.app.state.index

    def resolve_fp(mid, fp_list, label):
        if fp_list:
            arr = np.array(fp_list, dtype=np.float32)
            if len(arr) != 16:
                raise HTTPException(400, f"{label} fingerprint must have 16 values")
            return arr
        if mid is not None:
            rec = index.get(mid)
            if not rec:
                raise HTTPException(404, f"Material {mid} not found")
            return np.array(rec["fingerprint"], dtype=np.float32)
        raise HTTPException(400, f"Provide {label}_fingerprint or {label}_id")

    fp_a = resolve_fp(body.material_id_a, body.fingerprint_a, "a")
    fp_b = resolve_fp(body.material_id_b, body.fingerprint_b, "b")

    composite, method = compose_fingerprints(fp_a, fp_b)

    # Retrieve nearest real materials to the composite
    results = index.search(composite.tolist(), top_k=body.top_k)

    # Compute naive baselines for comparison display
    avg_fp  = ((fp_a + fp_b) / 2.0).tolist()
    max_fp  = np.maximum(fp_a, fp_b).tolist()

    return {
        "fingerprint_a":       dict(zip(ATTRIBUTES, fp_a.tolist())),
        "fingerprint_b":       dict(zip(ATTRIBUTES, fp_b.tolist())),
        "composite_fingerprint": dict(zip(ATTRIBUTES, composite.tolist())),
        "composite_values":    composite.tolist(),
        "method":              method,
        "baselines": {
            "simple_average": avg_fp,
            "max_pool":       max_fp,
        },
        "results":             results,
        "note": "Using domain-rule composition. Train PerceptualComposer for learned weights." if method == "domain_rules" else None,
    }
