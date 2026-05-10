"""Generate the RateMyStop sponsor pitch PDF.

4 pages, designer-crafted: cover · mission · the play · sponsorship.
"""
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

FONTS = Path(r"C:\Users\chaya\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\ce9b160f-681b-4959-9bb8-738225cf811e\e793e743-3da9-4b03-a6de-0b673ab761e9\skills\canvas-design\canvas-fonts")
OUTPUT = Path(r"C:\Users\chaya\Downloads\pp\ratemystop\frontend\ratemystop-sponsor-pitch.pdf")

pdfmetrics.registerFont(TTFont("Display",      FONTS / "BigShoulders-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DisplayLight", FONTS / "BigShoulders-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Body",         FONTS / "InstrumentSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("BodyBold",     FONTS / "InstrumentSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("BodyItalic",   FONTS / "InstrumentSans-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Mono",         FONTS / "GeistMono-Regular.ttf"))
pdfmetrics.registerFont(TTFont("MonoBold",     FONTS / "GeistMono-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Serif",        FONTS / "InstrumentSerif-Italic.ttf"))

BG       = HexColor("#0f0f13")
BG_SOFT  = HexColor("#16161d")
GOLD     = HexColor("#e8c547")
GOLD_DIM = HexColor("#8a7228")
WHITE    = HexColor("#f0f0f5")
LIGHT    = HexColor("#c8c8dc")
GRAY     = HexColor("#7a7a90")
GRAY_DIM = HexColor("#3a3a48")
GREEN    = HexColor("#4ec98a")
RED      = HexColor("#e05252")
BLUE     = HexColor("#5b8af0")

PAGE_W, PAGE_H = 1280, 800
M = 72

c = Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H))
c.setTitle("RateMyStop — Sponsorship Vision Deck")
c.setAuthor("RateMyStop")
c.setSubject("Sponsorship — 2026")


def fill_bg():
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def line(x1, y1, x2, y2, color=GOLD, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def reg_marks():
    for (cx, cy) in [(28, 28), (PAGE_W - 28, 28), (28, PAGE_H - 28), (PAGE_W - 28, PAGE_H - 28)]:
        line(cx - 5, cy, cx + 5, cy, GRAY_DIM, 0.4)
        line(cx, cy - 5, cx, cy + 5, GRAY_DIM, 0.4)


def chrome(num: str, eyebrow: str):
    reg_marks()
    c.setFillColor(GOLD)
    c.rect(M, PAGE_H - M + 4, 10, 10, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 8.5)
    c.drawString(M + 18, PAGE_H - M + 6, "RATEMYSTOP")
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 92, PAGE_H - M + 6, "/ a public-accountability platform")

    c.setFillColor(GOLD)
    c.setFont("Mono", 7.5)
    c.drawRightString(PAGE_W - M, PAGE_H - M + 6, num)

    line(M, M - 20, PAGE_W - M, M - 20, GRAY_DIM, 0.4)
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M, M - 32, eyebrow.upper())
    c.setFillColor(GRAY_DIM)
    c.drawRightString(PAGE_W - M, M - 32, "RMS · VISION DECK · 2026")


# ────────── PAGE 1 — COVER ──────────

def page_cover():
    fill_bg()
    chrome("01 / 04", "the cover")

    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(M, M + 110, M + 320, M + 110)

    c.setFillColor(LIGHT)
    c.setFont("Serif", 22)
    c.drawString(M, PAGE_H - M - 90, "On rare occasion, a piece of public infrastructure")
    c.drawString(M, PAGE_H - M - 116, "is missing for so long that everyone forgets to notice.")

    c.setFillColor(WHITE)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 240, "Where do drivers go")

    c.setFillColor(WHITE)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 360, "after the cop")

    c.setFillColor(GOLD)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 480, "drives away?")

    c.setFillColor(WHITE)
    c.setFont("Serif", 26)
    answer = "Now: somewhere."
    c.drawRightString(PAGE_W - M, M + 200, answer)
    aw = c.stringWidth(answer, "Serif", 26)
    line(PAGE_W - M - aw, M + 196, PAGE_W - M, M + 196, GOLD, 1.0)

    c.setFillColor(WHITE)
    c.setFont("Display", 38)
    c.drawString(M, M + 70, "Rate")
    c.setFillColor(GOLD)
    rw = c.stringWidth("Rate", "Display", 38)
    c.drawString(M + rw, M + 70, "MyStop")

    c.setFillColor(GRAY)
    c.setFont("Body", 9)
    c.drawString(M, M + 50, "your stop · your voice · on the record")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 360, M + 76, "FULL DISCLOSURE")
    c.setFillColor(LIGHT)
    c.setFont("BodyItalic", 9)
    c.drawString(M + 360, M + 62, "The site, brand, and product are real.")
    c.drawString(M + 360, M + 50, "The user base and revenue are not — yet.")
    c.drawString(M + 360, M + 38, "This deck is the vision.")

    c.showPage()


