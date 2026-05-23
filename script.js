(function () {
'use strict';

// ── Accessibility panel ──────────────────────────────────
const accBtn    = document.getElementById('accBtn');
const accPanel  = document.getElementById('accPanel');
const darkToggle = document.getElementById('darkToggle');

function applyPrefs() {
  const dark = localStorage.getItem('dark') === '1';
  const size = localStorage.getItem('size') || 'md';
  const font = localStorage.getItem('font') || 'default';
  document.body.classList.toggle('dark-mode', dark);
  darkToggle.checked = dark;
  ['sm','md','lg'].forEach(s => document.body.classList.toggle('size-'+s, s===size));
  ['sans','serif','mono'].forEach(f => document.body.classList.toggle('font-'+f, f===font && f!=='default'));
  document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size===size));
  document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font===font));
}

applyPrefs();
accBtn.addEventListener('click', e => { e.stopPropagation(); accPanel.classList.toggle('open'); });
document.addEventListener('click', e => { if (!accPanel.contains(e.target) && e.target !== accBtn) accPanel.classList.remove('open'); });
darkToggle.addEventListener('change', () => { localStorage.setItem('dark', darkToggle.checked ? '1' : '0'); applyPrefs(); });
document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('size', b.dataset.size); applyPrefs(); }));
document.querySelectorAll('[data-font]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('font', b.dataset.font); applyPrefs(); }));

// ── Page-specific JS goes below ──────────────────────────

})();
