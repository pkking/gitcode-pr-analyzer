import React, { useState, useEffect } from 'react';

function App() {
  const [indexData, setIndexData] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedPR, setSelectedPR] = useState(null);
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
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSelectPR = (filePath) => {
    setLoading(true);
    fetch(`/${filePath}`)
      .then(res => res.json())
      .then(data => {
        setSelectedPR(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

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
              {indexData?.repositories.map(repo => (
                <button
                  key={`${repo.owner}/${repo.repo}`}
                  onClick={() => { setSelectedRepo(repo); setSelectedPR(null); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedRepo?.repo === repo.repo ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {repo.repo}
                  <span className="ml-2 text-xs text-gray-400">({repo.pull_requests.length})</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="md:col-span-3 space-y-8">
            {selectedPR ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <button 
                  onClick={() => setSelectedPR(null)}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  ← Back to PR List
                </button>
                
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-xl font-bold">#{selectedPR.prDetails.number}: {selectedPR.prDetails.title}</h2>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-blue-50 rounded">
                      <div className="text-blue-600 font-medium">Submission to Merge</div>
                      <div className="text-xl font-bold">{selectedPR.prSubmitToMerge?.durationText || 'N/A'}</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded">
                      <div className="text-green-600 font-medium">CI Removal to Merge</div>
                      <div className="text-xl font-bold">{selectedPR.lastCiRemovalToMerge?.durationText || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-4 py-5 bg-gray-50 border-b">
                    <h3 className="font-medium">Compile → CI Removal Cycles</h3>
                  </div>
                  <div className="p-6">
                    {selectedPR.compileToCiCycles.length === 0 ? (
                      <p className="text-gray-500 text-sm">No matching cycles found.</p>
                    ) : (
                      <ul className="divide-y">
                        {selectedPR.compileToCiCycles.map((cycle, i) => (
                          <li key={i} className="py-4 flex justify-between">
                            <div className="text-sm text-gray-600">Cycle {i + 1}</div>
                            <div className="font-mono text-sm font-bold text-blue-700">{cycle.durationText}</div>
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
                  {selectedRepo.pull_requests.map(pr => (
                    <li key={pr.number} className="hover:bg-gray-50">
                      <button 
                        onClick={() => handleSelectPR(pr.file_path)}
                        className="w-full text-left px-6 py-4 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <span className="font-mono font-bold text-gray-400 mr-3">#{pr.number}</span>
                          <span className="text-gray-900">{pr.title}</span>
                        </div>
                        <div className="text-blue-600 text-xs font-medium uppercase tracking-wider">View Report →</div>
                      </button>
                    </li>
                  ))}
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
