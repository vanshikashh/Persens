#!/usr/bin/env bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  LensID — Material Intelligence Platform ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check requirements
command -v python3 >/dev/null 2>&1 || { echo "❌  python3 required"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "❌  node required"; exit 1; }

MODE=${1:-dev}

if [ "$MODE" = "docker" ]; then
    command -v docker >/dev/null 2>&1 || { echo "❌  docker required for docker mode"; exit 1; }
    echo "🐳  Starting with Docker Compose..."
    docker compose up --build
    exit 0
fi

echo "🔧  Dev mode — starting backend + frontend"
echo ""

# Backend
echo "📦  Installing backend dependencies..."
cd backend
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
mkdir -p data
echo ""
echo "🚀  Starting FastAPI backend on http://localhost:8000"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
deactivate
cd ..

# Wait for backend
sleep 2
echo ""

# Frontend
echo "📦  Installing frontend dependencies..."
cd frontend
npm install --silent
echo ""
echo "🎨  Starting React frontend on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "════════════════════════════════════════════"
echo "  ✅  LensID running!"
echo ""
echo "  Frontend  →  http://localhost:5173"
echo "  API docs  →  http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop"
echo "════════════════════════════════════════════"
echo ""

# Graceful shutdown
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
