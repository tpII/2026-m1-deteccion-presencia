from pathlib import Path
from io import BytesIO
from html import escape
import sys

import pymupdf as fitz
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.lib.enums import TA_JUSTIFY

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tmp/pdfs/informe-antes-de-revision.pdf'
OUT = ROOT / 'output/pdf/Informe de Avance I M1 revisado.pdf'
PHOTO = Path(sys.argv[1]) if len(sys.argv) > 1 else None

pdfmetrics.registerFont(TTFont('Arial', '/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='ArialBold')
BODY = ParagraphStyle('body', fontName='Arial', fontSize=11, leading=12.65,
                      spaceAfter=9, alignment=TA_JUSTIFY)
SUB = ParagraphStyle('sub', parent=BODY, fontName='ArialBold', spaceBefore=4,
                     spaceAfter=8, alignment=0)
HEAD = ParagraphStyle('head', parent=SUB, fontSize=13, leading=17, spaceAfter=14)
ITEM = ParagraphStyle('item', parent=BODY, leftIndent=36, firstLineIndent=0,
                      bulletIndent=18, bulletFontName='Arial', bulletFontSize=11,
                      spaceAfter=0)
CAPTION = ParagraphStyle('caption', parent=BODY, fontSize=10, leading=13, alignment=1, spaceAfter=12)
editable = []


class Flow:
    def __init__(self, c, y=72, bottom=767):
        self.c, self.y, self.bottom = c, y, bottom

    def paragraph(self, text, style=BODY, record=True, bullet=None):
        self.y += style.spaceBefore
        p = Paragraph(text, style, bulletText=bullet)
        _, height = p.wrap(454, 1000)
        if self.y + height > self.bottom:
            raise ValueError(f'Content exceeds page: {self.y + height}: {text}')
        p.drawOn(self.c, 72, 842 - self.y - height)
        self.y += height + style.spaceAfter
        if record:
            prefix = '### ' if style is SUB else '- ' if bullet else ''
            editable.append(prefix + text.replace('<b>', '**').replace('</b>', '**'))

    def heading(self, text):
        self.paragraph(text, HEAD, record=False)

    def item(self, text):
        self.paragraph(text, ITEM, bullet='●')

    def image(self, data, width, height):
        if self.y + height > self.bottom:
            raise ValueError('Image exceeds page')
        self.c.drawImage(ImageReader(data), (596-width)/2, 842-self.y-height,
                         width=width, height=height, preserveAspectRatio=True)
        self.y += height + 9


def render(draw):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(596, 842))
    draw(c)
    c.showPage()
    c.save()
    return fitz.open(stream=buffer.getvalue(), filetype='pdf')


def patch(page, rect, draw):
    page.add_redact_annot(fitz.Rect(rect), fill=(1, 1, 1))
    page.apply_redactions(images=0, graphics=0)
    with render(draw) as replacement:
        page.show_pdf_page(page.rect, replacement, 0)


def replace(doc, index, draw):
    with render(draw) as replacement:
        doc.delete_page(index)
        doc.insert_pdf(replacement, start_at=index)


doc = fitz.open(SOURCE)
editable.append('## 6.1 Firmware desarrollado para prueba del sensor PIR')


def pir_intro(c):
    f = Flow(c, y=551)
    f.paragraph('Se programó el ESP32 en C++ con el entorno Arduino para leer el sensor PIR y enviar sus lecturas a la computadora. En la prueba se utilizó el módulo HW-416-B, conectado de la siguiente manera:')
    f.item('<b>VCC:</b> al pin VIN/5 V del ESP32.')
    f.item('<b>GND:</b> al pin GND del ESP32.')
    f.item('<b>OUT:</b> al pin GPIO27, configurado como entrada digital.')
    f.paragraph('El ESP32 recibe alimentación por USB. Cuando la salida del PIR está en HIGH se registra movimiento (1); cuando está en LOW se registra ausencia de movimiento (0). El sensor no permite confirmar por sí solo la presencia de una persona inmóvil.')
    f.paragraph('El HC-SR501 de la tabla de partes es un modelo de referencia; el módulo utilizado en este montaje fue el HW-416-B.')


patch(doc[11], (72, 549, 528, 774), pir_intro)


def pir_details(c):
    f = Flow(c)
    f.paragraph('Funcionamiento del programa', SUB)
    f.paragraph('El programa repite una secuencia de lectura y envío. Las bibliotecas WiFi.h y PubSubClient permiten conectar la placa a la red y publicar los datos mediante MQTT.')
    f.item('<b>Conexión:</b> el ESP32 se conecta a Wi-Fi y luego al broker Mosquitto. El archivo de configuración contiene las credenciales de la red, la IP del servidor y el puerto MQTT (1883).')
    f.item('<b>Lectura:</b> consulta GPIO27 cada 200 ms nominales. Interpreta HIGH como movimiento y LOW como ausencia de movimiento.')
    f.item('<b>Comprobación por USB:</b> imprime cada muestra en el monitor serie a 115200 baud, con el texto MOVIMIENTO o SIN MOVIMIENTO.')
    f.item('<b>Envío por MQTT:</b> si hay conexión, publica un mensaje JSON en presence/pir/telemetry. El mensaje incluye el caso, el identificador de la placa y el estado leído, expresado como valor lógico y como 0 o 1.')
    f.item('<b>Recepción:</b> el backend valida el mensaje, registra la hora de llegada, guarda la lectura y actualiza la interfaz web.')
    f.y += 9
    f.paragraph('Si se pierde la conexión, el programa vuelve a intentarlo cada 5 segundos. Las muestras se envían con QoS 0 y sin retain: no se confirma su entrega ni se guarda el último mensaje en el broker. Tampoco se almacenan en el ESP32 para reenviarlas. Los reintentos pueden demorar las lecturas, por lo que el intervalo de 200 ms es aproximado.')


replace(doc, 12, pir_details)
editable.append('## 6.3 Interfaz Web')


def web_intro(c):
    f = Flow(c, y=519)
    f.heading('6.3 Interfaz Web')
    f.paragraph('Se desarrolló una interfaz web para observar las lecturas en tiempo real, consultar el historial y registrar ensayos. Está preparada para trabajar con los tres métodos del proyecto. En este avance se comprobó el funcionamiento con el sensor PIR; la integración y comparación de los casos CSI siguen pendientes.')
    f.paragraph('Recorrido de una lectura', SUB)
    f.item('<b>Adquisición:</b> el ESP32 lee el PIR y envía el estado por Wi-Fi mediante MQTT a Mosquitto.')
    f.item('<b>Registro:</b> el backend recibe el mensaje, valida sus datos y guarda la lectura en SQLite.')
    f.item('<b>Visualización:</b> el backend actualiza la web mediante WebSocket. Las consultas al historial y la gestión de ensayos se realizan mediante REST.')


patch(doc[14], (72, 518, 528, 774), web_intro)


def web_details(c):
    f = Flow(c)
    f.paragraph('Organización y tecnologías utilizadas', SUB)
    f.paragraph('El sistema se divide en una interfaz que muestra los datos y un servidor que los recibe, valida y almacena. El navegador se comunica con FastAPI; la conexión MQTT corresponde al recorrido entre el ESP32, Mosquitto y el backend.')
    f.paragraph('Interfaz de usuario (frontend)', SUB)
    f.item('<b>React y TypeScript:</b> React organiza las pantallas en componentes; TypeScript permite comprobar los tipos de datos utilizados.')
    f.item('<b>Vite y React Router:</b> Vite facilita el desarrollo y la compilación; React Router organiza la navegación entre páginas.')
    f.item('<b>CSS y Apache ECharts:</b> CSS define la presentación y la adapta al tamaño de la pantalla; ECharts representa señales y comparaciones en gráficos.')
    f.paragraph('Servidor (backend)', SUB)
    f.item('<b>Python y FastAPI:</b> implementan las consultas REST y las actualizaciones por WebSocket. Python también permite trabajar con herramientas numéricas como NumPy y SciPy para el procesamiento de CSI.')
    f.item('<b>Pydantic y paho-mqtt:</b> Pydantic valida la estructura de los mensajes; paho-mqtt conecta el servidor con Mosquitto para recibir la telemetría.')
    f.item('<b>SQLite:</b> almacena lecturas y ensayos en una base local, sin requerir un servidor de base de datos adicional.')
    f.paragraph('Prueba por USB', SUB)
    f.paragraph('También se dispone de una página de diagnóstico que lee el puerto serie con Web Serial, en navegadores compatibles. Permite comprobar el sensor y el cableado: el navegador recibe las lecturas por USB y solicita su guardado al backend. El flujo integrado del proyecto utiliza Wi-Fi y MQTT.')


replace(doc, 15, web_details)

if PHOTO:
    if not PHOTO.is_file():
        raise FileNotFoundError(PHOTO)
    screenshot = next(b['image'] for b in doc[16].get_text('dict')['blocks'] if b['type'] == 1)

    def wiring(c):
        f = Flow(c)
        f.heading('7. Documentación Relacionada')
        f.paragraph('Conexionado del sensor PIR', SUB, record=False)
        f.paragraph('La Figura 7 muestra el montaje utilizado para la prueba del Caso 1. El módulo PIR se conectó al ESP32 mediante tres cables: alimentación (VCC a VIN/5 V), masa (GND a GND) y señal de salida (OUT a GPIO27). El ESP32 recibe alimentación por USB.', record=False)
        image_reader = ImageReader(str(PHOTO))
        width_px, height_px = image_reader.getSize()
        height = min(490, 454 * height_px / width_px)
        width = height * width_px / height_px
        f.image(str(PHOTO), width, height)
        f.paragraph('Figura 7: Montaje del módulo PIR y detalle de sus conexiones.', CAPTION, record=False)
        f.paragraph('La fotografía documenta el montaje. La asignación de pines corresponde a la configuración de la prueba descrita en la sección 6.1.', record=False)

    def related(c):
        f = Flow(c)
        f.paragraph('Registro del desarrollo de la interfaz', SUB, record=False)
        f.paragraph('Se conserva una captura de la interfaz durante su desarrollo inicial. Esta imagen corresponde a una etapa anterior y no representa un resultado experimental ni la versión actual de la prueba MQTT con hardware.', record=False)
        f.image(BytesIO(screenshot), 454, 454 * 196.5 / 421.5)
        f.paragraph('Figura 8: Captura de la interfaz durante su desarrollo inicial.', CAPTION, record=False)
        f.paragraph('La bitácora reúne las tareas realizadas, las dificultades encontradas y las decisiones tomadas durante el proyecto:', record=False)
        f.paragraph('<link href="https://github.com/tpII/2026-m1-deteccion-presencia/blob/main/BITACORA.md" color="black">github.com/tpII/2026-m1-deteccion-presencia/blob/main/BITACORA.md</link>', record=False)
        f.paragraph('Queda pendiente incorporar una captura actualizada de las lecturas reales por MQTT. Los videos de las pruebas se enlazan en la sección 8.', record=False)

    replace(doc, 16, wiring)
    with render(related) as new_page:
        doc.insert_pdf(new_page, start_at=17)

# Keep the index aligned with the actual printed page numbers.
entries = [
    ('1. Introducción', 1), ('2. Objetivo', 1),
    ('3. Esquema Gráfico del Proyecto', 3), ('4. Identificación de Partes', 6),
    ('4.1. Alimentación del sistema', 7), ('4.2. Software y procesamiento de datos', 7),
    ('4.3. Sistema de visualización web', 8), ('5. Avances Cronológicos de Tareas', 9),
    ('5.1. Informe de Avance/Entregable de Octubre', 10),
    ('5.2. Avance/Entregable de Noviembre', 10),
    ('6. Grado de Avance, Problemas y Soluciones', 10),
    ('6.1. Firmware desarrollado para prueba del sensor PIR', 10),
    ('6.2. Firmware desarrollado para prueba de obtención de señal CSI', 12),
    ('6.3. Interfaz Web', 13), ('7. Documentación Relacionada', 15),
    ('8. Documentación en Video', 17 if PHOTO else 16),
    ('9. Bibliografía', 17 if PHOTO else 16),
]


def index(c):
    c.setFont('Arial', 11)
    for i, (title, number) in enumerate(entries):
        y = 842 - 112 - i * 17
        c.drawString(72, y, title)
        c.drawRightString(526, y, str(number))


patch(doc[1], (72, 100, 528, 390), index)
for i in range(2, len(doc)):
    def footer(c, number=i-1):
        c.setFont('Arial', 11)
        c.drawCentredString(298, 42, str(number))
    patch(doc[i], (270, 781, 324, 812), footer)

doc.set_metadata({**doc.metadata, 'title': 'Informe de Avance I M1',
                  'subject': 'Revisión de redacción de las secciones 6.1 y 6.3 y documentación del conexionado'})
doc.save(OUT, garbage=4, deflate=True)
doc.close()

md = ROOT / 'output/pdf/Secciones 6.1 y 6.3 revisadas.md'
md.write_text('\n\n'.join(editable) + '\n', encoding='utf-8')
print(OUT)
print(md)
