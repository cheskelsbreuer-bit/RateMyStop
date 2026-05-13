"""Generate the CivicVoice pitch PDF — 3 pages, plain-English, family/early-partner version.

The deck opens with a simple scenario (2am EMT) and walks through what the
platform is, how it works, what's built today, and what we need.
No ticket-fighter referrals. No fancy jargon. Just the idea, told straight.
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

# Light palette
BG       = HexColor("#fafaf7")
BG_SOFT  = HexColor("#f3f3ee")
CARD     = HexColor("#ffffff")
GOLD     = HexColor("#b8941e")
GOLD_DIM = HexColor("#d4b13a")
GOLD_BG  = HexColor("#fef9e7")
INK      = HexColor("#1a1a1d")
LIGHT    = HexColor("#3d3d45")
GRAY     = HexColor("#7a7a82")
GRAY_DIM = HexColor("#c9c9d0")
GREEN    = HexColor("#1f8c5f")
RED      = HexColor("#c93434")
BLUE     = HexColor("#2563d9")

PAGE_W, PAGE_H = 1280, 800
M = 72

c = Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H))
c.setTitle("CivicVoice — A simple idea")
c.setAuthor("CivicVoice")
c.setSubject("Partnership conversation — 2026")


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
    c.setFillColor(INK)
    c.setFont("BodyBold", 8.5)
    c.drawString(M + 18, PAGE_H - M + 6, "CIVICVOICE")
    c.setFillColor(GOLD)
    c.setFont("Mono", 7.5)
    c.drawRightString(PAGE_W - M, PAGE_H - M + 6, num)
    line(M, M - 20, PAGE_W - M, M - 20, GRAY_DIM, 0.4)
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M, M - 32, eyebrow.upper())
    c.setFillColor(GRAY_DIM)
    c.drawRightString(PAGE_W - M, M - 32, "CHESKY · PARTNERSHIP DECK")


def wrap(text: str, font: str, size: float, max_w: float):
    """Word-wrap helper."""
    words = text.split()
    cur, lines = "", []
    for w in words:
        test = (cur + " " + w).strip()
        if c.stringWidth(test, font, size) > max_w and cur:
            lines.append(cur); cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines


# ────────── PAGE 1 — COVER ──────────
def page_cover():
    fill_bg()
    chrome("01 / 03", "the idea")

    # Gold rule
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(M, M + 110, M + 320, M + 110)

    # Soft intro line, top of page
    c.setFillColor(LIGHT)
    c.setFont("Serif", 22)
    c.drawString(M, PAGE_H - M - 90, "A simple idea, told straight.")

    # The headline — bigger, plainer
    c.setFillColor(INK)
    c.setFont("Display", 130)
    c.drawString(M - 4, PAGE_H - M - 230, "Give a")
    c.setFillColor(GOLD)
    c.setFont("Display", 130)
    c.drawString(M - 4, PAGE_H - M - 350, "thumbs up.")

    c.setFillColor(INK)
    c.setFont("Display", 130)
    c.drawString(M - 4, PAGE_H - M - 470, "Or raise a")
    c.setFillColor(INK)
    c.setFont("Display", 130)
    c.drawString(M - 4, PAGE_H - M - 590, "question.")

    # Tagline anchored bottom-right
    c.setFillColor(INK)
    c.setFont("Serif", 26)
    answer = "Either way — it goes on the record."
    c.drawRightString(PAGE_W - M, M + 180, answer)
    aw = c.stringWidth(answer, "Serif", 26)
    line(PAGE_W - M - aw, M + 176, PAGE_W - M, M + 176, GOLD, 1.0)

    # Wordmark
    c.setFillColor(INK)
    c.setFont("Display", 38)
    c.drawString(M, M + 70, "Civic")
    c.setFillColor(GOLD)
    cw = c.stringWidth("Civic", "Display", 38)
    c.drawString(M + cw, M + 70, "Voice")
    c.setFillColor(GRAY)
    c.setFont("Body", 9.5)
    c.drawString(M, M + 50, "Police  ·  EMT  ·  Fire  ·  DMV  ·  Hospital  ·  Government")

    # Honest disclosure
    c.setFillColor(GRAY)
    c.setFont("Mono", 7)
    c.drawString(M + 460, M + 76, "WHERE WE ARE")
    c.setFillColor(LIGHT)
    c.setFont("BodyItalic", 9.5)
    c.drawString(M + 460, M + 62, "The platform is built and live.")
    c.drawString(M + 460, M + 48, "The user base is what we're raising for.")
    c.drawString(M + 460, M + 34, "We're still in beta — everything can change.")

    c.showPage()


# ────────── PAGE 2 — THE IDEA, IN PLAIN ENGLISH ──────────
def page_idea():
    fill_bg()
    chrome("02 / 03", "the idea, in plain english")

    # Big headline
    c.setFillColor(INK)
    c.setFont("Display", 64)
    c.drawString(M - 4, PAGE_H - M - 110, "It's 2 a.m.")
    c.setFillColor(GOLD)
    c.setFont("Display", 64)
    c.drawString(M - 4, PAGE_H - M - 174, "An EMT shows up to help your mother.")

    # Story body
    body_lines = [
        "They are calm. They are fast. They are kind.",
        "You want to thank them.",
        "Where do you go?",
        "",
        "Today: nowhere. You tell your family. Maybe a Google review. Maybe nothing.",
        "",
        "CivicVoice is where you go. You open the site. You say what happened.",
        "The story becomes part of a public record. The agency — the EMS service, the fire",
        "department, the DMV office — sees it. Sometimes they reply: “we’re proud of our team —",
        "we’ll let them know.” Sometimes they say nothing. Either way, it’s there.",
    ]
    y = PAGE_H - M - 230
    c.setFillColor(LIGHT)
    c.setFont("Body", 14)
    for ln in body_lines:
        c.drawString(M, y, ln)
        y -= 22

    # The flip side, in a soft block
    c.setFillColor(GOLD_BG)
    block_top = M + 220
    block_h = 130
    c.roundRect(M, block_top, PAGE_W - 2 * M, block_h, 14, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M + 22, block_top + block_h - 24, "THE FLIP SIDE")
    c.setFillColor(INK)
    c.setFont("BodyBold", 16)
    c.drawString(M + 22, block_top + block_h - 50, "Same thing works the other way.")
    c.setFillColor(LIGHT)
    c.setFont("Body", 12.5)
    flip_lines = [
        "If someone didn’t do a great job, you can say so. The agency can answer (or not).",
        "The public sees both. The good gets recognized. The bad gets recorded.",
    ]
    fy = block_top + block_h - 80
    for ln in flip_lines:
        c.drawString(M + 22, fy, ln)
        fy -= 18

    # Final line — the mission, plain
    c.setFillColor(INK)
    c.setFont("Display", 26)
    c.drawString(M, M + 90, "That’s it. Recognize. Document. ")
    pw = c.stringWidth("That’s it. Recognize. Document. ", "Display", 26)
    c.setFillColor(GOLD)
    c.setFont("Display", 26)
    c.drawString(M + pw, M + 90, "On the record.")

    c.showPage()


# ────────── PAGE 3 — WHAT'S BUILT + WHAT WE NEED ──────────
def page_built():
    fill_bg()
    chrome("03 / 03", "what we built · what we need")

    # Headline
    c.setFillColor(INK)
    c.setFont("Display", 60)
    c.drawString(M - 4, PAGE_H - M - 100, "What’s already working today.")

    # Two columns
    LEFT_X = M
    SPLIT_X = PAGE_W * 0.50
    RIGHT_X = SPLIT_X + 24
    line(SPLIT_X - 12, M, SPLIT_X - 12, PAGE_H - M - 130, GRAY_DIM, 0.4)

    # ── LEFT — what's built ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(LEFT_X, PAGE_H - M - 150, "BUILT · LIVE · USABLE TODAY")

    built = [
        ("Six categories live",       "Police, EMT, Fire, DMV, Hospital, Government."),
        ("Sign in safely",            "Google, GitHub, or email. Post anonymously with a stable handle."),
        ("Real moderation",           "Stories don’t auto-publish. Each one is reviewed."),
        ("Verified agency replies",   "Agency staff sign in with their work email; replies show a checkmark."),
        ("Resolution tracking",       "Every story shows: Open · Acknowledged · Resolved."),
        ("Trust score per person",    "Built from how each contributor has used the site."),
        ("Photo privacy",             "Faces and plates can be blurred in your browser before upload."),
        ("Works like an app",         "Install to your home screen on iPhone or Android."),
    ]
    y = PAGE_H - M - 184
    for title, sub in built:
        c.setFillColor(GOLD)
        c.setFont("Mono", 8)
        c.drawString(LEFT_X, y, "✓")
        c.setFillColor(INK)
        c.setFont("BodyBold", 12.5)
        c.drawString(LEFT_X + 18, y, title)
        c.setFillColor(GRAY)
        c.setFont("Body", 10.5)
        c.drawString(LEFT_X + 18, y - 14, sub)
        y -= 40

    # ── RIGHT — what's next + what we need ──
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(RIGHT_X, PAGE_H - M - 150, "WHAT’S NEXT")

    next_items = [
        ("Real backend",          "Move from local storage to a real database so submissions persist."),
        ("First 100 stories",     "Get real people to share real moments. This is the real work."),
        ("Agency dashboards",     "Eventually agencies pay to track sentiment across their teams."),
        ("Custom domain",         "civicvoice.com when we’re ready."),
    ]
    y = PAGE_H - M - 184
    for title, sub in next_items:
        c.setFillColor(GOLD)
        c.setFont("Mono", 8)
        c.drawString(RIGHT_X, y, "→")
        c.setFillColor(INK)
        c.setFont("BodyBold", 12.5)
        c.drawString(RIGHT_X + 18, y, title)
        c.setFillColor(GRAY)
        c.setFont("Body", 10.5)
        c.drawString(RIGHT_X + 18, y - 14, sub)
        y -= 40

    # Help block
    help_top = y - 12
    c.setFillColor(GOLD_BG)
    c.roundRect(RIGHT_X, help_top - 100, PAGE_W - M - RIGHT_X, 100, 12, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(RIGHT_X + 20, help_top - 24, "HOW YOU CAN HELP")
    c.setFillColor(INK)
    c.setFont("Body", 11)
    help_lines = [
        "•  Try it. Tell us what’s confusing.",
        "•  Share it with someone who’d post a real story.",
        "•  Tell us what we’re missing.",
    ]
    hy = help_top - 44
    for ln in help_lines:
        c.drawString(RIGHT_X + 20, hy, ln)
        hy -= 16

    # Bottom contact bar
    bar_y = M + 70
    line(M, bar_y + 36, PAGE_W - M, bar_y + 36, GOLD, 1.0)
    c.setFillColor(GOLD)
    c.setFont("Mono", 8)
    c.drawString(M, bar_y + 18, "CONTACT")
    c.setFillColor(INK)
    c.setFont("BodyBold", 14)
    c.drawString(M, bar_y - 2, "Chesky")
    c.setFillColor(GRAY)
    c.setFont("Body", 11)
    c.drawString(M, bar_y - 20, "founder, CivicVoice")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7.5)
    c.drawString(M + 320, bar_y + 4, "EMAIL")
    c.setFillColor(INK)
    c.setFont("BodyBold", 13)
    c.drawString(M + 320, bar_y - 14, "chesky2039@gmail.com")

    c.setFillColor(GRAY)
    c.setFont("Mono", 7.5)
    c.drawString(M + 660, bar_y + 4, "LIVE SITE")
    c.setFillColor(INK)
    c.setFont("BodyBold", 13)
    c.drawString(M + 660, bar_y - 14, "cheskelsbreuer-bit.github.io/RateMyStop")

    c.setFillColor(LIGHT)
    c.setFont("Serif", 16)
    c.drawRightString(PAGE_W - M, bar_y - 14, "still in beta — everything can change.")

    c.showPage()


def page_vision():
    fill_bg()
    chrome("04 / 04", "where this is going")

    c.setFillColor(INK)
    c.setFont("Display", 56)
    c.drawString(M - 4, PAGE_H - M - 100, "Where this is going.")

    c.setFillColor(GRAY)
    c.setFont("Body", 13)
    c.drawString(M - 4, PAGE_H - M - 130, "The next year, in plain English. Soon / Next / Big.")

    # Three horizontal bands — same plain-English voice as the rest of the deck
    bands = [
        ("SOON · 3–6 MONTHS",
         "Agency review-request links.",
         "After a 911 call, an ER visit, a DMV appointment — the agency sends a one-tap anonymous review link to the people who were there. Like a restaurant asking for a Google review, except it's your fire department. This is the single biggest growth lever: agencies become the distribution.",
         GOLD),
        ("NEXT · 6–18 MONTHS",
         "Profiles up the pyramid.",
         "School board, council, mayor are live today. Next: governor, state senate, congress, the president. Higher-level officials get \"claim this profile\" placeholders until they (or their office) verify — keeps the record fair and avoids empty-profile trolling.",
         INK),
        ("BIG · YEAR TWO",
         "Polls, takes, and public-affairs ratings.",
         "Live now in basic form: people self-ID (Republican / Democrat / Independent), then rate questions like \"Should East Ramapo reverse the busing change?\" or \"Will Congress pass a budget without a shutdown?\" Polymarket-style, no money. Built so 50,000 takes happen here instead of in a Gallup phone call.",
         GREEN if 'GREEN' in dir() else INK),
    ]

    y = PAGE_H - M - 180
    for tag, head, body, color in bands:
        c.setFillColor(GOLD)
        c.setFont("Mono", 8)
        c.drawString(M - 4, y, tag)
        c.setFillColor(INK)
        c.setFont("Display", 22)
        c.drawString(M - 4, y - 28, head)
        c.setFillColor(GRAY)
        c.setFont("Body", 11)
        # Wrap body to ~95 chars per line
        from textwrap import wrap
        wrapped = wrap(body, width=95)
        for i, ln in enumerate(wrapped):
            c.drawString(M - 4, y - 50 - (i * 14), ln)
        y -= 50 + (len(wrapped) * 14) + 24
        line(M - 4, y + 8, PAGE_W - M, y + 8, GRAY_DIM, 0.4)

    # Footer bar
    bar_y = M + 30
    line(M, bar_y, PAGE_W - M, bar_y, INK, 0.8)
    c.setFillColor(INK)
    c.setFont("BodyBold", 10)
    c.drawString(M, bar_y - 14, "civicvoice")
    c.setFillColor(GRAY)
    c.setFont("Body", 10)
    c.drawString(M + 80, bar_y - 14, "recognize the good · document the rest · on the record")

# ────────── BUILD ──────────
page_cover()
page_idea()
page_built()
page_vision()

c.save()
print(f"PDF written: {OUTPUT}  ·  {OUTPUT.stat().st_size / 1024:.1f} KB  ·  4 pages")
