import { calculate, splitAssets, deductions, buyout, fstr } from './calc.js';
import { STR } from './i18n.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const REL_TO_KEY = { daughter: 'daughters', wife: 'wives', mother: 'mother', sister: 'sisters', son: 'sons', husband: 'husband', father: 'father', brother: 'brothers' };
const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-PK'); // whole rupees everywhere
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Numbers roll up to their value (eased), so a new result feels alive. Skipped for reduced motion.
function countUp(node, to, format, ms = 900) {
  if (REDUCED() || !Number.isFinite(to)) { node.textContent = format(to); return; }
  const start = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 4);
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    node.textContent = format(p < 1 ? to * ease(p) : to);
    if (p < 1 && node.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Language ----------
const LANGS = ['en', 'ur', 'ro'];
let lang = LANGS.includes(root.dataset.lang) ? root.dataset.lang : 'ur';
const t = (key) => STR[lang]?.[key] ?? STR.en[key] ?? key;
// Language name sent to Gemini so it answers in the same language as the interface.
const aiLang = () => ({ en: 'English', ur: 'Urdu', ro: 'Roman Urdu' })[lang];
let last = null; // last calculation: { input, relation }

function applyLang() {
  root.lang = lang === 'ro' ? 'ur-Latn' : lang;
  root.dataset.lang = lang;
  root.dir = lang === 'ur' ? 'rtl' : 'ltr';
  $('langSel').value = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); el.title = t(el.dataset.i18nAria); });
  $('parseStatus').textContent = '';
  $('scopeNote').hidden = true;
  $('calcError').hidden = true;
  buildTagline();
  buildExamples();
  buildAskQs();
  buildHelp();
  if (last) showResult();
}

// Suggested questions for the chat under the explanation.
function buildAskQs() {
  const box = $('askQs');
  box.replaceChildren();
  for (const q of t('askQs')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip ex button-sm';
    b.textContent = q;
    b.addEventListener('click', () => ask(q));
    box.append(b);
  }
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

$('langSel').addEventListener('change', () => {
  stopRecording(true);
  stopListening();
  lang = LANGS.includes($('langSel').value) ? $('langSel').value : 'ur';
  store.set('ws-lang', lang);
  // A quick cross fade so the switch of script and direction feels smooth.
  document.body.classList.remove('lang-swap'); void document.body.offsetWidth; document.body.classList.add('lang-swap');
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

// ---------- Hero: the example number rolls up once the card has arrived ----------
setTimeout(() => countUp($('exPct'), 17.5, (v) => `${v.toFixed(1)}%`, 1400), 900);

// ---------- Scroll reveals ----------
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
// Cards inside a grid arrive one after another.
document.querySelectorAll('.cards, .faq').forEach((g) => [...g.querySelectorAll('.reveal, .card')].forEach((c, i) => c.style.setProperty('--stagger', `${i * 90}ms`)));

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

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'request failed'); e.status = res.status; throw e; }
  return data;
}
// Why an AI step failed, in words the user can act on.
const aiWhy = (err) => (err.status === 503 ? t('aiNoKey')
  : /\b(400|401|403)\b/.test(err.message) ? t('aiBadKey')
    : /\b429\b/.test(err.message) ? t('aiQuota') : '');

// Is Gemini set up on the server? Decides which voice input to use.
let aiOn = false;
fetch('/api/health').then((r) => r.json()).then((h) => { aiOn = !!h.ai; }).catch(() => {});

// ---------- Voice input ----------
// With Gemini: record a short WAV in the browser, Gemini writes it down (Urdu script, English or Roman Urdu),
// then the story is read into the form. Without Gemini: the browser's own speech recognition (Chrome).
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;          // browser recognition
let recorder = null;     // { stream, ctx, node, chunks, rate, meterRaf }
function setMic(live) {
  $('micBtn').classList.toggle('live', live);
  $('micIcon').className = live ? 'ph ph-stop' : 'ph ph-microphone';
  $('micText').dataset.i18n = live ? 'micStop' : 'mic';
  $('micText').textContent = t(live ? 'micStop' : 'mic');
  $('micMeter').hidden = !live;
}
// Five bars that follow the voice level while recording.
const meter = document.createElement('span');
meter.id = 'micMeter'; meter.className = 'meter'; meter.hidden = true; meter.setAttribute('aria-hidden', 'true');
for (let i = 0; i < 5; i++) meter.append(document.createElement('i'));
$('micBtn').after(meter);

