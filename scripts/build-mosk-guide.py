"""Build MOSK's concise Spanish research and user guide.

Run with the bundled Python runtime or another Python with reportlab installed.
The output is a standalone, source-attributed PDF for sharing with the app.
"""

from __future__ import annotations

from pathlib import Path
import math
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
OUTPUT = ROOT / "output" / "pdf" / "MOSK_guia_tecnica.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC_OUTPUT = ROOT / "public" / "docs" / OUTPUT.name

FONT_DIR = Path("C:/Windows/Fonts")
if (FONT_DIR / "segoeui.ttf").exists() and (FONT_DIR / "segoeuib.ttf").exists():
    pdfmetrics.registerFont(TTFont("Segoe", str(FONT_DIR / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("Segoe-Bold", str(FONT_DIR / "segoeuib.ttf")))
    pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe-Bold")
    FONT, FONT_BOLD = "Segoe", "Segoe-Bold"
else:
    FONT, FONT_BOLD = "Helvetica", "Helvetica-Bold"

W, H = A4
M = 45
CW = W - 2 * M

INK = colors.HexColor("#393242")
MUTED = colors.HexColor("#706779")
LIGHT = colors.HexColor("#91899a")
PURPLE = colors.HexColor("#8b6ac0")
PURPLE_DARK = colors.HexColor("#705099")
LAV = colors.HexColor("#f4f0f9")
PANEL = colors.HexColor("#faf8fc")
LINE = colors.HexColor("#e8e1ef")
GREEN = colors.HexColor("#78a58d")
GREEN_PALE = colors.HexColor("#edf6ef")
BLUE = colors.HexColor("#81abc3")
BLUE_PALE = colors.HexColor("#edf5f9")
ORANGE = colors.HexColor("#d0a26b")
ORANGE_PALE = colors.HexColor("#fbf4eb")
ROSE = colors.HexColor("#b5798c")
ROSE_PALE = colors.HexColor("#faeef2")


def para(
    c: canvas.Canvas,
    html: str,
    x: float,
    top: float,
    width: float,
    *,
    size: float = 9.6,
    leading: float | None = None,
    color: colors.Color = INK,
    bold: bool = False,
    max_height: float | None = None,
) -> float:
    style = ParagraphStyle(
        "text",
        fontName=FONT_BOLD if bold else FONT,
        fontSize=size,
        leading=leading or size * 1.43,
        textColor=color,
        alignment=TA_LEFT,
        spaceBefore=0,
        spaceAfter=0,
        allowWidows=0,
        allowOrphans=0,
    )
    p = Paragraph(html, style)
    _, ph = p.wrap(width, 2000)
    if max_height is not None and ph > max_height + 0.1:
        raise ValueError(f"Paragraph too tall ({ph:.1f} > {max_height:.1f}): {html[:70]}")
    p.drawOn(c, x, top - ph)
    return top - ph


def line(c: canvas.Canvas, x1: float, y: float, x2: float, color=LINE, width=0.8):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def rounded(c: canvas.Canvas, x: float, bottom: float, width: float, height: float, *,
            fill=colors.white, stroke=LINE, radius=12):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, bottom, width, height, radius, fill=1, stroke=1)


def tag(c: canvas.Canvas, label: str, x: float, y: float, *, fill=LAV, color=PURPLE_DARK):
    size = 7.3
    width = pdfmetrics.stringWidth(label, FONT_BOLD, size) + 22
    c.setFillColor(fill)
    c.roundRect(x, y - 3, width, 20, 10, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(FONT_BOLD, size)
    c.drawString(x + 11, y + 4, label)
    return width


def mark(c: canvas.Canvas, x: float, y: float, scale: float = 1):
    """Small schematic fly; decorative, not an anatomical drawing."""
    c.saveState()
    c.translate(x, y)
    c.scale(scale, scale)
    c.setStrokeColor(PURPLE)
    c.setLineWidth(1.5)
    c.setFillColor(colors.HexColor("#e6dcf3"))
    c.ellipse(-24, -1, -1, 16, fill=1, stroke=1)
    c.ellipse(1, -1, 24, 16, fill=1, stroke=1)
    c.setFillColor(PURPLE)
    c.ellipse(-5, -10, 5, 12, fill=1, stroke=0)
    c.circle(0, 16, 4.6, fill=1, stroke=0)
    for side in (-1, 1):
        c.line(side * 3, -2, side * 14, -15)
        c.line(side * 3, -7, side * 11, -19)
        c.line(side * 2, 5, side * 10, 20)
    c.restoreState()


def footer(c: canvas.Canvas, page: int):
    line(c, M, 59, W - M)
    c.setFont(FONT, 7.2)
    c.setFillColor(LIGHT)
    c.drawString(M, 43, "MOSK  /  Franco Pignanelli  /  Guía técnica · septiembre de 2026")
    c.drawRightString(W - M, 43, f"{page:02d} / 06")


def header(c: canvas.Canvas, number: int, eyebrow: str, title: str, subtitle: str | None = None):
    c.setFillColor(PURPLE)
    c.roundRect(M, H - 54, 29, 20, 6, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 8)
    c.drawCentredString(M + 14.5, H - 48, "M")
    c.setFillColor(PURPLE_DARK)
    c.setFont(FONT_BOLD, 7.7)
    c.drawString(M + 41, H - 47, eyebrow.upper())
    c.setFillColor(LIGHT)
    c.setFont(FONT, 7.2)
    c.drawRightString(W - M, H - 47, f"SECCIÓN {number:02d}")
    line(c, M, H - 69, W - M)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 23)
    c.drawString(M, H - 104, title)
    if subtitle:
        para(c, subtitle, M, H - 119, CW, size=9.1, color=MUTED, max_height=40)


def tiny_circle(c: canvas.Canvas, x: float, y: float, r: float, color):
    c.setFillColor(color)
    c.circle(x, y, r, fill=1, stroke=0)


def arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color=PURPLE):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.25)
    c.line(x1, y1, x2, y2)
    a = math.atan2(y2-y1, x2-x1)
    l = 5
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2-l*math.cos(a-0.5), y2-l*math.sin(a-0.5))
    p.lineTo(x2-l*math.cos(a+0.5), y2-l*math.sin(a+0.5))
    p.close()
    c.drawPath(p, fill=1, stroke=0)


