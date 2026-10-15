import type { Scenario } from '../../types';
import { account, device, person, scenario } from './base';

export const emailScenarios: Scenario[] = [
  scenario({
    id: 'mail-outlook-prompts',
    title: 'Outlook keeps asking for my password',
    category: 'Email',
    difficulty: 2,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 6,
    requester: person('Tom Becker', 'Regional Sales Manager', 'Sales', 'HQ, Floor 4'),
    description:
      'Every 10 minutes Outlook pops up asking for my password. I type it in, it goes away, then it comes back. Teams and the browser are fine. This started after I changed my password last week.',
    account: account('tom.becker', { passwordLastSet: '6 days ago' }),
    device: device('HPL-LT-1999', {
      installedNotes: [
        'Endpoint protection: healthy',
        'VPN Client 5.1.3',
        "Credential Manager: 3 'MicrosoftOffice16_Data' entries last updated 41 days ago",
      ],
    }),
    facts: [
      { id: 'after_change', label: 'Prompts started after the password change' },
      { id: 'other_apps_ok', label: 'Teams and webmail work normally' },
      { id: 'stale_creds', label: 'Credential Manager holds outdated Office credentials' },
      { id: 'not_locked', label: 'Account is healthy (not locked, not expired)' },
    ],
    keyFacts: ['after_change', 'other_apps_ok', 'stale_creds'],
    questions: [
      {
        id: 'q_since',
        text: 'When did the prompts start?',
        reply: 'Right after I changed my password last week.',
        keywords: ['when', 'start', 'since', 'began'],
        reveals: ['after_change'],
      },
      {
        id: 'q_apps',
        text: 'Do Teams or webmail in the browser ask for your password too?',
        reply: 'No, those are fine. Only Outlook.',
        keywords: ['teams', 'webmail', 'browser', 'other apps'],
        reveals: ['other_apps_ok'],
      },
      {
        id: 'q_typing',
        text: 'Are you definitely typing the new password?',
        reply: 'Yes. It accepts it and then asks again ten minutes later.',
        keywords: ['typing', 'correct', 'right password'],
        quality: 'neutral',
      },
      {
        id: 'q_lazy',
        text: 'Can you just click Cancel when it pops up?',
        reply: "Then Outlook stops syncing. That's not a fix.",
        keywords: ['cancel', 'ignore'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['stale_creds'], directory: ['not_locked'] },
    terminal: {
      'cmdkey /list': {
        output:
          'Currently stored credentials:\n\n    Target: MicrosoftOffice16_Data:SSPI:tom.becker@hpl.example\n    Type: Generic\n    User: tom.becker@hpl.example\n    Local machine persistence\n\n    Target: MicrosoftOffice16_Data:orgid:tom.becker@hpl.example\n    Type: Generic\n    Local machine persistence\n\n    Target: LegacyGeneric:target=msteams_adalsso/adal_context_0\n    Type: Generic',
        reveals: ['stale_creds'],
        whenDone: {
          action: 'clear_credentials',
          output:
            'Currently stored credentials:\n\n    Target: LegacyGeneric:target=msteams_adalsso/adal_context_0\n    Type: Generic',
        },
      },
    },
    actionResults: {
      clear_credentials: {
        result:
          'Removed the stale Office entries from Credential Manager. Tom restarted Outlook, signed in once with modern authentication, and the prompts have stopped.',
      },
      repair_office: {
        result: 'Office repair took 30 minutes. Outlook still prompts, because the stale credentials are still stored.',
      },
      reset_password: {
        result: 'Password reset. Tom is now annoyed, and Outlook prompts even more often.',
      },
    },
    requiredActions: ['clear_credentials'],
    helpfulActions: ['guide_restart'],
    harmfulActions: ['reset_password', 'reimage'],
    rootCauses: [
      { id: 'stale_creds', label: 'Stale cached credentials in Credential Manager' },
      { id: 'mailbox_full', label: 'Mailbox over quota' },
      { id: 'locked', label: 'Account locked' },
      { id: 'profile', label: 'Corrupted Outlook profile' },
    ],
    correctRootCause: 'stale_creds',
    correctOutcome: 'resolve',
    noteKeywords: ['credential', 'cached', 'outlook', 'cleared', 'password change'],
    replyKeywords: ['outlook', 'sign in', 'password'],
    kb: ['kb-outlook-prompts'],
    solution: [
      'Note the timing: right after a password change.',
      'Only Outlook is affected; Teams and web are fine. Account is healthy.',
      'Check Credential Manager (cmdkey /list): old Office entries.',
      'Clear them, restart Outlook, sign in once.',
    ],
    debrief:
      'Repeated Outlook password prompts after a password change are a classic sign of cached credentials. The account itself is fine, so resetting the password again just repeats the problem. A full Office repair is overkill and costs the user half an hour.',
  }),

  scenario({
    id: 'mail-quota',
    title: "Can't send emails: mailbox full",
    category: 'Email',
    difficulty: 1,
    priority: 'P2',
    channel: 'phone',
    targetMinutes: 5,
    requester: person('Beatrice Okafor', 'Executive Assistant to the CEO', 'Office of the CEO', 'HQ, Floor 6', { vip: true }),
    description:
      "Outlook says my mailbox is full and I can't send anything. I organise everything for the CEO and I can't delete anything. I need to keep ALL of it!",
    account: account('beatrice.okafor', { mailboxUsage: '49.8 GB of 50 GB (sending blocked)', archive: 'Not enabled' }),
    device: device('HPL-LT-6001'),
    facts: [
      { id: 'full', label: 'Mailbox is at 49.8 of 50 GB; sending is blocked' },
      { id: 'no_archive', label: 'Online archive has never been enabled' },
      { id: 'keep_all', label: 'User must retain old mail' },
      { id: 'attachments', label: 'Many large board-pack attachments' },
    ],
    keyFacts: ['full', 'no_archive', 'keep_all'],
    questions: [
      {
        id: 'q_keep',
        text: 'Do you need to keep your older emails, or can some be deleted?',
        reply: 'I really need to keep everything. The CEO asks me for things from years ago.',
        keywords: ['keep', 'delete', 'older', 'old emails', 'retain'],
        reveals: ['keep_all'],
      },
      {
        id: 'q_attachments',
        text: 'Do you have a lot of emails with large attachments?',
        reply: 'Probably. Board packs, presentations, contracts... every month.',
        keywords: ['attachments', 'large', 'big files'],
        reveals: ['attachments'],
      },
      {
        id: 'q_error',
        text: 'What does the message say exactly?',
        reply: '"Your mailbox is full. You can\'t send or receive items."',
        keywords: ['error', 'message', 'exactly'],
      },
      {
        id: 'q_hoard',
        text: 'Why do you keep so many emails?',
        reply: "Because it's my job. Respectfully.",
        keywords: ['why so many', 'hoard'],
        quality: 'bad',
      },
    ],
    toolReveals: { directory: ['full', 'no_archive'] },
    actionResults: {
      enable_archive: {
        result:
          'Online archive enabled, and the policy moves items older than two years. Within 20 minutes usage dropped from 49.8 GB to 31.2 GB. Beatrice can send again and still searches old mail in the "Online Archive" folder.',
        accountUpdate: { mailboxUsage: '31.2 GB of 50 GB', archive: 'Enabled (2-year policy)' },
      },
      raise_quota: {
        result: 'Quota change rejected by the Messaging team: no approval and 50 GB is the maximum license tier.',
      },
      guide_archive: {
        result: 'Beatrice emptied Deleted Items (1.4 GB). Usage is 48.4 GB, so she can send for now but will hit the limit again within days.',
        accountUpdate: { mailboxUsage: '48.4 GB of 50 GB' },
      },
    },
    requiredActions: ['enable_archive'],
    helpfulActions: ['guide_archive'],
    harmfulActions: ['raise_quota'],
    rootCauses: [
      { id: 'quota', label: 'Mailbox reached quota and the archive was never enabled' },
      { id: 'server', label: 'Mail server outage' },
      { id: 'ost', label: 'Corrupted local OST file' },
      { id: 'blocked', label: 'Account blocked for spam' },
    ],
    correctRootCause: 'quota',
    correctOutcome: 'resolve',
    noteKeywords: ['quota', 'archive', '50 gb', 'enabled', 'mailbox'],
    replyKeywords: ['archive', 'keep', 'search'],
    kb: ['kb-mailbox-quota'],
    solution: [
      "Acknowledge the urgency: VIP's assistant, sending blocked.",
      'Confirm they must keep the mail: deleting is not an option.',
      'Check the mailbox: archive not enabled.',
      'Enable the online archive; show them where archived mail lives.',
    ],
    debrief:
      "The online archive is the standard answer for users who must keep everything: mail stays searchable and the primary mailbox shrinks. Raising quotas needs approval and only delays the problem. Explain where archived mail lives so they don't panic that it's gone.",
  }),
];

export const securityScenarios: Scenario[] = [
  scenario({
    id: 'sec-vishing-cfo',
    title: 'URGENT: CFO locked out right before investor call',
    category: 'Security',
    difficulty: 3,
    priority: 'P1',
    channel: 'phone',
    targetMinutes: 6,
    socialEngineering: true,
    requester: person('Jordan Pike', 'Executive Assistant to the CFO (claimed)', 'Office of the CFO (unverified)', 'Calling from an external mobile number'),
    description:
      'Phone call transcript: the caller says they are the new executive assistant to the CFO, Elaine Moreau. Elaine is traveling, locked out, and needs her password reset and MFA removed immediately so she can join an investor call in 10 minutes. The caller asks for the temporary password to be read out over the phone.',
    account: account('elaine.moreau', {
      lastLogon: 'Today 06:12 (Lisbon, MFA approved)',
      mfa: 'Enrolled (Authenticator app, used today)',
      groups: ['All Staff', 'Executives', 'Finance - Admin', 'VPN Users'],
      activeSessions: 4,
    }),
    device: device('HPL-LT-0001', { model: 'Executive Ultrabook X1', ip: '10.99.0.14' }),
    identity: {
      verifiable: false,
      reply: "I don't have her employee ID on me. Look, I'm her assistant, isn't that enough? She's waiting!",
    },
    facts: [
      { id: 'not_in_directory', label: 'No "Jordan Pike" exists in the staff directory' },
      { id: 'callback_refused', label: 'Caller refuses a callback to the number on file' },
      { id: 'pressure', label: 'Caller is using urgency and authority pressure' },
      { id: 'not_locked', label: "CFO's account is not locked" },
      { id: 'signed_in', label: 'CFO signed in successfully with MFA this morning' },
    ],
    keyFacts: ['not_in_directory', 'callback_refused', 'not_locked', 'signed_in'],
    questions: [
      {
        id: 'q_name',
        text: 'Can you spell your full name so I can look you up in the directory?',
        reply: "J-O-R-D-A-N P-I-K-E. I'm new, I probably won't be in your system yet.",
        keywords: ['name', 'spell', 'look you up', 'directory', 'who are you'],
        reveals: ['not_in_directory'],
      },
      {
        id: 'q_callback',
        text: "I'll call Elaine back on the mobile number we have on file. Is that OK?",
        reply: "No, no, her phone is dead, that's the whole problem! Just give me the password, she's waiting!",
        keywords: ['call back', 'callback', 'number on file', 'call her'],
        reveals: ['callback_refused'],
      },
      {
        id: 'q_why_mfa',
        text: 'Why does MFA need to be removed?',
        reply: "Because her phone is DEAD! This is the CFO. Do you want me to tell her you're the reason she missed the investor call?",
        keywords: ['why', 'mfa', 'remove'],
        reveals: ['pressure'],
      },
      {
        id: 'q_approval',
        text: 'Is there an approval or a ticket from Elaine or her manager?',
        reply: "There's no time for paperwork. You're wasting time.",
        keywords: ['approval', 'ticket', 'manager', 'request'],
        reveals: ['pressure'],
      },
      {
        id: 'q_comply',
        text: 'OK, what would she like her new password to be?',
        reply: 'Make it easy: Spring2026! is fine. Read it back to me once it is done.',
        keywords: ['new password', 'what password', 'like her password'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Today 06:12  SUCCESS   Web sign-in              Lisbon, PT   MFA approved (Authenticator)',
        'Today 06:14  SUCCESS   Outlook (modern auth)    Lisbon, PT',
        'Last 24 h    LOCKOUTS  none',
        'Last 24 h    FAILURES  none',
      ],
      reveals: ['not_locked', 'signed_in'],
    },
    toolReveals: { directory: ['not_locked'] },
    actionResults: {
      reset_password: {
        result:
          'Password reset on the CFO account. You read the temporary password to an unverified caller. That is a full account takeover of an executive with Finance-Admin rights.',
      },
      reset_mfa: {
        result: "MFA removed from the CFO's account at the request of an unverified caller. An attacker can now enroll their own device.",
      },
      unlock_account: { result: 'Nothing to unlock: the account was never locked.' },
      revoke_sessions: {
        result: "The CFO was signed out of every device minutes before her real investor call, on an unverified caller's request.",
      },
    },
    requiredActions: [],
    helpfulActions: [],
    harmfulActions: ['reset_password', 'reset_mfa', 'revoke_sessions', 'enable_account'],
    rootCauses: [
      { id: 'social', label: 'Suspected social engineering (vishing) attempt' },
      { id: 'locked', label: 'Genuine account lockout' },
      { id: 'mfa_device', label: "CFO's MFA device unavailable" },
      { id: 'geo', label: 'Sign-in blocked due to travel location' },
    ],
    correctRootCause: 'social',
    correctOutcome: 'escalate',
    escalateTo: 'Security Operations',
    noteKeywords: ['social engineering', 'vishing', 'verify', 'callback', 'refused', 'not locked', 'security'],
    replyKeywords: ['verify', 'policy', 'directly'],
    kb: ['kb-identity', 'kb-social-engineering'],
    solution: [
      'Attempt standard verification: it fails (no ID, not in directory).',
      'Offer a callback to the number on file: refused.',
      "Check the facts: the CFO's account is not locked and she signed in with MFA this morning.",
      'Politely decline. Elaine can contact the desk directly through a verified channel.',
      'Escalate to Security Operations with the caller number, time and claims.',
    ],
    debrief:
      'Urgency + authority + a request to bypass process is the textbook vishing pattern. Help desks are a prime target because they can reset credentials. Verification policy exists exactly for VIPs. Checking the sign-in log showed the "locked out" story was false. Declining politely and escalating is the correct, professional outcome.',
  }),

  scenario({
    id: 'sec-phish-clicked',
    title: 'I think I entered my password on a fake site',
    category: 'Security',
    difficulty: 3,
    priority: 'P1',
    channel: 'phone',
    targetMinutes: 6,
    requester: person('Daniel Kim', 'Procurement Officer', 'Procurement', 'HQ, Floor 3'),
    description:
      'I got an email saying a shared invoice was waiting. I clicked it and logged in with my work account, then the page just went blank. Now I\'m worried. Was that fake?',
    account: account('daniel.kim', { activeSessions: 5 }),
    device: device('HPL-LT-3550'),
    identity: { verifiable: true, reply: "Employee ID 47731, my manager is Rosa Delgado. You can call me back on my desk line." },
    facts: [
      { id: 'external_domain', label: 'Link went to "hpl-invoices-share.co", not a company domain' },
      { id: 'mfa_approved', label: 'User approved an unexpected MFA prompt afterwards' },
      { id: 'foreign_signin', label: 'Successful sign-in from an unfamiliar country 12 minutes ago' },
      { id: 'reported', label: 'Email forwarded to the phishing report mailbox' },
      { id: 'recent', label: 'Happened about 15 minutes ago' },
    ],
    keyFacts: ['external_domain', 'mfa_approved', 'foreign_signin'],
    questions: [
      {
        id: 'q_link',
        text: 'What was the web address of the page you logged in to?',
        reply: 'Something like hpl-invoices-share dot co? It had our logo on it.',
        keywords: ['address', 'url', 'link', 'website', 'domain'],
        reveals: ['external_domain'],
      },
      {
        id: 'q_mfa',
        text: 'Did you get any sign-in approval prompts on your phone afterwards?',
        reply: 'Yes! One popped up and I approved it because I thought it was for the same login...',
        keywords: ['mfa', 'prompt', 'approve', 'approval', 'phone', 'notification'],
        reveals: ['mfa_approved'],
      },
      {
        id: 'q_when',
        text: 'When did this happen?',
        reply: 'About 15 minutes ago.',
        keywords: ['when', 'time', 'how long ago'],
        reveals: ['recent'],
      },
      {
        id: 'q_report',
        text: 'Please forward that email to the phishing report mailbox, without clicking anything else.',
        reply: "Done, I've sent it to the report-phishing address.",
        keywords: ['forward', 'report', 'phishing mailbox'],
        reveals: ['reported'],
      },
      {
        id: 'q_blame',
        text: 'Why would you click a link like that?',
        reply: "I... I don't know. It looked real. I'm already feeling terrible.",
        keywords: ['why would you', 'why did you'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Today 10:49  SUCCESS   Web sign-in       HQ (10.20.3.55)       MFA approved',
        'Today 11:02  SUCCESS   Web sign-in       185.220.x.x (RO)      MFA approved (push)',
        'Today 11:04  SUCCESS   Exchange Online   185.220.x.x (RO)      New inbox rule created',
      ],
      reveals: ['foreign_signin'],
    },
    actionResults: {
      reset_password: {
        result: "Password reset through the verified channel. Daniel set a new password while you stayed on the line.",
        accountUpdate: { passwordLastSet: 'Just now' },
      },
      revoke_sessions: {
        result: "All sessions revoked, including the attacker's. The foreign session drops off the sign-in log.",
        accountUpdate: { activeSessions: 0 },
      },
      reset_mfa: {
        result: 'MFA re-registered on Daniel\'s phone only, removing any method the attacker might have added.',
      },
      av_scan: { result: 'Full scan complete. No malware found (the attack was credential theft only).' },
      isolate_device: { result: 'Device isolated. The laptop was not compromised, so Daniel is now without a working PC.' },
    },
    requiredActions: ['reset_password', 'revoke_sessions'],
    helpfulActions: ['reset_mfa', 'av_scan'],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'phish', label: 'Credential phishing with MFA approval (account compromised)' },
      { id: 'malware', label: 'Malware download' },
      { id: 'spam', label: 'Harmless spam' },
      { id: 'bug', label: 'Website glitch' },
    ],
    correctRootCause: 'phish',
    correctOutcome: 'escalate',
    escalateTo: 'Security Operations',
    noteKeywords: ['phishing', 'mfa', 'revoked', 'reset', 'foreign', 'inbox rule', 'security'],
    replyKeywords: ['thank', 'password', 'security'],
    kb: ['kb-phishing', 'kb-identity'],
    solution: [
      'Stay calm and blame-free. The user reporting quickly is a good thing.',
      'Verify identity, then find out the domain and whether any MFA prompts were approved.',
      'Check the sign-in log: a foreign session plus a new inbox rule means the account is compromised.',
      'Reset the password and revoke all sessions immediately.',
      'Escalate to Security Operations (inbox rule, possible data access, other recipients).',
    ],
    debrief:
      'Speed matters: an attacker with a session token keeps access even after a password reset, which is why you revoke sessions as well. The new inbox rule suggests they are hiding replies, so Security Operations must investigate. Thank users who report quickly; blaming them makes people hide incidents.',
  }),

  scenario({
    id: 'sec-scareware',
    title: "Huge 'Your PC is infected' warning with a phone number",
    category: 'Security',
    difficulty: 2,
    priority: 'P2',
    channel: 'phone',
    targetMinutes: 5,
    requester: person('Margaret Ellis', 'Receptionist', 'Facilities', 'HQ, Ground floor'),
    description:
      "A big red screen popped up saying my computer is infected and to call \"Windows Support\" at a phone number. It's beeping! I haven't called yet. I can't close it.",
    account: account('margaret.ellis'),
    device: device('HPL-DT-0012', { model: 'Standard Desktop D7' }),
    facts: [
      { id: 'not_called', label: 'User has not called the number or allowed remote access' },
      { id: 'allowed_notifications', label: 'User clicked "Allow" on a site\'s notification prompt' },
      { id: 'no_download', label: 'Nothing was downloaded or run' },
      { id: 'browser', label: 'The warning is a full-screen browser page' },
    ],
    keyFacts: ['not_called', 'allowed_notifications', 'browser'],
    questions: [
      {
        id: 'q_called',
        text: 'Have you called that number or let anyone connect to your computer?',
        reply: 'No, I called you first.',
        keywords: ['called', 'call the number', 'remote', 'connect'],
        reveals: ['not_called'],
      },
      {
        id: 'q_site',
        text: 'Did it appear after you visited a website?',
        reply: 'I was looking at a recipe site at lunch and clicked "Allow" on some box that popped up.',
        keywords: ['website', 'site', 'browsing', 'visited', 'before'],
        reveals: ['allowed_notifications'],
      },
      {
        id: 'q_download',
        text: 'Did you download or run anything?',
        reply: 'No, nothing.',
        keywords: ['download', 'install', 'run', 'open file'],
        reveals: ['no_download'],
      },
      {
        id: 'q_taskbar',
        text: 'Can you see your web browser icon in the taskbar behind it?',
        reply: 'Yes, the browser icon is there and highlighted.',
        keywords: ['taskbar', 'browser', 'chrome', 'edge'],
        reveals: ['browser'],
      },
      {
        id: 'q_panic',
        text: 'Unplug everything right now!',
        reply: 'What?! Everything? The phone too? You are scaring me.',
        keywords: ['unplug everything'],
        quality: 'bad',
      },
    ],
    actionResults: {
      guide_close_browser: {
        result:
          'Margaret ended the browser from Task Manager, reopened it, and removed the recipe site from notification permissions. No more pop-ups.',
      },
      av_scan: { result: 'Full scan completed: no threats found. A browser notification was the only source.' },
      isolate_device: { result: 'Device isolated. Reception has no PC for the rest of the day, and nothing was infected.' },
    },
    requiredActions: ['guide_close_browser'],
    helpfulActions: ['av_scan'],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'scareware', label: 'Browser scareware / tech-support scam via site notifications' },
      { id: 'malware', label: 'Real malware infection' },
      { id: 'ransomware', label: 'Ransomware' },
      { id: 'os_alert', label: 'Genuine Windows security alert' },
    ],
    correctRootCause: 'scareware',
    correctOutcome: 'resolve',
    noteKeywords: ['scareware', 'notification', 'browser', 'scam', 'not called', 'scan'],
    replyKeywords: ['scam', 'never call', 'well done'],
    kb: ['kb-scareware'],
    solution: [
      'Reassure the user and confirm they did NOT call or allow remote access.',
      'Establish it is a browser page (fake warning), not a real system alert.',
      'Force-close the browser and remove the site\'s notification permission.',
      'Optional: run a scan for peace of mind; praise them for calling IT first.',
    ],
    debrief:
      "Tech-support scams rely on panic. Real security alerts never show a phone number. The danger only begins if the user calls and grants remote access, so confirming that first sets the severity. Isolating or reimaging a PC over a browser page is a big overreaction.",
  }),
];
