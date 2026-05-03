"""Seeds ~100 realistic officer profiles with reviews across multiple Rockland/NYC area
departments. Idempotent: skips if there are already > 50 officers in the DB.

Run: python seed_bulk.py
"""
import json
import random
from datetime import datetime, timedelta
from database import Base, engine, SessionLocal
import models

Base.metadata.create_all(bind=engine)

random.seed(42)

FIRST_INITIALS = list("ABCDEFGHIJKLMNOPRSTW")
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Cohen", "Goldberg", "Friedman", "Schwartz", "Levine", "Cruz",
    "Reyes", "Ortiz", "Vasquez", "Castro", "Morales", "Diaz", "Rivera", "Romano",
    "Russo", "Bianchi", "Marino", "Esposito", "Park", "Kim", "Patel", "Singh", "Shah",
    "Murphy", "O'Brien", "Kelly", "Sullivan", "Brennan", "Cooper", "Ross", "Bennett",
    "Morgan", "Bailey", "Reed", "Murphy", "Howard", "Foster", "Cole",
]

DEPARTMENTS = [
    ("Spring Valley PD",          0.40),
    ("Ramapo PD",                 0.18),
    ("Clarkstown PD",             0.12),
    ("Town of Haverstraw PD",     0.06),
    ("Suffern PD",                0.05),
    ("NYS Police - Troop F",      0.07),
    ("NYPD - 50th Precinct",      0.04),
    ("NYPD - 47th Precinct",      0.03),
    ("Rockland County Sheriff",   0.05),
]

REASONS = ["Speeding", "Red Light", "Phone Use", "Equipment Issue", "Stop Sign",
           "Unclear to Me", "Seemed Random", "Tinted Windows", "Expired Registration"]
BEHAVIORS_FAIR = ["Professional", "Respectful", "Quick & Fair", "Calm"]
BEHAVIORS_UNFAIR = ["Aggressive", "Dismissive", "Talked Too Much", "Hostile", "Rude"]

UNFAIR_STORIES = [
    "Pulled me over for no clear reason. Wouldn't tell me why for the first 3 minutes.",
    "Tinted-window stop, but my windows are factory tint. Wrote me a $250 ticket anyway.",
    "Stopped me leaving the gas station. Said I 'looked suspicious.'",
    "Officer was on his phone the whole time and barely looked at my license.",
    "Got a $480 ticket for a windshield crack I didn't even know was there. Zero flexibility.",
    "Was rude from the second he walked up. Asked me three times if there were drugs in the car.",
    "Stopped me right after I left a friend's house at 1am. No moving violation cited at all.",
    "Said I rolled a stop sign — the camera footage shows I came to a full stop.",
    "Wrote me up for 'failure to maintain lane' even though I was clearly inside the lines.",
    "Stop happened in the middle of a busy intersection. Felt unsafe the whole time.",
    "Cursed at me when I asked why I was being stopped. Threatened to tow my car for no reason.",
    "Pulled me over for going 5 over the limit. Wrote a $220 ticket and lectured me for 10 minutes.",
    "Refused to give me his badge number when I asked. Said 'it's on the ticket.'",
    "Searched my car without asking after I declined consent. Said he 'smelled marijuana' — I don't smoke.",
    "Stop lasted 45 minutes. Made me sit on the curb in the rain.",
    "Insulted my passenger and questioned what we were doing in 'this neighborhood.'",
]

FAIR_STORIES = [
    "Stopped me for a brake light out. Polite, gave me a fix-it ticket, sent me on my way.",
    "Was going 8 over. Officer was professional, gave me a verbal warning. Exactly how it should go.",
    "Speeding stop. Calm and respectful, explained the violation clearly.",
    "Pulled me over for an expired registration sticker. Was understanding, just told me to renew.",
    "Stopped at a checkpoint. Quick, courteous, on my way in 90 seconds.",
    "Tail-light ticket. He was nice about it and even offered to follow me to a service station.",
    "Stop sign violation — fair cop. Honestly I rolled it. Officer was respectful.",
    "Speeding ticket. The stop itself was professional. I disagree with the speed reading but he was respectful.",
    "Pulled me over for a phone violation. I was using it. Quick stop, verbal warning.",
    "Rolling stop on a quiet street. Officer was friendly, gave a warning, no ticket.",
    "Got a ticket for an expired inspection. Officer was polite throughout.",
    "Speeding stop on 287. Trooper was extremely professional, in and out in under 10 minutes.",
]

