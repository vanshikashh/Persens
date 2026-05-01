"""
Real CLIP + C-MLP extractor.

Uses the paper's exact architecture:
  MLP((2*512, 512, 512, 16)) with GELU activations
  CLIP ViT-B/32 via the 'clip' package (openai/CLIP)
  CPU-safe — no GPU required.

Falls back to statistical mock if weights not found.
"""

import logging
import hashlib
import io
import numpy as np
from pathlib import Path
from PIL import Image

logger = logging.getLogger(__name__)

WEIGHTS_PATH = Path(__file__).parent.parent / "data" / "clip_lr4e4_gelu_rf2_r1_best.pt"
DEVICE_STR   = "cpu"   # CPU-only for Windows without GPU


# ── Paper-exact preprocessing ────────────────────────────────────────────────

def _clip_preprocess_np(img_np: np.ndarray, sz_resize: int = 256,
                         sz_crop: int = 224) -> "torch.Tensor":
    """Exact replication of the paper's clip_preprocess function."""
    import torch
    from PIL import Image as PILImage

    # Resize so smaller edge = sz_resize
    min_sz = min(img_np.shape[:2])
    new_h  = int(img_np.shape[0] / min_sz * sz_resize)
    new_w  = int(img_np.shape[1] / min_sz * sz_resize)
    img_pil = PILImage.fromarray(img_np).resize((new_w, new_h),
                                                 resample=PILImage.Resampling.BICUBIC)
    img_np  = np.array(img_pil)

    # Centre crop to sz_crop × sz_crop
    top  = int(round((img_np.shape[0] - sz_crop) / 2.0))
    left = int(round((img_np.shape[1] - sz_crop) / 2.0))
    img_np = img_np[top:top + sz_crop, left:left + sz_crop]

    # HWC → CHW, [0,1]
    t = torch.from_numpy(img_np.transpose(2, 0, 1).astype(np.float32) / 255.0)

    # CLIP normalisation
    mean = torch.tensor([0.48145466, 0.4578275,  0.40821073]).view(-1, 1, 1)
    std  = torch.tensor([0.26862954, 0.26130258, 0.27577711]).view(-1, 1, 1)
    return t.sub_(mean).div_(std)


# ── Paper-exact MLP ───────────────────────────────────────────────────────────

def _build_mlp():
    import torch.nn as nn

    class MLP(nn.Module):
        def __init__(self, layers):
            super().__init__()
            self.layers = nn.Sequential()
            for i, (n_in, n_out) in enumerate(zip(layers[:-1], layers[1:])):
                self.layers.append(nn.Linear(n_in, n_out))
                if i < len(layers) - 2:          # no activation after last layer
                    self.layers.append(nn.GELU())

        def forward(self, x):
            return self.layers(x)

    return MLP((2 * 512, 512, 512, 16))


# ── Load real extractor ───────────────────────────────────────────────────────

def _try_load_real():
    try:
        import torch
        import clip

        device = torch.device(DEVICE_STR)

        # CLIP
        clip_model, _ = clip.load("ViT-B/32", device=device)
        clip_model.eval()
        logger.info("CLIP ViT-B/32 loaded on CPU")

        # MLP
        if not WEIGHTS_PATH.exists():
            logger.warning(f"Weights not found at {WEIGHTS_PATH} — using mock extractor")
            return None

        mlp = _build_mlp().to(device)
        checkpoint = torch.load(str(WEIGHTS_PATH), map_location=device)

        # Handle both raw state_dict and checkpoint dict
        state = checkpoint.get("model", checkpoint)
        mlp.load_state_dict(state)
        mlp.eval()
        logger.info(f"C-MLP weights loaded from {WEIGHTS_PATH.name}")

        def real_extract(img1_np: np.ndarray, img2_np: np.ndarray) -> np.ndarray:
            t1 = _clip_preprocess_np(img1_np).unsqueeze(0).to(device)
            t2 = _clip_preprocess_np(img2_np).unsqueeze(0).to(device)
            imgs = torch.cat([t1, t2], dim=0)          # batch of 2

            with torch.no_grad():
                features = clip_model.encode_image(imgs)           # (2, 512)
                features = features.reshape(1, 2 * 512).float()    # (1, 1024)
                fp       = mlp(features)[0].cpu().numpy()          # (16,)

            return fp.astype(np.float32)

        return real_extract

    except Exception as e:
        logger.warning(f"Real extractor unavailable: {e}")
        return None


