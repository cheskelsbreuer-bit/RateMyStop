"""Generate the RateMyStop sponsor pitch PDF.

3 pages. Punchy. Designer-crafted. Asymmetric grids, dramatic negative space,
oversized numerals, hand-tuned spacing.

Civic Brutalism, refined.
"""
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

# Paths
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
GOLD_GLOW= HexColor("#5a4a18")
WHITE    = HexColor("#f0f0f5")
LIGHT    = HexColor("#c8c8dc")
GRAY     = HexColor("#7a7a90")
GRAY_DIM = HexColor("#3a3a48")
GRAY_FAINT = HexColor("#22222b")

# Landscape, slightly taller than 16:9 (more poster-like)
PAGE_W, PAGE_H = 1280, 800
M = 72  # generous margin

c = Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H))
c.setTitle("RateMyStop — Sponsorship Vision")
c.setAuthor("RateMyStop")
c.setSubject("Sponsorship — 2026")


# ────────── primitives ──────────

def fill_bg():
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def line(x1, y1, x2, y2, color=GOLD, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def reg_marks():
    """Tiny corner registration marks — a typographic detail that signals craft."""
    for (cx, cy) in [(28, 28), (PAGE_W - 28, 28), (28, PAGE_H - 28), (PAGE_W - 28, PAGE_H - 28)]:
        line(cx - 5, cy, cx + 5, cy, GRAY_DIM, 0.4)
        line(cx, cy - 5, cx, cy + 5, GRAY_DIM, 0.4)


def chrome(num: str, eyebrow: str):
    """Constant page frame. Kept extremely quiet — almost invisible."""
    reg_marks()
    # Top-left mark
    c.setFillColor(GOLD)
    c.rect(M, PAGE_H - M + 4, 10, 10, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 8.5)
    c.drawString(M + 18, PAGE_H - M + 6, "RATEMYSTOP")
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 92, PAGE_H - M + 6, "/ a public-accountability platform")

    # Top-right page indicator
    c.setFillColor(GOLD)
    c.setFont("Mono", 7.5)
    c.drawRightString(PAGE_W - M, PAGE_H - M + 6, num)

    # Bottom: page-spanning faint hairline
    line(M, M - 20, PAGE_W - M, M - 20, GRAY_DIM, 0.4)
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M, M - 32, eyebrow.upper())
    c.setFillColor(GRAY_DIM)
    c.drawRightString(PAGE_W - M, M - 32, "RMS · VISION DECK · 2026")


# ────────── PAGE 1 — COVER ──────────

def page_cover():
    fill_bg()

    # A single dramatic gold rule running diagonally down the page (left-third)
    # No — keep it horizontal, very low. Tension lives in the asymmetry of the words above it.
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(M, M + 110, M + 320, M + 110)

    chrome("01 / 03", "the cover")

    # ── A shy serif overture, off to one side ──
    c.setFillColor(LIGHT)
    c.setFont("Serif", 22)
    c.drawString(M, PAGE_H - M - 90, "On rare occasion, a piece of public infrastructure")
    c.drawString(M, PAGE_H - M - 116, "is missing for so long that everyone forgets to notice.")

    # ── Massive single-line statement, the punchline ──
    headline = "Where do drivers go"
    c.setFillColor(WHITE)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 240, headline)

    headline2 = "after the cop"
    c.setFillColor(WHITE)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 360, headline2)

    headline3 = "drives away?"
    c.setFillColor(GOLD)
    c.setFont("Display", 138)
    c.drawString(M - 6, PAGE_H - M - 480, headline3)

    # Answer — small, italic, anchored bottom-right
    c.setFillColor(WHITE)
    c.setFont("Serif", 26)
    answer = "Now: somewhere."
    c.drawRightString(PAGE_W - M, M + 200, answer)
    # Underline beneath
    aw = c.stringWidth(answer, "Serif", 26)
    line(PAGE_W - M - aw, M + 196, PAGE_W - M, M + 196, GOLD, 1.0)

    # Footer block — wordmark + disclosure
    c.setFillColor(WHITE)
    c.setFont("Display", 38)
    c.drawString(M, M + 70, "Rate")
    c.setFillColor(GOLD)
    rw = c.stringWidth("Rate", "Display", 38)
    c.drawString(M + rw, M + 70, "MyStop")

    c.setFillColor(GRAY)
    c.setFont("Body", 9)
    c.drawString(M, M + 50, "your stop · your voice · on the record")

    # Disclosure (right side, tiny)
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 360, M + 76, "FULL DISCLOSURE")
    c.setFillColor(LIGHT)
    c.setFont("BodyItalic", 9)
    c.drawString(M + 360, M + 62, "The site, brand, and product are real.")
    c.drawString(M + 360, M + 50, "The user base and revenue are not — yet.")
    c.drawString(M + 360, M + 38, "This deck is the vision.")

    c.showPage()


