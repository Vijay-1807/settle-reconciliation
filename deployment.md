# Settle - deployment and review guide

Source repository: https://github.com/Vijay-1807/settle-reconciliation (private).

## Local setup

1. Install Node.js 22.13 or newer, including npm. The local server uses built-in `node:sqlite`.
2. In the `settle` project directory, run `npm ci`.
3. Run `npm run build` to bundle the browser app and deployment Worker. This also copies self-hosted fonts.
4. Run `npm run dev`.
5. Open http://localhost:3000. Keep this terminal running while using the app.
6. Sign in with one of the synthetic demo accounts below.

Data is stored in `.data/settle.sqlite`, ignored by Git. Local data and the hosted D1 database are separate. A fresh database seeds 480 synthetic orders on the first authenticated workspace read. To preserve the original demo while experimenting, use a separate checkout.

## Demo sign-in

| Role | Email | Password |
| --- | --- | --- |
| Finance executive | finance@demo.settle | demo-settle |
| Co-founder | founder@demo.settle | demo-settle |

These published demo credentials are intentional and suitable only for synthetic data. Sessions last 24 hours and use HTTP-only, SameSite=Strict cookies; HTTPS adds Secure. Hosted Sites adds its owner-private sign-in boundary outside the demo role system.

## Reviewer walkthrough

1. Open Overview. Risk, received amounts and exception counts derive from database records.
2. Open Reconciliation; search `ORD-W-204118`, `ORD-M-88120`, and `ORD-W-204377`. Inspect the calculation drawer and export evidence.
3. Open Imports. Download `sample-orders.csv`, upload it as Orders / Website, review the proposed mapping and preview. The approve button stays disabled until you check the review box.
4. Import a settlement CSV with headers `Order ID,Received` and a row `ORD-DEMO-1001,1409`. Choose Settlement and Website. In Per-order totals mode this becomes the authoritative net received amount. Payout transactions mode aggregates partial rows and adds each report's contribution; re-uploading the same source/type/filename replaces that contribution, avoiding double counting. Optional TCS/TDS columns override estimated statutory deductions.
5. Open Mapping history and inspect the saved version. Sign in as co-founder to restore it as a new version.
6. Open Claims, select an exception, mark it In progress and export its evidence. Marking Recovered records a manually confirmed recovery; no money moves and no claim is filed externally.
7. Open Returns and record a receipt reference against a missing return.
8. As co-founder, edit a rate card, save and inspect recalculated expected amounts. Finance executives cannot change cards or restore versions.
9. Upload a Settlement report with `Gross amount,Net payout` and `1499,1409`, with no order ID. Review mapping, then open Reconciliation / Needs review. Select or enter the correct order, check the confirmation and approve. An imported unmatched row never changes orders or closes claims without this step.
10. Map Actual package weight in an order report and Billed weight in a freight report. Courier cards use actual weight rounded up to additional slabs; the billed weight is kept as evidence.

## Commands and evidence

`npm test`: rules, sample parity, tax separation, tolerance, receipt matching, mapping uncertainty, authentication, access control, import validation, versioning and persistent updates.

`npm run test:e2e`: ten Playwright cases across desktop and iPhone-sized Chromium: seven-screen layouts, self-hosted font loading, approval, upload/matching/export, missing-ID review, role changes and safe bulk selection. The suite uses an isolated database and leaves the user's demo database unchanged. Local runs use installed Chrome; CI installs Playwright Chromium. HTML reports are in `output/playwright-report/`, screenshots in `output/qa/`.

`npm run benchmark`: 100,000 in-memory reconciliations plus partner summary. Results in `benchmark-results.json`.

`node scripts/benchmark-import.mjs`: 100,000 CSV rows parsed, validated, imported into temporary SQLite, reconciled, and summarised. Results in `benchmark-import-results.json`. Excludes HTTP network transfer and browser rendering. This is a local benchmark, not a D1 throughput guarantee.

`npm run build`: generates `public/app.js`, font assets and `dist/server/index.js` with its deployment manifest. Generated runtime files contain no secrets.

## Hosted deployment

The selected Sites project is recorded in `.openai/hosting.json`. The build targets a Cloudflare Worker ES module, with a D1 binding named `DB`. Schema migrations are in `drizzle/`; they must be applied before the first request. Sites packages the migration journal and applies hosted migrations during deployment. R2 is unused: original uploaded files stay on the user's device, while only approved mapped fields are stored.

Expected site origin: https://settle-home-finance.simplescout.chatgpt.site

This URL is the configured origin; deployment success must be confirmed by the Sites deployment result. Owner-private access is intentional. Do not present this as a public reviewer link until the owner explicitly shares it.

Current publication status: not deployed. Automatic approval review rejected the Sites source upload because the user had not explicitly authorized transmitting this code to the specific private repository/deployment destination. The ready local source and build have been retained. No alternate upload path was used.

Environment/binding names only:

- `DB`: D1 binding provisioned by Sites, not a secret value.
- No API key is required. The mapping model runs locally in application code.
- No `.env` file is required locally. No credentials should be committed.
- `PORT` and `LOCAL_DB_PATH` are optional local overrides; the test runner uses them for isolation.

GitHub authentication was verified with network access. The source repository is private and preserves the local commit history. Automatic review blocked creating a public repository because public access had not been explicitly authorized. The owner must approve public visibility, or grant reviewer access, before assessment submission. The repository URL is at the top of the technical document.

## Assumptions and limits

- All data is synthetic and the as-of date is fixed at 2026-11-02 for repeatable review.
- Rates are commercial illustrations, not legal tax guidance. The Marketplace 1 fixed fee is INR 292.80 with zero commission, TCS 0.5% and TDS 0.1%, yielding the supplied INR 899 expected settlement after per-component rounding.
- Per-order totals replace current receipts. Transaction mode aggregates repeated order rows and tracks contributions by source/type/filename. Use stable filenames for corrected reports; renaming a transaction file intentionally makes it a new contribution. Distinct manual-review rows in the same file use separate stable ledger keys. Do not import overlapping payout reports as independent transactions.
- Courier cards include first-weight and additional-weight slabs; actual weight defaults to 0.5 kg when absent. A channel freight allowance is used when no courier card exists. Zone matrices, effective-dated agreements and immutable historical rate snapshots remain future work.
- Dates must be ISO YYYY-MM-DD and money uses two-decimal rounding. Overpayments are visible as positive differences but do not create a shortage claim.
- Imported rows, review items, mapping versions and history commit in one transactional batch after validation. A simulated database failure is tested to roll back all of them. A background job system and hosted D1 capacity verification remain future work.
- The first worksheet of an Excel file is read. A 25 MB compressed Excel file can expand significantly; production parsing belongs in a worker with decompression limits.
- The local model suggests mappings, abstains on uncertainty and learns approved examples. It is not an LLM. Strong global header matches take priority over weak optional matches. Missing/unrecognised order IDs enter the manual queue with up to five candidates based on shipment reference, value, channel, date and payout proximity. Similarity scores are not probabilities. No suggested match closes a claim automatically. An import with over 500 unmatched rows is rejected to prompt a mapping/order-file check.
- Rate edits recalculate historical orders using the latest card. Current snapshots are not an immutable accounting ledger.
- This demo loads workspace orders into memory; browser tables are paginated. Writes are serialised within one runtime instance. Multi-isolate concurrency, hosted 100,000-row memory/latency, disaster recovery and production identity lifecycle are not yet verified.
- No Tally integration, GST filing, inventory sync, payment execution or automatic claim filing is included.