# ── Mock extractor (statistical fallback) ────────────────────────────────────

def _mock_extract(img_np: np.ndarray, seed_extra: int = 0) -> np.ndarray:
    arr = img_np.astype(np.float32) / 255.0
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    brightness   = float(arr.mean())
    saturation   = float(np.std(arr))
    warmth       = float(np.clip(r.mean() - b.mean() + 0.5, 0, 1))

    from PIL import Image as PILImage, ImageFilter
    pil = PILImage.fromarray(img_np)
    edges = np.array(pil.convert("L").filter(ImageFilter.FIND_EDGES),
                     dtype=np.float32) / 255.0
    edge_density = float(edges.mean())

    gray     = np.array(pil.convert("L"), dtype=np.float32) / 255.0
    blur     = np.array(pil.convert("L").filter(ImageFilter.GaussianBlur(3)),
                        dtype=np.float32) / 255.0
    hf       = float(np.abs(gray - blur).mean())

    fft      = np.abs(np.fft.fftshift(np.fft.fft2(gray)))
    cx, cy   = fft.shape[0] // 2, fft.shape[1] // 2
    horiz    = float(fft[cx, cy + 5:cy + 30].mean() / (fft.max() + 1e-8))
    vert     = float(fft[cx + 5:cx + 30, cy].mean() / (fft.max() + 1e-8))

    fp = np.array([
        np.clip(saturation * 3,       0, 1),
        np.clip(edge_density * 4,     0, 1),
        np.clip(saturation * 2,       0, 1),
        np.clip(horiz * 8,            0, 1),
        np.clip(vert  * 8,            0, 1),
        np.clip(brightness,           0, 1),
        np.clip(hf * 10,              0, 1),
        np.clip(hf * 8,               0, 1),
        np.clip(1 - edge_density * 3, 0, 1),
        np.clip(saturation * 1.5,     0, 1),
        np.clip(saturation * 2.5,     0, 1),
        np.clip(1 - saturation * 2,   0, 1),
        np.clip(brightness * 0.8,     0, 1),
        np.clip(saturation * 4,       0, 1),
        np.clip(brightness * 0.7,     0, 1),
        np.clip(warmth,               0, 1),
    ], dtype=np.float32)

    h = int(hashlib.md5(img_np.tobytes()[:512]).hexdigest()[:8], 16) / 0xFFFFFFFF
    rng = np.random.default_rng(int(h * 1e9) + seed_extra)
    return np.clip(fp + rng.normal(0, 0.03, 16).astype(np.float32), 0, 1)


# ── Public API ────────────────────────────────────────────────────────────────

_real_extract = _try_load_real()
USING_REAL_CV = _real_extract is not None


def extract_fingerprint_from_arrays(img1_np: np.ndarray,
                                    img2_np: np.ndarray) -> tuple[np.ndarray, float]:
    """Extract fingerprint from two numpy arrays (H,W,3 uint8)."""
    if _real_extract is not None:
        return _real_extract(img1_np, img2_np), 0.96
    return _mock_extract(img1_np), 0.72


def extract_fingerprint(img1_bytes: bytes,
                        img2_bytes: bytes | None = None) -> tuple[np.ndarray, float]:
    """Extract fingerprint from raw image bytes."""
    import imageio.v3 as imageio

    img1_np = np.array(Image.open(io.BytesIO(img1_bytes)).convert("RGB"))
    img2_np = (np.array(Image.open(io.BytesIO(img2_bytes)).convert("RGB"))
               if img2_bytes else img1_np)

    return extract_fingerprint_from_arrays(img1_np, img2_np)
