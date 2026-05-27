from datetime import date
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session
from .config import get_settings
from .models.event import Event

settings = get_settings()

is_sqlite = settings.database_url.startswith("sqlite")
is_postgres = settings.database_url.startswith(("postgresql", "postgres"))
schema = settings.database_schema.strip() or "public"

connect_args = {"check_same_thread": False} if is_sqlite else {}
if is_postgres and schema != "public":
    connect_args["options"] = f"-csearch_path={schema},public"

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)


def create_db_and_tables():
    if is_postgres and schema != "public":
        with engine.connect() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
            conn.commit()
    SQLModel.metadata.create_all(engine)
    _run_migrations()
    _seed_demo_event()


def _seed_demo_event():
    """Ensure capture-only demos have a valid event_id target."""
    with Session(engine) as session:
        if session.get(Event, 1):
            return

        event = Event(
            id=1,
            name="Demo Event",
            date_start=date.today(),
            date_end=date.today(),
            location="Demo",
            description="Default event for lead capture demos.",
        )
        session.add(event)
        session.commit()


def _run_migrations():
    """Apply additive SQLite column migrations that SQLModel won't auto-create."""
    if not is_sqlite:
        return

    migrations = [
        "ALTER TABLE outreachactivity ADD COLUMN message_id TEXT",
        "ALTER TABLE outreachactivity ADD COLUMN recipient_email TEXT",
        "ALTER TABLE prospect ADD COLUMN outreach_mode TEXT",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists — safe to ignore


def get_session():
    if settings.data_backend == "supabase":
        yield None
        return

    with Session(engine) as session:
        yield session
