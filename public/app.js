import { calculate, fstr } from './calc.js';

const $ = (id) => document.getElementById(id);
const REL_TO_KEY = { daughter: 'daughters', wife: 'wives', mother: 'mother', sister: 'sisters', son: 'sons', husband: 'husband', father: 'father', brother: 'brothers' };
const money = (n) => Number(n).toLocaleString('en-PK');

// ---- Gender toggle: husband for a woman, wives for a man
const gender = () => document.querySelector('input[name="gender"]:checked').value;
function syncGender() {
  const female = gender() === 'female';
  $('husbandWrap').hidden = !female;
  $('wivesWrap').hidden = female;
}
document.querySelectorAll('input[name="gender"]').forEach((r) => r.addEventListener('change', syncGender));
syncGender();

// ---- Voice input (browser speech recognition, Urdu)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
if (!SR) {
  $('micBtn').disabled = true;
  $('micBtn').title = 'یہ براؤزر آواز نہیں سنتا، Chrome استعمال کریں یا لکھ کر بتائیں۔';
} else {
  $('micBtn').addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'ur-PK';
    rec.interimResults = true;
    rec.continuous = true;
    const base = $('story').value.trim();
    rec.onresult = (e) => {
      let text = '';
      for (const r of e.results) text += r[0].transcript + ' ';
      $('story').value = (base ? base + ' ' : '') + text.trim();
    };
    rec.onerror = (e) => { $('parseStatus').textContent = 'آواز نہیں سنی جا سکی (' + e.error + ')۔ لکھ کر بتائیں۔'; };
    rec.onend = () => { rec = null; $('micBtn').classList.remove('live'); $('micBtn').textContent = '🎤 بولیں'; };
    rec.start();
    $('micBtn').classList.add('live');
    $('micBtn').textContent = '⏹ روکیں';
    $('parseStatus').textContent = 'سن رہا ہوں…';
  });
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'request failed');
  return data;
}

// ---- Step 1: Gemini turns the story into form values
$('parseBtn').addEventListener('click', async () => {
  const text = $('story').value.trim();
  if (!text) { $('parseStatus').textContent = 'پہلے اپنی صورتحال لکھیں یا بولیں۔'; return; }
  $('parseBtn').disabled = true;
  $('parseStatus').textContent = 'AI آپ کی بات سمجھ رہا ہے…';
  $('scopeNote').hidden = true;
  try {
    const f = await post('/api/parse', { text });
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
      $('scopeNote').textContent = 'توجہ: ' + f.outOfScope + ' یہ ایپ ایسے معاملے کا حساب نہیں کرتی، کسی عالم یا وکیل سے رجوع کریں۔';
      $('scopeNote').hidden = false;
    }
    $('parseStatus').textContent = 'فارم بھر دیا گیا ہے۔ نیچے دیکھ کر تصدیق کریں، پھر حصے نکالیں۔';
  } catch (err) {
    $('parseStatus').textContent = 'AI دستیاب نہیں۔ نیچے فارم خود بھر لیں۔';
    console.error(err);
  } finally {
    $('parseBtn').disabled = false;
  }
});

// ---- Step 2 and 3: deterministic calculation
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

const cell = (text, cls) => { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; return td; };

$('calcBtn').addEventListener('click', () => {
  const result = calculate(readForm());
  $('calcError').hidden = result.ok;
  if (!result.ok) {
    $('calcError').textContent = result.error;
    $('resultCard').hidden = true;
    $('aiCard').hidden = true;
    return;
  }
  const relation = $('relation').value;
  const mineKey = REL_TO_KEY[relation];
  const mineRow = result.rows.find((r) => r.key === mineKey);

  // "Your share" card
  const mine = $('mine');
  mine.replaceChildren();
  if (mineRow) {
    const lead = document.createElement('div'); lead.className = 'lead';
    const big = document.createElement('div'); big.className = 'big';
    if (mineRow.blocked || mineRow.each.n === 0) {
      lead.textContent = 'اس صورت میں آپ کا حصہ نہیں بنتا';
      big.textContent = '0';
      mine.append(lead, big);
    } else {
      lead.textContent = 'آپ کا حصہ';
      big.textContent = `${fstr(mineRow.each)}  =  ${mineRow.percentEach}%`;
      mine.append(lead, big);
      if (mineRow.amountEach != null) {
        const amt = document.createElement('div'); amt.className = 'amt';
        amt.textContent = `تقریباً ${money(mineRow.amountEach)} روپے`;
        mine.append(amt);
      }
    }
    mine.hidden = false;
  } else {
    mine.hidden = true;
  }

  // Table and reasons
  const tbody = $('rows'); tbody.replaceChildren();
  const reasons = $('reasons'); reasons.replaceChildren();
  for (const r of result.rows) {
    const tr = document.createElement('tr');
    if (r.key === mineKey) tr.classList.add('me');
    if (r.blocked) tr.classList.add('blocked');
    tr.append(
      cell(r.label),
      cell(String(r.count), 'ltr'),
      cell(fstr(r.each), 'ltr'),
      cell(r.percentEach + '%', 'ltr'),
      cell(r.amountEach != null ? money(r.amountEach) : '—', 'ltr'),
    );
    tbody.append(tr);
    const li = document.createElement('li');
    li.textContent = `${r.label}: ${r.reason}`;
    reasons.append(li);
  }

  const notes = [];
  if (result.unallocated.n > 0) {
    notes.push(`ترکے کا ${fstr(result.unallocated)} حصہ ان ورثا میں تقسیم نہیں ہوا۔ یہ دوسرے رشتہ داروں کو جا سکتا ہے جو اس ایپ میں شامل نہیں، اس لیے کسی عالم یا وکیل سے ضرور پوچھیں۔`);
  }
  if (!mineRow && relation !== 'other') notes.push('آپ نے جو اپنا رشتہ چنا ہے وہ اوپر فارم میں درج ورثا میں نہیں ہے۔ فارم دوبارہ دیکھ لیں۔');
  $('flagNote').textContent = notes.join(' ');
  $('flagNote').hidden = notes.length === 0;

  $('resultCard').hidden = false;
  $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  explain(result, relation, mineRow);
});

