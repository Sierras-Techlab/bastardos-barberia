from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path("/Users/urielalessandro/Proyectos/bastardos")
OUT = ROOT / "output/pdf/guia-rapida-bastardos.pdf"
SCREENS = ROOT / "tmp/pdfs/screens"
LOGO = ROOT / "public/brand/bastardos-logo.png"

PAGE_W, PAGE_H = A4
MARGIN = 42
RED = HexColor("#E5252A")
INK = HexColor("#18181B")
MUTED = HexColor("#71717A")
SURFACE = HexColor("#F1F0ED")
LINE = HexColor("#E4E4E7")
SOFT_RED = HexColor("#FBEAEC")
GREEN = HexColor("#059669")

pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))


def wrap_text(text, font, size, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, max_width, font="Arial", size=10, color=INK, leading=14):
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap_text(text, font, size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def page_base(c, number, section=None):
    c.setFillColor(SURFACE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Arial-Bold", 8)
    c.drawString(MARGIN, 23, "BASTARDOS - GESTIÓN INTERNA")
    c.setFillColor(MUTED)
    c.setFont("Arial", 8)
    c.drawRightString(PAGE_W - MARGIN, 23, f"{number} / 8")
    if section:
        c.setFillColor(RED)
        c.setFont("Arial-Bold", 8)
        c.drawString(MARGIN, PAGE_H - 40, section.upper())


def page_title(c, title, subtitle, y=PAGE_H - 70):
    c.setFillColor(INK)
    c.setFont("Arial-Bold", 24)
    c.drawString(MARGIN, y, title)
    draw_wrapped(c, subtitle, MARGIN, y - 24, PAGE_W - 2 * MARGIN, size=10.5, color=MUTED, leading=15)


def rounded_card(c, x, y, w, h, fill=white, stroke=LINE, radius=14):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def label(c, text, x, y, color=RED):
    c.setFillColor(color)
    c.setFont("Arial-Bold", 8)
    c.drawString(x, y, text.upper())


def bullet(c, text, x, y, max_width, color=INK, size=9.5, leading=13):
    c.setFillColor(RED)
    c.circle(x + 3, y + 3, 2.2, fill=1, stroke=0)
    return draw_wrapped(c, text, x + 13, y, max_width - 13, size=size, color=color, leading=leading)


def screenshot(c, filename, x, y, w, h):
    path = SCREENS / filename
    c.saveState()
    c.setFillColor(Color(0, 0, 0, alpha=0.08))
    c.roundRect(x + 2, y - 3, w, h, 10, fill=1, stroke=0)
    c.restoreState()
    c.saveState()
    c.setFillAlpha(1)
    p = c.beginPath()
    p.roundRect(x, y, w, h, 10)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), x, y, w, h, preserveAspectRatio=True, anchor="c", mask="auto")
    c.restoreState()
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 10, fill=0, stroke=1)


def role_card(c, x, y, w, h, title, accent, lines):
    rounded_card(c, x, y, w, h)
    c.setFillColor(accent)
    c.roundRect(x + 14, y + h - 42, 28, 28, 9, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 11)
    c.drawCentredString(x + 28, y + h - 32, title[0])
    c.setFillColor(INK)
    c.setFont("Arial-Bold", 14)
    c.drawString(x + 52, y + h - 33, title)
    by = y + h - 65
    for line in lines:
        by = bullet(c, line, x + 18, by, w - 36, size=9, leading=12) - 5


c = canvas.Canvas(str(OUT), pagesize=A4)
c.setTitle("Guía rápida de uso - Bastardos Gestión Interna")
c.setAuthor("Sierras TechLab")
c.setSubject("Manual breve para probar el sistema de gestión de Bastardos")

# 1. Cover
c.setFillColor(INK)
c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
c.setFillColor(RED)
c.rect(0, PAGE_H - 12, PAGE_W, 12, fill=1, stroke=0)
c.drawImage(ImageReader(str(LOGO)), MARGIN, PAGE_H - 190, 220, 82, preserveAspectRatio=True, mask="auto")
c.setFillColor(RED)
c.setFont("Arial-Bold", 9)
c.drawString(MARGIN, PAGE_H - 232, "GUÍA RÁPIDA DE USO")
c.setFillColor(white)
c.setFont("Arial-Bold", 34)
c.drawString(MARGIN, PAGE_H - 285, "Gestión interna")
c.setFont("Arial-Bold", 34)
c.drawString(MARGIN, PAGE_H - 327, "de Bastardos")
draw_wrapped(c, "Una guía breve para conocer el sistema, registrar ventas y revisar la actividad del negocio.", MARGIN, PAGE_H - 365, 420, size=13, color=HexColor("#D4D4D8"), leading=19)
c.setFillColor(RED)
c.roundRect(MARGIN, 125, 185, 44, 14, fill=1, stroke=0)
c.setFillColor(white)
c.setFont("Arial-Bold", 11)
c.drawCentredString(MARGIN + 92.5, 142, "VERSIÓN DE PRUEBA")
c.setFillColor(HexColor("#A1A1AA"))
c.setFont("Arial", 9)
c.drawString(MARGIN, 88, "Preparado por Sierras TechLab · Agosto 2026")
c.showPage()

