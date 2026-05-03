from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ReviewIn(BaseModel):
    verdict: str = Field(pattern="^(fair|unfair)$")
    stars: int = Field(ge=1, le=5)
    reasons: list[str] = []
    behaviors: list[str] = []
    officer_name: Optional[str] = None
    officer_badge: Optional[str] = None
    department: Optional[str] = None
    stop_date: Optional[str] = None
    location: Optional[str] = None
    ticket_type: Optional[str] = None
    ticket_amount: Optional[float] = None
    ticket_violation: Optional[str] = None
    ticket_number: Optional[str] = None
    story: Optional[str] = None
    upload_url: Optional[str] = None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    verdict: str
    stars: int
    story: Optional[str] = None
    location: Optional[str] = None
    ticket_amount: Optional[float] = None
    ticket_violation: Optional[str] = None
    upload_url: Optional[str] = None
    created_at: datetime


class OfficerSummary(BaseModel):
    id: int
    name: Optional[str]
    badge: Optional[str]
    department: Optional[str]
    avg_stars: float
    review_count: int
    fair_count: int
    unfair_count: int


class OfficerDetail(OfficerSummary):
    reviews: list[ReviewOut]


class ComplaintIn(BaseModel):
    recipient_name: str
    recipient_email: Optional[str] = None
    sender_name: Optional[str] = "Anonymous"
    officer_badge_or_name: Optional[str] = None
    incident_date: Optional[str] = None
    body: str = Field(min_length=1, max_length=10000)


class ComplaintOut(BaseModel):
    id: int
    sent_via_email: bool
    created_at: datetime


class StatsOut(BaseModel):
    total_reviews: int
    officer_count: int
    unfair_pct: int
    avg_ticket: Optional[float]


class UploadOut(BaseModel):
    url: str
    filename: str
