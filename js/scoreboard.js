// Scoreboard on the wheel screen, plus the "give a point" buttons after the clock runs out.
import { state, update, subscribe, newPlayer, leaders, teamMode, uid } from './store.js';
import { teamColors } from './wheel.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const xIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const crown = `<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-5 4L12 5l-2.5 7-5-4z" fill="currentColor"/></svg>`;

/** onCrown: called when the host clicks "Crown the winner". */
export function mountScoreboard(el, { onCrown } = {}) {
  let editing = false;
  const addingTo = new Set(); // entries showing an "Add a player" line before they have any members

  /** In Edit: one line per team member, plus a line to add another. */
  function membersEditor(p) {
    if (!p.members.length && !addingTo.has(p.id)) {
      return `<button class="link-btn subtle add-members-link" type="button" data-act="start-members" data-id="${p.id}" aria-label="Add players to ${esc(p.name)}">+ Add players</button>`;
    }
    return `<ul class="member-list" aria-label="Players on ${esc(p.name)}">
        ${p.members
          .map(
            (m) => `<li class="member-row">
              <input class="member-input" data-team="${p.id}" data-member="${m.id}" value="${esc(m.name)}" aria-label="Name for ${esc(m.name)} on ${esc(p.name)}" maxlength="24">
              <button class="icon-btn small danger" type="button" data-act="remove-member" data-id="${p.id}" data-member="${m.id}" aria-label="Remove ${esc(m.name)} from ${esc(p.name)}" title="Remove">${xIcon}</button>
            </li>`,
          )
          .join('')}
        <li class="member-row">
          <form class="add-member" data-team="${p.id}" autocomplete="off">
            <input name="member" placeholder="Add a player to ${esc(p.name)}" maxlength="24" aria-label="Add a player to ${esc(p.name)}">
            <button class="btn btn-small btn-quiet" type="submit">Add</button>
          </form>
        </li>
      </ul>`;
  }

  function render() {
    const top = new Set(leaders().map((p) => p.id));
    const players = state.players;
    const teams = teamMode();
    // With teams, each team gets the color its players wear on the "Who's up?" chips.
    const colors = teamColors(players.map((p) => p.name));
    const rows = players
      .map((p, i) =>
        editing
          ? `<li class="player is-editing">
              <input class="player-name-input" data-id="${p.id}" value="${esc(p.name)}" aria-label="Name for ${esc(p.name)}" maxlength="24">
              <button class="icon-btn small danger" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}" title="Remove">${xIcon}</button>
              ${membersEditor(p)}
            </li>`
          : `<li class="player ${top.has(p.id) ? 'is-leader' : ''} ${teams ? 'has-team' : ''}" style="--team: ${colors[i]}">
              <span class="player-label">
                <span class="player-name">${top.has(p.id) ? crown : ''}${esc(p.name)}</span>
                ${p.members.length ? `<span class="player-members">${p.members.map((m) => esc(m.name)).join(' · ')}</span>` : ''}
              </span>
              <button class="score-btn" data-act="minus" data-id="${p.id}" aria-label="Take a point from ${esc(p.name)}">−</button>
              <span class="player-score" aria-label="${esc(p.name)} has ${p.score} points">${p.score}</span>
              <button class="score-btn plus" data-act="plus" data-id="${p.id}" aria-label="Give ${esc(p.name)} a point">+</button>
            </li>`,
      )
      .join('');

    const empty = !players.length;
    el.innerHTML = `
      <div class="panel-head">
        <h2 class="panel-title">Scoreboard</h2>
        ${empty ? '' : `<button class="link-btn" data-act="toggle-edit">${editing ? 'Done' : 'Edit'}</button>`}
      </div>
      ${empty ? '<p class="panel-empty">Add players or teams to keep score.</p>' : `<ol class="players">${rows}</ol>`}
      ${editing ? '<p class="score-tip">Playing in teams? Add each team’s players under its name. <b>Who’s up?</b> then picks one person from every team.</p>' : ''}
      ${
        editing || empty
          ? `<form class="add-player" autocomplete="off">
              <input name="name" placeholder="Player or team name" maxlength="24" aria-label="Player or team name">
              <button class="btn btn-small" type="submit">Add</button>
            </form>
            ${empty ? '' : '<button class="link-btn subtle" data-act="reset-scores">Set all scores to 0</button>'}`
          : top.size
            ? `<button class="btn btn-quiet crown-btn" type="button" data-act="crown">${crown}Crown the winner</button>`
            : ''
      }`;
  }

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'toggle-edit') {
      editing = !editing;
      addingTo.clear();
      render();
    } else if (act === 'plus' || act === 'minus') {
      update((s) => {
        const p = s.players.find((x) => x.id === id);
        if (p) p.score += act === 'plus' ? 1 : -1;
      });
    } else if (act === 'remove') {
      update((s) => {
        s.players = s.players.filter((x) => x.id !== id);
      });
      if (!state.players.length) editing = false;
      render();
    } else if (act === 'start-members') {
      addingTo.add(id);
      render();
      focusAddMember(id);
    } else if (act === 'remove-member') {
      addingTo.add(id); // keep the "Add a player" line even if that was the last one
      update((s) => {
        const p = s.players.find((x) => x.id === id);
        if (p) p.members = p.members.filter((m) => m.id !== btn.dataset.member);
      });
      render();
    } else if (act === 'reset-scores') {
      if (confirm('Set every score back to 0?'))
        update((s) => {
          s.players.forEach((p) => (p.score = 0));
          s.turns = {};
          s.lastUpIds = [];
        });
    } else if (act === 'crown') {
      onCrown?.();
    }
  });

  const focusAddMember = (teamId) => el.querySelector(`.add-member[data-team="${teamId}"] input`)?.focus();

  el.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.matches('.add-member')) {
      const teamId = e.target.dataset.team;
      const input = e.target.elements.member;
      const name = input.value.trim();
      if (!name) return input.focus();
      update((s) => {
        const p = s.players.find((x) => x.id === teamId);
        if (p) p.members.push({ id: uid(), name });
      });
      render();
      focusAddMember(teamId); // ready for the next player
      return;
    }
    const input = e.target.elements.name;
    const name = input.value.trim();
    if (!name) return input.focus();
    update((s) => s.players.push(newPlayer(name)));
    editing = true; // keep the box open so more players can be added
    render();
    el.querySelector('.add-player input')?.focus();
  });

  el.addEventListener('change', (e) => {
    const input = e.target.closest('.player-name-input, .member-input');
    const name = input?.value.trim();
    if (!name) return;
    update((s) => {
      if (input.matches('.member-input')) {
        const m = s.players.find((x) => x.id === input.dataset.team)?.members.find((x) => x.id === input.dataset.member);
        if (m) m.name = name;
      } else {
        const p = s.players.find((x) => x.id === input.dataset.id);
        if (p) p.name = name;
      }
    });
  });

  // Enter saves a renamed player or team.
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.player-name-input, .member-input')) {
      e.preventDefault();
      e.target.blur();
    }
  });

  subscribe(() => {
    // Don't wipe out a name someone is typing.
    const active = document.activeElement;
    if (el.contains(active) && active.matches('input') && active.value) return;
    render();
  });
  render();
}

