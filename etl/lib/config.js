function normalizeRepoList(repos) {
  if (!Array.isArray(repos)) return [];

  return repos
    .map(repo => String(repo || '').trim())
    .filter(Boolean);
}

function normalizeRuleList(rules) {
  return Array.isArray(rules) ? rules : [];
}

function normalizeRepoOverrides(repoOverrides) {
  if (!repoOverrides || typeof repoOverrides !== 'object' || Array.isArray(repoOverrides)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(repoOverrides)
      .map(([repo, override]) => {
        const normalizedRepo = String(repo || '').trim();
        const rawOverride = override && typeof override === 'object' ? override : {};
        const mode = rawOverride.mode === 'replace' ? 'replace' : 'append';

        if (!normalizedRepo) return null;

        return [normalizedRepo, {
          mode,
          rules: normalizeRuleList(rawOverride.rules),
        }];
      })
      .filter(Boolean)
  );
}

export function normalizeConfig(rawConfig = {}, fallbackRepos = []) {
  const topLevelRepos = normalizeRepoList(rawConfig.repos);
  const repos = topLevelRepos.length > 0 ? topLevelRepos : normalizeRepoList(fallbackRepos);
  const orgs = Array.isArray(rawConfig.orgs) ? rawConfig.orgs : [];

  return {
    repos,
    orgs: orgs.map(org => ({
      name: String(org?.name || '').trim(),
      rules: normalizeRuleList(org?.rules),
      repos: normalizeRepoList(org?.repos),
      exclude: normalizeRepoList(org?.exclude),
      repo_overrides: normalizeRepoOverrides(org?.repo_overrides),
    })),
  };
}

function buildRules(orgRules, repoOverride) {
  if (!repoOverride) return orgRules;
  return repoOverride.mode === 'replace'
    ? repoOverride.rules
    : [...orgRules, ...repoOverride.rules];
}

function sourcePriority(source) {
  if (source === 'top-level') return 3;
  if (source === 'org-explicit') return 2;
  return 1;
}

function upsertTarget(targets, nextTarget) {
  const existing = targets.get(nextTarget.repo);
  if (!existing || sourcePriority(nextTarget.source) > sourcePriority(existing.source)) {
    targets.set(nextTarget.repo, nextTarget);
  }
}

export async function resolveRepoTargets(config, discoverOrgRepos) {
  const targets = new Map();

  for (const repo of config.repos) {
    upsertTarget(targets, { repo, rules: [], source: 'top-level' });
  }

  for (const org of config.orgs) {
    if (!org.name) continue;

    const explicitRepos = org.repos.length > 0;
    const discoveredRepos = explicitRepos ? org.repos : await discoverOrgRepos(org.name);
    const filteredRepos = discoveredRepos.filter(repo => !org.exclude.includes(repo));
    const source = explicitRepos ? 'org-explicit' : 'org-discovery';

    for (const repo of filteredRepos) {
      const override = org.repo_overrides[repo];
      upsertTarget(targets, {
        repo,
        rules: buildRules(org.rules, override),
        source,
      });
    }
  }

  return Array.from(targets.values());
}
