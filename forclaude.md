# forclaude.md — handover for a new chat

Read this first, then continue the work. Reply to the user in Roman Urdu (Urdu in Latin script); keep written deliverables in English unless asked.

## What this is

**Wirasat Saathi**: an Urdu web app that tells a woman her inheritance share and what to do next. Built for the **Build with Google Hackathon** (GDGoC CUI, CUI Tech Fest FA'26). Team: Awais Ali Asad, Ayesha Qaisar Cheema, Dua Fatima.

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
| `test/calc.test.js` | 14 worked inheritance cases plus asset split, deductions and buyout tests (`npm test`, 21 tests). |
| `server.js` | Node server, no dependencies. Serves `public/`, proxies Gemini at `/api/parse` (text or photo), `/api/explain`, `/api/ask`, `/api/transcribe` (voice) and `/api/speak` (text to speech, WAV). |
| `public/index.html`, `style.css`, `app.js` | Landing page plus the tool: hero, 4 step tool, tagline reveal, how it works, benefits, FAQ, final call to action. |
| `public/i18n.js` | Every interface string in English and Urdu. Add new text here in both languages, never hard code it in HTML. |
| `.env.example` | Copy to `.env`, set `GEMINI_API_KEY`. |
| `README.md` | Submission-ready description. |

Run: `npm start`, open http://localhost:3000 in Chrome. Nothing to install.

## Interface rules

- **Three languages:** a nav dropdown switches English (LTR), Urdu (RTL) and Roman Urdu (LTR); the choice is saved in `localStorage` (`ws-lang`, default Urdu). `calculate(input, lang)` returns labels and reasons in that language, and `/api/parse` and `/api/explain` are told which language to write in. Switching language re-renders the result and asks Gemini for the explanation again.
- **Light and dark mode:** a nav button sets `data-theme` on `<html>`, saved as `ws-theme`; with no saved choice it follows the system setting.
- **Design:** follows the user's `landing-page-design` skill. Manrope for Latin text, Noto Nastaliq Urdu for Urdu (with taller line heights, the one deliberate departure from the skill's type scale). Sizes on the Tailwind scale via named classes (`heading-1`, `body-3`, `button-md` …), spacing only from the skill's table, flat backgrounds, gradient only on the hero heading text, dark backgrounds only from the skill's list, Phosphor icons, motion on `cubic-bezier(0.22,1,0.36,1)`, no hyphens in copy, no invented statistics or testimonials.
- Not done from the skill's ship list: custom 404 page, separate privacy and terms pages, mobile menu panel (on small screens the nav hides its links and keeps the two toggles).

## Features in the tool

- **Example stories:** three chips fill the story and run AI form filling in one click (best for the demo).
- **Steppers and live result:** plus and minus on count fields; after the first calculation the result follows the form, and the AI explanation is asked again 2.5 seconds after the last change.
- **Fairness checker:** the user enters what the family offers; code shows how many rupees short it is and what percent of her right it covers. Needs the estate total.
- **Assets (cash, gold, house separately):** step 2 has fixed fields for cash and bank, gold value (plus optional weight in tola) and house or property, and "Add another asset" rows for anything else (car, land). Each asset is divided on its own by `splitAssets()` in `calc.js`, from the exact fractions. The result shows (a) her share of each asset with a **Total** line, and (b) a full table: one row per heir (amount for each person), one column per asset, a **Total** column, and a **Whole estate** row at the end; an unallocated part gets its own "Not divided" row. When any asset is entered the estate field becomes their sum (read only); clearing all assets clears it again. Gemini can also pick `cash`, `gold`, `goldTola`, `house` out of the story; if the story's total is larger than the listed parts, the difference is added as a "Rest of the estate" row. The asset split is also sent to `/api/explain` so the explanation can mention it.
- **Family map (redesigned):** a real family tree. Parents on top joined by a marriage line, a stem down to their children (the deceased and the brothers and sisters), the spouse joined to the deceased by a marriage line, children below on a shared branch. Lines are SVG paths drawn from the real card positions (`drawTreeLines` in `app.js`), so they work in LTR and RTL and at any width, and are redrawn on resize. Each card has a ring that fills to that person's share of the estate, the fraction, the percent ("each" for groups) and a count pill; heirs with no share are dashed and dimmed; her own card is highlighted with a "You" badge and a soft pulse, and the line to her is green. Clicking a card highlights its line and shows the reason below. A legend explains the colours.
- **Share bars**, result table and reasons list.
- **WhatsApp and print:** the draft request opens in WhatsApp through `wa.me`; the print button prints the result and explanation only, on white.
- **Question chat:** `/api/ask` answers follow up questions from the calculated case, in the current language, with strict limits (no new numbers, no invented contacts, inheritance topics only).
- All of these except the chat and the AI explanation are plain code and work without internet.