# ────────── PAGE 2 — THE PITCH ──────────

def page_pitch():
    fill_bg()
    chrome("02 / 03", "the pitch · the play")

    # Left column: the headline + the supporting claim
    # Right column: stats + the future-state list
    LEFT_X = M
    SPLIT_X = PAGE_W * 0.52
    RIGHT_X = SPLIT_X + 40

    # Vertical hairline between columns
    line(SPLIT_X - 10, M, SPLIT_X - 10, PAGE_H - M, GRAY_DIM, 0.4)

    # ── LEFT — THE PROBLEM AS A LINE ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(LEFT_X, PAGE_H - M - 30, "FIG. 01 — THE PROBLEM")

    c.setFillColor(WHITE)
    c.setFont("Display", 78)
    c.drawString(LEFT_X - 4, PAGE_H - M - 110, "50 million")
    c.drawString(LEFT_X - 4, PAGE_H - M - 178, "stops a year.")
    c.drawString(LEFT_X - 4, PAGE_H - M - 250, "Zero ")
    zw = c.stringWidth("Zero ", "Display", 78)
    c.setFillColor(GOLD)
    c.drawString(LEFT_X - 4 + zw, PAGE_H - M - 250, "Yelp.")

    # Body underneath
    c.setFillColor(LIGHT)
    c.setFont("Body", 13)
    c.drawString(LEFT_X, PAGE_H - M - 300, "Every year, 50 million Americans get pulled over.")
    c.drawString(LEFT_X, PAGE_H - M - 320, "Most walk away holding a $280 ticket they can't dispute.")
    c.drawString(LEFT_X, PAGE_H - M - 340, "Until now, no one was building the place to talk back.")

    # Three little stat callouts at the bottom-left
    stat_y = M + 80
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(LEFT_X, stat_y + 90, "FIG. 02 — THE NUMBERS")

    def small_stat(idx, big, label):
        x = LEFT_X + idx * 160
        c.setFillColor(GOLD)
        c.setFont("Display", 56)
        c.drawString(x, stat_y + 24, big)
        c.setFillColor(GRAY)
        c.setFont("Mono", 7.5)
        c.drawString(x, stat_y + 12, label)

    small_stat(0, "50M+",   "STOPS / YEAR")
    small_stat(1, "$280",   "AVG TICKET")
    small_stat(2, "100%",   "INTENT-DRIVEN")

    line(LEFT_X, stat_y + 78, LEFT_X + 470, stat_y + 78, GOLD_DIM, 0.5)

    # ── RIGHT — THE PLAY (TODAY · TOMORROW) ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(RIGHT_X, PAGE_H - M - 30, "FIG. 03 — THE BIGGER PLAY")

    c.setFillColor(WHITE)
    c.setFont("Display", 56)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 90, "Today: cops.")
    c.setFillColor(GOLD)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 142, "Tomorrow: everyone")
    c.setFillColor(GOLD)
    c.drawString(RIGHT_X - 2, PAGE_H - M - 194, "in public service.")

    # The registry — a clean numbered ladder
    cats = [
        ("01",  "Police Officers",            "live"),
        ("02",  "EMTs & Paramedics",          "phase 2"),
        ("03",  "Utility Workers — O&R, Con Ed", "phase 2"),
        ("04",  "Gov't Caseworkers — DMV, Social Services", "phase 3"),
        ("05",  "Code & Health Inspectors",   "phase 3"),
        ("06",  "Public Defenders, Prosecutors", "phase 4"),
    ]
    y0 = PAGE_H - M - 240
    row_h = 32
    for i, (idx, name, phase) in enumerate(cats):
        y = y0 - i * row_h
        # hairline above
        line(RIGHT_X, y + 12, PAGE_W - M, y + 12, GRAY_DIM if i else GOLD_DIM, 0.4)
        c.setFillColor(GOLD if i == 0 else GRAY)
        c.setFont("Mono", 8)
        c.drawString(RIGHT_X, y - 4, idx)
        c.setFillColor(WHITE if i == 0 else LIGHT)
        c.setFont("BodyBold", 14)
        c.drawString(RIGHT_X + 32, y - 4, name)
        c.setFillColor(GOLD if phase == "live" else GRAY)
        c.setFont("Mono", 8)
        c.drawRightString(PAGE_W - M, y - 4, phase.upper())
    # Final hairline + continuation whisper
    last_y = y0 - len(cats) * row_h
    line(RIGHT_X, last_y + 12, PAGE_W - M, last_y + 12, GRAY_DIM, 0.4)
    c.setFillColor(GRAY_DIM)
    c.setFont("Mono", 7)
    c.drawString(RIGHT_X, last_y - 2, "07 ⋯⋯⋯⋯⋯ the registry continues")

    # Bottom-right closing line
    c.setFillColor(WHITE)
    c.setFont("DisplayLight", 22)
    c.drawString(RIGHT_X, M + 60, "One platform.")
    c.setFillColor(WHITE)
    c.drawString(RIGHT_X, M + 36, "Every public servant.")
    c.setFillColor(GOLD)
    c.setFont("Display", 22)
    c.drawString(RIGHT_X + 230, M + 36, "Real accountability.")

    c.showPage()


