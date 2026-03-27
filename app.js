const STORAGE_KEY = 'cute-sticky-v2';

// Each theme has 5 characters:
// [0] char-tl → main character, large, wiggles
// [1] char-tr → top-right,  bounces
// [2] char-bl → bottom-left, floats
// [3] char-br → bottom-right, spins
// [4] char-mid → right-edge middle, blinks
const THEMES = {
  pink:     { chars: ['🐱', '🎀', '💗', '🌸', '✨'] },
  yellow:   { chars: ['🐝', '⭐', '🌻', '🍯', '🌟'] },
  mint:     { chars: ['🐸', '🍃', '🦋', '🌿', '🍀'] },
  lavender: { chars: ['🦄', '🌙', '💜', '🔮', '✨'] },
  peach:    { chars: ['🐣', '🌺', '🍑', '🌼', '🌸'] },
  sky:      { chars: ['🐬', '⭐', '🌊', '💧', '🐠'] },
};

const COLORS     = Object.keys(THEMES);
const CHAR_SLOTS = ['char-tl', 'char-tr', 'char-bl', 'char-br', 'char-mid'];

const board      = document.getElementById('board');
const addBtn     = document.getElementById('addNote');
const gridToggle = document.getElementById('gridToggle');
const tidyBtn    = document.getElementById('tidyBtn');
const clearBtn   = document.getElementById('clearBtn');
const counter    = document.getElementById('noteCounter');
const template   = document.getElementById('note-tpl');

let notes     = [];
let dragState = null;
let snapGrid  = false;

// ── Persistence ───────────────────────────────────────────────
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }
function load() {
  try   { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

// ── Utilities ─────────────────────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function countWords(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

function randomPos() {
  const bw = board.clientWidth  || window.innerWidth;
  const bh = board.clientHeight || (window.innerHeight - 60);
  return {
    x: Math.round(Math.random() * Math.max(bw - 280, 40) + 30),
    y: Math.round(Math.random() * Math.max(bh - 260, 40) + 30),
  };
}

function snapTo(v, grid = 20) {
  return Math.round(v / grid) * grid;
}

function maxZ() {
  return notes.reduce((m, n) => Math.max(m, n.z || 1), 1);
}

function updateCounter() {
  const n = notes.length;
  counter.textContent = n === 1 ? '1 note' : `${n} notes`;
}

// ── Characters ────────────────────────────────────────────────
function applyChars(noteEl, color) {
  const chars = (THEMES[color] || THEMES.pink).chars;
  CHAR_SLOTS.forEach((cls, i) => {
    noteEl.querySelector('.' + cls).textContent = chars[i] ?? '';
  });
}

// ── Render one note ───────────────────────────────────────────
function renderNote(data) {
  const frag   = template.content.cloneNode(true);
  const noteEl = frag.querySelector('.note');

  noteEl.dataset.id = data.id;
  noteEl.classList.add(data.color);
  if (data.pinned) noteEl.classList.add('pinned');
  noteEl.style.left   = data.x + 'px';
  noteEl.style.top    = data.y + 'px';
  noteEl.style.zIndex = data.z || 1;

  applyChars(noteEl, data.color);

  const titleEl    = noteEl.querySelector('.note-title');
  const textareaEl = noteEl.querySelector('.note-text');
  const dateEl     = noteEl.querySelector('.note-date');
  const wordsEl    = noteEl.querySelector('.note-words');

  titleEl.value       = data.title || '';
  textareaEl.value    = data.text  || '';
  dateEl.textContent  = formatDate(data.created);
  wordsEl.textContent = countWords(data.text || '') + ' words';

  // mark active color dot
  noteEl.querySelectorAll('.dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === data.color);
  });

  // ── Color dots ──
  noteEl.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('mousedown', e => {
      e.stopPropagation();
      const color = dot.dataset.color;
      COLORS.forEach(c => noteEl.classList.remove(c));
      noteEl.classList.add(color);
      noteEl.querySelectorAll('.dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === color);
      });
      applyChars(noteEl, color);
      updateNote(data.id, { color });
    });
  });

  // ── Pin ──
  noteEl.querySelector('.pin-btn').addEventListener('mousedown', e => {
    e.stopPropagation();
    const pinned = !data.pinned;
    data.pinned = pinned;
    noteEl.classList.toggle('pinned', pinned);
    updateNote(data.id, { pinned });
  });

  // ── Delete ──
  noteEl.querySelector('.delete-btn').addEventListener('mousedown', e => {
    e.stopPropagation();
    deleteNote(data.id, noteEl);
  });

  // ── Title ──
  titleEl.addEventListener('input', () => updateNote(data.id, { title: titleEl.value }));
  titleEl.addEventListener('mousedown', e => e.stopPropagation());
  titleEl.addEventListener('keydown',   e => e.stopPropagation());

  // ── Text + word count ──
  textareaEl.addEventListener('input', () => {
    const wc = countWords(textareaEl.value);
    wordsEl.textContent = wc + (wc === 1 ? ' word' : ' words');
    updateNote(data.id, { text: textareaEl.value });
  });
  textareaEl.addEventListener('mousedown', e => e.stopPropagation());
  textareaEl.addEventListener('keydown',   e => e.stopPropagation());

  // ── Drag ──
  noteEl.addEventListener('mousedown', onDragStart(data.id, noteEl));

  board.appendChild(noteEl);
}

