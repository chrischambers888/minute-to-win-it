// "You'll need": each game's supplies.
// The editor lines in Manage games, the list on the game screen, and the shopping list (with its print view).
import { state, update, teamMode } from './store.js';
import { canPick, picksWanted } from './picker.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const xIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const MAX = 60; // characters per item

// ---------- Game screen ----------

/** The "You'll need" list under the instructions. Hidden when the game has no supplies. */
export function renderNeeds(el, game) {
  const items = game.supplies || [];
  el.hidden = !items.length;
  el.innerHTML = items.length
    ? `<h3 class="needs-label">Each player needs</h3>
       <ul class="needs-list">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
    : '';
}

// ---------- Manage games: the game form ----------

/** One line per item, each with its own ×, then an "Add an item" line. */
export function suppliesFieldHtml(game) {
  return `<div class="field">
    <span class="label" id="f-supplies-label">You’ll need <span class="optional">(optional)</span></span>
    <ul class="supply-list" data-supplies aria-labelledby="f-supplies-label">${rowsHtml(game.supplies)}</ul>
    <p class="field-help">What one player needs, one item per line, like “3 balloons”. Press Enter to add the next one. The shopping list multiplies these by the number of players.</p>
  </div>`;
}

function rowsHtml(items) {
  return `${items
    .map(
      (s, i) => `<li class="supply-row">
        <input class="supply-input" value="${esc(s)}" maxlength="${MAX}" aria-label="Item ${i + 1}">
        <button class="icon-btn small danger" type="button" data-supply-remove aria-label="Remove ${esc(s)}" title="Remove">${xIcon}</button>
      </li>`,
    )
    .join('')}
    <li class="supply-row supply-add">
      <input class="supply-new" placeholder="Add an item" maxlength="${MAX}" aria-label="Add an item">
      <button class="btn btn-small btn-quiet" type="button" data-supply-add>Add</button>
    </li>`;
}

/** getId: the game being edited. saved: shows "Saved". */
export function mountSuppliesEditor(form, { getId, saved }) {
  let pending = null; // a typed change waiting to save: { id, list }

  const listOf = (el) => el.closest('[data-supplies]');
  const valuesIn = (list) => [...list.querySelectorAll('.supply-input')].map((i) => i.value.trim()).filter(Boolean);

  function save(id, items) {
    update((s) => {
      const g = s.games.find((x) => x.id === id);
      if (g) g.supplies = items;
    });
    saved();
  }

  // Save a typed change now (it's read from the lines, so it works even after switching games).
  function flush() {
    clearTimeout(flush.t);
    if (pending) save(pending.id, valuesIn(pending.list));
    pending = null;
  }

  function redraw(list, focus) {
    const g = state.games.find((x) => x.id === getId());
    if (!g || !list.isConnected) return;
    list.innerHTML = rowsHtml(g.supplies);
    focus?.(list);
  }

  function add(list, lines) {
    const items = lines.map((t) => t.trim().slice(0, MAX)).filter(Boolean);
    if (!items.length) return false;
    flush();
    save(getId(), [...valuesIn(list), ...items]);
    redraw(list, (l) => l.querySelector('.supply-new').focus()); // ready for the next one
    return true;
  }

  form.addEventListener('input', (e) => {
    if (!e.target.matches('.supply-input')) return;
    pending = { id: getId(), list: listOf(e.target) };
    clearTimeout(flush.t);
    flush.t = setTimeout(flush, 300);
  });
  form.addEventListener('change', (e) => {
    if (e.target.matches('.supply-input')) flush();
  });

  form.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-supply-remove]');
    const addBtn = e.target.closest('[data-supply-add]');
    if (remove) {
      const list = listOf(remove);
      const row = remove.closest('.supply-row');
      const i = [...list.querySelectorAll('[data-supply-remove]')].indexOf(remove);
      flush();
      row.remove();
      save(getId(), valuesIn(list));
      redraw(list, (l) => {
        const btns = l.querySelectorAll('[data-supply-remove]');
        (btns[Math.min(i, btns.length - 1)] || l.querySelector('.supply-new')).focus();
      });
    } else if (addBtn) {
      const input = listOf(addBtn).querySelector('.supply-new');
      if (!add(listOf(addBtn), [input.value])) input.focus();
    }
  });

  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.target.matches('.supply-new')) {
      e.preventDefault();
      add(listOf(e.target), [e.target.value]);
    } else if (e.target.matches('.supply-input')) {
      e.preventDefault(); // Enter moves to the next line
      const inputs = [...listOf(e.target).querySelectorAll('input')];
      inputs[inputs.indexOf(e.target) + 1]?.focus();
    }
  });

  // Pasting several lines into "Add an item" adds each one.
  form.addEventListener('paste', (e) => {
    if (!e.target.matches('.supply-new')) return;
    const lines = (e.clipboardData?.getData('text') || '').split(/\r?\n/).filter((t) => t.trim());
    if (lines.length < 2) return;
    e.preventDefault();
    add(listOf(e.target), [e.target.value, ...lines.map((t) => t.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, ''))]);
  });
}

// ---------- Manage games: the shopping list ----------

const MAX_PLAYERS = 30;

/** How many people play each game: the number set on the shopping list, or else the "Who's up?" number. */
function playersPerGame() {
  if (state.settings.shopPlayers) return state.settings.shopPlayers;
  if (!canPick()) return state.settings.playersPerRound;
  return teamMode() ? state.players.length * picksWanted() : picksWanted();
}

/** "3 balloons" is for one player, so 2 players need 6 balloons. An item without a number counts as 1. */
function forPlayers(item, players) {
  const m = item.match(/^(\d+)\s+(.+)$/);
  if (!m) return { qty: players, name: item };
  const qty = Number(m[1]) * players;
  return { qty, name: m[1] === '1' && qty > 1 ? pluralize(m[2]) : m[2] };
}

/** "straw" → "straws", "piece of spaghetti" → "pieces of spaghetti". Leaves anything it can't read alone. */
function pluralize(name) {
  const [, before, word, after] = name.match(/^(.*?)([a-z]+)( of .*)$/i) || name.match(/^(.*?)([a-z]+)()$/i) || [];
  if (!word) return name;
  const many = /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : /[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;
  return before + many + after;
}

function groupsHtml(games, players, editable) {
  const itemHtml = (s) => {
    const { qty, name } = forPlayers(s, players);
    return `<li><b class="shop-qty">${qty}</b><span>${esc(name)}</span></li>`;
  };
  return games
    .map(
      (g) => `<section class="shop-group">
        <div class="shop-group-head">
          <h4 class="shop-game">${esc(g.name)}</h4>
          ${editable ? `<button class="link-btn subtle" type="button" data-edit="${g.id}" aria-label="Edit ${esc(g.name)}">Edit</button>` : ''}
        </div>
        <ul class="shop-items">${g.supplies.map(itemHtml).join('')}</ul>
      </section>`,
    )
    .join('');
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Supplies for every game on the wheel (turned on), grouped by game, with a Print button.
 * el: where the list goes. onEdit(id): open that game in the Games tab.
 */
export function mountShoppingList(el, { onEdit }) {
  // Printing shows only this sheet (see the print styles in css/supplies.css).
  const sheet = document.createElement('div');
  sheet.className = 'print-sheet';
  document.body.append(sheet);

  function lists() {
    const games = state.games.filter((g) => g.enabled);
    return { games, needs: games.filter((g) => g.supplies.length), none: games.filter((g) => !g.supplies.length) };
  }

  function render() {
    const { games, needs, none } = lists();
    const players = playersPerGame();
    const lead = games.length ? `Everything for the ${plural(games.length, 'game')} on the wheel.` : 'There are no games on the wheel.';
    el.innerHTML = `
      <div class="shop-head">
        <div>
          <h3 class="shop-title">Shopping list</h3>
          <p class="shop-lead">${lead}</p>
        </div>
        <button class="btn btn-small" type="button" data-print ${needs.length ? '' : 'disabled'}>Print</button>
      </div>
      <div class="shop-count">
        <span class="shop-count-label" id="shop-count-label">Players per game</span>
        <div class="shop-stepper" role="group" aria-labelledby="shop-count-label">
          <button class="score-btn" type="button" data-shop-step="-1" aria-label="Fewer players" ${players <= 1 ? 'disabled' : ''}>−</button>
          <output class="shop-count-num" aria-live="polite">${players}</output>
          <button class="score-btn plus" type="button" data-shop-step="1" aria-label="More players" ${players >= MAX_PLAYERS ? 'disabled' : ''}>+</button>
        </div>
        <p class="shop-count-help">How many people play each game at the same time. Every amount below is for all of them.${
          state.settings.shopPlayers ? '' : ' It starts at your <b>Who’s up?</b> number.'
        }</p>
      </div>
      ${
        needs.length
          ? `<div class="shop-groups">${groupsHtml(needs, players, true)}</div>`
          : games.length
            ? '<p class="shop-empty">None of the games on the wheel have supplies yet. Add them under <b>You’ll need</b> when you edit a game.</p>'
            : ''
      }
      ${
        needs.length && none.length
          ? `<p class="shop-none">Nothing listed for ${none
              .map((g) => `<button class="link-btn subtle" type="button" data-edit="${g.id}">${esc(g.name)}</button>`)
              .join(', ')}.</p>`
          : ''
      }`;
  }

  function prepare() {
    const { games, needs } = lists();
    const players = playersPerGame();
    const date = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    sheet.innerHTML = `
      <h3 class="print-title">Shopping list</h3>
      <p class="print-sub">Minute to Win It · ${plural(games.length, 'game')} · ${plural(players, 'player')} per game · ${esc(date)}</p>
      <div class="print-groups">${groupsHtml(needs, players, false)}</div>`;
    document.documentElement.classList.add('is-printing-list');
  }

  const shown = () => !!el.closest('dialog')?.open && !el.closest('[hidden]');

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-print]')) {
      prepare();
      window.print();
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) onEdit?.(edit.dataset.edit);
    const step = e.target.closest('[data-shop-step]');
    if (step) {
      const n = Math.min(MAX_PLAYERS, Math.max(1, playersPerGame() + Number(step.dataset.shopStep)));
      update((s) => (s.settings.shopPlayers = n));
      render();
      const [less, more] = el.querySelectorAll('[data-shop-step]');
      const same = step.dataset.shopStep === '-1' ? less : more;
      (same.disabled ? (same === less ? more : less) : same).focus(); // keep focus on the stepper
    }
  });

  // Cmd/Ctrl+P on the shopping list prints the list too.
  window.addEventListener('beforeprint', () => shown() && prepare());
  window.addEventListener('afterprint', () => document.documentElement.classList.remove('is-printing-list'));

  return { render };
}
