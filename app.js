import { dict } from './i18n.js';
import { services, barbers, nextDays, slotsForDate, CURRENCY } from './data.js';

/* ============================================================
   State
   ============================================================ */
const state = {
  lang: localStorage.getItem('lang') || 'en',
  step: 1,
  serviceIds: [],   // multi-select
  barberId: null,
  date: null,       // ISO yyyy-mm-dd
  time: null,       // 'HH:MM'
  name: '',
  phone: '',
  notes: '',
};

/* ============================================================
   i18n
   ============================================================ */
function t(key) {
  return dict[state.lang][key] ?? key;
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir  = state.lang === 'ar' ? 'rtl' : 'ltr';

  // Toggle pill: which side is active
  document.querySelectorAll('.lang-toggle [data-lang]').forEach(el => {
    el.dataset.active = el.dataset.lang === state.lang ? 'true' : 'false';
  });

  // text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (Array.isArray(val)) return; // arrays consumed by JS, not directly
    el.textContent = val;
  });

  // placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });

  // re-render dynamic UI that depends on lang
  renderServices();
  renderBarbers();
  renderChoiceGrids();
  renderDateStrip();
  renderTimeGrid();
  renderSummary();
  renderMine();
  localStorage.setItem('lang', state.lang);
}

function setLanguage(lang) {
  if (state.lang === lang) return;
  document.body.classList.add('lang-fading');
  setTimeout(() => {
    state.lang = lang;
    applyLanguage();
    requestAnimationFrame(() => {
      document.body.classList.remove('lang-fading');
    });
  }, 200);
}

/* ============================================================
   Helpers
   ============================================================ */
