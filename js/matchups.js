// Who plays next, for "Who's up?". Picks a whole lineup at once (one person from each team,
// or a few players from everyone), aiming for:
//   1. Fresh matchups: people who haven't played in a game together yet, or have the fewest times.
//   2. Everyone playing a lot: among those, people who've played less go first.
//   3. A little rest: if it's still a tie, people who didn't just play. (Twice in a row is fine when needed.)

const MAX_LINEUPS = 6000; // with huge groups, check a random sample instead of every lineup

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const lineupKey = (ids) => [...ids].sort().join(',');

export function pairsOf(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push(pairKey(ids[i], ids[j]));
  return pairs;
}

function subsets(people, k) {
  const out = [];
  const walk = (start, acc) => {
    if (acc.length === k) return out.push([...acc]);
    for (let i = start; i < people.length; i++) {
      acc.push(people[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function howMany(n, k) {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

function shuffled(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Every possible lineup: for each group, every way to choose `count` of its people. */
function possibleLineups(groups, random) {
  const total = groups.reduce((n, g) => n * howMany(g.people.length, g.count), 1);
  if (total > MAX_LINEUPS) {
    return Array.from({ length: MAX_LINEUPS }, () => groups.map((g) => shuffled(g.people, random).slice(0, g.count)));
  }
  let lineups = [[]];
  for (const g of groups) {
    const options = subsets(g.people, g.count);
    lineups = lineups.flatMap((l) => options.map((o) => [...l, o]));
  }
  return lineups;
}

/**
 * groups: [{ people: [{ id }], count }]. One group per team, or one group of everyone.
 * history: { turns: { id: times played }, met: { pairKey: times in a game together }, lastUpIds: [] }.
 * avoid: lineup keys to skip if there's any other choice (what "Pick again" is replacing).
 * Returns { picks: one array of people per group, fresh: true if nobody in it has played together before }.
 */
export function chooseLineup(groups, history, avoid = [], random = Math.random) {
  const { turns = {}, met = {}, lastUpIds = [] } = history;
  const skip = new Set(avoid);
  const justPlayed = new Set(lastUpIds);
  let best = null;
  for (const lineup of possibleLineups(groups, random)) {
    const ids = lineup.flat().map((p) => p.id);
    const score = [
      skip.has(lineupKey(ids)) ? 1 : 0,
      pairsOf(ids).reduce((n, k) => n + (met[k] || 0), 0),
      ids.reduce((n, id) => n + (turns[id] || 0), 0),
      ids.filter((id) => justPlayed.has(id)).length,
      random(),
    ];
    if (!best || isLower(score, best.score)) best = { lineup, score, ids };
  }
  return { picks: best.lineup, fresh: best.ids.length > 1 && best.score[1] === 0 };
}

function isLower(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
