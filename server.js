// Wirasat Saathi server: serves the web app and proxies Gemini.
// No dependencies. The inheritance maths never touches Gemini — see public/calc.js.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

// Minimal .env loader
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 3000;
// Tried in order; a model that errors or is too slow is skipped for the next one.
// The lite models go first: they answer in a few seconds and have the roomiest free quota.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.7-flash'].filter(Boolean);
let workingModel = null;
const coolUntil = new Map(); // model -> time before which we skip it after a failure

async function gemini(system, user, schema, prefer = []) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const base = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  const all = [...prefer, ...base.filter((m) => !prefer.includes(m))];
  const fresh = all.filter((m) => (coolUntil.get(m) || 0) < Date.now());
  const order = fresh.length ? fresh : all;
  let lastErr;
  const deadline = Date.now() + 28000; // never keep the user waiting longer than this in total
  for (const model of order) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      const parsed = JSON.parse(text);
      if (!prefer.includes(model)) workingModel = model;
      return parsed;
    } catch (err) {
      console.error(`${model}: ${err.message}`);
      lastErr = err;
      if (workingModel === model) workingModel = null;
      if (err.message === 'fetch failed') break; // no internet: other models will fail too
      coolUntil.set(model, Date.now() + 90000); // quota, overload or timeout: leave it alone for a while
    }
  }
  throw lastErr;
}

// Story parsing. Gemini only names each person with a standard kinship word.
// Working out who that person is to the deceased, the counting, and the
// "out of scope" decision are all done by code in peopleToForm().
const PARSE_SYSTEM = `You read a short story about an inheritance. The text is Urdu, Roman Urdu or English. A person (usually a woman heir) describes a relative who has died and the family left behind.

Your job is only to LIST the people mentioned, using standard kinship words. Do not work out inheritance. Do not decide who is an heir.

Fields:
- deceasedIsSpeakers: who the dead person is to the speaker (father, mother, husband, wife, brother, sister, son, daughter, other).
- speakerGender: female unless the text clearly shows a man is speaking.
- people: one entry per kind of person mentioned. For each:
  * who: the words the speaker used, in a few words.
  * relativeTo: "speaker" if the person is described from the speaker's side ("my nana", "meri ammi", "hum teen behnein", "our daughters"); "deceased" if described from the dead person's side ("his mother", "her brother", "un ki walida", "un ka bhai").
  * term: the kinship word, relative to whoever relativeTo names. Glossary:
      self = the speaker alone ("I", "main")
      father = abbu, walid, baap;  mother = ammi, walida, maa
      husband = shohar, miyan;  wife = biwi
      son = beta;  daughter = beti
      brother = bhai;  sister = behen
      paternal_grandfather = dada;  paternal_grandmother = dadi
      maternal_grandfather = nana;  maternal_grandmother = nani
      paternal_uncle = chacha, taya;  paternal_aunt = phuppo
      maternal_uncle = mamu;  maternal_aunt = khala
      father_in_law = susar;  mother_in_law = saas
      husbands_brother = devar, jeth;  husbands_sister = nand
      wifes_brother = saala;  wifes_sister = saali
      brothers_wife = bhabhi;  sisters_husband = behnoi
      son_in_law = damad;  daughter_in_law = bahu
      grandson = pota, nawasa;  granddaughter = poti, nawasi;  grandchild = grandchildren of unknown gender
      nephew = bhatija, bhanja;  niece = bhatiji, bhanji
      half_or_step_sibling = sautela bhai or behen, half brother or sister
      other = anyone else
  * count: how many.
  * includesSpeaker: true if the speaker is one of the people in this entry.
  * alive: false only if the text says this person has died.
- estate: total value in Pakistani rupees as a plain number (1 lakh = 100000, 1 crore = 10000000; "1 crore 20 lakh" = 12000000); null if not given.

Rules:
- The speaker appears in EXACTLY ONE entry, with includesSpeaker true. Never add a second entry for the speaker.
  * "We are three sisters" = term sister, count 3, includesSpeaker true. The three already include the speaker.
  * "One brother and we three sisters" = brother count 1; sister count 3 with includesSpeaker true.
  * "My mother, two brothers and I, one daughter" = mother count 1; brother count 2; self count 1 with includesSpeaker true.
  * "My husband died" with no other mention of herself = self count 1, includesSpeaker true.
- If the text says there are none of something ("no brother"), do not list it.
- List people who have died too, with alive false. Do not list the deceased person.
- Never add people who are not mentioned.`;

