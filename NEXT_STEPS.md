# What to do right now — in order

## 1. Install the real CLIP package (5 min)

Your backend currently has `open-clip-torch` but the paper uses OpenAI's `clip` package.
With your .venv activated in the backend folder:

```cmd
pip install git+https://github.com/openai/CLIP.git
pip install imageio
```

## 2. Copy the model weights (1 min)

```cmd
mkdir backend\data
copy "C:\Users\ivans\Downloads\material_fingerprint\3_models\model_C-MLP\clip_lr4e4_gelu_rf2_r1_best.pt" "backend\data\"
```

## 3. Run the dataset setup script (5-15 min)

This processes all 347 materials — copies images, reads human ratings,
optionally runs real CLIP on every material.

```cmd
cd backend
.venv\Scripts\activate

# Option A — use normalised MOS ratings as fingerprints (fast, 30 sec)
python setup_dataset.py --dataset "C:\Users\ivans\Downloads\material_fingerprint" --use-mos-only

# Option B — run real CLIP on all 347 materials (slow, ~10 min on CPU, most accurate)
python setup_dataset.py --dataset "C:\Users\ivans\Downloads\material_fingerprint"
```

Start with Option A to verify everything works, then run Option B for the final version.

## 4. Restart the backend

```cmd
uvicorn main:app --reload --port 8000
```

You should now see:
```
INFO: Index ready — 347 materials | real CV: True
```

And http://localhost:8000/api/health returns:
```json
{"status":"ok","materials":347,"real_cv":true,"mode":"real"}
```

## 5. The frontend stays running — no restart needed

## 6. Set up GitHub (see GITHUB_DEPLOY.md)

## 7. Deploy (see GITHUB_DEPLOY.md — Railway + Vercel, both free)

---

## Verifying everything works

After setup, test each feature:

**Retrieve:** Upload any photo → should show real material images in results

**Edit:** Select "001_3M_467MP_silver" → drag Shininess down → results should show matte materials

**Authenticate:** Upload same image twice → AUTHENTIC. Upload metal + fabric → FLAGGED

**Compose:** Select any two materials → predict → see radar triple + real image results

**Explain:** Select any two materials → Grad-CAM → heatmaps overlaid on real photos

---

## If CLIP is slow on CPU

Each fingerprint extraction takes ~3-4 seconds on CPU. This is normal.
The 347-material index is built once (setup_dataset.py) and cached in fingerprints.csv.
Live inference (user uploads) is ~3-4 sec per image — acceptable for a demo.
