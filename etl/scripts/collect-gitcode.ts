import { format, subDays, parseISO, isBefore } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { extractLabelEvents } from '../../src/utils/gitcodeCiEvents.js';
import { buildLastCiRemovalToMerge } from '../lib/ci-metrics.js';
import { normalizeConfig, normalizeRepoIdentifier, resolveRepoTargets } from '../lib/config.js';
import { mergePullRequestData, needsPullRequestHydration, normalizeMergedAt } from '../lib/pull-request.js';
import { safeFormatUtc } from '../lib/time.js';

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
  completed_at: string | null;
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

interface RepoOverviewMetrics {
  key: string;
  owner: string;
  repo: string;
  prE2EP50: number | null;
  prE2EP90: number | null;
  ciE2EP50: number | null;
  ciE2EP90: number | null;
  ciStartupP50: number | null;
  ciStartupP90: number | null;
  ciExecP50: number | null;
  ciExecP90: number | null;
  prReviewP50: number | null;
  prReviewP90: number | null;
  ciComplianceRate: number | null;
  runCount: number;
  prDetailCount: number;
}

interface HomeOverview {
  generated_at: string;
  source_last_updated: string;
  orgs: string[];
  summary: {
    repoCount: number;
    totalRuns: number;
    totalPrDetails: number;
  };
  repos: RepoOverviewMetrics[];
}

interface PhaseDef {
  phase: 'trigger' | 'start' | 'finish';
  source: 'comment' | 'label';
  action?: 'added' | 'removed';
  pattern: string;
  match: 'contains' | 'startswith' | 'endswith' | 'equals' | 'glob';
  conclusion?: 'success' | 'failure' | 'pending';
}

interface CIRule {
  id: string;
  when: PhaseDef[];
}

interface RepoOverride {
  mode?: 'append' | 'replace';
  rules?: CIRule[];
}

interface OrgConfig {
  name?: string;
  rules?: CIRule[];
  repos?: string[];
  exclude?: string[];
  repo_overrides?: Record<string, RepoOverride>;
}

