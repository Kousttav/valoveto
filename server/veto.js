// Veto engine: pure functions, all rules live on the server.
export const MODES = {
  bo1: 'Best of 1', bo2: 'Best of 2', bo3: 'Best of 3',
  s1: 'Single match', s2: 'Double match', s3: 'Triple match',
};
export const MIN_POOL = { bo1: 3, bo2: 5, bo3: 5, s1: 2, s2: 3, s3: 4 };

const other = (t) => (t === 'A' ? 'B' : 'A');

/** Build the ordered list of steps. `first` = team that acts first. */
export function gen(mode, poolSize, first) {
  const second = other(first);
  const steps = [];
  let c = 0;
  const turn = () => (c++ % 2 ? second : first);
  const ban = () => steps.push({ t: 'ban', team: turn() });
  const pick = () => {
    const t = turn();
    steps.push({ t: 'pick', team: t }, { t: 'side', team: other(t) });
  };
  const decider = () => steps.push({ t: 'side', team: turn(), dec: true });

  if (mode === 'bo1') { for (let i = 0; i < poolSize - 1; i++) ban(); decider(); }
  else if (mode === 'bo2') { ban(); ban(); pick(); pick(); }
  else if (mode === 'bo3') { ban(); ban(); pick(); pick(); for (let i = 0; i < poolSize - 5; i++) ban(); decider(); }
  else { for (let i = 0; i < Number(mode[1]); i++) pick(); }
  return steps;
}

/** Auto-fill the decider map and close the match when all steps are done. */
export function settle(m) {
  while (m.idx < m.steps.length && m.steps[m.idx].dec && !m.steps[m.idx].map) {
    const used = m.steps.filter((s) => s.map && (s.t !== 'side' || s.dec)).map((s) => s.map);
    m.steps[m.idx].map = m.pool.find((p) => !used.includes(p.id)).id;
  }
  if (m.idx >= m.steps.length) m.phase = 'done';
}

export const mapUsed = (m, id) => m.steps.some((s) => s.map === id && (s.t !== 'side' || s.dec));