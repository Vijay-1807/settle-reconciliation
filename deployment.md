# Settle - deployment and review guide

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
4. Import a settlement CSV with headers `Order ID,Received` and a row `ORD-DEMO-1001,1409`. Choose Settlement and Website. This order becomes Settled. Re-uploading the same order replaces its current received amount; it does not add a duplicate order.
5. Open Mapping history and inspect the saved version. Sign in as co-founder to restore it as a new version.
6. Open Claims, select an exception, mark it In progress and export its evidence. Marking Recovered records a manually confirmed recovery; no money moves and no claim is filed externally.
7. Open Returns and record a receipt reference against a missing return.
8. As co-founder, edit a rate card, save and inspect recalculated expected amounts. Finance executives cannot change cards or restore versions.

## Commands and evidence

`npm test`: rules, sample parity, tax separation, tolerance, receipt matching, mapping uncertainty, authentication, access control, import validation, versioning and persistent updates.

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

For the public GitHub handover, first restore the user's GitHub CLI authentication, create the intended public repository, push the preserved commit history, then add the verified repository URL to the top of the technical document. GitHub authentication was invalid during this build; no public GitHub repository has been created.

## Assumptions and limits

- All data is synthetic and the as-of date is fixed at 2026-11-02 for repeatable review.
- Rates are commercial illustrations, not legal tax guidance. The Marketplace 1 fixed fee is INR 292.80 with zero commission, TCS 0.5% and TDS 0.1%, yielding the supplied INR 899 expected settlement after per-component rounding.
- Each uploaded report must contain one aggregate row per order. Multiple partial payout rows must be aggregated before upload. The received field is the authoritative current net settlement and replaces the previous value. Disjoint new reports for the same order are not automatically summed.
- Freight uses a channel-level fixed allowance. Courier-specific weight and zone slab matrices, effective-dated agreements, and historical rate snapshots are future work.
- Dates must be ISO YYYY-MM-DD and money uses two-decimal rounding. Overpayments are visible as positive differences but do not create a shortage claim.
- Import validation is all-or-nothing before writes. Large imports use several atomic database batches; an infrastructure failure between batches can leave a partial import. Re-upload is safe by order primary key. A production job/staging transaction system is future work.
- The first worksheet of an Excel file is read. A 25 MB compressed Excel file can expand significantly; production parsing belongs in a worker with decompression limits.
- The local model suggests mappings, abstains on uncertainty and learns approved examples. It is not an LLM. Missing order IDs are rejected with row errors; a candidate-match review queue is deferred and no uncertain matches close automatically.
- Rate edits recalculate historical orders using the latest card. Current snapshots are not an immutable accounting ledger.
- This demo loads the workspace orders into memory; browser tables are paginated. Hosted 100,000-row memory/latency, multi-user write conflicts, disaster recovery and production identity lifecycle are not yet verified.
- No Tally integration, GST filing, inventory sync, payment execution or automatic claim filing is included.
