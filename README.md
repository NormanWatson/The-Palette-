# Block matching engine


## Files
- `index.html` — page structure only. No logic lives here.
- `styles.css` — all styling.
- `color-math.js` — CIEDE2000 + Lab/RGB conversions. No dependencies.
- `matching-engine.js` — the gradient/harmony/accent algorithms. Depends on `color-math.js`.
- `dataset.js` — the 44-block sample data, plus loading/validating a real dataset. Depends on `color-math.js`.
- `combobox.js` — the searchable dropdown widget. Fully standalone.
- `app.js` — state, DOM wiring, and every render function. Depends on all four files above; loads last. This is the one to read top-to-bottom if you want to follow what the page actually does.

## Getting real data
This ships with no block set loaded by default — just click "try sample data"
to see it work with 44 illustrative (hand-set, not extracted) blocks, or run
`extract_blocks.py` against your own Minecraft resource pack's texture folder
to get a real `blocks.json` and load that instead. See the About tab in the
page itself for the full explanation of how the matching actually works.