const TERMS = ['self', 'father', 'mother', 'husband', 'wife', 'son', 'daughter', 'brother', 'sister',
  'paternal_grandfather', 'paternal_grandmother', 'maternal_grandfather', 'maternal_grandmother',
  'paternal_uncle', 'paternal_aunt', 'maternal_uncle', 'maternal_aunt',
  'father_in_law', 'mother_in_law', 'husbands_brother', 'husbands_sister', 'wifes_brother', 'wifes_sister',
  'brothers_wife', 'sisters_husband', 'son_in_law', 'daughter_in_law',
  'grandson', 'granddaughter', 'grandchild', 'nephew', 'niece', 'half_or_step_sibling', 'other'];

const PARSE_SCHEMA = {
  type: 'OBJECT',
  propertyOrdering: ['deceasedIsSpeakers', 'speakerGender', 'people', 'estate'],
  properties: {
    deceasedIsSpeakers: { type: 'STRING', enum: ['father', 'mother', 'husband', 'wife', 'brother', 'sister', 'son', 'daughter', 'other'] },
    speakerGender: { type: 'STRING', enum: ['female', 'male'] },
    people: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        propertyOrdering: ['who', 'relativeTo', 'term', 'count', 'includesSpeaker', 'alive'],
        properties: {
          who: { type: 'STRING' },
          relativeTo: { type: 'STRING', enum: ['speaker', 'deceased'] },
          term: { type: 'STRING', enum: TERMS },
          count: { type: 'INTEGER' },
          includesSpeaker: { type: 'BOOLEAN' },
          alive: { type: 'BOOLEAN' },
        },
        required: ['who', 'relativeTo', 'term', 'count', 'includesSpeaker', 'alive'],
      },
    },
    estate: { type: 'NUMBER', nullable: true },
  },
  required: ['deceasedIsSpeakers', 'speakerGender', 'people'],
};

// ---- Kinship logic in code ----
// For each "who died" case: the speaker's word for a relative -> that relative's relation to the deceased.
// CHILD and SIB are filled in from the speaker's gender. Anything not listed is out of scope.
const CHILD = '@child', SIB = '@sibling', PARENT = '@parent';
const FROM_SPEAKER = {
  father: { self: CHILD, brother: 'son', sister: 'daughter', mother: 'wife',
    paternal_grandfather: 'father', paternal_grandmother: 'mother', paternal_uncle: 'full_brother', paternal_aunt: 'full_sister' },
  mother: { self: CHILD, brother: 'son', sister: 'daughter', father: 'husband',
    maternal_grandfather: 'father', maternal_grandmother: 'mother', maternal_uncle: 'full_brother', maternal_aunt: 'full_sister' },
  husband: { self: 'wife', son: 'son', daughter: 'daughter', father_in_law: 'father', mother_in_law: 'mother',
    husbands_brother: 'full_brother', husbands_sister: 'full_sister' },
  wife: { self: 'husband', son: 'son', daughter: 'daughter', father_in_law: 'father', mother_in_law: 'mother',
    wifes_brother: 'full_brother', wifes_sister: 'full_sister' },
  brother: { self: SIB, brother: 'full_brother', sister: 'full_sister', father: 'father', mother: 'mother',
    brothers_wife: 'wife', nephew: 'son', niece: 'daughter' },
  sister: { self: SIB, brother: 'full_brother', sister: 'full_sister', father: 'father', mother: 'mother',
    sisters_husband: 'husband', nephew: 'son', niece: 'daughter' },
  son: { self: PARENT, husband: 'father', wife: 'mother', son: 'full_brother', daughter: 'full_sister',
    daughter_in_law: 'wife', grandson: 'son', granddaughter: 'daughter' },
  daughter: { self: PARENT, husband: 'father', wife: 'mother', son: 'full_brother', daughter: 'full_sister',
    son_in_law: 'husband', grandson: 'son', granddaughter: 'daughter' },
};
// Words used from the dead person's own side ("his mother", "her brother").
const FROM_DECEASED = { father: 'father', mother: 'mother', husband: 'husband', wife: 'wife',
  son: 'son', daughter: 'daughter', brother: 'full_brother', sister: 'full_sister' };
