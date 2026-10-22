import type { Scenario } from '../../types';
import { account, device, person, scenario } from './base';

/** Second batch of scenarios. */
export const extraScenarios: Scenario[] = [
  // ---------------------------------------------------------------- 1. Lost company phone
  scenario({
    id: 'mdm-lost-phone',
    title: 'Left my work phone on the train',
    category: 'Security',
    difficulty: 2,
    priority: 'P2',
    channel: 'phone',
    targetMinutes: 6,
    requester: person('Callum Reyes', 'Transport Planner', 'Operations', 'HQ, Floor 3'),
    description:
      "Hi, it's Callum from Transport Planning. I think I left my work phone on the train home last night. I've rung it a few times this morning and it just goes to voicemail. It's got my email, Teams and the authenticator app on it. What do I need to do?",
    account: account('callum.reyes', {
      mfa: 'Enrolled (Authenticator app on HPL-MB-0388)',
      activeSessions: 4,
    }),
    device: device('HPL-LT-3672', {
      installedNotes: [
        'Endpoint protection: healthy',
        'VPN Client 5.1.3',
        'Managed mobile linked to this user: HPL-MB-0388 (company iPhone), encrypted, passcode set',
        'HPL-MB-0388 last check-in: yesterday 21:14 over mobile data',
      ],
    }),
    identity: { verifiable: true, reply: "Sure. Employee ID 52764, and my manager is Tess Okoro. I'm calling from my desk phone." },
    facts: [
      { id: 'lost_train', label: 'Phone was left on the 18:40 train; lost property has nothing yet' },
      { id: 'managed_phone', label: 'Phone is company-owned and enrolled in device management (HPL-MB-0388)' },
      { id: 'authenticator', label: "The user's only MFA method is the authenticator on the lost phone" },
      { id: 'still_syncing', label: 'Phone mail synced at 21:14 after it was lost: someone has it switched on' },
      { id: 'passcode', label: 'Phone has a six-digit passcode' },
    ],
    keyFacts: ['lost_train', 'managed_phone', 'authenticator', 'still_syncing'],
    questions: [
      {
        id: 'q_where',
        text: 'When and where did you last have the phone?',
        reply: 'On the 18:40 train out of Central. I had it on the seat next to me. I called lost property first thing and nothing has been handed in yet.',
        keywords: ['where', 'when', 'last', 'train', 'lost property'],
        reveals: ['lost_train'],
      },
      {
        id: 'q_passcode',
        text: 'Does the phone have a passcode or Face ID set?',
        reply: "Yes, a six-digit passcode. It's not my birthday or anything obvious.",
        keywords: ['passcode', 'pin', 'face id', 'locked', 'screen lock'],
        reveals: ['passcode'],
      },
      {
        id: 'q_company',
        text: 'Is it a company phone, or your own phone with work apps on it?',
        reply: "It's the company iPhone I was given last year. My personal phone is right here.",
        keywords: ['company phone', 'personal', 'own phone', 'work phone', 'company-owned'],
        reveals: ['managed_phone'],
      },
      {
        id: 'q_mfa',
        text: 'Is the authenticator app on that phone the only way you approve sign-ins?',
        reply: "Yes, that's the only one. I haven't been asked to approve anything since though... I'm on the laptop already.",
        keywords: ['authenticator', 'mfa', 'approve', 'only way', 'other method'],
        reveals: ['authenticator'],
      },
      {
        id: 'q_blame',
        text: 'How do you manage to leave a phone on a train?',
        reply: "I was tired, okay? I'm reporting it straight away, isn't that what I'm supposed to do?",
        keywords: ['how do you manage', 'careless'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Yesterday 18:31  SUCCESS   Exchange ActiveSync   HPL-MB-0388 (iPhone Mail)   Mobile network',
        'Yesterday 21:14  SUCCESS   Exchange ActiveSync   HPL-MB-0388 (iPhone Mail)   Mobile network (different cell area)',
        'Today 08:22      SUCCESS   Windows sign-in       HPL-LT-3672                 HQ',
        'Last 24 h        FAILURES  none',
      ],
      reveals: ['still_syncing'],
    },
    toolReveals: { endpoint: ['managed_phone'], directory: ['authenticator'] },
    actionResults: {
      mdm_wipe_device: {
        result:
          'Wipe command queued for HPL-MB-0388 (not the laptop). The phone checked in over mobile data at 09:41 and confirmed the factory reset. Company mail, Teams and the authenticator are gone from it.',
      },
      revoke_sessions: {
        result: 'All sessions revoked, including the mail and Teams tokens cached on the phone. Callum signed back in on his laptop.',
        accountUpdate: { activeSessions: 1 },
      },
      reset_mfa: {
        result: 'MFA registration cleared. Callum will enrol the authenticator on his replacement phone at next sign-in.',
        accountUpdate: { mfa: 'Not registered (re-registration required)' },
      },
      reimage: {
        result: "You scheduled a wipe of Callum's LAPTOP. The lost phone is still out there with company mail on it, and Callum loses his working PC.",
      },
      isolate_device: {
        result: "You isolated Callum's laptop, which is safe on his desk. The lost phone is untouched.",
      },
    },
    requiredActions: ['mdm_wipe_device', 'revoke_sessions'],
    helpfulActions: ['reset_mfa', 'reset_password'],
    harmfulActions: ['reimage', 'isolate_device'],
    rootCauses: [
      { id: 'lost_device', label: 'Lost company phone holding company data and the MFA authenticator' },
      { id: 'compromise', label: 'Confirmed account compromise' },
      { id: 'mfa_fault', label: 'Authenticator app fault' },
      { id: 'laptop', label: 'Laptop security incident' },
    ],
    correctRootCause: 'lost_device',
    correctOutcome: 'resolve',
    noteKeywords: ['lost', 'phone', 'wipe', 'HPL-MB-0388', 'revoked', 'sessions', 'verified'],
    replyKeywords: ['wipe', 'phone', 'sign in', 'replacement'],
    kb: ['kb-lost-device', 'kb-mfa'],
    solution: [
      'Verify Callum before touching anything: a wipe cannot be undone.',
      'Establish what was lost and when; confirm it is the managed company phone (HPL-MB-0388).',
      'Check the sign-in log: the phone synced mail after it was lost, so it is switched on.',
      'Remote wipe the phone (not the laptop) and revoke all sessions.',
      'Reset MFA so he can enrol on the replacement, and point him to the replacement request.',
    ],
    debrief:
      'A lost phone is a data and identity problem: it holds mail, chat and often the second factor. Wiping it through device management and revoking sessions closes both doors, and reporting quickly is exactly what users should do. The classic mistake is acting on the wrong device: the laptop on the desk is fine.',
  }),

  // ---------------------------------------------------------------- 2. VPN on personal PC
  scenario({
    id: 'net-vpn-personal',
    title: 'Can I have the VPN on my home PC?',
    category: 'Network',
    difficulty: 1,
    priority: 'P4',
    channel: 'email',
    targetMinutes: 4,
    requester: person('Leon Marsh', 'Dispatch Controller', 'Operations', 'Depot North'),
    description:
      "Hi IT, my manager has agreed I can work from home on Fridays. Can you send me the VPN software so I can put it on my home PC? It's my own computer but it's pretty new and has antivirus. Thanks, Leon",
    account: account('leon.marsh', { groups: ['All Staff', 'Operations - Dispatch'] }),
    device: device('HPL-DT-0733', { model: 'Standard Desktop D7', installedNotes: ['Endpoint protection: healthy', 'Assigned device: office desktop only (no company laptop)'] }),
    identity: { verifiable: true, reply: 'Employee ID 38812, my manager is Kofi Mensah.' },
    facts: [
      { id: 'personal_pc', label: 'The home PC is personally owned and not company-managed' },
      { id: 'needs', label: 'Needs email, Teams and the dispatch rota web app from home' },
      { id: 'no_vpn', label: 'Not in VPN Users and has no company laptop assigned' },
      { id: 'manager_ok', label: 'Manager approved working from home on Fridays' },
      { id: 'portal_covers', label: 'The web workspace portal publishes everything he needs' },
    ],
    keyFacts: ['personal_pc', 'needs', 'no_vpn', 'portal_covers'],
    questions: [
      {
        id: 'q_device',
        text: 'Is the home PC a company device, or your own?',
        reply: "It's mine. I bought it last year. My kids use it for homework too, but I'd have my own login.",
        keywords: ['own', 'personal', 'company device', 'home pc', 'whose', 'managed'],
        reveals: ['personal_pc'],
      },
      {
        id: 'q_needs',
        text: 'What do you need to get to when you work from home?',
        reply: 'Mostly my email and Teams, and the dispatch rota. The rota is the website we open from the intranet.',
        keywords: ['what do you need', 'access', 'which apps', 'what systems', 'get to'],
        reveals: ['needs'],
      },
      {
        id: 'q_manager',
        text: 'Has your manager approved the home working arrangement?',
        reply: 'Yes, Kofi signed it off last week. Fridays from next month.',
        keywords: ['manager', 'approved', 'agreed', 'sign off'],
        reveals: ['manager_ok'],
      },
      {
        id: 'q_laptop',
        text: 'Do you have a company laptop at the moment?',
        reply: 'No, just the desktop here at the depot.',
        keywords: ['laptop', 'company laptop', 'notebook'],
        reveals: ['no_vpn'],
      },
      {
        id: 'q_rude',
        text: "Seriously, why would we let your kids' computer on our network?",
        reply: "Wow. I only asked. I said I'd have my own login.",
        keywords: ['seriously', 'kids computer'],
        quality: 'bad',
      },
    ],
    toolReveals: { directory: ['no_vpn'] },
    actionResults: {
      guide_web_portal: {
        result:
          'Leon opened the web workspace portal from his own browser, signed in with MFA and found Outlook, Teams and the Dispatch Rota tile. "That\'s everything I need. No install at all!"',
        reveals: ['portal_covers'],
      },
      'grp+:VPN Users': {
        result: 'Leon is now in VPN Users with no managed device and a plan to install the client on a shared family PC. That breaks the remote access policy.',
      },
      deploy_vpn: {
        result: 'The VPN package went to his office desktop, which never leaves the depot. It does nothing for him, and VPN on a personal PC is still not allowed.',
      },
    },
    requiredActions: ['guide_web_portal'],
    helpfulActions: [],
    harmfulActions: ['grp+:VPN Users', 'deploy_vpn', 'grant_admin'],
    rootCauses: [
      { id: 'byod_policy', label: 'VPN is only allowed on managed devices; the web portal covers his needs' },
      { id: 'group', label: 'Missing VPN Users group membership' },
      { id: 'licence', label: 'No VPN licence available' },
      { id: 'cert', label: 'VPN certificate problem' },
    ],
    correctRootCause: 'byod_policy',
    correctOutcome: 'resolve',
    noteKeywords: ['personal', 'policy', 'vpn', 'declined', 'portal', 'managed'],
    replyKeywords: ['personal', 'policy', 'portal'],
    kb: ['kb-remote-access-policy'],
    solution: [
      'Find out whose device it is (personal) and what Leon needs (email, Teams, the rota web app).',
      'Check Directory: no VPN Users membership and no company laptop.',
      'Politely decline VPN on a personal PC and explain why in one line.',
      'Direct him to the web workspace portal and confirm it covers his work.',
    ],
    debrief:
      "Saying no is part of the job, but a good no comes with a yes. The VPN connects a device straight into the company network, so it only goes on managed machines. Leon didn't need the VPN at all: everything he uses is in the browser-based portal. Adding him to VPN Users would have quietly broken policy.",
  }),

  // ---------------------------------------------------------------- 3. Shared mailbox access
  scenario({
    id: 'mail-shared-access',
    title: 'Need access to the accounts-payable mailbox',
    category: 'Email',
    difficulty: 1,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 5,
    requester: person('Ruth Adeyemi', 'Accounts Payable Assistant', 'Finance', 'HQ, Floor 2'),
    description:
      "Hi, I'm covering supplier invoices while Jun is on leave and I need the accounts-payable@ mailbox in my Outlook. When I try to open it I get an error. Could you add it please? Thanks, Ruth",
    account: account('ruth.adeyemi', {
      groups: ['All Staff', 'Finance - Read', 'VPN Users'],
      statusNote: 'Mailbox delegation: no permissions on any shared mailbox.',
    }),
    device: device('HPL-LT-2582'),
    identity: { verifiable: true, reply: 'Of course. Employee ID 44105, and my manager is Priya Raman.' },
    facts: [
      { id: 'owner_approved', label: 'Mailbox owner Priya Raman approved Full Access (email yesterday)' },
      { id: 'no_permission', label: 'User has no permissions on accounts-payable@' },
      { id: 'covering', label: 'Covering supplier invoices while a colleague is on leave' },
      { id: 'automap', label: 'The mailbox appears in Outlook after a restart' },
      { id: 'read_only_needed', label: 'Only needs to read and file mail, not send as the mailbox' },
    ],
    keyFacts: ['owner_approved', 'no_permission', 'automap'],
    questions: [
      {
        id: 'q_approval',
        text: 'Has the owner of the accounts-payable mailbox approved your access?',
        reply: "Yes, Priya owns it. She emailed me yesterday: \"Approved: Ruth to have full access to accounts-payable@ while Jun is away.\" I can forward it to you.",
        keywords: ['approval', 'approved', 'owner', 'permission from', 'who owns'],
        reveals: ['owner_approved'],
      },
      {
        id: 'q_error',
        text: 'What does the error say when you try to open it?',
        reply: '"Cannot expand the folder. You do not have permission to access this mailbox."',
        keywords: ['error', 'message', 'what happens', 'says'],
        reveals: ['no_permission'],
      },
      {
        id: 'q_why',
        text: 'What will you be using the mailbox for?',
        reply: "Jun's on leave for two weeks and suppliers send invoices there. I just need to read them and file them into the right folders.",
        keywords: ['what for', 'why', 'using', 'purpose', 'need it for'],
        reveals: ['covering', 'read_only_needed'],
      },
      {
        id: 'q_sendas',
        text: 'Do you also need to send emails as accounts-payable@?',
        reply: "No, replies come from my own address. Priya said that's fine.",
        keywords: ['send as', 'send from', 'reply as'],
        reveals: ['read_only_needed'],
      },
      {
        id: 'q_login',
        text: "Can't you just use Priya's login to check it for now?",
        reply: "Use my manager's password? I'm fairly sure that's not allowed...",
        keywords: ["priya's login", 'her login', "priya's password"],
        quality: 'bad',
      },
    ],
    toolReveals: { approvals: ['owner_approved'], directory: ['no_permission'] },
    actionResults: {
      grant_mailbox_access: {
        result:
          'Granted ruth.adeyemi Full Access to accounts-payable@hpl.example (approval: Priya Raman, mailbox owner). Outlook adds the mailbox automatically the next time it starts.',
        reveals: ['automap'],
        accountUpdate: { statusNote: 'Mailbox delegation: Full Access to accounts-payable@hpl.example (approved by Priya Raman).' },
      },
      guide_restart: {
        result: 'Ruth closed and reopened Outlook. "accounts-payable" now shows under her own mailbox and she opened this morning\'s invoices.',
      },
      'grp+:Finance - Admin': {
        result: 'Ruth is now in Finance - Admin, which grants payment approval rights she was never meant to have, and it still does not open the mailbox.',
      },
    },
    approvals: [
      { id: 'APR-3192', item: 'Mailbox: accounts-payable@ (Full Access)', requestedFor: 'Ruth Adeyemi', approver: 'Priya Raman (mailbox owner)', status: 'Approved', daysAgo: 1 },
    ],
    requiredActions: ['grant_mailbox_access', 'guide_restart'],
    helpfulActions: [],
    harmfulActions: ['grp+:Finance - Admin', 'reset_password'],
    rootCauses: [
      { id: 'no_delegation', label: 'No Full Access permission on the shared mailbox yet' },
      { id: 'outlook_profile', label: 'Corrupted Outlook profile' },
      { id: 'mailbox_full', label: 'Shared mailbox is over quota' },
      { id: 'licence', label: 'User is missing a mailbox licence' },
    ],
    correctRootCause: 'no_delegation',
    correctOutcome: 'resolve',
    noteKeywords: ['accounts-payable', 'full access', 'approval', 'Priya', 'granted', 'outlook'],
    replyKeywords: ['access', 'mailbox', 'outlook'],
    kb: ['kb-shared-mailbox'],
    solution: [
      'Ask whether the mailbox owner has approved: Priya Raman did, by email yesterday.',
      'Confirm the level needed: Full Access to read and file, no Send As.',
      'Grant Full Access in Directory and reference the approval.',
      'Have Ruth restart Outlook so the mailbox appears, then confirm she can open it.',
    ],
    debrief:
      'Shared mailbox access is routine, but it is still access to someone else\'s data, so the owner\'s approval comes first and goes on the ticket. Ask rather than assume: here the approval existed and one question surfaced it. Granting a broad Finance group "to get her in" is the wrong tool and over-privileges her.',
  }),

  // ---------------------------------------------------------------- 4. New starter tomorrow
  scenario({
    id: 'acc-new-starter',
    title: 'New mechanic starts tomorrow and has no login',
    category: 'Accounts',
    difficulty: 3,
    priority: 'P2',
    channel: 'email',
    targetMinutes: 7,
    requester: person('Gareth Lowe', 'Fleet Maintenance Supervisor', 'Operations', 'Depot North'),
    description:
      "Hi, I've got a new mechanic, Tomasz Nowak, starting tomorrow at 7am. HR told me his account and laptop would be ready, but he hasn't had any login details and I can't find him in Teams. Can you set him up today please? I don't want him sitting around on day one. Gareth",
    account: account('tomasz.nowak', {
      status: 'Disabled',
      statusNote: 'Pre-provisioned by the HR feed. Scheduled activation: 23 November (start date on the HR record).',
      passwordLastSet: 'Never',
      mfa: 'Not registered',
      lastLogon: 'Never',
      groups: ['All Staff'],
      mailboxUsage: '0 GB of 50 GB',
      archive: 'Not enabled',
      activeSessions: 0,
    }),
    device: device('HPL-LT-7720', {
      online: false,
      ip: '',
      gateway: '',
      dns: '',
      uptime: 'In staging, powered off',
      lastPatch: 'Staging build',
      installedNotes: ['Asset status: staged, reserved for tomasz.nowak', 'Handover booked: 23 November (follows the HR start date)'],
    }),
    identity: { verifiable: true, reply: "Sure. I'm Gareth Lowe, employee ID 29930, and my manager is Kofi Mensah." },
    facts: [
      { id: 'starts_tomorrow', label: 'Contract and HR offer letter both give a start date of 23 October (tomorrow)' },
      { id: 'account_disabled', label: 'Account exists but is disabled (pre-provisioned by the HR feed)' },
      { id: 'hr_date_wrong', label: 'HR record says 23 November, so activation is scheduled a month late' },
      { id: 'laptop_booked', label: 'Laptop is staged but its handover is booked for 23 November' },
      { id: 'joiner_submitted', label: 'HR submitted the joiner request last month' },
    ],
    keyFacts: ['starts_tomorrow', 'account_disabled', 'hr_date_wrong', 'laptop_booked'],
    questions: [
      {
        id: 'q_date',
        text: "Can you confirm Tomasz's start date? Do you have it in writing from HR?",
        reply: 'Tomorrow, 23 October. It is on his contract and on the offer letter HR copied me into. I can forward it.',
        keywords: ['start date', 'starting', 'in writing', 'contract', 'offer letter', 'when does he start'],
        reveals: ['starts_tomorrow'],
      },
      {
        id: 'q_request',
        text: 'Was a joiner request raised for him?',
        reply: "HR did it last month. I got the automatic 'new starter request received' email.",
        keywords: ['joiner', 'request', 'raised', 'submitted', 'hr form'],
        reveals: ['joiner_submitted'],
      },
      {
        id: 'q_access',
        text: 'What will he need access to on day one?',
        reply: 'Email, the fleet maintenance system and the workshop rota. Same as the other mechanics.',
        keywords: ['need access', 'day one', 'systems', 'what will he need'],
      },
      {
        id: 'q_password',
        text: 'How were his login details supposed to reach him?',
        reply: "HR said he'd get a welcome email at his personal address the day before. Nothing yet. Can't you just give me his password and I'll pass it on?",
        keywords: ['login details', 'welcome', 'how were', 'credentials'],
      },
      {
        id: 'q_late',
        text: "Why didn't you chase this up earlier?",
        reply: "Because HR told me it was all done! I'm chasing it now, that's why I'm emailing.",
        keywords: ['earlier', 'last minute', 'chase this up'],
        quality: 'bad',
      },
    ],
    toolReveals: { directory: ['account_disabled', 'hr_date_wrong'], endpoint: ['laptop_booked'] },
    actionResults: {
      enable_account: {
        result:
          "You enabled the account outside the joiner workflow. It has no licence, no role groups and no MFA registration, and tonight's HR sync will disable it again because the HR record still says 23 November.",
        accountUpdate: { status: 'Active' },
      },
      reset_password: {
        result: "You set a password on a new starter's account and handed it to his manager. Credentials must go to the new starter, through the joiner process.",
      },
    },
    requiredActions: [],
    helpfulActions: [],
    harmfulActions: ['enable_account', 'reset_password'],
    rootCauses: [
      { id: 'hr_date', label: 'Wrong start date on the HR record, so automatic activation is a month late' },
      { id: 'not_created', label: 'The account was never created' },
      { id: 'licence', label: 'No licence available for new users' },
      { id: 'sync_down', label: 'Directory sync is broken for everyone' },
    ],
    correctRootCause: 'hr_date',
    correctOutcome: 'escalate',
    escalateTo: 'Identity & Access',
    noteKeywords: ['new starter', 'disabled', '23 november', '23 october', 'hr record', 'start date', 'identity & access'],
    replyKeywords: ['start date', 'hr', 'identity & access'],
    kb: ['kb-joiners-leavers', 'kb-escalation'],
    solution: [
      'Verify Gareth and confirm the real start date in writing (23 October).',
      'Directory: the account exists but is disabled, scheduled to activate on 23 November.',
      'Endpoint: the laptop handover follows the same wrong date.',
      'Do not enable the account or hand out a password: that skips the joiner workflow.',
      'Escalate to Identity & Access with the evidence and ask Gareth to have HR correct the record today.',
    ],
    debrief:
      'Joiner accounts follow the HR record. Here the record has the wrong month, so everything downstream (account, licence, laptop) is scheduled a month late. Enabling the account by hand looks helpful but produces a half-built account that the next HR sync switches off again. The fix belongs with Identity & Access and HR, and your evidence lets them fix it today.',
  }),

  // ---------------------------------------------------------------- 5. Leaver disable
  scenario({
    id: 'acc-leaver-disable',
    title: "Please disable a leaver's account",
    category: 'Accounts',
    difficulty: 2,
    priority: 'P2',
    channel: 'portal',
    targetMinutes: 6,
    requester: person('Harriet Osei', 'Customer Service Manager', 'Customer Service', 'HQ, Floor 1'),
    description:
      "Hi, Declan Shaw from my team left on Friday. Someone mentioned his Teams status still shows him as available over the weekend, which is a bit worrying. Can you disable his account? And while you're in there, could I get access to his mailbox so I don't miss customer emails? Thanks, Harriet",
    account: account('declan.shaw', {
      statusNote: 'Manager: Harriet Osei · HR leaver record LVR-2291 (last working day: Friday) not yet actioned.',
      lastLogon: 'Saturday 21:47 (Outlook on the web)',
      activeSessions: 2,
      groups: ['All Staff', 'VPN Users', 'Sales - CRM'],
    }),
    device: device('HPL-LT-1458', {
      online: false,
      ip: '',
      gateway: '',
      dns: '',
      uptime: 'Powered off since Friday 16:30',
      installedNotes: ['Asset status: returned to IT on Friday 16:30, awaiting wipe'],
    }),
    identity: { verifiable: true, reply: 'Of course. Employee ID 33809, and my manager is Victor Hale.' },
    facts: [
      { id: 'hr_record', label: 'HR leaver record LVR-2291 confirms the last working day was Friday' },
      { id: 'is_manager', label: "Directory lists Harriet as Declan's manager" },
      { id: 'still_active', label: 'Account is still enabled with 2 active sessions' },
      { id: 'weekend_signin', label: 'Webmail sign-in on Saturday 21:47, after his last day' },
      { id: 'mailbox_ask', label: "Manager also wants access to the leaver's mailbox" },
      { id: 'laptop_returned', label: 'Company laptop was returned on Friday' },
    ],
    keyFacts: ['hr_record', 'is_manager', 'still_active', 'weekend_signin'],
    questions: [
      {
        id: 'q_hr',
        text: 'Has HR processed a leaver form for Declan?',
        reply: 'Yes, Luis in People raised it. The reference is LVR-2291 and it says Friday was his last day.',
        keywords: ['hr', 'leaver form', 'leaver record', 'processed', 'reference'],
        reveals: ['hr_record'],
      },
      {
        id: 'q_mailbox',
        text: 'Which mailbox access do you need, and why?',
        reply: "His own mailbox. Customers still email him directly about open complaints and I don't want those lost.",
        keywords: ['mailbox', 'his email', 'access to his'],
        reveals: ['mailbox_ask'],
      },
      {
        id: 'q_laptop',
        text: 'Has he returned his laptop and any other equipment?',
        reply: 'Yes, he dropped the laptop at the IT desk on Friday afternoon. He never had a company phone.',
        keywords: ['laptop', 'equipment', 'returned', 'hand back'],
        reveals: ['laptop_returned'],
      },
      {
        id: 'q_gossip',
        text: 'Did he leave on bad terms? Any gossip?',
        reply: "I'd rather not get into that. I just need his access sorted properly.",
        keywords: ['gossip', 'bad terms'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Friday 16:12    SUCCESS   Windows sign-in        HPL-LT-1458          HQ',
        'Saturday 21:47  SUCCESS   Outlook on the web     Home broadband (UK)  MFA approved',
        'Sunday 10:05    SUCCESS   Teams (mobile web)     Home broadband (UK)  Token refresh',
        'Last 24 h       FAILURES  none',
      ],
      reveals: ['weekend_signin'],
    },
    toolReveals: { directory: ['is_manager', 'still_active', 'hr_record'], endpoint: ['laptop_returned'] },
    actionResults: {
      disable_account: {
        result: 'declan.shaw disabled (HR ref LVR-2291). New sign-ins are blocked. The two existing sessions still hold valid tokens until they are revoked.',
        accountUpdate: { status: 'Disabled', statusNote: 'Disabled per HR leaver record LVR-2291.' },
      },
      revoke_sessions: {
        result: 'All sessions revoked. The Saturday webmail session and the Teams token are gone; the account now shows 0 active sessions.',
        accountUpdate: { activeSessions: 0 },
      },
      grant_mailbox_access: {
        result: "You gave Harriet full access to a leaver's mailbox without the HR approval that leaver mailbox access needs. His personal and HR correspondence is in there.",
      },
      reset_password: {
        result: "You reset the leaver's password. Nothing is blocked (the old sessions still work) and you now have a password for an account that should be off.",
      },
    },
    requiredActions: ['disable_account', 'revoke_sessions'],
    helpfulActions: [],
    harmfulActions: ['grant_mailbox_access', 'reset_password', 'enable_account'],
    rootCauses: [
      { id: 'leaver_missed', label: 'Leaver process not actioned: account still active after the last working day' },
      { id: 'compromised', label: 'Account compromised by an external attacker' },
      { id: 'hr_wrong', label: 'HR recorded the wrong leaving date' },
      { id: 'teams_bug', label: 'Teams presence bug' },
    ],
    correctRootCause: 'leaver_missed',
    correctOutcome: 'resolve',
    noteKeywords: ['leaver', 'LVR-2291', 'disabled', 'revoked', 'manager', 'saturday', 'hr approval'],
    replyKeywords: ['disabled', 'mailbox', 'hr'],
    kb: ['kb-joiners-leavers'],
    solution: [
      'Verify Harriet, then confirm the request is legitimate: she is his manager in Directory and HR record LVR-2291 exists.',
      'Directory: the account is still enabled with active sessions.',
      'Sign-in log: webmail and Teams activity over the weekend, after his last day.',
      'Disable the account and revoke all sessions.',
      'Explain that mailbox access for a leaver needs HR approval via the leaver mailbox form.',
    ],
    debrief:
      "Disabling an account is a sensitive change, so check twice: the requester is who they say, and they have the standing to ask (manager in Directory, HR leaver record). Disabling alone doesn't end sessions that are already open, which is why you revoke them too. Mailbox access to a leaver's mail is a separate, HR-approved request, however reasonable it sounds.",
  }),

  // ---------------------------------------------------------------- 6. MFA fatigue
  scenario({
    id: 'sec-mfa-fatigue',
    title: 'My phone keeps asking me to approve sign-ins',
    category: 'Security',
    difficulty: 3,
    priority: 'P1',
    channel: 'chat',
    targetMinutes: 6,
    requester: person('Imogen Clarke', 'Customs Compliance Officer', 'Compliance', 'HQ, Floor 5'),
    description:
      "Hi, my phone keeps buzzing with sign-in approval requests, about ten in the last half hour. I'm not trying to log in to anything, I've been at my desk all afternoon. I've been pressing Deny. Is this normal??",
    account: account('imogen.clarke', {
      mfa: 'Enrolled (Authenticator app, 14 push requests denied today)',
      passwordLastSet: '71 days ago',
      activeSessions: 3,
    }),
    device: device('HPL-LT-5267'),
    identity: { verifiable: true, reply: 'Employee ID 50318, and my manager is Victor Hale.' },
    facts: [
      { id: 'not_initiated', label: 'User did not start any of the sign-ins' },
      { id: 'all_denied', label: 'User has denied every prompt and approved none' },
      { id: 'password_ok_mfa_denied', label: 'Sign-in log: correct password from an overseas IP, MFA denied 14 times' },
      { id: 'reused_password', label: 'Work password was reused on a cycling club site that reported a breach' },
      { id: 'no_success', label: 'No successful sign-in from the attacker' },
      { id: 'tempted', label: 'User was tempted to approve one just to make it stop' },
    ],
    keyFacts: ['not_initiated', 'all_denied', 'password_ok_mfa_denied', 'reused_password'],
    questions: [
      {
        id: 'q_initiated',
        text: 'Have you been trying to sign in to anything, on any device, in the last hour?',
        reply: "No. I've been on my laptop all afternoon and I was already signed in. My personal tablet is at home.",
        keywords: ['trying to sign in', 'logging in', 'any device', 'started', 'initiated'],
        reveals: ['not_initiated'],
      },
      {
        id: 'q_approved',
        text: 'Have you approved any of the prompts, even by accident?',
        reply: 'No, I pressed Deny on every single one. At least I think so... yes, every one.',
        keywords: ['approved', 'accept', 'by accident', 'pressed', 'any of the prompts'],
        reveals: ['all_denied'],
      },
      {
        id: 'q_deny',
        text: "Please keep denying every prompt you didn't start, and don't approve one even to make them stop.",
        reply: "Okay, I will. Honestly I was about to approve one just to get some peace. Glad I didn't.",
        keywords: ['keep denying', 'deny', 'make them stop', "don't approve"],
        reveals: ['tempted'],
      },
      {
        id: 'q_reuse',
        text: 'Have you used your work password on any other website or service?',
        reply: 'Oh no. I used it for my cycling club\'s website, and they emailed last week saying they\'d had a "security incident". I ignored it.',
        keywords: ['other website', 'reuse', 'reused', 'same password', 'anywhere else'],
        reveals: ['reused_password'],
      },
      {
        id: 'q_blame',
        text: 'You realise this is probably your own fault, right?',
        reply: "...I came to you as soon as it started. That doesn't feel very fair.",
        keywords: ['your own fault', 'your fault'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Today 08:52  SUCCESS        Windows sign-in   HPL-LT-5267         HQ',
        'Today 15:31  PASSWORD OK    Web sign-in       102.89.x.x (abroad)  MFA push DENIED (#1)',
        'Today 15:33  PASSWORD OK    Web sign-in       102.89.x.x (abroad)  MFA push DENIED (#2)',
        '  ...        11 more attempts, same IP, about every 2 minutes, all MFA DENIED',
        'Today 16:02  PASSWORD OK    Web sign-in       102.89.x.x (abroad)  MFA push DENIED (#14)',
        'Last 24 h    SUCCESS from new locations: none',
      ],
      reveals: ['password_ok_mfa_denied', 'no_success'],
    },
    toolReveals: { directory: ['all_denied'] },
    actionResults: {
      reset_password: {
        result: 'Password reset through the verified channel. Imogen chose a new, unique password while you stayed in the chat. The prompts stopped within a minute.',
        accountUpdate: { passwordLastSet: 'Just now' },
      },
      revoke_sessions: {
        result: 'All sessions revoked. Imogen signed back in on her laptop with the new password and approved her own prompt.',
        accountUpdate: { activeSessions: 1 },
      },
      reset_mfa: {
        result: 'You removed MFA from an account whose password the attacker has. The next attempt from 102.89.x.x signs in and gets asked to register their own authenticator.',
        accountUpdate: { mfa: 'Not registered (re-registration required)' },
      },
      av_scan: { result: 'Full scan complete, no threats found. The password came from the breached cycling club site, not this laptop.' },
    },
    requiredActions: ['reset_password', 'revoke_sessions'],
    helpfulActions: ['av_scan'],
    harmfulActions: ['reset_mfa', 'reimage', 'isolate_device'],
    rootCauses: [
      { id: 'mfa_fatigue', label: 'Stolen (reused) password used in an MFA fatigue / push bombing attack' },
      { id: 'app_glitch', label: 'Authenticator app glitch' },
      { id: 'old_device', label: 'An old device still trying to sign in' },
      { id: 'lockout', label: 'Account lockout policy issue' },
    ],
    correctRootCause: 'mfa_fatigue',
    correctOutcome: 'escalate',
    escalateTo: 'Security Operations',
    noteKeywords: ['mfa fatigue', 'push', 'denied', 'password reset', 'revoked', 'reused', '102.89', 'security'],
    replyKeywords: ['deny', 'password', 'security'],
    kb: ['kb-mfa-fatigue', 'kb-identity'],
    solution: [
      'Tell Imogen to keep denying every prompt, and thank her for reporting it.',
      "Confirm she didn't start any sign-ins and approved none.",
      'Sign-in log: the password works from an overseas IP; only MFA is stopping them.',
      'Verify, reset the password and revoke all sessions. Do not touch MFA.',
      'Find the source (a reused password on a breached site) and escalate to Security Operations with the IP and times.',
    ],
    debrief:
      'A push prompt only appears after the right password, so a stream of unexpected prompts means the password is already known. The attacker is betting the user will approve one to make it stop. Reset the password and revoke sessions, and leave MFA alone: it is the one control that worked. Security Operations needs the IP and the reuse story to block the source and check for other targets.',
  }),

  // ---------------------------------------------------------------- 7. BitLocker recovery
  scenario({
    id: 'hw-bitlocker',
    title: 'Laptop asking for a BitLocker recovery key',
    category: 'Hardware',
    difficulty: 2,
    priority: 'P2',
    channel: 'phone',
    targetMinutes: 6,
    requester: person('Tobias Wren', 'Freight Accounts Analyst', 'Finance', 'HQ, Floor 2'),
    description:
      "Morning. My laptop is stuck on a blue screen that says 'BitLocker recovery' and wants a long recovery key. It installed some update when I shut it down last night. I don't have any key! My month-end report is due at noon.",
    account: account('tobias.wren'),
    device: device('HPL-LT-2647', {
      online: false,
      ip: '',
      gateway: '',
      dns: '',
      uptime: 'At pre-boot recovery screen',
      lastPatch: 'Yesterday (BIOS firmware 1.21)',
      installedNotes: [
        'Endpoint protection: healthy (last report yesterday 18:01)',
        'BitLocker: On (TPM), recovery key escrowed to the directory, Key ID 7C41A0E2',
        'Last deployment: BIOS firmware 1.21, installed yesterday 18:05 (BitLocker was not suspended first)',
      ],
    }),
    identity: { verifiable: true, reply: 'Sure. Employee ID 41982, and my manager is Grace Lindqvist.' },
    facts: [
      { id: 'firmware_update', label: 'BIOS firmware 1.21 installed last night without suspending BitLocker' },
      { id: 'key_id', label: 'Recovery screen shows Key ID 7C41A0E2' },
      { id: 'key_match', label: "The escrowed key's ID matches the one on screen" },
      { id: 'in_possession', label: 'Laptop never left the user’s possession' },
      { id: 'deadline', label: 'Month-end report due at noon' },
    ],
    keyFacts: ['firmware_update', 'key_id', 'key_match'],
    questions: [
      {
        id: 'q_keyid',
        text: 'Can you read me the Key ID shown on the recovery screen?',
        reply: 'It says "Key ID: 7C41A0E2" and then a longer string after that.',
        keywords: ['key id', 'screen say', 'identifier', 'read me'],
        reveals: ['key_id'],
      },
      {
        id: 'q_update',
        text: 'What happened just before this started?',
        reply: 'When I shut down last night it said "Installing firmware update, do not power off". This morning I got this screen.',
        keywords: ['before', 'update', 'what happened', 'changed', 'last night'],
        reveals: ['firmware_update'],
      },
      {
        id: 'q_possession',
        text: 'Has the laptop been with you the whole time since then?',
        reply: 'Yes, it was on my desk at home overnight and in my bag on the way in.',
        keywords: ['with you', 'whole time', 'possession', 'anyone else', 'left it'],
        reveals: ['in_possession'],
      },
      {
        id: 'q_deadline',
        text: 'Is there anything time-critical on it today?',
        reply: 'My month-end freight accruals report is due at noon. It is all in Excel on this laptop.',
        keywords: ['deadline', 'time-critical', 'urgent', 'due'],
        reveals: ['deadline'],
      },
      {
        id: 'q_hacked',
        text: 'Sounds like you might have been hacked, to be honest.',
        reply: "Hacked?! Should I be panicking? I just did an update...",
        keywords: ['hacked'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['firmware_update'] },
    actionResults: {
      view_bitlocker_key: {
        result:
          'Device record HPL-LT-2647 (owner: tobias.wren). Recovery Key ID 7C41A0E2, matching the screen. Key: 284163-501226-730488-119647-602915-447320-058261-391704. Access audited.',
        reveals: ['key_match'],
      },
      guide_bitlocker_key: {
        result:
          'You read the key in groups of six while Tobias typed. Windows started normally and BitLocker resumed protection on its own. His report is open in Excel.',
        deviceUpdate: { online: true, ip: '10.20.4.149', gateway: '10.20.4.1', dns: '10.20.0.10', uptime: '2 minutes' },
      },
      reimage: {
        result: "Reimage scheduled. Tobias loses everything stored locally, including his month-end report, for a laptop that only needed its recovery key.",
      },
    },
    requiredActions: ['view_bitlocker_key', 'guide_bitlocker_key'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'firmware_tpm', label: 'Firmware update changed the TPM measurements, triggering BitLocker recovery' },
      { id: 'disk_failure', label: 'Failing disk' },
      { id: 'tamper', label: 'Device tampering or theft attempt' },
      { id: 'ransomware', label: 'Ransomware encrypted the drive' },
    ],
    correctRootCause: 'firmware_tpm',
    correctOutcome: 'resolve',
    noteKeywords: ['bitlocker', 'recovery key', '7C41A0E2', 'firmware', 'verified', 'key id'],
    replyKeywords: ['bitlocker', 'firmware', 'update'],
    kb: ['kb-bitlocker'],
    solution: [
      'Verify Tobias before going anywhere near the key.',
      'Get the Key ID from the screen and find out what happened (firmware update last night).',
      'Endpoint record: BIOS 1.21 installed without suspending BitLocker.',
      'Retrieve the escrowed key, confirm the Key ID matches, and read it to Tobias in groups of six.',
      'Confirm Windows starts; note the firmware deployment so Tier 2 can fix the rollout.',
    ],
    debrief:
      'BitLocker recovery after a firmware update is the TPM doing its job: the start-up measurements changed and it cannot tell an update from tampering. The key unlocks the whole disk, so verify first and confirm the Key ID matches before reading it out. Reimaging would have destroyed a report due at noon to fix something that needed one key.',
  }),

  // ---------------------------------------------------------------- 8. OneDrive red X
  scenario({
    id: 'sw-onedrive-sync',
    title: 'OneDrive red X on my project folder',
    category: 'Software',
    difficulty: 2,
    priority: 'P4',
    channel: 'portal',
    targetMinutes: 6,
    requester: person('Felix Hartmann', 'Project Coordinator', 'Projects', 'HQ, Floor 5'),
    description:
      "OneDrive has a red X on my 'Port Expansion 2026' folder and my colleagues say they can't see the files I added yesterday. Everything else looks fine. Not urgent, but I'd like it sorted before Thursday's review. Thanks, Felix",
    account: account('felix.hartmann'),
    device: device('HPL-LT-5390', {
      installedNotes: [
        'Endpoint protection: healthy',
        'VPN Client 5.1.3',
        'OneDrive: signed in, up to date, 41.2 GB of 1 TB used',
        'OneDrive: 1 sync issue in "Port Expansion 2026"',
      ],
    }),
    facts: [
      { id: 'one_folder', label: 'Only the "Port Expansion 2026" folder has the red X; everything else syncs' },
      { id: 'copied_archive', label: 'User copied a deeply nested archive from the old S: drive yesterday' },
      { id: 'path_too_long', label: 'OneDrive reports file paths of up to 438 characters (limit 400)' },
      { id: 'storage_ok', label: 'Storage is fine: 41.2 GB of 1 TB used' },
      { id: 'signed_in', label: 'OneDrive client is signed in and up to date' },
    ],
    keyFacts: ['one_folder', 'copied_archive', 'path_too_long', 'storage_ok'],
    questions: [
      {
        id: 'q_scope',
        text: 'Is it just that one folder, or are other files not syncing either?',
        reply: 'Just that folder. My other documents have green ticks and colleagues can see them.',
        keywords: ['just that', 'one folder', 'other files', 'everything else', 'only'],
        reveals: ['one_folder'],
      },
      {
        id: 'q_changed',
        text: 'What did you put in that folder yesterday?',
        reply: 'I copied the whole old project archive from the S: drive into it. It has folders inside folders inside folders, years of it.',
        keywords: ['yesterday', 'what did you put', 'copied', 'added', 'changed'],
        reveals: ['copied_archive'],
      },
      {
        id: 'q_icon',
        text: 'If you click the OneDrive cloud icon, does it say you are signed in?',
        reply: 'Yes, it shows my name and "1 issue". It says I am up to date apart from that.',
        keywords: ['cloud icon', 'signed in', 'onedrive icon', 'account'],
        reveals: ['signed_in'],
      },
      {
        id: 'q_lazy',
        text: "Couldn't you just email the files to everyone instead?",
        reply: "There are hundreds of them. That's what OneDrive is for, isn't it?",
        keywords: ['email the files', 'email them'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['storage_ok', 'signed_in'] },
    terminal: {
      'Get-EventLog Application -Newest 5': {
        output:
          'Index Time          EntryType   Source     Message\n----- ----          ---------   ------     -------\n91240 Today 09:14   Warning     OneDrive   Sync issue: path too long (438 chars) "...\\Port Expansion 2026\\Archive\\2019 Phase 1 Planning Documents Final\\Stakeholder Consultation Responses Received\\..."\n91238 Today 09:14   Warning     OneDrive   Sync issue: path too long (421 chars) "...\\Archive\\2019 Phase 1 Planning Documents Final\\Environmental Survey Appendices\\..."\n91231 Today 09:13   Information OneDrive   Uploaded 1,212 of 1,264 items in "Port Expansion 2026"\n91190 Today 08:12   Information Winlogon   User logon notification\n91176 Today 08:01   Information OneDrive   Signed in as felix.hartmann@hpl.example',
        reveals: ['path_too_long'],
        whenDone: {
          action: 'guide_onedrive_shorten',
          output:
            'Index Time          EntryType   Source     Message\n----- ----          ---------   ------     -------\n91302 Today 09:31   Information OneDrive   Sync complete: "Port Expansion 2026" (1,264 items)\n91298 Today 09:30   Information OneDrive   Uploaded 52 items in "Port Expansion 2026"\n91240 Today 09:14   Warning     OneDrive   Sync issue: path too long (438 chars)\n91238 Today 09:14   Warning     OneDrive   Sync issue: path too long (421 chars)\n91231 Today 09:13   Information OneDrive   Uploaded 1,212 of 1,264 items in "Port Expansion 2026"',
        },
      },
    },
    actionResults: {
      guide_onedrive_shorten: {
        result:
          'Felix renamed "2019 Phase 1 Planning Documents Final" to "2019 Ph1" and moved "Archive" up a level. OneDrive picked up the last 52 files within a minute and the red X turned into a green tick.',
      },
      repair_office: { result: 'Office repair ran for 30 minutes. OneDrive still shows the red X: the paths are still too long.' },
      reimage: { result: 'Reimage scheduled. Felix loses his afternoon, and the long paths come straight back down from the cloud copy.' },
    },
    requiredActions: ['guide_onedrive_shorten'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'path_length', label: 'File paths in the copied archive exceed the 400-character limit' },
      { id: 'storage', label: 'OneDrive storage is full' },
      { id: 'signed_out', label: 'OneDrive client is signed out' },
      { id: 'outage', label: 'Microsoft 365 service outage' },
    ],
    correctRootCause: 'path_length',
    correctOutcome: 'resolve',
    noteKeywords: ['onedrive', 'path too long', '400', 'archive', 'renamed', 'storage'],
    replyKeywords: ['onedrive', 'folder', 'path'],
    kb: ['kb-onedrive-sync'],
    solution: [
      'Scope it: only one folder, right after copying an old archive into it.',
      'Rule out storage and sign-in: 41 GB of 1 TB, client signed in.',
      'Find the error: the event log shows paths of 421-438 characters.',
      'Guide Felix to shorten the top-level folder names; confirm the green tick.',
    ],
    debrief:
      'Always ask OneDrive what it is unhappy about before resetting it. Old file shares often hold folder trees nested so deep that the full path breaks the 400-character limit. Shortening a couple of names near the top fixes hundreds of files at once. Repairs and reimages cannot shorten a path.',
  }),

  // ---------------------------------------------------------------- 9. Teams audio after docking
  scenario({
    id: 'sw-teams-audio',
    title: "Nobody can hear me on Teams calls",
    category: 'Software',
    difficulty: 1,
    priority: 'P3',
    channel: 'chat',
    targetMinutes: 4,
    requester: person('Nadia Petrova', 'Customer Service Advisor', 'Customer Service', 'HQ, Floor 1'),
    description:
      "Hi! Nobody can hear me on Teams calls and I can't hear them either. My headset worked fine yesterday. I have a customer call in 20 minutes, can you help?",
    account: account('nadia.petrova'),
    device: device('HPL-LT-1186', {
      installedNotes: [
        'Endpoint protection: healthy',
        'Connected: USB-C Dock D3 (desk 1-07), lid closed',
        'Audio devices: USB Headset H300 (connected), Monitor speakers (DisplayPort Audio), Laptop microphone array',
        'Teams devices: speaker = Monitor speakers (DisplayPort Audio), microphone = Laptop microphone array',
      ],
    }),
    facts: [
      { id: 'new_desk', label: 'Started after docking at a different hot desk this morning' },
      { id: 'headset_ok', label: 'Headset works in other apps (a training video plays through it)' },
      { id: 'teams_wrong_device', label: 'Teams is using the monitor speakers and the closed laptop’s microphone' },
      { id: 'not_muted', label: 'Not muted in Teams or on the headset' },
    ],
    keyFacts: ['new_desk', 'headset_ok', 'teams_wrong_device'],
    questions: [
      {
        id: 'q_changed',
        text: 'Has anything changed since yesterday, like a different desk or dock?',
        reply: "Oh, I'm at a different hot desk today, 1-07. I plugged into the dock there and closed the laptop lid like I always do.",
        keywords: ['changed', 'different desk', 'dock', 'since yesterday', 'moved'],
        reveals: ['new_desk'],
      },
      {
        id: 'q_other_apps',
        text: 'Does the headset work in other apps, for example if you play a video?',
        reply: 'Yes! I just played a training video and it came through the headset fine.',
        keywords: ['other apps', 'video', 'youtube', 'music', 'play something'],
        reveals: ['headset_ok'],
      },
      {
        id: 'q_mute',
        text: 'Is the mute switch on the headset cable off, and are you unmuted in Teams?',
        reply: 'Yes, I checked both. The mic icon in Teams is not crossed out.',
        keywords: ['mute', 'muted', 'unmuted'],
        reveals: ['not_muted'],
      },
      {
        id: 'q_quiet',
        text: 'Are you sure you are not just talking too quietly?',
        reply: "They can't hear me at all, and I can't hear them. It's not about volume.",
        keywords: ['too quietly', 'speak up', 'louder'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['teams_wrong_device'] },
    actionResults: {
      guide_audio_device: {
        result:
          'Nadia opened Teams > Settings > Devices and switched Speaker and Microphone to "USB Headset H300". The test call played back her voice clearly.',
        reveals: ['teams_wrong_device'],
      },
      clear_teams_cache: { result: 'Teams cache cleared and Teams restarted. It still uses the monitor speakers: the device choice is a setting, not cache.' },
      deploy_teams: { result: 'Teams reinstalled. Nadia had to sign in again and the audio still goes to the monitor.' },
      reimage: { result: 'Reimage scheduled. Nadia misses her customer call over a dropdown setting.' },
    },
    requiredActions: ['guide_audio_device'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'wrong_device', label: 'Teams switched to the monitor speakers and laptop mic after docking' },
      { id: 'headset_broken', label: 'Faulty headset' },
      { id: 'driver', label: 'Audio driver failure' },
      { id: 'teams_outage', label: 'Teams service outage' },
    ],
    correctRootCause: 'wrong_device',
    correctOutcome: 'resolve',
    noteKeywords: ['teams', 'headset', 'dock', 'monitor speakers', 'devices', 'test call'],
    replyKeywords: ['headset', 'teams', 'settings'],
    kb: ['kb-audio-devices', 'kb-docks'],
    solution: [
      'Ask what changed: a different hot desk and dock this morning.',
      'Check the headset works elsewhere: it does, so the hardware is fine.',
      'Look at the device: Teams is set to the monitor speakers and the closed laptop mic.',
      'Walk Nadia through Teams > Settings > Devices and a test call.',
    ],
    debrief:
      'Docks and monitors bring their own audio devices, and Teams often switches to them. One question about what changed plus a quick look at the device settings beats reinstalling anything. With the lid closed, the laptop microphone can only hear the desk.',
  }),

  // ---------------------------------------------------------------- 10. Wi-Fi certificate on new laptop
  scenario({
    id: 'net-wifi-cert',
    title: "New laptop: can't connect to the office Wi-Fi",
    category: 'Network',
    difficulty: 3,
    priority: 'P3',
    channel: 'chat',
    targetMinutes: 7,
    requester: person('Ewan Fraser', 'Warehouse Systems Analyst', 'Operations', 'HQ, Floor 3'),
    description:
      "Got my new laptop yesterday. It won't connect to HPL-Corp, it just says \"Can't connect to this network\". My old laptop never had a problem. I'm plugged into a dock with a cable for now, but I'm in meeting rooms all afternoon.",
    account: account('ewan.fraser'),
    device: device('HPL-LT-7841', {
      model: 'Standard Laptop L14 (Gen 4)',
      uptime: '3 hours',
      lastPatch: 'Yesterday (enrollment)',
      installedNotes: [
        'Endpoint protection: healthy',
        'VPN Client 5.1.3',
        'Device management: enrolled yesterday 15:40, last policy sync yesterday 15:42',
        'Pending assignments: "Wi-Fi device certificate", "HPL-Corp Wi-Fi profile" (added to device group at 16:10)',
      ],
    }),
    facts: [
      { id: 'new_laptop', label: 'Laptop was handed over yesterday afternoon and taken straight home' },
      { id: 'policy_pending', label: 'Wi-Fi certificate and profile are still pending in device management' },
      { id: 'no_cert', label: 'No device certificate in the certificate store' },
      { id: 'manual_profile', label: 'Only a manually added, password-based HPL-Corp profile exists' },
      { id: 'others_ok', label: 'Colleagues connect to HPL-Corp fine' },
    ],
    keyFacts: ['new_laptop', 'policy_pending', 'no_cert', 'manual_profile'],
    questions: [
      {
        id: 'q_when',
        text: 'When did you get the laptop, and where did you first sign in?',
        reply: 'Field Services handed it over yesterday afternoon. I signed in at their desk and took it straight home. Today is the first time it has been in the office.',
        keywords: ['when did you get', 'first sign in', 'handed over', 'new laptop', 'yesterday'],
        reveals: ['new_laptop'],
      },
      {
        id: 'q_others',
        text: 'Are colleagues around you connected to HPL-Corp?',
        reply: 'Yes, everyone else on the floor is fine. My phone is on HPL-Guest without any problems too.',
        keywords: ['colleagues', 'others', 'anyone else', 'everyone else'],
        reveals: ['others_ok'],
      },
      {
        id: 'q_password',
        text: 'Did it ask you for a password when you tried to connect?',
        reply: 'It did, so I added HPL-Corp myself and typed my normal password. That is when it says it cannot connect.',
        keywords: ['password', 'ask you for', 'prompt'],
        reveals: ['manual_profile'],
      },
      {
        id: 'q_broke',
        text: 'Did you break it already? It is brand new.',
        reply: "I don't think switching it on counts as breaking it.",
        keywords: ['break it', 'broke'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['policy_pending'] },
    terminal: {
      'netsh wlan show profiles': {
        output:
          'Profiles on interface Wi-Fi:\n\nGroup policy profiles (read only)\n---------------------------------\n    <None>\n\nUser profiles\n-------------\n    All User Profile     : HPL-Corp   (added manually, WPA2-Personal)',
        reveals: ['manual_profile'],
        whenDone: {
          action: 'sync_device_policy',
          output:
            'Profiles on interface Wi-Fi:\n\nGroup policy profiles (read only)\n---------------------------------\n    HPL-Corp   (managed, WPA2-Enterprise, certificate)\n\nUser profiles\n-------------\n    All User Profile     : HPL-Corp   (added manually, WPA2-Personal)',
        },
      },
      'certutil -store -user my': {
        output: 'My "Personal"\n================\nCertUtil: -store command completed successfully.\n(0 certificates)',
        reveals: ['no_cert'],
        whenDone: {
          action: 'sync_device_policy',
          output:
            'My "Personal"\n================\n================ Certificate 0 ================\nSubject: CN=HPL-LT-7841.hpl.example\nIssuer: CN=HPL Device Issuing CA\nTemplate: HPL Wi-Fi Device\nNotAfter: in 1 year\nCertUtil: -store command completed successfully.',
        },
      },
    },
    actionResults: {
      sync_device_policy: {
        result:
          'HPL-LT-7841 checked in over the wired connection and applied 2 pending assignments: the Wi-Fi device certificate and the managed HPL-Corp profile.',
        reveals: ['policy_pending'],
        deviceUpdate: {
          installedNotes: [
            'Endpoint protection: healthy',
            'VPN Client 5.1.3',
            'Device management: last policy sync just now, all assignments applied',
          ],
        },
      },
      guide_wifi_reconnect: {
        result:
          'Ewan forgot the HPL-Corp network he had added by hand, unplugged the cable and picked HPL-Corp again. It connected straight away using the certificate, with no password prompt.',
      },
      grant_admin: { result: 'Ewan now has local admin and is trying to import a certificate he found on an old wiki page. It will not work, and policy forbids it.' },
      reimage: { result: 'Reimage scheduled on a laptop that is one day old. Ewan loses the day setting it up again, all for a policy that had not synced.' },
    },
    requiredActions: ['sync_device_policy', 'guide_wifi_reconnect'],
    helpfulActions: [],
    harmfulActions: ['grant_admin', 'reimage'],
    rootCauses: [
      { id: 'policy_not_synced', label: 'Wi-Fi certificate and profile were never applied: the device has not synced since enrollment' },
      { id: 'wifi_outage', label: 'Wi-Fi access point outage' },
      { id: 'wrong_password', label: 'User typed the wrong password' },
      { id: 'faulty_card', label: 'Faulty wireless card' },
    ],
    correctRootCause: 'policy_not_synced',
    correctOutcome: 'resolve',
    noteKeywords: ['wi-fi', 'certificate', 'profile', 'device management', 'sync', 'HPL-Corp', 'pending'],
    replyKeywords: ['wi-fi', 'certificate', 'laptop'],
    kb: ['kb-wifi-certificates'],
    solution: [
      'Rule out an outage: colleagues and his phone are fine.',
      'Find out how the laptop was set up: handed over yesterday, straight home, first day in the office.',
      'Device management shows the Wi-Fi certificate and profile still pending; the certificate store is empty.',
      'Sync device policy over the wired connection.',
      'Have Ewan forget the manually added HPL-Corp and reconnect; confirm it uses the certificate.',
    ],
    debrief:
      'HPL-Corp signs devices in with a certificate, not a password, so a laptop without that certificate cannot join however carefully the user types. This one was assigned the Wi-Fi policies after its last check-in and then went home. A policy sync on a cable fixes it in a minute. Admin rights and reimages are the expensive wrong answers.',
  }),
];
