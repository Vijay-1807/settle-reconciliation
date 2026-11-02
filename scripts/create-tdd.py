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

page('SETTLE / TECHNICAL DESIGN DOCUMENT / 02 NOV 2026','Every rupee.\nAccounted for.')
p('<b>GitHub repository:</b> Publication pending. The existing GitHub CLI authentication is invalid. A verified public repository URL must replace this status before submission.')
p('<b>Hosted application:</b> Not deployed. Private Sites publication was blocked by automatic approval review pending explicit authorization to upload the source to that destination.')
p('<b>Local application:</b> http://localhost:3000<br/><b>Project:</b> Settle - Company A order, payment and return reconciliation')
h('01 / The slice that works')
p('A finance executive can import an order report, review suggested column mappings on up to 20 rows, approve and save a source-specific mapping, add settlement/COD/freight reports, inspect order-level discrepancies, manage claims and export evidence. A co-founder can additionally change channel rate cards and restore earlier mapping versions. A dashboard derives money at risk from the same order records.')
p('The local app includes persistent sign-in sessions, seven workspace screens, synthetic seed data, returns receipt tracking and a partner tax summary. Payment execution, partner messages and automatic claim filing remain outside the product.')
h('02 / Architecture and rationale')
table(['Layer','Implementation and reason'],[
['Browser','Vanilla JavaScript, self-hosted DM Sans/Manrope, Lucide icons, custom CSS and SheetJS. A small dependency surface and direct state make this focused slice easy to inspect.'],
['Shared domain','engine.mjs: deterministic financial rules, partner summaries, validation and local mapping classifier. The rules run independently of the UI and are unit tested.'],
['HTTP API','api.mjs: authenticated operations, role checks, import validation, persistence and mapping history. Browser requests cannot bypass co-founder restrictions.'],
['Storage / runtime','SQLite with Node 22 locally; the same prepared-statement API targets a Worker and D1. esbuild creates a standalone deployment module with embedded assets.']
],[95,400])

page('SETTLE / DATA AND USER FLOWS','Reports become\nreviewable evidence.')
h('03 / Data model')
table(['Table / record','Contents and relationships'],[
['orders','Primary key: order ID. JSON payload contains channel, value, payment, delivery, order date, partner, received amount, freight, warehouse receipt, claim status and source filename/row. The primary key makes re-imports updates rather than duplicate orders.'],
['settings / workspace','JSON payload contains channel rate cards, approved mapping versions, upload history, audit events and reserved review state. Mappings include source, report type, field-to-column map, version, approver and timestamp.'],
['sessions','Random UUID cookie identifier, user role/name and expiry. Local accounts are synthetic demo identities. No real customer names, phones or addresses are required.']
],[115,380])
p('This compact schema suits a demonstrable slice. Separating immutable import rows, settlement transactions, claims and commercial agreements into normalized tables is the next step for a production ledger. Workspace JSON writes currently lack optimistic concurrency, so simultaneous writers can overwrite configuration updates.')
h('04 / Import flow')
p('<b>1.</b> Choose report type and partner/source. The browser reads CSV or the first Excel worksheet and rejects files above 25 MB or 100,000 rows.<br/><b>2.</b> Reuse a compatible approved mapping or request local mapping suggestions. Only headers are used for suggestions.<br/><b>3.</b> Show mapped fields and the first 20 rows. Any mapping change clears approval. Import remains disabled until all required fields are mapped and the review checkbox is checked.<br/><b>4.</b> The server validates every row before writing. Duplicate order IDs, missing orders in partner files, invalid amounts and invalid dates produce row errors; validation failures save nothing.<br/><b>5.</b> Prepared SQL JSON batches upsert the approved rows. A new mapping version and upload audit entry are saved. Dashboard and order results refresh from the database.')
h('05 / Claims and returns')
p('Order drawers expose the expected-amount calculation, deductions, source filename/row and reasons for each exception. Claims can be marked Open, In progress, Recovered or Rejected. Filtered or selected claims export to CSV with formula injection protection. No claim leaves the app automatically. Warehouse receipts can be imported or recorded manually; recording a receipt removes the missing-return component of risk.')

page('SETTLE / FINANCIAL RULES AND ASSISTANCE','Rules calculate.\nPeople approve.')
h('06 / Reconciliation rules')
p('<b>Delivered:</b> expected settlement = order value - commission - fixed fee - GST TCS - income tax TDS. Tax components are rounded to two decimals before subtracting.<br/><b>Returned:</b> expected amount = negative agreed return fee. Shortages, courier freight gaps and missing warehouse receipts are separate exception components.<br/><b>Tolerance:</b> a gap must be strictly greater than ₹10. Zero receipts become unpaid only after the settlement window; otherwise the order awaits settlement. Missing return risk appears only after the receipt window. Overpayments stay visible but are not shortage claims.')
table(['Supplied order','Expected','Received','Difference'],[
['ORD-W-204118','₹1,409','₹0','-₹1,409'],['ORD-M-88120','₹899','₹862','-₹37'],['ORD-W-204377','-₹96','-₹142','-₹46']
],[200,98,98,99])
p('<b>Assumption:</b> Marketplace 1 uses an illustrative ₹292.80 fixed fee, 0% commission, 0.5% TCS and 0.1% TDS to reproduce the supplied ₹899 expectation. These are demo commercial inputs, not statutory tax recommendations. TCS/TDS are deductions already accounted for, never leakage.')
h('07 / Mapping model and uncertainty')
p('The mapping assistant is a local nearest-neighbour classifier over character bigram/trigram vectors. A small labelled header-alias corpus provides initial examples. Approved field-to-header mappings extend that corpus. It normalizes headers, compares cosine similarity, avoids reusing columns and abstains when the best match is weak or ambiguous. Similarity scores are not calibrated probabilities.')
p('Every proposal is editable and needs explicit review. Each successful import appends an approved version; co-founders restore old versions by copying them into a new version. Reconciliation does not use the model. An order ID that is missing or cannot be found produces an actionable row error. Candidate matching and a review queue are deferred; uncertain rows never close automatically.')
h('08 / Security boundary')
p('The API checks sessions and roles server-side, uses prepared SQL, checks same-origin JSON writes, limits request/file sizes and rejects non-allowlisted mapping fields. Cookies are HTTP-only and SameSite=Strict, with Secure under HTTPS. CSV text is escaped against formula execution and UI text is HTML-escaped. Only mapped financial fields persist; original files remain on the device. Demo passwords are public fixtures. Production identity, audit retention, backup policies and multi-tenant access isolation need further engineering.')