interface ReposConfig {
  repos?: string[];
  orgs?: OrgConfig[];
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

interface PrDetail {
  prNumber: number;
  owner: string;
  repo: string;
  createdAt: string;
  mergedAt: string | null;
  prSubmitToMerge: {
    durationSeconds: number;
    fromTime: string;
    toTime: string;
  } | null;
  compileToCiCycles: Array<{
    compileTime: string;
    startTime: string;
    finishTime: string;
    durationSeconds: number;
  }>;
  lastCiRemovalToMerge: {
    durationSeconds: number;
    fromTime: string;
    toTime: string;
  } | null;
}

const GITCODE_API_BASE = 'https://api.gitcode.com/api/v5';
const ETL_DIR = path.join(process.cwd(), 'etl');
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const HOME_OVERVIEW_PATH = path.join(DATA_DIR, 'home-overview.json');
const REPOS_CONFIG_PATH = path.join(ETL_DIR, 'repos.yaml');
const CI_COMPLIANCE_THRESHOLD_SECONDS = 3600;

/**
 * Safely parse a date string, returning null if invalid instead of throwing.
 * date-fns functions throw "Invalid time value" on invalid dates.
 */
function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Safely format a date, returning a fallback ISO string if the date is invalid.
 */
function safeFormat(date: Date, _formatStr: string): string {
  try {
    if (!isValidDate(date)) return 'unknown';
    return safeFormatUtc(date);
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a date value is valid (not Invalid Date).
 */
function isValidDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

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
  const fallbackRepos = (process.env.TARGET_REPOS || '').split(',').map(s => s.trim()).filter(Boolean);
  try {
    const content = fs.readFileSync(REPOS_CONFIG_PATH, 'utf-8');
    return normalizeConfig(yaml.load(content) as ReposConfig);
  } catch {
    return normalizeConfig({}, fallbackRepos);
  }
}

function getBackfillSince(): Date | null {
  const value = String(process.env.BACKFILL_SINCE || '').trim();
  if (!value) return null;
  return safeParseDate(value);
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

function normalizeRepoKey(repoKey: string | null | undefined): string {
  return String(repoKey || '').trim().toLowerCase();
}

function getRunRepoKey(run: Run): string {
  const segments = String(run?.html_url || '').split('/').filter(Boolean);
  const mergeRequestIndex = segments.findIndex(segment => segment === 'merge_requests' || segment === 'pulls');
  if (mergeRequestIndex < 2) return '';
  return segments.slice(2, mergeRequestIndex).join('/');
}

function getPrDetailRepoKeyFromFilePath(filePath: string): string {
  const match = String(filePath || '').match(/^([^/]+)\/(.+)\/pr-(\d+)\.json$/);
  return match ? `${match[1]}/${match[2]}` : '';
}

function percentileFromSorted(valid: number[], p: number): number | null {
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  const index = (p / 100) * (valid.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return valid[lower];
  const fraction = index - lower;
  return valid[lower] + fraction * (valid[upper] - valid[lower]);
}

function getRunStartupDuration(run: Run): number | null {
  const runCreatedAt = safeParseDate(run?.created_at);
  const startedAts = (run.jobs || [])
    .map(job => safeParseDate(job.started_at))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());

  if (runCreatedAt && startedAts.length > 0) {
    return Math.max(0, (startedAts[0].getTime() - runCreatedAt.getTime()) / 1000);
  }

  const queueDurations = (run.jobs || [])
    .map(job => job.queueDurationInSeconds)
    .filter((value): value is number => Number.isFinite(value));

  if (queueDurations.length > 0) {
    return Math.max(0, Math.min(...queueDurations));
  }

  return null;
}

function getRunExecutionDuration(run: Run, startupDuration: number | null): number | null {
  if (Number.isFinite(run.durationInSeconds)) {
    const startup = Number.isFinite(startupDuration) ? startupDuration : 0;
    return Math.max(0, run.durationInSeconds - startup);
  }

  const startedAts = (run.jobs || [])
    .map(job => safeParseDate(job.started_at))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());
  const completedAts = (run.jobs || [])
    .map(job => safeParseDate(job.completed_at))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime());

  if (startedAts.length > 0 && completedAts.length > 0) {
    return Math.max(0, (completedAts[0].getTime() - startedAts[0].getTime()) / 1000);
  }

  return null;
}

function buildHomeOverview(index: Index, prDetailsIndex: string[]): HomeOverview {
  const repoEntries = Object.entries(index.repos || {})
    .map(([key, value]) => {
      const [owner, ...repoParts] = key.split('/');
      return {
        key,
        owner,
        repo: repoParts.join('/'),
        files: value.files || [],
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const dayFiles = new Set<string>();
  for (const repo of repoEntries) {
    for (const file of repo.files) {
      dayFiles.add(file);
    }
  }

  const runsByRepo = new Map<string, Run[]>();
  let totalRuns = 0;
  for (const file of dayFiles) {
    const dayData = readDayData(String(file).replace(/\.json$/, ''));
    for (const run of dayData.runs || []) {
      const repoKey = normalizeRepoKey(getRunRepoKey(run));
      if (!repoKey) continue;
      if (!runsByRepo.has(repoKey)) runsByRepo.set(repoKey, []);
      runsByRepo.get(repoKey)?.push(run);
      totalRuns += 1;
    }
  }

  const prDetailsByRepo = new Map<string, PrDetail[]>();
  let totalPrDetails = 0;
  for (const filePath of prDetailsIndex) {
    const detailPath = path.join(DATA_DIR, filePath);
    if (!fs.existsSync(detailPath)) continue;
    try {
      const repoKey = normalizeRepoKey(getPrDetailRepoKeyFromFilePath(filePath));
      if (!repoKey) continue;
      const detail = JSON.parse(fs.readFileSync(detailPath, 'utf-8')) as PrDetail;
      if (!prDetailsByRepo.has(repoKey)) prDetailsByRepo.set(repoKey, []);
      prDetailsByRepo.get(repoKey)?.push(detail);
      totalPrDetails += 1;
    } catch {
      continue;
    }
  }

  const repos: RepoOverviewMetrics[] = repoEntries.map(repoEntry => {
    const repoKey = normalizeRepoKey(repoEntry.key);
    const runs = runsByRepo.get(repoKey) || [];
    const details = prDetailsByRepo.get(repoKey) || [];
    const runDurations = runs.map(run => {
      const startupDuration = getRunStartupDuration(run);
      return {
        startupDuration,
        executionDuration: getRunExecutionDuration(run, startupDuration),
      };
    });

    const prE2EDurations = details
      .map(d => d?.prSubmitToMerge?.durationSeconds)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b);
    const ciE2EDurations = runs
      .map(r => r.durationInSeconds)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b);
    const ciStartupDurations = runDurations
      .map(run => run.startupDuration)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b);
    const ciExecDurations = runDurations
      .map(run => run.executionDuration)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b);
    const prReviewDurations = details
      .map(d => d?.lastCiRemovalToMerge?.durationSeconds)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b);
    const ciCompliantCount = runs.filter(r => r.durationInSeconds <= CI_COMPLIANCE_THRESHOLD_SECONDS).length;

    return {
      key: repoEntry.key,
      owner: repoEntry.owner,
      repo: repoEntry.repo,
      prE2EP50: percentileFromSorted(prE2EDurations, 50),
      prE2EP90: percentileFromSorted(prE2EDurations, 90),
      ciE2EP50: percentileFromSorted(ciE2EDurations, 50),
      ciE2EP90: percentileFromSorted(ciE2EDurations, 90),
      ciStartupP50: percentileFromSorted(ciStartupDurations, 50),
      ciStartupP90: percentileFromSorted(ciStartupDurations, 90),
      ciExecP50: percentileFromSorted(ciExecDurations, 50),
      ciExecP90: percentileFromSorted(ciExecDurations, 90),
      prReviewP50: percentileFromSorted(prReviewDurations, 50),
      prReviewP90: percentileFromSorted(prReviewDurations, 90),
      ciComplianceRate: runs.length > 0 ? (ciCompliantCount / runs.length) * 100 : null,
      runCount: runs.length,
      prDetailCount: details.length,
    };
  });

  const orgs = Array.from(new Set(repoEntries.map(repo => repo.owner))).sort((a, b) => a.localeCompare(b));

  return {
    generated_at: new Date().toISOString(),
    source_last_updated: index.last_updated || '',
    orgs,
    summary: {
      repoCount: repos.length,
      totalRuns,
      totalPrDetails,
    },
    repos,
  };
}

