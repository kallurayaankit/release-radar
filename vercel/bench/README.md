# ReleaseRadar missing-test benchmark

On 25 November 2026 we replayed 40 distinct public GitHub Actions runs from one Playwright project, in two windows of 20. Of 38 adjacent published comparisons, five contained missing report identities and 33 contained none. Git, junit2html and both versions of ReleaseRadar agreed on all 142 disappearances. The practical difference was what a tester could learn about each disappearance.

| Comparison | Missing identities | Evidence available for scoring |
|---|---:|---|
| 189 → 191 | 60 | Source and plan changes to page labels and title capitalization. The same TC/VR identifier appears once in the same browser in the candidate. [Diff](https://github.com/ella79/agentic-playwright-suite/compare/c83de1f6...059f4d90) |
| 197 → 202 | 20 | The upstream reporting contract and label fixture document the capitalization change in “Visual Regression”. [Diff](https://github.com/ella79/agentic-playwright-suite/compare/30e327cc...e98b2d1f) |
| 208 → 216 | 60 | A suite reorganization introduced 97 new identities. Individual equivalence would require reviewing assertions, selection and test bodies. These cases remain unscored. [Diff](https://github.com/ella79/agentic-playwright-suite/compare/1f05c99f...f144055a) |
| 245 → 247 | 1 | The setup test disappeared from Allure. Playwright recorded successful attempts. The change introduces report filtering. [Diff](https://github.com/ella79/agentic-playwright-suite/compare/808c87a2...9e87fa5a) |
| 529 → 541 | 1 | Allure last showed the setup test failing. The candidate Playwright report recorded three passed attempts for the same title and file in the setup project. [Actions run](https://github.com/ella79/agentic-playwright-suite/actions/runs/45179710318) · [report filter](https://github.com/ella79/agentic-playwright-suite/blob/238216b8/utils/scripts/prepare-allure-results.mjs) |

## Results

| Method | Result on the 82 adjudicated observations |
|---|---|
| Git exact diff and junit2html 31.1.4 matrix | Each identified all absences across the full corpus. These views expose report membership and leave causal interpretation to the tester. |
| Python difflib nearest newly added identity | Returned the right candidate for 80/82. Abstained on both runner-only cases. |
| ReleaseRadar at `ffeb43e` | 0/82 complete explanations. Identified removal of an old declaration literal in 19 and abstained on 63. |
| Revised ReleaseRadar | 82/82 supported findings with the expected counterpart or runner outcome. The outputs qualify relabels as possible and cite matching runner observations when supplied. |

The 82 observations span four transitions, two mechanisms and one repository. The design was informed by these cases. This is a development benchmark with correlated observations. Overall accuracy across the 142 gaps, performance on unseen projects, and end-to-end human time savings are unknown. Both ReleaseRadar versions returned 40 unresolved findings and 20 declaration-removal observations on the unscored reorganization. No behavior-level coverage or deletion is inferred from a missing report entry.

## Replay

Use a full Git checkout containing the frozen baseline, Node 24, Python 3.10+ and Git. From the repository root, run:

```sh
npm ci --prefix vercel
node vercel/bench/collect.mjs ../rr-history-benchmark development
node vercel/bench/collect.mjs ../rr-history-benchmark
python -m pip install junit2html==31.1.4
python vercel/bench/benchmark.py ../rr-history-benchmark --junit2html
```

The collector reads two immutable reporting-branch snapshots. It selects main-branch runs 186–247 and 470–556, deduplicates by Actions run URL, then compares adjacent retained reports within each window. Run numbers can have gaps. Results are Allure suite-tree leaves projected to JUnit with scope intact. Playwright observations come from attempt statuses in each saved HTML report's embedded ZIP. The collector downloads data and diffs. It does not execute upstream project code. [Earlier archive](https://github.com/ella79/agentic-playwright-suite/tree/279ee2ab4044eb08a4b6d2895736e7c7815b30e7) · [Later archive](https://github.com/ella79/agentic-playwright-suite/tree/cfd20eb1addf3a4f5456fd111d32b1339fc51dd6)

Git compares sorted full-identity manifests. junit2html compares equivalent flat JUnit records with the suite path encoded in classname to preserve browser and file identity. Difflib searches newly added identities with its standard 0.6 cutoff. Both ReleaseRadar engines receive identical JUnit and source diff inputs. Patches prioritize the named source file and label fixture within the MCP limit of 50,000 characters. The historical replay supplies projected candidate runner rows. MCP 1.1 can also read the source report using the workflow below.

Scoring requires the exact new report identity for a relabel, or the matching runner result and observed passing outcome for a reporter omission. The reference join uses upstream test-plan IDs plus browser, independently of the engine's title and file heuristic. This checks evidence correspondence. It does not prove semantic equivalence of test bodies. Timings printed by the replay cover in-process parsing and investigation. On the recorded pass they were 113 ms before and 99 ms after. Single-pass engine timings exclude downloads and human review.

## Public Playwright evidence in MCP 1.1

In an MCP client, read `releaseradar://examples/playwright` and pass its arguments to `inspect_playwright_test`. For your own public report, provide its raw GitHub HTML URL pinned to a full commit and the exact test title. The response groups recorded attempt outcomes by project, file, line, column and suite, including retries. It includes the SHA-256 of the retrieved HTML. Confirm the archive belongs to the candidate Actions run. A hash identifies the bytes retrieved.

To investigate an absence directly, call `investigate_missing_test` with the two JUnit XML inputs, the original identity and `publicReportUrl`. The server fetches the report and projects matching observations. JUnit source-file attributes can identify the file even when the suite is labeled differently. Ambiguous source locations do not establish a runner match. Input is limited to 4 MiB of HTML containing an inline Playwright archive, 16 MiB expanded, and 500 matching attempts. Private reports can continue to use locally projected rows.

The cross-project replay uses two published Playwright reports from outside the development corpus. Python's ZIP reader independently reconstructs their location and outcome tables. The importer reproduced all 16 attempts for 12 titles. With a deliberately withheld JUnit entry, 10 unique locations matched, two ambiguous titles remained unresolved, and two absent-title controls yielded zero observations. All 16 observed attempts passed. Separate regression fixtures exercise retries and failures. These results measure import fidelity and controlled matching. They do not estimate accuracy on naturally missing tests across these projects. [Archived multi-browser run](https://github.com/mishiwata1015/playwright-report-to-gh-pages/actions/runs/4073224816) · [Archived Chromium run](https://github.com/ifeelBALANCED/cron-playwright/actions/runs/21627676040)

```sh
python vercel/bench/playwright-replay.py ../rr-public-reports
```

## Timed tester exercise

Open [the participant exercise](exercise.html) with [its data file](exercise-data.js) beside it, or serve the production build at `/studies/missing-tests/`. Only the two participant files are required. Compact source report records are available offline. The full public evidence links require internet access.

1. Give each tester a pseudonym and assign groups A, B, C and D in randomly shuffled blocks of four. Keep the benchmark results and answer key with the organizer. Recruit testers who have not reviewed these cases.
2. Each person handles one case manually and the other with a precomputed MCP finding. Both conditions provide the same source links and title-filtered report records. Four sequences balance case order and which case receives assistance. The timer starts when a case opens and stops at submission. Participants choose an explanation, cite evidence and download their local JSON. They can abstain.
3. Record interruptions and prior exposure separately. Declare exclusions before viewing results. Count incorrect answers and abstentions in accuracy and all-attempt timing. Only complete paired sessions enter this pilot analysis.
4. Put exported files in a local directory. Generate a review sheet, then have a reviewer mark whether the citation supports the chosen answer. The sheet omits participant code, condition and time. For 197–202 look for the old/new project spelling with the same case, or the corresponding label-fixture change. For 529–541 require evidence that the candidate runner recorded the setup case and its outcome. A claim of code deletion does not meet either criterion.

```sh
python vercel/bench/study.py sessions --blind-sheet reviews.csv
# Fill supported_0_or_1 for every row, then run
python vercel/bench/study.py sessions --ratings reviews.csv
```

Report the number correct and median elapsed seconds per case and condition, and include the median among correct answers. The summary computes manual minus assisted time separately per case, then averages those two differences. Positive values favor assistance. With only two cases, publish this as a pilot. It measures triage with evidence prepared in advance. Artifact discovery, MCP setup and evidence ingestion require a separate end-to-end study.
