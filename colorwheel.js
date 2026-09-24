// ============================================================
// colorwheel.js — the "Color wheel" panel: harmony math + the
// draggable wheel widget. Depends on: color-math.js (rgbToLab,
// labToRgb, deltaE2000), matching-engine.js (findNearest,
// findComplementaryCompanions, COMPANION_THRESHOLD), dataset.js
// (indirectly, via `dataset`), and app.js (dataset, byId,
// makeChip, renderCompanionPanel, searchableBlocks,
// complementaryBlocks, spreadNote, wheelBlockCombo). Loads last.
//
// app.js calls two hooks this file defines, guarded with a
// `typeof` check since load order means they don't exist yet at
// the moment app.js's own top-level code runs:
//   - renderColorWheel()   — called from the shared renderAll(),
//     so a dataset load or the complementary-toggle reaches this
//     panel too, same as Gradient/Texture.
//   - wheelAnchorChanged() — called from wheelBlockCombo's
//     onSelect, so picking a new anchor in the search box clears
//     any hand-dragged wheel overrides before rendering.
// ============================================================

// Roughly how many total candidate blocks to show across a scheme's points
// combined (split evenly per point, at least 2 each) -- tune here.
const SUGGESTIONS_TARGET = 8;

// ---- harmony schemes: hue offsets in degrees, relative to the
// anchor's own Lab hue. Monochromatic has none; it varies
// lightness instead (see computeHarmonyPoints). ----
const HARMONY_SCHEMES = {
  complementary:      { label: 'Complementary',       offsets: [180],          note: 'Straight across the wheel — strong contrast, one block clearly in charge.' },
  splitComplementary: { label: 'Split-complementary',  offsets: [150, 210],     note: 'Two neighbors of the opposite color — contrast with a softer edge.' },
  analogous:           { label: 'Analogous',            offsets: [-30, 30],      note: 'Neighbors on the wheel — blocks that already get along.' },
  triadic:              { label: 'Triadic',              offsets: [120, 240],     note: 'Three points evenly spaced — balanced contrast across a build.' },
  tetradic:             { label: 'Tetradic (square)',    offsets: [90, 180, 270], note: 'Four points, two pairs of opposites — busy, use sparingly.' },
  monochromatic:        { label: 'Monochromatic',        offsets: [],             note: 'Same hue, different depth — a lighter and a darker version of one color.' },
};

// ---- small color-math helpers that build on color-math.js's
// rgbToLab/labToRgb (both [L,a,b]-array based) without duplicating
// them. Nothing here overrides a name color-math.js already owns. ----
function normalizeHue(h) { return ((h % 360) + 360) % 360; }

function labToLch(lab) {
  const [L, a, b] = lab;
  const C = Math.sqrt(a * a + b * b);
  const h = normalizeHue(Math.atan2(b, a) * 180 / Math.PI);
  return { L, C, h };
}
function lchToLab(lch) {
  const rad = lch.h * Math.PI / 180;
  return [lch.L, lch.C * Math.cos(rad), lch.C * Math.sin(rad)];
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- DOM refs (script runs at end of body, DOM is already parsed) ----
const wheelEl = document.getElementById('colorWheel');
const wheelCenterEl = document.getElementById('wheelCenter');
const wheelHarmonySelect = document.getElementById('wheelHarmony');
const wheelOutputEl = document.getElementById('wheelOutput');
const wheelCompanionEl = document.getElementById('wheelCompanion');
const wheelModeNoteEl = document.getElementById('wheelModeNote');
const wheelNoteEl = document.getElementById('wheelNote');

// ---- wheel state ----
// Dragging the anchor or a harmony-point handle overrides the "pure" scheme
// math with a hand-picked hue. Picking a new anchor block (or a new harmony
// scheme) clears these so the math takes over again.
let wheelAnchorOverride = null;   // { L, C, h } | null
let wheelPointOverrides = {};      // { [pointIndex]: hueDeg }
let lastAnchorLch = null;          // set every render; drag handlers read L/C from it

let anchorHandle = null;
let pointHandles = [];

wheelHarmonySelect.addEventListener('change', () => {
  wheelPointOverrides = {}; // old offsets don't mean anything under a new scheme
  renderColorWheel();
});

// ---- wheel geometry ----
function radiusPx() { return wheelEl.offsetWidth / 2 * 0.815; }
function hueToOffset(hueDeg, r) {
  const rad = hueDeg * Math.PI / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
}
function xyToHue(dx, dy) { return normalizeHue(Math.atan2(dx, -dy) * 180 / Math.PI); }

function makeHandle(isAnchor) {
  const el = document.createElement('div');
  el.className = 'wheel-handle ' + (isAnchor ? 'wheel-handle-anchor' : 'wheel-handle-point');
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '359');
  wheelEl.appendChild(el);
  return el;
}

