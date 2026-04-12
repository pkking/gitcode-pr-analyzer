import React, { useState, useEffect } from 'react';
import { buildRunList, listRepoEntries, summarizeRun, formatSeconds } from './utils/etlData.js';

function App() {
  const [indexData, setIndexData] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [repoRuns, setRepoRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/index.json')
      .then(res => {
        if (!res.ok) throw new Error('Data index not found. Run the collector first.');
        return res.json();
      })
      .then(data => {
        setIndexData(data);
        const repos = listRepoEntries(data);
        if (repos.length > 0) {
          setSelectedRepo(repos[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;

    setLoading(true);
    setSelectedRun(null);

    Promise.all(
      selectedRepo.files.map(filePath =>
        fetch(`/data/${filePath}`).then(res => {
          if (!res.ok) throw new Error(`Failed to load ${filePath}`);
          return res.json();
        })
      )
    )
      .then(data => {
        setRepoRuns(buildRunList(data));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedRepo]);

  const repoEntries = listRepoEntries(indexData);

  if (loading && !indexData) return <div className="p-8 text-center">Loading index...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 border-b pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">GitCode PR Analytics</h1>
            <p className="text-gray-500 text-sm">Automated Performance Tracking</p>
          </div>
          {indexData && (
            <div className="text-right text-xs text-gray-400">
              Last Updated: {new Date(indexData.last_updated).toLocaleString()}
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar: Repository List */}
          <aside className="md:col-span-1 space-y-4">
            <h2 className="font-semibold text-gray-700 uppercase tracking-wider text-xs">Repositories</h2>
            <nav className="space-y-1">
              {repoEntries.map(repo => (
                <button
                  key={repo.key}
                  onClick={() => { setSelectedRepo(repo); setSelectedRun(null); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedRepo?.repo === repo.repo ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {repo.repo}
                  <span className="ml-2 text-xs text-gray-400">({repo.files.length} days)</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="md:col-span-3 space-y-8">
            {selectedRun ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <button 
                  onClick={() => setSelectedRun(null)}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  ← Back to Run List
                </button>
                
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-xl font-bold">{selectedRun.name}</h2>
                  <div className="mt-2 text-sm text-gray-500">
                    Created: {new Date(selectedRun.created_at).toLocaleString()}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-blue-50 rounded">
                      <div className="text-blue-600 font-medium">Total Duration</div>
                      <div className="text-xl font-bold">{formatSeconds(selectedRun.durationInSeconds || 0)}</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded">
                      <div className="text-green-600 font-medium">Conclusion</div>
                      <div className="text-xl font-bold">{selectedRun.conclusion || 'unknown'}</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded">
                      <div className="text-amber-600 font-medium">Jobs</div>
                      <div className="text-xl font-bold">{selectedRun.jobs?.length || 0}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <a className="text-blue-600 hover:underline text-sm" href={selectedRun.html_url} target="_blank" rel="noreferrer">
                      Open merge request
                    </a>
                  </div>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-4 py-5 bg-gray-50 border-b">
                    <h3 className="font-medium">Jobs</h3>
                  </div>
                  <div className="p-6">
                    {selectedRun.jobs?.length === 0 ? (
                      <p className="text-gray-500 text-sm">No jobs found.</p>
                    ) : (
                      <ul className="divide-y">
                        {selectedRun.jobs.map((job, i) => (
                          <li key={i} className="py-4 flex justify-between">
                            <div>
                              <div className="text-sm text-gray-800">{job.name}</div>
                              <div className="text-xs text-gray-500">
                                Queue: {formatSeconds(job.queueDurationInSeconds || 0)} · Run: {formatSeconds(job.durationInSeconds || 0)}
                              </div>
                            </div>
                            <div className="font-mono text-sm font-bold text-blue-700">{job.conclusion}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedRepo ? (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 bg-gray-50 border-b">
                  <h2 className="font-bold">{selectedRepo.owner} / {selectedRepo.repo}</h2>
                </div>
                <ul className="divide-y">
                  {repoRuns.map(run => {
                    const summary = summarizeRun(run);
                    return (
                    <li key={run.id} className="hover:bg-gray-50">
                      <button 
                        onClick={() => setSelectedRun(run)}
                        className="w-full text-left px-6 py-4 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <span className="text-gray-900">{summary.title}</span>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(summary.createdAt).toLocaleString()} · {summary.durationText} · {summary.conclusion}
                          </div>
                        </div>
                        <div className="text-blue-600 text-xs font-medium uppercase tracking-wider">View Report →</div>
                      </button>
                    </li>
                  )})}
                </ul>
              </div>
            ) : (
              <div className="h-64 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                Select a repository to see analyzed PRs
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