def page_one(c: canvas.Canvas):
    c.setFillColor(colors.HexColor("#fbfafc"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(LAV)
    c.circle(W - 38, H - 136, 170, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor("#dacbec"))
    c.setLineWidth(1)
    for r in (70, 105, 145):
        c.circle(W - 79, H - 187, r, fill=0, stroke=1)
    for x, y, r in ((W-184,H-183,4),(W-34,H-235,6),(W-126,H-91,4),(W-214,H-272,3)):
        tiny_circle(c,x,y,r,colors.HexColor("#b8a0d1"))
    mark(c, W - 80, H - 187, 2.15)

    tag(c, "DOCUMENTACIÓN DEL PROYECTO", M, H - 64)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 54)
    c.drawString(M - 3, H - 178, "MOSK")
    para(c, "Una mosca virtual para pensar con modelos", M, H - 199, 300,
         size=17.5, leading=23, bold=True, max_height=48)
    para(c,
         "Exploración visual e interactiva de MaleCNS, publicado por HHMI Janelia, Google Research y colaboradores, de un modelo independiente de memoria y de un hábitat simulado.",
         M, H - 264, 314, size=10.4, leading=16.4, color=MUTED, max_height=83)

    rounded(c, M, 328, CW, 171, fill=colors.white, stroke=LINE, radius=14)
    c.setFillColor(PURPLE)
    c.roundRect(M + 19, 453, 4, 26, 2, fill=1, stroke=0)
    para(c, "La pregunta central", M + 34, 479, CW - 56, size=9, color=PURPLE_DARK,
         bold=True, max_height=16)
    para(c,
         "¿Qué cambia en el comportamiento cuando varían las señales del entorno y el estado interno de una mosca virtual? MOSK permite observar trayectorias, intervenir en el mapa y leer los registros de un experimento reproducible.",
         M + 23, 447, CW - 46, size=11.4, leading=17.4, max_height=76)
    line(c, M + 23, 371, W - M - 23)
    para(c,
         "MaleCNS aporta anatomía real. El controlador del hábitat es propio. El ensayo publicado de Huang y Luo corre por separado y no mueve a la mosca.",
         M + 23, 359, CW - 46, size=8.8, leading=12.7, color=MUTED, max_height=47)

    chips = [
        ("01", "Simulación", "Decisiones observables"),
        ("02", "Anatomía", "Atlas MaleCNS"),
        ("03", "Memoria", "Ensayo publicado"),
    ]
    gap = 10
    iw = (CW - 2*gap) / 3
    for i,(num,name,desc) in enumerate(chips):
        x = M + i*(iw+gap)
        rounded(c, x, 192, iw, 113, fill=PANEL, stroke=LINE, radius=11)
        c.setFillColor(PURPLE)
        c.setFont(FONT_BOLD, 8)
        c.drawString(x+14, 279, num)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 13)
        c.drawString(x+14, 250, name)
        para(c, desc, x+14, 235, iw-28, size=8.5, color=MUTED, max_height=29)

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 11)
    c.drawString(M, 153, "Franco Pignanelli")
    para(c, "Concepto, diseño e implementación de MOSK. Proyecto independiente de divulgación técnica y exploración interactiva.",
         M, 140, CW-25, size=8.9, color=MUTED, max_height=35)
    footer(c, 1)
    c.showPage()