page('SETTLE / INTERFACE AND VALIDATION','Designed for\nthe finance workday.')
h('09 / Screen and design decisions')
table(['Screen','Purpose and design choice'],[
['Overview','Four quiet metrics, partner risk bars, next actions and high-value exceptions. All financial values derive from orders. Decorative trend charts were removed to avoid implying unsupported history.'],
['Reconciliation','Search, simple status/partner filters, paginated tables and a calculation drawer. Negative amounts use a leading minus; exception labels use text as well as colour. Export respects the active tab.'],
['Imports / Mapping history','A three-stage upload flow with an explicit approval gate, 20-row preview, saved source mappings, version history and co-founder rollback. Errors explain affected rows.'],
['Claims / Returns','Bulk selection, visible selection count, disabled actions when nothing is selected, status tracking, evidence export and receipt recording. Filter changes clear selections to avoid hidden bulk updates.'],
['Rate cards','Editable commercial inputs for co-founders; finance executives see disabled fields. Save activates only after edits and changed cards show an Unsaved marker.']
],[125,370])
p('Warm white surfaces, ink text and restrained green accents keep attention on the numbers. Tables use tabular numerals, stronger text contrast, sticky headers, keyboard-focusable scroll regions and visible selected rows. Mobile layouts use a collapsible sidebar, stacked panels, larger touch targets and horizontal-scroll guidance. Reduced-motion preferences are respected and dialogs trap keyboard focus.')
h('10 / Verification evidence')
p('<b>11 tests pass:</b> supplied sample parity; tax exclusion; strict tolerance and due dates; return receipt/freight logic; mapping uncertainty and learning; validation; summary totals; authentication/origin/role checks; import rejection and mapping versions; claims, receipts and rate persistence.')
p('<b>Local performance:</b> 100,000 CSV rows parsed, API-validated, stored in temporary SQLite, reconciled and summarised in 3,197 ms in the recorded run. Parsing took 2,024 ms; validation/persistence took 723 ms. This excludes HTTP transfer and browser rendering. The separate rules-only benchmark is saved as JSON. Hosted D1 throughput is not yet measured.')
p('<b>Browser checks:</b> sign-in, dashboard and approved sample upload were exercised. The UI improvement pass checked the mobile dashboard and reconciliation at a 390-pixel viewport override; the page content did not overflow the available viewport. Final screenshots are in the local QA output folder. Dependency installation reported zero vulnerabilities for the installed set.')

page('SETTLE / ASSUMPTIONS AND HANDOVER','A focused slice.\nClear next steps.')
h('11 / Explicit assumptions and cuts')
p('<b>A1.</b> All seed data is synthetic. The reference date is fixed at 2026-11-02. Six named channels and two placeholder courier partners represent the brief without inventing real integrations.<br/><b>A2.</b> Settlement and receipt windows default to seven days and use order date as the proxy start. Channel commercial terms are illustrative; latest-card edits recalculate history.<br/><b>A3.</b> Each report contains one aggregate record per order. The received amount replaces the previous authoritative total; multiple disjoint partial payments are not automatically summed. Duplicate IDs in one file must be aggregated before import.<br/><b>A4.</b> Freight uses a fixed channel allowance, not a full courier/zone/weight-slab matrix. Missing return exposure uses order value. Separate freight invoices are assumed not to duplicate settlement deductions.<br/><b>A5.</b> Excel imports use the first worksheet and require ISO dates. Original report files are not archived on the server; evidence exports preserve mapped fields and source row references.<br/><b>A6.</b> Large imports span several atomic batches. Infrastructure failure between batches can leave partial persistence; idempotent re-import by order ID repairs records. No production job/staging system is included.')
h('12 / What comes next')
p('Prioritise immutable import/evidence tables, effective-dated commercial cards, courier weight/zone slabs, partial-payment ledgers, background import jobs with atomic promotion, server-side filtering and paginated reads, optimistic concurrency, missing-ID candidate review, production identity and role administration, monitored D1 load tests and backup/restore drills. These changes strengthen accounting correctness and operational scale before real financial data is accepted.')
h('13 / Completion status and review handover')
p('<b>Local core build:</b> working, database-backed and tested.<br/><b>UI pass:</b> desktop and mobile readability/interactions improved and visually checked.<br/><b>Documents:</b> this technical document and deployment.md are packaged together in the local submission ZIP.<br/><b>GitHub:</b> not published because the saved CLI authentication is invalid. Add a verified public repository URL here before submission.<br/><b>Hosted deployment:</b> not published; automatic approval review rejected the source upload pending explicit authorization for the private Sites repository/destination. No live success is claimed.')
p('Run instructions, demo credentials, environment/binding names, reviewer walkthrough and deployment limits are in deployment.md. The project keeps local Git history. No assessment choice, application submission, claim filing or partner communication was performed.')

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