/**
 * Buttons shown on the "Time's up" screen to hand out points.
 * picks: who was up ({ id, name, teamId }). Their player or team comes first, and a team shows who played for it.
 */
export function renderAwards(el, picks = []) {
  if (!state.players.length) {
    el.innerHTML = '<p class="award-empty">Add players on the scoreboard to keep score.</p>';
    return;
  }
  const upFor = (p) => picks.filter((x) => x.teamId === p.id);
  const players = [...state.players].sort((a, b) => (upFor(b).length > 0) - (upFor(a).length > 0));
  el.innerHTML = `
    <p class="award-label">${teamMode() ? 'Which team earned a point?' : 'Who earned a point?'}</p>
    <div class="award-buttons">
      ${players
        .map((p) => {
          const up = upFor(p);
          const playedFor = up.filter((x) => x.id !== p.id).map((x) => esc(x.name));
          return `<button class="award-btn ${up.length ? 'is-up' : ''}" data-id="${p.id}">
            <span class="award-name">${esc(p.name)}${playedFor.length ? `<small class="award-who">${playedFor.join(' & ')}</small>` : ''}</span>
            <span class="award-score">${p.score}</span>
          </button>`;
        })
        .join('')}
    </div>
    <p class="award-hint">Click again to give more than one point.</p>`;
}

export function handleAwardClick(e) {
  const btn = e.target.closest('.award-btn');
  if (!btn) return;
  let score = 0;
  update((s) => {
    const p = s.players.find((x) => x.id === btn.dataset.id);
    if (p) score = ++p.score;
  });
  btn.querySelector('.award-score').textContent = score;
  btn.classList.remove('is-bumped');
  void btn.offsetWidth;
  btn.classList.add('is-bumped');
}
