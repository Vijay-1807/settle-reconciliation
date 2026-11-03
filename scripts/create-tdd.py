from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold',italic='Arial',boldItalic='ArialBold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='Body',fontName='Arial',fontSize=9.7,leading=14.1,textColor=HexColor('#53604f'),spaceAfter=8))
styles.add(ParagraphStyle(name='TitleCustom',fontName='ArialBold',fontSize=30,leading=36,textColor=HexColor('#203c2d'),spaceAfter=16))
styles.add(ParagraphStyle(name='SectionCustom',fontName='ArialBold',fontSize=16,leading=21,textColor=HexColor('#206956'),spaceBefore=15,spaceAfter=8))
styles.add(ParagraphStyle(name='Kicker',fontName='ArialBold',fontSize=9,leading=14,textColor=HexColor('#6d8660'),spaceAfter=14))
styles.add(ParagraphStyle(name='CellCustom',fontName='Arial',fontSize=9,leading=13,textColor=HexColor('#53604f')))
story=[]
def p(text,style='Body'): story.append(Paragraph(text,styles[style]))
def h(text): p(text,'SectionCustom')
def table(headers,rows,widths):
    vals=[[Paragraph(str(c),styles['CellCustom']) for c in row] for row in [headers]+rows]
    t=Table(vals,colWidths=widths,hAlign='LEFT',repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#edf3e8')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.4,HexColor('#e2e8dc')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    story.append(t);story.append(Spacer(1,12))
def page(kicker,title):
    if story: story.append(PageBreak())
    p(kicker,'Kicker');p(title,'TitleCustom')

content = json.loads((ROOT / 'docs' / 'technical-design-content.json').read_text(encoding='utf-8'))
for section in content:
    page(section['kicker'], section['title'])
    for block in section['blocks']:
        if block['type'] == 'p':
            p(block['text'])
        elif block['type'] == 'h':
            h(block['text'])
        elif block['type'] == 'table':
            table(block['headers'], block['rows'], block['widths'])

def chrome(canvas,doc):
    w,h=A4;canvas.setStrokeColor(HexColor('#dfe7d9'));canvas.line(50,44,w-50,44)
    canvas.setFont('Arial',8);canvas.setFillColor(HexColor('#7b8c70'));canvas.drawString(50,29,'SETTLE / COMPANY A / TECHNICAL DESIGN')
    canvas.drawRightString(w-50,29,f'{doc.page} / 5')

doc=SimpleDocTemplate(str(OUT/'Settle-Technical-Design.pdf'),pagesize=A4,rightMargin=50,leftMargin=50,topMargin=45,bottomMargin=60,title='Settle - Technical Design',author='Settle project')
doc.build(story,onFirstPage=chrome,onLaterPages=chrome)
print(OUT/'Settle-Technical-Design.pdf')

import pypdfium2 as pdfium
from PIL import Image, ImageOps
qa=ROOT/'output'/'qa';qa.mkdir(parents=True,exist_ok=True)
pdf=pdfium.PdfDocument(str(OUT/'Settle-Technical-Design.pdf'))
thumbs=[]
for i in range(len(pdf)):
    image=pdf[i].render(scale=1.3).to_pil();image.save(qa/f'tdd-page-{i+1}.png')
    image.thumbnail((395,560));thumbs.append(ImageOps.expand(image,border=8,fill='#dce5d6'))
sheet=Image.new('RGB',(len(thumbs)*411,576),'#eef2e9')
for i,img in enumerate(thumbs):sheet.paste(img,(i*411,0))
sheet.save(qa/'tdd-contact-sheet.png')
print(f'{len(pdf)} pages rendered for QA')