function attachDrag(handleEl, onHueChange) {
  handleEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleEl.classList.add('dragging');
    function onMove(ev) {
      const rect = wheelEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      onHueChange(xyToHue(ev.clientX - cx, ev.clientY - cy));
    }
    function onUp() {
      handleEl.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  handleEl.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    const cur = parseFloat(handleEl.dataset.hue || '0');
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onHueChange(normalizeHue(cur - step)); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onHueChange(normalizeHue(cur + step)); e.preventDefault(); }
  });
}

function ensureHandles(neededPoints) {
  if (!anchorHandle) {
    anchorHandle = makeHandle(true);
    attachDrag(anchorHandle, (hue) => {
      const base = lastAnchorLch || { L: 55, C: 42 };
      wheelAnchorOverride = { L: base.L, C: Math.max(base.C, EXPLORATION_MIN_CHROMA), h: hue };
      wheelPointOverrides = {};
      renderColorWheel();
    });
  }
  while (pointHandles.length < neededPoints) {
    const idx = pointHandles.length;
    const h = makeHandle(false);
    attachDrag(h, (hue) => { wheelPointOverrides[idx] = hue; renderColorWheel(); });
    pointHandles.push(h);
  }
  while (pointHandles.length > neededPoints) {
    pointHandles.pop().remove();
  }
}

// A pale/neutral anchor (Calcite: C≈3, Stone Bricks: C≈4) has a barely-defined
// hue -- rotating it by any offset while keeping ITS OWN chroma just produces
// another near-neutral color, so every harmony point ends up within a couple
// ΔE of the same cluster of pale/gray blocks, regardless of nominal angle.
// Flooring the rotated targets' chroma at a moderate, "normal-wood-ish" level
// (Oak Planks sits around C=38; this is deliberately below that) means hue
// actually pulls toward a real, distinct color family even for desaturated
// anchors -- which is the whole point of dragging the ring. Only applies to
// the hue-rotation schemes; Monochromatic keeps the anchor's true chroma on
// purpose, since it's supposed to stay as muted as the anchor if the anchor
// is muted.
const EXPLORATION_MIN_CHROMA = 30;

// ---- harmony math ----
function computeHarmonyPoints(anchorLch, schemeKey) {
  const scheme = HARMONY_SCHEMES[schemeKey];
  if (schemeKey === 'monochromatic') {
    const lighter = clamp(anchorLch.L + 22, 8, 96);
    const darker = clamp(anchorLch.L - 22, 4, 92);
    return [
      { hue: anchorLch.h, lab: lchToLab({ L: lighter, C: anchorLch.C, h: anchorLch.h }), labelSuffix: 'lighter' },
      { hue: anchorLch.h, lab: lchToLab({ L: darker, C: anchorLch.C, h: anchorLch.h }), labelSuffix: 'darker' },
    ];
  }
  const targetC = Math.max(anchorLch.C, EXPLORATION_MIN_CHROMA);
  return scheme.offsets.map((offset) => {
    const hue = normalizeHue(anchorLch.h + offset);
    return { hue, lab: lchToLab({ L: anchorLch.L, C: targetC, h: hue }) };
  });
}