function wavFrom(chunks, inRate, outRate = 16000) {
  // Join, downsample to 16 kHz mono and encode as 16 bit PCM WAV.
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const ratio = inRate / outRate;
  const len = Math.floor(all.length / ratio);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const w = (p, str) => { for (let i = 0; i < str.length; i++) v.setUint8(p + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const x = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Uint8Array(buf);
}
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
  const chunks = [];
  node.onaudioprocess = (e) => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
  src.connect(analyser); src.connect(node); node.connect(ctx.destination);
  recorder = { stream, ctx, node, chunks, rate: ctx.sampleRate, started: Date.now() };
  const data = new Uint8Array(analyser.frequencyBinCount);
  const bars = [...meter.children];
  const draw = () => {
    if (!recorder) return;
    analyser.getByteFrequencyData(data);
    bars.forEach((b, i) => {
      const v = data[2 + i * 6] / 255;
      b.style.transform = `scaleY(${0.25 + v * 0.9})`;
    });
    // Stop by itself after 60 seconds to keep the upload small.
    if (Date.now() - recorder.started > 60000) { stopRecording(); return; }
    recorder.raf = requestAnimationFrame(draw);
  };
  draw();
  setMic(true);
  $('parseStatus').textContent = t('recording');
}

async function stopRecording(discard = false) {
  if (!recorder) return;
  const r = recorder; recorder = null;
  cancelAnimationFrame(r.raf);
  r.node.disconnect(); r.stream.getTracks().forEach((x) => x.stop()); r.ctx.close();
  setMic(false);
  if (discard) { $('parseStatus').textContent = ''; return; }
  if (r.chunks.length < 4) { $('parseStatus').textContent = t('micShort'); return; }
  const wav = wavFrom(r.chunks, r.rate);
  $('micBtn').disabled = true;
  $('parseStatus').textContent = t('transcribing');
  try {
    const out = await post('/api/transcribe', { audio: { mime: 'audio/wav', data: b64(wav) }, lang });
    const base = $('story').value.trim();
    $('story').value = (base ? base + ' ' : '') + out.text;
    $('story').classList.remove('flash'); void $('story').offsetWidth; $('story').classList.add('flash');
    if (out.text) $('parseBtn').click();
    else $('parseStatus').textContent = t('micError');
  } catch (err) {
    console.error(err);
    $('parseStatus').textContent = t('micError') + (aiWhy(err) ? ' ' + aiWhy(err) : '');
  } finally {
    $('micBtn').disabled = false;
  }
}

function browserListen() {
  if (rec) { rec.stop(); return; }
  rec = new SR();
  rec.lang = lang === 'en' ? 'en-US' : 'ur-PK';
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
  $('micMeter').hidden = true;
  $('parseStatus').textContent = t('listening');
}

const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
if (!canRecord && !SR) $('micBtn').disabled = true;
$('micBtn').addEventListener('click', async () => {
  if (recorder) { stopRecording(); return; }
  if (rec) { rec.stop(); return; }
  if (aiOn && canRecord) {
    try { await startRecording(); } catch (err) { console.error(err); $('parseStatus').textContent = t('micDenied'); }
  } else if (SR) {
    browserListen();
  } else {
    $('parseStatus').textContent = t('micUnsupported');
  }
});

// ---------- Photo of a paper: Gemini reads the family details from the picture ----------
function shrinkImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}
$('photoBtn').addEventListener('click', () => $('photoIn').click());
$('photoIn').addEventListener('change', async () => {
  const file = $('photoIn').files[0];
  $('photoIn').value = '';
  if (!file) return;
  let image;
  try { image = await shrinkImage(file); } catch { $('parseStatus').textContent = t('photoBad'); return; }
  let thumb = $('photoThumb');
  if (!thumb) { thumb = document.createElement('img'); thumb.id = 'photoThumb'; thumb.className = 'thumb'; thumb.alt = ''; $('parseStatus').before(thumb); }
  thumb.src = image.preview;
  thumb.classList.add('scan');
  await runParse({ image: { mime: image.mime, data: image.data }, text: $('story').value.trim(), lang }, t('photoReading'));
  thumb.classList.remove('scan');
});

// ---------- Step 1: Gemini turns the story (or a photo) into form values ----------
function fillForm(f) {
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
  // Assets and deductions from the story replace what was entered before.
  $('assetRows').replaceChildren();
  for (const k of ['cash', 'gold', 'house']) $(k).value = f[k] || '';
  $('goldTola').value = f.goldTola || '';
  for (const k of ['funeral', 'debts', 'will']) $(k).value = f[k] || '';
  const listed = (f.cash || 0) + (f.gold || 0) + (f.house || 0);
  if (listed > 0 && f.estate > listed) addAssetRow(false, t('assetRest'), f.estate - listed);
  estateFromAssets = false;
  $('estate').value = f.estate || '';
  syncEstateFromAssets();
  if (f.userRelation) $('relation').value = f.userRelation;
  // Every field that was filled glows briefly, so the user sees what to check.
  document.querySelectorAll('#formCard input, #formCard select').forEach((x) => {
    const filled = x.type === 'checkbox' || x.type === 'radio' ? x.checked : x.value && x.value !== '0';
    x.classList.remove('filled');
    if (filled) { void x.offsetWidth; x.classList.add('filled'); }
  });
}

async function runParse(body, busyText) {
  $('parseBtn').disabled = true; $('photoBtn').disabled = true;
  $('parseStatus').textContent = busyText;
  $('parseStatus').classList.add('busy');
  $('scopeNote').hidden = true;
  try {
    const f = await post('/api/parse', body);
    fillForm(f);
    const notes = [];
    if (f.sourceText) notes.push(t('photoRead') + ' ' + f.sourceText);
    if (f.outOfScope) notes.push(t('scopePre') + f.outOfScope + t('scopePost'));
    $('scopeNote').textContent = notes.join(' ');
    $('scopeNote').hidden = !notes.length;
    $('scopeNote').classList.toggle('info', !f.outOfScope);
    $('parseStatus').textContent = t('parsed');
    // If a result is already on screen, bring it up to date with the new form.
    if (last) { last = { input: readForm(), relation: $('relation').value }; showResult(); }
    else $('formCard').scrollIntoView({ behavior: REDUCED() ? 'auto' : 'smooth', block: 'start' });
  } catch (err) {
    // Say why, so the problem can be fixed: no key, a refused key or quota, or no server / internet.
    const why = aiWhy(err);
    $('parseStatus').textContent = t('parseFail') + (why ? ' ' + why : '');
    console.error(err);
  } finally {
    $('parseBtn').disabled = false; $('photoBtn').disabled = false;
    $('parseStatus').classList.remove('busy');
  }
}