def layer_card(c, top, number, title, tag_text, body, tint, accent):
    h = 114
    rounded(c, M, top - h, CW, h, fill=colors.white, stroke=LINE)
    c.setFillColor(tint)
    c.roundRect(M+13, top-96, 94, 78, 9, fill=1, stroke=0)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 20)
    c.drawString(M+26, top-56, number)
    c.setFont(FONT_BOLD, 7.5)
    c.drawString(M+26, top-77, tag_text)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 12.1)
    c.drawString(M+125, top-33, title)
    para(c, body, M+125, top-43, CW-148, size=9.1, leading=13.2, color=MUTED, max_height=65)


def page_two(c: canvas.Canvas):
    header(c, 1, "Fundamento", "Tres capas, tres significados",
           "Distinguir el origen de cada señal evita atribuirle al conectoma una conducta que no modela.")
    layer_card(c, 689, "A", "Atlas MaleCNS v1.0", "ANATOMÍA PUBLICADA",
               "MaleCNS fue publicado en 2026 por HHMI Janelia, Google Research y colaboradores. MOSK incluye 96 anotaciones celulares reales con sus identificadores y etiquetas de origen. Esta muestra no incorpora el grafo completo ni calcula actividad neuronal. [1-3]",
               LAV, PURPLE_DARK)
    layer_card(c, 563, "B", "Ensayo Huang-Luo 2024", "MODELO PUBLICADO",
               "Un circuito computacional de cuerpo fungoso, derivado de ecuaciones y parámetros publicados, permite estudiar condicionamiento, retención y extinción. Corre en una vista de investigación independiente; sus pesos no controlan el vuelo. [4-5]",
               BLUE_PALE, BLUE)
    layer_card(c, 437, "C", "Terrario MOSK", "SIMULACIÓN PROPIA",
               "El movimiento surge de un controlador de utilidad sensorial con señales locales, necesidades internas y reglas explícitas. Sus 18 canales de actividad representan variables del programa, no neuronas registradas ni conexiones anatómicas. [6]",
               GREEN_PALE, GREEN)

    rounded(c, M, 116, CW, 188, fill=PANEL, stroke=LINE)
    para(c, "El circuito operativo del hábitat", M+18, 286, CW-36, size=11.6, bold=True, max_height=21)
    para(c, "El reloj avanza a pasos fijos; la visualización solo muestra el estado calculado.",
         M+18, 263, CW-36, size=8.7, color=MUTED, max_height=28)
    centers = [M+62, M+186, M+314, M+441]
    labels = [("MUNDO", "sectores y objetos"), ("SENTIDOS", "señales locales"),
              ("DECISIÓN", "utilidad sensorial"), ("ACCIÓN", "movimiento")]
    for i,(cx,(lab,sub)) in enumerate(zip(centers,labels)):
        rounded(c, cx-53, 167, 106, 53, fill=colors.white, stroke=LINE, radius=8)
        c.setFillColor(PURPLE_DARK)
        c.setFont(FONT_BOLD, 8.3)
        c.drawCentredString(cx, 198, lab)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.4)
        c.drawCentredString(cx, 181, sub)
        if i < 3:
            arrow(c, cx+55, 194, centers[i+1]-57, 194)
    para(c, "La mosca percibe su entorno próximo; la cámara y el mapa explorado son instrumentos del observador.",
         M+19, 153, CW-38, size=8.7, color=MUTED, max_height=28)
    footer(c, 2)
    c.showPage()


