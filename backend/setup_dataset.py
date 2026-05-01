"""
setup_dataset.py — Run once to ingest the paper's dataset into LensID.

Usage (from the backend folder, with .venv activated):
    python setup_dataset.py --dataset "C:\\Users\\ivans\\Downloads\\material_fingerprint"

What it does:
  1. Reads ratingsMOS_347_avg.txt  → 347 × 16 human-rated fingerprints (z-scored)
  2. Reads matNames.txt            → material names
  3. Reads categories.txt          → category per material
  4. Copies non-specular + specular images → data/images/
  5. Runs CLIP + C-MLP on every material  → real fingerprints (if weights available)
  6. Writes data/fingerprints.csv         → indexed on next server start

If CLIP weights are not found, the MOS ratings are normalised and used directly
as the fingerprint (still real human data, just not model-predicted).
"""

import argparse
import csv
import shutil
import logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ── paths inside this repo ────────────────────────────────────────────────────
BACKEND_DIR  = Path(__file__).parent
DATA_DIR     = BACKEND_DIR / "data"
IMAGES_DIR   = DATA_DIR / "images" / "nonspec"
IMAGES_SPEC  = DATA_DIR / "images" / "spec"
FP_CSV       = DATA_DIR / "fingerprints.csv"
WEIGHTS_PATH = DATA_DIR / "clip_lr4e4_gelu_rf2_r1_best.pt"

ATTRIBUTES = [
    "color_vibrancy","surface_roughness","pattern_complexity",
    "striped_pattern","checkered_pattern","brightness","shininess",
    "sparkle","hardness","movement_effect","pattern_scale",
    "naturalness","thickness","multicolored","value","warmth",
]

CATEGORY_MAP = {
    "fabric": "fabric", "Fabric": "fabric", "FABRIC": "fabric",
    "wood": "wood",     "Wood": "wood",     "WOOD": "wood",
    "coating": "coating","Coating":"coating","COATING":"coating",
    "paper": "paper",   "Paper": "paper",
    "plastic": "plastic","Plastic":"plastic",
    "metal": "metal",   "Metal": "metal",
    "leather": "leather","Leather":"leather",
}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", required=True,
                   help=r"Path to material_fingerprint folder, e.g. C:\Users\ivans\Downloads\material_fingerprint")
    p.add_argument("--use-mos-only", action="store_true",
                   help="Skip CLIP inference, use normalised MOS ratings as fingerprint")
    return p.parse_args()


def load_mos(psydata_dir: Path) -> np.ndarray:
    """Load 347×16 MOS matrix from ratingsMOS_347_avg.txt."""
    ratings_file = psydata_dir / "Study_4_Rating_Study" / "ratingsMOS_347_avg.txt"
    if not ratings_file.exists():
        raise FileNotFoundError(f"Not found: {ratings_file}")

    rows = []
    with open(ratings_file, encoding="utf-8") as f:
        buffer = []
        for line in f:
            buffer.extend(line.strip().split())
            # Each row has exactly 16 values
            while len(buffer) >= 16:
                rows.append([float(x) for x in buffer[:16]])
                buffer = buffer[16:]

    mat = np.array(rows, dtype=np.float32)
    logger.info(f"Loaded MOS ratings: {mat.shape}")
    return mat


def normalise_mos(mos: np.ndarray) -> np.ndarray:
    """Normalise z-scored MOS to [0,1] per attribute using min-max."""
    mn  = mos.min(axis=0, keepdims=True)
    mx  = mos.max(axis=0, keepdims=True)
    return ((mos - mn) / (mx - mn + 1e-8)).astype(np.float32)


def load_names(stimuli_dir: Path) -> list[str]:
    names_file = stimuli_dir / "matNames.txt"
    if not names_file.exists():
        return [f"Material_{i+1:03d}" for i in range(347)]
    with open(names_file, encoding="utf-8") as f:
        names = [line.strip() for line in f if line.strip()]
    return names


def load_categories(stimuli_dir: Path, n: int) -> list[str]:
    cat_file = stimuli_dir / "categories.txt"
    if not cat_file.exists():
        return ["other"] * n
    with open(cat_file, encoding="utf-8") as f:
        cats = [line.strip() for line in f if line.strip()]
    return [CATEGORY_MAP.get(c, "other") for c in cats]