LOCATIONS = [
    "Main St & Route 59, Spring Valley", "Route 45 near Maple Ave",
    "S Pascack Rd, Spring Valley", "I-287 westbound near exit 14",
    "Route 9W, Stony Point", "Main St, Nyack", "Route 304, New City",
    "Spook Rock Rd, Suffern", "Tappan Zee Bridge approach",
    "Route 17 northbound, Ramapo", "Bardonia Rd, Bardonia",
    "Saddle River Rd, Airmont", "Maple Ave, Spring Valley",
    "Route 202, Suffern", "College Rd near Rockland Community College",
]


def pick_dept() -> str:
    r, cum = random.random(), 0.0
    for name, w in DEPARTMENTS:
        cum += w
        if r <= cum:
            return name
    return DEPARTMENTS[-1][0]


def make_officer(badge_num: int) -> dict:
    name = f"Officer {random.choice(FIRST_INITIALS)}. {random.choice(LAST_NAMES)}"
    return {
        "name": name,
        "badge": f"#{badge_num}",
        "department": pick_dept(),
    }


def make_review(verdict: str) -> dict:
    if verdict == "fair":
        story = random.choice(FAIR_STORIES)
        stars = random.choice([3, 4, 4, 4, 5, 5, 5])
        ticket_amt = random.choice([None, None, 100, 150, 180, 220])
    else:
        story = random.choice(UNFAIR_STORIES)
        stars = random.choice([1, 1, 1, 2, 2, 3])
        ticket_amt = random.choice([None, 220, 280, 350, 350, 480, 525])

    return {
        "verdict": verdict,
        "stars": stars,
        "story": story,
        "ticket_amount": ticket_amt,
        "ticket_violation": random.choice([None, "1180(b) - Speeding", "1110(a) - Failure to obey",
                                          "375(2) - Equipment", "1142(a) - Stop sign"]) if ticket_amt else None,
        "location": random.choice(LOCATIONS),
        "reasons": random.sample(REASONS, random.randint(1, 2)),
        "behaviors": random.sample(BEHAVIORS_FAIR if verdict == "fair" else BEHAVIORS_UNFAIR,
                                   random.randint(1, 2)),
        "days_ago": random.randint(1, 90),
    }


def main():
    db = SessionLocal()
    try:
        existing = db.query(models.Officer).count()
        if existing > 50:
            print(f"Already have {existing} officers - skipping bulk seed.")
            return

        target = 100
        now = datetime.utcnow()
        used_badges = {row[0] for row in db.query(models.Officer.badge).all() if row[0]}
        # Generate 100 distinct officers
        created = 0
        attempts = 0
        while created < target and attempts < 1000:
            attempts += 1
            badge_num = random.randint(1000, 9999)
            badge_str = f"#{badge_num}"
            if badge_str in used_badges:
                continue
            used_badges.add(badge_str)
            o_data = make_officer(badge_num)
            officer = models.Officer(**o_data)
            db.add(officer)
            db.flush()

            # 1 to 6 reviews each, weighted toward 1-3
            n_reviews = random.choice([1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 6])
            # Some officers skew fair, some skew unfair, some balanced
            unfair_rate = random.choice([0.1, 0.2, 0.3, 0.5, 0.5, 0.7, 0.8, 0.9])
            for _i in range(n_reviews):
                verdict = "unfair" if random.random() < unfair_rate else "fair"
                r = make_review(verdict)
                db.add(models.Review(
                    officer_id=officer.id,
                    verdict=r["verdict"],
                    stars=r["stars"],
                    story=r["story"],
                    ticket_amount=r["ticket_amount"],
                    ticket_violation=r["ticket_violation"],
                    location=r["location"],
                    reasons=json.dumps(r["reasons"]),
                    behaviors=json.dumps(r["behaviors"]),
                    created_at=now - timedelta(days=r["days_ago"], hours=random.randint(0, 23)),
                ))
            created += 1

        db.commit()
        print(f"Seeded {created} officers (total reviews added: {db.query(models.Review).count()}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
