# GitCode PR Analyzer

A static dashboard backed by an ETL collector for GitCode CI run analytics.

## Features
- **Organization-aware collection:** Configure explicit repositories or discover all repositories under a GitCode organization.
- **CI run reconstruction:** Rebuild compile and CI runs from pull request comments and label events.
- **Static dashboard:** Browse repositories, daily run history, run duration, job timing, and merge-request links from prebuilt JSON files.

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
   - Choose a repository from the sidebar.
   - Browse collected CI runs and inspect job timing details.

## Collection Logic
- **Target resolution:** The collector merges top-level repositories, explicit organization repository lists, and implicit organization discovery into one deduplicated target set.
- **CI reconstruction:** Each configured rule matches comment and label events to rebuild CI runs for a pull request.
- **Daily storage:** Reconstructed runs are grouped by date and written as `public/data/YYYY-MM-DD.json`, with `public/data/index.json` used as the dashboard entry point.