$('parseBtn').addEventListener('click', () => {
  const text = $('story').value.trim();
  if (!text) { $('parseStatus').textContent = t('needStory'); return; }
  runParse({ text, lang }, t('parsing'));
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
    assets: assets(),
    funeral: $('funeral').value,
    debts: $('debts').value,
    will: $('will').value,
  };
}

// ---------- Assets: cash, gold and house have their own fields; others are added as rows ----------
const FIXED_ASSETS = ['cash', 'gold', 'house'];
function assets() {
  const fixed = FIXED_ASSETS.map((kind) => ({
    kind,
    name: '',
    value: Number($(kind).value) || 0,
    tola: kind === 'gold' ? Number($('goldTola').value) || null : null,
  }));
  const others = [...document.querySelectorAll('.asset-row')]
    .map((r) => ({ kind: 'other', name: r.children[0].value.trim(), value: Number(r.children[1].value) || 0 }));
  return [...fixed, ...others].filter((a) => a.value > 0);
}
let estateFromAssets = false; // true while the estate field shows the sum of the assets
function syncEstateFromAssets() {
  const list = assets();
  $('estate').readOnly = list.length > 0;
  if (list.length) {
    $('estate').value = list.reduce((s, a) => s + a.value, 0);
    estateFromAssets = true;
  } else if (estateFromAssets) {
    // All assets were cleared: do not leave their old sum behind as if the user typed it.
    $('estate').value = '';
    estateFromAssets = false;
  }
}
const assetLabel = (a, i) => (a.kind === 'cash' ? t('kCash') : a.kind === 'gold' ? t('kGold') : a.kind === 'house' ? t('kHouse')
  : a.name || `${t('assetOther')} ${i + 1}`);
function addAssetRow(focus = true, nameText = '', valueNum = '') {
  const row = document.createElement('div');
  row.className = 'asset-row';
  const name = document.createElement('input');
  name.type = 'text'; name.className = 'body-3'; name.maxLength = 40;
  name.dataset.i18nPh = 'assetName'; name.placeholder = t('assetName'); name.value = nameText;
  const value = document.createElement('input');
  value.type = 'number'; value.min = '0'; value.className = 'num'; value.inputMode = 'numeric';
  value.dataset.i18nPh = 'assetValue'; value.placeholder = t('assetValue'); value.value = valueNum;
  const del = document.createElement('button');
  del.type = 'button';
  del.dataset.i18nAria = 'remove'; del.setAttribute('aria-label', t('remove')); del.title = t('remove');
  const x = document.createElement('i'); x.className = 'ph ph-x';
  del.append(x);
  del.addEventListener('click', () => {
    row.remove();
    syncEstateFromAssets();
    $('estate').dispatchEvent(new Event('input', { bubbles: true }));
  });
  row.append(name, value, del);
  $('assetRows').append(row);
  if (focus) name.focus();
}
$('addAsset').addEventListener('click', () => addAssetRow());
// Runs before the card's live update listener, so the result always sees the new estate.
for (const id of ['cash', 'gold', 'house', 'assetRows']) $(id).addEventListener('input', syncEstateFromAssets);

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

// ---------- Fairness checker: compare the family's offer with the rightful share ----------
let lastMine = null;
function renderFair() {
  const out = $('fairOut');
  const raw = $('offer').value;
  if (!lastMine || raw === '') { out.hidden = true; return; }
  const offer = Math.max(0, Number(raw) || 0);
  let cls = 'info', text = t('fairNeedEstate');
  if (lastMine.amountEach != null) {
    if (offer >= lastMine.amountEach) { cls = 'ok'; text = t('fairOk'); }
    else {
      cls = 'bad';
      text = STR[lang].fairLess(money(lastMine.amountEach - offer), Math.round((offer / lastMine.amountEach) * 1000) / 10);
    }
  }
  out.className = `fair-out body-3 ${cls}`;
  out.textContent = text;
  out.hidden = false;
}
$('offer').addEventListener('input', renderFair);

// ---------- Family map: a real family tree ----------
// Parents above, brothers and sisters beside them as their children, spouse joined by a
// marriage line, children below. Connector lines are drawn in SVG from the real card
// positions, so the layout works in both directions (English LTR, Urdu RTL) and at any width.
const FEMALE = new Set(['wives', 'mother', 'daughters', 'sisters']);
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

function shareRing(fraction, icon) {
  // Avatar inside a ring that fills to this person's share of the estate.
  const wrap = el('span', 'avatar');
  const svg = svgEl('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true' });
  const C = 2 * Math.PI * 21;
  svg.append(svgEl('circle', { cx: 24, cy: 24, r: 21, class: 'ring-track' }));
  const arc = svgEl('circle', { cx: 24, cy: 24, r: 21, class: 'ring-fill', 'stroke-dasharray': `${C} ${C}`, 'stroke-dashoffset': C });
  arc.dataset.target = String(C * (1 - Math.min(1, Math.max(0, fraction))));
  svg.append(arc);
  wrap.append(svg, el('i', `ph ${icon}`));
  return wrap;
}

