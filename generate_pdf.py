"""
Generate an aesthetic PDF from AI_ARCHITECTURE.md
Dark tech aesthetic with proper visuals, diagrams, and syntax highlighting.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, Color, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Flowable, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle, Polygon, Group
from reportlab.graphics import renderPDF
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
from io import BytesIO
import textwrap

# ── Color Palette (Dark Tech) ──────────────────────────────────
BG_DARK = HexColor("#0D1117")
BG_CARD = HexColor("#161B22")
BG_CODE = HexColor("#1C2333")
BG_ACCENT = HexColor("#21262D")
BORDER = HexColor("#30363D")
TEXT_PRIMARY = HexColor("#E6EDF3")
TEXT_SECONDARY = HexColor("#8B949E")
TEXT_MUTED = HexColor("#6E7681")
ACCENT_BLUE = HexColor("#58A6FF")
ACCENT_PURPLE = HexColor("#BC8CFF")
ACCENT_GREEN = HexColor("#3FB950")
ACCENT_ORANGE = HexColor("#D29922")
ACCENT_RED = HexColor("#F85149")
ACCENT_TEAL = HexColor("#39D2C0")
ACCENT_PINK = HexColor("#F778BA")
ACCENT_CYAN = HexColor("#79C0FF")

# Page setup
PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch


# ── Custom Flowables ───────────────────────────────────────────

class DarkBackground(Flowable):
    """Fill entire page with dark background."""
    def __init__(self, width, height, color=BG_DARK):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.color = color

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(-MARGIN, -self.height - MARGIN, PAGE_W, PAGE_H, fill=1, stroke=0)


class GlowLine(Flowable):
    """A glowing horizontal line separator."""
    def __init__(self, width, color=ACCENT_BLUE, thickness=1.5):
        Flowable.__init__(self)
        self.width = width
        self.height = 8
        self.color = color
        self.thickness = thickness

    def draw(self):
        c = self.canv
        # Glow effect (wider, lighter)
        glow = Color(self.color.red, self.color.green, self.color.blue, 0.15)
        c.setStrokeColor(glow)
        c.setLineWidth(6)
        c.line(0, 4, self.width, 4)
        # Main line
        c.setStrokeColor(self.color)
        c.setLineWidth(self.thickness)
        c.line(0, 4, self.width, 4)


class GradientBox(Flowable):
    """A box with gradient-like effect and content."""
    def __init__(self, width, height, text, color1, color2, text_style):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.text = text
        self.color1 = color1
        self.color2 = color2
        self.text_style = text_style

    def draw(self):
        c = self.canv
        # Background
        c.setFillColor(self.color1)
        c.roundRect(0, 0, self.width, self.height, 8, fill=1, stroke=0)
        # Accent stripe
        c.setFillColor(self.color2)
        c.roundRect(0, 0, 4, self.height, 2, fill=1, stroke=0)


class CodeBlock(Flowable):
    """Styled code block with dark background and syntax coloring."""
    def __init__(self, code, width, language="typescript"):
        Flowable.__init__(self)
        self.code = code
        self.bwidth = width
        self.language = language
        self._lines = code.strip().split('\n')
        self._line_height = 11
        self._padding = 12
        self.height = len(self._lines) * self._line_height + self._padding * 2 + 20
        self.width = width

    def draw(self):
        c = self.canv
        # Background
        c.setFillColor(BG_CODE)
        c.roundRect(0, 0, self.bwidth, self.height, 6, fill=1, stroke=0)

        # Border
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.bwidth, self.height, 6, fill=0, stroke=1)

        # Language label
        c.setFillColor(TEXT_MUTED)
        c.setFont("Helvetica", 7)
        c.drawString(self._padding, self.height - 14, self.language)

        # Code lines
        y = self.height - 28
        for i, line in enumerate(self._lines):
            # Line number
            c.setFillColor(TEXT_MUTED)
            c.setFont("Courier", 8)
            c.drawRightString(self._padding + 20, y, str(i + 1))

            # Code text with basic coloring
            x = self._padding + 28
            self._draw_colored_line(c, x, y, line)
            y -= self._line_height

    def _draw_colored_line(self, c, x, y, line):
        """Basic syntax coloring."""
        keywords = {'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
                    'async', 'await', 'import', 'from', 'export', 'interface', 'type', 'enum',
                    'class', 'new', 'this', 'create', 'select', 'table', 'not', 'null', 'default',
                    'as', 'where', 'and', 'or', 'order', 'by', 'desc', 'limit', 'in', 'on',
                    'primary', 'key', 'references', 'cascade', 'index', 'using', 'with', 'schema',
                    'extension', 'exists', 'text', 'integer', 'float', 'boolean', 'jsonb', 'uuid'}
        types = {'string', 'number', 'boolean', 'void', 'any', 'Record', 'Array', 'Promise',
                 'ReadableStream', 'Partial'}

        c.setFont("Courier", 8.5)
        tokens = line.split(' ')
        for token in tokens:
            clean = token.strip('(){}[];:,.')
            if clean in keywords:
                c.setFillColor(ACCENT_PURPLE)
            elif clean in types:
                c.setFillColor(ACCENT_TEAL)
            elif token.startswith("'") or token.startswith('"'):
                c.setFillColor(ACCENT_GREEN)
            elif token.startswith('//') or token.startswith('#'):
                c.setFillColor(TEXT_MUTED)
            elif any(ch.isdigit() for ch in clean) and clean.replace('.', '').replace('-', '').isdigit():
                c.setFillColor(ACCENT_ORANGE)
            else:
                c.setFillColor(TEXT_SECONDARY)

            c.drawString(x, y, token + ' ')
            x += c.stringWidth(token + ' ', "Courier", 8.5)


class ArchitectureDiagram(Flowable):
    """Visual system architecture diagram."""
    def __init__(self, width):
        Flowable.__init__(self)
        self.width = width
        self.height = 380

    def draw(self):
        c = self.canv

        # Background
        c.setFillColor(BG_CARD)
        c.roundRect(0, 0, self.width, self.height, 10, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, 10, fill=0, stroke=1)

        box_w = self.width - 40
        left = 20

        # ── Client Box ──
        self._draw_box(c, left, 290, box_w, 75, "CLIENT (React + Vite)", ACCENT_BLUE,
                       ["Upload \u2192 Processing UI \u2192 Explorer (Graph + Inspector + Chat)",
                        "Zustand store \u2190 SSE streams from backend"])

        # Arrow down
        self._draw_arrow(c, self.width / 2, 290, self.width / 2, 260, ACCENT_BLUE)
        c.setFillColor(TEXT_MUTED)
        c.setFont("Helvetica", 7)
        c.drawCentredString(self.width / 2 + 40, 270, "HTTPS / SSE")

        # ── API Server Box ──
        self._draw_box(c, left, 145, box_w, 110, "API SERVER (Node.js + Hono, port 3007)", ACCENT_PURPLE,
                       ["POST /api/pipeline/start      \u2192 Kick off ingestion pipeline",
                        "GET  /api/pipeline/:id/stream  \u2192 SSE pipeline progress",
                        "POST /api/chat                 \u2192 RAG-powered chat (streaming)",
                        "POST /api/proactive            \u2192 Get next proactive action",
                        "POST /api/explain              \u2192 Explain a specific node",
                        "",
                        "Anthropic SDK (Sonnet + Haiku)  |  OpenAI Embeddings  |  Supabase"])

        # Arrow down
        self._draw_arrow(c, self.width / 2, 145, self.width / 2, 115, ACCENT_PURPLE)

        # ── Supabase Box ──
        self._draw_box(c, left, 10, box_w, 100, "SUPABASE", ACCENT_GREEN,
                       ["Tables: projects, files, concepts, concept_edges,",
                        "        code_chunks, user_state, insights, chat_messages",
                        "",
                        "pgvector: HNSW index (cosine)  |  Full-text: GIN index",
                        "Hybrid search: 70% vector / 30% lexical"])

    def _draw_box(self, c, x, y, w, h, title, color, lines):
        # Box background
        c.setFillColor(BG_CODE)
        c.roundRect(x, y, w, h, 6, fill=1, stroke=0)

        # Colored left border
        c.setFillColor(color)
        c.roundRect(x, y, 4, h, 2, fill=1, stroke=0)

        # Border
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(x, y, w, h, 6, fill=0, stroke=1)

        # Title
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 14, y + h - 16, title)

        # Content lines
        c.setFont("Courier", 7)
        c.setFillColor(TEXT_SECONDARY)
        line_y = y + h - 30
        for line in lines:
            c.drawString(x + 14, line_y, line)
            line_y -= 10

    def _draw_arrow(self, c, x1, y1, x2, y2, color):
        c.setStrokeColor(color)
        c.setLineWidth(1.5)
        c.line(x1, y1, x2, y2)
        # Arrowhead
        c.setFillColor(color)
        p = c.beginPath()
        p.moveTo(x2 - 4, y2 + 6)
        p.lineTo(x2, y2)
        p.lineTo(x2 + 4, y2 + 6)
        p.close()
        c.drawPath(p, fill=1, stroke=0)


class PipelineDiagram(Flowable):
    """Visual pipeline flow diagram."""
    def __init__(self, width):
        Flowable.__init__(self)
        self.width = width
        self.height = 520

    def draw(self):
        c = self.canv

        # Background
        c.setFillColor(BG_CARD)
        c.roundRect(0, 0, self.width, self.height, 10, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, 10, fill=0, stroke=1)

        stages = [
            ("ZIP Upload", "Client-side", ACCENT_BLUE, "User drops file"),
            ("Stage 1", "File Extraction", ACCENT_BLUE, "Parse ZIP, detect imports, classify files"),
            ("Stage 2", "File Analysis", ACCENT_ORANGE, "Batches of 15 \u2192 Claude Haiku (sequential, 60s waits)"),
            ("Stage 3", "Concept Synthesis", ACCENT_PURPLE, "1 Sonnet call \u2192 concept graph (3-20 nodes)"),
            ("Stage 4", "Depth Mapping", ACCENT_TEAL, "1 Sonnet call \u2192 beginner/intermediate/advanced explanations"),
            ("Stage 5", "Insight Generation", ACCENT_PINK, "1 Sonnet call \u2192 10-20 insights (6 categories)"),
            ("Stage 6", "Embedding & Indexing", ACCENT_GREEN, "~800-token chunks \u2192 OpenAI embeddings \u2192 pgvector"),
            ("Stage 7", "Proactive Seeding", ACCENT_CYAN, "1 Sonnet call \u2192 exploration path for user"),
        ]

        box_w = self.width - 60
        box_h = 44
        x = 30
        y_start = self.height - 30

        for i, (label, name, color, desc) in enumerate(stages):
            y = y_start - i * (box_h + 16)

            # Connecting line
            if i > 0:
                c.setStrokeColor(BORDER)
                c.setLineWidth(1)
                c.setDash(3, 3)
                c.line(self.width / 2, y + box_h, self.width / 2, y + box_h + 16)
                c.setDash()

                # Arrow
                c.setFillColor(BORDER)
                p = c.beginPath()
                p.moveTo(self.width / 2 - 3, y + box_h + 4)
                p.lineTo(self.width / 2, y + box_h)
                p.lineTo(self.width / 2 + 3, y + box_h + 4)
                p.close()
                c.drawPath(p, fill=1, stroke=0)

            # Stage box
            c.setFillColor(BG_CODE)
            c.roundRect(x, y, box_w, box_h, 5, fill=1, stroke=0)

            # Left accent
            c.setFillColor(color)
            c.roundRect(x, y, 4, box_h, 2, fill=1, stroke=0)

            # Stage number circle
            c.setFillColor(color)
            c.circle(x + 20, y + box_h / 2, 10, fill=1, stroke=0)
            c.setFillColor(BG_DARK)
            c.setFont("Helvetica-Bold", 8)
            if i == 0:
                c.drawCentredString(x + 20, y + box_h / 2 - 3, "\u25B2")
            else:
                c.drawCentredString(x + 20, y + box_h / 2 - 3, str(i))

            # Label
            c.setFillColor(color)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(x + 36, y + box_h - 15, f"{label}: {name}")

            # Description
            c.setFillColor(TEXT_SECONDARY)
            c.setFont("Helvetica", 7.5)
            c.drawString(x + 36, y + 8, desc)

            # Milestone marker after Stage 3
            if i == 3:
                c.setFillColor(ACCENT_GREEN)
                c.setFont("Helvetica-BoldOblique", 7)
                c.drawRightString(x + box_w - 10, y + 8, "\u2605 Graph renders here \u2014 user can start exploring")


class DataFlowDiagram(Flowable):
    """Visual data flow diagram for user interactions."""
    def __init__(self, width):
        Flowable.__init__(self)
        self.width = width
        self.height = 260

    def draw(self):
        c = self.canv

        c.setFillColor(BG_CARD)
        c.roundRect(0, 0, self.width, self.height, 10, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, 10, fill=0, stroke=1)

        # Title
        c.setFillColor(ACCENT_BLUE)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20, self.height - 22, "Runtime Data Flow")

        # Three columns
        col_w = (self.width - 60) / 3
        cols = [
            ("Upload Flow", ACCENT_BLUE, [
                "1. User drops ZIP",
                "2. Client extracts files",
                "3. POST /api/pipeline/start",
                "4. Server creates project",
                "5. Client subscribes SSE",
                "6. Stages 2-7 run async",
                "7. Graph renders after S3",
            ]),
            ("Explore Flow", ACCENT_PURPLE, [
                "1. Click concept node",
                "2. Update Zustand state",
                "3. Sync state (5s debounce)",
                "4. POST /api/explain",
                "5. RAG retrieval + Claude",
                "6. Stream to InspectorPanel",
                "7. Proactive engine fires",
            ]),
            ("Chat Flow", ACCENT_GREEN, [
                "1. User types question",
                "2. POST /api/chat",
                "3. Embed question (OpenAI)",
                "4. Hybrid search (70/30)",
                "5. Retrieve code chunks",
                "6. Stream Claude response",
                "7. Parse [[concept:]] links",
            ]),
        ]

        for col_i, (title, color, steps) in enumerate(cols):
            x = 20 + col_i * (col_w + 10)
            y_top = self.height - 45

            # Column header
            c.setFillColor(color)
            c.roundRect(x, y_top, col_w, 20, 3, fill=1, stroke=0)
            c.setFillColor(BG_DARK)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x + col_w / 2, y_top + 6, title)

            # Steps
            for si, step in enumerate(steps):
                sy = y_top - 24 - si * 22
                # Step box
                c.setFillColor(BG_CODE)
                c.roundRect(x + 2, sy, col_w - 4, 18, 3, fill=1, stroke=0)
                c.setFillColor(TEXT_SECONDARY)
                c.setFont("Helvetica", 7)
                c.drawString(x + 8, sy + 5, step)

                # Arrow between steps
                if si < len(steps) - 1:
                    c.setStrokeColor(Color(color.red, color.green, color.blue, 0.3))
                    c.setLineWidth(0.5)
                    c.line(x + col_w / 2, sy, x + col_w / 2, sy - 4)


class ProactiveEngineDiagram(Flowable):
    """Visual representation of the proactive engine rules."""
    def __init__(self, width):
        Flowable.__init__(self)
        self.width = width
        self.height = 200

    def draw(self):
        c = self.canv

        c.setFillColor(BG_CARD)
        c.roundRect(0, 0, self.width, self.height, 10, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, 10, fill=0, stroke=1)

        # Title
        c.setFillColor(ACCENT_TEAL)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20, self.height - 22, "Proactive Engine \u2014 Decision Rules (Deterministic, No AI)")

        rules = [
            ("Rule 1", "New user", "highlight_concept", "Pulse starting concept", ACCENT_BLUE),
            ("Rule 2", "Path exists", "suggest next", "Guide along exploration path", ACCENT_PURPLE),
            ("Rule 3", "10-30s on node", "deepen_current", "Offer deeper explanation", ACCENT_TEAL),
            ("Rule 4", "Has connections", "suggest_connection", "Highlight unseen neighbor", ACCENT_GREEN),
            ("Rule 5", "Prereqs met", "show_insight", "Display insight card", ACCENT_ORANGE),
            ("Rule 6", ">70% explored", "show_summary", "Show progress summary", ACCENT_PINK),
        ]

        y = self.height - 48
        for label, condition, action, desc, color in rules:
            # Rule box
            c.setFillColor(BG_CODE)
            c.roundRect(20, y, self.width - 40, 22, 3, fill=1, stroke=0)

            # Left accent
            c.setFillColor(color)
            c.roundRect(20, y, 3, 22, 1, fill=1, stroke=0)

            # Rule number
            c.setFillColor(color)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(30, y + 7, label)

            # Condition
            c.setFillColor(TEXT_SECONDARY)
            c.setFont("Helvetica", 7.5)
            c.drawString(80, y + 7, condition)

            # Arrow
            c.setFillColor(TEXT_MUTED)
            c.drawString(165, y + 7, "\u2192")

            # Action
            c.setFillColor(ACCENT_CYAN)
            c.setFont("Courier", 7)
            c.drawString(180, y + 7, action)

            # Description
            c.setFillColor(TEXT_MUTED)
            c.setFont("Helvetica", 7)
            c.drawString(310, y + 7, desc)

            y -= 26


# ── Page Background ────────────────────────────────────────────

def draw_page_bg(canvas_obj, doc):
    """Draw dark background and subtle grid on every page."""
    canvas_obj.saveState()
    # Dark background
    canvas_obj.setFillColor(BG_DARK)
    canvas_obj.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Subtle dot grid
    canvas_obj.setFillColor(HexColor("#1A1F2B"))
    for gx in range(0, int(PAGE_W), 20):
        for gy in range(0, int(PAGE_H), 20):
            canvas_obj.circle(gx, gy, 0.3, fill=1, stroke=0)

    # Footer
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.drawString(MARGIN, 0.5 * inch, "Codebase Explorer \u2014 AI Architecture")
    canvas_obj.drawRightString(PAGE_W - MARGIN, 0.5 * inch, f"Page {doc.page}")

    canvas_obj.restoreState()


# ── Styles ─────────────────────────────────────────────────────

def get_styles():
    content_width = PAGE_W - 2 * MARGIN

    return {
        'title': ParagraphStyle(
            'Title',
            fontName='Helvetica-Bold',
            fontSize=28,
            leading=34,
            textColor=TEXT_PRIMARY,
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        'subtitle': ParagraphStyle(
            'Subtitle',
            fontName='Helvetica',
            fontSize=12,
            leading=16,
            textColor=TEXT_SECONDARY,
            alignment=TA_LEFT,
            spaceAfter=20,
        ),
        'h1': ParagraphStyle(
            'H1',
            fontName='Helvetica-Bold',
            fontSize=20,
            leading=26,
            textColor=ACCENT_BLUE,
            alignment=TA_LEFT,
            spaceBefore=24,
            spaceAfter=8,
        ),
        'h2': ParagraphStyle(
            'H2',
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=20,
            textColor=ACCENT_PURPLE,
            alignment=TA_LEFT,
            spaceBefore=18,
            spaceAfter=6,
        ),
        'h3': ParagraphStyle(
            'H3',
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=ACCENT_TEAL,
            alignment=TA_LEFT,
            spaceBefore=12,
            spaceAfter=4,
        ),
        'body': ParagraphStyle(
            'Body',
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=TEXT_SECONDARY,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        'body_bold': ParagraphStyle(
            'BodyBold',
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=13,
            textColor=TEXT_PRIMARY,
            spaceAfter=4,
        ),
        'bullet': ParagraphStyle(
            'Bullet',
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=TEXT_SECONDARY,
            leftIndent=16,
            bulletIndent=4,
            spaceAfter=3,
        ),
        'caption': ParagraphStyle(
            'Caption',
            fontName='Helvetica-Oblique',
            fontSize=8,
            leading=11,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        'number': ParagraphStyle(
            'Number',
            fontName='Helvetica-Bold',
            fontSize=36,
            leading=40,
            textColor=ACCENT_BLUE,
        ),
    }


def styled_table(data, col_widths, header_color=ACCENT_BLUE):
    """Create a dark-themed table."""
    t = Table(data, colWidths=col_widths)

    style_commands = [
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), BG_DARK),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),

        # Body
        ('BACKGROUND', (0, 1), (-1, -1), BG_CODE),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_SECONDARY),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),

        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_CODE, BG_CARD]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]

    t.setStyle(TableStyle(style_commands))
    return t


# ── Build Document ─────────────────────────────────────────────

def build_pdf(output_path):
    content_width = PAGE_W - 2 * MARGIN
    s = get_styles()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    story = []

    # ════════════════════════════════════════
    # COVER PAGE
    # ════════════════════════════════════════
    story.append(Spacer(1, 1.5 * inch))
    story.append(GlowLine(content_width, ACCENT_BLUE, 2))
    story.append(Spacer(1, 20))

    story.append(Paragraph("AI Architecture", s['title']))
    story.append(Paragraph(
        '<font color="#58A6FF">Codebase Explorer</font> \u2014 '
        'A proactive, adaptive codebase understanding system',
        s['subtitle']))
    story.append(Spacer(1, 10))
    story.append(GlowLine(content_width, ACCENT_PURPLE, 1))
    story.append(Spacer(1, 30))

    # Key stats
    stats_data = [
        ["7-Stage Pipeline", "Hybrid RAG", "Proactive Engine", "Real-time Streaming"],
        ["Claude Sonnet + Haiku", "pgvector + Full-text", "Deterministic Rules", "SSE via Hono"],
    ]
    stats_table = Table(stats_data, colWidths=[content_width / 4] * 4)
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_CARD),
        ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT_BLUE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('TEXTCOLOR', (0, 1), (-1, 1), TEXT_MUTED),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, 1), 7.5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING', (0, 1), (-1, 1), 2),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 14),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 30))

    # Tech stack
    story.append(Paragraph(
        '<font color="#8B949E">React + Vite + Zustand + Canvas &nbsp;|&nbsp; '
        'Node.js + Hono &nbsp;|&nbsp; Supabase + pgvector &nbsp;|&nbsp; '
        'Anthropic SDK + OpenAI Embeddings</font>',
        ParagraphStyle('TechStack', fontName='Helvetica', fontSize=8, leading=12,
                        textColor=TEXT_MUTED, alignment=TA_CENTER)))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # TABLE OF CONTENTS
    # ════════════════════════════════════════
    story.append(Paragraph("Contents", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 12))

    toc_items = [
        ("1", "Design Principles", "Core architectural philosophy"),
        ("2", "System Architecture", "Three-tier overview with visual diagram"),
        ("3", "Ingestion Pipeline", "7-stage ZIP-to-knowledge-base transformation"),
        ("4", "Semantic Memory (RAG)", "Hybrid retrieval with pgvector + full-text search"),
        ("5", "User Model", "Exploration tracking and understanding estimation"),
        ("6", "Proactive Engine", "Deterministic UI guidance system"),
        ("7", "Chat System", "RAG-powered streaming conversation"),
        ("8", "End-to-End Data Flows", "Upload, explore, and chat workflows"),
        ("9", "File Structure", "Server and client directory layout"),
        ("10", "Cost Estimates", "Per-pipeline and per-interaction costs"),
    ]

    toc_cell_style = ParagraphStyle('TocCell', fontName='Helvetica', fontSize=9, leading=13, textColor=TEXT_PRIMARY)
    toc_desc_style = ParagraphStyle('TocDesc', fontName='Helvetica', fontSize=7, leading=10, textColor=TEXT_MUTED)

    for num, title, desc in toc_items:
        from reportlab.platypus import ListFlowable
        cell_content = [
            Paragraph(f'<b>{title}</b>', toc_cell_style),
            Paragraph(desc, toc_desc_style),
        ]
        toc_row = Table(
            [[num, cell_content]],
            colWidths=[30, content_width - 40]
        )
        toc_row.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), BG_CODE),
            ('TEXTCOLOR', (0, 0), (0, 0), ACCENT_BLUE),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, 0), 11),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (1, 0), (1, 0), BG_CARD),
            ('LEFTPADDING', (1, 0), (1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ]))
        story.append(toc_row)
        story.append(Spacer(1, 3))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 1. DESIGN PRINCIPLES
    # ════════════════════════════════════════
    story.append(Paragraph("1. Design Principles", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    principles = [
        ("No frameworks", "Uses Anthropic's SDK directly with composable patterns (prompt chaining, parallelization, orchestrator-workers, routing, evaluator-optimizer). No LangChain, no LangGraph.", ACCENT_BLUE),
        ("Structured outputs everywhere", "Every Claude call uses tool-use (tool_choice: { type: 'tool', name: schemaName }) for guaranteed valid JSON. No regex parsing, no try/catch on malformed responses.", ACCENT_PURPLE),
        ("Stream everything user-facing", "Pipeline progress, chat responses, and proactive insights all stream via SSE. The user never stares at a spinner wondering if something is broken.", ACCENT_GREEN),
        ("Start simple, add complexity only where it improves outcomes", "Each pipeline stage exists because a single call demonstrably cannot produce the same quality output.", ACCENT_ORANGE),
        ("Grounded in real code", "Every explanation, insight, and answer references actual files and line numbers from the user's codebase, retrieved via RAG \u2014 never from Claude's general training knowledge.", ACCENT_TEAL),
    ]

    principle_title_style = ParagraphStyle('PrincipleTitle', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=TEXT_PRIMARY)
    principle_desc_style = ParagraphStyle('PrincipleDesc', fontName='Helvetica', fontSize=8, leading=12, textColor=TEXT_SECONDARY)

    for i, (title, desc, color) in enumerate(principles):
        cell_content = [
            Paragraph(f'<b>{title}</b>', ParagraphStyle('PT', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=color)),
            Paragraph(desc, principle_desc_style),
        ]
        row_table = Table([[str(i + 1), cell_content]], colWidths=[35, content_width - 45])
        row_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), color),
            ('TEXTCOLOR', (0, 0), (0, 0), BG_DARK),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, 0), 14),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (1, 0), (1, 0), BG_CARD),
            ('LEFTPADDING', (1, 0), (1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ]))
        story.append(row_table)
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 2. SYSTEM ARCHITECTURE
    # ════════════════════════════════════════
    story.append(Paragraph("2. System Architecture", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(ArchitectureDiagram(content_width))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Three-tier architecture: React client, Hono API server, and Supabase persistence layer.", s['caption']))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Why Hono", s['h3']))
    story.append(Paragraph(
        "The app is Vite + React. Adding Next.js would mean migrating the entire frontend or running two separate frameworks. "
        "Cloudflare Workers have execution time limits that complicate multi-minute pipelines. "
        "<b>Hono</b> is lightweight (~14KB), runs on Node.js alongside the existing Vite dev server, "
        "has first-class SSE streaming support, and can deploy to Cloudflare Workers, Vercel Edge, or plain Node.js later. "
        "In development, Vite proxies /api/* to the Hono server on port 3007.",
        s['body']))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 3. INGESTION PIPELINE
    # ════════════════════════════════════════
    story.append(Paragraph("3. Ingestion Pipeline", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "The pipeline transforms a ZIP file into a rich, queryable knowledge base. It runs as an async background job \u2014 "
        "the client gets a project ID immediately and subscribes to progress updates via SSE from /api/pipeline/:id/stream.",
        s['body']))
    story.append(Spacer(1, 6))

    story.append(PipelineDiagram(content_width))
    story.append(Spacer(1, 6))
    story.append(Paragraph("7-stage pipeline from ZIP upload to fully-indexed knowledge base.", s['caption']))

    story.append(PageBreak())

    # Stage details
    stages_detail = [
        ("Stage 1: File Extraction & Classification", ACCENT_BLUE, "Client (fileParser.js)", [
            "Extracts ZIP, filters out non-code files (node_modules, .git, dist, build)",
            "Identifies code files by extension",
            "Extracts imports via regex (ES6, CommonJS, Python, Go, Rust)",
            "Resolves relative import paths to actual file paths",
            "Sends file tree, contents, and import edges to server",
        ]),
        ("Stage 2: Sequential File Analysis", ACCENT_ORANGE, "Server \u2192 Claude Haiku", [
            "Files processed in batches of 15 (content truncated to 1,500 chars)",
            "Batches run sequentially with 60-second waits between (rate limiting)",
            "Structured output via tool-use: path, purpose, concepts, key_exports, depends_on, complexity, role",
            "Failed batches fall back to minimal stub analyses",
            "Results stored in Supabase files table",
        ]),
        ("Stage 3: Concept Synthesis", ACCENT_PURPLE, "Server \u2192 1 Claude Sonnet call", [
            "Receives all file analyses + framework detection",
            "Identifies natural conceptual groupings (3-20 concepts)",
            "Each concept: id, name, emoji, color, metaphor, one_liner, explanation, deep_explanation",
            "Generates edges with relationship labels and strength",
            "Returns suggested starting concept and codebase summary",
            "Graph renders in UI at this point \u2014 user can start exploring",
        ]),
        ("Stage 4: Depth Mapping", ACCENT_TEAL, "Server \u2192 1 Claude Sonnet call", [
            "Generates multi-level explanations for each concept",
            "Beginner: only analogies and everyday language, no code terms",
            "Intermediate: mentions technical terms but explains inline",
            "Advanced: assumes programming familiarity, references specific patterns",
            "Powers the adaptive explanation system in InspectorPanel",
        ]),
        ("Stage 5: Insight Generation", ACCENT_PINK, "Server \u2192 1 Claude Sonnet call", [
            "Prompt: think like a senior engineer doing a code review",
            "6 categories: architecture, risk, pattern, praise, suggestion, complexity",
            "Each insight: title, category, summary, detail, related concepts/files",
            "Priority scoring (1-10) and prerequisite concepts for ordering",
        ]),
        ("Stage 6: Embedding & Indexing", ACCENT_GREEN, "Server \u2192 OpenAI API", [
            "Splits each file into ~800-token chunks with 10% overlap",
            "Contextual prefix per chunk: file path, purpose, concept name",
            "Embeds with OpenAI text-embedding-3-small (1536 dimensions)",
            "Batch processing: up to 2,048 texts per API call",
            "Stored in pgvector with HNSW index (cosine) + GIN full-text index",
        ]),
        ("Stage 7: Proactive Seeding", ACCENT_CYAN, "Server \u2192 1 Claude Sonnet call", [
            "Generates ordered exploration path for the user",
            "Based on concept graph, insights, and suggested starting concept",
            "Not a rigid tour \u2014 proactive engine adjusts in real-time",
            "Stored in user_state table as exploration_path array",
        ]),
    ]

    for title, color, runner, points in stages_detail:
        story.append(Paragraph(title, s['h2']))

        # Runner info
        runner_para = Paragraph(
            f'<font color="{color.hexval()}"><b>Runs on:</b></font> '
            f'<font color="#8B949E">{runner}</font>', s['body'])
        story.append(runner_para)

        for point in points:
            story.append(Paragraph(
                f'<font color="{color.hexval()}">\u2022</font> {point}',
                s['bullet']))
        story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 4. SEMANTIC MEMORY (RAG)
    # ════════════════════════════════════════
    story.append(Paragraph("4. Semantic Memory (RAG)", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Every time the app explains something, it must reference actual code. The RAG system ensures "
        "explanations are grounded in the user's codebase, not Claude's training data.",
        s['body']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Retrieval Flow", s['h2']))

    rag_steps = [
        ("1", "Generate query embedding from the question/topic (OpenAI text-embedding-3-small)", ACCENT_BLUE),
        ("2", "Call search_code_chunks RPC via Supabase with query embedding + optional concept filter", ACCENT_PURPLE),
        ("3", "Hybrid search: 70% vector similarity (cosine) + 30% lexical (tsvector)", ACCENT_GREEN),
        ("4", "Fallback: if RPC fails, simple full-text search without embeddings", ACCENT_ORANGE),
        ("5", "Format retrieved chunks as XML-tagged context for Claude", ACCENT_TEAL),
        ("6", "Stream Claude response with retrieved context + user's understanding level", ACCENT_CYAN),
    ]

    for num, desc, color in rag_steps:
        row = Table([[num, desc]], colWidths=[30, content_width - 40])
        row.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), color),
            ('TEXTCOLOR', (0, 0), (0, 0), BG_DARK),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, 0), 10),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (1, 0), (1, 0), BG_CARD),
            ('TEXTCOLOR', (1, 0), (1, 0), TEXT_SECONDARY),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica'),
            ('FONTSIZE', (1, 0), (1, 0), 8),
            ('LEFTPADDING', (1, 0), (1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('ROUNDEDCORNERS', [3, 3, 3, 3]),
        ]))
        story.append(row)
        story.append(Spacer(1, 3))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Database Schema", s['h2']))
    story.append(Spacer(1, 6))

    schema_data = [
        ["Table", "Purpose", "Key Columns"],
        ["projects", "One row per uploaded codebase", "name, framework, pipeline_status, pipeline_progress"],
        ["files", "Every code file with analysis", "path, content, analysis (jsonb), concept_id, role"],
        ["concepts", "Extracted concepts", "name, emoji, metaphor, explanation, beginner/intermediate/advanced"],
        ["concept_edges", "Relationships between concepts", "source_key, target_key, relationship, strength"],
        ["code_chunks", "Chunked code for RAG", "content, context_summary, embedding (vector 1536), fts"],
        ["user_state", "Exploration tracking", "explored_concepts, time_per_concept, understanding_level"],
        ["insights", "Proactive insights queue", "title, category, summary, priority, requires_understanding"],
        ["chat_messages", "Conversation history", "role, content, context (jsonb)"],
    ]

    schema_table = styled_table(schema_data, [70, 155, content_width - 235], ACCENT_GREEN)
    story.append(schema_table)

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 5. USER MODEL
    # ════════════════════════════════════════
    story.append(Paragraph("5. User Model", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Tracking Signals", s['h2']))

    tracking_data = [
        ["Signal", "How Collected", "What It Tells Us"],
        ["Concepts viewed", "Click/tap on concept node", "What they've seen"],
        ["Time per concept", "Timer from select to deselect", "How much they engaged"],
        ["Files opened", "Click on file in inspector", "Depth of exploration"],
        ["Insights interaction", "Dismiss vs expand behavior", "What interests them"],
        ["Questions asked", "Chat input", "What they don't understand"],
    ]
    story.append(styled_table(tracking_data, [100, 160, content_width - 270], ACCENT_PURPLE))

    story.append(Spacer(1, 12))
    story.append(Paragraph("Understanding Level Estimation", s['h2']))

    level_data = [
        ["Level", "Time Threshold", "UI Behavior"],
        ["unseen", "Not viewed", "Default explanation hidden"],
        ["glanced", "< 5 seconds", "Brief summary shown"],
        ["beginner", "5 - 30 seconds", "Beginner-level explanation (analogies only)"],
        ["intermediate", "30 - 120 seconds", "Intermediate explanation (technical terms explained)"],
        ["advanced", "> 120 seconds", "Advanced explanation (patterns & libraries)"],
    ]
    story.append(styled_table(level_data, [80, 100, content_width - 190], ACCENT_TEAL))

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "User state updates are <b>debounced and sent to Supabase every 5 seconds</b> via PATCH /api/user-state. "
        "State is also flushed on component unmount.",
        s['body']))

    story.append(Spacer(1, 16))

    # ════════════════════════════════════════
    # 6. PROACTIVE ENGINE
    # ════════════════════════════════════════
    story.append(Paragraph("6. Proactive Engine", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "The core differentiator. The frontend hook polls POST /api/proactive every 15 seconds. "
        "The server-side engine uses <b>purely deterministic rules</b> \u2014 no Claude calls at runtime \u2014 "
        "to decide the next UI action based on the user's exploration state.",
        s['body']))
    story.append(Spacer(1, 8))

    story.append(ProactiveEngineDiagram(content_width))
    story.append(Spacer(1, 6))
    story.append(Paragraph("All proactive decisions are deterministic \u2014 zero cost, low latency.", s['caption']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("UI Actions", s['h3']))

    actions_data = [
        ["Action", "UI Effect"],
        ["highlight_concept", "Pulse a concept node on the graph canvas"],
        ["show_insight", "Display a floating, color-coded insight card"],
        ["suggest_connection", "Highlight an edge between concepts"],
        ["suggest_file", "Recommend a specific file to look at"],
        ["show_summary", "Show exploration progress card"],
        ["deepen_current", "Offer deeper explanation of current concept"],
        ["nothing", "No change \u2014 user is engaged, don't interrupt"],
    ]
    story.append(styled_table(actions_data, [120, content_width - 130], ACCENT_TEAL))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 7. CHAT SYSTEM
    # ════════════════════════════════════════
    story.append(Paragraph("7. Chat System", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Chat is secondary \u2014 a small input at the bottom-left of the screen, not a prominent chatbot. "
        "It has full RAG context and streams responses via SSE.",
        s['body']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Differentiators", s['h3']))
    differentiators = [
        ("<b>Full codebase context</b> \u2014 every response grounded in retrieved code chunks via hybrid search", ACCENT_BLUE),
        ("<b>Awareness of user state</b> \u2014 \"what does this do?\" knows what \"this\" is (selected node)", ACCENT_PURPLE),
        ("<b>Adaptive language</b> \u2014 uses the user's estimated understanding level for the relevant concept", ACCENT_GREEN),
        ("<b>Graph integration</b> \u2014 [[concept:key]] and [[file:path]] references rendered as clickable links", ACCENT_TEAL),
    ]
    for text, color in differentiators:
        story.append(Paragraph(
            f'<font color="{color.hexval()}">\u25B6</font> {text}',
            s['bullet']))

    story.append(Spacer(1, 16))

    # ════════════════════════════════════════
    # 8. DATA FLOWS
    # ════════════════════════════════════════
    story.append(Paragraph("8. End-to-End Data Flows", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(DataFlowDiagram(content_width))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Three primary user workflows: upload, explore, and chat.", s['caption']))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 9. FILE STRUCTURE
    # ════════════════════════════════════════
    story.append(Paragraph("9. File Structure", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    # Server files
    story.append(Paragraph("Server (Node.js + Hono)", s['h2']))

    server_files = [
        ["Path", "Purpose"],
        ["server/index.ts", "Hono app entry point (port 3007)"],
        ["server/routes/pipeline.ts", "POST /start, GET /:id/stream, GET /:id/data"],
        ["server/routes/chat.ts", "POST /api/chat (streaming RAG chat)"],
        ["server/routes/explain.ts", "POST /api/explain (streaming explanations)"],
        ["server/routes/proactive.ts", "POST /api/proactive (UI guidance)"],
        ["server/routes/user-state.ts", "PATCH /api/user-state (exploration tracking)"],
        ["server/pipeline/orchestrator.ts", "Pipeline orchestration (stages 1-7)"],
        ["server/pipeline/fileAnalysis.ts", "Stage 2: sequential file analysis (Haiku)"],
        ["server/pipeline/conceptSynthesis.ts", "Stage 3: concept graph generation (Sonnet)"],
        ["server/pipeline/depthMapping.ts", "Stage 4: multi-level explanations"],
        ["server/pipeline/insightGeneration.ts", "Stage 5: senior engineer insights"],
        ["server/pipeline/embedding.ts", "Stage 6: chunking + OpenAI embedding"],
        ["server/pipeline/proactiveSeeding.ts", "Stage 7: exploration path generation"],
        ["server/rag/chunker.ts", "~800-token chunks with contextual prefixes"],
        ["server/rag/embedder.ts", "OpenAI text-embedding-3-small client"],
        ["server/rag/retriever.ts", "Hybrid search via Supabase RPC"],
        ["server/ai/claude.ts", "Anthropic SDK wrapper (streaming + tool-use)"],
        ["server/ai/schemas.ts", "All JSON schemas for structured outputs"],
        ["server/proactive/engine.ts", "Deterministic proactive decision rules"],
        ["server/db/supabase.ts", "Supabase client"],
    ]
    story.append(styled_table(server_files, [200, content_width - 210], ACCENT_PURPLE))

    story.append(Spacer(1, 12))
    story.append(Paragraph("Client (React + Vite)", s['h2']))

    client_files = [
        ["Path", "Purpose"],
        ["src/App.jsx", "Screen routing (landing \u2192 upload \u2192 processing \u2192 explorer)"],
        ["src/store/useStore.js", "Zustand store (screens, concepts, pipeline, proactive UI)"],
        ["src/hooks/useProactive.js", "Polls /api/proactive every 15s"],
        ["src/hooks/useSSE.js", "Generic SSE stream consumption"],
        ["src/hooks/useUserState.js", "Track and sync user state (debounced 5s)"],
        ["src/utils/fileParser.js", "ZIP extraction, import detection, path resolution"],
        ["src/utils/claudeApi.js", "API client helpers"],
        ["src/utils/graphLayout.js", "D3 force-directed graph layout"],
        ["src/components/GraphCanvas.jsx", "D3 force-directed concept graph (Canvas)"],
        ["src/components/InspectorPanel.jsx", "Right sidebar: 3-level explanations, file list"],
        ["src/components/ChatBar.jsx", "Bottom-left chat with streaming + [[links]]"],
        ["src/components/InsightCard.jsx", "Floating insight cards (6 categories)"],
        ["src/components/ExplorationProgress.jsx", "Top banner: exploration % + suggestions"],
        ["src/components/ProcessingScreen.jsx", "6-step pipeline progress visualization"],
    ]
    story.append(styled_table(client_files, [210, content_width - 220], ACCENT_GREEN))

    story.append(PageBreak())

    # ════════════════════════════════════════
    # 10. COST ESTIMATES
    # ════════════════════════════════════════
    story.append(Paragraph("10. Cost Estimates", s['h1']))
    story.append(GlowLine(content_width, ACCENT_BLUE))
    story.append(Spacer(1, 10))

    story.append(Paragraph("For a medium codebase (~100 files, ~50K lines):", s['body']))
    story.append(Spacer(1, 8))

    cost_data = [
        ["Stage", "Model", "Calls", "Est. Cost"],
        ["Stage 2: File Analysis", "claude-haiku-4-5", "~7 batches of 15", "~$0.10"],
        ["Stage 3: Concept Synthesis", "claude-sonnet-4-6", "1", "~$0.09"],
        ["Stage 4: Depth Mapping", "claude-sonnet-4-6", "1", "~$0.12"],
        ["Stage 5: Insights", "claude-sonnet-4-6", "1", "~$0.06"],
        ["Stage 6: Embeddings", "text-embedding-3-small", "~1 batch", "~$0.001"],
        ["Stage 7: Proactive Seeding", "claude-sonnet-4-6", "1", "~$0.03"],
        ["Total Ingestion", "", "", "~$0.40"],
        ["", "", "", ""],
        ["Per chat message", "claude-sonnet-4-6", "1", "~$0.015"],
        ["Per explanation", "claude-sonnet-4-6", "1", "~$0.015"],
        ["Proactive engine", "none (deterministic)", "0", "$0.00"],
    ]

    cost_table = styled_table(cost_data, [130, 130, 100, content_width - 370], ACCENT_ORANGE)
    story.append(cost_table)

    story.append(Spacer(1, 20))

    # Not included section
    story.append(Paragraph("What This Does NOT Include", s['h2']))
    story.append(Spacer(1, 6))

    exclusions = [
        ("Authentication", "Not needed for MVP. One user, one project at a time."),
        ("File watching", "Re-upload the ZIP. Incremental analysis adds complexity for v1."),
        ("Collaboration", "Single-user tool. Sharing can come later as read-only links."),
        ("Custom embedding fine-tuning", "Off-the-shelf embeddings with contextual retrieval are good enough."),
        ("Redis caching", "Supabase is the cache. Add Redis only if query latency becomes a problem."),
        ("Supabase Realtime", "Pipeline progress uses SSE polling from Hono. Simpler approach."),
    ]

    for title, reason in exclusions:
        story.append(Paragraph(
            f'<font color="#F85149">\u2717</font> '
            f'<font color="#E6EDF3"><b>{title}</b></font> \u2014 '
            f'<font color="#8B949E">{reason}</font>',
            s['bullet']))

    # ── Build ──
    doc.build(story, onFirstPage=draw_page_bg, onLaterPages=draw_page_bg)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    output = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AI_ARCHITECTURE.pdf")
    build_pdf(output)