def copy_images(stimuli_dir: Path, names: list[str]):
    """Copy material images into data/images/nonspec and data/images/spec."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_SPEC.mkdir(parents=True, exist_ok=True)

    nonspec_src = stimuli_dir / "2_images_specular_nonspecular" / "non-specular_frame09"
    spec_src    = stimuli_dir / "2_images_specular_nonspecular" / "specular_frame51"

    copied = 0
    for img_file in sorted(nonspec_src.glob("*.jpg")):
        dst = IMAGES_DIR / img_file.name
        if not dst.exists():
            shutil.copy2(img_file, dst)
        copied += 1

    for img_file in sorted(spec_src.glob("*.jpg")):
        dst = IMAGES_SPEC / img_file.name
        if not dst.exists():
            shutil.copy2(img_file, dst)

    logger.info(f"Copied {copied} non-specular + specular image pairs")
    return sorted(IMAGES_DIR.glob("*.jpg")), sorted(IMAGES_SPEC.glob("*.jpg"))


def build_fingerprints_clip(nonspec_imgs, spec_imgs, device_str="cpu"):
    """Run real CLIP+MLP on every material. Returns (347,16) array."""
    import torch
    import torch.nn as nn
    import clip
    import imageio.v3 as imageio

    class MLP(nn.Module):
        def __init__(self, layers):
            super().__init__()
            self.layers = nn.Sequential()
            for i, (n_in, n_out) in enumerate(zip(layers[:-1], layers[1:])):
                self.layers.append(nn.Linear(n_in, n_out))
                if i < len(layers) - 2:
                    self.layers.append(nn.GELU())
        def forward(self, x):
            return self.layers(x)

    def clip_preprocess_np(img, sz_resize=256, sz_crop=224):
        from PIL import Image as PILImage
        min_sz = min(img.shape[:2])
        new_h  = int(img.shape[0] / min_sz * sz_resize)
        new_w  = int(img.shape[1] / min_sz * sz_resize)
        img    = np.array(PILImage.fromarray(img).resize((new_w, new_h),
                          resample=PILImage.Resampling.BICUBIC))
        top  = int(round((img.shape[0] - sz_crop) / 2.0))
        left = int(round((img.shape[1] - sz_crop) / 2.0))
        img  = img[top:top + sz_crop, left:left + sz_crop]
        t    = torch.from_numpy(img.transpose(2, 0, 1).astype(np.float32) / 255.0)
        mean = torch.tensor([0.48145466, 0.4578275,  0.40821073]).view(-1,1,1)
        std  = torch.tensor([0.26862954, 0.26130258, 0.27577711]).view(-1,1,1)
        return t.sub_(mean).div_(std)

    device = torch.device(device_str)
    logger.info(f"Loading CLIP on {device_str}...")
    clip_model, _ = clip.load("ViT-B/32", device=device)
    clip_model.eval()

    mlp = MLP((1024, 512, 512, 16)).to(device)
    checkpoint = torch.load(str(WEIGHTS_PATH), map_location=device)
    state = checkpoint.get("model", checkpoint)
    mlp.load_state_dict(state)
    mlp.eval()
    logger.info("MLP weights loaded")

    fingerprints = []
    n = min(len(nonspec_imgs), len(spec_imgs))
    for i, (p1, p2) in enumerate(zip(nonspec_imgs, spec_imgs)):
        try:
            img1 = imageio.imread(str(p1))
            img2 = imageio.imread(str(p2))
            if img1.ndim == 2: img1 = np.stack([img1]*3, axis=2)
            if img2.ndim == 2: img2 = np.stack([img2]*3, axis=2)
            img1 = img1[:, :, :3]
            img2 = img2[:, :, :3]

            t1 = clip_preprocess_np(img1).unsqueeze(0).to(device)
            t2 = clip_preprocess_np(img2).unsqueeze(0).to(device)
            imgs = torch.cat([t1, t2], dim=0)

            with torch.no_grad():
                feats = clip_model.encode_image(imgs)
                feats = feats.reshape(1, 1024).float()
                fp    = mlp(feats)[0].cpu().numpy()

            fingerprints.append(fp)
            if (i + 1) % 20 == 0:
                logger.info(f"  Processed {i+1}/{n} materials...")
        except Exception as e:
            logger.warning(f"  Error on {p1.name}: {e} — using zeros")
            fingerprints.append(np.zeros(16, dtype=np.float32))

    return np.array(fingerprints, dtype=np.float32)


def write_csv(names, categories, fingerprints, nonspec_imgs, spec_imgs):
    """Write fingerprints.csv for the backend to load."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Build filename→path maps
    nonspec_map = {p.name: p for p in nonspec_imgs}
    spec_map    = {p.name: p for p in spec_imgs}

    # Match by index (files are sorted numerically by prefix 001_, 002_, ...)
    nonspec_list = sorted(nonspec_imgs)
    spec_list    = sorted(spec_imgs)

    with open(FP_CSV, "w", newline="", encoding="utf-8") as f:
        fieldnames = (["material_id", "name", "category"]
                      + [f"fp_{i}" for i in range(16)]
                      + ["image_nonspec", "image_spec"])
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        n = min(len(names), len(fingerprints), len(nonspec_list))
        for i in range(n):
            img_ns = nonspec_list[i].name if i < len(nonspec_list) else ""
            img_sp = spec_list[i].name    if i < len(spec_list)    else ""
            row = {
                "material_id": i + 1,
                "name":        names[i] if i < len(names) else f"Material_{i+1:03d}",
                "category":    categories[i] if i < len(categories) else "other",
                "image_nonspec": img_ns,
                "image_spec":    img_sp,
            }
            for j in range(16):
                row[f"fp_{j}"] = round(float(fingerprints[i, j]), 6)
            writer.writerow(row)

    logger.info(f"Written {n} materials to {FP_CSV}")


