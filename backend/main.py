from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
import logging

from routers import fingerprint, retrieve, edit, authenticate, compose, explain, history
from services.index import MaterialIndex
from services.extractor import USING_REAL_CV

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

IMAGES_DIR = Path(__file__).parent / "data" / "images"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising material index...")
    index = MaterialIndex()
    index.build()
    app.state.index = index
    logger.info(f"Index ready — {index.count()} materials | real CV: {USING_REAL_CV}")
    yield


app = FastAPI(
    title="Persens Material Intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve material images statically
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

app.include_router(fingerprint.router, prefix="/api/fingerprint", tags=["Fingerprint"])
app.include_router(retrieve.router,    prefix="/api/retrieve",    tags=["Retrieve"])
app.include_router(edit.router,        prefix="/api/edit",        tags=["Edit"])
app.include_router(authenticate.router,prefix="/api/authenticate",tags=["Authenticate"])
app.include_router(compose.router,     prefix="/api/compose",     tags=["Compose"])
app.include_router(explain.router,     prefix="/api/explain",     tags=["Explain"])
app.include_router(history.router,     prefix="/api/history",     tags=["History"])


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "materials": app.state.index.count(),
        "real_cv": USING_REAL_CV,
        "mode": "real" if USING_REAL_CV else "mock",
    }