// ── CRUD ──────────────────────────────────────────────────────
function createNote() {
  const pos = randomPos();
  const data = {
    id:      Date.now().toString(),
    title:   '',
    text:    '',
    color:   COLORS[Math.floor(Math.random() * COLORS.length)],
    x:       pos.x,
    y:       pos.y,
    z:       maxZ() + 1,
    pinned:  false,
    created: Date.now(),
  };
  notes.push(data);
  save();
  renderNote(data);
  updateCounter();
  updateEmptyHint();

  // auto-focus title
  setTimeout(() => {
    const el = board.querySelector(`.note[data-id="${data.id}"] .note-title`);
    if (el) el.focus();
  }, 60);
}

function updateNote(id, changes) {
  const note = notes.find(n => n.id === id);
  if (note) Object.assign(note, changes);
  save();
}

function deleteNote(id, el) {
  el.style.transition = 'transform 0.22s, opacity 0.22s';
  el.style.transform  = 'scale(0.45) rotate(12deg)';
  el.style.opacity    = '0';
  setTimeout(() => {
    el.remove();
    notes = notes.filter(n => n.id !== id);
    save();
    updateCounter();
    updateEmptyHint();
  }, 240);
}

// ── Drag logic ────────────────────────────────────────────────
function onDragStart(id, el) {
  return function (e) {
    if (e.button !== 0) return;
    const data = notes.find(n => n.id === id);
    if (data?.pinned) return;

    const newZ = maxZ() + 1;
    el.style.zIndex = newZ;
    updateNote(id, { z: newZ });

    const rect      = el.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    dragState = {
      id, el,
      offsetX:   e.clientX - rect.left,
      offsetY:   e.clientY - rect.top,
      boardLeft: boardRect.left,
      boardTop:  boardRect.top,
    };

    el.classList.add('dragging');
    e.preventDefault();
  };
}

document.addEventListener('mousemove', e => {
  if (!dragState) return;
  const { el, offsetX, offsetY, boardLeft, boardTop } = dragState;
  const x = Math.max(0, e.clientX - boardLeft - offsetX);
  const y = Math.max(0, e.clientY - boardTop  - offsetY);
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
});

document.addEventListener('mouseup', () => {
  if (!dragState) return;
  const { id, el } = dragState;
  el.classList.remove('dragging');
  let x = parseInt(el.style.left);
  let y = parseInt(el.style.top);
  if (snapGrid) { x = snapTo(x); y = snapTo(y); }
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  updateNote(id, { x, y });
  dragState = null;
});

// ── Tidy up ───────────────────────────────────────────────────
function tidyNotes() {
  const bw   = board.clientWidth || window.innerWidth;
  const cols = Math.max(1, Math.floor((bw - 40) / 280));
  const noteW = 248, noteH = 250, gapX = 28, gapY = 36, padX = 36, padY = 28;

  notes.forEach((data, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    data.x    = padX + col * (noteW + gapX);
    data.y    = padY + row * (noteH + gapY);
    const el  = board.querySelector(`.note[data-id="${data.id}"]`);
    if (el) {
      el.style.transition = 'left 0.42s cubic-bezier(0.34,1.2,0.64,1), top 0.42s cubic-bezier(0.34,1.2,0.64,1)';
      el.style.left = data.x + 'px';
      el.style.top  = data.y + 'px';
      setTimeout(() => { el.style.transition = ''; }, 460);
    }
  });
  save();
}

// ── Empty hint ────────────────────────────────────────────────
function updateEmptyHint() {
  let hint = board.querySelector('.empty-hint');
  if (notes.length === 0) {
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.innerHTML = `<span class="big-emoji">🌸</span><p>Click "＋ New Note" to get started!</p>`;
      board.appendChild(hint);
    }
  } else {
    hint?.remove();
  }
}

// ── Toolbar actions ───────────────────────────────────────────
addBtn.addEventListener('click', createNote);

gridToggle.addEventListener('click', () => {
  snapGrid = !snapGrid;
  gridToggle.classList.toggle('active', snapGrid);
  gridToggle.title = snapGrid ? 'Grid snap ON' : 'Snap to grid';
});

tidyBtn.addEventListener('click', tidyNotes);

clearBtn.addEventListener('click', () => {
  if (!notes.length) return;
  const msg = `Remove all ${notes.length} note${notes.length > 1 ? 's' : ''}? This cannot be undone.`;
  if (confirm(msg)) {
    board.querySelectorAll('.note').forEach(el => el.remove());
    notes = [];
    save();
    updateCounter();
    updateEmptyHint();
  }
});

// ── Init ──────────────────────────────────────────────────────
notes = load();
notes.forEach(renderNote);
updateCounter();
updateEmptyHint();
