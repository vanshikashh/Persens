from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from models.schemas import Fingerprint, ATTRIBUTES
from services.extractor import extract_fingerprint, USING_REAL_CV
import numpy as np
from PIL import Image
import io

router = APIRouter()


@router.post("/extract")
async def extract(
    frame1:  UploadFile = File(..., description="Non-specular frame"),
    frame60: UploadFile = File(None, description="Near-specular frame (optional)"),
):
    """Extract 16-dim perceptual fingerprint from one or two material images."""
    try:
        b1 = await frame1.read()
        b2 = await frame60.read() if frame60 else None
        fp_arr, confidence = extract_fingerprint(b1, b2)
        fp = Fingerprint.from_array(fp_arr, confidence=confidence)
        return {
            "fingerprint": fp,
            "real_cv":     USING_REAL_CV,
            "mock_mode":   not USING_REAL_CV,
            "note": None if USING_REAL_CV else
                    "Statistical mock extractor active. Copy weights + run setup_dataset.py for real CV.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attributes")
async def get_attributes():
    return {"attributes": ATTRIBUTES}


@router.get("/status")
async def status():
    return {
        "real_cv": USING_REAL_CV,
        "mode":    "real CLIP + C-MLP" if USING_REAL_CV else "statistical mock",
    }
