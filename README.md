# TierOne: IT Support Simulator

A free, browser-based training simulator for IT service desk / help desk work. You join the service desk at the fictional **Harbor & Pine Logistics** and work realistic tickets with real troubleshooting tools, take spoken phone calls, run timed shifts under SLA pressure, and practice job interviews.

Everything runs locally in the browser. No account or backend is needed, and progress is saved to `localStorage`.

## Features

| Area | What you get |
| --- | --- |
| 🎫 **Ticket workspace** | 21 scenarios across Accounts, Network, Hardware, Software, Email and Security. Investigate with a **chat** (suggested questions *or* free-typed messages), a **Directory** tool (account status, groups, MFA, mailbox, sign-in log), an **Endpoint** manager (device health, remote actions), a **remote terminal** (`ipconfig`, `ping`, `nslookup`, `cmdkey`, `Get-PrintJob`, …) and **guided steps** you ask the user to do. Actions change state: fix the cable and `ipconfig` shows a real address. |
| 🧮 **Detailed grading** | Seven-part score (Diagnosis, Resolution, Investigation, Process & Security, Communication, Documentation, Handling Time), letter grade, customer-satisfaction stars, an ideal-path walkthrough and a "why it matters" debrief. |
| 🔐 **Security realism** | Identity verification policy, social-engineering (vishing) and phishing scenarios. Making sensitive changes for unverified callers is caught and penalised. |
| ⏱️ **Shift mode** | Tickets arrive over 15/25/40 minutes with per-priority SLA clocks; end-of-shift report with breaches and misses. |
| 📞 **Voice calls** | Six branching phone calls with **spoken callers** (Web Speech API), a live mood meter and per-choice coaching. |
| 💼 **Mock interviews** | 23 service desk interview questions, timed, with optional **speech dictation**; feedback on covered key points plus sample answers. |
| 📖 **Knowledge base** | 25 original runbooks and policies, searchable and linked from each ticket. |
| 📈 **Progress** | XP, a seven-rank career ladder, 18 badges, skill breakdown with a focus recommendation, history, and a printable training record. |
| 🛠️ **Scenario builder** | Author your own tickets as JSON with live validation; import/export packs to share with a class or team. |
| 💡 **Hints** | A hint engine suggests your next best step (−3 points each, can be turned off). |
| 🌓 **Polish** | Light/dark themes, responsive down to phone width, export/import progress. |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # Vitest: content validation + engine tests
npm run typecheck
npm run build      # production build to dist/
npm run preview    # serve the production build
```

The build uses a relative base path and hash routing, so `dist/` can be hosted from any static host or sub-path.

### Deploying to GitHub Pages

`.github/workflows/ci.yml` runs tests and the build on every push and pull request, and deploys `dist/` to GitHub Pages on pushes to `main`. To enable it, open **Settings → Pages** in the repository and set **Source** to **GitHub Actions**.

## Project structure

```
src/
  data/            Content: scenarios/, actions catalog, calls, interview questions, KB articles
  engine/          Pure logic: session reducer, terminal simulator, grading, hints, shifts, progress, validation
  state/           App store (React context + reducer) and localStorage persistence
  pages/           Dashboard, Queue, TicketWorkspace, TicketReview, Shift, Calls, CallSession, Interview, KB, Progress, Builder, Settings
  components/      Layout, UI primitives, speech (text-to-speech / dictation) hooks
```

## Writing scenarios

Scenarios are data, so you can add one without touching the engine. Open **Scenario Builder** in the app, start from the template or copy a built-in ticket, then **Validate & save**. Key fields:

- `facts` / `keyFacts`: evidence the trainee should uncover. Reveal facts through `questions[].reveals`, `terminal[cmd].reveals`, `signInLog.reveals`, `toolReveals` or `actionResults[id].reveals`.
- `requiredActions`, `helpfulActions` and `harmfulActions` use ids from `src/data/actions.ts`. Write `"a|b"` when either action is acceptable.
- `actionResults[id]` can override result text and change state with `deviceUpdate` / `accountUpdate`.
- `terminal[cmd].whenDone` changes a command's output once an action has been performed.
- `rootCauses`, `correctRootCause`, `correctOutcome` (+ `escalateTo`), `noteKeywords` and `replyKeywords` drive grading.

To add a built-in scenario, put it in `src/data/scenarios/*.ts`. The test suite validates every scenario and plays its ideal path to make sure each one is solvable for an A.

## Disclaimer

TierOne is an independent, original project. All companies, people, tickets, calls and articles are fictional and were written for this project. It is not affiliated with any other simulator product.
