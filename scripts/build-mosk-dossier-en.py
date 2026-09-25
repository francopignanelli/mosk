"""Build MOSK's concise English product dossier (four A4 pages)."""

from __future__ import annotations

from pathlib import Path
import shutil

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "MOSK_product_dossier_EN.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "docs" / OUTPUT.name
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

FONT_DIR = Path("C:/Windows/Fonts")
if (FONT_DIR / "segoeui.ttf").exists() and (FONT_DIR / "segoeuib.ttf").exists():
    pdfmetrics.registerFont(TTFont("Segoe", str(FONT_DIR / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("Segoe-Bold", str(FONT_DIR / "segoeuib.ttf")))
    pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe-Bold")
    FONT, BOLD = "Segoe", "Segoe-Bold"
else:
    FONT, BOLD = "Helvetica", "Helvetica-Bold"

W, H = A4
M = 42
CW = W - 2 * M
INK = colors.HexColor("#393242")
MUTED = colors.HexColor("#706779")
LIGHT = colors.HexColor("#91899a")
PURPLE = colors.HexColor("#8665b5")
PURPLE_DARK = colors.HexColor("#68498f")
LAV = colors.HexColor("#f4f0fa")
PANEL = colors.HexColor("#fbf9fd")
LINE = colors.HexColor("#e6dfed")
GREEN = colors.HexColor("#6f9f8a")
GREEN_PALE = colors.HexColor("#edf6f1")
BLUE = colors.HexColor("#79a8bd")
BLUE_PALE = colors.HexColor("#edf5f8")
ORANGE = colors.HexColor("#c99b63")
ORANGE_PALE = colors.HexColor("#fbf4ea")
ROSE = colors.HexColor("#b67c88")
ROSE_PALE = colors.HexColor("#faeff2")
DARK = colors.HexColor("#30283d")


def text(c, content, x, top, width, *, size=9.2, leading=None, color=INK,
         bold=False, max_height=None):
    style = ParagraphStyle(
        "copy", fontName=BOLD if bold else FONT, fontSize=size,
        leading=leading or size * 1.42, textColor=color, alignment=TA_LEFT,
        spaceBefore=0, spaceAfter=0, allowWidows=0, allowOrphans=0,
    )
    paragraph = Paragraph(content, style)
    _, height = paragraph.wrap(width, 2000)
    if max_height is not None and height > max_height + 0.1:
        raise ValueError(f"Text overflow ({height:.1f} > {max_height:.1f}): {content[:80]}")
    paragraph.drawOn(c, x, top - height)
    return top - height


def rounded(c, x, y, width, height, *, fill=colors.white, stroke=LINE, radius=12):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def rule(c, x1, y, x2, color=LINE):
    c.setStrokeColor(color)
    c.setLineWidth(0.8)
    c.line(x1, y, x2, y)


def pill(c, label, x, y, *, fill=LAV, color=PURPLE_DARK):
    size = 7.3
    width = pdfmetrics.stringWidth(label, BOLD, size) + 20
    c.setFillColor(fill)
    c.roundRect(x, y, width, 21, 10, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(BOLD, size)
    c.drawString(x + 10, y + 7, label)
    return width


def fly(c, x, y, scale=1):
    c.saveState()
    c.translate(x, y)
    c.scale(scale, scale)
    c.setStrokeColor(PURPLE)
    c.setLineWidth(1.25)
    c.setFillColor(colors.HexColor("#e8ddf3"))
    c.ellipse(-25, -1, -1, 16, fill=1, stroke=1)
    c.ellipse(1, -1, 25, 16, fill=1, stroke=1)
    c.setFillColor(PURPLE_DARK)
    c.ellipse(-5, -12, 5, 12, fill=1, stroke=0)
    c.circle(0, 16, 4.4, fill=1, stroke=0)
    for side in (-1, 1):
        c.line(side * 3, -2, side * 14, -15)
        c.line(side * 3, -7, side * 11, -19)
    c.restoreState()


def spider(c, x, y, scale=1):
    c.saveState()
    c.translate(x, y)
    c.scale(scale, scale)
    c.setStrokeColor(ROSE)
    c.setLineWidth(1.5)
    for side in (-1, 1):
        for i in (-1, 0, 1, 2):
            c.line(i * 3, side * 2, i * 5, side * 12)
    c.setFillColor(ROSE)
    c.ellipse(-9, -5, 4, 5, fill=1, stroke=0)
    c.restoreState()


def chrome(c, page, section):
    c.setFillColor(colors.HexColor("#fdfcff"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(PURPLE)
    c.roundRect(M, H - 56, 27, 21, 6, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(BOLD, 9)
    c.drawCentredString(M + 13.5, H - 49, "M")
    c.setFillColor(PURPLE_DARK)
    c.setFont(BOLD, 7.6)
    c.drawString(M + 39, H - 49, "MOSK  /  PRODUCT DOSSIER")
    c.setFillColor(LIGHT)
    c.setFont(FONT, 7.3)
    c.drawRightString(W - M, H - 49, section.upper())
    rule(c, M, H - 68, W - M)
    rule(c, M, 58, W - M)
    c.setFont(FONT, 7.3)
    c.setFillColor(LIGHT)
    c.drawString(M, 42, "FRANCO PIGNANELLI  /  SEPTEMBER 2026")
    c.drawRightString(W - M, 42, f"{page:02d} / 04")


def header(c, page, section, title, subtitle):
    chrome(c, page, section)
    c.setFont(BOLD, 22)
    c.setFillColor(INK)
    c.drawString(M, H - 109, title)
    text(c, subtitle, M, H - 125, CW, size=9.2, color=MUTED, max_height=39)


def link(c, label, url, x, y, width):
    c.setFont(FONT, 8.2)
    c.setFillColor(PURPLE_DARK)
    c.drawString(x, y, label)
    c.linkURL(url, (x, y - 3, x + width, y + 10), relative=0)


def page_one(c):
    chrome(c, 1, "an interactive research experience")
    c.setFillColor(LAV)
    c.circle(W - 29, H - 221, 171, fill=1, stroke=0)
    pill(c, "BRAIN RESEARCH, MADE EXPLORABLE", M, H - 116)
    c.setFillColor(INK)
    c.setFont(BOLD, 52)
    c.drawString(M - 2, H - 188, "MOSK")
    text(c, "A small life, unfolding.", M, H - 209, 270, size=18, bold=True,
         max_height=29)
    text(c,
         "What happens when a published brain map becomes a question you can test on screen? "
         "MOSK is an interactive observatory: follow one virtual fruit fly, change its world, "
         "and inspect the signals behind each visible response.",
         M, H - 256, 258, size=10.4, leading=15.2, max_height=112)

    # Decorative scene echoes the app's soft map and dark neural panel.
    rounded(c, 337, 337, 216, 305, fill=DARK, stroke=DARK, radius=21)
    c.setFillColor(colors.HexColor("#bda9d4"))
    c.setFont(BOLD, 7.5)
    c.drawString(355, 614, "ONE WORLD / MANY OBSERVATIONS")
    for x, y, radius, shade in [
        (392, 534, 30, "#465363"), (467, 493, 45, "#3b4851"),
        (407, 422, 29, "#485663"), (503, 397, 31, "#4d4657"),
    ]:
        c.setFillColor(colors.HexColor(shade))
        c.circle(x, y, radius, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor("#9d86c3"))
    c.setLineWidth(1.5)
    c.setDash(3, 5)
    path = c.beginPath()
    path.moveTo(378, 397)
    path.curveTo(438, 395, 397, 480, 451, 499)
    path.curveTo(491, 516, 493, 545, 513, 558)
    c.drawPath(path)
    c.setDash()
    fly(c, 448, 501, 0.72)
    spider(c, 395, 416, 0.8)
    for x, y, col in [(386, 545, GREEN), (506, 548, ORANGE), (494, 388, BLUE)]:
        c.setFillColor(col)
        c.circle(x, y, 5, fill=1, stroke=0)
    rule(c, 355, 370, 535, colors.HexColor("#5a4b6c"))
    c.setFont(FONT, 7.3)
    c.setFillColor(colors.HexColor("#c9bcd6"))
    c.drawString(355, 351, "SENSE  >  DECIDE  >  MOVE  >  RECORD")

    c.setFillColor(MUTED)
    c.setFont(BOLD, 7.6)
    c.drawString(M, 314, "THE PRODUCT IN THREE MOVES")
    labels = [
        ("01  OBSERVE", "Watch the fly explore a world that unfolds around it.", LAV, PURPLE_DARK),
        ("02  INTERVENE", "Place food, water or a spider and compare what changes.", BLUE_PALE, BLUE),
        ("03  EXPLAIN", "Read controller signals, life events and real source annotations.", GREEN_PALE, GREEN),
    ]
    gap = 11
    card_w = (CW - 2 * gap) / 3
    for i, (label, body, fill, accent) in enumerate(labels):
        x = M + i * (card_w + gap)
        rounded(c, x, 184, card_w, 113, fill=fill, stroke=LINE)
        c.setFillColor(accent)
        c.setFont(BOLD, 8)
        c.drawString(x + 14, 271, label)
        text(c, body, x + 14, 256, card_w - 28, size=9.2, max_height=67)

    rounded(c, M, 93, CW, 72, fill=colors.white, stroke=LINE)
    text(c,
         "<b>A clear scientific boundary.</b> The fly on screen is an authored simulation. "
         "Google Research and collaborators published anatomical wiring data, not a ready-made "
         "virtual animal. MOSK makes that research approachable while preserving the distinction.",
         M + 17, 149, CW - 34, size=9.3, max_height=53)
    c.showPage()


def page_two(c):
    header(c, 2, "science & interpretation", "The research beneath the experience",
           "Three related layers serve different purposes. Their provenance is visible throughout MOSK.")

    rounded(c, M, 465, 247, 217, fill=LAV)
    pill(c, "PUBLISHED  /  MALECNS", M + 15, 646)
    text(c, "Google and collaborators mapped the male fly's central nervous system.",
         M + 15, 626, 217, size=12.6, bold=True, max_height=54)
    text(c,
         "The <i>Cell</i> study describes <b>166,691 neurons</b> across brain and ventral nerve "
         "cord, with roughly <b>125 million synaptic contacts</b>. The released structural map "
         "supports tracing sensory-to-motor paths and comparing cell types; it is not a "
         "recording of a living fly's activity.",
         M + 15, 563, 217, size=9, max_height=89)

    rounded(c, 306, 465, 247, 217, fill=GREEN_PALE)
    pill(c, "IN MOSK  /  SOURCE ATLAS", 321, 646, fill=colors.white, color=GREEN)
    text(c, "A real anatomical sample you can inspect.",
         321, 626, 217, size=12.6, bold=True, max_height=54)
    text(c,
         "The MaleCNS atlas contains <b>96 source-identified annotation records</b> "
         "with cell labels, classes and provenance. Visitors can search and inspect them. "
         "It does not bundle the full connection graph or make those cells control the "
         "roaming fly.",
         321, 563, 217, size=9, max_height=89)

    c.setFillColor(MUTED)
    c.setFont(BOLD, 7.6)
    c.drawString(M, 439, "THREE LAYERS, CLEARLY LABELED")
    rounded(c, M, 286, CW, 138, fill=DARK, stroke=DARK)
    layer_specs = [
        ("01", "Anatomy", "Real MaleCNS identifiers and cell annotations.", "#d5b9f0"),
        ("02", "Roaming", "A designed, interpretable 18-channel controller.", "#add6c5"),
        ("03", "Memory", "A separate published mushroom-body assay.", "#f0cfad"),
    ]
    layer_w = (CW - 34) / 3
    for i, (num, title, body, accent) in enumerate(layer_specs):
        x = M + 16 + i * layer_w
        if i:
            c.setStrokeColor(colors.HexColor("#5a4d69"))
            c.line(x - 8, 308, x - 8, 403)
        c.setFillColor(colors.HexColor(accent))
        c.setFont(BOLD, 8)
        c.drawString(x, 395, num)
        c.setFillColor(colors.white)
        c.setFont(BOLD, 11.5)
        c.drawString(x, 373, title)
        text(c, body, x, 358, layer_w - 20, size=8.8,
             color=colors.HexColor("#d2c8de"), max_height=51)

    rounded(c, M, 103, CW, 166, fill=colors.white)
    pill(c, "MEMORY ASSAY  /  INDEPENDENT STUDY", M + 16, 232,
         fill=ORANGE_PALE, color=ORANGE)
    text(c,
         "A second published model makes learning observable without pretending that the "
         "MaleCNS map already supplies it.",
         M + 16, 212, CW - 32, size=11.4, bold=True, max_height=39)
    text(c,
         "The Research view runs the Huang-Luo <i>Nature</i> 2024 mushroom-body model: "
         "odor conditioning, retention and extinction change modeled synaptic weights and "
         "circuit response rates. Its checkpoint belongs to a life record, but those weights "
         "<b>do not steer the roaming fly</b>. The assay is not part of Google's MaleCNS release.",
         M + 16, 170, CW - 32, size=9.1, max_height=64)
    c.showPage()


def mini_world(c, x, y, width, height):
    rounded(c, x, y, width, height, fill=colors.HexColor("#f3f3f8"),
            stroke=colors.HexColor("#e3e3ee"), radius=11)
    for dx, dy, r, shade in [
        (37, 58, 22, BLUE_PALE), (115, 137, 33, GREEN_PALE),
        (158, 57, 24, ORANGE_PALE), (174, 129, 21, LAV),
    ]:
        c.setFillColor(shade)
        c.circle(x + dx, y + dy, r, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor("#a38bc5"))
    c.setDash(2, 4)
    path = c.beginPath()
    path.moveTo(x + 29, y + 35)
    path.curveTo(x + 64, y + 54, x + 70, y + 142, x + 146, y + 126)
    c.drawPath(path)
    c.setDash()
    fly(c, x + 140, y + 126, 0.45)
    spider(c, x + 54, y + 47, 0.45)
    for dx, dy, color in [(105, 75, ORANGE), (161, 36, BLUE), (63, 128, GREEN)]:
        c.setFillColor(color)
        c.circle(x + dx, y + dy, 4, fill=1, stroke=0)
    c.setFont(FONT, 7)
    c.setFillColor(LIGHT)
    c.drawString(x + 13, y + 13, "FOG  /  RESOURCES  /  TRAIL  /  COVER")


def mini_brain(c, x, y, width, height):
    rounded(c, x, y, width, height, fill=DARK, stroke=DARK, radius=10)
    points = [(x + 37, y + 91), (x + 94, y + 91), (x + 155, y + 91),
              (x + 37, y + 42), (x + 94, y + 42), (x + 155, y + 42)]
    for a, b in [(0, 1), (1, 2), (3, 4), (4, 5), (0, 4), (3, 1)]:
        c.setStrokeColor(colors.HexColor("#87719d"))
        c.setLineWidth(0.9)
        c.line(*points[a], *points[b])
    for i, (px, py) in enumerate(points):
        color = [colors.HexColor("#c1a6ed"), colors.HexColor("#b490d0"),
                 colors.HexColor("#a0ccbf")][i % 3]
        c.setFillColor(color)
        c.circle(px, py, 4.7 if i < 3 else 3.7, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#e8dff1"))
    c.setFont(BOLD, 7.1)
    c.drawString(x + 12, y + height - 19, "SENSORY    DRIVE     MOTOR")
    c.setFont(FONT, 7)
    c.drawString(x + 12, y + 12, "Illustrated controller channels")


def page_three(c):
    header(c, 3, "the on-screen experience", "Watch a decision take shape",
           "The point is to test a cue, then follow its effect through body, behavior and record.")

    rounded(c, M, 457, CW, 226, fill=colors.white)
    pill(c, "01  /  THE LIVING WORLD", M + 16, 645)
    text(c, "Explore an endless, local habitat.", M + 16, 624, 256,
         size=12.8, bold=True, max_height=28)
    text(c,
         "The fly reveals procedurally generated terrain as it moves. The map shows its path, "
         "food, water, spiders and protective cover. Pan, zoom, follow, pause or change speed. "
         "Use the three brushes to add a stimulus to explored terrain and watch what happens.",
         M + 16, 592, 242, size=9.2, max_height=89)
    text(c,
         "Six live measures - energy, hunger, hydration, fatigue, health and arousal - "
         "make the cost of each choice visible.",
         M + 16, 506, 242, size=8.8, color=MUTED, max_height=42)
    mini_world(c, 331, 476, 204, 186)

    rounded(c, M, 223, CW, 218, fill=colors.white)
    mini_brain(c, M + 15, 242, 202, 181)
    pill(c, "02  /  BRAIN ACTIVITY", 273, 403)
    text(c, "Inspect why the model acted.", 273, 381, 263,
         size=12.8, bold=True, max_height=31)
    text(c,
         "Hover, focus or pin one of <b>18 channels</b> to see its current activation, "
         "input and illustrated influences. If an exposed fly detects a nearby spider, "
         "the modeled Threat and Escape channels rise; the controller changes forward "
         "and turning commands and the fly flees.",
         273, 345, 261, size=9.1, max_height=95)
    text(c,
         "These are normalized controller values, <b>not measured firing of MaleCNS neurons</b>.",
         273, 252, 261, size=8.7, color=MUTED, max_height=27)

    rounded(c, M, 91, CW, 116, fill=ROSE_PALE, stroke=colors.HexColor("#ecdde3"))
    c.setFillColor(ROSE)
    c.setFont(BOLD, 7.6)
    c.drawString(M + 16, 184, "A CONTROLLED OBSERVATION")
    items = [("PLACE", "Spider nearby"), ("SENSE", "Threat rises"),
             ("ACT", "Escape turn"), ("RECORD", "Journal event")]
    start_x = M + 16
    step = 125
    for i, (top, bottom) in enumerate(items):
        x = start_x + i * step
        c.setFillColor(INK)
        c.setFont(BOLD, 8.2)
        c.drawString(x, 151, top)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.8)
        c.drawString(x, 134, bottom)
        if i < 3:
            c.setFillColor(ROSE)
            c.setFont(BOLD, 12)
            c.drawString(x + 104, 144, ">")
    text(c, "The observer can compare this event with a matched run or another generation.",
         M + 16, 119, CW - 32, size=8.4, color=MUTED, max_height=17)
    c.showPage()


def page_four(c):
    header(c, 4, "product & reproducibility", "A research notebook, not just a game",
           "The app keeps observations, explains its sources and lets visitors test their own questions.")

    rounded(c, M, 487, 247, 196, fill=BLUE_PALE)
    pill(c, "03  /  EXPERIMENT JOURNAL", M + 15, 646,
         fill=colors.white, color=BLUE)
    text(c, "Keep the story of each life.", M + 15, 623, 217,
         size=12.7, bold=True, max_height=31)
    text(c,
         "A timeline records birth, resources, threats, interventions, exploration and death. "
         "Charts and metrics summarize the life; archived generations remain available for "
         "comparison. Saved memory-assay checkpoints can be inspected read-only.",
         M + 15, 588, 217, size=9.1, max_height=98)

    rounded(c, 306, 487, 247, 196, fill=ORANGE_PALE)
    pill(c, "04  /  RESEARCH & LEARNING", 321, 646,
         fill=colors.white, color=ORANGE)
    text(c, "Go back to the evidence.", 321, 623, 217,
         size=12.7, bold=True, max_height=31)
    text(c,
         "Run the separate odor-memory assay and inspect changing model weights. Search "
         "the MaleCNS reference atlas by source-identified cells. The in-app tutorial and "
         "About panel explain what each view means and where the science ends.",
         321, 588, 217, size=9.1, max_height=98)

    rounded(c, M, 333, CW, 137, fill=DARK, stroke=DARK)
    c.setFillColor(colors.HexColor("#cdb8e7"))
    c.setFont(BOLD, 7.7)
    c.drawString(M + 16, 444, "TECHNICAL FOUNDATION")
    text(c,
         "<b>React + TypeScript + Vite</b> power a seeded, deterministic 30 Hz simulation. "
         "The world generates near the fly rather than building infinity in advance. "
         "Local sensory input drives an interpretable utility controller; the separate "
         "published memory assay has its own circuit state. IndexedDB autosaves lives, "
         "while JSON import/export provides portable backups. Naming and new generations "
         "support controlled comparisons; no learned state is inherited.",
         M + 16, 427, CW - 32, size=9.2, leading=13.2,
         color=colors.HexColor("#e9e2f1"), max_height=77)

    rounded(c, M, 93, CW, 222, fill=colors.white)
    c.setFillColor(INK)
    c.setFont(BOLD, 12.5)
    c.drawString(M + 16, 289, "Explore the demo and original sources")
    link(c, "Live MOSK demo  -  moskdemo.netlify.app",
         "https://moskdemo.netlify.app/", M + 16, 266, CW - 32)
    rule(c, M + 16, 255, W - M - 16)
    sources = [
        ("Google Research overview of the MaleCNS release",
         "https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/"),
        ("Berg et al., Cell 2026  -  doi.org/10.1016/j.cell.2026.08.015",
         "https://doi.org/10.1016/j.cell.2026.08.015"),
        ("Official dataset and provenance  -  male-cns.janelia.org",
         "https://male-cns.janelia.org/"),
        ("Huang, Luo et al., Nature 2024  -  doi.org/10.1038/s41586-024-07819-w",
         "https://doi.org/10.1038/s41586-024-07819-w"),
        ("MOSK source code  -  github.com/francopignanelli/mosk",
         "https://github.com/francopignanelli/mosk"),
    ]
    y = 238
    for label, url in sources:
        link(c, label, url, M + 16, y, CW - 32)
        y -= 22
    text(c,
         "Made by <b>Franco Pignanelli</b> as an independent visual and interactive "
         "exploration of published work. MOSK is not affiliated with Google or HHMI Janelia.",
         M + 16, 126, CW - 32, size=8.5, color=MUTED, max_height=29)
    c.showPage()


def main():
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("MOSK | Product dossier")
    c.setAuthor("Franco Pignanelli")
    c.setSubject("An interactive product for exploring fruit-fly connectomics research")
    for page in (page_one, page_two, page_three, page_four):
        page(c)
    c.save()
    shutil.copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
