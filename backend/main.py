import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from config import settings
from database import Base, engine, get_db
from email_sender import send_complaint_email
import models
import schemas

# Create tables
Base.metadata.create_all(bind=engine)

# Ensure upload dir exists
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="RateMyStop API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


# ───────────────────────── Helpers ─────────────────────────

def find_or_create_officer(
    db: Session,
    name: Optional[str],
    badge: Optional[str],
    department: Optional[str],
) -> Optional[models.Officer]:
    """Match by badge first, then by case-insensitive name. Create if not found."""
    if not (name or badge):
        return None
    q = db.query(models.Officer)
    officer = None
    if badge:
        officer = q.filter(func.lower(models.Officer.badge) == badge.lower()).first()
    if not officer and name:
        officer = q.filter(func.lower(models.Officer.name) == name.lower()).first()
    if officer:
        # Patch in any missing fields
        if not officer.department and department:
            officer.department = department
        if not officer.badge and badge:
            officer.badge = badge
        if not officer.name and name:
            officer.name = name
        return officer
    officer = models.Officer(name=name, badge=badge, department=department)
    db.add(officer)
    db.flush()
    return officer


def officer_summary(o: models.Officer) -> dict:
    reviews = o.reviews
    if reviews:
        avg = sum(r.stars for r in reviews) / len(reviews)
    else:
        avg = 0.0
    return {
        "id": o.id,
        "name": o.name,
        "badge": o.badge,
        "department": o.department,
        "avg_stars": round(avg, 2),
        "review_count": len(reviews),
        "fair_count": sum(1 for r in reviews if r.verdict == "fair"),
        "unfair_count": sum(1 for r in reviews if r.verdict == "unfair"),
    }


# ───────────────────────── Routes ─────────────────────────

@app.get("/")
def root():
    return {"name": "RateMyStop API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/officers", response_model=list[schemas.OfficerSummary])
def list_officers(db: Session = Depends(get_db)):
    officers = db.query(models.Officer).order_by(models.Officer.created_at.desc()).all()
    return [officer_summary(o) for o in officers]


@app.get("/api/officers/{officer_id}", response_model=schemas.OfficerDetail)
def get_officer(officer_id: int, db: Session = Depends(get_db)):
    o = db.query(models.Officer).filter(models.Officer.id == officer_id).first()
    if not o:
        raise HTTPException(404, "Officer not found")
    summary = officer_summary(o)
    summary["reviews"] = [
        {
            "id": r.id,
            "verdict": r.verdict,
            "stars": r.stars,
            "story": r.story,
            "location": r.location,
            "ticket_amount": r.ticket_amount,
            "ticket_violation": r.ticket_violation,
            "upload_url": r.upload_url,
            "created_at": r.created_at,
        }
        for r in o.reviews
    ]
    return summary


@app.post("/api/reviews", response_model=schemas.ReviewOut)
def submit_review(payload: schemas.ReviewIn, db: Session = Depends(get_db)):
    officer = find_or_create_officer(
        db, payload.officer_name, payload.officer_badge, payload.department
    )
    review = models.Review(
        officer_id=officer.id if officer else None,
        verdict=payload.verdict,
        stars=payload.stars,
        reasons=json.dumps(payload.reasons or []),
        behaviors=json.dumps(payload.behaviors or []),
        stop_date=payload.stop_date,
        location=payload.location,
        ticket_type=payload.ticket_type,
        ticket_amount=payload.ticket_amount,
        ticket_violation=payload.ticket_violation,
        ticket_number=payload.ticket_number,
        story=payload.story,
        upload_url=payload.upload_url,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@app.post("/api/uploads", response_model=schemas.UploadOut)
async def upload_file(file: UploadFile = File(...)):
    max_bytes = settings.max_upload_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(413, f"File too large (max {settings.max_upload_mb}MB)")
    if len(contents) == 0:
        raise HTTPException(400, "Empty file")

    suffix = Path(file.filename or "").suffix.lower()
    allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".heic"}
    if suffix and suffix not in allowed:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    new_name = f"{uuid.uuid4().hex}{suffix or ''}"
    dest = Path(settings.upload_dir) / new_name
    with open(dest, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{new_name}", "filename": file.filename or new_name}


@app.post("/api/complaints", response_model=schemas.ComplaintOut)
async def file_complaint(payload: schemas.ComplaintIn, db: Session = Depends(get_db)):
    complaint = models.Complaint(
        recipient_name=payload.recipient_name,
        recipient_email=payload.recipient_email,
        sender_name=payload.sender_name or "Anonymous",
        officer_badge_or_name=payload.officer_badge_or_name,
        incident_date=payload.incident_date,
        body=payload.body,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Try to send via Resend
    subject = f"[RateMyStop] Complaint regarding {payload.officer_badge_or_name or 'an officer'}"
    body_text = (
        f"From: {payload.sender_name or 'Anonymous'}\n"
        f"Officer: {payload.officer_badge_or_name or '—'}\n"
        f"Date of incident: {payload.incident_date or '—'}\n"
        f"\n--- Complaint ---\n{payload.body}\n"
        f"\nSent via RateMyStop."
    )
    sent, err = await send_complaint_email(payload.recipient_email or "", subject, body_text)
    complaint.sent_via_email = sent
    complaint.email_error = err
    db.commit()

    return {
        "id": complaint.id,
        "sent_via_email": complaint.sent_via_email,
        "created_at": complaint.created_at,
    }


@app.get("/api/stats", response_model=schemas.StatsOut)
def get_stats(db: Session = Depends(get_db)):
    total_reviews = db.query(func.count(models.Review.id)).scalar() or 0
    unfair_count = db.query(func.count(models.Review.id)).filter(models.Review.verdict == "unfair").scalar() or 0
    officer_count = db.query(func.count(models.Officer.id)).scalar() or 0
    avg_ticket = db.query(func.avg(models.Review.ticket_amount)).scalar()
    unfair_pct = round((unfair_count / total_reviews) * 100) if total_reviews else 0
    return {
        "total_reviews": total_reviews,
        "officer_count": officer_count,
        "unfair_pct": unfair_pct,
        "avg_ticket": float(avg_ticket) if avg_ticket else None,
    }


# Optional: if you want to serve the frontend from the same Python process for simple deploys.
# Set SERVE_FRONTEND=1 and place ../frontend next to ./backend.
if os.getenv("SERVE_FRONTEND") == "1":
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    if frontend_dir.exists():
        @app.get("/{full_path:path}")
        def serve_frontend(full_path: str):
            target = frontend_dir / (full_path or "index.html")
            if target.is_file():
                return FileResponse(target)
            return FileResponse(frontend_dir / "index.html")
