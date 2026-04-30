# Social Radar

Social Radar is a full-stack social intelligence dashboard with a FastAPI backend and a Next.js frontend.

## Stack

- Backend: FastAPI, SQLAlchemy
- Frontend: Next.js 16, React, TypeScript
- Data Sources: Reddit RSS, YouTube API

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm 10+

## Environment Setup

1. Copy [.env.example](.env.example) to `.env` in the project root.
2. Fill required backend keys:
   - `REDDIT_CLIENT_ID`
   - `REDDIT_CLIENT_SECRET`
   - `REDDIT_USER_AGENT`
   - `YOUTUBE_API_KEY`
3. (Optional) Copy [frontend/.env.example](frontend/.env.example) to `frontend/.env.local`.

## Backend Run

```bash
cd backend
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Backend health check:

- `GET http://127.0.0.1:8000/api/health`

## Frontend Run

```bash
cd frontend
npm install
npm run dev
```

Frontend app:

- `http://127.0.0.1:3000`

## Production Build

Frontend:

```bash
cd frontend
npm run build
npm run start
```

Backend:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Notes

- Frontend uses same-origin `/api/*` requests by default.
- Next.js rewrites proxy `/api/*` to `BACKEND_API_ORIGIN` (or `NEXT_PUBLIC_API_BASE_URL`, then local default).
- AI Analyst endpoint: `POST /api/ai/summary`.
