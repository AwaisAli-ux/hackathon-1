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
| `public/index.html`, `style.css`, `app.js` | Landing page plus the tool: hero, 4 step tool, tagline reveal, how it works, benefits, FAQ, final call to action. |
| `public/i18n.js` | Every interface string in English and Urdu. Add new text here in both languages, never hard code it in HTML. |
| `.env.example` | Copy to `.env`, set `GEMINI_API_KEY`. |
| `README.md` | Submission-ready description. |

Run: `npm start`, open http://localhost:3000 in Chrome. Nothing to install.

## Interface rules

- **Two languages:** a nav button switches English (LTR) and Urdu (RTL); the choice is saved in `localStorage` (`ws-lang`, default Urdu). `calculate(input, lang)` returns labels and reasons in that language, and `/api/parse` and `/api/explain` are told which language to write in. Switching language re-renders the result and asks Gemini for the explanation again.
- **Light and dark mode:** a nav button sets `data-theme` on `<html>`, saved as `ws-theme`; with no saved choice it follows the system setting.
- **Design:** follows the user's `landing-page-design` skill. Manrope for Latin text, Noto Nastaliq Urdu for Urdu (with taller line heights, the one deliberate departure from the skill's type scale). Sizes on the Tailwind scale via named classes (`heading-1`, `body-3`, `button-md` …), spacing only from the skill's table, flat backgrounds, gradient only on the hero heading text, dark backgrounds only from the skill's list, Phosphor icons, motion on `cubic-bezier(0.22,1,0.36,1)`, no hyphens in copy, no invented statistics or testimonials.
- Not done from the skill's ship list: custom 404 page, separate privacy and terms pages, mobile menu panel (on small screens the nav hides its links and keeps the two toggles).

## Features in the tool

- **Example stories:** three chips fill the story and run AI form filling in one click (best for the demo).
- **Steppers and live result:** plus and minus on count fields; after the first calculation the result follows the form, and the AI explanation is asked again 2.5 seconds after the last change.
- **Fairness checker:** the user enters what the family offers; code shows how many rupees short it is and what percent of her right it covers. Needs the estate total.
- **Assets:** optional list of assets (name and value); the estate becomes their sum and the result shows her share of each asset.
- **Family map:** parents above, siblings and spouse beside the deceased, children below. Clicking a person shows the reason for that share.
- **Share bars**, result table and reasons list.
- **WhatsApp and print:** the draft request opens in WhatsApp through `wa.me`; the print button prints the result and explanation only, on white.
- **Question chat:** `/api/ask` answers follow up questions from the calculated case, in the current language, with strict limits (no new numbers, no invented contacts, inheritance topics only).
- All of these except the chat and the AI explanation are plain code and work without internet.

## Gemini quota

The key is on the free tier. During testing `gemini-3.5-flash` hit its quota (HTTP 429), so the lite models are tried first and a failing model is skipped for 90 seconds. If the lite models also run out, link the hackathon billing account (the 5 dollar credit) to the key's Google Cloud project, or make a new key in a project that has billing. Avoid switching language repeatedly during the demo: each switch asks Gemini again.

## Deploying (not done)

`gcloud` and Docker are not installed on the user's laptop; the `firebase` CLI is. A `Dockerfile` is included for Cloud Run. The quickest route: Google Cloud console → Cloud Run → deploy from the GitHub repo using the Dockerfile → add `GEMINI_API_KEY` as an environment variable → allow unauthenticated access. The user must do the console steps and sign in. Do not list Cloud Run or Firebase in the stack unless this is actually done.

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
- Interface: checked in the browser in both languages and both themes; story → form → result → explanation works end to end, and so does the no-AI fallback.

- Gemini: tested with a real key. Story → form works on 6 Urdu and Roman Urdu stories, including relation mapping (nana/nani, dadi, chacha, saas) and out-of-scope grandchildren. Explanation, steps and draft come back in Urdu with the calculator's numbers.
- Gemini models: `server.js` tries `GEMINI_MODEL` (if set), `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.5-flash`, `gemini-3.7-flash`, moving on when one errors or takes over 12 seconds, with a 28 second total limit. During testing `gemini-3.5-flash` returned 503 (high demand) and `gemini-3.8-flash` / `gemini-flash-latest` hung, so `gemini-3.5-flash-lite` did the work. The 2.5 models are closed to new users.
- The `.env` file with the key is NOT in the zip or the repo. In a new place, copy `.env.example` to `.env` and add the key. The key was pasted in a chat once, so the user should delete it in AI Studio after the hackathon.

Not verified:
- AI parsing can still misread a story. The confirmation form is the safeguard: always tell the user to check it before calculating.
- Urdu voice input uses the browser's speech recognition (`ur-PK`); it needs Chrome, a microphone and internet. Not tested with real speech.

Not built:
- Firebase (hosting or database). Only add it to the stack description if it is actually built.
- Deployment. The demo currently runs on localhost.
- Presentation slides.

## Next steps, in order

1. Test voice input in Chrome with real Urdu speech.
2. Rehearse the full demo twice in Chrome.
3. If time allows: deploy (Cloud Run or Firebase Hosting with a function for the Gemini proxy) to earn Google technology marks.
4. Prepare slides: problem, who is affected, solution, the "code calculates, AI explains" split, SDG 5, technology stack, limitations, live demo.
5. Demo story to rehearse: father died; wife, 2 sons, 1 daughter; estate 4,000,000. Daughter's share is 7/40 = 17.5% = 700,000.

## Working notes

- The user is under time pressure; build first, explain briefly.
- Never ask for the API key in chat; the user puts it in `.env`.
- Do not add unsourced statistics to the submission or slides.
- `.env`, the rules PDF, the old proposal `.docx` and zip files are git-ignored.
