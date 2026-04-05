# Design: GitCode PR Analyzer - Data & Presentation Separation

## 1. Overview
The goal of this project is to refactor the gitcode-pr-analyzer into a two-tier system: a Data Collector (CLI + GitHub Action) and a Data Presenter (React SPA). This separation allows for automated, periodic data gathering and efficient visualization using static files.

## 2. Architecture

### 2.1 Data Collector (CLI)
- Role: Fetch data from GitCode REST API, analyze PR metrics, and save results.
- Location: scripts/collector.js (Node.js).
- Core Metrics:
    1. Compile-to-CI Cycles: Duration between a user's 'compile' comment and the robot removing the ci-pipeline-running label.
    2. Total Duration: Time from PR submission to final PR merge.
    3. CI-to-Merge: Duration between the last ci-pipeline-running label removal and the PR merge event.

### 2.2 Storage Layer
- Format: Static JSON files stored in the data/ directory.
- Structure:
    - data/index.json: Registry of repositories and their analyzed PRs.
    - data/{owner}/{repo}/pr-{number}.json: Granular metrics for a single PR.

### 2.3 Automation (GitHub Action)
- Role: Orchestrate the collector and commit results.
- Schedule: Hourly (0 * * * *).

### 2.4 Presentation (React SPA)
- Role: Read static JSON files and visualize data.
- Platform: Vercel.

## 3. Data Schema

### 3.1 data/index.json
Registry for the frontend to discover available data.

### 3.2 data/{owner}/{repo}/pr-{number}.json
Metrics for a specific PR, including individual cycles and summary statistics.

## 4. Implementation Steps
1. Create scripts/collector.js with API fetching and analysis logic.
2. Add GitHub Action for hourly collection and commit back.
3. Refactor React app to read static JSON files instead of calling APIs.
4. Deploy to Vercel.

## 5. Security
- GITCODE_TOKEN stored as GitHub Secret.
- No secrets stored in the repository.

## 6. Directory Structure

- data/index.json
- data/{owner}/{repo}/pr-{number}.json
- scripts/collector.js
- .github/workflows/collect-data.yml

## 7. Detailed Data Schemas

### 7.1 data/index.json
```json
{
  "last_updated": "2026-04-05T10:00:00Z",
  "repositories": [
    {
      "owner": "gitcode-org",
      "repo": "sample-repo",
      "full_name": "gitcode-org/sample-repo",
      "pr_count": 1,
      "last_analyzed": "2026-04-05T10:00:00Z",
      "pull_requests": [
        {
          "number": 123,
          "title": "Fix bug in auth",
          "state": "merged",
          "created_at": "2026-04-05T08:00:00Z",
          "merged_at": "2026-04-05T09:30:00Z",
          "file_path": "data/gitcode-org/sample-repo/pr-123.json",
          "summary_metrics": {
             "total_duration_seconds": 5400,
             "compile_to_ci_count": 1
          }
        }
      ]
    }
  ]
}
```

### 7.2 data/{owner}/{repo}/pr-{number}.json
```json
{
  "repository": {
    "owner": "gitcode-org",
    "repo": "sample-repo"
  },
  "pull_request": {
    "number": 123,
    "title": "Fix bug in auth",
    "state": "merged",
    "html_url": "https://gitcode.com/gitcode-org/sample-repo/pulls/123",
    "user": "developer1",
    "created_at": "2026-04-05T08:00:00Z",
    "merged_at": "2026-04-05T09:30:00Z",
    "closed_at": "2026-04-05T09:30:00Z"
  },
  "analysis": {
    "compile_to_ci_cycles": [
      {
        "compile_comment_id": 1001,
        "compile_comment_user": "developer1",
        "compile_comment_time": "2026-04-05T08:10:00Z",
        "ci_label_removed_time": "2026-04-05T08:25:00Z",
        "duration_seconds": 900
      }
    ],
    "durations": {
      "pr_submission_to_merge_seconds": 5400,
      "last_ci_removal_to_merge_seconds": 3900
    }
  }
}
```

## 8. Configuration Design (YAML)

### 8.1 config/repositories.yml
To make the system easily extendable, the list of repositories to analyze will be managed via a YAML configuration file. Adding a new repository for data collection only requires a PR to this file.

```yaml
# List of repositories to analyze
repositories:
  - owner: "gitcode-org"
    repo: "sample-repo"
    enabled: true
    # Optional: filters for specific PR states or labels
    filters:
      state: "merged"
  - owner: "another-org"
    repo: "production-app"
    enabled: true
```

### 8.2 Collector Integration
The `scripts/collector.js` will:
1. Read this YAML file at the start of each run.
2. Iterate through each enabled repository.
3. Perform the analysis and update the `data/` directory accordingly.
