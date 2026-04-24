export function buildRunTimeline(run, detail) {
  if (!run || !detail) return [];

  const primaryJob = Array.isArray(run.jobs) && run.jobs.length > 0 ? run.jobs[0] : null;
  const fallbackPhaseOne = primaryJob?.queueDurationInSeconds || 0;
  const fallbackPhaseTwo = primaryJob?.durationInSeconds || Math.max(0, (run.durationInSeconds || 0) - fallbackPhaseOne);

  const matchedCycle = matchCycleToRun(run, detail.compileToCiCycles || []);
  const phaseOne = matchedCycle
    ? Math.max(0, (new Date(matchedCycle.compileTime).getTime() - new Date(run.created_at).getTime()) / 1000)
    : fallbackPhaseOne;
  const phaseTwo = matchedCycle?.durationSeconds ?? fallbackPhaseTwo;

  return [
    {
      key: 'comment_to_label',
      eyebrow: 'Phase 1',
      label: 'CI启动时间',
      seconds: phaseOne,
      description: '',
      barClass: 'bg-amber-400',
    },
    {
      key: 'label_to_remove',
      eyebrow: 'Phase 2',
      label: 'CI运行时间',
      seconds: phaseTwo,
      description: '',
      barClass: 'bg-emerald-400',
    },
  ];
}

export function matchCycleToRun(run, cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;

  const primaryJob = Array.isArray(run.jobs) && run.jobs.length > 0 ? run.jobs[0] : null;
  const startedAt = primaryJob?.started_at ? new Date(primaryJob.started_at).getTime() : new Date(run.created_at).getTime();

  return cycles.reduce((best, cycle) => {
    const diff = Math.abs(new Date(cycle.compileTime).getTime() - startedAt);
    if (!best || diff < best.diff) {
      return { diff, cycle };
    }
    return best;
  }, null)?.cycle || null;
}
