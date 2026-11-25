const tasks = [
  {
    "pair": "197-202",
    "title": "VR-14: Login form",
    "suites": [
      "Visual regression · Chromium",
      "Authentication Page",
      "authentication.vr.spec.ts"
    ],
    "records": {
      "Earlier Allure": [
        {
          "suites": [
            "Visual regression · Chromium",
            "Authentication Page",
            "authentication.vr.spec.ts"
          ],
          "title": "VR-14: Login form",
          "outcome": "passed"
        }
      ],
      "Later Allure": [
        {
          "suites": [
            "Visual Regression · Chromium",
            "Authentication Page",
            "authentication.vr.spec.ts"
          ],
          "title": "VR-14: Login form",
          "outcome": "passed"
        }
      ],
      "Later Playwright attempts": [
        {
          "file": "vr-tests/authentication.vr.spec.ts",
          "name": "VR-14: Login form",
          "project": "vr",
          "outcome": "passed"
        }
      ]
    },
    "links": {
      "Earlier Actions run": "https://github.com/ella79/agentic-playwright-suite/actions/runs/35463317148",
      "Later Actions run": "https://github.com/ella79/agentic-playwright-suite/actions/runs/35465472513",
      "Earlier Allure identities": "https://raw.githubusercontent.com/ella79/agentic-playwright-suite/279ee2ab4044eb08a4b6d2895736e7c7815b30e7/runs/197/data/suites.json",
      "Later Allure identities": "https://raw.githubusercontent.com/ella79/agentic-playwright-suite/279ee2ab4044eb08a4b6d2895736e7c7815b30e7/runs/202/data/suites.json",
      "Source comparison": "https://github.com/ella79/agentic-playwright-suite/compare/30e327cc...e98b2d1f",
      "Archived Playwright HTML": "https://github.com/ella79/agentic-playwright-suite/blob/279ee2ab4044eb08a4b6d2895736e7c7815b30e7/runs/202/playwright-report/index.html"
    },
    "assistant": {
      "identity": {
        "suites": [
          "Visual regression · Chromium",
          "Authentication Page",
          "authentication.vr.spec.ts"
        ],
        "className": "",
        "name": "VR-14: Login form"
      },
      "baseline": "passed",
      "candidate": "absent",
      "assessment": "possible report relabel",
      "candidateIdentity": {
        "suites": [
          "Visual Regression · Chromium",
          "Authentication Page",
          "authentication.vr.spec.ts"
        ],
        "className": "",
        "name": "VR-14: Login form"
      },
      "evidence": [],
      "nextCheck": "Compare suite labels and test declarations in both revisions to verify this correspondence."
    }
  },
  {
    "pair": "529-541",
    "title": "authenticate",
    "suites": [
      "Functional E2E · Chromium",
      "Authenticate",
      "login.setup.ts"
    ],
    "records": {
      "Earlier Allure": [
        {
          "suites": [
            "Functional E2E · Chromium",
            "Authenticate",
            "login.setup.ts"
          ],
          "title": "authenticate",
          "outcome": "failed"
        }
      ],
      "Later Allure": [],
      "Later Playwright attempts": [
        {
          "file": "utils/setup/login.setup.ts",
          "name": "authenticate",
          "project": "setup",
          "outcome": "passed"
        },
        {
          "file": "utils/setup/login.setup.ts",
          "name": "authenticate",
          "project": "setup",
          "outcome": "passed"
        },
        {
          "file": "utils/setup/login.setup.ts",
          "name": "authenticate",
          "project": "setup",
          "outcome": "passed"
        }
      ]
    },
    "links": {
      "Earlier Actions run": "https://github.com/ella79/agentic-playwright-suite/actions/runs/45145687097",
      "Later Actions run": "https://github.com/ella79/agentic-playwright-suite/actions/runs/45179710318",
      "Earlier Allure identities": "https://raw.githubusercontent.com/ella79/agentic-playwright-suite/cfd20eb1addf3a4f5456fd111d32b1339fc51dd6/runs/529/data/suites.json",
      "Later Allure identities": "https://raw.githubusercontent.com/ella79/agentic-playwright-suite/cfd20eb1addf3a4f5456fd111d32b1339fc51dd6/runs/541/data/suites.json",
      "Source comparison": "https://github.com/ella79/agentic-playwright-suite/compare/2254ffb3...238216b8",
      "Archived Playwright HTML": "https://github.com/ella79/agentic-playwright-suite/blob/cfd20eb1addf3a4f5456fd111d32b1339fc51dd6/runs/541/playwright-report/index.html"
    },
    "assistant": {
      "identity": {
        "suites": [
          "Functional E2E · Chromium",
          "Authenticate",
          "login.setup.ts"
        ],
        "className": "",
        "name": "authenticate"
      },
      "baseline": "failure",
      "candidate": "absent",
      "assessment": "matching runner result",
      "evidence": [],
      "runnerMatch": {
        "ref": "https://ella79.github.io/agentic-playwright-suite/runs/541/playwright-report/",
        "file": "utils/setup/login.setup.ts",
        "project": "setup",
        "observations": 3,
        "outcomes": [
          "passed"
        ]
      },
      "nextCheck": "Verify the supplied runner report belongs to the candidate run and inspect reporter filters for this file and title."
    }
  }
];
