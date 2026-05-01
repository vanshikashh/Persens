from pydantic import BaseModel, Field
from typing import Optional
import numpy as np

ATTRIBUTES = [
    "color_vibrancy", "surface_roughness", "pattern_complexity",
    "striped_pattern", "checkered_pattern", "brightness", "shininess",
    "sparkle", "hardness", "movement_effect", "pattern_scale",
    "naturalness", "thickness", "multicolored", "value", "warmth",
]

ATTR_DISPLAY = [
    "Color Vibrancy", "Surface Roughness", "Pattern Complexity",
    "Striped Pattern", "Checkered Pattern", "Brightness", "Shininess",
    "Sparkle", "Hardness", "Movement Effect", "Pattern Scale",
    "Naturalness", "Thickness", "Multicolored", "Value", "Warmth",
]

ILLUMINATION_SENSITIVE = ["brightness", "shininess", "sparkle", "movement_effect"]
MATERIAL_INTRINSIC     = ["naturalness", "surface_roughness", "pattern_complexity",
                          "hardness", "warmth", "thickness"]

CATEGORY_COLORS = {
    "fabric":  "#9B59B6",
    "wood":    "#E67E22",
    "coating": "#27AE60",
    "paper":   "#3498DB",
    "plastic": "#E74C3C",
    "metal":   "#95A5A6",
    "leather": "#8B4513",
    "other":   "#7F8C8D",
}


class Fingerprint(BaseModel):
    values: list[float] = Field(..., min_length=16, max_length=16)
    attributes: dict[str, float] = {}
    confidence: float = 1.0

    @classmethod
    def from_array(cls, arr: np.ndarray, confidence: float = 1.0) -> "Fingerprint":
        vals = arr.tolist()
        return cls(
            values=vals,
            attributes=dict(zip(ATTRIBUTES, vals)),
            confidence=confidence,
        )


class MaterialRecord(BaseModel):
    material_id: int
    name: str
    category: str
    fingerprint: Fingerprint
    image_path: Optional[str] = None
    frame1_path: Optional[str] = None
    frame60_path: Optional[str] = None


class RetrievalResult(BaseModel):
    material_id: int
    name: str
    category: str
    similarity: float
    fingerprint: Fingerprint
    image_path: Optional[str] = None


class EditRequest(BaseModel):
    source_material_id: Optional[int] = None
    base_fingerprint: Optional[list[float]] = None
    edits: dict[str, float]
    alpha: float = Field(0.7, ge=0.0, le=1.0)
    top_k: int = Field(5, ge=1, le=20)


class AuthRequest(BaseModel):
    reference_material_id: Optional[int] = None
    reference_fingerprint: Optional[list[float]] = None
    query_fingerprint: list[float]


class ComposeRequest(BaseModel):
    material_id_a: Optional[int] = None
    material_id_b: Optional[int] = None
    fingerprint_a: Optional[list[float]] = None
    fingerprint_b: Optional[list[float]] = None
    top_k: int = Field(5, ge=1, le=20)


class ExplainRequest(BaseModel):
    query_material_id: Optional[int] = None
    match_material_id: Optional[int] = None
    query_fingerprint: Optional[list[float]] = None
    match_fingerprint: Optional[list[float]] = None
    top_n: int = Field(4, ge=2, le=8)