function writeHomeOverview(index: Index, prDetailsIndex: string[]) {
  const overview = buildHomeOverview(index, prDetailsIndex);
  fs.writeFileSync(HOME_OVERVIEW_PATH, JSON.stringify(overview, null, 2));
  console.log(`Wrote ${overview.repos.length} repo entries to home-overview.json`);
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

function inferConclusion(value: string, fallback: 'success' | 'failure' | 'pending' = 'success'): 'success' | 'failure' | 'pending' {
  const normalized = value.toLowerCase();
  if (normalized.includes('fail') || normalized.includes('失败')) return 'failure';
  if (normalized.includes('success') || normalized.includes('passed') || normalized.includes('成功')) return 'success';
  return fallback;
}

async function gitcodeFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const token = process.env.GITCODE_TOKEN;
  if (!token) throw new Error('GITCODE_TOKEN is required');

  const url = new URL(`${GITCODE_API_BASE}${endpoint}`);
  url.searchParams.set('access_token', token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new Error(`Network error while requesting ${endpoint}. Check outbound network access and GitCode availability.`, {
      cause: error,
    });
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication failed for ${endpoint}. Check whether GITCODE_TOKEN is valid and has access to the target resource.`);
    }

    if (response.status === 404) {
      throw new Error(`Resource not found for ${endpoint}. The repository or organization may not exist on GitCode, or the token may not have visibility.`);
    }

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

interface GitCodeRepo {
  path_with_namespace?: string;
  full_name?: string;
  name_with_namespace?: string;
  namespace?: { path?: string; name?: string };
  path?: string;
  name?: string;
}

async function discoverOrgRepos(orgName: string): Promise<string[]> {
  try {
    const repos = await paginate(`/orgs/${orgName}/repos`);
    const repoNames = repos
      .map((repo: GitCodeRepo) => {
        if (repo.path_with_namespace) return repo.path_with_namespace;
        if (repo.full_name) return repo.full_name;
        if (repo.name_with_namespace) return repo.name_with_namespace;
        if (repo.namespace?.path && repo.path) return `${repo.namespace.path}/${repo.path}`;
        if (repo.namespace?.name && repo.name) return `${repo.namespace.name}/${repo.name}`;
        return '';
      })
      .map(normalizeRepoIdentifier)
      .filter(Boolean);

    if (repoNames.length === 0) {
      console.warn(`No repositories discovered for org ${orgName}. The org may be empty, inaccessible to this token, or not present on GitCode.`);
    } else {
      console.log(`  Discovered ${repoNames.length} repos for org ${orgName}`);
    }

    return repoNames;
  } catch (error) {
    console.error(`Failed to discover repositories for org ${orgName}:`, error instanceof Error ? error.message : error);
    return [];
  }
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
  const labelEvents = extractLabelEvents({ operateLogs: logs });

  for (const rule of rules) {
    for (let pIdx = 0; pIdx < rule.when.length; pIdx++) {
      const phase = rule.when[pIdx];

      if (phase.source === 'comment') {
        for (const c of comments) {
          if (matchesPattern(c.body.trim(), phase.pattern, phase.match)) {
            const ts = safeParseDate(c.created_at);
            if (!ts) continue;
            timeline.push({
              timestamp: ts,
              ruleId: rule.id,
              phaseIdx: pIdx,
              detail: c.body.trim().substring(0, 80),
              user: c.user?.login || 'unknown',
              conclusion: phase.phase === 'finish' ? phase.conclusion || inferConclusion(c.body) : undefined,
            });
          }
        }
      }

      if (phase.source === 'label') {
        for (const event of labelEvents) {
          if (event.type === phase.action && matchesPattern(event.label, phase.pattern, phase.match)) {
            if (!isValidDate(event.timestamp)) continue;
            timeline.push({
              timestamp: event.timestamp,
              ruleId: rule.id,
              phaseIdx: pIdx,
              detail: event.label,
              user: event.user,
              conclusion: phase.conclusion || inferConclusion(event.label),
            });
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
    let nextStartIdx = 0;
    let nextFinishIdx = 0;

    let triggerCount = 0;
    const ruleIdx = rules.indexOf(rule);

    for (const trigger of ruleTriggers) {
      const startTime = trigger.timestamp;
      const runId = pr.number * 10000 + ruleIdx * 100 + triggerCount;
      triggerCount++;

      // Find the first start event after this trigger
      while (nextStartIdx < ruleStarts.length && ruleStarts[nextStartIdx].timestamp < startTime) {
        nextStartIdx++;
      }
      const matchingStart = nextStartIdx < ruleStarts.length ? ruleStarts[nextStartIdx] : null;

      const finishThreshold = matchingStart?.timestamp || startTime;
      while (nextFinishIdx < ruleFinishes.length && ruleFinishes[nextFinishIdx].timestamp < finishThreshold) {
        nextFinishIdx++;
      }
      const matchingFinish = nextFinishIdx < ruleFinishes.length ? ruleFinishes[nextFinishIdx] : null;

      const endTime = matchingFinish?.timestamp || null;
      const conclusion = matchingFinish?.conclusion || 'pending';
      const jobName = matchingStart?.detail || matchingFinish?.detail || rule.id;

      const resolvedEnd = endTime || matchingStart?.timestamp || startTime;
      const durationInSeconds = Math.max(0, (resolvedEnd.getTime() - startTime.getTime()) / 1000);
      const queueDuration = matchingStart 
        ? Math.max(0, (matchingStart.timestamp.getTime() - startTime.getTime()) / 1000)
        : 30;

      runs.push({
        id: runId,
        name: `PR #${pr.number} ${rule.id} - ${pr.title.substring(0, 50)}`,
        head_branch: pr.head.ref,
        status: endTime ? 'completed' : 'pending',
        conclusion,
        created_at: safeFormat(startTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        updated_at: safeFormat(resolvedEnd, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        html_url: pr.html_url,
        durationInSeconds,
        jobs: [
          {
            id: runId + 1,
            name: jobName,
            status: endTime ? 'completed' : 'pending',
            conclusion,
            created_at: safeFormat(startTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
            started_at: safeFormat(new Date(startTime.getTime() + queueDuration * 1000), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
            completed_at: endTime ? safeFormat(resolvedEnd, "yyyy-MM-dd'T'HH:mm:ss'Z'") : null,
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

function buildPrDetail(
  pr: GitCodePullRequest,
  runs: Run[],
  comments: GitCodeComment[],
  logs: GitCodeOperateLog[],
  rules: CIRule[],
  owner: string,
  repo: string
): PrDetail {
  const compileToCiCycles = runs.map(run => {
    const compileTime = run.created_at;
    const startTime = run.jobs?.[0]?.started_at || run.created_at;
    const finishTime = run.jobs?.[0]?.completed_at || run.updated_at;
    const compileDate = safeParseDate(compileTime);
    const finishDate = safeParseDate(finishTime);
    const durationSeconds = (compileDate && finishDate)
      ? Math.max(0, (finishDate.getTime() - compileDate.getTime()) / 1000)
      : 0;

    return {
      compileTime,
      startTime,
      finishTime,
      durationSeconds,
    };
  });

  let prSubmitToMerge: PrDetail['prSubmitToMerge'] = null;
  const mergedAtValue = normalizeMergedAt(pr.merged_at);

  if (mergedAtValue) {
    const createdAt = safeParseDate(pr.created_at);
    const mergedAt = safeParseDate(mergedAtValue);
    if (createdAt && mergedAt) {
      const durationSeconds = Math.max(0, (mergedAt.getTime() - createdAt.getTime()) / 1000);
      prSubmitToMerge = {
        durationSeconds,
        fromTime: safeFormat(createdAt, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        toTime: safeFormat(mergedAt, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      };
    }
  }

  let lastCiRemovalToMerge: PrDetail['lastCiRemovalToMerge'] = null;

  lastCiRemovalToMerge = buildLastCiRemovalToMerge(runs, mergedAtValue, {
    parseDate: safeParseDate,
    formatDate: value => safeFormat(value, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  });

  return {
    prNumber: pr.number,
    owner,
    repo,
    createdAt: pr.created_at,
    mergedAt: mergedAtValue,
    prSubmitToMerge,
    compileToCiCycles,
    lastCiRemovalToMerge,
  };
}

async function hydratePullRequest(
  ownerPath: string,
  repoPath: string,
  pr: GitCodePullRequest
): Promise<GitCodePullRequest> {
  if (!needsPullRequestHydration(pr)) {
    return mergePullRequestData(pr, {});
  }

  try {
    const detail = await gitcodeFetch(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}`);
    return mergePullRequestData(pr, detail);
  } catch (error) {
    console.warn(
      `    Failed to hydrate PR #${pr.number}; continuing with list payload:`,
      error instanceof Error ? error.message : error
    );
    return mergePullRequestData(pr, {});
  }
}

async function main() {
  const config = readConfig();
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '90');
  const backfillSince = getBackfillSince();
  const requestedRepos = (process.env.TARGET_REPOS || '')
    .split(',')
    .map(repo => normalizeRepoIdentifier(repo))
    .filter(Boolean);
  const requestedRepoSet = new Set(requestedRepos);
  const resolvedTargets = await resolveRepoTargets(config, discoverOrgRepos);
  const targets = requestedRepoSet.size > 0
    ? resolvedTargets.filter(target => requestedRepoSet.has(normalizeRepoIdentifier(target.repo)))
    : resolvedTargets;

  if (targets.length === 0) {
    console.log('No repositories configured. Skipping collection.');
    return;
  }

  const index = readIndex();

  for (const { repo, rules } of targets) {
    try {
      console.log(`Processing ${repo} (${rules.length} rules)...`);
      const canonicalRepo = normalizeRepoIdentifier(repo);
      const [owner, ...repoSegments] = canonicalRepo.split('/');
      const repoName = repoSegments.join('/');
      if (!owner || !repoName) {
        console.error(`Invalid repo format: ${repo}. Expected owner/repo`);
        continue;
      }

      const ownerPath = encodeURIComponent(owner);
      const repoPath = encodeURIComponent(repoName);

      const repoIndex = index.repos[canonicalRepo];
      const lastUpdated = backfillSince
        || safeParseDate(repoIndex?.latest)
        || subDays(new Date(), retentionDays);

      const since = format(lastUpdated, "yyyy-MM-dd'T'HH:mm:ssXXX");
      console.log(`  Fetching PRs since ${since}...`);
      const prs = await paginate(`/repos/${ownerPath}/${repoPath}/pulls`, {
        state: 'all',
        since: since,
        sort: 'updated',
        direction: 'desc',
      });
      console.log(`  Found ${prs.length} PRs`);

      const allRuns: Run[] = [];

      for (const pr of prs) {
        console.log(`  Processing PR #${pr.number}: ${pr.title.substring(0, 40)}...`);
        const hydratedPr = await hydratePullRequest(ownerPath, repoPath, pr);

        const [reviewComments, logs] = await Promise.all([
          paginate(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}/comments`),
          paginate(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}/operate_logs`),
        ]);

        // Fetch issue-style comments with fallback (endpoint may not exist for all repos)
        let issueComments: GitCodeComment[] = [];
        try {
          issueComments = await paginate(`/repos/${ownerPath}/${repoPath}/issues/${pr.number}/comments`);
        } catch {
          // Issue comments endpoint unavailable for this PR; review comments still captured
        }

        // Merge and deduplicate comments by ID
        const seenCommentIds = new Set<string>();
        const comments: GitCodeComment[] = [];

        for (const comment of [...reviewComments, ...issueComments]) {
          if (!seenCommentIds.has(comment.id)) {
            seenCommentIds.add(comment.id);
            comments.push(comment);
          }
        }

        console.log(`    ${reviewComments.length} review comments, ${issueComments.length} issue comments, ${logs.length} operate logs (${comments.length} merged)`);

        const runs = reconstructCIRuns(hydratedPr, comments, logs, rules);
        console.log(`    Reconstructed ${runs.length} CI runs`);
        allRuns.push(...runs);

        const prDetail = buildPrDetail(hydratedPr, runs, comments, logs, rules, owner, repoName);
        const prDetailDir = path.join(DATA_DIR, owner, repoName);
        const prDetailFile = path.join(prDetailDir, `pr-${hydratedPr.number}.json`);

        if (!fs.existsSync(prDetailDir)) {
          fs.mkdirSync(prDetailDir, { recursive: true });
        }

        fs.writeFileSync(prDetailFile, JSON.stringify(prDetail, null, 2));
        console.log(`    Wrote PR detail to ${path.relative(DATA_DIR, prDetailFile)}`);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const runsByDate: Record<string, Run[]> = {};
      for (const run of allRuns) {
        const runDate = safeParseDate(run.created_at);
        const date = runDate ? format(runDate, 'yyyy-MM-dd') : 'unknown';
        if (!runsByDate[date]) runsByDate[date] = [];
        runsByDate[date].push(run);
      }

      const dates = Object.keys(runsByDate).sort().reverse();
      const files = index.repos[canonicalRepo]?.files || [];

      for (const date of dates) {
        console.log(`  Writing ${date}.json (${runsByDate[date].length} runs)`);
        const existing = readDayData(date);
        const runMap = new Map(existing.runs.map(r => [r.id, r]));
        for (const run of runsByDate[date]) runMap.set(run.id, run);

        writeDayData({ date, repo: canonicalRepo, runs: Array.from(runMap.values()) });

        if (!files.includes(`${date}.json`)) {
          files.push(`${date}.json`);
        }
      }

      files.sort().reverse();

      index.repos[canonicalRepo] = {
        latest: dates[0] || repoIndex?.latest || '',
        files,
        retention_days: retentionDays,
      };
      index.last_updated = new Date().toISOString();

      const cutoffDate = subDays(new Date(), retentionDays);
      const filesToRemove = files.filter(f => {
        const fileDate = safeParseDate(f.replace('.json', ''));
        return fileDate && isBefore(fileDate, cutoffDate);
      });

      for (const file of filesToRemove) {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
          console.log(`  Removing old file: ${file}`);
          fs.unlinkSync(filePath);
        }
        const idx = index.repos[canonicalRepo].files.indexOf(file);
        if (idx > -1) index.repos[canonicalRepo].files.splice(idx, 1);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : '';
      console.error(`Error processing repo ${repo}. This may indicate a non-GitCode repository, missing visibility, or a transient network problem: ${errorMsg}`);
      if (stack && process.env.DEBUG === 'true') {
        console.error(stack);
      }
    }
  }

  writeIndex(index);

  // Write PR details index for the overview page
  const prDetailsIndexPath = path.join(DATA_DIR, 'pr-details-index.json');
  const prDetailsIndex: string[] = [];
  function collectPrDetails(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectPrDetails(fullPath);
      } else if (entry.name.match(/^pr-\d+\.json$/)) {
        const relativePath = path.relative(DATA_DIR, fullPath).replace(/\\/g, '/');
        prDetailsIndex.push(relativePath);
      }
    }
  }
  collectPrDetails(DATA_DIR);
  prDetailsIndex.sort();
  fs.writeFileSync(prDetailsIndexPath, JSON.stringify(prDetailsIndex, null, 2));
  console.log(`Wrote ${prDetailsIndex.length} PR detail entries to pr-details-index.json`);
  writeHomeOverview(index, prDetailsIndex);

  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