def step(c, top, height, num, title, body, accent=PURPLE, tint=LAV):
    rounded(c, M, top-height, CW, height, fill=colors.white, stroke=LINE)
    c.setFillColor(tint)
    c.circle(M+31, top-30, 16, fill=1, stroke=0)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 9)
    c.drawCentredString(M+31, top-33, num)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 11.8)
    c.drawString(M+60, top-31, title)
    para(c, body, M+60, top-44, CW-79, size=9.1, leading=13.1, color=MUTED,
         max_height=height-51)


def page_three(c: canvas.Canvas):
    header(c, 2, "Uso", "Cómo observar una vida",
           "Un recorrido corto para pasar de mirar el terrario a formular una pregunta comprobable.")
    step(c, 690, 104, "01", "Iniciar y nombrar",
         "Asigna un nombre a la mosca y utiliza por defecto <b>Modelo de utilidad sensorial</b>. El modo aleatorio sirve como comparación. Pausa para inspeccionar y cambia la velocidad cuando necesites seguir una secuencia corta.")
    step(c, 575, 104, "02", "Situarse en el mapa",
         "Acerca o aleja con la rueda o los botones de zoom. Arrastra para mover la cámara y vuelve a seguir a la mosca con el control de centrado. El terreno aparece a medida que la mosca explora; mirar con la cámara no descubre lugares.",
         BLUE, BLUE_PALE)
    step(c, 460, 112, "03", "Intervenir con el pincel",
         "Elige <b>comida, agua o araña</b> en la paleta dentro del mapa y haz clic o arrastra para colocar objetos discretos sobre terreno ya revelado y cercano a la mosca. Observa la reacción sin cambiar varias condiciones a la vez. Las intervenciones quedan registradas en las notas del experimento y en la copia guardada.",
         ORANGE, ORANGE_PALE)
    step(c, 337, 104, "04", "Leer la respuesta",
         "Relaciona trayectoria, estado interno y eventos. En <b>Brain Activity</b>, pasa el cursor o enfoca un nodo para ver su valor, entrada e influencia ilustrativa. El panel describe el controlador activo; no es una lectura de neuronas biológicas.",
         GREEN, GREEN_PALE)

    rounded(c, M, 114, CW, 106, fill=LAV, stroke=LINE)
    para(c, "Una observación útil", M+19, 202, CW-38, size=10.3, bold=True, color=PURPLE_DARK,
         max_height=20)
    para(c,
         "Registra el estado antes de añadir un objeto, coloca solo uno y sigue la respuesta durante varios segundos de simulación. Una diferencia visible sugiere una hipótesis sobre <i>este controlador</i>; un resultado biológico requeriría controles y validación independientes.",
         M+19, 183, CW-38, size=9.2, leading=13.5, max_height=56)
    footer(c, 3)
    c.showPage()


