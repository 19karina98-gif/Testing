const STORAGE_KEY = 'sticky-notepad-notes';
const COLORS = ['pink', 'yellow', 'mint', 'lavender', 'peach'];

const board = document.getElementById('board');
const addBtn = document.getElementById('addNote');
const template = document.getElementById('note-template');

let notes = [];
let dragState = null;

// ── Persistence ──────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// ── Date formatting ───────────────────────────────────────────
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Random placement ──────────────────────────────────────────
function randomPos() {
  const bw = board.clientWidth  || window.innerWidth;
  const bh = board.clientHeight || window.innerHeight - 60;
  const noteW = 220, noteH = 200;
  const x = Math.random() * Math.max(bw - noteW - 40, 40) + 20;
  const y = Math.random() * Math.max(bh - noteH - 40, 40) + 20;
  return { x: Math.round(x), y: Math.round(y) };
}

// ── Render a single note DOM element ──────────────────────────
function renderNote(data) {
  const frag = template.content.cloneNode(true);
  const noteEl = frag.querySelector('.note');

  noteEl.dataset.id = data.id;
  noteEl.classList.add(data.color);
  noteEl.style.left = data.x + 'px';
  noteEl.style.top  = data.y + 'px';

  const textarea = noteEl.querySelector('.note-text');
  textarea.value = data.text;

  noteEl.querySelector('.note-date').textContent = formatDate(data.created);

  // Color picker dots
  noteEl.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('mousedown', e => {
      e.stopPropagation();
      const color = dot.dataset.color;
      COLORS.forEach(c => noteEl.classList.remove(c));
      noteEl.classList.add(color);
      updateNote(data.id, { color });
    });
  });

  // Delete
  noteEl.querySelector('.delete-btn').addEventListener('mousedown', e => {
    e.stopPropagation();
    deleteNote(data.id, noteEl);
  });

  // Save text on input
  textarea.addEventListener('input', () => {
    updateNote(data.id, { text: textarea.value });
  });

  // Prevent drag start when clicking textarea
  textarea.addEventListener('mousedown', e => e.stopPropagation());

  // Drag
  noteEl.addEventListener('mousedown', dragStart(data.id, noteEl));

  board.appendChild(noteEl);
}

// ── CRUD helpers ──────────────────────────────────────────────
function createNote() {
  const pos = randomPos();
  const data = {
    id: Date.now().toString(),
    text: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    x: pos.x,
    y: pos.y,
    created: Date.now(),
  };
  notes.push(data);
  save();
  renderNote(data);
  updateEmptyHint();

  // Auto-focus textarea
  setTimeout(() => {
    const el = board.querySelector(`.note[data-id="${data.id}"] .note-text`);
    if (el) el.focus();
  }, 50);
}

function updateNote(id, changes) {
  const note = notes.find(n => n.id === id);
  if (note) Object.assign(note, changes);
  save();
}

function deleteNote(id, el) {
  el.style.transition = 'transform 0.2s, opacity 0.2s';
  el.style.transform = 'scale(0.6) rotate(8deg)';
  el.style.opacity = '0';
  setTimeout(() => {
    el.remove();
    notes = notes.filter(n => n.id !== id);
    save();
    updateEmptyHint();
  }, 200);
}

// ── Drag logic ────────────────────────────────────────────────
function dragStart(id, el) {
  return function (e) {
    if (e.button !== 0) return;

    // Bring to front
    el.style.zIndex = Date.now();

    const rect = el.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    dragState = {
      id,
      el,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      boardTop: boardRect.top,
      boardLeft: boardRect.left,
    };

    el.classList.add('dragging');
    e.preventDefault();
  };
}

document.addEventListener('mousemove', e => {
  if (!dragState) return;
  const { el, offsetX, offsetY, boardLeft, boardTop } = dragState;
  const x = e.clientX - boardLeft - offsetX;
  const y = e.clientY - boardTop  - offsetY;
  el.style.left = Math.max(0, x) + 'px';
  el.style.top  = Math.max(0, y) + 'px';
});

document.addEventListener('mouseup', e => {
  if (!dragState) return;
  const { id, el } = dragState;
  el.classList.remove('dragging');
  updateNote(id, {
    x: parseInt(el.style.left),
    y: parseInt(el.style.top),
  });
  dragState = null;
});

// ── Empty hint ────────────────────────────────────────────────
function updateEmptyHint() {
  let hint = board.querySelector('.empty-hint');
  if (notes.length === 0) {
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.innerHTML = `<span class="emoji">🌸</span><p>Click "+ New Note" to get started!</p>`;
      board.appendChild(hint);
    }
  } else {
    if (hint) hint.remove();
  }
}

// ── Init ──────────────────────────────────────────────────────
addBtn.addEventListener('click', createNote);

notes = load();
notes.forEach(renderNote);
updateEmptyHint();
