# Minute to Win It

A game-night website: spin the wheel, read the game, start the official 60-second clock.

**Play it:** <https://minute-to-win-it-pi.vercel.app>

It's a plain static site (HTML, CSS and JavaScript, no build step), hosted on Vercel from this repo. Every push to `main` updates the live site.

## Run it on your own computer

Double-click **`start.command`** in this folder. It starts a small web server on this computer and opens the game in Brave at <http://localhost:8060>. Leave the Terminal window open while you play; close it to stop.

(From a terminal you can also run `./start.command`.)

The site has to run from a web server. YouTube videos won't play if you open `index.html` directly.

## Hosting on Vercel

Import this repo in Vercel and keep the defaults: Framework Preset **Other**, no build command, output directory = the repo root. Nothing else is needed.

Each visitor gets their own copy of the games and scores, saved in their browser. Everyone starts with the 12 games in `js/defaults.js`, so edit that file to change what new visitors see.

## Playing

1. **Spin.** Click the wheel or press <kbd>Space</kbd>. Whatever it lands on comes off the wheel until you click **Reset the wheel**.
2. **Read the game.** The instructions and video (if the game has one) come up. Not feeling it? **Put back and spin again**.
3. **Who's up?** (optional, needs 2+ players on the scoreboard) Click **Who's up?** or press <kbd>P</kbd> and a smaller wheel picks 1 to 4 players for the game. It mixes up matchups: it goes for people who haven't played in a game together yet, and among those, whoever has played the least. So you get as many different matchups as possible while everyone still plays about the same amount (someone may go twice in a row now and then). Being picked counts right away. **Pick again** picks a different matchup, and **Put back and spin again** gives the turns back.
4. **Start the clock.** Press <kbd>Enter</kbd> or click the big button. The official timer plays full screen. (In a [screen game](#screen-games) the game fills the screen when the 60 starts, and the clock moves to the corner.)
5. **Time's up.** Click a player or team to give them a point (whoever was up is listed first), then go back to the wheel. In a screen game, press **Reveal** first to show the answers.
6. **Crown the winner.** At the end of the night, click **Crown the winner** on the scoreboard (it also pops up when every game has been played). A drum roll, then the podium. **Start a new night** sets every score to 0 and puts every game back on the wheel.

| Key | What it does |
| --- | --- |
| <kbd>Space</kbd> | Spin (on the wheel) |
| <kbd>Enter</kbd> | Start the clock (on a game) / back to wheel (after time's up) |
| <kbd>P</kbd> | Pick who's up (on a game) |
| <kbd>Esc</kbd> | Go back |
| <kbd>R</kbd> | Restart the clock |
| <kbd>F</kbd> | Full screen |
| <kbd>M</kbd> | Sound effects on/off |
| <kbd>1</kbd>–<kbd>9</kbd>, <kbd>S</kbd>, <kbd>Backspace</kbd> | Math Wizz "Shout it out": who got it, skip, undo |

## Screen games

Three of the starting games play on the TV, so there's nothing to print or write up. The TV shows the game when the clock's 60 starts (the clock moves to the corner) and keeps the answers. At **Time's up**, press **Reveal**, then give points.

- **Math Wizz.** Pick a level on the game screen: **Easy** (single-digit + and −), **Medium** (two-digit + and −, times tables) or **Hard** (mixed, like 156 ÷ 12 or 48 + 37 − 19). New problems every round, all with whole-number answers.
  - **Paper:** 20 numbered problems. Players write their answers on paper. Reveal fills in every answer.
  - **Shout it out:** one big problem at a time. When someone shouts the right answer, press their number (<kbd>1</kbd>–<kbd>9</kbd>) or click their name. The answer flashes, then the next problem comes up. <kbd>S</kbd> skips a problem, <kbd>Backspace</kbd> undoes. The site keeps count, and **See the results** shows who got the most. If you used **Who's up?**, only those players get buttons.
- **Pricing $.** Five products, A to E, prices hidden. Players write the letters from cheapest to most expensive. Reveal flips the cards one at a time, cheapest first, with a drum roll.
- **Memory Flash.** 12 things show for 15 seconds, then turn over. Players write down as many as they remember. Reveal turns them back over.

In **Manage games**, **Game type** makes a game a normal game or one of these, and each screen game has its own settings:

- Math Wizz: which operations (+ − × ÷), how many problems on the Paper sheet, and whether answers can be negative.
- Pricing $: add your own products (name, price, and a picture or emoji) and turn starter products off. The 42 starter products have rough, rounded US prices.
- Memory Flash: how many things to show, and for how many seconds.

Games saved before the screen games existed (and older backups) stay exactly as they were, as normal games. To get the screen games, use **Restore original games**, or open your Math Wizz or Pricing $ and change its **Game type**.

## Playing in teams

On the scoreboard, click **Edit**, then **+ Add players** under a team and add its players one at a time (type a name, press <kbd>Enter</kbd>, type the next). Each player gets their own line, with an × to remove them. Then:

- **Who's up?** spins once for each team and picks one person from it, so it's one player vs one player (for example "Jordan vs Casey"). Use **Per team** to pick 2 or 3 from each team instead.
- Matchups rotate: Red's players face different Blue players each time until every pairing has happened.
- Points go to the team. Time's Up shows who played for each team.
- A team named after a color ("Blue Team") gets that color.

Don't add any players to a team to play as individuals.

## Editing games

Click **Manage games** (top right). You can add, edit, delete and reorder games, paste YouTube links, add pictures, hide a game from the wheel without deleting it, and choose its [game type](#screen-games). Changes save automatically.

Your games, scores and settings are saved **in the browser** (Brave, at `localhost:8060`). To move them to another computer or browser, use **Manage games → Backup → Download backup**, then **Load a backup** on the other side.

**Restore original games** brings back the 12 starting games.

## The timer

- It uses the official timer video: <https://www.youtube.com/watch?v=ebvtJCu33vM>. It runs: logo (0–3s), 3-2-1 (3–6s), 60 → 00 (6–66s).
- **Manage games → Timer and sound** lets you change the video, where it starts (use 6 to skip straight to 60), and when "Time's up" shows.
- No internet? The site switches to a built-in look-alike countdown automatically. You can also choose it there.

## Files

```
index.html          the page
css/styles.css      all the styling
css/screen-games.css  styling for the screen games
js/main.js          screen flow and keyboard shortcuts
js/screen-games.js  the screen games on the timer screen (Math Wizz, Pricing $, Memory Flash)
js/screen-games-data.js      their settings, starter products and memory items
js/screen-games-settings.js  their settings in Manage games
js/wheel.js         the spinning wheel
js/timer.js         the countdown (YouTube video or built-in)
js/editor.js        the Manage games window
js/scoreboard.js    scores and points
js/picker.js        the "Who's up?" player wheel
js/matchups.js      who plays next (fresh matchups first)
js/winner.js        the end-of-night podium
js/store.js         saving to the browser
js/defaults.js      the original 12 games and default settings
js/audio.js         sound effects (generated, no audio files)
assets/             icon, link-preview image and game pictures
start.command       runs the site locally (not deployed)
```

Fonts (Bungee, Barlow) load from Google Fonts. Without internet the site falls back to similar system fonts.
