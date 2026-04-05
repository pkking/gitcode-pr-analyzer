# GitCode PR Analyzer

A pure front-end application to analyze Pull Request performance metrics on GitCode.

## Features
- **Compile to CI Removal:** Tracks how long it takes for the `ci-pipeline-running` label to be removed after a user comments "compile".
- **PR Lead Time:** Calculates the total time from PR submission to final merge.
- **Merge Readiness:** Measures the duration from the last CI label removal to the final PR merge.

## Tech Stack
- React (Vite)
- Tailwind CSS
- Axios
- date-fns

## Getting Started

1. **Prerequisites:** Node.js installed.
2. **Setup:**
   ```bash
   cd gitcode-pr-analyzer
   npm install
   ```
3. **Run:**
   ```bash
   npm run dev
   ```
4. **Usage:**
   - Enter the repository owner and name.
   - Provide the Pull Request number.
   - Enter your GitCode Personal Access Token (can be found in your GitCode settings).
   - Click "Analyze PR" to see the metrics.

## Analysis Logic
- **Compile Cycles:** Matches each comment containing "compile" (case-insensitive) with the *first subsequent* removal of the `ci-pipeline-running` label found in the PR's modification history.
- **Time Formatting:** All durations are formatted into human-readable strings (e.g., `2h 15m 30s`).