# ────────── PAGE 3 — TIERS & CONTACT ──────────

def page_tiers():
    fill_bg()
    chrome("03 / 03", "tiers · contact")

    # Top headline — asymmetric, leaning left
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, PAGE_H - M - 30, "FIG. 04 — TERMS OF ENGAGEMENT")

    c.setFillColor(WHITE)
    c.setFont("Display", 96)
    c.drawString(M - 4, PAGE_H - M - 140, "Three doors.")
    c.setFillColor(GOLD)
    c.setFont("Display", 96)
    c.drawString(M - 4, PAGE_H - M - 230, "Pick yours.")

    # Three minimal tier "rails" instead of cards — flatter, more designer
    tiers = [
        ("BASIC",   "$2K",  "starter",      ["Banner ad in community feed", "Logo in footer", "Monthly traffic report"], False),
        ("CORE",    "$8K",  "recommended",  ["Pop-up when ticket is entered", "Button inside review form", "Sponsored card in feed", "Lead-data dashboard", "Monthly performance report"], True),
        ("PREMIUM", "$18K", "exclusive",    ["Everything in Core", "Sole sponsor — no competition", "Direct intake API integration", "Co-branded marketing", "Quarterly strategy sessions"], False),
    ]

    # Layout: three columns, each 320 wide, equally spaced
    block_top = PAGE_H - M - 280
    block_h = 320
    n = len(tiers)
    avail = PAGE_W - 2 * M
    col_w = avail / n

    for i, (name, price, tag, perks, featured) in enumerate(tiers):
        x = M + i * col_w
        # Vertical separator (between tiers, not on outer edges)
        if i > 0:
            line(x - 6, block_top - block_h + 20, x - 6, block_top - 8, GRAY_DIM, 0.4)

        # Featured stripe at the very top
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

        # Tier name — small caps
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 11)
        c.drawString(x, block_top - 32, name)

        # Massive price
        c.setFillColor(GOLD if featured else WHITE)
        c.setFont("Display", 92)
        c.drawString(x - 6, block_top - 130, price)
        # /mo
        pw = c.stringWidth(price, "Display", 92)
        c.setFillColor(GRAY)
        c.setFont("Mono", 11)
        c.drawString(x + pw - 4, block_top - 110, "/mo")

        # Perks — clean text rows
        c.setFillColor(LIGHT)
        c.setFont("Body", 10.5)
        py = block_top - 168
        for p in perks:
            c.setFillColor(GOLD if featured else GRAY)
            c.setFont("Mono", 8)
            c.drawString(x, py, "—")
            c.setFillColor(LIGHT)
            c.setFont("Body", 10.5)
            c.drawString(x + 14, py, p)
            py -= 18

    # Bottom: a single calm contact bar
    bar_y = M + 100
    line(M, bar_y + 40, PAGE_W - M, bar_y + 40, GOLD, 1.0)

    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, bar_y + 22, "OPEN A CONVERSATION")

    # Three columns within the bar
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

    # Tagline — italic, quiet, far right
    c.setFillColor(LIGHT)
    c.setFont("Serif", 17)
    c.drawRightString(PAGE_W - M, bar_y - 14, "let's build it.")

    c.showPage()


# ────────── BUILD ──────────

page_cover()
page_pitch()
page_tiers()

c.save()
print(f"PDF written: {OUTPUT}  ·  {OUTPUT.stat().st_size / 1024:.1f} KB  ·  3 pages")