def small_card(c, x, top, w, h, number, title, body, tint, accent):
    rounded(c, x, top-h, w, h, fill=colors.white, stroke=LINE)
    tag(c, number, x+14, top-29, fill=tint, color=accent)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 11.2)
    c.drawString(x+14, top-62, title)
    para(c, body, x+14, top-76, w-28, size=8.75, leading=12.5, color=MUTED,
         max_height=h-88)


def page_four(c: canvas.Canvas):
    header(c, 3, "Mecánica", "Un entorno cambiante",
           "El mundo plantea necesidades y riesgos, pero sus parámetros son reglas de simulación explícitas.")
    gap = 11
    hw = (CW-gap)/2
    small_card(c, M, 688, hw, 191, "ESPACIO", "Terreno progresivo",
               "Sectores deterministas forman un mundo sin borde diseñado. Solo se carga el vecindario activo; la niebla revela lo que visita la mosca. El mapa explorado pertenece al observador, no a una memoria espacial del controlador.",
               LAV, PURPLE)
    small_card(c, M+hw+gap, 688, hw, 191, "RECURSOS", "Comida y agua",
               "La fruta se consume, decae y reaparece en otra posición del sector tras un ciclo de 10 a 13 minutos simulados. Los estanques permanecen y se rellenan lentamente. El olor muestra una pista local, no una ubicación conocida.",
               ORANGE_PALE, ORANGE)
    small_card(c, M, 486, hw, 191, "RIESGO", "Arañas y persecución",
               "Una araña cercana puede perseguir, pero cada encuentro tiene un máximo de 8 segundos y después 12 segundos de recuperación compartida. El contacto todavía puede lesionar; los valores expresan balance de juego, no mediciones etológicas.",
               ROSE_PALE, ROSE)
    small_card(c, M+hw+gap, 486, hw, 191, "REFUGIO", "Cobertura con costo",
               "El núcleo frondoso impide entrada, visión y mordidas de arañas. El borde sigue siendo vulnerable. Allí la mosca puede descansar, pero el hambre y la sed continúan; buscar recursos obliga a salir.",
               GREEN_PALE, GREEN)

    rounded(c, M, 114, CW, 168, fill=PANEL, stroke=LINE)
    para(c, "Presiones internas observables", M+18, 264, CW-36, size=11.4,
         bold=True, max_height=21)
    vals = [("Energía", PURPLE), ("Hambre", ORANGE), ("Hidratación", BLUE),
            ("Fatiga", PURPLE_DARK), ("Salud", GREEN), ("Alerta", ROSE)]
    for i,(lab,col) in enumerate(vals):
        x = M+18+i*(CW-36)/6
        tiny_circle(c,x+4,224,3.4,col)
        c.setFillColor(INK)
        c.setFont(FONT, 8.1)
        c.drawString(x+12,221,lab)
    line(c, M+18, 204, W-M-18)
    para(c,
         "Las decisiones priorizan escapar, beber, comer, recuperarse o explorar según señales cercanas y necesidades actuales. La salud se recupera con descanso y recursos suficientes; no hay envejecimiento ni una vida máxima programada. Los porcentajes son escalas internas del modelo, no medidas fisiológicas calibradas.",
         M+18, 191, CW-36, size=9.1, leading=13.1, max_height=65)
    footer(c, 4)
    c.showPage()