# 2. Access and roles
page_base(c, 2, "Acceso y permisos")
page_title(c, "Cada persona ve lo que necesita", "El dueño administra el negocio completo. El empleado trabaja con su propia actividad y no accede a la administración sensible.")
role_card(c, MARGIN, 455, 245, 230, "Dueño / Administrador", INK, [
    "Consulta todas las ventas, comisiones y el neto de la barbería.",
    "Puede cargar una venta para cualquier integrante activo del equipo.",
    "Administra usuarios, comisiones, productos, categorías y medios de pago.",
    "Accede a Caja y al historial diario para auditoría.",
])
role_card(c, PAGE_W - MARGIN - 245, 455, 245, 230, "Empleado", RED, [
    "Carga ingresos únicamente a su propio nombre.",
    "Consulta sus ventas, su comisión y su promedio por venta.",
    "Puede usar Clientes, Servicios y Productos para operar.",
    "No accede a Usuarios, Caja ni configuraciones administrativas.",
])
rounded_card(c, MARGIN, 315, PAGE_W - 2 * MARGIN, 105, fill=SOFT_RED, stroke=SOFT_RED)
label(c, "Ingreso al sistema", MARGIN + 18, 392)
c.setFillColor(INK)
c.setFont("Arial-Bold", 13)
c.drawString(MARGIN + 18, 367, "Usuario y contraseña personal")
draw_wrapped(c, "No existe registro público. El dueño crea cada cuenta y entrega las credenciales. Si una persona no puede ingresar, debe pedir al dueño que revise su estado o cambie su contraseña.", MARGIN + 18, 346, PAGE_W - 2 * MARGIN - 36, size=9.5, color=MUTED, leading=13)
screenshot(c, "08-employee-dashboard.png", MARGIN, 62, PAGE_W - 2 * MARGIN, 225)
c.showPage()

# 3. Dashboard
page_base(c, 3, "Inicio")
page_title(c, "El resumen del día, de un vistazo", "Inicio concentra la información más importante y ofrece accesos rápidos a las tareas habituales.")
screenshot(c, "01-dashboard.png", MARGIN, 355, PAGE_W - 2 * MARGIN, 285)
rounded_card(c, MARGIN, 92, PAGE_W - 2 * MARGIN, 225)
label(c, "Qué muestra", MARGIN + 18, 289)
items = [
    "Total vendido, cantidad de ventas, promedio por venta y distribución por medios de pago.",
    "Actividad de los últimos siete días mediante un gráfico simple.",
    "Accesos rápidos para cargar ingresos, consultar ventas, clientes y productos.",
    "Clientes fijos de la semana y su estado de asistencia.",
]
yy = 263
for item in items:
    yy = bullet(c, item, MARGIN + 18, yy, PAGE_W - 2 * MARGIN - 36, size=9.5, leading=13) - 8
c.setFillColor(MUTED)
c.setFont("Arial", 8.5)
c.drawString(MARGIN + 18, 113, "En la cuenta de empleado, los importes y gráficos corresponden solamente a su propia actividad.")
c.showPage()

# 4. Register income
page_base(c, 4, "Ingresos")
page_title(c, "Registrar una venta", "El formulario permite vender un servicio, uno o varios productos, o combinar ambos en una sola operación.")
screenshot(c, "02-income-new.png", MARGIN, 350, PAGE_W - 2 * MARGIN, 290)
rounded_card(c, MARGIN, 78, PAGE_W - 2 * MARGIN, 235)
label(c, "Paso a paso", MARGIN + 18, 286)
steps = [
    "Elegir el empleado responsable. En una cuenta de empleado se selecciona automáticamente a sí mismo.",
    "Asociar un cliente si corresponde. El cliente es opcional en esta etapa.",
    "Seleccionar un servicio, productos y cantidades. También puede registrarse una venta sólo de productos.",
    "Elegir un medio de pago o repartir el total entre varios medios con la opción Combinado.",
    "Revisar total, comisión estimada y neto de barbería antes de confirmar.",
]
yy = 260
for idx, item in enumerate(steps, 1):
    c.setFillColor(RED)
    c.roundRect(MARGIN + 18, yy - 3, 20, 20, 7, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 8)
    c.drawCentredString(MARGIN + 28, yy + 3, str(idx))
    yy = draw_wrapped(c, item, MARGIN + 48, yy, PAGE_W - 2 * MARGIN - 66, size=9.2, color=INK, leading=12) - 8