const GENDER_OF = { father: 'male', husband: 'male', brother: 'male', son: 'male', mother: 'female', wife: 'female', sister: 'female', daughter: 'female' };

function peopleToForm(parsed, lang) {
  const died = parsed.deceasedIsSpeakers;
  const female = parsed.speakerGender !== 'male';
  const table = FROM_SPEAKER[died] || {};
  const count = { husband: 0, wife: 0, son: 0, daughter: 0, father: 0, mother: 0, full_brother: 0, full_sister: 0 };
  const outside = [];
  let userRelation = 'other';

  // The speaker must be counted once. If two entries claim her, keep the larger group.
  const people = parsed.people || [];
  const keep = people.filter((p) => p.includesSpeaker).sort((a, b) => (b.count || 1) - (a.count || 1))[0];

  // "I, one daughter": the model sometimes lists the speaker twice, once as self and once by her role.
  const selfEntry = people.find((p) => p.term === 'self');
  const ownRole = { father: 1, mother: 1 }[died] ? (female ? 'daughter' : 'son') : null;

  for (const p of people) {
    if (p.includesSpeaker && p !== keep) continue;
    // Words like "his", "her", "un ki" show the person is named from the dead person's side.
    // When a child or a sibling died, both sides share the same words (son, daughter, husband),
    // so the model's relativeTo is trusted there. When a parent or spouse died it is not needed.
    const trustModel = ['son', 'daughter', 'brother', 'sister'].includes(died) && p.relativeTo === 'deceased';
    const fromDeceased = trustModel || /(his|her|their|deceased|un ?k[aie]|us ?k[aie])|ان ک|اس ک|مرحوم/i.test(p.who || '');
    if (selfEntry && p !== selfEntry && ownRole && p.term === ownRole && (p.count || 1) === 1 && !fromDeceased) continue;
    // The model is unreliable about relativeTo, so the speaker's side is tried first unless the words say otherwise.
    let rel = fromDeceased
      ? (FROM_DECEASED[p.term] || table[p.term])
      : (table[p.term] || (p.relativeTo === 'deceased' ? FROM_DECEASED[p.term] : undefined));
    if (rel === CHILD) rel = female ? 'daughter' : 'son';
    if (rel === SIB) rel = female ? 'full_sister' : 'full_brother';
    if (rel === PARENT) rel = female ? 'mother' : 'father';
    if (p.includesSpeaker && rel) {
      userRelation = { full_sister: 'sister', full_brother: 'brother' }[rel] || rel;
    }
    if (!rel) { if (p.who) outside.push(p.who); continue; }
    if (p.alive === false) continue;
    count[rel] += Math.max(1, Math.floor(Number(p.count) || 1));
  }

  const deceasedGender = GENDER_OF[died] || (count.husband > 0 ? 'female' : 'male');
  const names = outside.join(lang === 'en' ? ', ' : '، ');
  const outOfScope = outside.length
    ? (lang === 'en' ? `${names} cannot be counted here.` : `${names} اس حساب میں شامل نہیں۔`)
    : '';
  return {
    deceasedGender,
    husband: deceasedGender === 'female' && count.husband > 0,
    wives: deceasedGender === 'male' ? Math.min(4, count.wife) : 0,
    sons: count.son,
    daughters: count.daughter,
    father: count.father > 0,
    mother: count.mother > 0,
    brothers: count.full_brother,
    sisters: count.full_sister,
    estate: Number(parsed.estate) > 0 ? Number(parsed.estate) : null,
    userRelation,
    outOfScope,
  };
}

