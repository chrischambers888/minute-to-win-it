// Manage games: the "Game type" picker and the settings for each screen game.
import { state, update } from './store.js';
import {
  TYPES,
  SCREEN_TYPES,
  MATH_OPS,
  MATH_LIMITS,
  MEMORY_LIMITS,
  MEMORY_ITEMS,
  STARTER_PRODUCTS,
  normalizeMath,
  normalizePricing,
  normalizeMemory,
  newProduct,
  productPool,
  formatPrice,
  tvIcon,
} from './screen-games-data.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const removeIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

export function typeFieldHtml(game) {
  return `<div class="field">
    <label for="f-type">Game type</label>
    <select id="f-type" name="type">
      ${['normal', ...SCREEN_TYPES]
        .map((t) => `<option value="${t}" ${game.type === t ? 'selected' : ''}>${esc(TYPES[t].option)}</option>`)
        .join('')}
    </select>
    <p class="field-help">Screen games show their problems, products or pictures on the TV while the clock runs, and keep the answers.</p>
  </div>`;
}

export function settingsHtml(game) {
  if (game.type === 'math') return mathHtml(normalizeMath(game.math));
  if (game.type === 'pricing') return pricingHtml(normalizePricing(game.pricing));
  if (game.type === 'memory') return memoryHtml(normalizeMemory(game.memory));
  return '';
}

const box = (title, body) =>
  `<fieldset class="sg-settings" data-sg-settings><legend>${tvIcon}${title}</legend>${body}</fieldset>`;

function mathHtml(m) {
  const [lo, hi] = MATH_LIMITS.problems;
  return box(
    'Math Wizz settings',
    `<div class="field">
      <span class="label">Problems can use</span>
      <div class="sg-checks">
        ${MATH_OPS.map(
          (o) => `<label class="check"><input type="checkbox" data-sg-op="${o.id}" ${m.ops.includes(o.id) ? 'checked' : ''}>
            <span><b class="sg-sign">${o.sign}</b> ${o.label}</span></label>`,
        ).join('')}
      </div>
      <p class="field-help">Easy uses + and −, Medium adds ×, Hard uses all four. If a level’s usual ones are all off, it uses the ones that are on.</p>
    </div>
    <div class="field sg-num">
      <label for="sg-problems">Problems on the Paper sheet</label>
      <input id="sg-problems" type="number" min="${lo}" max="${hi}" step="1" value="${m.problems}" data-sg-num="math.problems">
      <p class="field-help">${lo} to ${hi}. Shout it out keeps going until time’s up.</p>
    </div>
    <label class="check"><input type="checkbox" data-sg-flag="math.negatives" ${m.negatives ? 'checked' : ''}>
      <span>Allow negative answers <small>(like 4 − 9 = −5)</small></span></label>
    <p class="field-help">The level (Easy, Medium, Hard) and Paper or Shout it out are picked on the game screen, right before you play.</p>`,
  );
}

function memoryHtml(m) {
  const [cLo, cHi] = MEMORY_LIMITS.count;
  const [sLo, sHi] = MEMORY_LIMITS.seconds;
  return box(
    'Memory Flash settings',
    `<div class="field-row">
      <div class="field sg-num">
        <label for="sg-count">Things to remember</label>
        <input id="sg-count" type="number" min="${cLo}" max="${cHi}" step="1" value="${m.count}" data-sg-num="memory.count">
        <p class="field-help">${cLo} to ${cHi}.</p>
      </div>
      <div class="field sg-num">
        <label for="sg-seconds">Seconds they stay on screen</label>
        <input id="sg-seconds" type="number" min="${sLo}" max="${sHi}" step="1" value="${m.seconds}" data-sg-num="memory.seconds">
        <p class="field-help">${sLo} to ${sHi}. They show when the 60 starts.</p>
      </div>
    </div>
    <p class="field-help">Each round picks at random from ${MEMORY_ITEMS.length} things.</p>`,
  );
}

const itemPic = (it) => (it.image ? `<img src="${esc(it.image)}" alt="">` : `<span class="sg-emoji">${esc(it.emoji || '🏷️')}</span>`);