c.showPage()

# 5. Income history
page_base(c, 5, "Ingresos y comisiones")
page_title(c, "Consultar lo vendido", "El historial permite encontrar operaciones, revisar importes y abrir el detalle de cada venta.")
screenshot(c, "03-incomes.png", MARGIN, 385, PAGE_W - 2 * MARGIN, 255)
screenshot(c, "09-employee-incomes.png", MARGIN, 105, 300, 215)
rounded_card(c, 360, 105, PAGE_W - MARGIN - 360, 215)
label(c, "Diferencia por rol", 378, 292)
c.setFillColor(INK)
c.setFont("Arial-Bold", 12)
c.drawString(378, 266, "Dueño / Administrador")
oy = bullet(c, "Ve la facturación total, las comisiones y el neto de barbería.", 378, 244, 175, size=8.8, leading=12) - 7
oy = bullet(c, "Puede filtrar por empleado y revisar todas las operaciones.", 378, oy, 175, size=8.8, leading=12) - 15
c.setFont("Arial-Bold", 12)
c.setFillColor(INK)
c.drawString(378, oy, "Empleado")
oy = bullet(c, "Ve sólo sus ingresos, su comisión y su promedio.", 378, oy - 22, 175, size=8.8, leading=12) - 7
bullet(c, "No puede cambiar el filtro de responsable.", 378, oy, 175, size=8.8, leading=12)
c.setFillColor(MUTED)
c.setFont("Arial", 8.5)
c.drawString(MARGIN, 76, "Las ventas anuladas siguen visibles para auditoría, pero no se suman a los totales activos.")
c.showPage()

# 6. Customers and catalog
page_base(c, 6, "Clientes y catálogo")
page_title(c, "Información ordenada para operar rápido", "Clientes, servicios y productos alimentan la carga de ingresos y mantienen la información centralizada.")
screenshot(c, "04-customers.png", MARGIN, 412, 250, 180)
screenshot(c, "05-products.png", PAGE_W - MARGIN - 250, 412, 250, 180)
rounded_card(c, MARGIN, 225, 250, 155)
label(c, "Clientes", MARGIN + 16, 352)
cy = bullet(c, "Guarda nombre, apellido, teléfono y correo.", MARGIN + 16, 328, 218, size=8.8, leading=12) - 6
cy = bullet(c, "Muestra visitas y consumos históricos.", MARGIN + 16, cy, 218, size=8.8, leading=12) - 6
bullet(c, "Puede asignarse un día y horario semanal fijo.", MARGIN + 16, cy, 218, size=8.8, leading=12)
rounded_card(c, PAGE_W - MARGIN - 250, 225, 250, 155)
label(c, "Servicios y productos", PAGE_W - MARGIN - 234, 352)
px = bullet(c, "Consulta precios y disponibilidad antes de vender.", PAGE_W - MARGIN - 234, 328, 218, size=8.8, leading=12) - 6
px = bullet(c, "El stock se descuenta al confirmar una venta.", PAGE_W - MARGIN - 234, px, 218, size=8.8, leading=12) - 6
bullet(c, "El dueño administra productos, categorías y estados.", PAGE_W - MARGIN - 234, px, 218, size=8.8, leading=12)
rounded_card(c, MARGIN, 82, PAGE_W - 2 * MARGIN, 110, fill=INK, stroke=INK)
label(c, "Clientes fijos", MARGIN + 18, 164, color=RED)
c.setFillColor(white)
c.setFont("Arial-Bold", 12)
c.drawString(MARGIN + 18, 140, "Un horario semanal, asistencia independiente de la venta")
draw_wrapped(c, "Desde Clientes se define, por ejemplo, todos los jueves a las 10:00. En Inicio aparecerá la visita correspondiente de la semana para marcar Asistió o No asistió.", MARGIN + 18, 119, PAGE_W - 2 * MARGIN - 36, size=9, color=HexColor("#D4D4D8"), leading=12)
c.showPage()

