"""
PerceptualComposer — predicts composite fingerprint from two input fingerprints.

Architecture: 32 → 64 → 32 → 16 MLP with attention-weighted blending.
Trained on synthetic composition pairs using domain rules.
Falls back to domain-rule composition if torch not available.
"""

import logging
import numpy as np
from models.schemas import ATTRIBUTES

logger = logging.getLogger(__name__)


def domain_rule_composite(fp_a: np.ndarray, fp_b: np.ndarray,
                           role_a: str = "substrate", role_b: str = "coating") -> np.ndarray:
    """
    Physically-motivated composition rules.
    coating dominates: shininess, value, brightness
    substrate dominates: naturalness, thickness, warmth
    mixed: roughness, pattern attributes
    """
    idx = {a: i for i, a in enumerate(ATTRIBUTES)}
    c = np.zeros(16, dtype=np.float32)

    for i in range(16):
        a_name = ATTRIBUTES[i]
        if a_name == "shininess":
            c[i] = max(fp_a[i], fp_b[i])                       # coating wins
        elif a_name == "brightness":
            c[i] = 0.35 * fp_a[i] + 0.65 * fp_b[i]
        elif a_name == "value":
            c[i] = 0.40 * fp_a[i] + 0.60 * fp_b[i]
        elif a_name in ("naturalness", "thickness", "warmth"):
            c[i] = 0.70 * fp_a[i] + 0.30 * fp_b[i]            # substrate wins
        elif a_name == "surface_roughness":
            c[i] = 0.50 * fp_a[i] + 0.30 * fp_b[i] + 0.10    # coating smooths
        elif a_name in ("pattern_complexity", "pattern_scale", "striped_pattern",
                        "checkered_pattern", "multicolored"):
            c[i] = 0.55 * fp_a[i] + 0.35 * fp_b[i]
        elif a_name in ("sparkle", "movement_effect"):
            c[i] = max(fp_a[i], fp_b[i]) * 0.90
        else:
            c[i] = 0.50 * fp_a[i] + 0.50 * fp_b[i]

    return np.clip(c, 0.0, 1.0)


def _try_load_torch_composer():
    try:
        import torch

        class PerceptualComposerNet(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.encoder = torch.nn.Sequential(
                    torch.nn.Linear(32, 64), torch.nn.ReLU(),
                    torch.nn.Linear(64, 32), torch.nn.ReLU(),
                )
                self.attention = torch.nn.Linear(32, 2)
                self.decoder = torch.nn.Sequential(
                    torch.nn.Linear(32, 32), torch.nn.ReLU(),
                    torch.nn.Linear(32, 16), torch.nn.Sigmoid(),
                )

            def forward(self, fp1, fp2):
                combined = torch.cat([fp1, fp2], dim=-1)
                h        = self.encoder(combined)
                attn     = torch.softmax(self.attention(h), dim=-1)
                blend    = attn[:, 0:1] * fp1 + attn[:, 1:2] * fp2
                residual = self.decoder(h)
                return torch.clamp(blend + 0.1 * residual, 0.0, 1.0)

        model = PerceptualComposerNet()

        # Try loading pretrained weights
        from pathlib import Path
        weights = Path(__file__).parent.parent / "data" / "composer_weights.pt"
        if weights.exists():
            model.load_state_dict(torch.load(weights, map_location="cpu"))
            logger.info("Loaded pretrained PerceptualComposer weights")
        else:
            logger.info("No composer weights found — using domain-rule composition")
            return None

        model.eval()

        def predict(fp_a: np.ndarray, fp_b: np.ndarray) -> np.ndarray:
            t1 = torch.tensor(fp_a, dtype=torch.float32).unsqueeze(0)
            t2 = torch.tensor(fp_b, dtype=torch.float32).unsqueeze(0)
            with torch.no_grad():
                out = model(t1, t2)
            return out.squeeze().numpy()

        return predict

    except Exception as e:
        logger.warning(f"Torch composer unavailable ({e})")
        return None


_torch_predict = _try_load_torch_composer()


def compose_fingerprints(fp_a: np.ndarray, fp_b: np.ndarray) -> tuple[np.ndarray, str]:
    """
    Returns (composite_fingerprint, method_used).
    method_used: 'learned' | 'domain_rules'
    """
    if _torch_predict is not None:
        return _torch_predict(fp_a, fp_b), "learned"
    return domain_rule_composite(fp_a, fp_b), "domain_rules"
