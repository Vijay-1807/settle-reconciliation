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

page('SETTLE / TECHNICAL DESIGN DOCUMENT / 03 NOV 2026','Every rupee.\nAccounted for.')
p('<b>GitHub repository:</b> <link href="https://github.com/Vijay-1807/settle-reconciliation" color="#206956">https://github.com/Vijay-1807/settle-reconciliation</link><br/>Private repository. Public visibility requires explicit owner approval before assessment submission.')
p('<b>Hosted application:</b> Not deployed. Private Sites publication was blocked by automatic approval review pending explicit authorization to upload the source to that destination.')
p('<b>Local application:</b> http://localhost:3000<br/><b>Project:</b> Settle - Company A order, payment and return reconciliation')
h('01 / The slice that works')
p('A finance executive can import an order report, review suggested column mappings on up to 20 rows, approve and save a source-specific mapping, add settlement/COD/freight reports, inspect order-level discrepancies, manage claims and export evidence. A co-founder can additionally change channel rate cards and restore earlier mapping versions. A dashboard derives money at risk from the same order records.')
p('The app includes sign-in, seven workspace screens, synthetic seed data, warehouse receipts, reported tax deductions, courier weight slabs, idempotent partial-payout imports and a missing-ID review queue. Payment execution, partner messages and automatic claim filing remain outside the product.')
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
['settings / workspace','JSON payload contains channel/courier cards, approved mapping versions, upload history, audit events and pending/reviewed match decisions. Mappings include source, report type, field-to-column map, version, approver and timestamp.'],
['sessions','Random UUID cookie identifier, user role/name and expiry. Local accounts are synthetic demo identities. No real customer names, phones or addresses are required.']
],[115,380])
p('Order payloads also retain evidence history and per-file payout contributions. Imports and settings commit atomically, and mutations serialize within one runtime instance. A normalized ledger, optimistic concurrency across runtime instances and immutable commercial agreements are next steps for production.')
h('04 / Import flow')
p('<b>1.</b> Choose report type, source and snapshot or payout-transaction mode. Read CSV or the first worksheet, up to 25 MB / 100,000 rows.<br/><b>2.</b> Reuse an approved mapping or request local suggestions. Only headers are used by the mapping model.<br/><b>3.</b> Preview 20 rows and confirm approval. Mapping changes clear the checkbox. Optional columns include actual deductions, package weight and shipment reference.<br/><b>4.</b> Validate rows before writes. Missing IDs enter a queue; invalid amounts/dates reject the import. Transaction mode aggregates partial rows and replaces contributions on re-upload of the same source/type/filename.<br/><b>5.</b> Upsert orders, mappings, review items and history in one transactional batch. Failure rolls back the whole import. Refresh financial results from the database.')
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
p('Strong global header matches are reserved before weaker optional matches, preventing a fuzzy tax suggestion from stealing an exact order-value column. Every mapping is editable and needs approval; co-founders restore prior versions as new versions. Missing IDs enter manual review with up to five candidates scored by reference, value, channel, date and payout proximity. A person selects or enters the confirmed order and explicitly approves. Suggestions never update orders or close claims automatically.')
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
p('<b>19 logic/API tests:</b> sample parity, tax separation, tolerance/due dates, return receipts, courier slabs, mapping priority/uncertainty, validation, roles, rollback, partial-payout idempotency, review approval and evidence history. A simulated database failure confirms full import rollback.')
p('<b>Local performance:</b> 100,000 CSV rows parsed, validated, stored in SQLite, reconciled and summarised in 5,328 ms. Parsing took 2,476 ms; validation/persistence 1,861 ms. This excludes network and browser rendering. The rules-only run took 209 ms. Hosted D1 throughput remains unmeasured.')
p('<b>Playwright:</b> ten desktop/mobile end-to-end cases verify sign-in, screen layouts, self-hosted fonts, upload approval, matching, CSV evidence, missing-ID review, roles and safe selection. Test data uses isolated SQLite. Screenshots and HTML reports are generated. GitHub Actions runs the same checks on Linux. The checked source includes font licences and no runtime credentials.')

page('SETTLE / ASSUMPTIONS AND HANDOVER','A focused slice.\nClear next steps.')
h('11 / Explicit assumptions and cuts')
p('<b>A1.</b> Seed data is synthetic, with a fixed 2026-11-02 reference date, six channels and two placeholder couriers.<br/><b>A2.</b> Due/receipt windows default to seven days using order date as a proxy. Commercial terms are illustrative; latest-card changes recalculate history.<br/><b>A3.</b> Snapshot mode replaces totals. Transaction mode adds per-file contributions, keyed by source/type/filename (and source row for manual reviews). Re-uploading a stable filename corrects its contribution. Renamed or overlapping reports must not be treated as new payouts.<br/><b>A4.</b> Courier cards round actual weight up to slabs; missing actual weight defaults to 0.5 kg. A channel allowance is the fallback. Zone matrices are deferred. Missing-return exposure uses order value; freight invoices are assumed separate from settlement deductions.<br/><b>A5.</b> Excel uses the first sheet and ISO dates. Original files stay on the device; mapped evidence and source rows persist.<br/><b>A6.</b> Writes are atomic per import and serialize in one runtime. Multi-isolate conflicts, hosted memory/latency, disaster recovery and production identity are not certified. Over 500 unmatched rows reject an import for a mapping check.')
h('12 / What comes next')
p('Prioritise normalized immutable evidence and agreement tables, effective-dated cards, courier zone matrices, background import jobs, server-side filtering/pagination, cross-instance concurrency control, production identity/role administration, monitored D1 load tests and backup/restore drills. These strengthen accounting correctness and operational scale before real financial data is accepted.')
h('13 / Completion status and review handover')
p('<b>Local build:</b> database-backed, with the requested core flows and tested optional depth.<br/><b>UI:</b> desktop/mobile fonts, layouts and interactions verified with Playwright.<br/><b>Documents:</b> this PDF and deployment.md form the submission ZIP.<br/><b>GitHub:</b> the verified repository is linked on page 1. It is private because automatic review blocked public creation without explicit authorization. The owner must approve public/reviewer access before submission.<br/><b>Hosting:</b> not deployed; destination-specific approval is still required for the private Sites upload. No live success is claimed.')
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
