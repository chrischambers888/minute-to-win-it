// The end-of-night podium: who finished 1st, 2nd and 3rd.
import { state } from './store.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const crown = `<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-5 4L12 5l-2.5 7-5-4z" fill="currentColor"/></svg>`;

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

const points = (n) => `${n} ${n === 1 ? 'point' : 'points'}`;

/** Players grouped by score, highest first. Tied players share a place, and the next score is the next place. */
function places(players) {
  const groups = [];
  [...players]
    .sort((a, b) => b.score - a.score)
    .forEach((p) => {
      const last = groups.at(-1);
      if (last && last.score === p.score) last.players.push(p);
      else groups.push({ score: p.score, players: [p] });
    });
  return groups;
}

/** Fills in the winner screen. Returns the players in first place. */
export function renderWinner({ kicker, title, podium, rest }) {
  const groups = places(state.players);
  const winners = groups[0]?.players ?? [];
  const names = winners.map((p) => p.name);

  kicker.textContent = winners.length > 1 ? 'And the winners are…' : 'And the winner is…';
  title.textContent = names.length <= 2 ? names.join(' & ') : 'It’s a tie!';

  podium.innerHTML = groups
    .slice(0, 3)
    .map((g, i) => {
      const who = g.players.map((p) => p.name).join(', ');
      return `<li class="podium-place place-${i + 1}" aria-label="${ordinal(i + 1)} place: ${esc(who)}, ${points(g.score)}">
        <div class="podium-names" aria-hidden="true">
          ${i === 0 ? crown : ''}
          ${g.players
            .map(
              (p) =>
                `<span class="podium-name">${esc(p.name)}</span>${
                  p.members.length ? `<span class="podium-members">${p.members.map((m) => esc(m.name)).join(', ')}</span>` : ''
                }`,
            )
            .join('')}
        </div>
        <div class="podium-block" aria-hidden="true">
          <span class="podium-rank">${i + 1}</span>
          <span class="podium-score">${points(g.score)}</span>
        </div>
      </li>`;
    })
    .join('');

  const others = groups.slice(3);
  rest.innerHTML = others.length
    ? `<ol class="winner-others" aria-label="Everyone else">
        ${others
          .flatMap((g, i) =>
            g.players.map(
              (p) => `<li><span class="other-place">${ordinal(i + 4)}</span> ${esc(p.name)} <span class="other-score">${g.score}</span></li>`,
            ),
          )
          .join('')}
      </ol>`
    : '';

  return winners;
}
