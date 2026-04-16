import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RunDetailView, EmptyState } from '../components/DashboardViews.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import AppShell from '../layouts/AppShell.jsx';
import {
  buildAnalysisPath,
  getAnalysisDisplayRun,
  getSelectedOrgEntry,
  getSelectedRepoEntry,
  getSelectedRun,
  hasMissingRequestedRun,
} from '../utils/routeState.js';
import { buildRunTimeline } from '../utils/runTimeline.js';

export default function AnalysisPage() {
  const params = useParams();
  const {
    error,
    fetchRepoRuns,
    getRunDetail,
    indexData,
    loading,
    orgEntries,
    panelLoading,
    repoRunsByKey,
    ensureRunDetail,
    setError,
  } = useDashboardData();

  const selectedOrg = getSelectedOrgEntry(orgEntries, params);
  const selectedRepo = getSelectedRepoEntry(orgEntries, params);
  const selectedRun = getSelectedRun({ repoEntry: selectedRepo, repoRunsByKey, params });
  const recentRuns = selectedRepo ? (repoRunsByKey[selectedRepo.key] || []).slice(0, 8) : [];
  const displayRun = getAnalysisDisplayRun({ selectedRun, recentRuns });
  const missingRequestedRun = hasMissingRequestedRun({ requestedRunId: params.runId, selectedRun, recentRuns });
  const runDetail = getRunDetail(displayRun);
  const runTimeline = buildRunTimeline(displayRun, runDetail);

  useEffect(() => {
    if (!selectedRepo) return;
    fetchRepoRuns(selectedRepo).catch(err => setError(err.message));
  }, [fetchRepoRuns, selectedRepo, setError]);

  useEffect(() => {
    if (!displayRun) return;
    ensureRunDetail(displayRun).catch(err => setError(err.message));
  }, [displayRun, ensureRunDetail, setError]);

  if (loading && !indexData) return <FullScreenMessage tone="stone">Loading index...</FullScreenMessage>;
  if (error) return <FullScreenMessage tone="error">Error: {error}</FullScreenMessage>;

  return (
    <AppShell
      buildOrgHref={() => '/analysis'}
      buildRepoHref={repo => buildAnalysisPath({ owner: repo.owner, repo: repo.repo })}
      currentSection="analysis"
      indexData={indexData}
      orgEntries={orgEntries}
      panelLoading={panelLoading}
      repoRunsByKey={repoRunsByKey}
      selectedOrgOwner={selectedOrg?.owner}
      selectedRepoKey={selectedRepo?.key}
    >
      {!selectedRepo ? (
        <EmptyState
          title="选择一个仓库进入独立分析页"
          body="Analysis 页支持直接打开指定 run，也支持在同页切换该仓库最近运行。"
        />
      ) : !displayRun ? (
        <EmptyState
          title="当前仓库没有可分析的运行记录"
          body="尝试从左侧切换其他仓库，或等待新的静态数据生成。"
        />
      ) : (
        <RunDetailView
          buildAnalysisHref={run => buildAnalysisPath({ owner: selectedRepo.owner, repo: selectedRepo.repo, runId: run.id })}
          missingRequestedRun={missingRequestedRun}
          recentRuns={recentRuns}
          run={displayRun}
          timeline={runTimeline}
        />
      )}
    </AppShell>
  );
}

function FullScreenMessage({ children, tone }) {
  const textClass = tone === 'error' ? 'text-red-300' : 'text-stone-100';
  return <div className={`flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center ${textClass}`}>{children}</div>;
}
