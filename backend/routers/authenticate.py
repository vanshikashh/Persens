from fastapi import APIRouter, HTTPException, Request, File, UploadFile
from pydantic import BaseModel
from models.schemas import AuthRequest, ATTRIBUTES
from services.authenticator import authenticate, calibrate
from services.extractor import extract_fingerprint
import numpy as np

router = APIRouter()


@router.post("/fingerprints")
async def authenticate_by_fingerprints(request: Request, body: AuthRequest):
    """Authenticate using pre-computed fingerprints."""
    index  = request.app.state.index
    thresholds = calibrate(index.intra_distances())

    if body.reference_fingerprint:
        ref_fp = np.array(body.reference_fingerprint, dtype=np.float32)
    elif body.reference_material_id is not None:
        rec = index.get(body.reference_material_id)
        if not rec:
            raise HTTPException(404, f"Material {body.reference_material_id} not found")
        ref_fp = np.array(rec["fingerprint"], dtype=np.float32)
    else:
        raise HTTPException(400, "Provide reference_fingerprint or reference_material_id")

    qry_fp = np.array(body.query_fingerprint, dtype=np.float32)
    return authenticate(ref_fp, qry_fp, thresholds)


@router.post("/images")
async def authenticate_by_images(
    request: Request,
    reference: UploadFile = File(...),
    query:     UploadFile = File(...),
):
    """Authenticate by uploading two images directly."""
    index      = request.app.state.index
    thresholds = calibrate(index.intra_distances())

    ref_bytes = await reference.read()
    qry_bytes = await query.read()

    ref_fp, _ = extract_fingerprint(ref_bytes)
    qry_fp, _ = extract_fingerprint(qry_bytes)

    return authenticate(ref_fp, qry_fp, thresholds)


@router.get("/thresholds")
async def get_thresholds(request: Request):
    """Return calibrated distance thresholds for the current index."""
    index = request.app.state.index
    return calibrate(index.intra_distances())
