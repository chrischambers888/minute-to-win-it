// Fair turns for "Who's up?".
// Whoever has played the fewest times goes next. Whoever just played sits out as long as
// someone else is just as due. "Pick again" skips the people it's replacing whenever it can.

/**
 * candidates: people who could be picked ({ id, name }).
 * turns: { [id]: times played }.
 * recent: Set of ids who played last game (rested if someone else is as due).
 * skip: Set of ids to leave out if anyone else can play (the people "Pick again" is replacing).
 * Returns who goes on the wheel, who sits out this time, and whether everyone had played
 * (so the wheel just started over).
 */
export function whoIsDue(candidates, turns, recent, skip = new Set()) {
  const allowed = candidates.filter((p) => !skip.has(p.id));
  const choices = allowed.length ? allowed : candidates;
  const played = (p) => turns[p.id] || 0;
  const fewest = Math.min(...choices.map(played));
  const due = choices.filter((p) => played(p) === fewest);
  const rested = due.filter((p) => !recent.has(p.id));
  const pool = rested.length ? rested : due;
  return {
    pool,
    sittingOut: due.filter((p) => !pool.includes(p)),
    startedOver: !skip.size && fewest > 0 && due.length === candidates.length,
  };
}
