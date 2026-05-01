from fastapi import APIRouter, Request
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

router = APIRouter()

# In-memory session store (swap for Redis in production)
_history: list[dict] = []
_saved:   dict[str, dict] = {}


class HistoryEntry(BaseModel):
    action:      str           # retrieve | edit | authenticate | compose | explain
    material_id: Optional[int] = None
    material_name: Optional[str] = None
    details:     Optional[dict] = None


class SaveEntry(BaseModel):
    material_id:   int
    material_name: str
    category:      str
    fingerprint:   list[float]


@router.post("/log")
async def log_action(entry: HistoryEntry):
    record = {
        "id":        str(uuid.uuid4())[:8],
        "action":    entry.action,
        "material_id":   entry.material_id,
        "material_name": entry.material_name,
        "details":   entry.details,
        "timestamp": datetime.utcnow().isoformat(),
    }
    _history.insert(0, record)
    if len(_history) > 200:
        _history.pop()
    return {"ok": True, "id": record["id"]}


@router.get("/")
async def get_history(limit: int = 30):
    return {"history": _history[:limit], "total": len(_history)}


@router.post("/save")
async def save_material(entry: SaveEntry):
    key = str(entry.material_id)
    _saved[key] = entry.model_dump()
    return {"ok": True, "saved_count": len(_saved)}


@router.delete("/save/{material_id}")
async def unsave_material(material_id: int):
    _saved.pop(str(material_id), None)
    return {"ok": True, "saved_count": len(_saved)}


@router.get("/saved")
async def get_saved():
    return {"saved": list(_saved.values()), "total": len(_saved)}