# ────────── PAGE 2 — THE MISSION ──────────

def page_mission():
    fill_bg()
    chrome("02 / 04", "the mission")

    # Big mission statement, in three weights
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, PAGE_H - M - 30, "FIG. 01 — THE MISSION, IN PLAIN ENGLISH")

    c.setFillColor(WHITE)
    c.setFont("Display", 88)
    c.drawString(M - 4, PAGE_H - M - 132, "If you got pulled over —")
    c.setFillColor(LIGHT)
    c.setFont("DisplayLight", 88)
    c.drawString(M - 4, PAGE_H - M - 218, "happy or not —")
    c.setFillColor(GOLD)
    c.setFont("Display", 88)
    c.drawString(M - 4, PAGE_H - M - 304, "come tell everyone.")

    # The three behaviors below
    c.setFillColor(LIGHT)
    c.setFont("Body", 13)
    c.drawString(M, PAGE_H - M - 348, "RateMyStop is the public square for traffic stops.")
    c.drawString(M, PAGE_H - M - 368, "Drivers post what happened. The platform structures the rating.")
    c.drawString(M, PAGE_H - M - 388, "Officers' profiles are built — review by review — by the community they serve.")

    # Three columns: How it works
    box_y = M + 130
    box_h = 200
    col_w = (PAGE_W - 2 * M - 32) / 3

    boxes = [
        ("01.", "STOP",     "Driver gets pulled over",     "Happy or not, calm or angry — every stop counts."),
        ("02.", "RATE",     "Open the app, tag what happened",  "Pick fair or unfair. Tag behaviors. Stars are calculated automatically — not subjective."),
        ("03.", "RECORD",   "Post becomes part of officer's profile",   "Verified by ticket photo. Searchable. On the record. Forever."),
    ]
    for i, (idx, name, t1, t2) in enumerate(boxes):
        x = M + i * (col_w + 16)
        # Top hairline
        line(x, box_y + box_h, x + col_w - 18, box_y + box_h, GOLD if i == 0 else GRAY_DIM, 0.5)
        # Index
        c.setFillColor(GOLD)
        c.setFont("Mono", 9)
        c.drawString(x, box_y + box_h - 16, idx)
        # Name
        c.setFillColor(WHITE)
        c.setFont("Display", 38)
        c.drawString(x, box_y + box_h - 64, name)
        # Subtitle
        c.setFillColor(GOLD if i == 0 else LIGHT)
        c.setFont("BodyBold", 12)
        c.drawString(x, box_y + box_h - 92, t1)
        # Body
        c.setFillColor(GRAY)
        c.setFont("Body", 10.5)
        # Wrap manually
        words = t2.split()
        max_w = col_w - 20
        cur, lines = "", []
        for w in words:
            test = (cur + " " + w).strip()
            if c.stringWidth(test, "Body", 10.5) > max_w:
                lines.append(cur); cur = w
            else:
                cur = test
        if cur: lines.append(cur)
        for li, ln in enumerate(lines[:4]):
            c.drawString(x, box_y + box_h - 116 - li * 14, ln)

    c.showPage()


# ────────── PAGE 3 — THE PLAY (with phases) ──────────

