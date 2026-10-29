# TierOne: IT Support Simulator

A free, browser-based training simulator for IT service desk / help desk work. You join the service desk at the fictional **Harbor & Pine Logistics** and work realistic tickets with real troubleshooting tools, take spoken phone calls, run timed shifts under SLA pressure, and practice job interviews.

Everything runs locally in the browser. No account or backend is needed, and progress is saved to `localStorage`.

## Features

| Area | What you get |
| --- | --- |
| 🖥️ **Workstation flow** | Work tickets the way a real service desk does, across separate apps. **Ticketing**: pick a ticket from the queue, assign it to yourself, talk to the requester in a live chat (typing indicators, timestamps and read receipts; small talk and free-typed questions understood; canned responses; internal work notes; identity verification; "ask the user to…" steps). The requester has a mood: they chase you if you go quiet, notice when you connect to or restart their computer without asking, and grow impatient, which shows up in customer satisfaction. Email and portal requesters reply later rather than instantly. A first-reply target (one minute for chat and phone, three for email and portal) and a saved transcript on the review page complete it. **Ticket details**: set category, impact and urgency; some tickets are logged at the wrong priority and need correcting. **Several tickets at once** (up to three), with **On hold** (awaiting user, approval or vendor) that pauses the clock. **Similar tickets** from other users on outages can be linked and everyone updated at once. Confirm the fix, then resolve with a root cause, notes and a closing message. **Directory**: search people, then Overview, Authentication (unlock, reset password, enable/disable, MFA, sessions), Groups (add/remove), Mailbox (archive, shared mailbox access), Devices (BitLocker key, remote wipe), Tickets (the user's earlier tickets) and Sign-in log. **Approvals**: access, mailbox and software sign-offs. **Assets**: laptops, docks and phones with owner and warranty, plus loaner and spares stock. **Server room**: live status of shared servers and switches; restart a stopped service or reboot. **Remote desktop**: sign in to a simulated desktop on the user's device, with windows you can drag, resize and snap; Start menu search; right-click menus; tray quick settings and notifications; File Explorer, Mail, Web Browser, Task Manager, Notepad, Settings and a PowerShell terminal (`ipconfig`, `ping`, `nslookup`, `cmdkey`, …). What you find and fix there follows the ticket. **Deployment**: push approved packages. A bar at the top keeps the active ticket one click away while you switch apps. 32 scenarios across Accounts, Network, Hardware, Software, Email and Security. |
| 🧮 **Detailed grading** | The ticket only scores well if the fix was actually done in the right tool and confirmed with the user. Seven-part score (Diagnosis, Resolution, Investigation, Process & Security, Communication, Documentation, Handling Time), letter grade, customer-satisfaction stars, an ideal-path walkthrough and a "why it matters" debrief. |
| 🔁 **Follow-up** | A resolution that was never applied, recorded the wrong cause, or wasn't confirmed comes back a few minutes later as a **Reopened** ticket. Escalations get a response from the receiving team: accepted, returned for thin notes, or bounced to the right team. Write a **knowledge base article** from any solved ticket. |
| 🔐 **Security realism** | Identity verification policy, social-engineering (vishing) and phishing scenarios. Making sensitive changes for unverified callers is caught and penalised. |
| ⏱️ **Shift mode** | Tickets arrive over 15/25/40 minutes with per-priority SLA clocks; urgent arrivals and VIPs interrupt you; juggle several at once; end-of-shift report with breaches and misses. |
| 🎓 **Coach & certification** | A step-by-step coach on tickets (can be hidden). A five-ticket **certification exam** across five categories, without hints, earns a printable certificate. The recommended ticket adapts to your recent scores. |
| 📞 **Voice calls** | Six branching phone calls with **spoken callers** (Web Speech API), a live mood meter and per-choice coaching. Phone-channel tickets also read the caller's replies aloud. |
| 💼 **Mock interviews** | 23 service desk interview questions, timed, with optional **speech dictation**; feedback on covered key points plus sample answers. |
| 📖 **Knowledge base** | 35 original runbooks and policies, searchable and linked from each ticket, plus the articles you write. |
| 📈 **Progress** | XP, a seven-rank career ladder, 18 badges, skill breakdown with a focus recommendation, history, and a printable training record. |
| 🛠️ **Scenario builder** | Author your own tickets as JSON with live validation; import/export packs to share with a class or team. |
| 💡 **Hints** | A hint engine suggests your next best step (−3 points each, can be turned off). |
| ⌨️ **Quick to use** | **Ctrl/⌘ K** searches and jumps to any ticket, person, device, article or page. Keyboard shortcuts (press **?**): `g` then a letter to switch apps, `c` / `n` / `r` on a ticket. Unsent replies and resolve forms are kept per ticket. Queue filters stay in the address, so Back returns to the same list. |
| 🌓 **Polish** | Light/dark themes, three text sizes, a labelled menu on phones, skip link and focus that follows page changes, export/import progress. |

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
  pages/           Dashboard, Queue, TicketPage, Directory, ServerRoom, RemoteDesktop, Deployment, TicketReview, Shift, Calls, CallSession, Interview, KB, Progress, Builder, Settings
  components/      Layout, UI primitives, workstation pieces (active ticket bar, action lists, terminal), speech hooks
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