## Features added in the "all mods" session

- **Before division** (`deductions()` in `calc.js`, tested): funeral, then debts, then will capped at one third of what is left after debts. The calculator then runs on the net estate; assets are reduced in proportion (`splitAssets(result, assets, net)`), the asset table's last row reads "Left to divide". If debts exceed the estate, nothing is divided and the unpaid debt is shown.
- **Keeping an asset** (`buyout()` in `calc.js`, tested): pick an asset (or the whole estate) and the heir group that keeps it; shows the keeper's own share, what they pay in total and per person, and what each other heir must receive. Defaults to the house kept by the sons (or brothers).
- **Voice in** (`/api/transcribe`): the browser records a 16 kHz WAV (max 60 s, live level meter), Gemini writes it down (`gemini-3.5-flash`, then `gemini-flash-lite-latest`, then `gemini-3.5-flash-lite`). Some models write spoken Urdu in Devanagari; the server detects that and converts it to Urdu script with a second text call. The transcript goes into the story box and the form is filled automatically. Without a key the browser's speech recognition is used.
- **Voice out** (`/api/speak`): "Listen" reads the explanation and steps with Gemini TTS (`gemini-3.8-flash-lite-tts`, then `gemini-3.8-flash-tts`, then `gemini-3.1-flash-tts-preview`, voice Kore), returned as WAV and cached per text. Falls back to the browser voice if it has Urdu/English.
- **Photo of a paper** (`/api/parse` with `image`): the browser shrinks the photo to 1600 px JPEG; Gemini (`gemini-3.5-flash` first) reads it with the same parse prompt; the lines it read are shown under the story ("Read from the photo"). About 20 seconds. Use a made up note in the demo, never a real CNIC or FRC.
- Parse also picks up `funeral`, `debts`, `will` from the story or photo. Fields that AI filled glow briefly.
- **Where to get help:** four entries in `HELP` in `app.js` with official links. They come from a research pass that could only read search summaries of the official pages (the sandbox blocked the sites), so **open each link and confirm before the demo**. Left out on purpose: FOSPAH (one of its own orders says the Islamabad High Court struck down the 2020 federal Act; status unclear), unconfirmed phone numbers, fees.
- **Language dropdown:** English, اردو, Roman Urdu (`ro`, `lang="ur-Latn"`, left to right, Manrope). `STR.ro` and calc `TEXT.ro` have every key. Gemini is told `outputLanguage` English / Urdu / Roman Urdu.
- Tested with the real key in headless Chromium: voice (fake microphone playing a Gemini TTS Urdu clip) → transcript in Urdu script → form; photo → form; deductions, buyout, explanation, Listen, chat; Urdu and Roman Urdu; phone width. All 21 unit tests pass.

## Motion