def main():
    args = parse_args()
    dataset_path = Path(args.dataset)

    stimuli_dir = dataset_path / "1_stimuli"
    psydata_dir = dataset_path / "2_psydata"

    logger.info("=" * 55)
    logger.info("  LensID Dataset Setup")
    logger.info("=" * 55)

    # Step 1: Load MOS ratings (ground truth)
    logger.info("\n[1/4] Loading human perceptual ratings...")
    mos = load_mos(psydata_dir)           # (347, 16) z-scored
    mos_norm = normalise_mos(mos)          # (347, 16) in [0,1]
    logger.info(f"      {mos.shape[0]} materials × 16 attributes")

    # Step 2: Load names and categories
    logger.info("\n[2/4] Loading material names and categories...")
    names      = load_names(stimuli_dir)
    categories = load_categories(stimuli_dir, len(names))
    logger.info(f"      {len(names)} names, {len(set(categories))} categories")

    # Step 3: Copy images
    logger.info("\n[3/4] Copying material images...")
    nonspec_imgs, spec_imgs = copy_images(stimuli_dir, names)
    logger.info(f"      {len(nonspec_imgs)} image pairs copied to data/images/")

    # Step 4: Build fingerprints
    logger.info("\n[4/4] Building fingerprints...")
    if args.use_mos_only or not WEIGHTS_PATH.exists():
        if not args.use_mos_only:
            logger.info(f"      Weights not found at {WEIGHTS_PATH}")
            logger.info(f"      → Copy clip_lr4e4_gelu_rf2_r1_best.pt to data/")
            logger.info(f"      → Using normalised MOS ratings as fingerprint")
        fingerprints = mos_norm
        source = "MOS ratings (normalised)"
    else:
        logger.info("      Running CLIP + C-MLP on CPU (takes ~5-10 min for 347 materials)...")
        logger.info("      Tip: this runs once. Results saved to fingerprints.csv")
        fingerprints = build_fingerprints_clip(nonspec_imgs, spec_imgs)
        source = "CLIP + C-MLP (real model)"

    # Trim to match number of images (may be fewer than 347 if some missing)
    n = min(len(names), len(nonspec_imgs), len(fingerprints))
    write_csv(names[:n], categories[:n], fingerprints[:n], nonspec_imgs, spec_imgs)

    logger.info("\n" + "=" * 55)
    logger.info(f"  ✓ Setup complete!")
    logger.info(f"  Materials indexed : {n}")
    logger.info(f"  Fingerprint source: {source}")
    logger.info(f"  Images directory  : {IMAGES_DIR}")
    logger.info(f"  CSV written to    : {FP_CSV}")
    logger.info("")
    logger.info("  Restart the backend to load the real dataset:")
    logger.info("  uvicorn main:app --reload --port 8000")
    logger.info("=" * 55)


if __name__ == "__main__":
    main()
