from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import create_db_and_tables
from .routers import events, prospects, outreach, capture, followup, ai, analytics, schedule, linkedin

settings = get_settings()

app = FastAPI(
    title="Conference Lead Platform",
    description="B2B conference lead generation and management platform",
    version="1.0.0",
)

# Support comma-separated list of origins (e.g. multiple Railway URLs + localhost)
_origins = [o.strip() for o in settings.frontend_url.split(",") if o.strip()]
# Always include localhost for local dev
for _local in ["http://localhost:5173", "http://localhost:3000"]:
    if _local not in _origins:
        _origins.append(_local)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.up\.railway\.app",  # all Railway preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    if settings.data_backend != "supabase":
        create_db_and_tables()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Conference Lead Platform API"}


app.include_router(events.router)
app.include_router(prospects.router)
app.include_router(outreach.router)
app.include_router(capture.router)
app.include_router(followup.router)
app.include_router(ai.router)
app.include_router(analytics.router)
app.include_router(schedule.router)
app.include_router(linkedin.router)
