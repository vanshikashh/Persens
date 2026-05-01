from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from models.schemas import Fingerprint, ATTRIBUTES

router = APIRouter()


class RetrieveRequest(BaseModel):
    fingerprint: list[float]
    top_k: int = 5
    exclude_self: bool = True
    material_id: int | None = None


@router.post("/")
async def retrieve(request: Request, body: RetrieveRequest):
    """Retrieve top-K most similar materials by cosine distance."""
    if len(body.fingerprint) != 16:
        raise HTTPException(400, "Fingerprint must have exactly 16 values")

    index = request.app.state.index
    results = index.search(
        body.fingerprint,
        top_k=body.top_k,
        exclude_id=body.material_id if body.exclude_self else None,
    )

    return {
        "query_fingerprint": dict(zip(ATTRIBUTES, body.fingerprint)),
        "results": results,
        "total_indexed": index.count(),
        "metric": "cosine_similarity",
    }


@router.get("/material/{material_id}")
async def get_material(material_id: int, request: Request):
    """Get a single material record by ID."""
    index = request.app.state.index
    record = index.get(material_id)
    if not record:
        raise HTTPException(404, f"Material {material_id} not found")
    return record


@router.get("/catalogue")
async def catalogue(request: Request, limit: int = 50, offset: int = 0):
    """List all indexed materials (paginated)."""
    index = request.app.state.index
    all_recs = index.all_records()
    return {
        "total": len(all_recs),
        "offset": offset,
        "limit": limit,
        "materials": all_recs[offset:offset + limit],
    }
