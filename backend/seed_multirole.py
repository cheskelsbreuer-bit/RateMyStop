"""Seed non-police moments — EMT, Fire, DMV, Hospital, Gov't — into the
static-data.js bundle so the platform looks balanced across categories.
"""
import json
import os
import random
import re
from pathlib import Path

random.seed(42)

DATA_PATH = Path(r"C:\Users\chaya\Downloads\pp\ratemystop\frontend\static-data.js")

content = DATA_PATH.read_text(encoding="utf-8")
m = re.search(r"window\.STATIC_DATA\s*=\s*(\{.*\});", content, flags=re.DOTALL)
if not m:
    raise SystemExit("No static data found")
bundle = json.loads(m.group(1))
next_id = max(o["id"] for o in bundle["officers"]) + 1

ROLES = {
    "emt": {
        "agencies": [
            "Rockland Paramedic Services", "Spring Valley FD EMS", "Nyack Hospital EMS",
            "FDNY EMS Station 18", "Ramapo EMS", "Hudson Valley Ambulance", "Empress EMS",
        ],
        "titles": ["EMT", "Paramedic", "Lt. Paramedic"],
        "pos": [
            "Showed up in 6 minutes for my mother. Stayed completely calm, explained every step.",
            "My son was choking. They were there in minutes and saved his life. Polite to me even when I was panicking.",
            "Helped my elderly dad off the floor at 3am, no judgment, no rush. Treated him with so much dignity.",
            "Asthma attack at the gym. Two paramedics, both calm and kind. I felt safe immediately.",
            "They de-escalated my panic before treating me. That mattered more than the medicine.",
        ],
        "neg": [
            "Took 22 minutes to arrive in a non-busy area. EMTs seemed annoyed when I asked questions.",
            "Was dismissive about my dad's chest pain. Said it was probably anxiety. It was a cardiac event.",
        ],
        "first_letters": list("ABCDEHJKLMNPRST"),
        "last_names": ["Hernandez", "Patel", "Murphy", "Chen", "Rivera", "Sokolova", "Reilly",
                       "Park", "Cohen", "Brown", "Singh", "Diaz", "Friedman", "Ortega"],
    },
    "fire": {
        "agencies": ["Spring Valley FD", "Hillcrest Hose Co. 1", "Tallman Fire Dept",
                     "Ramapo Valley FD", "Pearl River FD", "FDNY Engine 60", "New City FD"],
        "titles": ["Firefighter", "Lt. Firefighter", "Captain"],
        "pos": [
            "Apartment fire down the hall. They saved my cat and brought her to me wrapped in a blanket.",
            "Cut me out of a wreck on Rt 59. Calm voices the whole time. Made me feel I was in safe hands.",
            "False alarm at 4am. Still polite, still professional. Walked through everything with me.",
            "Brought out my insulin from a flooded basement. Above and beyond, no question.",
        ],
        "neg": [
            "Made me feel like the call was a waste of their time. I had a real concern.",
        ],
        "first_letters": list("ABCDEFGHJKLMNPRST"),
        "last_names": ["Kelly", "Sullivan", "Russo", "Murphy", "Mancuso", "Lehman",
                       "Goldstein", "Diaz", "Reyes", "Walker", "Bauer"],
    },
    "dmv": {
        "agencies": ["NY DMV — Spring Valley", "NY DMV — Yonkers", "NY DMV — Nyack",
                     "NY DMV — White Plains", "NY DMV — Bronx Concourse",
                     "NY DMV — Queens Atlantic Ave", "NY DMV — Manhattan Herald Sq"],
        "titles": ["Clerk", "Senior Clerk", "Window 5", "Window 12"],
        "pos": [
            "Took 2 hours but the woman who finally helped me explained every form. Saved me a second visit.",
            "I was about to lose my mind. She was the only person in the building who smiled at me.",
            "Helped my elderly mom fill out everything. Total patience. We were in and out in 30 min.",
        ],
        "neg": [
            "Snapped at me for asking what form I needed. There were no signs.",
            "Refused to take my paperwork because of a typo I could have fixed in 5 seconds.",
            "Sat at the window scrolling his phone while the line built up. 90-minute wait for a 2-minute transaction.",
            "Told me my photo 'wasn't good enough' — when the issue was the lighting at her station.",
        ],
        "first_letters": list("ABCDEHJKLMNPRST"),
        "last_names": ["Williams", "Rivera", "Anderson", "Goldberg", "Park", "Reyes", "Russo",
                       "Patel", "Diaz", "Schwartz", "Kowalski", "Ortiz", "Wong"],
    },
    "hospital": {
        "agencies": ["Nyack Hospital", "Good Samaritan Suffern", "Westchester Medical Center",
                     "Mt Sinai Bronx", "NYU Langone Manhattan", "Montefiore Bronx"],
        "titles": ["Nurse", "RN", "PA", "Tech", "Admissions"],
        "pos": [
            "Stayed past her shift to make sure I had a ride home. Real human kindness.",
            "I was scared out of my mind before surgery. She held my hand for 5 minutes before they took me in.",
            "Explained the diagnosis in language my dad could actually understand. He still talks about her.",
            "Brought me a warm blanket without being asked. Tiny thing, huge thing.",
        ],
        "neg": [
            "Was in the ER 6 hours, nobody told me anything. Felt like I didn't exist.",
            "Tech was rough drawing blood, no apology when I winced. Two big bruises after.",
        ],
        "first_letters": list("ABCDEFHJKLMNPRST"),
        "last_names": ["Khan", "Nguyen", "Hernandez", "Cohen", "Singh", "Park", "Friedman",
                       "Diaz", "Rivera", "Murphy", "Patel", "Goldberg"],
    },
    "gov": {
        "agencies": ["NYS Tax Dept", "NYC HRA", "NY Dept of Social Services",
                     "Rockland County Clerk", "NYC Housing Authority", "NYC Dept of Health",
                     "NYS Unemployment Office"],
        "titles": ["Caseworker", "Case Manager", "Inspector", "Specialist", "Clerk"],
        "pos": [
            "Walked me through 6 weeks of denied unemployment claims and unlocked it in one phone call.",
            "Inspector found a real problem and stayed an extra 30 minutes explaining how to fix it cheaply.",
            "My caseworker treated me like a human, not a case number.",
        ],
        "neg": [
            "Made me come in 3 separate days for paperwork that could have been one trip.",
            "Caseworker lost my file and then blamed me for it. Took 4 weeks to recover.",
        ],
        "first_letters": list("ABCDEHJKLMNPRSTW"),
        "last_names": ["Adams", "Wright", "Cohen", "Williams", "Patel", "Reyes", "Singh",
                       "Park", "Diaz", "Murphy", "Rivera", "Goldstein", "Lopez"],
    },
}

