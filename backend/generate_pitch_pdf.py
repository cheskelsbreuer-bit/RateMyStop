"""Generate the CivicVoice sponsor pitch PDF.

4 pages: cover · mission · the play · sponsorship.
Civic Brutalism design philosophy, refined.
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
c.setTitle("CivicVoice — Sponsorship Vision Deck")
c.setAuthor("CivicVoice")
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
    c.drawString(M + 18, PAGE_H - M + 6, "CIVICVOICE")
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 90, PAGE_H - M + 6, "/ your voice on every public servant")

    c.setFillColor(GOLD)
    c.setFont("Mono", 7.5)
    c.drawRightString(PAGE_W - M, PAGE_H - M + 6, num)

    line(M, M - 20, PAGE_W - M, M - 20, GRAY_DIM, 0.4)
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M, M - 32, eyebrow.upper())
    c.setFillColor(GRAY_DIM)
    c.drawRightString(PAGE_W - M, M - 32, "CV · VISION DECK · 2026")


# ────────── PAGE 1 — COVER ──────────
def page_cover():
    fill_bg()
    chrome("01 / 04", "the cover")

    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(M, M + 110, M + 320, M + 110)

    c.setFillColor(LIGHT)
    c.setFont("Serif", 22)
    c.drawString(M, PAGE_H - M - 90, "Every day, people interact with public servants")
    c.drawString(M, PAGE_H - M - 116, "during the most stressful moments of their lives.")

    c.setFillColor(WHITE)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 240, "Some moments")

    c.setFillColor(WHITE)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 360, "deserve thanks.")

    c.setFillColor(GOLD)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 480, "Some, the record.")

    c.setFillColor(WHITE)
    c.setFont("Serif", 26)
    answer = "Both belong somewhere."
    c.drawRightString(PAGE_W - M, M + 200, answer)
    aw = c.stringWidth(answer, "Serif", 26)
    line(PAGE_W - M - aw, M + 196, PAGE_W - M, M + 196, GOLD, 1.0)

    c.setFillColor(WHITE)
    c.setFont("Display", 38)
    c.drawString(M, M + 70, "Civic")
    c.setFillColor(GOLD)
    cw = c.stringWidth("Civic", "Display", 38)
    c.drawString(M + cw, M + 70, "Voice")

    c.setFillColor(GRAY)
    c.setFont("Body", 9)
    c.drawString(M, M + 50, "your voice · on every public servant")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 360, M + 76, "FULL DISCLOSURE")
    c.setFillColor(LIGHT)
    c.setFont("BodyItalic", 9)
    c.drawString(M + 360, M + 62, "The platform, brand, and product are real.")
    c.drawString(M + 360, M + 50, "The user base and revenue are not — yet.")
    c.drawString(M + 360, M + 38, "This deck is the vision.")

    c.showPage()


# ────────── PAGE 2 — THE MISSION ──────────
def page_mission():
    fill_bg()
    chrome("02 / 04", "the mission")

    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, PAGE_H - M - 30, "FIG. 01 — THE MISSION, IN PLAIN ENGLISH")

    c.setFillColor(WHITE)
    c.setFont("Display", 78)
    c.drawString(M - 4, PAGE_H - M - 120, "Recognize good service.")
    c.setFillColor(LIGHT)
    c.setFont("DisplayLight", 78)
    c.drawString(M - 4, PAGE_H - M - 198, "Document the rest.")
    c.setFillColor(GOLD)
    c.setFont("Display", 78)
    c.drawString(M - 4, PAGE_H - M - 276, "On the record.")

    c.setFillColor(LIGHT)
    c.setFont("Body", 13)
    c.drawString(M, PAGE_H - M - 326, "Every day, millions of people interact with public servants — police, EMTs, firefighters,")
    c.drawString(M, PAGE_H - M - 346, "DMV staff, code inspectors, hospital workers. Most experiences are forgotten.")
    c.drawString(M, PAGE_H - M - 366, "The good ones, never recognized. The bad ones, never recorded.")
    c.setFillColor(GOLD)
    c.setFont("BodyBold", 13)
    c.drawString(M, PAGE_H - M - 388, "CivicVoice is where both go on the record.")

    # Three flow steps
    box_y = M + 130
    box_h = 200
    col_w = (PAGE_W - 2 * M - 32) / 3

    boxes = [
        ("01.", "MOMENT",   "An interaction with a public servant", "A traffic stop. An EMT call. A DMV visit. A code inspection."),
        ("02.", "LOG",      "Open the app and tell what happened",  "Praise the good. Document the bad. Tag the behavior. Add a photo to verify."),
        ("03.", "RECORD",   "It joins the public record",           "Searchable by location, role, agency. Departments can respond. Patterns emerge."),
    ]
    for i, (idx, name, t1, t2) in enumerate(boxes):
        x = M + i * (col_w + 16)
        line(x, box_y + box_h, x + col_w - 18, box_y + box_h, GOLD if i == 0 else GRAY_DIM, 0.5)
        c.setFillColor(GOLD)
        c.setFont("Mono", 9)
        c.drawString(x, box_y + box_h - 16, idx)
        c.setFillColor(WHITE)
        c.setFont("Display", 38)
        c.drawString(x, box_y + box_h - 64, name)
        c.setFillColor(GOLD if i == 0 else LIGHT)
        c.setFont("BodyBold", 12)
        c.drawString(x, box_y + box_h - 92, t1)
        c.setFillColor(GRAY)
        c.setFont("Body", 10.5)
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


# ────────── PAGE 3 — THE PLAY (categories & money) ──────────
def page_play():
    fill_bg()
    chrome("03 / 04", "the play · categories & revenue")

    SPLIT_X = PAGE_W * 0.52
    LEFT_X = M
    RIGHT_X = SPLIT_X + 30
    line(SPLIT_X - 8, M, SPLIT_X - 8, PAGE_H - M, GRAY_DIM, 0.4)

    # ── LEFT — CATEGORY ROLLOUT ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(LEFT_X, PAGE_H - M - 30, "FIG. 02 — THE ROLLOUT")

    c.setFillColor(WHITE)
    c.setFont("Display", 56)
    c.drawString(LEFT_X - 2, PAGE_H - M - 92, "Police is the wedge.")
    c.setFillColor(GOLD)
    c.setFont("Display", 56)
    c.drawString(LEFT_X - 2, PAGE_H - M - 148, "Everyone else,")
    c.drawString(LEFT_X - 2, PAGE_H - M - 204, "the expansion.")
    c.setFillColor(LIGHT)
    c.setFont("Body", 11.5)
    c.drawString(LEFT_X, PAGE_H - M - 232, "Traffic stops are emotional, frequent, and pre-organized.")
    c.drawString(LEFT_X, PAGE_H - M - 250, "Once the platform is dense, every role follows.")

    phases = [
        ("PHASE 1", "Police Officers",        "Traffic stops · complaints · recognition", "live"),
        ("PHASE 2", "EMT · Fire · DMV",       "Positive-only first. Lower legal risk, builds the hero feed.", "next"),
        ("PHASE 3", "Code · Court · Transit", "Full reviews open. Moderation + verification mature.", "later"),
        ("PHASE 4", "Hospitals & beyond",     "Every public-facing role under one record.", "later"),
    ]
    y0 = PAGE_H - M - 290
    row_h = 50
    for i, (phase, name, desc, state) in enumerate(phases):
        y = y0 - i * row_h
        line(LEFT_X, y + 26, SPLIT_X - 24, y + 26, GRAY_DIM if i else GOLD_DIM, 0.4)
        c.setFillColor(GOLD if state == "live" else GRAY)
        c.setFont("MonoBold", 8.5)
        c.drawString(LEFT_X, y + 12, phase)
        if state == "live":
            c.setFillColor(GOLD)
            c.setFont("Mono", 7.5)
            c.drawString(LEFT_X + 70, y + 12, "● LIVE")
        elif state == "next":
            c.setFillColor(LIGHT)
            c.setFont("Mono", 7.5)
            c.drawString(LEFT_X + 70, y + 12, "○ NEXT")
        else:
            c.setFillColor(GRAY)
            c.setFont("Mono", 7.5)
            c.drawString(LEFT_X + 70, y + 12, "◌ LATER")
        c.setFillColor(WHITE if i == 0 else LIGHT)
        c.setFont("BodyBold", 13)
        c.drawString(LEFT_X, y - 6, name)
        c.setFillColor(GRAY)
        c.setFont("Body", 10)
        c.drawString(LEFT_X, y - 22, desc)
    last_y = y0 - len(phases) * row_h
    line(LEFT_X, last_y + 26, SPLIT_X - 24, last_y + 26, GRAY_DIM, 0.4)

    # ── RIGHT — REVENUE STACK ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(RIGHT_X, PAGE_H - M - 30, "FIG. 03 — FIVE REVENUE STREAMS")

    c.setFillColor(WHITE)
    c.setFont("Display", 56)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 92, "Not one")
    c.setFillColor(GOLD)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 148, "revenue pipe.")
    c.setFillColor(WHITE)
    c.setFont("Display", 56)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 204, "Five.")

    revenues = [
        ("DAY 1",    "Ticket-fighter referrals",       "$50-$300 per lead · $5K-$20K/mo"),
        ("MONTH 3+", "Department sentiment dashboards", "B2B SaaS · $500-$2K/mo per dept"),
        ("MONTH 6+", "Civic partnerships",              "Counties · cities · agencies"),
        ("YEAR 1+",  "API & data licensing",            "Journalists · researchers · advocacy orgs"),
        ("ALWAYS",   "Premium user features",           "Alerts · saved reports · history"),
    ]
    ry0 = PAGE_H - M - 250
    rrow = 40
    for i, (when, what, where) in enumerate(revenues):
        y = ry0 - i * rrow
        line(RIGHT_X, y + 20, PAGE_W - M, y + 20, GRAY_DIM, 0.4)
        c.setFillColor(GOLD)
        c.setFont("Mono", 7.5)
        c.drawString(RIGHT_X, y + 8, when)
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 12.5)
        c.drawString(RIGHT_X + 78, y + 8, what)
        c.setFillColor(GRAY)
        c.setFont("Body", 9.5)
        c.drawString(RIGHT_X + 78, y - 6, where)
    last_y = ry0 - len(revenues) * rrow
    line(RIGHT_X, last_y + 20, PAGE_W - M, last_y + 20, GRAY_DIM, 0.4)

    c.setFillColor(LIGHT)
    c.setFont("BodyItalic", 11)
    c.drawString(RIGHT_X, M + 50, "Lawyer leads pay today. B2B pays tomorrow. Both stack.")

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
        ("CORE",    "$8K",  "recommended",  ["Pop-up when a ticket is logged", "Button inside review form", "Sponsored card in feed", "Lead-data dashboard", "Monthly performance report"], True),
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
    c.drawString(M, bar_y, "Chesky")
    c.setFillColor(GRAY)
    c.setFont("Body", 11)
    c.drawString(M, bar_y - 18, "founder, CivicVoice")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7.5)
    c.drawString(M + 320, bar_y + 4, "EMAIL")
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 13)
    c.drawString(M + 320, bar_y - 14, "chesky2039@gmail.com")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7.5)
    c.drawString(M + 660, bar_y + 4, "WEB")
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 13)
    c.drawString(M + 660, bar_y - 14, "civicvoice.com")

    c.setFillColor(LIGHT)
    c.setFont("Serif", 17)
    c.drawRightString(PAGE_W - M, bar_y - 14, "let's build it.")

    c.showPage()


page_cover()
page_mission()
page_play()
page_tiers()

c.save()
print(f"PDF written: {OUTPUT}  ·  {OUTPUT.stat().st_size / 1024:.1f} KB  ·  4 pages")
