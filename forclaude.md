# forclaude.md — handover for a new chat

Read this first, then continue the work. Reply to the user in Roman Urdu (Urdu in Latin script); keep written deliverables in English unless asked.

## What this is

**Wirasat Saathi**: an Urdu web app that tells a woman her inheritance share and what to do next. Built for the **Build with Google Hackathon** (GDGoC CUI, CUI Tech Fest FA'26). Team: Awais Ali Asad, Ayesha Qaisar Cheema.

- GitHub repo: https://github.com/AwaisAli-ux/hackathon-1 (branch `main`)
- Domain: Women's Empowerment. SDG 5 primary; SDG 10 and 16 supporting.
- Core idea: **AI never calculates shares.** A deterministic calculator does the maths; Gemini only parses the user's story into the form and explains the result in Urdu.

## Hackathon rules that matter

- Build 10:30 AM – 3:00 PM; presentations start 2:30 PM. Be demo-ready by 2:30.
- Marks: Implementation 30, Problem and SDG 20, Innovation 20, Google technology 10, UX 10, Presentation 10.
- Deliverables: title, problem statement, SDG alignment, working prototype, GitHub repo, technology stack, short presentation.
- Responsible AI: disclose AI use, never present unvalidated AI output as fact, state limitations, protect privacy.
- Disqualification risks: previously completed projects, false or misleading claims. Do not claim anything the prototype does not do (for example, do not say Firebase is used unless it is).

## Files

| File | Purpose |
|---|---|
| `public/calc.js` | Deterministic calculator, exact fractions. Runs in the browser and in tests. |
| `test/calc.test.js` | 14 worked cases (`npm test`). |
| `server.js` | Node server, no dependencies. Serves `public/`, proxies Gemini at `/api/parse` and `/api/explain`. |
| `public/index.html`, `style.css`, `app.js` | Urdu RTL interface: story → form → result → explanation. |
| `.env.example` | Copy to `.env`, set `GEMINI_API_KEY`. |
| `README.md` | Submission-ready description. |

Run: `npm start`, open http://localhost:3000 in Chrome. Nothing to install.

## Calculator rules (Sunni Hanafi, close heirs only)

Heirs covered: husband or up to 4 wives, father, mother, sons, daughters, full brothers, full sisters.

- Husband 1/2, or 1/4 with children. Wives 1/4, or 1/8 with children, split equally.
- Mother 1/6 with children or 2+ siblings; otherwise 1/3. With spouse and father and no children: 1/3 of what is left after the spouse.
- Daughters without a son: one gets 1/2, two or more share 2/3. With a son: remainder at 2:1.
- Father: 1/6 with a son; 1/6 plus remainder with daughters only; whole remainder with no children.
- Full siblings are blocked by a son or the father. Otherwise brothers and sisters take the remainder at 2:1; sisters alone get 1/2 or 2/3; sisters with daughters take the remainder.
- Awl (shares exceed 1): reduce all in proportion. Radd (remainder, no residuary): return to sharers other than the spouse. Spouse alone: remainder shown as unallocated with a note to consult an expert.

Out of scope, by design: other schools, non-Muslims, grandchildren, grandparents, half and step relatives. The app shows a warning and refers to a scholar or lawyer. Do not widen the scope without adding tested cases.

## State when this file was written

Done and verified:
- Calculator: all 14 tests pass.
- Interface: checked in the browser; form, result table, "your share" card and the no-AI fallback all work.

Not verified:
- **Gemini calls have not been tested with a real key.** The user must put `GEMINI_API_KEY` in `.env`. `server.js` tries `GEMINI_MODEL` (if set), then `gemini-flash-latest`, then `gemini-2.5-flash`. If all return 404, look up a current model name and set `GEMINI_MODEL`.
- Urdu voice input uses the browser's speech recognition (`ur-PK`); it needs Chrome, a microphone and internet. Not tested with real speech.

Not built:
- Firebase (hosting or database). Only add it to the stack description if it is actually built.
- Deployment. The demo currently runs on localhost.
- Presentation slides.

## Next steps, in order

1. Add the Gemini key, then test "فارم خود بھریں" and the explanation with 2 or 3 stories. Fix prompt or model issues in `server.js`.
2. Test voice input in Chrome.
3. If time allows: deploy (Cloud Run or Firebase Hosting with a function for the Gemini proxy) to earn Google technology marks.
4. Prepare slides: problem, who is affected, solution, the "code calculates, AI explains" split, SDG 5, technology stack, limitations, live demo.
5. Demo story to rehearse: father died; wife, 2 sons, 1 daughter; estate 4,000,000. Daughter's share is 7/40 = 17.5% = 700,000.

## Working notes

- The user is under time pressure; build first, explain briefly.
- Never ask for the API key in chat; the user puts it in `.env`.
- Do not add unsourced statistics to the submission or slides.
- `.env`, the rules PDF, the old proposal `.docx` and zip files are git-ignored.
