# Settle

[GitHub repository](https://github.com/Vijay-1807/settle-reconciliation) · Private repository; the owner must approve public access for assessment reviewers.

A working finance workspace for the D2C home-brand reconciliation brief. Built with a small browser application, a shared HTTP API, SQLite locally, and a Cloudflare Worker/D1 deployment target.

## Start

```sh
npm ci
npm run build
npm run dev
```

Open http://localhost:3000. Node.js 22.13+ is required (built-in SQLite).

Finance executive: `finance@demo.settle`  
Co-founder: `founder@demo.settle`  
Demo password for both: `demo-settle`

These are deliberately public demo accounts, not real credentials. Do not deploy this demo account system to a public audience with real financial data.

## Included

- Seven workspace screens and sign-in, with responsive CSS and mobile navigation.
- CSV/XLS/XLSX upload, source-specific mappings, 20-row preview and explicit approval.
- Local character n-gram nearest-neighbour mapping model; approved examples improve later suggestions. Unknown or ambiguous headers need manual review.
- Rule-based order reconciliation, strict gaps over INR 10, tax separation, due dates and return scans.
- Claims status updates and formula-safe CSV evidence exports.
- Channel rate cards editable by the co-founder, mapping version history and rollback.
- Courier weight-slab cards, reported TCS/TDS inputs, missing-ID match review and an idempotent partial-payout ledger.
- Atomic import commits with source-row evidence history and a tested rollback path.
- SQLite persistence, HTTP-only session cookies, origin checks, role enforcement and input validation.
- Synthetic seed orders, including the three supplied examples.

## Verify

```sh
npm test
npm run test:e2e
npm run benchmark
npm run benchmark:import
```

The benchmark reports its scope explicitly; it is not a hosted/browser performance guarantee. See `deployment.md` and the technical design document for assumptions and limitations.

Playwright uses installed Google Chrome locally, runs desktop and iPhone-sized Chromium projects, and creates an isolated SQLite database for each test run. GitHub Actions installs Chromium and runs the same suite on Linux. `npm run build` must succeed before browser tests.

![Desktop finance workspace](docs/assets/desktop-overview.png)

## Source guide

`src/engine.mjs` contains financial rules and the mapping model. `src/api.mjs` implements authenticated operations. `src/client.js` contains the UI. `public/style.css` is the design system. `src/local.mjs` adapts SQLite and HTTP for local use; `src/worker.mjs` adapts the same API for Workers. `drizzle/` contains schema-only migrations. `tests/` covers rules and database-backed API behavior.

Design references reviewed: [21st.dev](https://21st.dev/) and [MotionSites](https://motionsites.ai/). The interface is original application code; no proprietary template source was copied. Icons: Lucide. Fonts: DM Sans and Manrope, self-hosted through Fontsource. Spreadsheet parser: [official SheetJS 0.20.3](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Submission status

The source is in the private GitHub repository linked above, with preserved commit history. Automatic approval review blocked public-repository creation; changing visibility needs explicit owner approval. The technical document and `deployment.md` are packaged in `settle-submission.zip` in the parent workspace. Hosted Sites publication is still pending destination-specific approval; no live deployment is claimed.
