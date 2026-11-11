# Wirasat Saathi — Know Your Share, Claim Your Right

An Urdu-first web app that tells a woman her inheritance share and what to do next.
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

**AI never calculates the shares.** Gemini is used only to understand language and to explain. The numbers come from auditable, tested code.

## Technology

| Part | Technology |
|---|---|
| Language understanding and Urdu explanation | Google Gemini API |
| Voice input | Browser speech recognition (Urdu, Chrome) |
| Share calculator | Plain JavaScript, exact fractions, `public/calc.js` |
| Server | Node.js, no dependencies, `server.js` |
| Front end | HTML, CSS, JavaScript, Noto Nastaliq Urdu (Google Fonts) |

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

## Scope and limitations

- Sunni Hanafi rules, close heirs only: spouse, parents, sons, daughters, full brothers and sisters.
- Other schools of law, non-Muslim families, grandchildren, grandparents and half or step relatives are not covered. The app says so and refers the user to a scholar or lawyer.
- The output is guidance, not a legal ruling or a religious fatwa.
- The next steps are general guidance written by AI and must be confirmed with the relevant office.
- No names, CNIC numbers or other identifiers are collected, and nothing is stored.
- This is a hackathon prototype, not a production service.

## AI disclosure

Gemini is used inside the app as described above. AI coding tools (Claude) were used to help write the code during the hackathon.

## Team

Awais Ali Asad, Ayesha Qaisar Cheema
