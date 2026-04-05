# GitCode PR Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the analyzer into a Data Collector (CLI) and a Data Presenter (React SPA), automated via GitHub Actions and deployed to Vercel.

**Architecture:** Use a Node.js CLI to fetch and analyze PR data from GitCode, storing results in a `data/` directory with a central `index.json`. The React frontend will then read these static files for visualization.

**Tech Stack:** Node.js, React, Vite, Axios, date-fns, YAML, GitHub Actions.

---

### Task 1: Setup Configuration (YAML)

**Files:**
- Create: `config/repositories.yml`

- [ ] **Step 1: Create the YAML config file**

```yaml
# List of repositories to analyze
repositories:
  - owner: "gitcode-org"
    repo: "sample-repo"
    enabled: true
```

- [ ] **Step 2: Commit**

```bash
git add config/repositories.yml
git commit -m "chore: add repository configuration file"
```

### Task 2: Data Collector (CLI)

**Files:**
- Create: `scripts/collector.js`
- Modify: `src/utils/analyzer.js` (to export analysis functions for Node.js usage)

- [ ] **Step 1: Refactor `src/utils/analyzer.js` to be compatible with Node.js and ESM**

Ensure exports are consistent and easy to import in the CLI.

- [ ] **Step 2: Create `scripts/collector.js`**

This script will load the config, fetch data from GitCode, run the analyzer, and save files in the `data/` directory.

- [ ] **Step 3: Test the collector**

Run the collector with a test token and check the output in the `data/` folder.

- [ ] **Step 4: Commit**

```bash
git add scripts/collector.js src/utils/analyzer.js
git commit -m "feat: add data collector CLI"
```

### Task 3: GitHub Action Workflow

**Files:**
- Create: `.github/workflows/collect-data.yml`

- [ ] **Step 1: Create the workflow file**

Setup for hourly data collection and automated git commit back to the repository.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/collect-data.yml
git commit -m "ci: add automated data collection workflow"
```

### Task 4: Frontend Refactoring

**Files:**
- Modify: `src/App.jsx` (to load index.json and fetch PR data statically)
- Modify: `src/api/gitcode.js` (to read from static files instead of the API)

- [ ] **Step 1: Refactor `src/api/gitcode.js`**

Fetch PR analysis from the local static files.

- [ ] **Step 2: Update `src/App.jsx`**

Provide the main dashboard and detailed PR analysis views using the collected data.

- [ ] **Step 3: Test locally**

Run the dev server and verify that the data is correctly loaded and displayed.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/api/gitcode.js
git commit -m "feat: refactor frontend for static data presentation"
```

### Task 5: Vercel Deployment

- [ ] **Step 1: Setup Vercel**

Ensure that the `data/` folder is correctly served as static files.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update dependencies for deployment"
```
