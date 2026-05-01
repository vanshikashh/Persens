"""
MaterialIndex — Qdrant in-memory index over the 347-material dataset.

Priority loading order:
  1. data/fingerprints.csv  — pre-built by setup_dataset.py (real ratings + image paths)
  2. 50 mock materials      — fallback so app works before dataset is configured
"""

import csv
import logging
import numpy as np
from pathlib import Path
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

from models.schemas import ATTRIBUTES

logger = logging.getLogger(__name__)

DATA_DIR    = Path(__file__).parent.parent / "data"
FP_CSV      = DATA_DIR / "fingerprints.csv"
IMAGES_DIR  = DATA_DIR / "images"

# ── 50 mock materials (fallback) ──────────────────────────────────────────────
MOCK_MATERIALS = [
    (1,  "3M Silver Tape",        "metal",   [0.50,0.05,0.08,0.05,0.05,0.90,0.98,0.85,0.95,0.70,0.10,0.20,0.90,0.08,0.80,0.30]),
    (2,  "Merkur Toy",            "plastic", [0.62,0.35,0.42,0.15,0.05,0.58,0.30,0.12,0.55,0.18,0.38,0.62,0.65,0.22,0.45,0.48]),
    (3,  "Aluminium Sheet",       "metal",   [0.30,0.35,0.12,0.55,0.05,0.72,0.60,0.30,0.90,0.25,0.20,0.15,0.88,0.05,0.70,0.25]),
    (4,  "Baked Clay 01",         "other",   [0.70,0.68,0.32,0.08,0.05,0.55,0.12,0.05,0.85,0.04,0.42,0.82,0.90,0.22,0.38,0.72]),
    (5,  "Baked Clay 02",         "other",   [0.68,0.65,0.30,0.08,0.05,0.52,0.10,0.04,0.82,0.04,0.40,0.80,0.88,0.20,0.36,0.70]),
    (6,  "Baked Clay 03",         "other",   [0.72,0.70,0.35,0.10,0.05,0.58,0.14,0.06,0.88,0.05,0.44,0.84,0.92,0.24,0.40,0.74]),
    (7,  "Baked Clay 04",         "other",   [0.65,0.62,0.28,0.07,0.04,0.50,0.10,0.04,0.80,0.03,0.38,0.78,0.86,0.18,0.34,0.68]),
    (8,  "Baked Clay 05",         "other",   [0.66,0.64,0.30,0.08,0.04,0.52,0.11,0.05,0.82,0.04,0.40,0.80,0.88,0.20,0.35,0.69]),
    (9,  "Baked Clay 06",         "other",   [0.71,0.67,0.33,0.09,0.05,0.56,0.13,0.05,0.86,0.04,0.42,0.82,0.90,0.22,0.37,0.71]),
    (10, "Beads",                 "other",   [0.85,0.30,0.65,0.05,0.05,0.75,0.82,0.78,0.45,0.55,0.55,0.38,0.55,0.55,0.72,0.50]),
    (11, "Cotton Twill",          "fabric",  [0.62,0.85,0.42,0.15,0.05,0.55,0.10,0.05,0.30,0.08,0.45,0.88,0.70,0.25,0.35,0.68]),
    (12, "Satin Weave",           "fabric",  [0.70,0.15,0.30,0.70,0.05,0.80,0.90,0.65,0.20,0.40,0.35,0.60,0.40,0.30,0.72,0.55]),
    (13, "Oak Veneer",            "wood",    [0.55,0.60,0.55,0.25,0.08,0.60,0.25,0.08,0.80,0.05,0.70,0.90,0.85,0.20,0.55,0.62]),
    (14, "Rough Burlap",          "fabric",  [0.40,0.92,0.30,0.30,0.02,0.42,0.05,0.03,0.45,0.05,0.35,0.82,0.72,0.15,0.22,0.55]),
    (15, "Suede Leather",         "leather", [0.48,0.72,0.22,0.05,0.02,0.48,0.18,0.05,0.65,0.04,0.28,0.75,0.68,0.12,0.65,0.70]),
    (16, "Lacquer Coating",       "coating", [0.60,0.08,0.15,0.08,0.08,0.88,0.92,0.70,0.88,0.55,0.12,0.35,0.75,0.10,0.85,0.45]),
    (17, "Wool Boucle",           "fabric",  [0.55,0.80,0.65,0.08,0.05,0.48,0.08,0.04,0.25,0.12,0.55,0.85,0.80,0.30,0.48,0.75]),
    (18, "Brushed Aluminium",     "metal",   [0.28,0.32,0.10,0.52,0.05,0.70,0.58,0.28,0.92,0.22,0.18,0.12,0.86,0.04,0.68,0.22]),
    (19, "Mahogany Wood",         "wood",    [0.65,0.55,0.48,0.20,0.05,0.55,0.30,0.10,0.85,0.06,0.65,0.88,0.90,0.18,0.65,0.68]),
    (20, "Velvet Fabric",         "fabric",  [0.72,0.65,0.22,0.05,0.02,0.45,0.35,0.20,0.20,0.18,0.25,0.78,0.55,0.15,0.78,0.72]),
    (21, "Polished Granite",      "other",   [0.42,0.40,0.35,0.10,0.05,0.65,0.55,0.25,0.95,0.08,0.55,0.70,0.95,0.20,0.60,0.40]),
    (22, "Linen Texture",         "fabric",  [0.52,0.70,0.38,0.40,0.08,0.58,0.08,0.04,0.38,0.06,0.42,0.85,0.68,0.20,0.40,0.65]),
    (23, "Chrome Plate",          "metal",   [0.35,0.05,0.05,0.05,0.05,0.95,0.99,0.90,0.98,0.75,0.08,0.10,0.92,0.05,0.88,0.22]),
    (24, "Matte Rubber",          "plastic", [0.38,0.62,0.10,0.05,0.05,0.38,0.05,0.02,0.70,0.03,0.15,0.55,0.75,0.08,0.28,0.42]),
    (25, "Iridescent Silk",       "fabric",  [0.85,0.08,0.25,0.30,0.05,0.85,0.88,0.80,0.15,0.65,0.22,0.50,0.35,0.45,0.85,0.60]),
    (26, "Cork Sheet",            "other",   [0.48,0.78,0.42,0.05,0.02,0.52,0.05,0.03,0.35,0.04,0.50,0.90,0.55,0.18,0.35,0.62]),
    (27, "Carbon Fibre",          "other",   [0.22,0.30,0.55,0.75,0.05,0.42,0.48,0.15,0.90,0.08,0.35,0.30,0.85,0.08,0.72,0.28]),
    (28, "Waxed Canvas",          "fabric",  [0.52,0.55,0.28,0.25,0.05,0.58,0.35,0.10,0.55,0.08,0.38,0.72,0.70,0.12,0.55,0.60]),
    (29, "Hammered Copper",       "metal",   [0.78,0.45,0.62,0.08,0.08,0.68,0.70,0.40,0.88,0.15,0.45,0.35,0.85,0.15,0.65,0.55]),
    (30, "Felt Sheet",            "fabric",  [0.58,0.72,0.18,0.08,0.03,0.48,0.06,0.03,0.30,0.04,0.22,0.80,0.65,0.20,0.30,0.70]),
    (31, "Acrylic Glass",         "plastic", [0.45,0.05,0.08,0.05,0.05,0.90,0.85,0.60,0.72,0.45,0.10,0.25,0.55,0.08,0.72,0.35]),
    (32, "Pine Wood",             "wood",    [0.55,0.52,0.48,0.30,0.05,0.65,0.15,0.05,0.72,0.05,0.60,0.88,0.80,0.15,0.42,0.58]),
    (33, "Denim",                 "fabric",  [0.50,0.78,0.45,0.85,0.05,0.52,0.08,0.04,0.42,0.06,0.48,0.80,0.68,0.20,0.38,0.58]),
    (34, "Walnut Veneer",         "wood",    [0.62,0.50,0.52,0.18,0.05,0.58,0.28,0.10,0.82,0.05,0.65,0.88,0.88,0.18,0.62,0.60]),
    (35, "Textured Wallpaper",    "paper",   [0.55,0.62,0.72,0.15,0.10,0.55,0.08,0.04,0.25,0.06,0.55,0.78,0.22,0.30,0.32,0.55]),
    (36, "Matte Black Coating",   "coating", [0.15,0.25,0.08,0.05,0.05,0.20,0.10,0.04,0.85,0.05,0.08,0.35,0.75,0.05,0.55,0.28]),
    (37, "Sequin Fabric",         "fabric",  [0.88,0.20,0.55,0.15,0.15,0.90,0.92,0.95,0.25,0.80,0.38,0.30,0.45,0.55,0.82,0.52]),
    (38, "Slate Stone",           "other",   [0.35,0.65,0.40,0.25,0.10,0.45,0.20,0.08,0.92,0.05,0.50,0.78,0.95,0.15,0.48,0.38]),
    (39, "Patent Leather",        "leather", [0.55,0.05,0.10,0.05,0.05,0.85,0.92,0.72,0.75,0.45,0.10,0.42,0.65,0.10,0.88,0.48]),
    (40, "High Gloss Lacquer",    "coating", [0.50,0.03,0.05,0.03,0.03,0.92,0.95,0.80,0.90,0.60,0.08,0.22,0.72,0.06,0.88,0.40]),
    (41, "Tweed",                 "fabric",  [0.55,0.75,0.68,0.12,0.12,0.50,0.10,0.05,0.35,0.08,0.58,0.82,0.72,0.35,0.48,0.68]),
    (42, "Bamboo Ply",            "wood",    [0.60,0.48,0.42,0.55,0.08,0.65,0.18,0.06,0.75,0.05,0.60,0.88,0.82,0.18,0.50,0.60]),
    (43, "Frosted Glass",         "other",   [0.42,0.22,0.08,0.05,0.05,0.75,0.45,0.25,0.72,0.18,0.10,0.35,0.55,0.08,0.65,0.38]),
    (44, "Perforated Steel",      "metal",   [0.28,0.40,0.55,0.55,0.55,0.58,0.52,0.22,0.90,0.12,0.45,0.20,0.88,0.10,0.60,0.28]),
    (45, "Kraft Paper",           "paper",   [0.55,0.55,0.25,0.05,0.05,0.55,0.05,0.02,0.18,0.03,0.28,0.88,0.22,0.10,0.25,0.60]),
    (46, "Ostrich Leather",       "leather", [0.62,0.68,0.75,0.05,0.05,0.52,0.22,0.08,0.65,0.06,0.60,0.70,0.65,0.15,0.80,0.65]),
    (47, "Epoxy Resin",           "coating", [0.45,0.05,0.18,0.05,0.05,0.80,0.82,0.55,0.85,0.40,0.15,0.28,0.72,0.12,0.72,0.38]),
    (48, "Merino Wool",           "fabric",  [0.60,0.55,0.22,0.05,0.02,0.55,0.12,0.05,0.25,0.06,0.28,0.88,0.62,0.15,0.65,0.80]),
    (49, "Distressed Wood",       "wood",    [0.52,0.85,0.75,0.15,0.05,0.48,0.15,0.06,0.72,0.05,0.70,0.85,0.85,0.20,0.42,0.58]),
    (50, "Polypropylene",         "plastic", [0.42,0.35,0.10,0.05,0.05,0.62,0.38,0.12,0.68,0.10,0.12,0.42,0.65,0.08,0.45,0.42]),
]