- Hero: title, text, button, proof line and example card rise and sharpen one after another; the example's 17.5% rolls up and a split bar grows segment by segment; the card floats gently.
- Sections and grid cards reveal on scroll with a stagger. Result and explanation cards slide in; asset rows arrive one by one.
- Your share: percent and rupee amount roll up (not during live form edits).
- Family map: cards arrive generation by generation, lines draw in, share rings fill.
- All motion uses `cubic-bezier(0.22,1,0.36,1)` and is switched off under `prefers-reduced-motion`.
- No gradients or patterns were added to backgrounds (the design rule allows a gradient only on the hero heading).

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
- Calculator: all 17 tests pass (14 inheritance cases, 3 asset split).
- Interface: checked in the browser in both languages and both themes, desktop and phone width (family map included); story → form → result → explanation works end to end, and so does the no-AI fallback.

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

## Latest changes (UI session)

- Footer note now says shares follow **Pakistani law and Shariah rules** (English and Urdu) instead of naming Sunni Hanafi; the user asked for this. The FAQ answer, the README and the AI prompts still say Sunni Hanafi, which is what the calculator implements and what Pakistani courts apply for Sunni families. Change those only if the user asks.
- Team now includes **Dua Fatima** (footer in both languages, README, this file).
- Family map redesigned and motion added (see Features and Motion).
- The user's `landing-page-design` skill was not available in that session; the design rules listed under Interface rules were followed instead.

## Bug fixes (earlier session)

- Assets: cash, gold and house are now separate inputs and are split separately with totals (see Features). Before, only a free text list existed and only her own share was shown, with no total.
- Removing all assets left their old sum in the estate field; now it is cleared.
- AI form filling did not refresh a result already on screen; now it recalculates. It also wrote the estate into the read only field while assets were listed; now the assets are replaced from the story and the estate follows them.
- Printing: the "reason for each share" list was closed and so never printed; it is opened for the printout and restored afterwards.
- `server.js`: `.env` values kept trailing spaces (a key with a trailing space failed); malformed URLs and directory paths returned 502 instead of 400/404; bad JSON or an oversized body returned 502 and kept reading the body (now 400/413); a missing `GEMINI_API_KEY` returns 503 instead of 502.
- `.env.example` listed the wrong default model order.
- When AI form filling fails, the status line now says why: no key (503), key refused (400/401/403) or quota used up (429).
- Verified in headless Chromium on localhost:3000: English and Urdu, desktop and phone width (no horizontal scroll), no-AI fallback. Gemini re-tested with the new key: Roman Urdu, English and Urdu stories parse correctly, including cash 10 lakh / gold 5 tola 12 lakh / house 50 lakh, and "80 lakh total of which 20 lakh gold" (the app adds a 60 lakh Rest of the estate row). The explanation came back in Urdu with the code numbers (daughter 1,260,000 of 7,200,000). gemini-3.5-flash-lite and gemini-flash-lite-latest both answered.

## Next steps, in order

1. Open each link in the help list and confirm the details.
2. The new key (starts with AQ.) was pasted in chat: keep it only in .env and delete it in AI Studio after the hackathon.
3. Test voice input in Chrome with real Urdu speech (only tested with a recorded clip here).
4. Rehearse the full demo twice in Chrome.
5. If time allows: deploy (Cloud Run or Firebase Hosting with a function for the Gemini proxy) to earn Google technology marks.
6. Prepare slides: problem, who is affected, solution, the "code calculates, AI explains" split, SDG 5, technology stack, limitations, live demo.
7. Demo story to rehearse: father died; wife, 2 sons, 1 daughter; cash 1,000,000, gold 2,000,000 (10 tola), house 1,000,000. Daughter's share is 7/40 = 17.5%: cash 175,000, gold 350,000 (1.75 tola), house 175,000, total 700,000.

## Working notes

- The user is under time pressure; build first, explain briefly.
- Never ask for the API key in chat; the user puts it in `.env`.
- Do not add unsourced statistics to the submission or slides.
- `.env`, the rules PDF, the old proposal `.docx` and zip files are git-ignored.