# 7. Team and cash
page_base(c, 7, "Equipo y caja")
page_title(c, "Administración y control diario", "El dueño configura al equipo y revisa la Caja sin aperturas ni cierres manuales.")
screenshot(c, "06-users.png", MARGIN, 455, PAGE_W - 2 * MARGIN, 185)
rounded_card(c, MARGIN, 352, PAGE_W - 2 * MARGIN, 78)
label(c, "Usuarios y comisiones", MARGIN + 16, 404)
draw_wrapped(c, "El dueño crea cuentas, activa o desactiva accesos y define porcentajes de comisión para servicios y productos. Las ventas del propio dueño pertenecen íntegramente a la barbería.", MARGIN + 16, 383, PAGE_W - 2 * MARGIN - 32, size=8.8, color=INK, leading=12)
screenshot(c, "07-cash.png", MARGIN, 105, 300, 215)
rounded_card(c, 360, 105, PAGE_W - MARGIN - 360, 215)
label(c, "Caja automática", 378, 292)
ky = bullet(c, "La caja del día se calcula con las ventas registradas.", 378, 266, 175, size=8.8, leading=12) - 7
ky = bullet(c, "Separa ventas brutas, comisiones y neto de barbería.", 378, ky, 175, size=8.8, leading=12) - 7
ky = bullet(c, "Muestra medios de pago y detalle de cada operación.", 378, ky, 175, size=8.8, leading=12) - 7
bullet(c, "Los días anteriores quedan disponibles para auditoría.", 378, ky, 175, size=8.8, leading=12)
c.showPage()

# 8. Test checklist
page_base(c, 8, "Prueba del sistema")
page_title(c, "Qué conviene probar primero", "Usá datos ficticios. La finalidad de esta etapa es validar que el flujo diario resulte cómodo y claro.")
rounded_card(c, MARGIN, 420, PAGE_W - 2 * MARGIN, 245)
label(c, "Recorrido recomendado", MARGIN + 18, 638)
checks = [
    "Ingresar como dueño y crear o revisar una cuenta de empleado.",
    "Configurar comisiones de servicio y producto para ese empleado.",
    "Crear un cliente, asignarle un horario fijo y buscarlo nuevamente.",
    "Revisar servicios, crear un producto de prueba y ajustar su stock.",
    "Registrar una venta con servicio, productos y pago combinado.",
    "Abrir Ingresos para revisar el detalle y comprobar los totales.",
    "Ingresar como empleado y confirmar que sólo vea su actividad.",
    "Revisar Caja desde la cuenta del dueño y abrir una venta para auditarla.",
]
yy = 610
for item in checks:
    c.setStrokeColor(GREEN)
    c.setLineWidth(1.2)
    c.roundRect(MARGIN + 18, yy - 3, 13, 13, 3, fill=0, stroke=1)
    yy = draw_wrapped(c, item, MARGIN + 43, yy, PAGE_W - 2 * MARGIN - 61, size=9.2, color=INK, leading=12) - 8
rounded_card(c, MARGIN, 240, PAGE_W - 2 * MARGIN, 145, fill=SOFT_RED, stroke=SOFT_RED)
label(c, "Todavía no disponible", MARGIN + 18, 358)
c.setFillColor(INK)
c.setFont("Arial-Bold", 13)
c.drawString(MARGIN + 18, 333, "Gastos, Reportes y configuración general del Negocio")
draw_wrapped(c, "Estas opciones pueden aparecer en la navegación, pero no forman parte de esta versión de prueba. Caja muestra el neto después de comisiones; todavía no descuenta gastos ni calcula la ganancia final.", MARGIN + 18, 310, PAGE_W - 2 * MARGIN - 36, size=9.5, color=MUTED, leading=14)
rounded_card(c, MARGIN, 88, PAGE_W - 2 * MARGIN, 115, fill=INK, stroke=INK)
label(c, "Al finalizar la prueba", MARGIN + 18, 176, color=RED)
c.setFillColor(white)
c.setFont("Arial-Bold", 14)
c.drawString(MARGIN + 18, 149, "Anotá dudas, pasos incómodos o información que falte")
draw_wrapped(c, "Esos comentarios servirán para ajustar el sistema antes de cargar datos reales y pasar a producción.", MARGIN + 18, 124, PAGE_W - 2 * MARGIN - 36, size=9.5, color=HexColor("#D4D4D8"), leading=13)
c.showPage()

c.save()
print(OUT)
