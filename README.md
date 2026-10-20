# ReleaseRadar

Live demo: https://releaseradar-sydney-demo.glossychar1.chatgpt.site/

A working regression-testing demo with a live AI guide, an animated galaxy backdrop, and accessible rocket button effects.

A focused Builder Day prototype: existing tests pass on a correct checkout and a deliberately buggy checkout. New tests expose the missing discount interaction; unchanged assertions then verify the fix.

## Ask Radar

The **Ask Radar** button opens a keyboard-accessible guide for beginners. Suggested questions explain project ideas, the current demo step, requirements, challenges, and evidence. **Built-in help** is a prepared, browser-only guide, available on the hosted site without a key. **Live AI** on the configured local or hosted server supports follow-up conversation using the existing OpenAI model. Sending in that mode transmits recent messages and visible demo status to OpenAI through the server-side Responses API; the key never reaches the browser. Chat is held in page memory only and clears on reload or New chat. The guide offers navigation but does not execute tests, build arbitrary apps, or change assertions. Failed live requests remain visible and restore the question; there is no silent fallback.

To check one actual live chat request: `$env:RUN_LIVE_AI='1'; npm run test:e2e -- guide.spec.js -g 'live Radar'`.

## Challenge workflow

Use the **Challenge my tests** navigation link for the audience round. The original four-step demo remains available.

1. Choose a case source and **Freeze test suite**. Prepared mode starts with the original three tests. Live initial generation receives only the requirement and original cases, not the diff, challenge implementations, or audience selection.
2. Choose an audience spotlight. **Run all challenges** executes the identical frozen assertions against the correct build, three injected bugs (discount order, exact threshold, rounding), and the corrected build. The spotlight only highlights a result; all variants run.
3. The prepared starter detects **1 of 3** bugs. Choose **Propose gap tests**, review the requirement calculations, freeze the expanded suite, and rerun. Prepared additions detect **3 of 3**. Live/imported outcomes are measured, not promised. Original assertions are retained across rounds; only additions are permitted.
4. Export an HTML evidence report, JSON containing the checkout source and observed DOM, a standalone Node replay, or a frozen Playwright spec. Run the replay with `node releaseradar-replay.mjs`; it checks captured calculation results and SHA-256 fingerprints, not browser rendering. Run the Playwright spec against this app with `CHECKOUT_VERSION` set to `correct`, `buggy`, `boundary`, `rounding`, or `fixed`. Failures on injected bugs are expected evidence.

SHIPPING-001 derives each expected shipping amount from integer-cent inputs independently of the checkout implementation. Contradictory expectations cannot freeze. This oracle assumes the supplied requirement is correct. Runner errors or failing correct-build controls produce **inconclusive**, not a detection. SHA-256 fingerprints identify captured fixture and suite versions; they are not signatures or proof against tampering. Three injected bugs are not a market benchmark or a release safety score.

The hosted app supports prepared/imported challenge cases. Live generation requires the local `.env` server. After the initial run, repair prompts include completed observations. AI errors never silently substitute prepared results. To check the live repair workflow explicitly: `$env:RUN_LIVE_AI='1'; npm run test:e2e -- challenge.spec.js -g 'live AI expands'`.

**30-second audience extension:** “Pick a challenge. These tests are already frozen. We caught one bug, but two got through. Now we can propose additions, keep the old assertions, and measure whether the gaps close. Here is the report and the exact calculation replay.”

## Start locally

Requires Node.js 22.10+ (Node 24 recommended). No dependencies are needed to run the app.

```powershell
cd releaseradar
npm start
```

Open http://127.0.0.1:4173. Run **existing tests → prepare missing tests → run on both builds → apply fix & rerun**. Presenter notes and a presentation view are built in.

## What is real