def page_five(c: canvas.Canvas):
    header(c, 4, "Investigación", "Señales, células y memoria",
           "Cada panel responde una pregunta distinta y requiere una interpretación propia.")

    rounded(c, M, 567, CW, 119, fill=colors.white, stroke=LINE)
    tag(c, "ACTIVIDAD DEL CONTROLADOR", M+15, 658)
    para(c, "18 canales que explican la acción", M+15, 631, CW-30, size=11.5,
         bold=True, max_height=22)
    para(c,
         "Señales sensoriales, motivaciones derivadas y salidas motoras cambian con la vida. Al enfocar un nodo se ve valor actual, origen e influencias de diseño. Las conexiones del dibujo son relaciones funcionales ilustrativas; no son sinapsis MaleCNS.",
         M+15, 613, CW-30, size=9.1, leading=13.2, color=MUTED, max_height=48)

    rounded(c, M, 427, CW, 128, fill=colors.white, stroke=LINE)
    tag(c, "ATLAS ANATÓMICO", M+15, 527, fill=LAV)
    para(c, "Células reales, consulta de referencia", M+15, 500, CW-30,
         size=11.5, bold=True, max_height=22)
    para(c,
         "Los 96 registros de MaleCNS v1.0 incluyen identificador, tipo y clase originales. Proceden de una muestra documentada de ocho grupos. El conectoma completo abarca más de 166.000 neuronas; MOSK no ejecuta ese grafo ni infiere la activación de las células mostradas. [1-3]",
         M+15, 482, CW-30, size=9.1, leading=13.2, color=MUTED, max_height=58)

    rounded(c, M, 206, CW, 209, fill=colors.white, stroke=LINE)
    tag(c, "ENSAYO DE MEMORIA", M+15, 387, fill=BLUE_PALE, color=BLUE)
    para(c, "Condicionamiento en un circuito publicado", M+15, 359,
         CW-30, size=11.5, bold=True, max_height=22)
    para(c,
         "El modelo Huang-Luo expone seis pesos sinápticos plásticos para dos olores y tres vías, más seis respuestas de circuito por ensayo. Permite comparar condicionamiento, retención, extinción y una condición sin cinco enlaces de retroalimentación. Un registro muestra estímulos, respuestas y cambios numéricos. [4-5]",
         M+15, 340, 282, size=8.9, leading=12.6, color=MUTED, max_height=101)
    # Small, conceptual 2 x 3 table. Numeric values live only in the assay UI.
    bx = M+328
    by = 330
    for r in range(2):
        for col in range(3):
            tint = [LAV, BLUE_PALE, GREEN_PALE][col]
            c.setFillColor(tint)
            c.setStrokeColor(LINE)
            c.roundRect(bx+col*45, by-r*40, 39, 31, 5, fill=1, stroke=1)
            c.setFillColor(PURPLE_DARK)
            c.setFont(FONT_BOLD, 7)
            c.drawCentredString(bx+col*45+19.5, by-r*40+11, f"w{r+1}{col+1}")
    para(c, "2 olores x 3 vías", bx, 254, 140, size=7.3, color=MUTED,
         max_height=12)

    rounded(c, M, 114, CW, 79, fill=LAV, stroke=LINE)
    para(c,
         "<b>Memoria por individuo.</b> El ensayo conserva su estado y registro dentro de una vida; una nueva generación empieza sin esos pesos aprendidos. El tiempo del ensayo es distinto del reloj del hábitat y su aprendizaje no mueve a la mosca del mapa.",
         M+17, 176, CW-34, size=8.8, leading=12.6, max_height=51)
    footer(c, 5)
    c.showPage()


def reference(c: canvas.Canvas, label: str, url: str, x: float, top: float, w: float):
    b = para(c, f"<b>{label}</b>", x, top, w, size=8.05, leading=10.5,
             color=INK, max_height=22)
    b2 = para(c, url, x, b-1, w, size=6.9, leading=9.1,
              color=PURPLE_DARK, max_height=29)
    c.linkURL(url, (x, b2, x+w, top), relative=0)
    return b2-11


