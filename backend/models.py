from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Officer(Base):
    __tablename__ = "officers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), index=True)
    badge = Column(String(50), index=True)
    department = Column(String(200), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviews = relationship("Review", back_populates="officer", cascade="all, delete-orphan", order_by="Review.created_at.desc()")


class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    officer_id = Column(Integer, ForeignKey("officers.id", ondelete="CASCADE"), nullable=True, index=True)
    verdict = Column(String(10), nullable=False)  # 'fair' | 'unfair'
    stars = Column(Integer, nullable=False)
    reasons = Column(Text, default="")    # JSON-encoded list
    behaviors = Column(Text, default="")  # JSON-encoded list
    stop_date = Column(String(20))
    location = Column(String(300))
    ticket_type = Column(String(20))
    ticket_amount = Column(Float)
    ticket_violation = Column(String(300))
    ticket_number = Column(String(100))
    story = Column(Text)
    upload_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    officer = relationship("Officer", back_populates="reviews")


class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True)
    recipient_name = Column(String(200))
    recipient_email = Column(String(200))
    sender_name = Column(String(200))
    officer_badge_or_name = Column(String(200))
    incident_date = Column(String(20))
    body = Column(Text)
    sent_via_email = Column(Boolean, default=False)
    email_error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
