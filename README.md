# GitCode PR Analyzer

A static dashboard backed by an ETL collector for GitCode CI run analytics.

## Features
- **Organization-aware collection:** Configure explicit repositories or discover all repositories under a GitCode organization.
- **CI run reconstruction:** Rebuild compile and CI runs from pull request comments and label events.
- **Overview table:** All repositories displayed on the home page with P50/P90 metrics for PR E2E, CI E2E, CI startup, CI execution, PR review time, and compliance rate.
- **Drill-down navigation:** Click a repo name to see all its PRs; click a PR to view its CI analysis with timeline and job details.
- **Static dashboard:** All data served from prebuilt JSON files — no backend required.

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
   - Start at `/#/` for the overview table showing all repositories.
   - Click a repo name to see all PRs for that repository.
   - Click a PR number to view its CI analysis with timeline and job details.

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
  Overview table showing all repositories with P50/P90 metrics. Click a repo name to drill down.
- `/#/repo/:owner/:repo`
  Repository detail page listing all PRs with run count, status, duration, and success rate.
- `/#/repo/:owner/:repo/:prNumber`
  CI analysis page for a specific PR with timeline, recent runs, and job breakdown.

## Collection Logic
- **Target resolution:** The collector merges top-level repositories, explicit organization repository lists, and implicit organization discovery into one deduplicated target set.
- **CI reconstruction:** Each configured rule matches comment and label events to rebuild CI runs for a pull request.
- **Daily storage:** Reconstructed runs are grouped by date and written as `public/data/YYYY-MM-DD.json`, with `public/data/index.json` used as the dashboard entry point.