def page_play():
    fill_bg()
    chrome("03 / 04", "the play · phases & integrations")

    # Two columns — left is phases, right is ticket-fighter integration
    SPLIT_X = PAGE_W * 0.55
    LEFT_X = M
    RIGHT_X = SPLIT_X + 30
    line(SPLIT_X - 8, M, SPLIT_X - 8, PAGE_H - M, GRAY_DIM, 0.4)

    # ── LEFT — PHASES ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(LEFT_X, PAGE_H - M - 30, "FIG. 02 — THE ROLLOUT, ONE STEP AT A TIME")

    c.setFillColor(WHITE)
    c.setFont("Display", 60)
    c.drawString(LEFT_X - 2, PAGE_H - M - 96, "Today: cops.")
    c.setFillColor(GOLD)
    c.setFont("Display", 60)
    c.drawString(LEFT_X - 2, PAGE_H - M - 152, "Tomorrow: anyone")
    c.drawString(LEFT_X - 2, PAGE_H - M - 208, "in public service.")

    # Phase ladder
    phases = [
        ("PHASE 1", "Police Officers",                                    "Live now. Traffic stops, ratings, complaints.",                "live"),
        ("PHASE 2", "EMTs · Paramedics · Utility (O&R, Con Ed)",          "Response time, professionalism, billing & service issues.",     "next"),
        ("PHASE 3", "Gov't Caseworkers · Inspectors",                      "DMV. Social services. Code, building, health inspections.",    "later"),
        ("PHASE 4", "Public Defenders · Prosecutors · Beyond",             "Courts. Lawyers. Anyone who serves the public.",                "later"),
    ]
    y0 = PAGE_H - M - 252
    row_h = 60
    for i, (phase, name, desc, state) in enumerate(phases):
        y = y0 - i * row_h
        line(LEFT_X, y + 32, SPLIT_X - 24, y + 32, GRAY_DIM if i else GOLD_DIM, 0.4)
        c.setFillColor(GOLD if state == "live" else GRAY)
        c.setFont("MonoBold", 8.5)
        c.drawString(LEFT_X, y + 16, phase)
        # Status pill
        if state == "live":
            c.setFillColor(GOLD)
            c.setFont("Mono", 7.5)
            c.drawString(LEFT_X + 70, y + 16, "● LIVE")
        elif state == "next":
            c.setFillColor(LIGHT)
            c.setFont("Mono", 7.5)
            c.drawString(LEFT_X + 70, y + 16, "○ NEXT")
        else:
            c.setFillColor(GRAY)
            c.setFont("Mono", 7.5)
            c.drawString(LEFT_X + 70, y + 16, "◌ LATER")
        # Name
        c.setFillColor(WHITE if i == 0 else LIGHT)
        c.setFont("BodyBold", 14)
        c.drawString(LEFT_X, y - 4, name)
        # Description
        c.setFillColor(GRAY)
        c.setFont("Body", 10.5)
        c.drawString(LEFT_X, y - 22, desc)

    # Final hairline
    last_y = y0 - len(phases) * row_h
    line(LEFT_X, last_y + 32, SPLIT_X - 24, last_y + 32, GRAY_DIM, 0.4)

    # ── RIGHT — INTEGRATIONS & SMART RATING ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(RIGHT_X, PAGE_H - M - 30, "FIG. 03 — TWO REVENUE PIPES")

    # First pipe — ticket fighters
    c.setFillColor(WHITE)
    c.setFont("Display", 38)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 90, "Ticket-fighter")
    c.setFillColor(GOLD)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 124, "integration.")
    c.setFillColor(LIGHT)
    c.setFont("Body", 11)
    c.drawString(RIGHT_X, PAGE_H - M - 152, "When a driver enters their ticket, the app asks:")
    c.setFillColor(GOLD)
    c.setFont("BodyBold", 12)
    c.drawString(RIGHT_X, PAGE_H - M - 172, "“Want to fight this?”")
    c.setFillColor(LIGHT)
    c.setFont("Body", 11)
    c.drawString(RIGHT_X, PAGE_H - M - 192, "One tap routes the lead to a sponsored attorney.")
    c.drawString(RIGHT_X, PAGE_H - M - 208, "Pre-qualified. Intent-driven. The lawyer pays per case won.")

    # Second pipe — smart rating
    c.setFillColor(WHITE)
    c.setFont("Display", 38)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 274, "Smart auto-")
    c.setFillColor(GOLD)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 308, "rating system.")
    c.setFillColor(LIGHT)
    c.setFont("Body", 11)
    c.drawString(RIGHT_X, PAGE_H - M - 336, "Stars are not asked — they're calculated.")
    c.drawString(RIGHT_X, PAGE_H - M - 352, "The driver tags concrete behaviors —")
    c.setFillColor(GOLD)
    c.setFont("BodyItalic", 11)
    c.drawString(RIGHT_X, PAGE_H - M - 368, "professional · respectful · aggressive · hostile")
    c.setFillColor(LIGHT)
    c.setFont("Body", 11)
    c.drawString(RIGHT_X, PAGE_H - M - 384, "— and the system computes the rating.")
    c.drawString(RIGHT_X, PAGE_H - M - 400, "Less subjective. Less inflation. Better data.")

    # The math callout, very small
    box_y = M + 60
    line(RIGHT_X, box_y + 80, PAGE_W - M, box_y + 80, GOLD_DIM, 0.5)
    c.setFillColor(GOLD)
    c.setFont("Mono", 7)
    c.drawString(RIGHT_X, box_y + 64, "THE FORMULA")
    c.setFillColor(LIGHT)
    c.setFont("Mono", 9)
    c.drawString(RIGHT_X, box_y + 46, "stars = 3 (baseline)  +  verdict (±1)")
    c.drawString(RIGHT_X, box_y + 30, "         +  Σ(behavior weights, ±0.3 to ±1.5)")
    c.setFillColor(GRAY)
    c.setFont("BodyItalic", 10)
    c.drawString(RIGHT_X, box_y + 10, "clamped 1–5. driver can override with one tap.")

    c.showPage()