// ---- Step 4: Gemini explains the already-calculated result
const FALLBACK_STEPS = [
  'تقسیم سے پہلے کفن دفن کا خرچ، قرض اور جائز وصیت (ایک تہائی تک) ادا کی جاتی ہے۔',
  'وفات کا سرٹیفکیٹ اور ورثا کا خاندانی ریکارڈ (فیملی رجسٹریشن سرٹیفکیٹ) اکٹھا کریں۔',
  'وراثتی سرٹیفکیٹ کے لیے نادرا کے متعلقہ مرکز یا سول عدالت سے رجوع کریں۔',
  'زمین ہو تو محکمہ مال کے دفتر میں وراثت کا انتقال درج کروائیں۔',
  'دباؤ میں آ کر اپنے حصے سے دستبرداری کے کسی کاغذ پر دستخط نہ کریں، اور ضرورت ہو تو قانونی امداد کے ادارے یا وکیل سے مدد لیں۔',
];

let explainRun = 0;
async function explain(result, relation, mineRow) {
  const run = ++explainRun;
  $('aiCard').hidden = false;
  $('aiBody').hidden = true;
  $('aiStatus').textContent = 'AI آسان اردو میں وضاحت لکھ رہا ہے…';
  const payload = {
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
    const share = mineRow && mineRow.each.n > 0
      ? `آپ کا حصہ ترکے کا ${fstr(mineRow.each)} (${mineRow.percentEach}%) ہے${mineRow.amountEach != null ? `، یعنی تقریباً ${money(mineRow.amountEach)} روپے` : ''}۔`
      : 'اوپر جدول میں ہر وارث کا حصہ درج ہے۔';
    out = {
      explanation: share + ' ہر حصے کی وجہ اوپر "ہر حصے کی وجہ دیکھیں" میں لکھی ہے۔',
      steps: FALLBACK_STEPS,
      draft: `محترم اہلِ خانہ،\nالسلام علیکم۔\nمرحوم/مرحومہ ______ کے ترکے میں میرا حصہ ${mineRow && mineRow.each.n > 0 ? fstr(mineRow.each) : '______'} بنتا ہے۔ میری گزارش ہے کہ ترکے کی تقسیم میں میرا یہ حصہ مجھے دیا جائے۔\nشکریہ۔\nنام: ______\nتاریخ: ______`,
    };
  }
  if (run !== explainRun) return;
  $('explanation').textContent = out.explanation;
  const ol = $('steps'); ol.replaceChildren();
  for (const s of out.steps || []) { const li = document.createElement('li'); li.textContent = s; ol.append(li); }
  $('draft').textContent = out.draft;
  $('aiLabel').textContent = fromAI
    ? 'یہ وضاحت Gemini (AI) نے لکھی ہے۔ اعداد کوڈ سے آئے ہیں۔ تفصیل متعلقہ دفتر سے تصدیق کر لیں۔'
    : 'AI دستیاب نہیں تھا، اس لیے یہ عام رہنمائی دکھائی گئی ہے۔ تفصیل متعلقہ دفتر سے تصدیق کر لیں۔';
  $('aiStatus').textContent = '';
  $('aiBody').hidden = false;
}

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('draft').textContent);
    $('copyBtn').textContent = 'کاپی ہو گیا ✓';
  } catch {
    $('copyBtn').textContent = 'کاپی نہیں ہو سکا';
  }
  setTimeout(() => { $('copyBtn').textContent = 'مسودہ کاپی کریں'; }, 1500);
});
