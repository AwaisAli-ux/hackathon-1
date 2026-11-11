# Wirasat Saathi — Know Your Share, Claim Your Right

An Urdu and English web app that tells a woman her inheritance share and what to do next.
Built for the Build with Google Hackathon (GDGoC CUI, CUI Tech Fest FA'26).

- **Domain:** Women's Empowerment
- **SDG:** 5 (Gender Equality) — primary; also supports SDG 10 and SDG 16

## Problem

Many women in Pakistan do not receive their rightful inheritance. A major reason is lack of knowledge: a daughter, widow, mother or sister often does not know what fraction she is entitled to, and does not know the practical next step to claim it.

## Solution

1. **Describe the family by voice or text** in plain Urdu. Gemini turns it into a structured form, which the user reviews and confirms.
2. **Deterministic calculation.** A rule-based calculator in plain JavaScript (no AI) works out each heir's share as an exact fraction, percentage and rupee amount.
3. **Explanation in simple Urdu.** Gemini explains the result using only the numbers the calculator produced.
4. **Action plan.** Next steps for claiming the share, and a draft written request.

Also in the tool:

- **Fairness checker:** enter what the family is offering and see how far it falls short of the rightful share.
- **Family map:** an interactive picture of the family with each heir's share and the reason for it.
- **Asset split:** enter cash, gold (value and tola) and house separately, plus any other asset. Each is divided on its own for every heir, with a total per heir and a total for the whole estate at the end.
- **Question chat:** ask follow up questions; Gemini answers from the calculated case.
- **Share and print:** send the draft request on WhatsApp, or print the result as a report.
- **Before division:** funeral costs, then debts, then a will (capped at one third of what is left after debts) are taken out first; only the rest is divided.
- **If one heir keeps the house:** choose the asset and who keeps it (for example the brothers); the app shows what they must pay each other heir in money.
- **Voice in, voice out:** speak the story (Gemini writes it down in Urdu script, English or Roman Urdu); press Listen to hear the explanation read aloud by Gemini's voice.
- **Photo of a paper:** take a picture of a handwritten family list or note; Gemini reads it into the form for the user to check.
- **Where to get help:** official offices (Punjab women helpline 1043, Ombudsperson Punjab, NADRA succession certificate, police 15), each linked to its official page.
- **English, Urdu and Roman Urdu** (dropdown), light and dark mode.

**AI never calculates the shares.** Gemini is used only to understand language and to explain. The numbers come from auditable, tested code.

## Technology

| Part | Technology |
|---|---|
| Language understanding and Urdu explanation | Google Gemini API (text) |
| Reading a photo of a paper | Gemini API (image input) |
| Voice input | Gemini API (audio input); browser speech recognition as fallback without a key |
| Read aloud | Gemini text to speech; browser voice as fallback |
| Share calculator | Plain JavaScript, exact fractions, `public/calc.js` |
| Server | Node.js, no dependencies, `server.js` |
| Front end | HTML, CSS, JavaScript; English and Urdu, light and dark mode; Manrope and Noto Nastaliq Urdu (Google Fonts), Phosphor icons |

## Run it

Needs Node.js 18 or newer. There is nothing to install.

1. Copy `.env.example` to `.env` and paste a Gemini API key from Google AI Studio.
2. Start the server:

```bash
npm start
```

3. Open http://localhost:3000 in Chrome.

Without a key the calculator still works; the AI steps fall back to a fixed general guide.

Run the calculator tests:

```bash
npm test
```

## Deploy to Google Cloud Run (optional)

Not done yet. To deploy from the Google Cloud console: Cloud Run → Create service → Continuously deploy from a repository (GitHub, this repo) → build type Dockerfile → allow unauthenticated invocations → under Variables and secrets add `GEMINI_API_KEY` → Create. Only list Cloud Run in the technology table once it is live.

## Scope and limitations

- Sunni Hanafi rules, close heirs only: spouse, parents, sons, daughters, full brothers and sisters.
- Other schools of law, non-Muslim families, grandchildren, grandparents and half or step relatives are not covered. The app says so and refers the user to a scholar or lawyer.
- The output is guidance, not a legal ruling or a religious fatwa.
- The next steps are general guidance written by AI and must be confirmed with the relevant office.
- No names, CNIC numbers or other identifiers are asked for, and nothing is stored. Text, voice recordings and photos are sent to Google Gemini only to fill the form or read aloud, and are not saved by the app.
- The help list was taken from official websites; numbers and services can change, so confirm on the linked page.
- This is a hackathon prototype, not a production service.

## AI disclosure

Gemini is used inside the app as described above. AI coding tools (Claude) were used to help write the code during the hackathon.

## Team

Awais Ali Asad, Ayesha Qaisar Cheema, Dua Fatima
