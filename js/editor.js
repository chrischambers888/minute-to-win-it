// "Manage games" window: edit games, the shopping list, timer settings, and backups.
import {
  state,
  update,
  newGame,
  defaultGames,
  defaultSettings,
  exportData,
  importData,
} from './store.js';
import { parseYouTube, thumbnailUrl } from './youtube.js';
import { isScreenGame, applyType, tvIcon } from './screen-games-data.js';
import { typeFieldHtml, settingsHtml, mountScreenSettings } from './screen-games-settings.js';
import { suppliesFieldHtml, mountSuppliesEditor, mountShoppingList } from './supplies.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const icons = {
  video: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 10l5-3v10l-5-3z" fill="currentColor"/></svg>`,
  picture: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M5 17l5-5 3 3 2-2 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></g></svg>`,
};

export function setupEditor({ dialog, toast, onClose }) {
  let selectedId = state.games[0]?.id ?? null;
  let tab = 'games';
  let dragId = null;

  const listEl = dialog.querySelector('#games-list');
  const formEl = dialog.querySelector('#game-form');
  const timerForm = dialog.querySelector('#timer-form');

  // ---- Tabs ----
  dialog.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    setTab(btn.dataset.tab);
  });

  function setTab(name) {
    tab = name;
    dialog.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    dialog.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (name === 'timer') renderTimerForm();
    if (name === 'shopping') shopping.render();
  }

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => onClose?.());

  // ---- Games list ----
  function renderList() {
    const played = new Set(state.playedIds);
    listEl.innerHTML = state.games
      .map(
        (g) => `
        <li class="game-row ${g.id === selectedId ? 'is-selected' : ''} ${g.enabled ? '' : 'is-off'}" draggable="true" data-id="${g.id}">
          <span class="grip" title="Drag to reorder">${icons.grip}</span>
          <button class="game-row-btn" data-select="${g.id}" aria-current="${g.id === selectedId}">
            <span class="game-row-name">${esc(g.name)}</span>
            <span class="game-row-meta">
              ${isScreenGame(g) ? `<span class="meta-icon" title="Screen game">${tvIcon}</span>` : ''}
              ${parseYouTube(g.videoUrl) ? `<span class="meta-icon" title="Has a video">${icons.video}</span>` : ''}
              ${g.image ? `<span class="meta-icon" title="Has a picture">${icons.picture}</span>` : ''}
              ${!g.enabled ? '<span class="badge">Hidden</span>' : played.has(g.id) ? '<span class="badge">Played</span>' : ''}
            </span>
          </button>
        </li>`,
      )
      .join('');
    dialog.querySelector('#games-count').textContent = `${state.games.length} game${state.games.length === 1 ? '' : 's'}`;
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select]');
    if (!btn) return;
    selectedId = btn.dataset.select;
    renderList();
    renderForm();
  });

  listEl.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.game-row');
    if (!row) return;
    dragId = row.dataset.id;
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  listEl.addEventListener('dragend', () => {
    dragId = null;
    listEl.querySelectorAll('.is-dragging, .drop-before, .drop-after').forEach((el) =>
      el.classList.remove('is-dragging', 'drop-before', 'drop-after'),
    );
  });
  listEl.addEventListener('dragover', (e) => {
    const row = e.target.closest('.game-row');
    if (!row || !dragId || row.dataset.id === dragId) return;
    e.preventDefault();
    const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
    listEl.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
    row.classList.add(after ? 'drop-after' : 'drop-before');
  });
  listEl.addEventListener('drop', (e) => {
    const row = e.target.closest('.game-row');
    if (!row || !dragId) return;
    e.preventDefault();
    const after = row.classList.contains('drop-after');
    moveGame(dragId, row.dataset.id, after);
  });

  function moveGame(id, targetId, after) {
    update((s) => {
      const from = s.games.findIndex((g) => g.id === id);
      const [game] = s.games.splice(from, 1);
      let to = s.games.findIndex((g) => g.id === targetId);
      if (after) to += 1;
      s.games.splice(to, 0, game);
    });
    renderList();
  }

  function moveBy(delta) {
    const i = state.games.findIndex((g) => g.id === selectedId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.games.length) return;
    update((s) => {
      const [g] = s.games.splice(i, 1);
      s.games.splice(j, 0, g);
    });
    renderList();
    renderForm();
  }

  dialog.querySelector('#add-game').addEventListener('click', () => {
    const game = newGame();
    update((s) => s.games.push(game));
    selectedId = game.id;
    renderList();
    renderForm();
    const name = formEl.querySelector('[name=name]');
    name.focus();
    name.select();
    listEl.querySelector(`[data-id="${game.id}"]`)?.scrollIntoView({ block: 'nearest' });
  });

  // ---- Game form ----
  function selected() {
    return state.games.find((g) => g.id === selectedId) || null;
  }

  function renderForm() {
    const g = selected();
    if (!g) {
      formEl.innerHTML = `<div class="form-empty"><p>No game selected.</p><p>Pick one from the list, or add a new game.</p></div>`;
      return;
    }
    const index = state.games.indexOf(g);
    const played = state.playedIds.includes(g.id);
    formEl.innerHTML = `
      <div class="field">
        <label for="f-name">Game name</label>
        <input id="f-name" name="name" value="${esc(g.name)}" maxlength="40" autocomplete="off">
      </div>
      <label class="check">
        <input type="checkbox" name="enabled" ${g.enabled ? 'checked' : ''}>
        <span>Show this game on the wheel</span>
      </label>
      ${
        played
          ? `<p class="field-note">This game has been played this round, so it’s off the wheel until you reset. <button type="button" class="link-btn" data-act="unplay">Put it back now</button></p>`
          : ''
      }
      ${typeFieldHtml(g)}
      <div class="field">
        <label for="f-instructions">Instructions</label>
        <textarea id="f-instructions" name="instructions" rows="6">${esc(g.instructions)}</textarea>
      </div>
      ${suppliesFieldHtml(g)}
      ${settingsHtml(g)}
      <div class="field">
        <label for="f-video">YouTube video link <span class="optional">(optional)</span></label>
        <input id="f-video" name="videoUrl" value="${esc(g.videoUrl)}" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" inputmode="url">
        <div class="video-check" id="video-check"></div>
      </div>
      <div class="field">
        <span class="label">Picture <span class="optional">(optional)</span></span>
        <div class="picture-field">
          <div class="picture-preview">${g.image ? `<img src="${esc(g.image)}" alt="">` : '<span>No picture</span>'}</div>
          <div class="picture-actions">
            <label class="btn btn-small file-btn">Choose a picture<input type="file" accept="image/*" name="imageFile" hidden></label>
            ${g.image ? '<button type="button" class="link-btn" data-act="remove-image">Remove picture</button>' : ''}
          </div>
        </div>
      </div>
      <div class="form-footer">
        <div class="order-btns">
          <button type="button" class="btn btn-small btn-quiet" data-act="up" ${index === 0 ? 'disabled' : ''}>Move up</button>
          <button type="button" class="btn btn-small btn-quiet" data-act="down" ${index === state.games.length - 1 ? 'disabled' : ''}>Move down</button>
        </div>
        <span class="saved-note" aria-live="polite">Changes save automatically</span>
        <button type="button" class="btn btn-small btn-danger" data-act="delete">Delete game</button>
      </div>`;
    renderVideoCheck(g.videoUrl);
  }

  function renderVideoCheck(url) {
    const box = formEl.querySelector('#video-check');
    if (!box) return;
    if (!url.trim()) {
      box.innerHTML = '';
      return;
    }
    const yt = parseYouTube(url);
    box.innerHTML = yt
      ? `<img src="${thumbnailUrl(yt.id)}" alt="" loading="lazy"><span class="ok">Video link looks good</span>`
      : `<span class="bad">That doesn’t look like a YouTube link. Copy the address from the video’s page.</span>`;
  }

  let saveTimer = 0;
  formEl.addEventListener('input', (e) => {
    const field = e.target;
    if (!field.name || field.type === 'file') return;
    const id = selectedId;
    if (field.name === 'type') {
      update((s) => {
        const g = s.games.find((x) => x.id === id);
        if (g) applyType(g, field.value);
      });
      renderList();
      renderForm();
      flashSaved();
      return;
    }
    if (field.name === 'videoUrl') renderVideoCheck(field.value);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      update((s) => {
        const g = s.games.find((x) => x.id === id);
        if (!g) return;
        if (field.name === 'enabled') g.enabled = field.checked;
        else if (field.name === 'name') g.name = field.value.trim() || 'Untitled game';
        else g[field.name] = field.value;
      });
      renderList();
      flashSaved();
    }, field.type === 'checkbox' ? 0 : 300);
  });

  formEl.addEventListener('change', async (e) => {
    if (e.target.name !== 'imageFile') return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await shrinkImage(file);
      const id = selectedId;
      update((s) => {
        const g = s.games.find((x) => x.id === id);
        if (g) g.image = dataUrl;
      });
      renderList();
      renderForm();
      flashSaved();
    } catch {
      toast('That picture couldn’t be opened. Try a JPG or PNG.');
    }
  });

  formEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = selectedId;
    const act = btn.dataset.act;
    if (act === 'up') moveBy(-1);
    else if (act === 'down') moveBy(1);
    else if (act === 'remove-image') {
      update((s) => {
        const g = s.games.find((x) => x.id === id);
        if (g) g.image = '';
      });
      renderList();
      renderForm();
    } else if (act === 'unplay') {
      update((s) => (s.playedIds = s.playedIds.filter((x) => x !== id)));
      renderList();
      renderForm();
    } else if (act === 'delete') {
      const g = selected();
      if (!g || !confirm(`Delete “${g.name}”? This can’t be undone.`)) return;
      const i = state.games.indexOf(g);
      update((s) => {
        s.games = s.games.filter((x) => x.id !== id);
        s.playedIds = s.playedIds.filter((x) => x !== id);
      });
      selectedId = state.games[Math.min(i, state.games.length - 1)]?.id ?? null;
      renderList();
      renderForm();
      toast(`Deleted “${g.name}”.`);
    }
  });

  formEl.addEventListener('submit', (e) => e.preventDefault());

  mountScreenSettings(formEl, { getId: () => selectedId, saved: () => flashSaved(), toast, shrinkImage });
  mountSuppliesEditor(formEl, { getId: () => selectedId, saved: () => flashSaved() });

  // ---- Shopping list ----
  const shopping = mountShoppingList(dialog.querySelector('#shopping-list'), {
    onEdit: (id) => {
      selectedId = id;
      setTab('games');
      renderList();
      renderForm();
      listEl.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
      formEl.querySelector('.supply-new')?.focus();
    },
  });

  function flashSaved() {
    const note = formEl.querySelector('.saved-note');
    if (!note) return;
    note.textContent = 'Saved';
    note.classList.add('is-fresh');
    clearTimeout(flashSaved.t);
    flashSaved.t = setTimeout(() => {
      note.textContent = 'Changes save automatically';
      note.classList.remove('is-fresh');
    }, 1400);
  }

  // ---- Timer & sound ----
  function renderTimerForm() {
    const s = state.settings;
    timerForm.elements.timerVideoUrl.value = s.timerVideoUrl;
    timerForm.elements.timerStart.value = s.timerStart;
    timerForm.elements.timerTimesUpAt.value = s.timerTimesUpAt;
    timerForm.elements.useBuiltInTimer.checked = s.useBuiltInTimer;
    timerForm.elements.sound.checked = s.sound;
    renderTimerVideoCheck();
  }

  function renderTimerVideoCheck() {
    const box = timerForm.querySelector('#timer-video-check');
    const url = timerForm.elements.timerVideoUrl.value;
    const yt = parseYouTube(url);
    box.innerHTML = !url.trim()
      ? '<span class="bad">No video link, so the built-in timer will run.</span>'
      : yt
        ? `<img src="${thumbnailUrl(yt.id)}" alt="" loading="lazy"><span class="ok">Video link looks good</span>`
        : '<span class="bad">That doesn’t look like a YouTube link.</span>';
  }

  timerForm.addEventListener('input', (e) => {
    const f = e.target;
    if (f.name === 'timerVideoUrl') renderTimerVideoCheck();
    update((s) => {
      if (f.type === 'checkbox') s.settings[f.name] = f.checked;
      else if (f.type === 'number') s.settings[f.name] = Math.max(0, Number(f.value) || 0);
      else s.settings[f.name] = f.value.trim();
    });
  });

  timerForm.addEventListener('submit', (e) => e.preventDefault());

  timerForm.querySelector('[data-act=reset-timer]').addEventListener('click', () => {
    const d = defaultSettings();
    update((s) => {
      s.settings.timerVideoUrl = d.timerVideoUrl;
      s.settings.timerStart = d.timerStart;
      s.settings.timerTimesUpAt = d.timerTimesUpAt;
      s.settings.useBuiltInTimer = d.useBuiltInTimer;
    });
    renderTimerForm();
    toast('Timer settings restored.');
  });

  // ---- Backup ----
  dialog.querySelector('[data-act=export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    a.download = `minute-to-win-it-games-${date}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup downloaded.');
  });

  const importInput = dialog.querySelector('#import-file');
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace your current games with the ones in this backup?')) return;
      importData(data);
      selectedId = state.games[0]?.id ?? null;
      renderList();
      renderForm();
      toast(`Imported ${state.games.length} games.`);
    } catch (err) {
      toast(err instanceof SyntaxError ? 'That file isn’t a Minute to Win It backup.' : err.message);
    }
  });

  dialog.querySelector('[data-act=restore]').addEventListener('click', () => {
    if (!confirm('Replace your games with the original 12? Any games you added or changed will be lost.')) return;
    update((s) => {
      s.games = defaultGames();
      s.playedIds = [];
    });
    selectedId = state.games[0]?.id ?? null;
    renderList();
    renderForm();
    toast('Original games restored.');
  });

  return {
    open(focusGameId) {
      if (focusGameId) selectedId = focusGameId;
      if (!state.games.some((g) => g.id === selectedId)) selectedId = state.games[0]?.id ?? null;
      setTab('games');
      renderList();
      renderForm();
      dialog.showModal();
    },
  };
}

/** Resize pictures so they fit in browser storage. Keeps transparency (WebP). */
async function shrinkImage(file, max = 900) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/webp', 0.85);
}