def page_six(c: canvas.Canvas):
    header(c, 5, "Método y datos", "Registrar, comparar y compartir",
           "La intervención observable gana valor cuando se conserva el contexto de la vida y se reconoce su alcance.")

    rounded(c, M, 564, CW, 125, fill=colors.white, stroke=LINE)
    para(c, "Guardado local y archivos JSON", M+16, 670, CW-32,
         size=11.5, bold=True, max_height=23)
    para(c,
         "MOSK guarda automáticamente en este navegador la vida activa, terreno recorrido, estado del controlador, eventos, historial y generaciones archivadas. <b>Exportar</b> descarga una copia JSON para respaldo o traslado. <b>Importar</b> valida ese archivo, reemplaza el experimento local - incluida la vida y sus archivos - y deja la simulación pausada para inspección. Conservar ambas versiones exige exportar antes de importar.",
         M+16, 646, CW-32, size=9.1, leading=13.1, color=MUTED, max_height=76)

    rounded(c, M, 419, CW, 132, fill=PANEL, stroke=LINE)
    para(c, "Una prueba sencilla con el pincel", M+16, 532, CW-32,
         size=11.5, bold=True, max_height=23)
    para(c,
         "<b>1</b> Observa 20 segundos y anota necesidad, posición y acción. <b>2</b> Coloca un solo recurso en una zona visible. <b>3</b> Sigue trayectoria, señales y eventos. <b>4</b> Exporta el JSON para conservar la secuencia. Repite bajo condiciones comparables antes de atribuirle una causa a la diferencia.",
         M+16, 506, CW-32, size=9.1, leading=13.2, color=MUTED, max_height=72)

    rounded(c, M, 308, CW, 99, fill=LAV, stroke=LINE)
    para(c, "Alcance científico", M+16, 390, CW-32,
         size=10.5, bold=True, color=PURPLE_DARK, max_height=21)
    para(c,
         "Las intervenciones modifican un entorno simulado. No constituyen estimulación neuronal ni una predicción validada de conducta animal. MaleCNS aporta anatomía; Huang-Luo aporta una dinámica de memoria separada; MOSK aporta el terrario, su controlador y la interfaz experimental.",
         M+16, 370, CW-32, size=8.6, leading=11.9, max_height=52)

    para(c, "Fuentes y procedencia", M, 291, CW, size=11.5,
         bold=True, max_height=22)
    line(c, M, 271, W-M)
    colw = (CW-17)/2
    yleft = 259
    yleft = reference(c, "[1] Berg et al., Cell (2026), MaleCNS", "https://doi.org/10.1016/j.cell.2026.08.015", M, yleft, colw)
    yleft = reference(c, "[2] Google Research, anuncio MaleCNS", "https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/", M, yleft, colw)
    yleft = reference(c, "[3] MaleCNS v1.0, datos y licencia CC BY", "https://male-cns.janelia.org/download/", M, yleft, colw)
    yright = 259
    xright = M+colw+17
    yright = reference(c, "[4] Huang, Luo et al., Nature (2024)", "https://doi.org/10.1038/s41586-024-07819-w", xright, yright, colw)
    yright = reference(c, "[5] Código original del ensayo", "https://github.com/schnitzer-lab/Luo_Huang_2024_MB_model", xright, yright, colw)
    yright = reference(c, "[6] MOSK, implementación y notas", "https://github.com/francopignanelli/mosk", xright, yright, colw)
    if min(yleft, yright) < 70:
        raise ValueError(f"References overflow: {yleft}, {yright}")
    footer(c, 6)
    c.showPage()


def main():
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("MOSK | Guía técnica")
    c.setAuthor("Franco Pignanelli")
    c.setSubject("Exploración visual de un terrario virtual, MaleCNS y un ensayo publicado de memoria")
    for page in (page_one, page_two, page_three, page_four, page_five, page_six):
        page(c)
    c.save()
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
