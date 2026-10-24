// Scoreboard on the wheel screen, plus the "give a point" buttons after the clock runs out.
import { state, update, subscribe, newPlayer } from './store.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const crown = `<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-5 4L12 5l-2.5 7-5-4z" fill="currentColor"/></svg>`;

function leaderIds() {
  const top = Math.max(0, ...state.players.map((p) => p.score));
  if (top <= 0) return new Set();
  return new Set(state.players.filter((p) => p.score === top).map((p) => p.id));
}

export function mountScoreboard(el) {
  let editing = false;

  function render() {
    const leaders = leaderIds();
    const players = state.players;
    const rows = players
      .map((p) =>
        editing
          ? `<li class="player is-editing">
              <input class="player-name-input" data-id="${p.id}" value="${esc(p.name)}" aria-label="Name for ${esc(p.name)}" maxlength="24">
              <button class="icon-btn small danger" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}" title="Remove">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
              </button>
            </li>`
          : `<li class="player ${leaders.has(p.id) ? 'is-leader' : ''}">
              <span class="player-name">${leaders.has(p.id) ? crown : ''}${esc(p.name)}</span>
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
      ${
        editing || empty
          ? `<form class="add-player" autocomplete="off">
              <input name="name" placeholder="Player or team name" maxlength="24" aria-label="Player or team name">
              <button class="btn btn-small" type="submit">Add</button>
            </form>
            ${empty ? '' : '<button class="link-btn subtle" data-act="reset-scores">Set all scores to 0</button>'}`
          : ''
      }`;
  }

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'toggle-edit') {
      editing = !editing;
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
    } else if (act === 'reset-scores') {
      if (confirm('Set every score back to 0?')) update((s) => s.players.forEach((p) => (p.score = 0)));
    }
  });

  el.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.elements.name;
    const name = input.value.trim();
    if (!name) return input.focus();
    update((s) => s.players.push(newPlayer(name)));
    editing = true; // keep the box open so more players can be added
    render();
    el.querySelector('.add-player input')?.focus();
  });

  el.addEventListener('change', (e) => {
    const input = e.target.closest('.player-name-input');
    if (!input) return;
    const name = input.value.trim();
    update((s) => {
      const p = s.players.find((x) => x.id === input.dataset.id);
      if (p && name) p.name = name;
    });
  });

  subscribe(() => {
    // Don't wipe out a name someone is typing.
    const active = document.activeElement;
    if (el.contains(active) && active.matches('input') && active.value) return;
    render();
  });
  render();
}

/** Buttons shown on the "Time's up" screen to hand out points. */
export function renderAwards(el) {
  if (!state.players.length) {
    el.innerHTML = '<p class="award-empty">Add players on the scoreboard to keep score.</p>';
    return;
  }
  el.innerHTML = `
    <p class="award-label">Who earned a point?</p>
    <div class="award-buttons">
      ${state.players
        .map(
          (p) => `<button class="award-btn" data-id="${p.id}">
            <span class="award-name">${esc(p.name)}</span>
            <span class="award-score">${p.score}</span>
          </button>`,
        )
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