# ────────── PAGE 4 — TIERS & CONTACT ──────────

def page_tiers():
    fill_bg()
    chrome("04 / 04", "tiers · contact")

    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, PAGE_H - M - 30, "FIG. 04 — TERMS OF ENGAGEMENT")

    c.setFillColor(WHITE)
    c.setFont("Display", 88)
    c.drawString(M - 4, PAGE_H - M - 130, "Three doors.")
    c.setFillColor(GOLD)
    c.setFont("Display", 88)
    c.drawString(M - 4, PAGE_H - M - 212, "Pick yours.")

    tiers = [
        ("BASIC",   "$2K",  "starter",      ["Banner ad in community feed", "Logo in footer", "Monthly traffic report"], False),
        ("CORE",    "$8K",  "recommended",  ["Pop-up when ticket is entered", "Button inside review form", "Sponsored card in feed", "Lead-data dashboard", "Monthly performance report"], True),
        ("PREMIUM", "$18K", "exclusive",    ["Everything in Core", "Sole sponsor — no competition", "Direct intake API integration", "Co-branded marketing", "Quarterly strategy sessions"], False),
    ]

    block_top = PAGE_H - M - 270
    block_h = 320
    n = len(tiers)
    avail = PAGE_W - 2 * M
    col_w = avail / n

    for i, (name, price, tag, perks, featured) in enumerate(tiers):
        x = M + i * col_w
        if i > 0:
            line(x - 6, block_top - block_h + 20, x - 6, block_top - 8, GRAY_DIM, 0.4)
        if featured:
            c.setFillColor(GOLD)
            c.rect(x, block_top + 2, col_w - 30, 2, fill=1, stroke=0)
            c.setFillColor(GOLD)
            c.setFont("MonoBold", 7.5)
            c.drawString(x, block_top - 12, "★ RECOMMENDED")
        else:
            c.setFillColor(GRAY_DIM)
            c.rect(x, block_top + 2, col_w - 30, 1, fill=1, stroke=0)
            c.setFillColor(GRAY)
            c.setFont("Mono", 7.5)
            c.drawString(x, block_top - 12, tag.upper())
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 11)
        c.drawString(x, block_top - 32, name)
        c.setFillColor(GOLD if featured else WHITE)
        c.setFont("Display", 88)
        c.drawString(x - 6, block_top - 130, price)
        pw = c.stringWidth(price, "Display", 88)
        c.setFillColor(GRAY)
        c.setFont("Mono", 11)
        c.drawString(x + pw - 4, block_top - 110, "/mo")

        py = block_top - 168
        for p in perks:
            c.setFillColor(GOLD if featured else GRAY)
            c.setFont("Mono", 8)
            c.drawString(x, py, "—")
            c.setFillColor(LIGHT)
            c.setFont("Body", 10.5)
            c.drawString(x + 14, py, p)
            py -= 18

    bar_y = M + 100
    line(M, bar_y + 40, PAGE_W - M, bar_y + 40, GOLD, 1.0)

    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, bar_y + 22, "OPEN A CONVERSATION")

    c.setFillColor(WHITE)
    c.setFont("BodyBold", 14)
    c.drawString(M, bar_y, "Chaya")
    c.setFillColor(GRAY)
    c.setFont("Body", 11)
    c.drawString(M, bar_y - 18, "founder, RateMyStop")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7.5)
    c.drawString(M + 320, bar_y + 4, "EMAIL")
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 13)
    c.drawString(M + 320, bar_y - 14, "contact@ratemystop.com")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7.5)
    c.drawString(M + 660, bar_y + 4, "WEB")
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 13)
    c.drawString(M + 660, bar_y - 14, "ratemystop.com")

    c.setFillColor(LIGHT)
    c.setFont("Serif", 17)
    c.drawRightString(PAGE_W - M, bar_y - 14, "let's build it.")

    c.showPage()


# ────────── BUILD ──────────

page_cover()
page_mission()
page_play()
page_tiers()

c.save()
print(f"PDF written: {OUTPUT}  ·  {OUTPUT.stat().st_size / 1024:.1f} KB  ·  4 pages")
