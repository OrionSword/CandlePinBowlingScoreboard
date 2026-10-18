# Candlepin Bowling Scoreboard

A phone-friendly score tracker for candlepin bowling. It is a plain HTML/CSS/JS
app with no build step, made to be hosted on GitHub Pages and installed to your
home screen from Chrome. It works offline once installed.

## Features

- Full candlepin scoring: three balls per frame, strikes (10 + next two balls),
  spares (10 + next ball), ten-boxes (all 10 in three balls, no bonus), open
  frames, deadwood (each ball can only knock down pins still standing), and the
  10th frame where pins are reset after a strike or spare so three balls are
  always thrown. Perfect game = 300.
- Fouls (the ball counts as thrown, scores 0).
- 1–8 bowlers taking turns frame by frame.
- Live running totals, current frame highlight, and "max possible" score.
- End-of-game summary per bowler: score, total throws, strikes, spares,
  ten-boxes and first-ball average.
- The game in progress is saved on the phone after every ball, so a refresh,
  closed tab or closed browser doesn't lose it.
- History of finished games with full scorecards, plus per-bowler stats
  (games, average, high game, throws per game).
- Record whether fences (bumpers) were up for each game, and filter history
  and bowler stats by fences / no fences.
- Enter each ball as pins knocked down, or switch to counting the pins left
  standing (no subtracting in your head).
- Export / import a JSON backup of your history.

## Publish with GitHub Pages

1. Merge this code into the default branch (`main`).
2. On GitHub go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main`
   and `/ (root)`, then **Save**.
4. After a minute the site is live at
   `https://<your-username>.github.io/CandlePinBowlingScoreboard/`.

## Install on Android (Chrome)

1. Open the GitHub Pages link in Chrome.
2. Tap the **⋮** menu → **Add to Home screen** → **Install**.
3. Launch it from the home screen icon. It opens full screen and works without
   a signal at the lanes.

## Install on iPhone / iPad

1. Open the GitHub Pages link in Safari (on iOS 16.4+ Chrome works too via its
   share button).
2. Tap the **Share** button → **Add to Home Screen** → make sure **Open as Web
   App** is on (newer iOS versions) → **Add**.
3. Launch it from the home screen icon.

On iOS the home screen app and the Safari tab keep **separate** saved games and
history. Use the home screen app at the lanes. Safari can also erase a site's
saved data after about 7 days without a visit; the home screen app is exempt
from that. **Export backup** opens the share sheet so you can save the file to
Files or AirDrop it, and **Import backup** reads it back in.

Your scores are stored in the browser's local storage for that site. Clearing
Chrome's site data for the page will erase them, so use **Export backup** on
the History tab now and then.

## Development

Serve the folder with any static server, e.g. `python3 -m http.server`, and
open http://localhost:8000. Scoring rules live in `scoring.js`; run the tests
with:

```sh
node --test tests/scoring.test.js
```

When you change app files, bump `CACHE` in `sw.js` and the `?v=` number on the
file links in `index.html` and `sw.js`, so installed copies pick up the new
version.
