// ============================================================
// app.js — the main application: state, DOM wiring, and every
// render function. Loads last; depends on all four other files.
// This is the one file you'd actually read top-to-bottom to
// follow what happens when someone uses the page.
// ============================================================

// ---- state + rendering ----
let dataset = [];
let datasetLabel = 'no dataset loaded';
const byId = id => dataset.find(d => d.id === id);

function makeChip(block, subLines) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  const swatch = document.createElement('div');
  swatch.className = 'chip-swatch';
  swatch.style.backgroundColor = `rgb(${block.rgb[0]},${block.rgb[1]},${block.rgb[2]})`;
  if (block.image) {
    swatch.style.backgroundImage = `url("${block.image}")`;
  }
  const label = document.createElement('div');
  label.className = 'chip-label';
  const name = document.createElement('div');
  name.className = 'chip-name';
  name.textContent = block.name;
  label.appendChild(name);
  (subLines || []).forEach(line => {
    const sub = document.createElement('div');
    sub.className = 'chip-sub';
    sub.textContent = line;
    label.appendChild(sub);
  });
  chip.appendChild(swatch);
  chip.appendChild(label);
  return chip;
}

function renderCompanionPanel(container, items, emptyMessage, formatSub) {
  if (!includeComplementary) { container.style.display = 'none'; container.innerHTML = ''; return; }
  container.style.display = '';
  container.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'companion-title';
  title.textContent = 'Complementary';
  container.appendChild(title);
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'companion-empty';
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'companion-item';
    const swatch = document.createElement('div');
    swatch.className = 'companion-swatch';
    swatch.style.backgroundColor = `rgb(${item.block.rgb[0]},${item.block.rgb[1]},${item.block.rgb[2]})`;
    if (item.block.image) swatch.style.backgroundImage = `url("${item.block.image}")`;
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'companion-name';
    name.textContent = item.block.name;
    info.appendChild(name);
    formatSub(item).forEach(line => {
      const sub = document.createElement('div');
      sub.className = 'companion-sub';
      sub.textContent = line;
      info.appendChild(sub);
    });
    row.appendChild(swatch);
    row.appendChild(info);
    container.appendChild(row);
  });
}


const gradSteps = document.getElementById('gradSteps');
const gradStepsValue = document.getElementById('gradStepsValue');
const gradOutput = document.getElementById('gradOutput');
const gradCompanion = document.getElementById('gradCompanion');
const gradNote = document.getElementById('gradNote');
const texOutput = document.getElementById('texOutput');
const texCompanion = document.getElementById('texCompanion');
const texModeNote = document.getElementById('texModeNote');
const browseFilter = document.getElementById('browseFilter');
const browseScope = document.getElementById('browseScope');
const browseOutput = document.getElementById('browseOutput');
const browseCount = document.getElementById('browseCount');
const browsePagination = document.getElementById('browsePagination');
const browsePrev = document.getElementById('browsePrev');
const browseNext = document.getElementById('browseNext');
const browsePageLabel = document.getElementById('browsePageLabel');
const datasetStatus = document.getElementById('datasetStatus');
const datasetError = document.getElementById('datasetError');
let texMode = 'harmony';

const modeNotes = {
  harmony: 'Harmony: close in both color and surface — safe choices for filling out a palette.',
  accent: 'Accent: same color family, deliberately different surface — good for trim and borders.',
};

const gradACombo = createCombobox(document.getElementById('gradA'), document.getElementById('gradAList'), () => renderGradient());
const gradBCombo = createCombobox(document.getElementById('gradB'), document.getElementById('gradBList'), () => renderGradient());
const texBlockCombo = createCombobox(document.getElementById('texBlock'), document.getElementById('texBlockList'), () => renderTexture());

const SPREAD_NOTE_THRESHOLD = 8;
function spreadNote(block) {
  return block.spread > SPREAD_NOTE_THRESHOLD ? ['mixed/speckled surface'] : [];
}