let treeObserver = null;
function renderTree(result, mineKey) {
  const tree = $('tree');
  tree.replaceChildren();
  $('treeReason').textContent = t('treeHint');
  $('treeReason').classList.remove('on');
  const by = Object.fromEntries(result.rows.map((r) => [r.key, r]));
  const nodes = {};

  const node = (r) => {
    const none = r.blocked || r.each.n === 0;
    const b = el('button', 'node');
    b.type = 'button';
    b.dataset.key = r.key;
    if (r.key === mineKey) b.classList.add('me');
    if (none) b.classList.add('none');
    b.classList.add(FEMALE.has(r.key) ? 'f' : 'm');
    b.append(shareRing(none ? 0 : r.each.n / r.each.d, none ? 'ph-prohibit' : 'ph-user'));
    const name = el('span', 'node-name body-5', r.label);
    if (r.count > 1) name.append(el('span', 'node-count caption-3 num', `× ${r.count}`));
    b.append(name);
    b.append(el('span', 'node-share num title-3', none ? '0' : fstr(r.each)));
    b.append(el('span', 'node-pct caption-4 num', none ? t('treeNone') : `${r.percentEach}%${r.count > 1 ? ' ' + t('treeEach') : ''}`));
    if (r.key === mineKey) b.append(el('span', 'node-you caption-3', t('you')));
    b.setAttribute('aria-label', `${r.label}: ${fstr(r.each)}`);
    b.addEventListener('click', () => {
      tree.querySelectorAll('.node').forEach((n) => n.classList.remove('sel'));
      b.classList.add('sel');
      const out = $('treeReason');
      out.classList.remove('on'); void out.offsetWidth;
      out.textContent = `${r.label}: ${r.reason}`;
      out.classList.add('on');
      highlightPath(r.key);
    });
    nodes[r.key] = b;
    return b;
  };
  const group = (keys, cls) => {
    const d = el('div', `tree-group ${cls}`);
    for (const k of keys) if (by[k]) d.append(node(by[k]));
    return d;
  };

  const female = result.input.deceasedGender === 'female';
  const dead = el('div', 'node dead');
  dead.append(shareRing(1, 'ph-user-circle'),
    el('span', 'node-name body-5', t(female ? 'deceasedF' : 'deceasedM')),
    el('span', 'node-pct caption-4 num', result.estate ? `${money(result.estate)} ${t('rupees')}` : t('treeEstate')));
  nodes.dead = dead;

  const svg = svgEl('svg', { class: 'tree-lines', 'aria-hidden': 'true' });
  const top = el('div', 'tree-tier');
  top.append(group(['father', 'mother'], 'parents'));
  const mid = el('div', 'tree-tier mid');
  const sibs = group(['brothers', 'sisters'], 'sibs');
  const spouse = group(['husband', 'wives'], 'spouse');
  mid.append(sibs, dead, spouse);
  const bottom = el('div', 'tree-tier');
  bottom.append(group(['sons', 'daughters'], 'kids'));
  tree.append(svg, top, mid, bottom);
  tree.classList.toggle('no-top', !top.querySelector('.node'));
  tree.classList.toggle('no-bottom', !bottom.querySelector('.node'));

  const lines = () => drawTreeLines(tree, svg, nodes, mineKey);
  requestAnimationFrame(lines);
  if (treeObserver) treeObserver.disconnect();
  treeObserver = new ResizeObserver(() => drawTreeLines(tree, svg, nodes, mineKey, true));
  treeObserver.observe(tree);

  // Entrance: the deceased first, then each generation, then the lines draw in.
  const order = [dead, ...top.querySelectorAll('.node'), ...mid.querySelectorAll('.tree-group .node'), ...bottom.querySelectorAll('.node')];
  order.forEach((n, i) => {
    n.style.setProperty('--d', `${120 + i * 90}ms`);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('in')));
  });
  setTimeout(() => {
    tree.querySelectorAll('.ring-fill').forEach((a) => { a.style.strokeDashoffset = a.dataset.target; });
  }, 350);
}

// Elbow path between two points: down, across, down; straight when on one level.
function elbow(a, b, midY) {
  if (Math.abs(a.y - b.y) < 4) return `M${a.x},${a.y} H${b.x}`;
  const m = midY ?? (a.y + b.y) / 2;
  const r = Math.min(10, Math.abs(b.x - a.x) / 2, Math.abs(m - a.y), Math.abs(b.y - m));
  if (Math.abs(b.x - a.x) < 1) return `M${a.x},${a.y} V${b.y}`;
  const dir = b.x > a.x ? 1 : -1;
  return `M${a.x},${a.y} V${m - r} Q${a.x},${m} ${a.x + dir * r},${m} H${b.x - dir * r} Q${b.x},${m} ${b.x},${m + r} V${b.y}`;
}

