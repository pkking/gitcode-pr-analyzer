import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRepoRunList,
  getPrDetailEntry,
  getRunPrNumber,
  getRunRepoParts,
  listOrgEntries,
  listOrgPrDetailEntries,
} from '../utils/etlData.js';

const DashboardDataContext = createContext(null);

function useDashboardDataState() {
  const [indexData, setIndexData] = useState(null);
  const [repoRunsByKey, setRepoRunsByKey] = useState({});
  const [loadedFiles, setLoadedFiles] = useState({});
  const [detailByKey, setDetailByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState(null);

  const repoRunsByKeyRef = useRef(repoRunsByKey);
  const loadedFilesRef = useRef(loadedFiles);
  const detailByKeyRef = useRef(detailByKey);

  useEffect(() => {
    repoRunsByKeyRef.current = repoRunsByKey;
  }, [repoRunsByKey]);

  useEffect(() => {
    loadedFilesRef.current = loadedFiles;
  }, [loadedFiles]);

  useEffect(() => {
    detailByKeyRef.current = detailByKey;
  }, [detailByKey]);

  useEffect(() => {
    fetch('/data/index.json')
      .then(res => {
        if (!res.ok) throw new Error('Data index not found. Run the collector first.');
        return res.json();
      })
      .then(data => {
        setIndexData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const orgEntries = useMemo(() => listOrgEntries(indexData), [indexData]);

  const fetchRepoRuns = useCallback(async function fetchRepoRuns(repoEntry) {
    if (!repoEntry) return [];

    const cachedRuns = repoRunsByKeyRef.current[repoEntry.key];
    if (cachedRuns) return cachedRuns;

    setPanelLoading(true);

    try {
      const dayFiles = await Promise.all(
        repoEntry.files.map(async filePath => {
          const cachedFile = loadedFilesRef.current[filePath];
          if (cachedFile) return cachedFile;

          const res = await fetch(`/data/${filePath}`);
          if (!res.ok) {
            throw new Error(`Failed to load ${filePath}`);
          }

          const data = await res.json();
          loadedFilesRef.current = { ...loadedFilesRef.current, [filePath]: data };
          setLoadedFiles(prev => ({ ...prev, [filePath]: data }));
          return data;
        })
      );

      const filteredRuns = buildRepoRunList(dayFiles, repoEntry.key);
      repoRunsByKeyRef.current = { ...repoRunsByKeyRef.current, [repoEntry.key]: filteredRuns };
      setRepoRunsByKey(prev => ({ ...prev, [repoEntry.key]: filteredRuns }));
      return filteredRuns;
    } finally {
      setPanelLoading(false);
    }
  }, []);

  const ensureOrgDetails = useCallback(async function ensureOrgDetails(owner) {
    if (!owner) return;

    const orgDetailEntries = listOrgPrDetailEntries(owner);
    if (orgDetailEntries.length === 0) return;

    await Promise.all(
      orgDetailEntries.map(async entry => {
        if (detailByKeyRef.current[entry.detailKey] !== undefined) return;

        const res = await fetch(entry.publicPath);
        if (!res.ok) {
          throw new Error(`Failed to load detail ${entry.publicPath}`);
        }

        const detail = await res.json();
        detailByKeyRef.current = { ...detailByKeyRef.current, [entry.detailKey]: detail };
        setDetailByKey(prev => ({ ...prev, [entry.detailKey]: detail }));
      })
    );
  }, []);

  const ensureRunDetail = useCallback(async function ensureRunDetail(run) {
    if (!run) return;

    const runRepo = getRunRepoParts(run);
    const prNumber = getRunPrNumber(run);
    if (!runRepo || !prNumber) return;

    const detailEntry = getPrDetailEntry(runRepo.owner, runRepo.repo, prNumber);
    if (!detailEntry || detailByKeyRef.current[detailEntry.detailKey] !== undefined) return;

    const res = await fetch(detailEntry.publicPath);
    if (!res.ok) {
      throw new Error(`Failed to load detail ${detailEntry.publicPath}`);
    }

    const detail = await res.json();
    detailByKeyRef.current = { ...detailByKeyRef.current, [detailEntry.detailKey]: detail };
    setDetailByKey(prev => ({ ...prev, [detailEntry.detailKey]: detail }));
  }, []);

  const getRunDetail = useCallback(function getRunDetail(run) {
    if (!run) return null;
    const runRepo = getRunRepoParts(run);
    const prNumber = getRunPrNumber(run);
    if (!runRepo || !prNumber) return null;

    const detailEntry = getPrDetailEntry(runRepo.owner, runRepo.repo, prNumber);
    if (!detailEntry) return null;

    return detailByKey[detailEntry.detailKey] ?? null;
  }, [detailByKey]);

  return {
    detailByKey,
    error,
    fetchRepoRuns,
    getRunDetail,
    indexData,
    loading,
    orgEntries,
    panelLoading,
    repoRunsByKey,
    ensureOrgDetails,
    ensureRunDetail,
    setError,
  };
}

export function DashboardDataProvider({ children }) {
  const value = useDashboardDataState();
  return createElement(DashboardDataContext.Provider, { value }, children);
}

export function useDashboardData() {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return value;
}