// ---- top-K matching ----
// matching-engine.js's findNearest gives the single best match; each harmony
// point here needs several candidates, so this reuses the exact same score
// (ΔE00 + SPREAD_PENALTY * spread, both from color-math.js / matching-engine.js)
// and just keeps the k best instead of only the best.
function findTopMatches(targetLab, pool, excludeIds, k) {
  const scored = [];
  for (const block of pool) {
    if (excludeIds.has(block.id)) continue;
    const d = deltaE2000(targetLab, block.lab);
    scored.push({ block, distance: d, score: d + SPREAD_PENALTY * (block.spread || 0) });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, k);
}

// ---- a chip for a hypothetical (not-a-real-block) color, matching
// makeChip's DOM shape so it looks identical to a real result chip ----
function customChip(lab, label, sub) {
  const rgb = labToRgb(...lab);
  const chip = document.createElement('div');
  chip.className = 'chip is-anchor';
  const swatch = document.createElement('div');
  swatch.className = 'chip-swatch';
  swatch.style.backgroundColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const labelWrap = document.createElement('div');
  labelWrap.className = 'chip-label';
  const name = document.createElement('div');
  name.className = 'chip-name';
  name.textContent = label;
  const subEl = document.createElement('div');
  subEl.className = 'chip-sub';
  subEl.textContent = sub;
  labelWrap.appendChild(name);
  labelWrap.appendChild(subEl);
  chip.appendChild(swatch);
  chip.appendChild(labelWrap);
  return chip;
}

// ---- wheel visual (handle positions + colors + center readout) ----
function renderWheelVisual(anchorInfo, points, schemeKey) {
  if (!anchorInfo) {
    if (anchorHandle) anchorHandle.style.display = 'none';
    pointHandles.forEach(h => { h.style.display = 'none'; });
    wheelCenterEl.innerHTML = '<span>Pick an anchor block</span>';
    return;
  }
  ensureHandles(schemeKey === 'monochromatic' ? 0 : points.length);
  const r = radiusPx();

  anchorHandle.style.display = '';
  const ao = hueToOffset(anchorInfo.lch.h, r);
  anchorHandle.style.transform = `translate(${ao.x.toFixed(1)}px,${ao.y.toFixed(1)}px)`;
  anchorHandle.style.background = rgbToHex(...labToRgb(...anchorInfo.lab));
  anchorHandle.dataset.hue = anchorInfo.lch.h;
  anchorHandle.setAttribute('aria-label', 'Anchor hue');
  anchorHandle.setAttribute('aria-valuenow', String(Math.round(anchorInfo.lch.h)));

  points.forEach((p, i) => {
    const h = pointHandles[i];
    if (!h) return;
    h.style.display = '';
    const o = hueToOffset(p.hue, r);
    h.style.transform = `translate(${o.x.toFixed(1)}px,${o.y.toFixed(1)}px)`;
    h.style.background = rgbToHex(...labToRgb(...p.lab));
    h.dataset.hue = p.hue;
    h.setAttribute('aria-label', `Harmony point ${i + 1}`);
    h.setAttribute('aria-valuenow', String(Math.round(p.hue)));
  });

  wheelCenterEl.innerHTML = anchorInfo.isCustom
    ? `<strong>Custom hue</strong>${Math.round(anchorInfo.lch.h)}\u00B0`
    : `<strong>${escapeHtml(anchorInfo.block.name)}</strong>${Math.round(anchorInfo.lch.h)}\u00B0`;
}