function renderGradient() {
  const blockA = byId(gradACombo.value), blockB = byId(gradBCombo.value);
  if (!blockA || !blockB) {
    gradOutput.innerHTML = '';
    gradCompanion.style.display = 'none';
    gradNote.textContent = dataset.length === 0
      ? 'Load a dataset above (or try the sample data) to build a gradient.'
      : '';
    return;
  }
  const steps = parseInt(gradSteps.value, 10);
  gradStepsValue.textContent = steps;
  const pool = searchableBlocks();
  const { chain, jumps, maxJumpIndex } = buildGradient(blockA, blockB, steps, pool);
  gradOutput.innerHTML = '';
  chain.forEach((step, i) => {
    const chip = makeChip(step.block, [`step ${i + 1} of ${chain.length}`, ...spreadNote(step.block)]);
    if (i < jumps.length) {
      const delta = document.createElement('div');
      delta.className = 'chip-delta' + (i === maxJumpIndex ? ' chip-delta-max' : '');
      delta.textContent = `ΔE ${jumps[i].toFixed(1)} to next`;
      chip.querySelector('.chip-label').appendChild(delta);
    }
    gradOutput.appendChild(chip);
  });
  gradNote.textContent = maxJumpIndex >= 0
    ? `Biggest visual jump is between steps ${maxJumpIndex + 1} and ${maxJumpIndex + 2} — the palette has a gap there.`
    : '';

  const companions = findComplementaryCompanions(chain, complementaryBlocks(), COMPANION_THRESHOLD.gradient, 5);
  renderCompanionPanel(gradCompanion, companions,
    'No complementary blocks are a close color match for this gradient.',
    item => [`ΔE ${item.distance.toFixed(1)}`, `fits step${item.steps.length > 1 ? 's' : ''} ${item.steps.join(', ')}`]);
}

function renderTexture() {
  const blockA = byId(texBlockCombo.value);
  if (!blockA) {
    texOutput.innerHTML = '';
    texCompanion.style.display = 'none';
    texModeNote.textContent = dataset.length === 0
      ? 'Load a dataset above (or try the sample data) to find matches.'
      : '';
    return;
  }
  const results = findComplementaryByTexture(blockA, searchableBlocks(), texMode, 6);
  texModeNote.textContent = modeNotes[texMode];
  texOutput.innerHTML = '';
  results.forEach(r => {
    texOutput.appendChild(makeChip(r.block, [`ΔE ${r.colorD.toFixed(1)}`, `texture Δ ${r.texD.toFixed(2)}`, ...spreadNote(r.block)]));
  });

  const compResults = findComplementaryByTexture(blockA, complementaryBlocks(), texMode, 5)
    .filter(r => r.colorD <= COMPANION_THRESHOLD[texMode]);
  renderCompanionPanel(texCompanion, compResults,
    `No complementary blocks are a close match for ${blockA.name}.`,
    item => [`ΔE ${item.colorD.toFixed(1)}`, `texture Δ ${item.texD.toFixed(2)}`]);
}

let browsePage = 0;
const BROWSE_MAX_ROWS = 3;

// Renders `items` into `container` once just to read back where flex-wrap
// actually breaks rows at the current viewport width, then reports how many
// items fit within `maxRows` of them. Real browsers give real numbers here;
// if layout measurement isn't available (offsetWidth stays 0), falls back
// to a fixed reasonable guess instead of breaking pagination.
function computeItemsPerPage(container, items, maxRows, fallback) {
  if (items.length === 0) return fallback;
  container.innerHTML = '';
  const temp = items.map(b => makeChip(b, ['\u00A0']));
  temp.forEach(c => container.appendChild(c));
  const measurementBroken = temp[0].offsetWidth === 0;
  const tops = temp.map(c => c.offsetTop);
  container.innerHTML = '';
  if (measurementBroken) return fallback;
  const uniqueTops = [...new Set(tops)];
  if (uniqueTops.length <= maxRows) return items.length;
  const cutoffTop = uniqueTops[maxRows];
  const idx = tops.findIndex(t => t === cutoffTop);
  return idx > 0 ? idx : fallback;
}

