import { format, subDays, parseISO, isBefore } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface Run {
  id: number;
  name: string;
  head_branch: string;
  status: string;
  conclusion: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  durationInSeconds: number;
  jobs?: Job[];
}

interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  created_at: string;
  started_at: string;
  completed_at: string;
  html_url: string;
  queueDurationInSeconds: number;
  durationInSeconds: number;
}

interface Index {
  version: number;
  repos: Record<string, { latest: string; files: string[]; retention_days: number }>;
  last_updated: string;
}

interface DayData {
  date: string;
  repo: string;
  runs: Run[];
}

interface PhaseDef {
  phase: 'trigger' | 'start' | 'finish';
  source: 'comment' | 'label';
  action?: 'added' | 'removed';
  pattern: string;
  match: 'contains' | 'startswith' | 'endswith' | 'equals' | 'glob';
}

interface CIRule {
  id: string;
  when: PhaseDef[];
}

interface OrgConfig {
  name: string;
  rules: CIRule[];
  repos: string[];
}

interface ReposConfig {
  repos: string[];
  orgs: OrgConfig[];
}

interface GitCodeComment {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  user: { login: string; name: string; html_url: string };
}

interface GitCodeOperateLog {
  id: number;
  content: string; // e.g. "add label ci-pipeline-running"
  action: string;
  created_at: string;
  user: { login: string };
}

interface GitCodePullRequest {
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  labels: Array<{ name: string; color: string }>;
  user: { login: string; name: string };
}

const GITCODE_API_BASE = 'https://api.gitcode.com/api/v5';
const ETL_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, '../../data');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const REPOS_CONFIG_PATH = path.join(ETL_DIR, 'repos.yaml');

function readIndex(): Index {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    return { version: 1, repos: {}, last_updated: '' };
  }
}

function writeIndex(index: Index) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function readConfig(): ReposConfig {
  try {
    const content = fs.readFileSync(REPOS_CONFIG_PATH, 'utf-8');
    return yaml.load(content) as ReposConfig;
  } catch {
    return {
      repos: (process.env.TARGET_REPOS || '').split(',').map(s => s.trim()).filter(Boolean),
      orgs: [],
    };
  }
}

function readDayData(date: string): DayData {
  const filePath = path.join(DATA_DIR, `${date}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { date, repo: '', runs: [] };
  }
}

function writeDayData(data: DayData) {
  const filePath = path.join(DATA_DIR, `${data.date}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function matchesPattern(value: string, pattern: string, matchType: string): boolean {
  const v = value.toLowerCase();
  const p = pattern.toLowerCase();
  switch (matchType) {
    case 'contains': return v.includes(p);
    case 'startswith': return v.startsWith(p);
    case 'endswith': return v.endsWith(p);
    case 'equals': return v === p;
    case 'glob': return new RegExp('^' + p.replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(v);
    default: return v.includes(p);
  }
}

async function gitcodeFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const token = process.env.GITCODE_TOKEN;
  if (!token) throw new Error('GITCODE_TOKEN is required');

  const url = new URL(`${GITCODE_API_BASE}${endpoint}`);
  url.searchParams.set('access_token', token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`GitCode API error: ${response.status} ${response.statusText} - ${endpoint}`);
  }
  return response.json();
}

async function paginate(endpoint: string, params: Record<string, string> = {}): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const batch = await gitcodeFetch(endpoint, { ...params, page: String(page), per_page: '100' });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return all;
}

interface PhaseMatch {
  timestamp: Date;
  ruleId: string;
  phaseIdx: number;
  detail: string;
  user: string;
  conclusion?: string;
}