now_iso = "2026-04-15T14:00:00"


def synth(role_key, count):
    R = ROLES[role_key]
    out = []
    pos_share = 0.78 if role_key in ("emt", "fire") else 0.6 if role_key == "hospital" else 0.42
    global next_id
    for _ in range(count):
        fi = random.choice(R["first_letters"])
        ln = random.choice(R["last_names"])
        title = random.choice(R["titles"])
        name = f"{title} {fi}. {ln}"
        n_reviews = random.choice([1, 2, 2, 3, 4])
        reviews = []
        for j in range(n_reviews):
            is_pos = random.random() < pos_share
            stars = random.choice([4, 5, 5, 5]) if is_pos else random.choice([1, 2, 2, 3])
            story = random.choice(R["pos"] if is_pos else R["neg"])
            reviews.append({
                "id": next_id * 1000 + j,
                "verdict": "fair" if is_pos else "unfair",
                "stars": stars,
                "story": story,
                "location": "",
                "ticket_amount": None,
                "ticket_violation": None,
                "upload_url": None,
                "created_at": now_iso,
            })
        avg = sum(r["stars"] for r in reviews) / len(reviews)
        out.append({
            "id": next_id,
            "name": name,
            "badge": f"#{random.randint(1000, 9999)}",
            "department": random.choice(R["agencies"]),
            "avg_stars": round(avg, 2),
            "review_count": len(reviews),
            "fair_count": sum(1 for r in reviews if r["verdict"] == "fair"),
            "unfair_count": sum(1 for r in reviews if r["verdict"] == "unfair"),
            "reviews": reviews,
        })
        next_id += 1
    return out


# Block re-seeding (idempotent)
existing_names = {o["name"] for o in bundle["officers"]}
emt_count = sum(1 for o in bundle["officers"] if o.get("department", "").lower().startswith(("rockland paramedic", "spring valley fd ems")))
if emt_count > 0:
    print("Non-police data already seeded; skipping.")
    raise SystemExit(0)

new_officers = []
for role in ("emt", "fire", "dmv", "hospital", "gov"):
    new_officers.extend(synth(role, 22))
bundle["officers"].extend(new_officers)

total_reviews = sum(o["review_count"] for o in bundle["officers"])
unfair = sum(o["unfair_count"] for o in bundle["officers"])
bundle["stats"] = {
    "total_reviews": total_reviews,
    "officer_count": len(bundle["officers"]),
    "unfair_pct": round((unfair / total_reviews) * 100) if total_reviews else 0,
    "avg_ticket": bundle["stats"].get("avg_ticket"),
}

DATA_PATH.write_text(
    "// Generated from local DB — used as fallback when no backend is reachable.\n"
    "window.STATIC_DATA = " + json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"Added {len(new_officers)} non-police profiles. Total officers: {len(bundle['officers'])}, total moments: {total_reviews}")
print(f"File size: {os.path.getsize(DATA_PATH) // 1024} KB")
