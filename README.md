# GitCode PR Analyzer

A static dashboard backed by an ETL collector for GitCode CI run analytics.

## Features
- **Organization-aware collection:** Configure explicit repositories or discover all repositories under a GitCode organization.
- **CI run reconstruction:** Rebuild compile and CI runs from pull request comments and label events.
- **Route-driven dashboard shell:** Home, browse, and analysis are explicit app destinations instead of one in-memory view switcher.
- **Static dashboard:** Browse repositories, daily run history, run duration, job timing, and merge-request links from prebuilt JSON files.
- **Standalone analysis page:** Open a specific run directly and switch between recent runs for the same repository without returning to browsing.

## Tech Stack
- React (Vite)
- Tailwind CSS
- date-fns

## ETL Configuration

The ETL collector reads `etl/repos.yaml` and writes static files into `public/data`.

- Top-level `repos:` still supports explicit `owner/repo` entries.
- Under `orgs:`, if `repos:` is omitted, the collector will discover all repositories under that organization automatically.
- `exclude:` removes specific repositories from an organization-level discovery result.
- `repo_overrides:` lets a specific repository override or append to the organization's default rules.

Example:

```yaml
orgs:
  - name: Ascend
    rules:
      - id: compile
        when:
          - { phase: trigger, source: comment, pattern: "compile", match: equals }
    exclude:
      - Ascend/example-ignored-repo
    repo_overrides:
      Ascend/community:
        mode: replace
        rules:
          - id: compile
            when:
              - { phase: trigger, source: comment, pattern: "/compile", match: equals }

repos:
  - vllm-project/vllm-ascend
```

Override modes:

- `append`: keep the organization rules and append repo-specific rules
- `replace`: use only the repo-specific rules for that repository

## Getting Started

1. **Prerequisites:** Node.js installed.
2. **Setup:**
   ```bash
   cd gitcode-pr-analyzer
   npm install
   ```
3. **Collect data:**
   ```bash
   GITCODE_TOKEN=your_token npm run collect
   ```
4. **Run the dashboard:**
   ```bash
   npm run dev
   ```
5. **Usage:**
   - Open the app in your browser.
   - Start at `/#/` for the home page.
   - Use `/#/browse` to explore organizations and repositories.
   - Use `/#/analysis/:owner/:repo/:runId` to open a specific run directly when needed.

## Frontend Lint

- Run the frontend lint gate manually with `npm run lint`.
- The first pass only checks frontend source files under `src/`.
- The lint gate is fail-only in this repo; it does not rewrite files automatically.

To enable commit-time checks with `pre-commit`:

```bash
pip install pre-commit
pre-commit install
```

After installation, commits that include matching `src/**/*.js` or `src/**/*.jsx` files will run the same frontend lint contract automatically.

GitHub Actions also enforces the same command through `.github/workflows/frontend-lint.yml` on normal development pushes and pull requests.

## Frontend Route Contract

- `/#/`
  Lightweight home/orientation page.
- `/#/browse`
  Browse landing state.
- `/#/browse/:owner`
  Organization-level browse view.
- `/#/browse/:owner/:repo`
  Repository-level browse view.
- `/#/analysis`
  Analysis landing state.
- `/#/analysis/:owner/:repo`
  Analysis page scoped to one repository with recent-run switching.
- `/#/analysis/:owner/:repo/:runId`
  Analysis page with a specific run selected directly.

## Collection Logic
- **Target resolution:** The collector merges top-level repositories, explicit organization repository lists, and implicit organization discovery into one deduplicated target set.
- **CI reconstruction:** Each configured rule matches comment and label events to rebuild CI runs for a pull request.
- **Daily storage:** Reconstructed runs are grouped by date and written as `public/data/YYYY-MM-DD.json`, with `public/data/index.json` used as the dashboard entry point.