function drawTreeLines(tree, svg, nodes, mineKey, instant = false) {
  instant = instant || REDUCED();
  const box = tree.getBoundingClientRect();
  if (!box.width) return;
  svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.replaceChildren();
  const P = (n) => { const r = n.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: r.left - box.left + r.width / 2, cy: r.top - box.top + r.height / 2 }; };
  const dead = P(nodes.dead);
  const paths = [];
  const add = (d, to, cls = '') => paths.push({ d, to, cls });
  const parents = ['father', 'mother'].filter((k) => nodes[k]);
  const sibs = ['brothers', 'sisters'].filter((k) => nodes[k]);
  const kids = ['sons', 'daughters'].filter((k) => nodes[k]);

  if (parents.length) {
    // Parents: joined by a marriage line, and a stem down to their children (deceased and siblings).
    const ps = parents.map((k) => P(nodes[k]));
    // The bus runs just under the parents, so it never cuts through the brothers and sisters row.
    const pb = Math.max(...ps.map((p) => p.b));
    const firstBelow = Math.min(dead.t, ...sibs.map((k) => P(nodes[k]).t));
    const busY = pb + (firstBelow - pb) / 2;
    let stem = { x: ps[0].cx, y: ps[0].b };
    if (ps.length === 2) {
      const y = (ps[0].cy + ps[1].cy) / 2;
      const [a, b] = ps[0].cx < ps[1].cx ? ps : [ps[1], ps[0]];
      add(`M${a.r},${y} H${b.l}`, null, 'marriage');
      stem = { x: (a.r + b.l) / 2, y };
    }
    add(elbow(stem, { x: dead.cx, y: dead.t }, busY), 'dead');
    for (const k of sibs) { const s = P(nodes[k]); add(elbow(stem, { x: s.cx, y: s.t }, busY), k); }
    for (const k of parents) paths.push({ d: '', to: k });
  } else {
    // No parent in the form: siblings are linked to the deceased with a dashed line.
    for (const k of sibs) {
      const s = P(nodes[k]);
      const near = Math.abs(s.cy - dead.cy) < 4;
      add(near ? `M${s.cx < dead.cx ? s.r : s.l},${dead.cy} H${s.cx < dead.cx ? dead.l : dead.r}` : elbow({ x: dead.cx, y: dead.t }, { x: s.cx, y: s.b }), k, 'sib');
    }
  }
  for (const k of ['husband', 'wives']) {
    if (!nodes[k]) continue;
    const s = P(nodes[k]);
    const near = Math.abs(s.cy - dead.cy) < 4;
    add(near ? `M${s.cx > dead.cx ? dead.r : dead.l},${dead.cy} H${s.cx > dead.cx ? s.l : s.r}` : elbow({ x: dead.cx, y: dead.b }, { x: s.cx, y: s.t }), k, 'marriage');
  }
  if (kids.length) {
    const ks = kids.map((k) => P(nodes[k]));
    const busY = dead.b + (Math.min(...ks.map((p) => p.t)) - dead.b) / 2;
    kids.forEach((k, i) => add(elbow({ x: dead.cx, y: dead.b }, { x: ks[i].cx, y: ks[i].t }, busY), k));
  }

  for (const p of paths) {
    if (!p.d) continue;
    const path = svgEl('path', { d: p.d, class: `tl ${p.cls}` });
    path.dataset.to = p.to || '';
    if (p.to === mineKey) path.classList.add('mine');
    svg.append(path);
    const len = path.getTotalLength();
    if (!instant) {
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect();
      path.style.transition = `stroke-dashoffset 900ms var(--curve) ${250 + paths.indexOf(p) * 80}ms`;
      path.style.strokeDashoffset = 0;
      setTimeout(() => { path.style.strokeDasharray = ''; path.style.transition = ''; }, 1400 + paths.length * 80);
    }
  }
  if (tree.dataset.sel) highlightPath(tree.dataset.sel);
}

function highlightPath(key) {
  const tree = $('tree');
  tree.dataset.sel = key;
  tree.querySelectorAll('.tl').forEach((p) => p.classList.toggle('hl', p.dataset.to === key));
}

// ---------- Asset split: your share of each asset, and a full table with totals ----------
function renderAssets(split, mineKey, hasShare) {
  const tola = (x) => `${x} ${t('tola')}`;
  // Your own share of each asset, then your total.
  const mineSplit = split && hasShare ? split.rows.find((r) => r.key === mineKey) : null;
  $('assetShares').hidden = !mineSplit;
  $('assetList').replaceChildren();
  if (mineSplit) {
    split.assets.forEach((a, i) => {
      const p = mineSplit.perAsset[i];
      const li = el('li');
      li.append(el('span', '', assetLabel(a, i)),
        el('span', 'num', money(p.each) + (p.tolaEach != null ? ` · ${tola(p.tolaEach)}` : '')));
      $('assetList').append(li);
    });
    const total = el('li', 'total');
    total.append(el('span', '', t('totalLabel')), el('span', 'num', `${money(mineSplit.totalEach)} ${t('rupees')}`));
    $('assetList').append(total);
  }

  // Every heir: one column per asset, a total column, and a total row.
  $('assetTableBox').hidden = !split;
  const head = $('assetHead'); const body = $('assetBody'); const foot = $('assetFoot');
  head.replaceChildren(); body.replaceChildren(); foot.replaceChildren();
  if (!split) return;
  const hr = el('tr');
  hr.append(el('th', '', t('thHeir')), el('th', '', t('thCount')));
  split.assets.forEach((a, i) => hr.append(el('th', '', assetLabel(a, i))));
  hr.append(el('th', 'total', t('totalLabel')));
  head.append(hr);
  for (const r of split.rows) {
    const tr = el('tr');
    if (r.key === mineKey) tr.classList.add('me');
    if (r.blocked) tr.classList.add('blocked');
    tr.append(el('td', '', r.label), el('td', 'num', String(r.count)));
    r.perAsset.forEach((p) => {
      const td = el('td', 'num', money(p.each));
      if (p.tolaEach != null) td.append(el('span', 'sub caption-2', tola(p.tolaEach)));
      tr.append(td);
    });
    tr.append(el('td', 'num total', money(r.totalEach)));
    body.append(tr);
  }
  if (split.unallocated) {
    const tr = el('tr', 'blocked');
    tr.append(el('td', '', t('unallocRow')), el('td', 'num', '·'));
    split.unallocated.perAsset.forEach((v) => tr.append(el('td', 'num', money(v))));
    tr.append(el('td', 'num total', money(split.unallocated.total)));
    body.append(tr);
  }
  const fr = el('tr');
  fr.append(el('td', '', split.factor < 1 ? t('dedNet') : t('estateTotal')), el('td', 'num', '·'));
  split.assets.forEach((a) => {
    const td = el('td', 'num', money(a.value));
    if (a.tola) td.append(el('span', 'sub caption-2', tola(a.tola)));
    fr.append(td);
  });
  fr.append(el('td', 'num total', money(split.estate)));
  foot.append(fr);
}