function itemRow(it) {
  return `<li class="sg-item" data-sg-item="${esc(it.id)}">
    <span class="sg-item-pic">${itemPic(it)}</span>
    <input class="sg-item-name" data-sg-field="name" value="${esc(it.name)}" placeholder="Product name" maxlength="40" aria-label="Product name">
    <label class="sg-item-price"><span aria-hidden="true">$</span><input type="number" min="0" step="0.01" data-sg-field="price" value="${it.price || ''}" placeholder="0.00" aria-label="Price in dollars"></label>
    <input class="sg-item-emoji" data-sg-field="emoji" value="${esc(it.emoji)}" placeholder="Emoji" maxlength="8" aria-label="Emoji (optional)">
    <span class="sg-item-actions">
      <label class="btn btn-small btn-quiet file-btn">Picture<input type="file" accept="image/*" data-sg-image hidden></label>
      ${it.image ? '<button type="button" class="link-btn subtle" data-sg-act="remove-image">Remove picture</button>' : ''}
    </span>
    <button type="button" class="icon-btn small danger" data-sg-act="remove-item" aria-label="Remove ${esc(it.name || 'this product')}" title="Remove">${removeIcon}</button>
  </li>`;
}

function pricingHtml(p) {
  const off = new Set(p.off);
  const on = STARTER_PRODUCTS.length - off.size;
  return box(
    'Pricing $ products',
    `<p class="field-help sg-pool">${poolNote(p)}</p>
    <div class="field">
      <span class="label">Your products</span>
      ${
        p.items.length
          ? `<ul class="sg-items">${p.items.map(itemRow).join('')}</ul>`
          : '<p class="field-help">None yet. Add your own with a name, a price, and a picture or an emoji.</p>'
      }
      <div><button type="button" class="btn btn-small" data-sg-act="add-item">Add a product</button></div>
    </div>
    <div class="field">
      <div class="sg-starter-head">
        <span class="label">Starter products <span class="optional sg-on-count">(${on} of ${STARTER_PRODUCTS.length} on)</span></span>
        <span class="sg-starter-links">
          <button type="button" class="link-btn" data-sg-act="all-on">Turn all on</button>
          <button type="button" class="link-btn" data-sg-act="all-off">Turn all off</button>
        </span>
      </div>
      <ul class="sg-starters">${STARTER_PRODUCTS.map(
        (x) => `<li><label class="sg-starter">
          <input type="checkbox" data-sg-starter="${x.id}" ${off.has(x.id) ? '' : 'checked'}>
          <span class="sg-emoji">${x.emoji}</span>
          <span class="sg-starter-name">${esc(x.name)}</span>
          <span class="sg-starter-price">${formatPrice(x.price)}</span>
        </label></li>`,
      ).join('')}</ul>
      <p class="field-help">Rough, rounded US prices. Turn off any that don’t fit where you live.</p>
    </div>`,
  );
}

function poolNote(p) {
  const n = productPool(p).length;
  return `Each round picks 5: some cheap, some pricey, and a close call or two. <b>${n}</b> product${n === 1 ? ' is' : 's are'} on${
    n < 5 ? '. Turn on at least 5.' : '.'
  }`;
}

/**
 * Wires up the settings inside the game form.
 * getId: the selected game's id. saved: shows "Saved". shrinkImage(file, maxSize) → data URL.
 */
