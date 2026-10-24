// "Who's up?": a smaller wheel that picks which players take on the game.
// The wheel only shows whoever is due (see turns.js), so everyone plays the same number of times.
// With teams, it spins once for each team and picks from that team's members, so it's one person vs one person.
import { state, teamMode, rosterOf } from './store.js';
import { whoIsDue } from './turns.js';
import { Wheel, randomIndex, assignColors, teamColors, shadesOf } from './wheel.js';
import * as sound from './audio.js';
import { burst } from './confetti.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Whether there's anyone to pick between. */
export function canPick() {
  if (teamMode()) return state.players.length >= 2 || state.players.some((t) => t.members.length >= 2);
  return state.players.length >= 2;
}

/**
 * The most people one game can pick.
 * Players: up to 4, and at least one person sits out. Teams: up to 3 from each team, and no more than the smallest team has.
 */
export function maxPicks() {
  if (teamMode()) return Math.min(3, ...state.players.map((t) => rosterOf(t).length));
  return Math.min(4, state.players.length - 1);
}

/** How many players (or, with teams, how many from each team) the next pick will choose. */
export function picksWanted() {
  const want = teamMode() ? state.settings.playersPerTeam : state.settings.playersPerRound;
  return Math.max(1, Math.min(want, maxPicks()));
}

/**
 * What to spin for. Players: one wheel of everyone. Teams: one wheel per team, of that team's members.
 * Everyone keeps one color on every spin, so two picks never look alike.
 */
function groupsToPick() {
  const players = state.players;
  const count = picksWanted();
  if (!teamMode()) {
    const colors = assignColors(players.length);
    return [{ team: null, count, people: players.map((p, i) => ({ id: p.id, name: p.name, teamId: p.id, color: colors[i] })) }];
  }
  const colors = teamColors(players.map((t) => t.name));
  return players.map((t, i) => {
    const roster = rosterOf(t);
    const memberColors = shadesOf(colors[i], roster.length);
    return {
      team: { id: t.id, name: t.name, color: colors[i] },
      count: Math.min(count, roster.length),
      people: roster.map((m, j) => ({ id: m.id, name: m.name, teamId: t.id, color: memberColors[j] })),
    };
  });
}

/** "Sam vs Alex", or with two from each team "Sam & Jo vs Alex & Max". */
function matchup(picked, teams) {
  if (!teams) return picked.map((p) => p.name).join(' vs ');
  const byTeam = new Map();
  picked.forEach((p) => byTeam.set(p.teamId, [...(byTeam.get(p.teamId) || []), p.name]));
  return [...byTeam.values()].map((names) => names.join(' & ')).join(' vs ');
}

const nameList = (people) =>
  people.length <= 2 ? people.map((p) => p.name).join(' and ') : `${people.slice(0, -1).map((p) => p.name).join(', ')} and ${people.at(-1).name}`;

/**
 * root: the #picker overlay.
 * onDone(picks) runs when the host accepts. picks: [{ id, name, color, teamId, teamName }].
 * onClose() runs whenever the overlay closes without picks.
 */