// ---------- Before division: what was taken out first ----------
function renderDeductions(ded, needEstate) {
  const box = $('dedBox');
  box.hidden = !ded && !needEstate;
  $('dedList').replaceChildren();
  $('dedNote').hidden = true;
  if (needEstate) { $('dedNote').textContent = t('dedNeedEstate'); $('dedNote').hidden = false; return; }
  if (!ded) return;
  const line = (label, value, cls = '') => {
    const li = el('li', cls);
    li.append(el('span', '', label), el('span', 'num', value));
    $('dedList').append(li);
  };
  line(t('dedGross'), money(ded.gross));
  if (ded.funeral) line(t('funeral'), '− ' + money(ded.funeral), 'minus');
  if (ded.debts) line(t('debts'), '− ' + money(ded.debts), 'minus');
  if (ded.will) line(t('will'), '− ' + money(Math.round(ded.will)), 'minus');
  line(t('dedNet'), money(Math.round(ded.net)) + ' ' + t('rupees'), 'total');
  const notes = [];
  if (ded.willCapped && !ded.insolvent) notes.push(STR[lang].dedWillCapped(money(Math.round(ded.maxWill))));
  if (ded.insolvent) notes.push(STR[lang].dedInsolvent(money(ded.debtsUnpaid)));
  $('dedNote').textContent = notes.join(' ');
  $('dedNote').hidden = !notes.length;
}

// ---------- Keeping an asset: who keeps it and what they must pay the others ----------
function renderBuyout(result, split, mineKey) {
  const assetSel = $('buyAsset'), keepSel = $('buyKeeper');
  const prevAsset = assetSel.value, prevKeeper = keepSel.value;
  // Choices: each listed asset (after deductions), or the whole estate.
  const choices = [];
  if (split) split.assets.forEach((a, i) => choices.push({ id: `a${i}`, label: assetLabel(a, i), value: Math.round(a.value) }));
  if (result.estate) choices.push({ id: 'all', label: t('estateTotal'), value: Math.round(result.estate) });
  const keepers = result.rows.filter((r) => !r.blocked && r.each.n > 0);
  $('buyBox').hidden = !choices.length || keepers.length < 2;
  if ($('buyBox').hidden) { last.buy = null; return; }
  assetSel.replaceChildren(...choices.map((c) => { const o = el('option', '', `${c.label} · ${money(c.value)}`); o.value = c.id; return o; }));
  keepSel.replaceChildren(...keepers.map((r) => { const o = el('option', '', r.count > 1 ? `${r.label} (${r.count})` : r.label); o.value = r.key; return o; }));
  // Sensible first choice: the house, kept by the sons (or brothers), since that is the common case.
  const house = choices.find((c) => split && split.assets[Number(c.id.slice(1))]?.kind === 'house');
  assetSel.value = choices.some((c) => c.id === prevAsset) ? prevAsset : (house || choices[0]).id;
  const pref = ['sons', 'brothers', 'father', 'husband', 'wives'].find((k) => k !== mineKey && keepers.some((r) => r.key === k));
  keepSel.value = keepers.some((r) => r.key === prevKeeper) ? prevKeeper : (pref || keepers.find((r) => r.key !== mineKey)?.key || keepers[0].key);

  const draw = () => {
    const c = choices.find((x) => x.id === assetSel.value);
    const b = buyout(result, c.value, keepSel.value);
    const out = $('buyOut');
    out.replaceChildren();
    if (!b) { out.hidden = true; last.buy = null; return; }
    last.buy = { ...b, assetLabel: c.label };
    const k = b.keeper;
    const head = el('p', 'body-3');
    head.textContent = STR[lang].buyLine(k.count > 1 ? `${k.label} (${k.count})` : k.label, c.label, money(b.value), money(k.ownShare), money(k.pays));
    out.append(head);
    if (k.count > 1) out.append(el('p', 'caption-2 muted', STR[lang].buyEach(money(k.paysEach))));
    const ul = el('ul', 'body-5');
    for (const o of b.others) {
      if (o.blocked || !o.receivesEach) continue;
      const li = el('li', o.key === mineKey ? 'me' : '');
      li.append(el('span', '', o.count > 1 ? `${o.label} (${o.count}) · ${t('treeEach')}` : o.label), el('span', 'num', money(o.receivesEach)));
      ul.append(li);
    }
    out.append(el('p', 'title-4 muted', t('buyGets')), ul);
    const mine = b.others.find((o) => o.key === mineKey);
    if (k.key === mineKey) out.append(el('p', 'buy-you body-3', STR[lang].buyYouKeep(money(k.pays))));
    else if (mine && mine.receivesEach) out.append(el('p', 'buy-you body-3', STR[lang].buyYouGet(money(mine.receivesEach))));
    if (b.unallocated) out.append(el('p', 'caption-2 muted', STR[lang].buyUnalloc(money(b.unallocated))));
    out.hidden = false;
    out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
  };
  assetSel.onchange = () => { draw(); scheduleExplain(); };
  keepSel.onchange = () => { draw(); scheduleExplain(); };
  draw();
}

