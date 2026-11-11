# Word Memory Study

Static browser-based psychology experiment built with plain HTML, CSS, and JavaScript.

## Files
- `index.html` — page structure
- `styles.css` — layout and visual design
- `script.js` — experiment flow, randomization, scoring, and CSV downloads

## Run locally
Keep all three files in the same folder and open `index.html` in a modern browser.

## Experiment flow
1. Participants study 18 concrete words in three randomized encoding-strategy blocks.
2. Each block has six words shown for three seconds each.
3. Strategy order and word-list assignment are randomized for each session.
4. A 30-second backward-counting distractor follows.
5. Participants freely recall the studied words.
6. The results screen shows total recall and a visual bar comparison across strategies.

## Data downloads
- Summary CSV: one row per session.
- Trial-level CSV: 18 rows per session, one per studied word.

Data are generated in the browser and are not sent to a server.

## Publish with GitHub Pages
Upload the three project files to the root of a GitHub repository. In Settings → Pages, choose Deploy from a branch, select `main` and `/ (root)`, and save.
