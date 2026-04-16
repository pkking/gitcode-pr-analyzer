import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData.js';
import AppShell from '../layouts/AppShell.jsx';
import { EmptyState, OrgView, RepoView } from '../components/DashboardViews.jsx';
import { average, getPrMergeWaitDuration, getRunStageName, getSuccessRate } from '../utils/etlData.js';
import { buildAnalysisPath, buildBrowsePath, getSelectedOrgEntry, getSelectedRepoEntry } from '../utils/routeState.js';

export default function BrowsePage() {
  const params = useParams();
  const {
    detailByKey,
    error,
    fetchRepoRuns,
    indexData,
    loading,
    orgEntries,
    panelLoading,
    repoRunsByKey,
    ensureOrgDetails,
    setError,
  } = useDashboardData();

  const selectedOrg = getSelectedOrgEntry(orgEntries, params);
  const selectedRepo = getSelectedRepoEntry(orgEntries, params);

  useEffect(() => {
    if (!selectedOrg) return;

    Promise.all(selectedOrg.repos.map(repo => fetchRepoRuns(repo)))
      .catch(err => setError(err.message));

    ensureOrgDetails(selectedOrg.owner).catch(err => setError(err.message));
  }, [selectedOrg]);

  useEffect(() => {
    if (!selectedRepo) return;
    fetchRepoRuns(selectedRepo).catch(err => setError(err.message));
  }, [selectedRepo]);

  const selectedRepoRuns = selectedRepo ? repoRunsByKey[selectedRepo.key] || [] : [];
  const selectedOrgRuns = useMemo(() => {
    if (!selectedOrg) return [];
    return selectedOrg.repos.flatMap(repo => repoRunsByKey[repo.key] || []);
  }, [selectedOrg, repoRunsByKey]);

  const orgStageMetrics = useMemo(() => {
    const stageMap = new Map();

    for (const run of selectedOrgRuns) {
      const stage = getRunStageName(run);
      if (!stageMap.has(stage)) {
        stageMap.set(stage, { stage, runs: [] });
      }
      stageMap.get(stage).runs.push(run);
    }

    return Array.from(stageMap.values())
      .map(entry => ({
        stage: entry.stage,
        count: entry.runs.length,
        successRate: getSuccessRate(entry.runs),
        avgDuration: average(entry.runs.map(run => run.durationInSeconds)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [selectedOrgRuns]);

  const orgMergeDurations = useMemo(() => {
    if (!selectedOrg) return [];

    return selectedOrg.repos
      .flatMap(repo => (repoRunsByKey[repo.key] || []))
      .map(run => {
        const detailKey = `${run.html_url}`;
        return detailByKey[detailKey];
      });
  }, [detailByKey, repoRunsByKey, selectedOrg]);

  const orgSummary = useMemo(() => {
    const availableMergeDurations = selectedOrg
      ? Object.entries(detailByKey)
          .filter(([detailKey]) => detailKey.startsWith(`${selectedOrg.owner.toLowerCase()}/`))
          .map(([, detail]) => getPrMergeWaitDuration(detail))
          .filter(value => Number.isFinite(value))
      : [];

    return {
      totalRuns: selectedOrgRuns.length,
      successRate: getSuccessRate(selectedOrgRuns),
      avgCiDuration: average(selectedOrgRuns.map(run => run.durationInSeconds)),
      avgMergeDuration: average(availableMergeDurations),
    };
  }, [detailByKey, selectedOrg, selectedOrgRuns, orgMergeDurations]);

  if (loading && !indexData) return <FullScreenMessage tone="stone">Loading index...</FullScreenMessage>;
  if (error) return <FullScreenMessage tone="error">Error: {error}</FullScreenMessage>;

  return (
    <AppShell
      buildOrgHref={org => buildBrowsePath({ owner: org.owner })}
      buildRepoHref={repo => buildBrowsePath({ owner: repo.owner, repo: repo.repo })}
      currentSection="browse"
      indexData={indexData}
      orgEntries={orgEntries}
      panelLoading={panelLoading}
      repoRunsByKey={repoRunsByKey}
      selectedOrgOwner={selectedOrg?.owner}
      selectedRepoKey={selectedRepo?.key}
    >
      {selectedRepo ? (
        <RepoView
          buildAnalysisHref={run => buildAnalysisPath({ owner: selectedRepo.owner, repo: selectedRepo.repo, runId: run.id })}
          repo={selectedRepo}
          runs={selectedRepoRuns}
        />
      ) : selectedOrg ? (
        <OrgView
          buildBrowseHref={repo => buildBrowsePath({ owner: repo.owner, repo: repo.repo })}
          org={selectedOrg}
          repoRunsByKey={repoRunsByKey}
          stageMetrics={orgStageMetrics}
          summary={orgSummary}
        />
      ) : (
        <EmptyState
          title="选择一个组织开始浏览"
          body="Browse 页现在是显式路由入口。先从左侧选择组织，再进入具体仓库。"
        />
      )}
    </AppShell>
  );
}

function FullScreenMessage({ children, tone }) {
  const textClass = tone === 'error' ? 'text-red-300' : 'text-stone-100';
  return <div className={`flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center ${textClass}`}>{children}</div>;
}