function formatPrice(amount) {
  return `${amount} ${t('currency')}`;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseIso(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}

function formatDateLong(iso) {
  if (!iso) return '—';
  const d = parseIso(iso);
  const days   = dict[state.lang]['days.short'];
  const months = dict[state.lang]['months.short'];
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`;
}

/* ============================================================
   Sections — Services preview (the tasting-menu list)
   ============================================================ */
function renderServices() {
  const root = document.getElementById('services-list');
  if (!root) return;
  root.innerHTML = services.map((s, i) => `
    <div class="service-row">
      <span class="service-row__no">${String(i+1).padStart(2,'0')}</span>
      <span class="service-row__name">${t(`${s.i18n}.name`)}</span>
      <span class="service-row__desc">${t(`${s.i18n}.desc`)}</span>
      <span class="service-row__meta">${s.durationMin} ${t('min')}</span>
      <span class="service-row__price">${formatPrice(s.price)}</span>
    </div>
  `).join('');
}

function renderBarbers() {
  const root = document.getElementById('barbers-list');
  if (!root) return;
  root.innerHTML = barbers.map((b, i) => `
    <div class="barber">
      <div class="barber__no">${String(i+1).padStart(2,'0')} / ${String(barbers.length).padStart(2,'0')}</div>
      <div class="barber__name">${t(`${b.i18n}.name`)}</div>
      <div class="barber__role">${t(`${b.i18n}.role`)}</div>
    </div>
  `).join('');
}

/* ============================================================
   Booking flow
   ============================================================ */
function renderChoiceGrids() {
  // Step 1 — services (tasting-menu rows)
  const sRoot = document.getElementById('choice-services');
  if (sRoot) {
    sRoot.innerHTML = services.map((s, i) => `
      <button class="row" type="button" data-service="${s.id}" aria-pressed="${state.serviceIds.includes(s.id)}">
        <span class="row__no">${String(i+1).padStart(2,'0')}</span>
        <span class="row__name">${t(`${s.i18n}.name`)}</span>
        <span class="row__meta">${s.durationMin} ${t('min')}</span>
        <span class="row__price">${formatPrice(s.price)}</span>
      </button>
    `).join('');
    sRoot.querySelectorAll('[data-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.service;
        const i  = state.serviceIds.indexOf(id);
        if (i >= 0) state.serviceIds.splice(i, 1);
        else state.serviceIds.push(id);
        sRoot.querySelectorAll('[data-service]').forEach(b => {
          b.setAttribute('aria-pressed', state.serviceIds.includes(b.dataset.service));
        });
        updateChapters();
        updateNextButton();
      });
    });
  }
  // Step 2 — barbers (same row style)
  const bRoot = document.getElementById('choice-barbers');
  if (bRoot) {
    bRoot.innerHTML = barbers.map((b, i) => `
      <button class="row" type="button" data-barber="${b.id}" aria-pressed="${state.barberId===b.id}">
        <span class="row__no">${String(i+1).padStart(2,'0')}</span>
        <span class="row__name">${t(`${b.i18n}.name`)}</span>
        <span class="row__meta">${t(`${b.i18n}.role`)}</span>
      </button>
    `).join('');
    bRoot.querySelectorAll('[data-barber]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.barberId = btn.dataset.barber;
        bRoot.querySelectorAll('[data-barber]').forEach(b => {
          b.setAttribute('aria-pressed', b.dataset.barber === state.barberId);
        });
        updateChapters();
        updateNextButton();
        goStep(3);
      });
    });
  }
}

/* Update the table-of-contents "chapter" list with the current picks */
function updateChapters() {
  const selected = state.serviceIds.map(id => services.find(s => s.id === id)).filter(Boolean);
  const total    = selected.reduce((sum, s) => sum + s.price, 0);
  const brb      = barbers.find(b => b.id === state.barberId);
  const setSlot  = (key, val) => {
    document.querySelectorAll(`[data-slot="${key}"]`).forEach(el => el.textContent = val);
  };
  const serviceLabel =
    selected.length === 0 ? '—' :
    selected.length === 1 ? t(`${selected[0].i18n}.name`) :
                            `${selected.length} ${t('services.multi')}`;
  setSlot('service',  serviceLabel);
  setSlot('barber',   brb ? t(`${brb.i18n}.name`) : '—');
  setSlot('datetime', (state.date && state.time) ? `${formatDateLong(state.date)} · ${state.time}` : (state.date ? formatDateLong(state.date) : '—'));
  setSlot('details',  state.name ? state.name : '—');
  setSlot('total',    total > 0 ? formatPrice(total) : '—');
}

/* Sync the Continue button's enabled state to the current step's validation. */
function updateNextButton() {
  const btn = document.getElementById('step-next');
  if (!btn) return;
  btn.disabled = !validateStep(/*silent*/ true);
  btn.dataset.disabled = btn.disabled ? 'true' : 'false';
}

function renderDateStrip() {
  const root = document.getElementById('date-strip');
  if (!root) return;
  const days   = dict[state.lang]['days.short'];
  const months = dict[state.lang]['months.short'];
  const dates = nextDays(60);
  root.innerHTML = dates.map(d => {
    const iso = isoDate(d);
    const selected = state.date === iso;
    return `
      <button class="date-pill" type="button" data-date="${iso}" data-month="${d.getMonth()}" aria-pressed="${selected}">
        <div class="date-pill__day">${days[d.getDay()]}</div>
        <div class="date-pill__num">${d.getDate()}</div>
        <div class="date-pill__month">${months[d.getMonth()]}</div>
      </button>
    `;
  }).join('');
  root.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.date = btn.dataset.date;
      state.time = null;
      root.querySelectorAll('[data-date]').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.date === state.date);
      });
      renderTimeGrid();
      updateChapters();
      updateNextButton();
    });
  });
  wireDateNav();
  updateMonthLabel();
}

/* Date-strip navigation: arrow buttons + month label updates on scroll */
function wireDateNav() {
  const strip = document.getElementById('date-strip');
  const prev  = document.getElementById('date-prev');
  const next  = document.getElementById('date-next');
  if (!strip || !prev || !next) return;
  // Scroll by ~7 pills worth at a time. In RTL, the browser handles inversion.
  const pageScroll = (dir) => {
    const pill = strip.querySelector('.date-pill');
    const step = pill ? pill.offsetWidth * 7 : strip.clientWidth * 0.8;
    strip.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  // Avoid double-binding when re-rendered
  prev.onclick = () => pageScroll(-1);
  next.onclick = () => pageScroll(1);
  strip.onscroll = () => updateMonthLabel();
}

function updateMonthLabel() {
  const strip = document.getElementById('date-strip');
  const label = document.getElementById('date-month');
  if (!strip || !label) return;
  const months = dict[state.lang]['months.short'];
  const pills = strip.querySelectorAll('.date-pill');
  if (!pills.length) return;
  const stripRect = strip.getBoundingClientRect();
  // Find the first pill that is visibly inside the strip's viewport
  let firstVisible = pills[0];
  for (const p of pills) {
    const r = p.getBoundingClientRect();
    if (r.right > stripRect.left + 8 && r.left < stripRect.right - 8) {
      firstVisible = p;
      break;
    }
  }
  // Also look at the last pill that's still inside the viewport, to show a range when it spans two months
  let lastVisible = firstVisible;
  for (const p of pills) {
    const r = p.getBoundingClientRect();
    if (r.left < stripRect.right - 8 && r.right > stripRect.left + 8) {
      lastVisible = p;
    }
  }
  const m1 = Number(firstVisible.dataset.month);
  const m2 = Number(lastVisible.dataset.month);
  label.textContent = (m1 === m2) ? months[m1] : `${months[m1]} / ${months[m2]}`;
}

function renderTimeGrid() {
  const root = document.getElementById('time-sections');
  if (!root) return;
  if (!state.date) {
    root.innerHTML = '';
    return;
  }
  const d = parseIso(state.date);
  const slots = slotsForDate(d);

  const periods = [
    { key: 'morning',   label: t('time.morning'),   match: s => parseInt(s.time, 10) < 12 },
    { key: 'afternoon', label: t('time.afternoon'), match: s => { const h = parseInt(s.time, 10); return h >= 12 && h < 18; } },
    { key: 'evening',   label: t('time.evening'),   match: s => parseInt(s.time, 10) >= 18 },
  ];

  root.innerHTML = periods.map(p => {
    const ps = slots.filter(p.match);
    if (!ps.length) return '';
    return `
      <div class="time-period">
        <div class="time-period__label">${p.label}</div>
        <div class="time-grid">
          ${ps.map(s => `
            <button class="time-slot" type="button"
                    data-time="${s.time}"
                    aria-pressed="${state.time===s.time}"
                    ${s.disabled ? 'disabled' : ''}>${s.time}</button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  root.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      state.time = btn.dataset.time;
      root.querySelectorAll('[data-time]').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.time === state.time);
      });
      updateChapters();
      updateNextButton();
    });
  });
}

/* Step 4 — review summary (the chapters sidebar shows live state; this is a backstop) */
function renderSummary() {
  const root = document.getElementById('summary');
  if (!root || root.hidden) return;
  const svc = services.find(s => s.id === state.serviceId);
  const brb = barbers.find(b  => b.id === state.barberId);
  const rows = [
    ['summary.service',  svc ? t(`${svc.i18n}.name`)  : '—'],
    ['summary.barber',   brb ? t(`${brb.i18n}.name`)  : '—'],
    ['summary.date',     formatDateLong(state.date)],
    ['summary.time',     state.time ?? '—'],
    ['summary.duration', svc ? `${svc.durationMin} ${t('min')}` : '—'],
    ['summary.price',    svc ? formatPrice(svc.price)           : '—'],
  ];
  root.innerHTML = rows.map(([k,v]) => `
    <div class="summary__row">
      <span class="summary__k">${t(k)}</span>
      <span class="summary__v">${v}</span>
    </div>
  `).join('');
}

/* ============================================================
   Step navigation
   ============================================================ */
function goStep(n) {
  const nextBtn = document.getElementById('step-next');
  if (!nextBtn) return;  // not on the booking page
  state.step = n;
  document.querySelectorAll('.step').forEach(el => {
    el.dataset.active = el.dataset.step === String(n) ? 'true' : 'false';
  });
  document.querySelectorAll('.chapter').forEach(li => {
    li.dataset.active = li.dataset.step === String(n) ? 'true' : 'false';
  });
  const back = document.getElementById('step-back');
  if (back) back.dataset.visible = n > 1 ? 'true' : 'false';

  // Step 2 (barber) still auto-advances on tap. Step 1 (services) now
  // requires Continue since users can pick multiple services.
  nextBtn.style.display = (n === 2) ? 'none' : 'inline-flex';
  nextBtn.dataset.i18n  = (n === 4) ? 'btn.confirm' : 'btn.next';
  nextBtn.querySelector('.btn-label').textContent = t(nextBtn.dataset.i18n);

  if (n === 3) {
    if (!state.date) state.date = isoDate(nextDays(1)[0]);
    renderDateStrip();
    renderTimeGrid();
  }
  if (n === 4) renderSummary();
  updateChapters();
  updateNextButton();
}

function validateStep(silent = false) {
  if (state.step === 1) return state.serviceIds.length > 0;
  if (state.step === 2) return !!state.barberId;
  if (state.step === 3) return !!(state.date && state.time);
  if (state.step === 4) {
    const nameField  = document.querySelector('[data-field="name"]');
    const phoneField = document.querySelector('[data-field="phone"]');
    if (!nameField || !phoneField) return false;
    const name  = nameField.querySelector('input').value.trim();
    const phone = phoneField.querySelector('input').value.trim();
    const phoneOk = /^[+\d][\d\s-]{7,15}$/.test(phone);
    if (!silent) {
      nameField.dataset.invalid  = name  ? 'false' : 'true';
      phoneField.dataset.invalid = phoneOk ? 'false' : 'true';
    }
    state.name  = name;
    state.phone = phone;
    state.notes = document.querySelector('[data-field="notes"] textarea').value.trim();
    return name && phoneOk;
  }
  return true;
}

/* ============================================================
   Submission — Firebase swap-in point
   ============================================================ */
async function submitBooking(booking) {
  // === FIREBASE INTEGRATION POINT =========================
  // Replace this localStorage block with Firestore later, e.g.:
  //
  //   import { db } from './firebase.js';
  //   import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  //   const ref = await addDoc(collection(db, 'bookings'), {
  //     ...booking,
  //     createdAt: serverTimestamp(),
  //   });
  //   return ref.id;
  //
  // Everything outside this function stays the same.
  // ========================================================

  const all = JSON.parse(localStorage.getItem('bookings') || '[]');
  const id  = 'BK-' + Date.now().toString(36).toUpperCase();
  all.push({ ...booking, id, createdAt: new Date().toISOString() });
  localStorage.setItem('bookings', JSON.stringify(all));
  return id;
}

async function handleConfirm() {
  if (!validateStep()) return;
  const nextBtn = document.getElementById('step-next');
  const label   = nextBtn.querySelector('.btn-label');
  const arrow   = nextBtn.querySelector('.arrow');
  const prev    = label.textContent;
  nextBtn.disabled = true;
  nextBtn.dataset.loading = 'true';
  label.textContent = t('btn.loading');
  if (arrow) arrow.textContent = '·';

  try {
    const id = await submitBooking({
      serviceIds: state.serviceIds.slice(),
      barberId:   state.barberId,
      date:       state.date,
      time:       state.time,
      name:       state.name,
      phone:      state.phone,
      notes:      state.notes,
    });
    showConfirmation(id);
    renderMine();
  } finally {
    nextBtn.disabled = false;
    nextBtn.dataset.loading = 'false';
    label.textContent = prev;
    if (arrow) arrow.textContent = '→';
  }
}

/* ============================================================
   Confirmation view
   ============================================================ */
function showConfirmation(id) {
  document.querySelectorAll('.step').forEach(el => el.dataset.active = 'false');
  document.getElementById('confirm-id-v').textContent = id;
  document.getElementById('confirm').dataset.active = 'true';
  const stepNav = document.querySelector('.step-nav');
  if (stepNav) stepNav.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFlow() {
  state.step = 1;
  state.serviceIds = [];
  state.barberId  = null;
  state.date = null;
  state.time = null;
  state.name = '';
  state.phone = '';
  state.notes = '';
  document.querySelectorAll('[data-field] input, [data-field] textarea').forEach(el => el.value = '');
  document.querySelectorAll('[data-field]').forEach(el => el.dataset.invalid = 'false');
  document.getElementById('confirm').dataset.active = 'false';
  const stepNav = document.querySelector('.step-nav');
  if (stepNav) stepNav.style.display = '';
  renderChoiceGrids();
  renderDateStrip();
  renderTimeGrid();
  renderSummary();
  goStep(1);
}

/* ============================================================
   "My Bookings"
   ============================================================ */
function renderMine() {
  const root = document.getElementById('mine-list');
  if (!root) return;
  const all = JSON.parse(localStorage.getItem('bookings') || '[]');
  const pageFoot = root.closest('.shell')?.querySelector('.page-foot');
  if (pageFoot) pageFoot.hidden = all.length === 0;
  if (all.length === 0) {
    root.innerHTML = `
      <div class="mine-empty">
        <span class="mine-empty__no">—</span>
        <h2 class="mine-empty__title">${t('mine.empty.title')}</h2>
        <p class="mine-empty__sub">${t('mine.empty.sub')}</p>
        <a class="btn-primary" href="book.html">
          <span>${t('hero.cta')}</span>
          <span class="arrow" aria-hidden="true">→</span>
        </a>
      </div>`;
    return;
  }
  root.innerHTML = all.slice().reverse().map(b => {
    // Tolerate both shapes: new bookings have serviceIds[], old ones had serviceId
    const ids = Array.isArray(b.serviceIds) ? b.serviceIds : (b.serviceId ? [b.serviceId] : []);
    const svcs = ids.map(id => services.find(s => s.id === id)).filter(Boolean);
    const serviceLabel =
      svcs.length === 0 ? '—' :
      svcs.length === 1 ? t(`${svcs[0].i18n}.name`) :
                          `${svcs.length} ${t('services.multi')}`;
    const brb = barbers.find(x => x.id === b.barberId);
    return `
      <div class="mine-row" data-id="${b.id}">
        <span class="mine-row__id">${b.id}</span>
        <span class="mine-row__name">${serviceLabel}</span>
        <span class="mine-row__meta">${brb ? t(`${brb.i18n}.name`) : '—'}</span>
        <span class="mine-row__meta">${formatDateLong(b.date)} · ${b.time}</span>
        <div class="mine-row__actions">
          <button class="mine-row__cancel" data-cancel="${b.id}">${t('mine.cancel')}</button>
          <button class="mine-row__keep" data-keep="${b.id}" hidden>${t('mine.keep')}</button>
        </div>
      </div>
    `;
  }).join('');

  // Two-stage cancel: first click → ask; second click within 5s → delete; "Keep it" → revert.
  root.querySelectorAll('[data-cancel]').forEach(btn => {
    let pending = false;
    let timer = null;
    const id    = btn.dataset.cancel;
    const row   = btn.closest('.mine-row');
    const keep  = row.querySelector(`[data-keep="${id}"]`);
    const revert = () => {
      pending = false;
      btn.textContent = t('mine.cancel');
      btn.classList.remove('is-danger');
      keep.hidden = true;
      clearTimeout(timer);
    };
    btn.addEventListener('click', () => {
      if (!pending) {
        pending = true;
        btn.textContent = t('mine.cancel.confirm');
        btn.classList.add('is-danger');
        keep.hidden = false;
        // auto-revert after 5s so it doesn't sit there forever
        timer = setTimeout(revert, 5000);
        return;
      }
      const next = JSON.parse(localStorage.getItem('bookings') || '[]').filter(b => b.id !== id);
      localStorage.setItem('bookings', JSON.stringify(next));
      renderMine();
    });
    keep.addEventListener('click', revert);
  });
}

/* ============================================================
   Wire up
   ============================================================ */
function highlightActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.dataset.active = a.dataset.nav === page ? 'true' : 'false';
  });
}

function wire() {
  // Language toggle — present on every page
  document.querySelectorAll('.lang-toggle [data-lang]').forEach(el => {
    el.addEventListener('click', () => setLanguage(el.dataset.lang));
  });

  // Booking-page-only wiring — bail if not on book.html
  const backBtn = document.getElementById('step-back');
  const nextBtn = document.getElementById('step-next');
  if (backBtn && nextBtn) {
    backBtn.addEventListener('click', () => {
      if (state.step > 1) goStep(state.step - 1);
    });
    nextBtn.addEventListener('click', () => {
      if (nextBtn.disabled) return;
      if (state.step === 4) { handleConfirm(); return; }
      if (!validateStep()) return;
      goStep(state.step + 1);
    });
  }

  const bookAgain = document.getElementById('confirm-book-again');
  if (bookAgain) bookAgain.addEventListener('click', resetFlow);

  // Live-update the chapters sidebar as the name is typed
  const nameInput  = document.querySelector('[data-field="name"] input');
  const phoneInput = document.querySelector('[data-field="phone"] input');
  if (nameInput) nameInput.addEventListener('input', () => {
    state.name = nameInput.value.trim();
    updateChapters();
    updateNextButton();
  });
  if (phoneInput) phoneInput.addEventListener('input', () => {
    state.phone = phoneInput.value.trim();
    updateNextButton();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  highlightActiveNav();
  wire();
  applyLanguage();
  if (document.getElementById('step-next')) goStep(1);
});
