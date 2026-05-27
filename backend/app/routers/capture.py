import os
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ..config import get_settings
from ..database import get_session
from ..models.capture import LeadCapture, LeadCaptureCreate, LeadCaptureRead, CaptureSyncRequest, CaptureImage, CaptureImageRead
from ..services.supabase_rest import supabase

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "captures")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/capture", tags=["capture"])
settings = get_settings()


def _using_supabase() -> bool:
    return settings.data_backend == "supabase"


def _capture_payload(data: LeadCaptureCreate) -> dict:
    payload = data.model_dump(mode="json", exclude={"captured_at"}, exclude_none=True)
    payload["captured_at"] = (
        data.captured_at.isoformat() if data.captured_at else datetime.utcnow().isoformat()
    )
    payload["synced_at"] = datetime.utcnow().isoformat()
    return payload


@router.post("/sync")
def sync_captures(
    data: CaptureSyncRequest,
    session: Session = Depends(get_session),
):
    """
    Batch sync offline captures. Idempotent via offline_id.
    """
    synced = []
    skipped = []

    if _using_supabase():
        for capture_data in data.captures:
            if capture_data.offline_id:
                existing = supabase.select(
                    "leadcapture",
                    {"offline_id": f"eq.{capture_data.offline_id}", "limit": "1"},
                )
                if existing:
                    skipped.append(capture_data.offline_id)
                    continue

            supabase.insert("leadcapture", _capture_payload(capture_data))
            synced.append(capture_data.offline_id or "no-id")

        return {"synced": len(synced), "skipped_duplicate": len(skipped)}

    for capture_data in data.captures:
        # Dedup check via offline_id
        if capture_data.offline_id:
            existing = session.exec(
                select(LeadCapture).where(LeadCapture.offline_id == capture_data.offline_id)
            ).first()
            if existing:
                skipped.append(capture_data.offline_id)
                continue

        capture = LeadCapture(
            **capture_data.model_dump(exclude={"captured_at"}),
            synced_at=datetime.utcnow(),
            captured_at=capture_data.captured_at or datetime.utcnow(),
        )
        session.add(capture)
        synced.append(capture_data.offline_id or "no-id")

    session.commit()
    return {"synced": len(synced), "skipped_duplicate": len(skipped)}


@router.post("", response_model=LeadCaptureRead)
def create_capture(
    data: LeadCaptureCreate,
    session: Session = Depends(get_session),
):
    """Single online capture."""
    if _using_supabase():
        return supabase.insert("leadcapture", _capture_payload(data))

    capture = LeadCapture(
        **data.model_dump(exclude={"captured_at"}),
        synced_at=datetime.utcnow(),
        captured_at=data.captured_at or datetime.utcnow(),
    )
    session.add(capture)
    session.commit()
    session.refresh(capture)
    return capture


@router.get("", response_model=List[LeadCaptureRead])
def list_captures(
    event_id: Optional[int] = None,
    captured_by: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
):
    if _using_supabase():
        params: dict[str, str] = {
            "order": "captured_at.desc",
            "offset": str(skip),
            "limit": str(limit),
        }
        if event_id:
            params["event_id"] = f"eq.{event_id}"
        if captured_by:
            params["captured_by"] = f"eq.{captured_by}"
        return supabase.select("leadcapture", params)

    query = select(LeadCapture)
    if event_id:
        query = query.where(LeadCapture.event_id == event_id)
    if captured_by:
        query = query.where(LeadCapture.captured_by == captured_by)
    query = query.order_by(LeadCapture.captured_at.desc()).offset(skip).limit(limit)
    return session.exec(query).all()


@router.get("/{capture_id}", response_model=LeadCaptureRead)
def get_capture(capture_id: int, session: Session = Depends(get_session)):
    if _using_supabase():
        capture = supabase.get_by_id("leadcapture", capture_id)
        if not capture:
            raise HTTPException(status_code=404, detail="Capture not found")
        return capture

    capture = session.get(LeadCapture, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")
    return capture


@router.post("/{capture_id}/images", response_model=CaptureImageRead)
async def upload_capture_image(
    capture_id: int,
    file: UploadFile = File(...),
    image_type: str = "photo",
    session: Session = Depends(get_session),
):
    if _using_supabase():
        capture = supabase.get_by_id("leadcapture", capture_id)
        if not capture:
            raise HTTPException(status_code=404, detail="Capture not found")
    else:
        capture = session.get(LeadCapture, capture_id)
        if not capture:
            raise HTTPException(status_code=404, detail="Capture not found")

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{capture_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    image_payload = {
        "capture_id": capture_id,
        "filename": filename,
        "image_type": image_type,
        "file_path": file_path,
        "created_at": datetime.utcnow().isoformat(),
    }

    if _using_supabase():
        return supabase.insert("captureimage", image_payload)

    img = CaptureImage(**image_payload)
    session.add(img)
    session.commit()
    session.refresh(img)
    return img


@router.get("/{capture_id}/images", response_model=List[CaptureImageRead])
def list_capture_images(capture_id: int, session: Session = Depends(get_session)):
    if _using_supabase():
        return supabase.select("captureimage", {"capture_id": f"eq.{capture_id}", "order": "created_at.desc"})

    return session.exec(
        select(CaptureImage).where(CaptureImage.capture_id == capture_id)
    ).all()


@router.get("/images/file/{filename}")
def serve_image(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)
