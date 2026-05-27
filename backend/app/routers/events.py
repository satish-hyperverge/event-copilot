from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..config import get_settings
from ..database import get_session
from ..models.event import Event, EventCreate, EventRead
from ..services.supabase_rest import supabase

router = APIRouter(prefix="/events", tags=["events"])
settings = get_settings()


def _using_supabase() -> bool:
    return settings.data_backend == "supabase"


def _demo_event() -> dict:
    return {
        "id": 1,
        "name": "Demo Event",
        "date_start": "2026-05-27",
        "date_end": "2026-05-27",
        "location": "Demo",
        "description": "Default event for lead capture demos.",
        "created_at": "2026-05-27T00:00:00",
    }


@router.post("", response_model=EventRead)
def create_event(event: EventCreate, session: Session = Depends(get_session)):
    if _using_supabase():
        return supabase.insert("event", event.model_dump(mode="json", exclude_none=True))

    db_event = Event.model_validate(event)
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@router.get("", response_model=List[EventRead])
def list_events(session: Session = Depends(get_session)):
    if _using_supabase():
        # Capture-only demo only needs one selectable event; avoid blocking the UI on
        # Supabase REST schema/RLS settings for the event table.
        return [_demo_event()]

    return session.exec(select(Event).order_by(Event.date_start.desc())).all()


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, session: Session = Depends(get_session)):
    if _using_supabase():
        if event_id == 1:
            return _demo_event()
        raise HTTPException(status_code=404, detail="Event not found")

    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
