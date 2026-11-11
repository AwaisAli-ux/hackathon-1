import { calculate, fstr } from './calc.js';
import { STR } from './i18n.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const REL_TO_KEY = { daughter: 'daughters', wife: 'wives', mother: 'mother', sister: 'sisters', son: 'sons', husband: 'husband', father: 'father', brother: 'brothers' };
const money = (n) => Number(n).toLocaleString('en-PK');
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

// ---------- Language ----------
let lang = root.lang === 'en' ? 'en' : 'ur';
const t = (key) => STR[lang][key] ?? STR.en[key] ?? key;
let last = null; // last calculation: { input, relation }

function applyLang() {
  root.lang = lang;
  root.dir = lang === 'ur' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); el.title = t(el.dataset.i18nAria); });
  $('langBtnText').textContent = lang === 'ur' ? 'English' : 'اردو';
  $('parseStatus').textContent = '';
  $('scopeNote').hidden = true;
  $('calcError').hidden = true;
  if (!SR) $('micBtn').title = t('micUnsupported');
  buildTagline();
  buildExamples();
  if (last) showResult();
}

// Example stories: one click fills the story and asks AI to fill the form.
function buildExamples() {
  const box = $('examples');
  box.replaceChildren();
  for (const ex of t('examples')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip ex button-sm';
    b.textContent = ex.label;
    b.addEventListener('click', () => { $('story').value = ex.story; $('parseBtn').click(); });
    box.append(b);
  }
}

$('langBtn').addEventListener('click', () => {
  if (rec) rec.stop();
  lang = lang === 'ur' ? 'en' : 'ur';
  store.set('ws-lang', lang);
  applyLang();
});

// ---------- Theme ----------
const isDark = () => {
  const set = root.getAttribute('data-theme');
  return set ? set === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};
const syncThemeIcon = () => { $('themeIcon').className = isDark() ? 'ph ph-sun' : 'ph ph-moon'; };
$('themeBtn').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  store.set('ws-theme', next);
  $('themeBtn').classList.toggle('spin');
  syncThemeIcon();
});
syncThemeIcon();

// ---------- Scroll reveals ----------
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ---------- Tagline: words light up one by one on scroll ----------
function buildTagline() {
  const el = $('tagline');
  el.replaceChildren();
  for (const line of t('tagline').split('\n')) {
    const span = document.createElement('span');
    span.className = 'line';
    line.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = word;
      span.append(w, i < arr.length - 1 ? ' ' : '');
    });
    el.append(span);
  }
  paintTagline();
}
function paintTagline() {
  const el = $('tagline');
  const words = el.querySelectorAll('.w');
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  // 0 when the block's top reaches 85% of the viewport, 1 when its bottom reaches 45%.
  const progress = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (rect.height + vh * 0.4)));
  const on = Math.round(progress * words.length);
  words.forEach((w, i) => w.classList.toggle('on', i < on));
}
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { paintTagline(); ticking = false; });
}, { passive: true });

// ---------- Form: husband for a woman, wives for a man ----------
const gender = () => document.querySelector('input[name="gender"]:checked').value;
function syncGender() {
  const female = gender() === 'female';
  $('husbandWrap').hidden = !female;
  $('wivesWrap').hidden = female;
}
document.querySelectorAll('input[name="gender"]').forEach((r) => r.addEventListener('change', syncGender));
syncGender();

// ---------- Voice input (browser speech recognition) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function setMic(live) {
  $('micBtn').classList.toggle('live', live);
  $('micIcon').className = live ? 'ph ph-stop' : 'ph ph-microphone';
  $('micText').dataset.i18n = live ? 'micStop' : 'mic';
  $('micText').textContent = t(live ? 'micStop' : 'mic');
}
if (!SR) {
  $('micBtn').disabled = true;
} else {
  $('micBtn').addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = lang === 'ur' ? 'ur-PK' : 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    const base = $('story').value.trim();
    rec.onresult = (e) => {
      let text = '';
      for (const r of e.results) text += r[0].transcript + ' ';
      $('story').value = (base ? base + ' ' : '') + text.trim();
    };
    rec.onerror = () => { $('parseStatus').textContent = t('micError'); };
    rec.onend = () => { rec = null; setMic(false); if ($('parseStatus').textContent === t('listening')) $('parseStatus').textContent = ''; };
    rec.start();
    setMic(true);
    $('parseStatus').textContent = t('listening');
  });
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'request failed');
  return data;
}