function renderBrowse(resetPage) {
  if (resetPage !== false) browsePage = 0;
  const q = browseFilter.value.trim().toLowerCase();
  const scope = browseScope.value;
  const base = scope === 'all' ? dataset
    : scope === 'searchable' ? dataset.filter(b => b.shape === 'cube' || b.shape === 'complementary')
    : dataset.filter(b => b.shape === 'cube');
  const items = base.filter(b => !q || b.name.toLowerCase().includes(q) || b.id.includes(q));

  if (dataset.length === 0) {
    browseCount.textContent = 'No dataset loaded — load a blocks.json above, or try the sample data.';
    browseOutput.innerHTML = '';
    browsePagination.style.display = 'none';
    return;
  }

  const itemsPerPage = computeItemsPerPage(browseOutput, items, BROWSE_MAX_ROWS, 15) || items.length;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  browsePage = Math.min(browsePage, totalPages - 1);
  const start = browsePage * itemsPerPage;
  const pageItems = items.slice(start, start + itemsPerPage);

  browseCount.textContent = `${items.length} of ${base.length} shown (${dataset.length} total in dataset)`;
  browseOutput.innerHTML = '';
  pageItems.forEach(b => {
    const subLines = [b.family || '—'];
    if (b.shape === 'complementary') subLines.push('complementary (detail, not a full cube)');
    if (b.shape === 'other') subLines.push('not a full block');
    browseOutput.appendChild(makeChip(b, subLines));
  });

  if (totalPages > 1) {
    browsePagination.style.display = 'flex';
    browsePrev.disabled = browsePage === 0;
    browseNext.disabled = browsePage >= totalPages - 1;
    browsePageLabel.textContent = `Page ${browsePage + 1} of ${totalPages}`;
  } else {
    browsePagination.style.display = 'none';
  }
}

function renderAll() { renderGradient(); renderTexture(); renderBrowse(); }

let includeComplementary = false;
function searchableBlocks() { return dataset.filter(b => b.shape === 'cube'); }
function complementaryBlocks() { return dataset.filter(b => b.shape === 'complementary'); }
function setIncludeComplementary(checked) {
  includeComplementary = checked;
  document.querySelectorAll('.complementary-toggle').forEach(el => { el.checked = checked; });
  renderAll();
}

function refreshSelectsForNewDataset() {
  const cubes = searchableBlocks();
  const opts = cubes.map(b => ({ id: b.id, name: b.name }));
  const secondId = cubes[Math.min(1, cubes.length - 1)] && cubes[Math.min(1, cubes.length - 1)].id;
  gradACombo.setOptions(opts, cubes[0] && cubes[0].id);
  gradBCombo.setOptions(opts, secondId);
  texBlockCombo.setOptions(opts, cubes[0] && cubes[0].id);
}

function setDataset(newDataset, label) {
  dataset = newDataset;
  datasetLabel = label;
  datasetStatus.innerHTML = `Using: <strong>${label}</strong> (${dataset.length} blocks)`;
  refreshSelectsForNewDataset();
  renderAll();
}

// ---- events ----
gradSteps.addEventListener('input', renderGradient);
browseFilter.addEventListener('input', renderBrowse);
browseScope.addEventListener('change', renderBrowse);
browsePrev.addEventListener('click', () => { browsePage--; renderBrowse(false); });
browseNext.addEventListener('click', () => { browsePage++; renderBrowse(false); });

document.querySelectorAll('.segmented button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.segmented button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    texMode = btn.dataset.mode;
    renderTexture();
  });
});

const TAB_ORDER = ['gradient', 'texture', 'browse', 'about'];
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const currentBtn = document.querySelector('.tab-btn.active');
    const fromIdx = TAB_ORDER.indexOf(currentBtn ? currentBtn.dataset.tab : btn.dataset.tab);
    const toIdx = TAB_ORDER.indexOf(btn.dataset.tab);
    const dir = toIdx >= fromIdx ? 1 : -1;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const newPanel = document.getElementById('panel-' + btn.dataset.tab);
    newPanel.style.setProperty('--swipe-dir', (dir * 18) + 'px');
    newPanel.classList.add('active');
  });
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  datasetError.style.display = 'none';
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const normalized = validateAndNormalize(parsed);
      setDataset(normalized, file.name);
    } catch (err) {
      datasetError.style.display = 'block';
      datasetError.textContent = `Couldn't load that file: ${err.message}`;
    }
  };
  reader.onerror = () => {
    datasetError.style.display = 'block';
    datasetError.textContent = "Couldn't read that file.";
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('resetLink').addEventListener('click', () => {
  datasetError.style.display = 'none';
  setDataset(buildSampleDataset(), 'built-in sample (illustrative, not real texture data)');
});

// ---- init ----
refreshSelectsForNewDataset();
datasetStatus.innerHTML = 'No texture loaded — load a <code>.json</code> above, or try the sample data.';
renderAll();