export function createPicker(root, { reducedMotion, onDone, onClose }) {
  const q = (sel) => root.querySelector(sel);
  const wheel = new Wheel(q('canvas'), { pointer: q('.pointer'), onTick: () => sound.tick() });
  const title = q('.picker-title');
  const note = q('.picker-note');
  const chosen = q('.picker-chosen');
  const stamp = q('.picker-landed');
  const outside = [document.querySelector('main'), document.querySelector('.topbar')];
  let token = 0;
  let result = null;
  let avoid = [];

  async function run() {
    const my = ++token;
    result = null;
    root.classList.remove('is-done');
    title.textContent = 'Who’s up?';
    chosen.innerHTML = '';
    stamp.classList.remove('is-shown');
    q('[data-act=cancel]').focus({ preventScroll: true });

    const teams = teamMode();
    const groups = groupsToPick();
    const count = picksWanted();
    const recent = new Set(state.lastUpIds);
    const skip = new Set(avoid);
    const picked = [];
    const intro = teams
      ? count === 1
        ? 'One player from each team'
        : `${count} players from each team`
      : `Picking ${count} ${count === 1 ? 'player' : 'players'}`;
    note.textContent = intro;
    let first = true;

    for (const group of groups) {
      if (group.team) title.textContent = `Who’s up for ${group.team.name}?`;
      for (let k = 0; k < group.count; k++) {
        const candidates = group.people.filter((p) => !picked.some((x) => x.id === p.id));
        const { pool, sittingOut, startedOver } = whoIsDue(candidates, state.turns, recent, skip);
        if (startedOver) {
          const everyone = group.team ? `Everyone on ${group.team.name}` : 'Everyone';
          const rest = sittingOut.length ? ` ${nameList(sittingOut)} ${sittingOut.length === 1 ? 'sits' : 'sit'} this one out.` : '';
          note.textContent = `${everyone} has played, so they’re back on the wheel.${rest}`;
        } else if (group.team) note.textContent = intro;

        const person = pool[randomIndex(pool.length)];
        const chipColor = group.team ? group.team.color : person.color;
        const pick = { ...person, color: chipColor, teamName: group.team?.name ?? '' };
        const chip = `<li style="--slice: ${chipColor}">${esc(person.name)}${
          group.team && person.id !== group.team.id ? ` <small>${esc(group.team.name)}</small>` : ''
        }</li>`;

        // A one-person team just plays. No need to spin for it.
        if (group.people.length === 1) {
          picked.push(pick);
          chosen.insertAdjacentHTML('beforeend', chip);
          continue;
        }

        wheel.clearCelebration();
        wheel.setItems(pool.map((p) => ({ id: p.id, label: p.name, color: p.color })));
        await wait(first ? 350 : 450);
        first = false;
        if (my !== token) return;

        const index = pool.indexOf(person);
        if (pool.length > 1) {
          await wheel.spin(index, { duration: reducedMotion.matches ? 1200 : 3800 + Math.random() * 1000 });
          if (my !== token) return;
        }
        picked.push(pick);

        sound.fanfare();
        wheel.celebrate(index);
        stamp.textContent = person.name;
        stamp.style.setProperty('--slice', wheel.colorAt(index));
        stamp.classList.add('is-shown');
        chosen.insertAdjacentHTML('beforeend', chip);
        await wait(reducedMotion.matches ? 600 : 1500);
        if (my !== token) return;
        stamp.classList.remove('is-shown');
      }
    }

    result = picked;
    title.textContent = matchup(picked, teams);
    note.textContent = 'You’re up!';
    root.classList.add('is-done');
    burst();
    q('[data-act=done]').focus({ preventScroll: true });
  }

  function hide() {
    token++;
    wheel.stop();
    root.hidden = true;
    outside.forEach((el) => (el.inert = false));
  }

  function close() {
    hide();
    onClose?.();
  }

  function accept() {
    const picks = result;
    hide();
    if (picks) onDone(picks);
    else onClose?.();
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'done') accept();
    else if (act === 'again') {
      // Steer away from whoever was just shown, if anyone else is as due.
      if (result) avoid = [...avoid, ...result.map((p) => p.id)];
      run();
    }
    else if (act === 'cancel') close();
  });

  return {
    get isOpen() {
      return !root.hidden;
    },
    /** avoid: ids to rest if possible, e.g. the people being replaced by "Pick again". */
    open(avoidIds = []) {
      if (!canPick()) return;
      avoid = avoidIds;
      sound.unlock();
      outside.forEach((el) => (el.inert = true));
      root.hidden = false;
      run();
    },
    /** Esc: keep the picks if they're finished, otherwise cancel. */
    escape() {
      if (result) accept();
      else close();
    },
  };
}