// ---------- Step 1: Gemini turns the story into form values ----------
$('parseBtn').addEventListener('click', async () => {
  const text = $('story').value.trim();
  if (!text) { $('parseStatus').textContent = t('needStory'); return; }
  $('parseBtn').disabled = true;
  $('parseStatus').textContent = t('parsing');
  $('scopeNote').hidden = true;
  try {
    const f = await post('/api/parse', { text, lang });
    document.querySelector(`input[name="gender"][value="${f.deceasedGender === 'female' ? 'female' : 'male'}"]`).checked = true;
    syncGender();
    $('husband').checked = !!f.husband;
    $('wives').value = f.wives || 0;
    $('sons').value = f.sons || 0;
    $('daughters').value = f.daughters || 0;
    $('brothers').value = f.brothers || 0;
    $('sisters').value = f.sisters || 0;
    $('father').checked = !!f.father;
    $('mother').checked = !!f.mother;
    $('estate').value = f.estate || '';
    if (f.userRelation) $('relation').value = f.userRelation;
    if (f.outOfScope) {
      $('scopeNote').textContent = t('scopePre') + f.outOfScope + t('scopePost');
      $('scopeNote').hidden = false;
    }
    $('parseStatus').textContent = t('parsed');
  } catch (err) {
    $('parseStatus').textContent = t('parseFail');
    console.error(err);
  } finally {
    $('parseBtn').disabled = false;
  }
});

// ---------- Steps 2 and 3: deterministic calculation ----------
function readForm() {
  return {
    deceasedGender: gender(),
    husband: $('husband').checked,
    wives: $('wives').value,
    sons: $('sons').value,
    daughters: $('daughters').value,
    brothers: $('brothers').value,
    sisters: $('sisters').value,
    father: $('father').checked,
    mother: $('mother').checked,
    estate: $('estate').value,
  };
}

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// Plus and minus buttons around each count field.
for (const id of ['wives', 'sons', 'daughters', 'brothers', 'sisters']) {
  const input = $(id);
  const wrap = el('div', 'stepper');
  const make = (icon, delta, labelKey) => {
    const b = el('button');
    b.type = 'button';
    b.dataset.i18nAria = labelKey;
    b.append(el('i', `ph ph-${icon}`));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const max = input.max ? Number(input.max) : 99;
      input.value = Math.min(max, Math.max(0, (Number(input.value) || 0) + delta));
      input.classList.remove('bump');
      void input.offsetWidth; // restart the animation
      input.classList.add('bump');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return b;
  };
  input.replaceWith(wrap);
  wrap.append(make('minus', -1, 'less'), input, make('plus', 1, 'more'));
}