// ---- main render ----
function renderColorWheel() {
  const blockA = byId(wheelBlockCombo.value);

  if (!blockA) {
    wheelOutputEl.innerHTML = '';
    wheelCompanionEl.style.display = 'none';
    wheelModeNoteEl.textContent = '';
    wheelNoteEl.textContent = dataset.length === 0
      ? 'Load a dataset above (or try the sample data) to build a color-wheel harmony.'
      : '';
    lastAnchorLch = null;
    renderWheelVisual(null, [], wheelHarmonySelect.value);
    return;
  }

  const baseLch = labToLch(blockA.lab);
  const anchorLch = wheelAnchorOverride || baseLch;
  const anchorLab = wheelAnchorOverride ? lchToLab(anchorLch) : blockA.lab;
  const anchorIsCustom = !!wheelAnchorOverride;
  lastAnchorLch = anchorLch;

  const schemeKey = wheelHarmonySelect.value;
  const scheme = HARMONY_SCHEMES[schemeKey];
  const points = computeHarmonyPoints(anchorLch, schemeKey).map((p, i) => {
    if (wheelPointOverrides[i] == null) return p;
    const hue = wheelPointOverrides[i];
    const dragC = schemeKey === 'monochromatic' ? anchorLch.C : Math.max(anchorLch.C, EXPLORATION_MIN_CHROMA);
    return { hue, lab: lchToLab({ L: anchorLch.L, C: dragC, h: hue }), labelSuffix: p.labelSuffix, custom: true };
  });

  renderWheelVisual({ lch: anchorLch, lab: anchorLab, isCustom: anchorIsCustom, block: blockA }, points, schemeKey);
  wheelModeNoteEl.textContent = scheme.note;

  wheelOutputEl.innerHTML = '';
  const pool = searchableBlocks();
  const used = new Set([blockA.id]);

  if (anchorIsCustom) {
    const { block, distance } = findNearest(anchorLab, pool, new Set());
    wheelOutputEl.appendChild(customChip(anchorLab, 'Custom hue', `closest: ${block.name} (\u0394E ${distance.toFixed(1)})`));
  } else {
    const chip = makeChip(blockA, ['anchor']);
    chip.classList.add('is-anchor');
    wheelOutputEl.appendChild(chip);
  }

  const matches = [];
  const perPoint = Math.max(2, Math.round(SUGGESTIONS_TARGET / Math.max(1, points.length)));
  points.forEach((p) => {
    const subLabel = p.labelSuffix ? p.labelSuffix : `${Math.round(normalizeHue(p.hue))}\u00B0`;
    const found = findTopMatches(p.lab, pool, used, perPoint);
    found.forEach(({ block, distance }) => {
      used.add(block.id);
      matches.push({ block, distance });
      const chip = makeChip(block, [`${subLabel} \u00B7 \u0394E ${distance.toFixed(1)}`, ...spreadNote(block)]);
      chip.classList.add('is-clickable');
      chip.title = 'Click to make this the anchor';
      chip.addEventListener('click', () => { wheelBlockCombo.value = block.id; });
      wheelOutputEl.appendChild(chip);
    });
  });

  wheelNoteEl.textContent = matches.length
    ? `Showing up to ${perPoint} per point, closest first.`
    : 'Nothing left in the dataset to suggest — try a smaller-cast dataset or a different anchor.';

  const chainLike = [{ block: blockA }, ...matches.map(m => ({ block: m.block }))];
  const companions = findComplementaryCompanions(chainLike, complementaryBlocks(), COMPANION_THRESHOLD.harmony, 5);
  renderCompanionPanel(wheelCompanionEl, companions,
    'No complementary blocks are a close match for this harmony.',
    item => [`\u0394E ${item.distance.toFixed(1)}`]);
}

// ---- hook for wheelBlockCombo's onSelect (see app.js) ----
function wheelAnchorChanged() {
  wheelAnchorOverride = null;
  wheelPointOverrides = {};
  renderColorWheel();
}

window.addEventListener('resize', () => { if (byId(wheelBlockCombo.value) || wheelAnchorOverride) renderColorWheel(); });

// ---- init: establish the panel's initial (likely "no dataset") state ----
renderColorWheel();