let explainTimer = null;
function showResult(live = false) {
  // Before division: funeral costs, debts and the will come out of the estate first.
  const gross = Number(last.input.estate) || 0;
  const ded = deductions(gross, last.input);
  const useDed = gross > 0 && ded.any;
  last.ded = useDed ? ded : null;
  const result = calculate({ ...last.input, estate: useDed ? ded.net : last.input.estate }, lang);
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
      const big = el('div', 'big num');
      const pct = el('span', '');
      big.append(`${fstr(mineRow.each)} = `, pct);
      mine.append(el('div', 'title-3', t('yourShare')), big);
      const pctTo = mineRow.percentEach;
      if (live) pct.textContent = `${pctTo}%`;
      else countUp(pct, pctTo, (v) => `${v === pctTo ? v : v.toFixed(1)}%`);
      if (mineRow.amountEach != null) {
        const amt = el('span', 'num');
        const line = el('div', 'body-3 amount', `${t('about')} `);
        line.append(amt, ` ${t('rupees')}`);
        mine.append(line);
        if (live) amt.textContent = money(mineRow.amountEach);
        else countUp(amt, mineRow.amountEach, (v) => money(Math.round(v)), 1100);
      }
    }
  }
  mine.hidden = !mineRow;
  const hasShare = !!mineRow && !mineRow.blocked && mineRow.each.n > 0;
  lastMine = hasShare ? mineRow : null;

  // Cash, gold, house and other assets: each divided on its own, with totals at the end.
  const split = splitAssets(result, last.input.assets, useDed ? ded.net : null);
  renderDeductions(useDed ? ded : null, gross === 0 && ded.any);
  last.split = split;
  renderAssets(split, mineKey, hasShare);

  renderBuyout(result, split, mineKey);
  $('fairBox').hidden = !hasShare;
  renderFair();
  renderTree(result, mineKey);

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
  explainArgs = [result, relation, mineRow];
  clearTimeout(explainTimer);
  if (live) scheduleExplain();
  else explain(result, relation, mineRow);
  return true;
}

// Wait until the user stops changing things before asking AI again.
let explainArgs = null;
function scheduleExplain() {
  if (!explainArgs) return;
  clearTimeout(explainTimer);
  stopListening();
  explainRun++;
  $('aiCard').hidden = false;
  $('aiBody').hidden = true;
  $('aiLoading').hidden = false;
  explainTimer = setTimeout(() => explain(...explainArgs), 2500);
}