$('calcBtn').addEventListener('click', () => {
  last = { input: readForm(), relation: $('relation').value };
  if (showResult()) {
    $('mine').classList.remove('pop');
    void $('mine').offsetWidth;
    $('mine').classList.add('pop');
    $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// After the first calculation, the result follows the form live.
$('calcBtn').closest('.card').addEventListener('input', () => {
  if (!last) return;
  last = { input: readForm(), relation: $('relation').value };
  showResult(true);
});

let explainTimer = null;
function showResult(live = false) {
  const result = calculate(last.input, lang);
  $('calcError').hidden = result.ok;
  if (!result.ok) {
    $('calcError').textContent = result.error;
    $('resultCard').hidden = true;
    $('aiCard').hidden = true;
    last = null;
    return false;
  }
  const { relation } = last;
  const mineKey = REL_TO_KEY[relation];
  const mineRow = result.rows.find((r) => r.key === mineKey);

  // "Your share" card
  const mine = $('mine');
  mine.replaceChildren();
  if (mineRow) {
    if (mineRow.blocked || mineRow.each.n === 0) {
      mine.append(el('div', 'title-3', t('noShare')), el('div', 'big num', '0'));
    } else {
      mine.append(el('div', 'title-3', t('yourShare')), el('div', 'big num', `${fstr(mineRow.each)} = ${mineRow.percentEach}%`));
      if (mineRow.amountEach != null) mine.append(el('div', 'body-3', `${t('about')} ${money(mineRow.amountEach)} ${t('rupees')}`));
    }
  }
  mine.hidden = !mineRow;

  // Animated bars: one per heir group, reused between updates so they glide to the new size.
  const bars = $('bars');
  const seen = new Set();
  for (const r of result.rows) {
    seen.add(r.key);
    let row = bars.querySelector(`[data-key="${r.key}"]`);
    if (!row) {
      row = el('div', 'bar-row');
      row.dataset.key = r.key;
      const track = el('div', 'bar-track');
      track.append(el('div', 'bar-fill'));
      row.append(el('span', 'bar-label body-5'), track, el('span', 'bar-pct num caption-1'));
    }
    bars.append(row);
    row.classList.toggle('me', r.key === mineKey);
    row.children[0].textContent = r.count > 1 ? `${r.label} (${r.count})` : r.label;
    row.children[2].textContent = Math.round((r.total.n / r.total.d) * 10000) / 100 + '%';
    const fill = row.querySelector('.bar-fill');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      row.classList.add('in');
      fill.style.transform = `scaleX(${r.total.n / r.total.d})`;
    }));
  }
  bars.querySelectorAll('.bar-row').forEach((x) => { if (!seen.has(x.dataset.key)) x.remove(); });

  // Table and reasons
  const tbody = $('rows'); tbody.replaceChildren();
  const reasons = $('reasons'); reasons.replaceChildren();
  for (const r of result.rows) {
    const tr = document.createElement('tr');
    if (r.key === mineKey) tr.classList.add('me');
    if (r.blocked) tr.classList.add('blocked');
    tr.append(
      el('td', '', r.label),
      el('td', 'num', String(r.count)),
      el('td', 'num', fstr(r.each)),
      el('td', 'num', r.percentEach + '%'),
      el('td', 'num', r.amountEach != null ? money(r.amountEach) : '·'),
    );
    tbody.append(tr);
    reasons.append(el('li', '', `${r.label}: ${r.reason}`));
  }

  const notes = [];
  if (result.unallocated.n > 0) notes.push(t('unallocA') + fstr(result.unallocated) + t('unallocB'));
  if (!mineRow && relation !== 'other') notes.push(t('relMissing'));
  $('flagNote').textContent = notes.join(' ');
  $('flagNote').hidden = notes.length === 0;

  $('resultCard').hidden = false;
  clearTimeout(explainTimer);
  if (live) {
    // Wait until the user stops changing the form before asking AI again.
    explainRun++;
    $('aiCard').hidden = false;
    $('aiBody').hidden = true;
    $('aiLoading').hidden = false;
    explainTimer = setTimeout(() => explain(result, relation, mineRow), 1200);
  } else {
    explain(result, relation, mineRow);
  }
  return true;
}

// ---------- Step 4: Gemini explains the already calculated result ----------
let explainRun = 0;
async function explain(result, relation, mineRow) {
  const run = ++explainRun;
  const askedIn = lang;
  $('aiCard').hidden = false;
  $('aiBody').hidden = true;
  $('aiLoading').hidden = false;
  const payload = {
    outputLanguage: lang === 'ur' ? 'Urdu' : 'English',
    userRelation: relation,
    deceasedGender: result.input.deceasedGender,
    estateRupees: result.estate,
    heirs: result.rows.map((r) => ({
      heir: r.label, key: r.key, count: r.count, shareEach: fstr(r.each), percentEach: r.percentEach,
      amountEachRupees: r.amountEach, getsNothing: r.blocked || r.each.n === 0, reason: r.reason,
    })),
    unallocatedShare: result.unallocated.n > 0 ? fstr(result.unallocated) : null,
  };
  let out, fromAI = true;
  try {
    out = await post('/api/explain', payload);
  } catch (err) {
    console.error(err);
    fromAI = false;
    const has = mineRow && mineRow.each.n > 0;
    const share = has
      ? `${t('fbShareA')}${fstr(mineRow.each)} (${mineRow.percentEach}%)${t('fbShareB')}${mineRow.amountEach != null ? `${t('fbAmt')}${money(mineRow.amountEach)} ${t('rupees')}` : ''}.`
      : t('fbGeneric');
    out = {
      explanation: share + t('fbReasons'),
      steps: t('fallbackSteps'),
      draft: STR[lang].fbDraft(has ? fstr(mineRow.each) : '______'),
    };
  }
  if (run !== explainRun || askedIn !== lang) return;
  $('explanation').textContent = out.explanation;
  const ol = $('steps'); ol.replaceChildren();
  for (const s of out.steps || []) ol.append(el('li', '', s));
  $('draft').textContent = out.draft;
  $('aiLabel').textContent = t(fromAI ? 'aiLabel' : 'aiLabelOff');
  $('aiLoading').hidden = true;
  $('aiBody').hidden = false;
}

$('copyBtn').addEventListener('click', async () => {
  let key = 'copied';
  try { await navigator.clipboard.writeText($('draft').textContent); } catch { key = 'copyFail'; }
  $('copyText').textContent = t(key);
  setTimeout(() => { $('copyText').textContent = t('copy'); }, 1500);
});

applyLang();