- The checkout executes actual JavaScript and renders a real receipt.
- The dashboard fills forms, clicks the calculate button, and checks rendered shipping text in same-origin browser iframes. Results are calculated, not simulated.
- The bug is seeded intentionally: the shipping threshold uses the subtotal before discounts.
- The corrected implementation uses the subtotal after discounts. Applying the fix switches to this implementation; it does not ask AI to modify source code at runtime.
- Prepared cases were authored by Codex during development. They are clearly labelled and are not represented as live AI generation.
- Live AI generation is optional on the local server. The hosted version supports prepared cases and imported AI output.
- Imported JSON is validated as data. No imported code is executed.
- The app exports a runnable Playwright spec and JSON evidence with timestamps, expectations, observed outcomes, and receipt DOM snapshots. In-app runs are DOM checks, not Playwright runs; the exported spec runs separately.
- Scope is one supplied checkout requirement, diff and fixture, not arbitrary repository analysis, a release approval system, or a comprehensive test platform.

## Live generation (optional)

Copy `.env.example` to `.env` and configure `OPENAI_API_KEY` privately on this machine. Set `OPENAI_MODEL` to a model available to your API account (default `gpt-4.1`); no Astra API identifier is assumed. Restart the server. The Live AI option becomes available. Requests send only the supplied demo requirement, diff, and baseline cases to the OpenAI Responses API using structured outputs. Credentials remain server-side. Errors never silently substitute prepared cases.

API reference: https://developers.openai.com/api/docs/guides/structured-outputs

Without an API key, select **Import JSON from Codex / Astra**, copy the generation prompt, run it in your event-provided tool, then paste the returned JSON. This is the intended way to use Astra access supplied at the event without assuming it exposes an API.

## Verification

```powershell
npm test
npm install
npm run test:e2e
```

On Windows the test configuration uses the installed Microsoft Edge browser. On other platforms, run `npx playwright install chromium` first. To run a downloaded generated spec, save it in `e2e/` and run it by name. Set `$env:CHECKOUT_VERSION='correct'`, `'buggy'`, or `'fixed'`. The generated regression spec is expected to fail on `buggy`; this is the demonstration, not a broken harness.

## Two-minute script

For the event, run `npm start` and use **http://127.0.0.1:4173**. The public hosted URL supports prepared/imported test cases and live AI chat. The local header reads **AI key configured** before a request and **Live AI verified** after a successful response. The latter confirms a request succeeded, not that the generated assertions are correct.

Choose **Live AI** after the baseline run. Review the cases before running them. Use **Test cases** to download a JSON backup that can later be pasted into Import mode. The **Moment of proof** card shows a genuinely reproduced case and its observed shipping amounts, making the contrast easy to explain on stage. It appears only after new tests pass on the correct build and expose the buggy build.

To explicitly rerun the paid live browser check locally:

```powershell
$env:RUN_LIVE_AI='1'
npm run test:e2e -- live.spec.js
```

This makes one generation request. Keep `npm start` running separately so it loads your `.env`. Normal browser test runs skip the paid check.

1. “A green test suite only tells us the tests we wrote passed.” Run the original tests; both builds are green.
2. Show the requirement and diff. “Shipping should use the subtotal after discounts. Our tests never apply a discount.”
3. Load prepared cases or generate/import live. State the source honestly. “For a $110 cart with a $20 discount, we should charge $10 shipping.”
4. Run the same new tests against both builds. Correct passes; buggy fails. “This test detects a real behavioral difference.”
5. Apply the prepared fix and rerun. “The assertions did not change. The implementation did.”

The strongest evidence is the contrast between builds, not an invented confidence score. The demo does not guarantee a safe release.

## Hosted chatbot

Run `node scripts/build-hosted.mjs` to package the static UI and Worker. The hosting manifest binds D1 as `DB`; migrations in `drizzle/` create the quota table. Configure `OPENAI_API_KEY` as an encrypted Site secret, `OPENAI_MODEL=gpt-4.1`, `CHAT_ENABLED=true`, and `CHAT_DAILY_LIMIT=300`. Never include secrets in the browser bundle or source. Hosted chat allows six requests per visitor per minute and 300 requests globally per UTC day; failed upstream requests also count. Chat messages are not persisted by this app.
