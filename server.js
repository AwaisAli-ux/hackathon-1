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
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean);
let workingModel = null;

async function gemini(system, user, schema) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let lastErr;
  for (const model of order) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      const parsed = JSON.parse(text);
      workingModel = model;
      return parsed;
    } catch (err) {
      console.error(`${model}: ${err.message}`);
      lastErr = err;
      if (workingModel === model) workingModel = null;
    }
  }
  throw lastErr;
}

const PARSE_SYSTEM = `You fill in a form for an inheritance calculator. The input is Urdu, Roman Urdu or English text in which a person (usually a woman heir) describes a relative who has died and the surviving family.
Rules:
- All relations in the output are relative to the DECEASED person, not the speaker. If the speaker's father died, the speaker's brothers are the deceased's sons and the speaker's mother is the deceased's wife.
- Work out each relation step by step from the deceased's side. Examples: if the speaker's mother died, the speaker's nana and nani (maternal grandparents) are the deceased's father and mother, and the speaker's mamu and khala are the deceased's brothers and sisters. If the speaker's father died, the speaker's dada and dadi are the deceased's father and mother, and the speaker's chacha, taya and phuppo are the deceased's brothers and sisters. If the speaker's husband died, her saas and susar are the deceased's mother and father.
- First fill "working": list every person mentioned, one by one, as "speaker's X = deceased's Y", including the speaker herself. Then fill the other fields from that list.
- Count the speaker herself or himself among the heirs (for example "main aik beti hoon" means she is one of the daughters). If the speaker's husband died, the speaker is his wife, so wives is at least 1. If the speaker's father died and her mother (ammi, walida) is alive, that mother is the deceased's wife, so wives is at least 1 — she is NOT the deceased's mother.
- A relative who is the deceased's parent, child, spouse or full sibling is always in scope, whatever the speaker calls them.
- Write outOfScope in Urdu script.
- Count only living heirs. If something is not mentioned, use 0, false or null. Never guess.
- brothers and sisters mean FULL brothers and sisters of the deceased only.
- estate is the total value in Pakistani rupees as a plain number (1 lakh = 100000, 1 crore = 10000000); null if not given.
- userRelation is the speaker's relation to the deceased.
- outOfScope: only relatives that are NOT the deceased's spouse, parents, children or full siblings are out of scope. If the text mentions the deceased's grandchildren, the deceased's own grandparents, half or step siblings, the deceased's uncles or aunts, a non-Muslim family, or a non-Hanafi school, say so in one short Urdu sentence. Otherwise an empty string.`;

const PARSE_SCHEMA = {
  type: 'OBJECT',
  propertyOrdering: ['working', 'deceasedGender', 'husband', 'wives', 'sons', 'daughters', 'father', 'mother', 'brothers', 'sisters', 'estate', 'userRelation', 'outOfScope'],
  properties: {
    working: { type: 'STRING' },
    deceasedGender: { type: 'STRING', enum: ['male', 'female'] },
    husband: { type: 'BOOLEAN' },
    wives: { type: 'INTEGER' },
    sons: { type: 'INTEGER' },
    daughters: { type: 'INTEGER' },
    father: { type: 'BOOLEAN' },
    mother: { type: 'BOOLEAN' },
    brothers: { type: 'INTEGER' },
    sisters: { type: 'INTEGER' },
    estate: { type: 'NUMBER', nullable: true },
    userRelation: { type: 'STRING', enum: ['daughter', 'wife', 'mother', 'sister', 'son', 'husband', 'father', 'brother', 'other'] },
    outOfScope: { type: 'STRING' },
  },
  required: ['working', 'deceasedGender', 'husband', 'wives', 'sons', 'daughters', 'father', 'mother', 'brothers', 'sisters', 'userRelation', 'outOfScope'],
};

const EXPLAIN_SYSTEM = `You are Wirasat Saathi, a helper that explains an inheritance calculation to a woman in Pakistan in simple, warm, respectful Urdu (Urdu script).
You receive JSON with shares that were already calculated by verified code under Sunni Hanafi rules.
Hard rules:
- NEVER calculate, change, round or add any share, fraction, percentage or amount. Use only the numbers given in the JSON, exactly as given.
- Do not give a fatwa or a legal ruling. This is guidance only.
- Simple everyday Urdu, short sentences, no difficult legal or Arabic terms without a plain explanation.
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
- draft: a short, polite written request in Urdu from her to her family asking for her share, stating her share using the given numbers. Leave blanks like ______ for names and dates.`;

const EXPLAIN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    explanation: { type: 'STRING' },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    draft: { type: 'STRING' },
  },
  required: ['explanation', 'steps', 'draft'],
};

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
      const { text } = await readBody(req);
      if (!text || !String(text).trim()) return send(res, 400, { error: 'text is required' });
      return send(res, 200, await gemini(PARSE_SYSTEM, String(text).slice(0, 4000), PARSE_SCHEMA));
    }
    if (req.method === 'POST' && url.pathname === '/api/explain') {
      const body = await readBody(req);
      return send(res, 200, await gemini(EXPLAIN_SYSTEM, JSON.stringify(body).slice(0, 8000), EXPLAIN_SCHEMA));
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
