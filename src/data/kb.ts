import type { KbArticle } from '../types';

/**
 * Lightweight markdown: "## " headings, "- " bullets, "1. " numbered steps, **bold**, `code`.
 */
export const KB_ARTICLES: KbArticle[] = [
  // ---------- General practice ----------
  {
    id: 'kb-identity',
    title: 'Identity verification policy',
    category: 'General',
    tags: ['security', 'policy', 'password', 'mfa', 'vip'],
    body: `Before any **sensitive change** (password reset, unlock, enable account, MFA reset) you must verify the requester.

## Accepted verification
- Employee ID **and** manager name, matched against the directory
- A callback to the phone number **already on file** (never a number the caller gives you)
- Verified request through the self-service portal while signed in

## Red flags
- Urgency combined with authority ("the CEO needs this NOW")
- Refusing a callback or asking you to read out a password
- Calling on behalf of someone else
- Requester not found in the directory

## If verification fails
1. Politely decline. Policy applies to everyone, VIPs included.
2. Offer the verified alternatives above.
3. Log the call details and escalate to **Security Operations** if anything feels off.`,
  },
  {
    id: 'kb-ticket-notes',
    title: 'Writing great ticket notes',
    category: 'General',
    tags: ['documentation', 'notes', 'quality'],
    body: `Work notes are written for the **next technician**, and for you in six months.

## A good note covers
- **Symptom**: what the user reported, in their words if useful
- **Findings**: evidence you gathered (errors, IPs, log entries, versions)
- **Cause**: the root cause, or the most likely one
- **Actions**: what you changed, with references (approvals, change numbers)
- **Result**: how you confirmed it works, or why you escalated

## Example
\`User locked out x3 since pwd change Mon. Sign-in log: ActiveSync failures from iPhone Mail. Verified ID (emp 40217 + mgr). Unlocked acct, guided user to update pwd in phone mail app. No new failures after 10 min. Resolved.\``,
  },
  {
    id: 'kb-customer-comms',
    title: 'Customer communication essentials',
    category: 'General',
    tags: ['communication', 'empathy', 'reply', 'csat'],
    body: `Users judge IT on **how they felt**, not just whether the fix worked.

## Every reply should
- Greet the user by name
- Acknowledge the impact ("I know you have interviews this afternoon")
- Explain the cause in plain language, without jargon or blame
- State what you did and anything they need to do next
- Close warmly and invite them to reply if it happens again

## Avoid
- Blame ("you should have...")
- Jargon dumps ("your DHCP lease failed due to L1 link loss")
- Promises you can't keep ("it'll be fixed in 5 minutes")`,
  },
  {
    id: 'kb-priority',
    title: 'Priority matrix (impact × urgency)',
    category: 'General',
    tags: ['priority', 'sla', 'triage'],
    body: `## Priorities
- **P1 (Critical)**: many users or a critical business function down; security incident in progress. Response 15 min.
- **P2 (High)**: one user fully blocked with a time-critical need, or a VIP. Response 1 h.
- **P3 (Medium)**: one user impaired, with a workaround available. Response 4 h.
- **P4 (Low)**: requests, how-to questions, cosmetic issues. Response 1 business day.

## Tips
- Priority is about **business impact**, not who shouts loudest.
- Re-assess priority when you learn more (one PC turns out to be the whole floor).`,
  },
  {
    id: 'kb-escalation',
    title: 'Escalation matrix: who handles what',
    category: 'General',
    tags: ['escalation', 'teams', 'tier 2'],
    body: `Escalate when the fix needs access, skills or presence that tier 1 doesn't have, **after** gathering evidence.

## Teams
- **Tier 2 Desktop**: complex OS/app problems, profile rebuilds, persistent crashes
- **Network Team**: switches, Wi-Fi infrastructure, firewalls, multi-user outages
- **Security Operations**: phishing with compromise, social engineering, malware, suspicious activity
- **Application Support**: line-of-business apps, licensing, application servers
- **Field Services**: hardware replacement, on-site visits, branch deliveries
- **Identity & Access**: privileged access, complex group/role design, HR-driven account changes

## A good escalation includes
- Clear summary and business impact
- Steps already taken and their results
- Evidence (logs, errors, screenshots)
- User availability and contact details`,
  },
  {
    id: 'kb-major-incident',
    title: 'Major incident procedure',
    category: 'General',
    tags: ['p1', 'outage', 'major incident', 'network'],
    body: `A **major incident** is any outage affecting many users or a critical service.

1. Scope quickly: who, where, since when, what still works?
2. Look for shared infrastructure (same floor = same switch, same app = same server).
3. Raise a P1 and escalate to the owning team **immediately**, with evidence.
4. Link related tickets to the parent incident instead of troubleshooting each one.
5. Give affected users an update cadence (e.g. every 30 minutes).

Don't send 25 people to restart their PCs. That wastes their time and destroys evidence.`,
  },

  // ---------- Accounts ----------
  {
    id: 'kb-lockouts',
    title: 'Troubleshooting repeated account lockouts',
    category: 'Accounts',
    tags: ['lockout', 'password', 'activesync', 'mobile'],
    body: `Repeated lockouts usually mean **something is still using an old password**.

## Common sources
- Phone / tablet mail apps (ActiveSync)
- Saved Wi-Fi profiles (802.1X)
- Mapped drives with stored credentials
- Scheduled tasks or services running as the user

## Steps
1. Verify identity.
2. Open the **sign-in log** and look at the source of the failures.
3. Unlock the account.
4. Fix the source: update or remove the saved password on that device.
5. Watch the log for a few minutes to confirm no new failures.`,
  },
  {
    id: 'kb-password-remote',
    title: 'Password resets for remote users',
    category: 'Accounts',
    tags: ['password', 'expired', 'vpn', 'remote'],
    body: `Laptops cache the domain password. When it expires off-site, Windows can't change it without a domain controller, and the VPN won't accept an expired password.

1. Verify identity (callback to the number on file).
2. Reset the password; deliver it via a verified channel (SMS to the registered mobile).
3. User signs in to the **VPN** with the new password.
4. While on VPN, user presses **Ctrl+Alt+Del > Lock**, then unlocks with the new password. This syncs the cached credential.
5. Confirm Outlook/Teams sign in normally.`,
  },
  {
    id: 'kb-access-requests',
    title: 'Shared folder & group access requests',
    category: 'Accounts',
    tags: ['access', 'group', 'permissions', 'approval'],
    body: `Access to shared data is granted through **security groups**, never by editing folder permissions per user.

1. Confirm approval from the **data owner** (or manager, depending on the folder).
2. Identify the correct group (e.g. FIN-Reports-RW for read/write).
3. Add the user and reference the approval in the ticket.
4. The user must **sign out and back in** (or restart) to receive the new group in their token.
5. Confirm access.

Never grant local admin or broader access "to be safe".`,
  },
  {
    id: 'kb-mfa',
    title: 'MFA re-registration (lost or replaced phone)',
    category: 'Accounts',
    tags: ['mfa', 'authenticator', 'new phone'],
    body: `An MFA reset is a **high-risk** change, so strong verification is mandatory.

1. Verify identity (ID + manager, or callback to the number on file).
2. Confirm the old device is unavailable.
3. Clear the user's MFA methods and issue a **Temporary Access Pass** to the verified number.
4. Guide enrollment of the authenticator on the new device.
5. Recommend a **backup method** (SMS or a second device).`,
  },

  // ---------- Network ----------
  {
    id: 'kb-apipa',
    title: '169.254.x.x addresses (APIPA)',
    category: 'Network',
    tags: ['apipa', 'dhcp', '169.254', 'no internet', 'ipconfig'],
    body: `A **169.254.x.x** address means the device asked for an IP via DHCP and got **no reply**.

## Single user? Check the physical layer first
- Is the cable seated? Are there link lights on the port/dock?
- Was the desk or dock recently moved?
- Try another cable or port.

## Many users in one area?
Suspect the switch or DHCP. Escalate to the **Network Team** (see Major incident procedure).

## Useful commands
- \`ipconfig\`: show address
- \`ipconfig /release\` then \`ipconfig /renew\`: request a new lease
- \`ping 10.20.0.1\`: test the gateway`,
  },
  {
    id: 'kb-dns',
    title: 'One website fails for one user (DNS cache)',
    category: 'Network',
    tags: ['dns', 'cache', 'nslookup', 'flushdns'],
    body: `When a service moves to a new server, devices may keep resolving the **old IP** from their local DNS cache.

## Diagnose
- \`ping host\` uses the **local cache**: note the IP it shows.
- \`nslookup host\` asks the **DNS server** directly.
- Different IPs mean a stale cache. \`ipconfig /displaydns\` shows the cached record.

## Fix
- \`ipconfig /flushdns\` (or a restart), then retry.`,
  },
  {
    id: 'kb-vpn',
    title: 'VPN certificate errors after gateway renewal',
    category: 'Network',
    tags: ['vpn', 'certificate', 'client', 'update'],
    body: `The VPN gateway certificate was renewed. Clients older than **5.1** do not trust the new certificate chain and fail with *0x800B0109* or "certificate could not be validated".

1. Check the VPN client version in Endpoint Manager.
2. If below 5.1, **deploy the latest VPN client** remotely (works over the internet management channel).
3. User reconnects.

Do not grant local admin so the user can install it themselves.`,
  },

  // ---------- Hardware ----------
  {
    id: 'kb-printing',
    title: 'Print jobs stuck in the queue',
    category: 'Hardware',
    tags: ['printer', 'queue', 'spooler'],
    body: `## Scope first
- Can others print to the same printer? If yes, the problem is on this PC.
- Does the printer show errors or jams?

## Fix a stuck local queue
1. Check the queue (\`Get-PrintJob\`). Look for "Error - Printing".
2. **Clear the print queue.**
3. If jobs won't delete, restart the **Print Spooler** service, then clear again.
4. Ask the user to resend. Suggest splitting very large PDFs.`,
  },
  {
    id: 'kb-hardware-replacement',
    title: 'Hardware failures & replacements',
    category: 'Hardware',
    tags: ['laptop', 'power', 'adapter', 'replacement', 'field services'],
    body: `## "Laptop is dead"
1. Check the adapter LED and try another outlet.
2. Inspect the cable for damage. **Frayed cables are a safety hazard: stop using them.**
3. Try a known-good adapter of the same model.
4. If a spare works: the adapter failed. Escalate to **Field Services** for a replacement.
5. If nothing works: escalate for device repair/swap.

Branches without on-site IT: Field Services ships parts next-day.`,
  },
  {
    id: 'kb-docks',
    title: 'Docking station display problems',
    category: 'Hardware',
    tags: ['dock', 'monitor', 'displayport', 'firmware'],
    body: `## Isolate
Swap monitors and cables. Does the problem follow the **part** or the **port**?

## Port-specific failures
- Check the dock firmware in Endpoint Manager. Approved: **1.2.1**.
- Display driver updates can expose old dock firmware bugs.
- Deploy the **dock driver & firmware** bundle; the dock will power-cycle.`,
  },
  {
    id: 'kb-slow-pc',
    title: 'Slow computer checklist',
    category: 'Hardware',
    tags: ['slow', 'disk', 'performance', 'cleanup'],
    body: `1. **Disk space**: under ~10% free causes severe slowness and failed saves.
2. **Uptime**: weeks without a restart leads to leaks and pending updates.
3. **Startup apps / high CPU** processes.
4. Endpoint protection status.

## Fixes
- Run disk cleanup (temp files, update cache).
- Move large personal work files to OneDrive / shared storage.
- Restart weekly.

Never reimage a device that holds unsynced user data.`,
  },

  // ---------- Software ----------
  {
    id: 'kb-camera',
    title: 'Camera not detected in Teams',
    category: 'Software',
    tags: ['camera', 'teams', 'privacy', 'webcam'],
    body: `1. Check the physical shutter / slider.
2. Test in the **Windows Camera app**. If that fails too, it is an OS issue, not Teams.
3. **Settings > Privacy & security > Camera**: turn on *Camera access*, *Let apps access your camera* and *Let desktop apps access your camera*.
4. Feature updates can reset these toggles.
5. Only then: driver checks, Teams cache clear.`,
  },
  {
    id: 'kb-office-crash',
    title: 'Office apps crashing on launch',
    category: 'Software',
    tags: ['excel', 'word', 'crash', 'add-in', 'safe mode'],
    body: `1. Does it crash with **every** file (even blank)? If so, it's not the file.
2. Start in **safe mode** (hold Ctrl while launching). Safe mode loads no add-ins.
3. If safe mode works, check add-ins. The application event log names the **faulting module**: \`Get-EventLog Application -Newest 5\`.
4. Disable the offending add-in.
5. Office repair is a last resort (30+ minutes of downtime).`,
  },
  {
    id: 'kb-software-requests',
    title: 'Software requests & admin rights',
    category: 'Software',
    tags: ['software', 'install', 'admin', 'software center'],
    body: `Standard users **do not** receive local admin rights.

1. Ask what the user needs to achieve, not just what they asked for.
2. Check **Software Center**, the self-service catalog of approved apps that install without admin.
3. Not there? Raise a software request to Application Support (licensing + security review).

Unverified download sites are a leading malware source.`,
  },

  // ---------- Email ----------
  {
    id: 'kb-outlook-prompts',
    title: 'Outlook repeatedly prompts for password',
    category: 'Email',
    tags: ['outlook', 'password', 'credential manager', 'prompt'],
    body: `Typical after a password change, when Office still holds **stale cached credentials**.

1. Confirm the account is healthy (not locked/expired) and other apps work.
2. Check Credential Manager: \`cmdkey /list\`, entries starting with *MicrosoftOffice16_Data*.
3. **Clear cached credentials**, restart Outlook, sign in once.

Don't reset the password again; it makes things worse.`,
  },
  {
    id: 'kb-mailbox-quota',
    title: 'Mailbox full / quota exceeded',
    category: 'Email',
    tags: ['mailbox', 'quota', 'archive', 'outlook'],
    body: `Mailboxes are 50 GB. At the limit, sending (and later receiving) is blocked.

1. Check usage and archive status in the Directory tool.
2. If the user must keep mail: **enable the online archive** (moves items older than 2 years). Archived mail stays searchable in Outlook.
3. Quick win: empty Deleted Items, remove large attachments.
4. Quota increases need Messaging team approval, and 50 GB is the max tier.`,
  },

  // ---------- Security ----------
  {
    id: 'kb-social-engineering',
    title: 'Recognising social engineering (vishing)',
    category: 'Security',
    tags: ['social engineering', 'vishing', 'phone', 'pretexting'],
    body: `Attackers call help desks because help desks can reset credentials.

## Classic signs
- **Urgency**: "in 10 minutes", "board meeting"
- **Authority**: claims to be an executive or acting for one
- **Bypass**: "no time for verification", "just read me the password"
- Refuses callbacks, can't answer verification questions, not in the directory

## What to do
1. Stay polite and calm; follow policy.
2. Check facts (is the account actually locked?).
3. Decline the change and offer verified channels.
4. Record caller number, time and claims. Escalate to **Security Operations**.`,
  },
  {
    id: 'kb-phishing',
    title: 'User entered credentials on a phishing site',
    category: 'Security',
    tags: ['phishing', 'compromise', 'mfa fatigue', 'revoke'],
    body: `Treat as a **security incident**. Speed matters.

1. Thank the user for reporting. No blame.
2. Verify identity. Ask: what URL? Any MFA prompts approved afterwards?
3. Check the sign-in log for unfamiliar locations, new inbox rules.
4. **Reset the password** and **revoke all sessions** (tokens survive a password reset!).
5. Consider re-registering MFA.
6. Have the user report the email; escalate to **Security Operations**.`,
  },
  {
    id: 'kb-scareware',
    title: 'Fake virus warnings (tech-support scams)',
    category: 'Security',
    tags: ['scareware', 'scam', 'popup', 'browser', 'notifications'],
    body: `Full-screen "your PC is infected, call this number" warnings are **browser pages**, not real alerts. Real security tools never show a phone number.

1. Confirm the user has **not called** the number or allowed remote access. If they did, escalate to Security Operations.
2. Force-close the browser (Task Manager).
3. Remove the site from the browser's **notification permissions**.
4. Optional: run an antivirus scan for peace of mind.
5. Praise the user for calling IT first.`,
  },
];

export const KB_BY_ID: Record<string, KbArticle> = Object.fromEntries(KB_ARTICLES.map((a) => [a.id, a]));
