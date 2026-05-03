"""One-shot seed script. Populates the DB with the demo officers from the original mockup
so the site doesn't look empty on first run. Safe to re-run; skips if data already exists.

Run:  python seed.py
"""
import json
from datetime import datetime, timedelta
from database import Base, engine, SessionLocal
import models

Base.metadata.create_all(bind=engine)

SEED_OFFICERS = [
    {
        "name": "Officer K. Williams", "badge": "#4821", "department": "Spring Valley PD",
        "reviews": [
            {"stars": 2, "verdict": "unfair", "story": "Pulled me over for no clear reason. Was dismissive and issued a $350 ticket without listening.", "ticket_amount": 350, "days_ago": 4},
            {"stars": 1, "verdict": "unfair", "story": "Fourth time this month I've seen complaints about this officer in our neighborhood.", "days_ago": 11},
            {"stars": 3, "verdict": "fair",   "story": "Was professional during the stop, though the ticket felt steep for the violation.", "ticket_amount": 220, "days_ago": 18},
        ],
    },
    {
        "name": "Officer T. Reyes", "badge": "#6103", "department": "Spring Valley PD",
        "reviews": [
            {"stars": 5, "verdict": "fair", "story": "Stopped me for going 10 over. Calm, polite, gave a warning. Exactly how it should be done.", "days_ago": 6},
            {"stars": 5, "verdict": "fair", "story": "Very respectful. Explained everything clearly and let me go with a verbal warning.", "days_ago": 13},
        ],
    },
    {
        "name": "Officer M. Brown", "badge": "#2240", "department": "Spring Valley PD",
        "reviews": [
            {"stars": 1, "verdict": "unfair", "story": "$480 ticket for a windshield crack I didn't know about. Zero flexibility.", "ticket_amount": 480, "days_ago": 8},
            {"stars": 2, "verdict": "unfair", "story": "Seemed to be looking for any excuse to write a ticket.", "days_ago": 15},
        ],
    },
    {
        "name": "Officer S. Park", "badge": "#3310", "department": "Spring Valley PD",
        "reviews": [
            {"stars": 4, "verdict": "fair", "story": "Fair stop. A bit slow but professional throughout.", "days_ago": 10},
        ],
    },
]


def main():
    db = SessionLocal()
    try:
        if db.query(models.Officer).count() > 0:
            print("Officers already exist — skipping seed.")
            return
        now = datetime.utcnow()
        for entry in SEED_OFFICERS:
            o = models.Officer(name=entry["name"], badge=entry["badge"], department=entry["department"])
            db.add(o)
            db.flush()
            for r in entry["reviews"]:
                db.add(models.Review(
                    officer_id=o.id,
                    verdict=r["verdict"],
                    stars=r["stars"],
                    story=r.get("story"),
                    ticket_amount=r.get("ticket_amount"),
                    reasons=json.dumps([]),
                    behaviors=json.dumps([]),
                    created_at=now - timedelta(days=r.get("days_ago", 0)),
                ))
        db.commit()
        print(f"Seeded {len(SEED_OFFICERS)} officers.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