function buildTimeline(
  comments: GitCodeComment[],
  logs: GitCodeOperateLog[],
  rules: CIRule[]
): PhaseMatch[] {
  const timeline: PhaseMatch[] = [];

  for (const rule of rules) {
    for (let pIdx = 0; pIdx < rule.when.length; pIdx++) {
      const phase = rule.when[pIdx];

      if (phase.source === 'comment') {
        for (const c of comments) {
          if (matchesPattern(c.body.trim(), phase.pattern, phase.match)) {
            timeline.push({
              timestamp: new Date(c.created_at),
              ruleId: rule.id,
              phaseIdx: pIdx,
              detail: c.body.trim().substring(0, 80),
              user: c.user?.login || 'unknown',
            });
          }
        }
      }

      if (phase.source === 'label') {
        const actionPrefix = phase.action === 'added' ? 'add label ' : 'delete label ';
        for (const log of logs) {
          if (log.content.startsWith(actionPrefix)) {
            const labelName = log.content.substring(actionPrefix.length).trim();
            if (matchesPattern(labelName, phase.pattern, phase.match)) {
              timeline.push({
                timestamp: new Date(log.created_at),
                ruleId: rule.id,
                phaseIdx: pIdx,
                detail: labelName,
                user: log.user?.login || 'unknown',
                conclusion: labelName.includes('fail') ? 'failure' : 'success',
              });
            }
          }
        }
      }
    }
  }

  return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function reconstructCIRuns(
  pr: GitCodePullRequest,
  comments: GitCodeComment[],
  logs: GitCodeOperateLog[],
  rules: CIRule[],
): Run[] {
  const runs: Run[] = [];
  const timeline = buildTimeline(comments, logs, rules);

  for (const rule of rules) {
    const triggerIndices = rule.when.map((p, i) => p.phase === 'trigger' ? i : -1).filter(i => i !== -1);
    const startIndices = rule.when.map((p, i) => p.phase === 'start' ? i : -1).filter(i => i !== -1);
    const finishIndices = rule.when.map((p, i) => p.phase === 'finish' ? i : -1).filter(i => i !== -1);

    const ruleEvents = timeline.filter(e => e.ruleId === rule.id);
    const ruleTriggers = ruleEvents.filter(e => triggerIndices.includes(e.phaseIdx));
    const ruleStarts = ruleEvents.filter(e => startIndices.includes(e.phaseIdx));
    const ruleFinishes = ruleEvents.filter(e => finishIndices.includes(e.phaseIdx));

    let triggerCount = 0;
    const ruleIdx = rules.indexOf(rule);

    for (const trigger of ruleTriggers) {
      const startTime = trigger.timestamp;
      const runId = pr.number * 10000 + ruleIdx * 100 + triggerCount;
      triggerCount++;

      // Find the first start event after this trigger
      const matchingStart = ruleStarts.find(s => s.timestamp >= startTime);
      // Find the first finish event after this trigger (and preferably after start)
      const matchingFinish = ruleFinishes.find(f => f.timestamp > startTime);

      let endTime = matchingFinish?.timestamp || (pr.merged_at ? new Date(pr.merged_at) : null);
      let conclusion = matchingFinish?.conclusion || (endTime ? 'success' : 'pending');
      const jobName = matchingStart?.detail || matchingFinish?.detail || rule.id;

      const resolvedEnd = endTime || new Date();
      const durationInSeconds = Math.max(0, (resolvedEnd.getTime() - startTime.getTime()) / 1000);
      const queueDuration = matchingStart 
        ? Math.max(0, (matchingStart.timestamp.getTime() - startTime.getTime()) / 1000)
        : 30;

      runs.push({
        id: runId,
        name: `PR #${pr.number} ${rule.id} - ${pr.title.substring(0, 50)}`,
        head_branch: pr.head.ref,
        status: 'completed',
        conclusion,
        created_at: format(startTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        updated_at: format(resolvedEnd, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        html_url: pr.html_url,
        durationInSeconds,
        jobs: [
          {
            id: runId + 1,
            name: jobName,
            status: 'completed',
            conclusion,
            created_at: format(startTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
            started_at: format(new Date(startTime.getTime() + queueDuration * 1000), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
            completed_at: format(resolvedEnd, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
            html_url: pr.html_url,
            queueDurationInSeconds: queueDuration,
            durationInSeconds: Math.max(0, durationInSeconds - queueDuration),
          },
        ],
      });
    }
  }

  return runs;
}

async function main() {
  const config = readConfig();
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '90');

  const targetRepos = new Map<string, CIRule[]>();
  for (const org of config.orgs) {
    for (const repo of org.repos) {
      targetRepos.set(repo, org.rules);
    }
  }
  for (const repo of config.repos) {
    if (!targetRepos.has(repo)) targetRepos.set(repo, []);
  }

  if (targetRepos.size === 0) {
    console.log('No repositories configured. Skipping collection.');
    return;
  }

  const index = readIndex();

  for (const [repo, rules] of targetRepos) {
    try {
      console.log(`Processing ${repo} (${rules.length} rules)...`);
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        console.error(`Invalid repo format: ${repo}. Expected owner/repo`);
        continue;
      }

      const repoIndex = index.repos[repo];
      const lastUpdated = repoIndex?.latest
        ? parseISO(repoIndex.latest)
        : subDays(new Date(), retentionDays);

      const since = format(lastUpdated, "yyyy-MM-dd'T'HH:mm:ssXXX");
      console.log(`  Fetching PRs since ${since}...`);
      const prs = await paginate(`/repos/${owner}/${repoName}/pulls`, {
        state: 'all',
        since: since,
        sort: 'updated',
        direction: 'desc',
      });
      console.log(`  Found ${prs.length} PRs`);

      const allRuns: Run[] = [];

      for (const pr of prs) {
        console.log(`  Processing PR #${pr.number}: ${pr.title.substring(0, 40)}...`);

        const [comments, logs] = await Promise.all([
          paginate(`/repos/${owner}/${repoName}/pulls/${pr.number}/comments`),
          paginate(`/repos/${owner}/${repoName}/pulls/${pr.number}/operate_logs`),
        ]);

        console.log(`    ${comments.length} comments, ${logs.length} operate logs`);

        const runs = reconstructCIRuns(pr, comments, logs, rules);
        console.log(`    Reconstructed ${runs.length} CI runs`);
        allRuns.push(...runs);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const runsByDate: Record<string, Run[]> = {};
      for (const run of allRuns) {
        const date = format(new Date(run.created_at), 'yyyy-MM-dd');
        if (!runsByDate[date]) runsByDate[date] = [];
        runsByDate[date].push(run);
      }

      const dates = Object.keys(runsByDate).sort().reverse();
      const files = index.repos[repo]?.files || [];

      for (const date of dates) {
        console.log(`  Writing ${date}.json (${runsByDate[date].length} runs)`);
        const existing = readDayData(date);
        const runMap = new Map(existing.runs.map(r => [r.id, r]));
        for (const run of runsByDate[date]) runMap.set(run.id, run);

        writeDayData({ date, repo, runs: Array.from(runMap.values()) });

        if (!files.includes(`${date}.json`)) {
          files.push(`${date}.json`);
        }
      }

      files.sort().reverse();

      index.repos[repo] = {
        latest: dates[0] || repoIndex?.latest || '',
        files,
        retention_days: retentionDays,
      };
      index.last_updated = new Date().toISOString();

      const cutoffDate = subDays(new Date(), retentionDays);
      const filesToRemove = files.filter(f => {
        const fileDate = parseISO(f.replace('.json', ''));
        return isBefore(fileDate, cutoffDate);
      });

      for (const file of filesToRemove) {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
          console.log(`  Removing old file: ${file}`);
          fs.unlinkSync(filePath);
        }
        const idx = index.repos[repo].files.indexOf(file);
        if (idx > -1) index.repos[repo].files.splice(idx, 1);
      }
    } catch (err) {
      console.error(`Error processing repo ${repo}:`, err instanceof Error ? err.message : err);
    }
  }

  writeIndex(index);
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
