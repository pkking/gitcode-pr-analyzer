import React from 'react';
import { Link } from 'react-router-dom';

export default function RepoTreeNav({
  orgEntries,
  expandedOrgs,
  onToggleOrg,
  buildOrgHref,
  buildRepoHref,
  selectedOrgOwner,
  selectedRepoKey,
  repoRunsByKey,
}) {
  return (
    <nav className="space-y-3">
      {orgEntries.map(org => {
        const isExpanded = expandedOrgs[org.owner] ?? selectedOrgOwner === org.owner;
        const isSelectedOrg = selectedOrgOwner === org.owner && !selectedRepoKey;

        return (
          <div key={org.owner} className="rounded-2xl border border-stone-200 bg-stone-50/80">
            <div className={`flex items-center justify-between rounded-2xl transition ${isSelectedOrg ? 'bg-stone-900 text-white' : ''}`}>
              <Link
                to={buildOrgHref(org)}
                className={`min-w-0 flex-1 rounded-l-2xl px-4 py-3 text-left ${isSelectedOrg ? '' : 'hover:bg-stone-100'}`}
              >
                <div className="text-sm font-semibold">{org.owner}</div>
                <div className={`text-xs ${isSelectedOrg ? 'text-stone-300' : 'text-stone-500'}`}>
                  {org.repos.length} repositories
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onToggleOrg(org.owner)}
                className={`rounded-r-2xl px-4 py-3 text-xs ${isSelectedOrg ? 'text-amber-300' : 'text-stone-500 hover:bg-stone-100'}`}
              >
                {isExpanded ? '收起' : '展开'}
              </button>
            </div>

            {isExpanded ? (
              <div className="space-y-1 px-2 pb-2">
                {org.repos.map(repo => {
                  const isActive = selectedRepoKey === repo.key;
                  const repoRuns = repoRunsByKey[repo.key] || [];

                  return (
                    <Link
                      key={repo.key}
                      to={buildRepoHref(repo)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        isActive ? 'bg-amber-100 text-amber-950' : 'text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span className="truncate">{repo.repo}</span>
                      <span className={`ml-3 shrink-0 text-[11px] ${isActive ? 'text-amber-700' : 'text-stone-400'}`}>
                        {repoRuns.length || repo.files.length}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