// ---------- Step 4: Gemini explains the already calculated result ----------
let explainRun = 0;
async function explain(result, relation, mineRow) {
  stopListening();
  const run = ++explainRun;
  const askedIn = lang;
  $('aiCard').hidden = false;
  $('aiBody').hidden = true;
  $('aiLoading').hidden = false;
  const payload = {
    outputLanguage: aiLang(),
    userRelation: relation,
    deceasedGender: result.input.deceasedGender,
    estateRupees: result.estate,
    heirs: result.rows.map((r) => ({
      heir: r.label, key: r.key, count: r.count, shareEach: fstr(r.each), percentEach: r.percentEach,
      amountEachRupees: r.amountEach, getsNothing: r.blocked || r.each.n === 0, reason: r.reason,
    })),
    unallocatedShare: result.unallocated.n > 0 ? fstr(result.unallocated) : null,
    beforeDivision: last && last.ded ? { totalRupees: last.ded.gross, funeralRupees: last.ded.funeral, debtsRupees: last.ded.debts, willRupees: last.ded.will, leftToDivideRupees: Math.round(last.ded.net) } : null,
    keepingAsset: last && last.buy ? { asset: last.buy.assetLabel, valueRupees: last.buy.value, keptBy: last.buy.keeper.label, keeperPaysOthersRupees: last.buy.keeper.pays, paysYouRupees: (last.buy.others.find((o) => o.key === REL_TO_KEY[relation]) || {}).receivesEach ?? null } : null,
    assetsEachRupees: last && last.split ? last.split.assets.map((a, i) => ({
      asset: assetLabel(a, i), value: a.value, goldTola: a.tola,
      perHeirEach: Object.fromEntries(last.split.rows.map((r) => [r.key, r.perAsset[i].each])),
    })) : null,
  };
  lastPayload = payload;
  $('chat').replaceChildren();
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

// ---------- Listen: the explanation read aloud ----------
// Gemini's voice when AI is on (sounds natural in Urdu); otherwise the browser's own voice if it has one.
let audio = null;
let speaking = false;
const audioCache = new Map(); // text -> object URL, so a second listen is instant
function setListen(state) {
  // state: idle | loading | playing
  $('listenBtn').classList.toggle('live', state === 'playing');
  $('listenBtn').classList.toggle('busy', state === 'loading');
  $('listenIcon').className = state === 'playing' ? 'ph ph-stop' : state === 'loading' ? 'ph ph-circle-notch spin-icon' : 'ph ph-speaker-high';
  $('listenText').dataset.i18n = state === 'playing' ? 'listenStop' : 'listen';
  $('listenText').textContent = t(state === 'playing' ? 'listenStop' : 'listen');
  if (state !== 'loading') $('listenStatus').textContent = '';
}
function stopListening() {
  speaking = false;
  if (audio) { audio.pause(); audio = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if ($('listenBtn')) setListen('idle');
}
function browserSpeak(text) {
  if (!window.speechSynthesis) return false;
  const want = lang === 'en' ? 'en' : 'ur';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(want));
  if (!voice && want === 'ur') return false;
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = want === 'ur' ? 'ur-PK' : 'en-US';
  u.rate = 0.95;
  u.onend = () => { speaking = false; setListen('idle'); };
  speechSynthesis.speak(u);
  speaking = true;
  setListen('playing');
  return true;
}
$('listenBtn').addEventListener('click', async () => {
  if (speaking || audio) { stopListening(); return; }
  const text = [$('explanation').textContent, ...[...$('steps').children].map((li) => li.textContent)].join('\n');
  if (!text.trim()) return;
  setListen('loading');
  $('listenStatus').textContent = t('listenLoading');
  const runLang = lang;
  try {
    let url = audioCache.get(runLang + text);
    if (!url) {
      const res = await fetch('/api/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang: runLang }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw Object.assign(new Error(d.error || 'speak failed'), { status: res.status }); }
      url = URL.createObjectURL(await res.blob());
      audioCache.set(runLang + text, url);
    }
    if (runLang !== lang) { setListen('idle'); return; }
    audio = new Audio(url);
    audio.onended = () => { audio = null; setListen('idle'); };
    await audio.play();
    speaking = true;
    setListen('playing');
  } catch (err) {
    console.error(err);
    audio = null;
    if (!browserSpeak(text)) { setListen('idle'); $('listenStatus').textContent = t('listenFail') + (aiWhy(err) ? ' ' + aiWhy(err) : ''); }
  }
});

// ---------- Where to get help ----------
// Official offices only, each with the page the details come from. Shown in every language.
const HELP = [
  { icon: 'ph-phone-call', key: 'h1043', phone: '1043', url: 'https://pcsw.punjab.gov.pk/helpline_' },
  { icon: 'ph-scales', key: 'hOmb', url: 'https://ombudsperson.punjab.gov.pk' },
  { icon: 'ph-identification-card', key: 'hNadra', url: 'https://www.nadra.gov.pk/identityDocument/certificates/succession?tab=succession' },
  { icon: 'ph-siren', key: 'h15', phone: '15', url: 'https://www.punjabpolice.gov.pk/emergency_help' },
];
function buildHelp() {
  const ul = $('helpList');
  ul.replaceChildren();
  HELP.forEach((h, i) => {
    const li = el('li', 'help-item');
    li.style.setProperty('--stagger', `${i * 90}ms`);
    const ic = el('span', 'help-icon'); ic.append(el('i', `ph ${h.icon}`));
    const body = el('div', 'help-body');
    body.append(el('p', 'title-3', t(h.key + 'T')), el('p', 'body-6 muted', t(h.key + 'D')));
    const acts = el('div', 'row help-acts');
    if (h.phone) {
      const a = el('a', 'chip button-sm num', h.phone); a.href = `tel:${h.phone}`;
      a.prepend(el('i', 'ph ph-phone'));
      acts.append(a);
    }
    const src = el('a', 'chip button-sm', t('helpSite')); src.href = h.url; src.target = '_blank'; src.rel = 'noopener';
    src.append(el('i', 'ph ph-arrow-up-right'));
    acts.append(src);
    body.append(acts);
    li.append(ic, body);
    ul.append(li);
  });
}

$('copyBtn').addEventListener('click', async () => {
  let key = 'copied';
  try { await navigator.clipboard.writeText($('draft').textContent); } catch { key = 'copyFail'; }
  $('copyText').textContent = t(key);
  setTimeout(() => { $('copyText').textContent = t('copy'); }, 1500);
});

// ---------- Share and print ----------
$('waBtn').addEventListener('click', () => {
  window.open('https://wa.me/?text=' + encodeURIComponent($('draft').textContent), '_blank', 'noopener');
});
$('printBtn').addEventListener('click', () => window.print());
// Closed <details> do not print their contents, so open the reasons list for the printout.
let reasonsWasOpen = false;
window.addEventListener('beforeprint', () => { const d = document.querySelector('.reasons'); reasonsWasOpen = d.open; d.open = true; });
window.addEventListener('afterprint', () => { document.querySelector('.reasons').open = reasonsWasOpen; });

// ---------- Follow up questions, answered by Gemini from the calculated case ----------
let lastPayload = null;
let asking = false;
async function ask(question) {
  question = String(question || '').trim();
  if (!question || asking || !lastPayload) return;
  asking = true;
  $('askBtn').disabled = true;
  const chat = $('chat');
  chat.append(el('div', 'bubble q body-3', question));
  const wait = el('div', 'bubble a wait body-3', t('askThinking'));
  chat.append(wait);
  wait.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const out = await post('/api/ask', { question, outputLanguage: aiLang(), case: lastPayload });
    wait.textContent = out.answer;
  } catch (err) {
    console.error(err);
    wait.textContent = t('askFail');
  }
  wait.classList.remove('wait');
  asking = false;
  $('askBtn').disabled = false;
}
$('askForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('askInput').value;
  $('askInput').value = '';
  ask(q);
});

applyLang();
