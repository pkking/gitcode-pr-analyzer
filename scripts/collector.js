import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { analyzePR } from '../src/utils/analyzer.js';
import { getPRs, getComments, getModifyHistory, getOperateLogs } from '../src/api/gitcode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'public/data');

async function main() {
  const token = process.env.GITCODE_TOKEN;
  if (!token) {
    console.error('Error: GITCODE_TOKEN environment variable is not set.');
    process.exit(1);
  }

  await fs.mkdir(dataDir, { recursive: true });

  const configPath = path.join(rootDir, 'config/repositories.yml');
  let repositories = [];
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configContent);
    repositories = config.repositories || [];
  } catch (e) {
    console.error('Error reading config/repositories.yml:', e.message);
    process.exit(1);
  }

  const indexPath = path.join(dataDir, 'index.json');
  let indexData = { repositories: [] };
  try {
    const indexContent = await fs.readFile(indexPath, 'utf8');
    indexData = JSON.parse(indexContent);
  } catch (e) {
    // File doesn't exist yet
  }

  for (const repoInfo of repositories) {
    if (!repoInfo.enabled) continue;
    const { owner, repo } = repoInfo;
    console.log(`Processing repository: ${owner}/${repo}`);

    const repoDataDir = path.join(dataDir, owner, repo);
    await fs.mkdir(repoDataDir, { recursive: true });

    try {
      const prs = await getPRs(owner, repo, token, 'all');
      console.log(`Found ${prs.length} PRs`);

      const repoIndexEntry = {
        owner,
        repo,
        last_updated: new Date().toISOString(),
        pull_requests: []
      };

      for (const pr of prs) {
        console.log(`Analyzing PR #${pr.number}...`);
        const [comments, history, operateLogs] = await Promise.all([
          getComments(owner, repo, pr.number, token),
          getModifyHistory(owner, repo, pr.number, token),
          getOperateLogs(owner, repo, pr.number, token),
        ]);
        
        const analysisResult = analyzePR(pr, comments, history, operateLogs);
        
        const prFilePath = path.join(repoDataDir, `pr-${pr.number}.json`);
        await fs.writeFile(prFilePath, JSON.stringify(analysisResult, null, 2));
        
        repoIndexEntry.pull_requests.push({
          number: pr.number,
          title: pr.title,
          file_path: `data/${owner}/${repo}/pr-${pr.number}.json`,
          analyzed_at: new Date().toISOString()
        });
      }

      const existingRepoIdx = indexData.repositories.findIndex(r => r.owner === owner && r.repo === repo);
      if (existingRepoIdx !== -1) {
        indexData.repositories[existingRepoIdx] = repoIndexEntry;
      } else {
        indexData.repositories.push(repoIndexEntry);
      }

    } catch (error) {
      console.error(`Failed to process ${owner}/${repo}:`, error.message);
    }
  }

  indexData.last_updated = new Date().toISOString();
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  console.log('Collector finished.');
}

main().catch(console.error);