export function mountScreenSettings(form, { getId, saved, toast, shrinkImage }) {
  const game = () => state.games.find((g) => g.id === getId());
  const edit = (fn) => {
    const id = getId();
    update((s) => {
      const g = s.games.find((x) => x.id === id);
      if (g) fn(g);
    });
    saved();
  };
  const rerender = () => {
    const el = form.querySelector('[data-sg-settings]');
    const g = game();
    if (el && g) el.outerHTML = settingsHtml(g);
  };
  const pricing = (fn) =>
    edit((g) => {
      g.pricing = normalizePricing(g.pricing);
      fn(g.pricing);
    });
  const itemOf = (el) => el.closest('[data-sg-item]')?.dataset.sgItem;
  const refreshCounts = () => {
    const g = game();
    if (!g || g.type !== 'pricing') return;
    const p = normalizePricing(g.pricing);
    const pool = form.querySelector('.sg-pool');
    if (pool) pool.innerHTML = poolNote(p);
    const on = form.querySelector('.sg-on-count');
    if (on) on.textContent = `(${STARTER_PRODUCTS.length - p.off.length} of ${STARTER_PRODUCTS.length} on)`;
  };

  // Number boxes: save as you type, tidy the number when you leave the box.
  function saveNumber(field) {
    const [type, key] = field.dataset.sgNum.split('.');
    const norm = type === 'math' ? normalizeMath : normalizeMemory;
    let value;
    edit((g) => {
      g[type] = norm({ ...norm(g[type]), [key]: field.value });
      value = g[type][key];
    });
    return value;
  }

  let typing = 0;
  form.addEventListener('input', (e) => {
    const f = e.target;
    if (!f.closest('[data-sg-settings]')) return;
    if (f.dataset.sgNum) {
      clearTimeout(typing);
      typing = setTimeout(() => saveNumber(f), 400);
    } else if (f.dataset.sgField) {
      const id = itemOf(f);
      const key = f.dataset.sgField;
      pricing((p) => {
        const it = p.items.find((x) => x.id === id);
        if (!it) return;
        if (key === 'price') {
          const n = Number(f.value);
          it.price = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
        } else it[key] = key === 'emoji' ? f.value.trim() : f.value;
      });
      if (key === 'emoji') {
        const it = normalizePricing(game()?.pricing).items.find((x) => x.id === id);
        const pic = f.closest('.sg-item').querySelector('.sg-item-pic');
        if (it && pic) pic.innerHTML = itemPic(it);
      }
      refreshCounts();
    }
  });

  form.addEventListener('change', async (e) => {
    const f = e.target;
    if (!f.closest('[data-sg-settings]')) return;
    if (f.dataset.sgNum) {
      clearTimeout(typing);
      f.value = saveNumber(f);
    } else if (f.dataset.sgOp) {
      const op = f.dataset.sgOp;
      const ops = normalizeMath(game()?.math).ops;
      if (!f.checked && ops.length === 1 && ops[0] === op) {
        f.checked = true;
        toast('Keep at least one kind of problem on.');
        return;
      }
      edit((g) => {
        const m = normalizeMath(g.math);
        m.ops = f.checked ? [...new Set([...m.ops, op])] : m.ops.filter((x) => x !== op);
        g.math = normalizeMath(m);
      });
    } else if (f.dataset.sgFlag) {
      const [type, key] = f.dataset.sgFlag.split('.');
      edit((g) => (g[type] = normalizeMath({ ...normalizeMath(g[type]), [key]: f.checked })));
    } else if (f.dataset.sgStarter) {
      const id = f.dataset.sgStarter;
      pricing((p) => (p.off = f.checked ? p.off.filter((x) => x !== id) : [...p.off, id]));
      refreshCounts();
    } else if (f.matches('[data-sg-image]')) {
      const file = f.files?.[0];
      const id = itemOf(f);
      if (!file) return;
      try {
        const image = await shrinkImage(file, 360);
        pricing((p) => {
          const it = p.items.find((x) => x.id === id);
          if (it) it.image = image;
        });
        rerender();
      } catch {
        toast('That picture couldn’t be opened. Try a JPG or PNG.');
      }
    }
  });

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sg-act]');
    if (!btn || !btn.closest('[data-sg-settings]')) return;
    const act = btn.dataset.sgAct;
    const id = itemOf(btn);
    if (act === 'add-item') {
      const item = newProduct();
      pricing((p) => p.items.push(item));
      rerender();
      form.querySelector(`[data-sg-item="${item.id}"] .sg-item-name`)?.focus();
    } else if (act === 'remove-item') {
      pricing((p) => (p.items = p.items.filter((x) => x.id !== id)));
      rerender();
    } else if (act === 'remove-image') {
      pricing((p) => {
        const it = p.items.find((x) => x.id === id);
        if (it) it.image = '';
      });
      rerender();
    } else if (act === 'all-on' || act === 'all-off') {
      pricing((p) => (p.off = act === 'all-on' ? [] : STARTER_PRODUCTS.map((x) => x.id)));
      rerender();
    }
  });
}