class MaterialIndex:
    def __init__(self):
        self.client     = QdrantClient(":memory:")
        self.collection = "materials"
        self._records: dict[int, dict] = {}
        self._built = False

    def build(self):
        self.client.create_collection(
            self.collection,
            vectors_config=VectorParams(size=16, distance=Distance.COSINE),
        )
        if FP_CSV.exists():
            self._build_from_csv()
        else:
            self._build_mock()
        self._built = True

    def _build_from_csv(self):
        logger.info(f"Loading real fingerprints from {FP_CSV}")
        points = []
        with open(FP_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                mat_id   = int(row["material_id"])
                name     = row["name"]
                category = row["category"]
                fp       = [float(row[f"fp_{i}"]) for i in range(16)]
                record   = {
                    "material_id":  mat_id,
                    "name":         name,
                    "category":     category,
                    "fingerprint":  fp,
                    "attributes":   dict(zip(ATTRIBUTES, fp)),
                    "image_nonspec": row.get("image_nonspec", ""),
                    "image_spec":    row.get("image_spec", ""),
                }
                self._records[mat_id] = record
                points.append(PointStruct(id=mat_id, vector=fp, payload=record))
        self.client.upsert(self.collection, points)
        logger.info(f"Indexed {len(self._records)} real materials")

    def _build_mock(self):
        logger.info("Real dataset not found — using 50 mock materials. Run setup_dataset.py to load real data.")
        points = []
        for mat_id, name, category, fp in MOCK_MATERIALS:
            record = {
                "material_id":  mat_id,
                "name":         name,
                "category":     category,
                "fingerprint":  fp,
                "attributes":   dict(zip(ATTRIBUTES, fp)),
                "image_nonspec": "",
                "image_spec":    "",
            }
            self._records[mat_id] = record
            points.append(PointStruct(id=mat_id, vector=fp, payload=record))
        self.client.upsert(self.collection, points)

    def count(self) -> int:
        return len(self._records)

    def get(self, material_id: int) -> Optional[dict]:
        return self._records.get(material_id)

    def all_records(self) -> list[dict]:
        return list(self._records.values())

    def search(self, vector: list[float], top_k: int = 5,
               exclude_id: Optional[int] = None) -> list[dict]:
        try:
            response = self.client.query_points(
                collection_name=self.collection,
                query=vector,
                limit=top_k + (1 if exclude_id else 0),
            )
            hits = response.points
        except AttributeError:
            hits = self.client.search(
                self.collection,
                query_vector=vector,
                limit=top_k + (1 if exclude_id else 0),
            )

        out = []
        for r in hits:
            if exclude_id and r.payload["material_id"] == exclude_id:
                continue
            out.append({"score": r.score, **r.payload})
            if len(out) == top_k:
                break
        return out

    def intra_distances(self) -> np.ndarray:
        from scipy.spatial.distance import cosine
        by_cat: dict[str, list] = {}
        for rec in self._records.values():
            by_cat.setdefault(rec["category"], []).append(rec["fingerprint"])
        dists = []
        for fps in by_cat.values():
            if len(fps) < 2:
                continue
            for i in range(len(fps)):
                for j in range(i + 1, len(fps)):
                    dists.append(cosine(fps[i], fps[j]))
        return np.array(dists) if dists else np.array([0.2])
