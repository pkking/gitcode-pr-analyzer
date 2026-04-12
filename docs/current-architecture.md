# Current Architecture

## Overview

The repository now uses a single collection pipeline:

- ETL entrypoint: `etl/scripts/collect-gitcode.ts`
- Config: `etl/repos.yaml`
- Config resolution helpers: `etl/lib/config.js`
- Static output: `public/data/index.json` and `public/data/YYYY-MM-DD.json`
- Frontend consumption: `src/App.jsx` via `src/utils/etlData.js`

The legacy PR-by-PR collector (`scripts/collector.js`, `config/repositories.yml`, `src/api/gitcode.js`, `src/utils/analyzer.js`) has been removed.

## Data Flow

1. The ETL script reads `etl/repos.yaml`.
2. Repository targets are resolved from:
   - top-level `repos:`
   - explicit `orgs[].repos`
   - implicit organization discovery when `orgs[].repos` is omitted
3. The collector fetches pull requests, comments, and operate logs from GitCode.
4. CI runs are reconstructed from comment and label events.
5. Runs are grouped into daily static files under `public/data/`.
6. The frontend reads `public/data/index.json`, loads repo day files on demand, and renders run/job summaries.

## Error Semantics

The ETL script now distinguishes these failure classes:

- Network failure: outbound network or GitCode availability problem
- Authentication failure: invalid token or missing access
- Not found / visibility failure: organization or repository missing on GitCode, or hidden from the token

## Operational Commands

Collect data:

```bash
GITCODE_TOKEN=your_token npm run collect
```

Run the frontend:

```bash
npm run dev
```
