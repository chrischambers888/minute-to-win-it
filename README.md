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
3. **Who's up?** (optional, needs 2+ players on the scoreboard) Click **Who's up?** or press <kbd>P</kbd> and a smaller wheel picks 1 to 4 players for the game. Players come off that wheel once they've played, so everyone gets a turn before anyone goes twice.
4. **Start the clock.** Press <kbd>Enter</kbd> or click the big button. The official timer plays full screen.
5. **Time's up.** Click a player or team to give them a point (whoever was up is listed first), then go back to the wheel.
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

## Playing in teams

On the scoreboard, click **Edit**, then **+ Add players** under a team and add its players one at a time (type a name, press <kbd>Enter</kbd>, type the next). Each player gets their own line, with an × to remove them. Then:

- **Who's up?** spins once for each team and picks one person from it, so it's one player vs one player (for example "Jordan vs Casey"). Use **Per team** to pick 2 or 3 from each team instead.
- Each team takes turns in order, so everyone on a team plays before anyone on that team goes twice.
- Points go to the team. Time's Up shows who played for each team.
- A team named after a color ("Blue Team") gets that color.

Don't add any players to a team to play as individuals.

## Editing games

Click **Manage games** (top right). You can add, edit, delete and reorder games, paste YouTube links, add pictures, and hide a game from the wheel without deleting it. Changes save automatically.

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
js/main.js          screen flow and keyboard shortcuts
js/wheel.js         the spinning wheel
js/timer.js         the countdown (YouTube video or built-in)
js/editor.js        the Manage games window
js/scoreboard.js    scores and points
js/picker.js        the "Who's up?" player wheel
js/winner.js        the end-of-night podium
js/store.js         saving to the browser
js/defaults.js      the original 12 games and default settings
js/audio.js         sound effects (generated, no audio files)
assets/             icon, link-preview image and game pictures
start.command       runs the site locally (not deployed)
```

Fonts (Bungee, Barlow) load from Google Fonts. Without internet the site falls back to similar system fonts.