const EXPLAIN_SYSTEM = `You are Wirasat Saathi, a helper that explains an inheritance calculation to a woman in Pakistan in simple, warm, respectful language.
Write everything in the language named in "outputLanguage" in the JSON: Urdu means Urdu script, English means plain English.
You receive JSON with shares that were already calculated by verified code under Sunni Hanafi rules.
Hard rules:
- NEVER calculate, change, round or add any share, fraction, percentage or amount. Use only the numbers given in the JSON, exactly as given.
- Do not give a fatwa or a legal ruling. This is guidance only.
- Simple everyday words, short sentences, no difficult legal or Arabic terms without a plain explanation.
Write:
- explanation: 4 to 6 sentences addressed to the user. State her own share first (userRelation tells you which row is hers), then briefly why, then who else gets what.
- steps: 5 short practical next steps for claiming her share. You may draw on these general points, and tell her to confirm details with the relevant office:
  * Funeral costs, debts and any valid will (up to one third) are settled before the estate is divided.
  * Collect the death certificate and the family registration record of the heirs.
  * A succession certificate or letter of administration can be applied for through a NADRA Succession Facilitation Unit where available, or through the civil court.
  * For land, the inheritance mutation (wirasat ka intiqal) is entered at the land revenue office.
  * She should not sign any paper giving up her share under pressure.
  * Depriving a woman of her inheritance is an offence under Pakistani law, and a complaint can be made under the women's property rights law to the Ombudsperson.
  * A legal aid organisation or lawyer can help if the family refuses.
- draft: a short, polite written request in the output language from her to her family asking for her share, stating her share using the given numbers. Leave blanks like ______ for names and dates.`;

const EXPLAIN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    explanation: { type: 'STRING' },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    draft: { type: 'STRING' },
  },
  required: ['explanation', 'steps', 'draft'],
};

const ASK_SYSTEM = `You are Wirasat Saathi. A woman in Pakistan has just seen her inheritance share, which verified code calculated under Sunni Hanafi rules. The JSON gives her question, the calculated case, and outputLanguage.
Answer her question in the output language (Urdu means Urdu script), in 3 to 5 short sentences and plain everyday words.
Hard rules:
- Use only the shares and amounts in the case. NEVER calculate, change or add a share, fraction, percentage or amount.
- Give general practical guidance only. This is not a fatwa and not legal advice; for any decision tell her to confirm with a scholar, a lawyer or the relevant office.
- Never invent phone numbers, addresses, office names, fees, deadlines or section numbers of laws.
- If the question is not about inheritance or her situation, say politely that you can only help with inheritance questions.
General points you may draw on:
  * Funeral costs, debts and any valid will (up to one third) are settled before the estate is divided.
  * She needs the death certificate and the family registration record of the heirs.
  * A succession certificate or letter of administration can be applied for through a NADRA Succession Facilitation Unit where available, or through the civil court.
  * For land, the inheritance mutation is entered at the land revenue office.
  * She cannot be forced to give up her share, and she should not sign any paper giving it up under pressure.
  * Depriving a woman of her inheritance is an offence under Pakistani law, and a complaint can be made under the women's property rights law to the Ombudsperson.
  * A legal aid organisation or lawyer can help if the family refuses.`;

const ASK_SCHEMA = { type: 'OBJECT', properties: { answer: { type: 'STRING' } }, required: ['answer'] };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 100000) reject(new Error('body too large')); });
  req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/parse') {
      const { text, lang } = await readBody(req);
      if (!text || !String(text).trim()) return send(res, 400, { error: 'text is required' });
      // Reading family relations is the hardest step, so the more careful models go first here.
      const parsed = await gemini(PARSE_SYSTEM, String(text).slice(0, 4000), PARSE_SCHEMA, ['gemini-3.1-flash-lite', 'gemini-3.5-flash']);
      return send(res, 200, peopleToForm(parsed, lang === 'en' ? 'en' : 'ur'));
    }
    if (req.method === 'POST' && url.pathname === '/api/explain') {
      const body = await readBody(req);
      return send(res, 200, await gemini(EXPLAIN_SYSTEM, JSON.stringify(body).slice(0, 8000), EXPLAIN_SCHEMA));
    }
    if (req.method === 'POST' && url.pathname === '/api/ask') {
      const body = await readBody(req);
      const question = String(body.question || '').trim().slice(0, 300);
      if (!question) return send(res, 400, { error: 'question is required' });
      const user = JSON.stringify({ question, outputLanguage: body.outputLanguage === 'English' ? 'English' : 'Urdu', case: body.case }).slice(0, 8000);
      return send(res, 200, await gemini(ASK_SYSTEM, user, ASK_SCHEMA));
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, { ok: true, ai: !!process.env.GEMINI_API_KEY, model: workingModel });
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, { error: 'not found' });
    console.error(err.message);
    send(res, 502, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Wirasat Saathi running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) console.log('GEMINI_API_KEY is not set: the calculator works, AI features are off.');
});
