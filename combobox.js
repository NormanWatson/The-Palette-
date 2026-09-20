// ------------------------------------------------------------
// combobox.js — searchable dropdown widget. No dependencies on
// the other files here; this would work standalone in any page.
// Replaces plain <select> for block pickers so typing a few
// letters anywhere in a block's name filters the list, instead
// of relying on a native <select>'s single-keystroke jump-to-match
// (impractical once a real dataset has hundreds of blocks in it).
// ------------------------------------------------------------
function createCombobox(inputEl, listEl, onSelect) {
  let options = [];   // [{id, name}]
  let filtered = [];
  let selectedId = null;
  let activeIndex = -1;

  const labelFor = id => { const o = options.find(o => o.id === id); return o ? o.name : ''; };

  function highlightMatch(name, q) {
    const frag = document.createDocumentFragment();
    const idx = q ? name.toLowerCase().indexOf(q) : -1;
    if (idx === -1) { frag.appendChild(document.createTextNode(name)); return frag; }
    frag.appendChild(document.createTextNode(name.slice(0, idx)));
    const mark = document.createElement('mark');
    mark.textContent = name.slice(idx, idx + q.length);
    frag.appendChild(mark);
    frag.appendChild(document.createTextNode(name.slice(idx + q.length)));
    return frag;
  }

  function renderList(query) {
    const q = query.trim().toLowerCase();
    filtered = q ? options.filter(o => o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : options;
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = 'No matching blocks';
      listEl.appendChild(empty);
    } else {
      filtered.slice(0, 200).forEach(opt => {
        const item = document.createElement('div');
        item.className = 'combo-option';
        item.setAttribute('role', 'option');
        item.appendChild(highlightMatch(opt.name, q));
        item.addEventListener('mousedown', (e) => { e.preventDefault(); select(opt.id); });
        listEl.appendChild(item);
      });
    }
    activeIndex = -1;
  }

  function open(query) {
    renderList(query != null ? query : '');
    listEl.classList.add('open');
    inputEl.setAttribute('aria-expanded', 'true');
  }
  function close() {
    listEl.classList.remove('open');
    inputEl.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }
  function select(id) {
    if (!options.some(o => o.id === id)) return;
    selectedId = id;
    inputEl.value = labelFor(id);
    close();
    onSelect(id);
  }
  function setActive(i) {
    const items = listEl.querySelectorAll('.combo-option');
    items.forEach(el => el.classList.remove('active'));
    if (i >= 0 && i < items.length) { items[i].classList.add('active'); items[i].scrollIntoView({ block: 'nearest' }); }
    activeIndex = i;
  }

  inputEl.addEventListener('focus', () => open(''));
  inputEl.addEventListener('input', () => open(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (!listEl.classList.contains('open')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { open(''); }
      return;
    }
    const items = listEl.querySelectorAll('.combo-option');
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) select(filtered[activeIndex].id);
      else if (filtered.length === 1) select(filtered[0].id);
    } else if (e.key === 'Escape') { close(); inputEl.value = labelFor(selectedId); }
  });
  inputEl.addEventListener('blur', () => {
    // small delay so a mousedown on an option fires select() before we revert the text
    setTimeout(() => { close(); inputEl.value = labelFor(selectedId); }, 120);
  });

  return {
    setOptions(newOptions, preferredId) {
      options = newOptions;
      const fallbackId = options[0] && options[0].id;
      selectedId = (preferredId && options.some(o => o.id === preferredId)) ? preferredId : (fallbackId || null);
      inputEl.value = labelFor(selectedId);
    },
    get value() { return selectedId; },
    set value(id) { select(id); },
  };
}
