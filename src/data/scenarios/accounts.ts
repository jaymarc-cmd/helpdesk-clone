import type { Scenario } from '../../types';
import { account, device, person, scenario } from './base';

export const accountScenarios: Scenario[] = [
  scenario({
    id: 'acc-lockout-phone',
    title: 'Locked out again, third time this week',
    category: 'Accounts',
    difficulty: 1,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 5,
    requester: person('Dana Whitfield', 'Accounts Payable Specialist', 'Finance', 'HQ, Floor 2'),
    description:
      "Hi, I keep getting locked out of my computer. I changed my password on Monday like the reminder told me to, and since then I've been locked out three times. Every time someone unlocks it, it happens again a few hours later. Can you please fix this for good?",
    account: account('dana.whitfield', {
      status: 'Locked',
      failedLogons: 12,
      passwordLastSet: 'Monday 09:14',
      lastLogon: 'Today 07:58',
    }),
    device: device('HPL-LT-2231'),
    identity: {
      verifiable: true,
      reply: 'Sure. My employee ID is 40217 and my manager is Priya Raman.',
    },
    facts: [
      { id: 'changed_pw', label: 'Lockouts began right after the Monday password change' },
      { id: 'phone_mail', label: 'Work email is set up on a personal phone' },
      { id: 'lockout_source', label: 'Failed logons come from a mobile mail client (ActiveSync)' },
      { id: 'locked', label: 'Account is currently locked' },
    ],
    keyFacts: ['phone_mail', 'lockout_source', 'locked'],
    questions: [
      {
        id: 'q_when',
        text: 'When did the lockouts start?',
        reply: 'Right after I changed my password on Monday. Before that I had never been locked out.',
        keywords: ['when', 'start', 'began', 'since', 'first'],
        reveals: ['changed_pw'],
      },
      {
        id: 'q_devices',
        text: 'Do you use your work account on any other device, like a phone or tablet?',
        reply:
          "Oh, yes, I have my work email on my phone. It's been popping up asking for something since Monday but I've just been ignoring it.",
        keywords: ['phone', 'mobile', 'tablet', 'device', 'other devices', 'ipad'],
        reveals: ['phone_mail'],
      },
      {
        id: 'q_now',
        text: 'Are you locked out right now?',
        reply: "Yes, I'm typing this on a colleague's computer.",
        keywords: ['now', 'currently', 'right now', 'at the moment'],
        reveals: ['locked'],
      },
      {
        id: 'q_typing',
        text: 'Are you sure you are typing the new password correctly?',
        reply: "Yes! Once I'm unlocked I log in fine. It's the random lockouts later in the day.",
        keywords: ['typing', 'typo', 'caps', 'correctly'],
        quality: 'neutral',
      },
      {
        id: 'q_wifi',
        text: 'Does your phone connect to the office Wi-Fi?',
        reply: 'No, it just uses mobile data. Only the email app is set up.',
        keywords: ['wifi', 'wi-fi', 'wireless'],
      },
      {
        id: 'q_written',
        text: 'Have you been writing your password down somewhere?',
        reply: "...No. Why would you assume that? I just want this to stop happening.",
        keywords: ['write', 'written', 'sticky', 'note down'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Today 07:58  SUCCESS   Windows sign-in          HPL-LT-2231',
        'Today 08:41  FAILURE   Exchange ActiveSync      iPhone Mail (bad password)',
        'Today 08:56  FAILURE   Exchange ActiveSync      iPhone Mail (bad password)',
        'Today 09:11  FAILURE   Exchange ActiveSync      iPhone Mail (bad password)',
        'Today 09:12  LOCKOUT   Threshold reached        Source: ActiveSync',
      ],
      reveals: ['lockout_source'],
    },
    toolReveals: { directory: ['locked'] },
    actionResults: {
      unlock_account: {
        result:
          'Account unlocked. Warning: the mobile mail client is still retrying with the old password and will lock the account again unless it is updated.',
        accountUpdate: { status: 'Active', failedLogons: 0 },
      },
      guide_phone_password: {
        result:
          'Dana opened her phone mail settings and entered the new password. Mail synced immediately and no new failures appear in the sign-in log.',
      },
      reset_password: {
        result:
          'Temporary password issued. Dana can sign in, but the phone keeps sending the outdated password and the account will lock again within the hour.',
        accountUpdate: { status: 'Active', failedLogons: 0, passwordLastSet: 'Just now' },
      },
    },
    requiredActions: ['unlock_account', 'guide_phone_password'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'stale_mobile', label: 'Old password still saved in a mobile mail app' },
      { id: 'forgot', label: 'User forgot the new password' },
      { id: 'brute_force', label: 'Brute-force attack from the internet' },
      { id: 'policy', label: 'Lockout policy misconfigured' },
    ],
    correctRootCause: 'stale_mobile',
    correctOutcome: 'resolve',
    noteKeywords: ['unlock', 'phone', 'activesync', 'mobile', 'password'],
    replyKeywords: ['phone', 'password', 'unlock'],
    kb: ['kb-lockouts', 'kb-identity'],
    solution: [
      'Verify the requester before touching the account.',
      'Open the sign-in log and spot repeated ActiveSync failures from the phone.',
      'Unlock the account.',
      'Walk Dana through updating the password in her phone mail app.',
      'Confirm no new failures, document the cause and close.',
    ],
    debrief:
      'Repeated lockouts right after a password change are almost always caused by a device that still has the old password saved: a phone mail app, a tablet, a mapped drive or a saved Wi-Fi profile. Unlocking alone treats the symptom; finding the source in the sign-in log fixes it for good.',
  }),

  scenario({
    id: 'acc-expired-remote',
    title: 'Password expired while working from home',
    category: 'Accounts',
    difficulty: 2,
    priority: 'P2',
    channel: 'phone',
    targetMinutes: 6,
    requester: person('Marcus Oyelaran', 'Field Sales Representative', 'Sales', 'Remote (home office)'),
    description:
      "My laptop says my password expired and I need to change it, but when I try it says the domain isn't available. I'm working from home today and I have a client call at 2pm. I need the CRM!",
    account: account('marcus.oyelaran', {
      passwordExpired: true,
      passwordLastSet: '91 days ago',
      lastLogon: 'Yesterday 17:40',
    }),
    device: device('HPL-LT-1874', { ip: '192.168.1.37', gateway: '192.168.1.1', dns: '192.168.1.1' }),
    identity: {
      verifiable: true,
      reply: 'Employee ID 51880, my manager is Tom Becker. You can call me back on the mobile number ending 4471.',
    },
    facts: [
      { id: 'expired', label: 'Password has expired (91 days old)' },
      { id: 'home', label: 'User is off-site on home Wi-Fi, not on VPN' },
      { id: 'cant_change', label: 'Windows cannot change the password without reaching a domain controller' },
      { id: 'vpn_rejects', label: 'VPN also rejects the expired password' },
    ],
    keyFacts: ['expired', 'home', 'vpn_rejects'],
    questions: [
      {
        id: 'q_where',
        text: 'Are you in the office or working remotely?',
        reply: "Home. I'm on my home Wi-Fi.",
        keywords: ['where', 'office', 'remote', 'home', 'location'],
        reveals: ['home'],
      },
      {
        id: 'q_vpn',
        text: 'Can you connect to the VPN?',
        reply: 'No. The VPN login says my password has expired too.',
        keywords: ['vpn', 'connect', 'tunnel'],
        reveals: ['vpn_rejects'],
      },
      {
        id: 'q_error',
        text: 'What exactly does the error message say when you try to change it?',
        reply: '"The domain is not available." Every time.',
        keywords: ['error', 'message', 'exactly', 'say'],
        reveals: ['cant_change'],
      },
      {
        id: 'q_restart',
        text: 'Have you tried restarting?',
        reply: 'Twice. Same thing.',
        keywords: ['restart', 'reboot', 'turn it off'],
        quality: 'neutral',
      },
      {
        id: 'q_lazy',
        text: "Didn't you see the expiry reminders for the last two weeks?",
        reply: "I'm on the road all the time, I don't have time to read every pop-up. Can we just fix it?",
        keywords: ['reminder', 'warning', 'notice', 'ignore'],
        quality: 'bad',
      },
    ],
    signInLog: {
      lines: [
        'Today 08:55  FAILURE   VPN gateway             Password expired',
        'Today 09:02  FAILURE   VPN gateway             Password expired',
        'Today 09:03  FAILURE   Web sign-in             Password expired (change required)',
      ],
      reveals: ['expired', 'vpn_rejects'],
    },
    toolReveals: { directory: ['expired'] },
    actionResults: {
      reset_password: {
        result:
          'Temporary password sent by SMS to the verified mobile on file. Marcus signed in to the VPN with it, set a new password, then locked and unlocked Windows so the laptop picked up the new password.',
        accountUpdate: { passwordExpired: false, passwordLastSet: 'Just now' },
      },
      deploy_vpn: {
        result: 'Deployment queued, but the device is off-network and the VPN client is already current (5.1.3).',
      },
    },
    requiredActions: ['reset_password'],
    helpfulActions: [],
    harmfulActions: ['reimage', 'grant_admin'],
    rootCauses: [
      { id: 'expired_offsite', label: 'Password expired while off the corporate network' },
      { id: 'vpn_corrupt', label: 'Corrupted VPN client' },
      { id: 'disabled', label: 'Account disabled by HR' },
      { id: 'isp', label: 'Home internet outage' },
    ],
    correctRootCause: 'expired_offsite',
    correctOutcome: 'resolve',
    noteKeywords: ['expired', 'reset', 'vpn', 'temporary', 'remote', 'verified'],
    replyKeywords: ['vpn', 'password', 'lock'],
    kb: ['kb-password-remote', 'kb-identity'],
    solution: [
      'Verify identity (employee ID plus callback to the number on file).',
      'Confirm the password is expired and the user is off-network.',
      'Reset the password and deliver it via the verified channel.',
      'Have the user connect to the VPN with the new password, then lock and unlock Windows to sync cached credentials.',
    ],
    debrief:
      "A laptop can't change an expired domain password without line of sight to a domain controller, and the VPN won't accept an expired password: a chicken-and-egg problem. A verified reset plus a VPN connect and lock/unlock syncs everything. Expired passwords on remote users are common before deadlines, so stay calm and quick.",
  }),

  scenario({
    id: 'acc-group-access',
    title: "New starter can't open the Finance Reports drive",
    category: 'Accounts',
    difficulty: 2,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 6,
    requester: person('Aisha Kamara', 'Junior Financial Analyst', 'Finance', 'HQ, Floor 2'),
    description:
      'Hi IT, I started on Monday. My manager told me to save reports to the Finance Reports drive (F:) but when I open it I get "Access is denied". The approval email from my manager is attached. Thanks!',
    account: account('aisha.kamara', {
      passwordLastSet: '4 days ago',
      groups: ['All Staff', 'Finance - Read', 'VPN Users'],
    }),
    device: device('HPL-LT-3410'),
    identity: { verifiable: true, reply: 'My employee ID is 61125 and my manager is Grace Lindqvist.' },
    facts: [
      { id: 'approval', label: 'Data owner (Grace Lindqvist) approved modify access' },
      { id: 'missing_group', label: 'User is not in FIN-Reports-RW' },
      { id: 'new_starter', label: 'User started this week' },
      { id: 'token', label: 'New group membership needs a fresh sign-in to apply' },
    ],
    keyFacts: ['approval', 'missing_group'],
    questions: [
      {
        id: 'q_approval',
        text: 'Do you have approval from your manager or the data owner?',
        reply: "Yes, it's attached. Grace Lindqvist approved modify access to Finance Reports yesterday.",
        keywords: ['approval', 'approve', 'permission', 'manager', 'owner'],
        reveals: ['approval'],
      },
      {
        id: 'q_others',
        text: 'Can your teammates open the drive?',
        reply: 'Yes, everyone else on the team uses it every day.',
        keywords: ['others', 'colleagues', 'teammates', 'anyone else'],
      },
      {
        id: 'q_path',
        text: "What's the exact path and the error?",
        reply: '\\\\fs01\\finance-reports, and it says "You do not have permission to access this folder".',
        keywords: ['path', 'error', 'exact', 'message'],
      },
      {
        id: 'q_start',
        text: 'When did you start with the company?',
        reply: 'Monday this week!',
        keywords: ['start', 'new', 'joined', 'first day'],
        reveals: ['new_starter'],
      },
      {
        id: 'q_admin',
        text: 'Want me to give you admin rights so you can fix it yourself next time?',
        reply: "Um... I don't think I'm supposed to have that?",
        keywords: ['admin', 'administrator', 'rights'],
        quality: 'bad',
      },
    ],
    terminal: {
      'whoami /groups': {
        output:
          'GROUP INFORMATION\n-----------------\nHPL\\All Staff\nHPL\\Finance - Read\nHPL\\VPN Users\nEveryone\nBUILTIN\\Users',
        reveals: ['missing_group'],
        whenDone: {
          action: 'guide_restart',
          output:
            'GROUP INFORMATION\n-----------------\nHPL\\All Staff\nHPL\\Finance - Read\nHPL\\FIN-Reports-RW\nHPL\\VPN Users\nEveryone\nBUILTIN\\Users',
        },
      },
      'net use': {
        output:
          'Status       Local     Remote                       Network\n-------------------------------------------------------------\nUnavailable  F:        \\\\fs01\\finance-reports       Microsoft Windows Network\nOK           H:        \\\\fs01\\home$\\aisha.kamara   Microsoft Windows Network\nThe command completed successfully.',
      },
    },
    toolReveals: { directory: ['missing_group'] },
    actionResults: {
      'grp+:FIN-Reports-RW': {
        result:
          'Added aisha.kamara to FIN-Reports-RW (approval reference attached). Her current sign-in token will not include the new group until she signs out and back in.',
        reveals: ['token'],
      },
      guide_restart: {
        result: 'Aisha signed out and back in. The F: drive opens and she saved a test file.',
      },
    },
    requiredActions: ['grp+:FIN-Reports-RW', 'guide_restart'],
    helpfulActions: [],
    harmfulActions: ['grant_admin', 'reimage'],
    rootCauses: [
      { id: 'missing_group', label: 'Not a member of the FIN-Reports-RW security group' },
      { id: 'server_down', label: 'File server offline' },
      { id: 'mapping', label: 'Drive mapped to the wrong path' },
      { id: 'disabled', label: 'Account partially disabled' },
    ],
    correctRootCause: 'missing_group',
    correctOutcome: 'resolve',
    noteKeywords: ['FIN-Reports-RW', 'approval', 'group', 'added', 'sign out'],
    replyKeywords: ['access', 'sign out', 'drive'],
    kb: ['kb-access-requests'],
    solution: [
      'Confirm a valid approval from the data owner exists.',
      'Check group membership (Directory or whoami /groups).',
      'Add the user to FIN-Reports-RW, referencing the approval.',
      'Have the user sign out and back in to refresh the token.',
      'Confirm access and close with the approval reference in the notes.',
    ],
    debrief:
      'Access requests are a core tier-1 task. Never grant access without approval from the data owner, always reference that approval in the ticket, and remember that group changes only apply after a new sign-in. Giving admin rights "to save time" is a classic policy violation.',
  }),

  scenario({
    id: 'acc-mfa-new-phone',
    title: 'New phone, authenticator approvals are gone',
    category: 'Accounts',
    difficulty: 1,
    priority: 'P2',
    channel: 'chat',
    targetMinutes: 5,
    requester: person('Hannah Brooks', 'HR Business Partner', 'People & Culture', 'HQ, Floor 4'),
    description:
      "I upgraded my phone over the weekend and now I can't approve sign-ins. The old phone was traded in. I'm stuck on the \"Approve sign-in request\" screen and can't get into anything.",
    account: account('hannah.brooks', {
      mfa: 'Enrolled: 1 method (Authenticator app on old phone, last used 9 days ago)',
    }),
    device: device('HPL-LT-2766'),
    identity: { verifiable: true, reply: 'Employee 33902. My manager is Luis Fernández.' },
    facts: [
      { id: 'new_phone', label: 'Authenticator app installed on new phone but has no accounts' },
      { id: 'old_gone', label: 'Old phone was traded in (wiped)' },
      { id: 'no_backup', label: 'No backup MFA method registered' },
      { id: 'single_method', label: 'Only MFA method is tied to the old device' },
    ],
    keyFacts: ['old_gone', 'no_backup', 'single_method'],
    questions: [
      {
        id: 'q_old',
        text: 'Do you still have the old phone?',
        reply: 'No, I traded it in at the store on Saturday. It was wiped.',
        keywords: ['old phone', 'still have', 'previous'],
        reveals: ['old_gone'],
      },
      {
        id: 'q_backup',
        text: 'Did you ever set up a backup method, like SMS or a security key?',
        reply: "I don't think so. Just the app.",
        keywords: ['backup', 'sms', 'text', 'key', 'alternative'],
        reveals: ['no_backup'],
      },
      {
        id: 'q_new',
        text: 'Have you installed the authenticator app on the new phone?',
        reply: "Yes, I downloaded it, but it's empty: no accounts in it.",
        keywords: ['installed', 'new phone', 'app', 'download'],
        reveals: ['new_phone'],
      },
      {
        id: 'q_restore',
        text: 'Did you try restoring the app from a cloud backup?',
        reply: 'I tried, it said no backup was found.',
        keywords: ['restore', 'cloud', 'recover'],
        quality: 'neutral',
      },
    ],
    toolReveals: { directory: ['single_method'] },
    actionResults: {
      reset_mfa: {
        result:
          'MFA methods cleared for hannah.brooks. A one-hour Temporary Access Pass was sent to her verified phone number.',
        accountUpdate: { mfa: 'Pending re-registration' },
      },
      guide_mfa_enroll: {
        result:
          'Hannah signed in with the Temporary Access Pass, scanned the QR code with her new phone, and approved a test sign-in. At your suggestion she also added SMS as a backup method.',
        accountUpdate: { mfa: 'Enrolled: 2 methods (Authenticator app, SMS)' },
      },
    },
    requiredActions: ['reset_mfa', 'guide_mfa_enroll'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'mfa_device', label: 'MFA only registered on a device that no longer exists' },
      { id: 'expired', label: 'Expired password' },
      { id: 'locked', label: 'Account locked out' },
      { id: 'outage', label: 'Authenticator service outage' },
    ],
    correctRootCause: 'mfa_device',
    correctOutcome: 'resolve',
    noteKeywords: ['mfa', 'reset', 'new phone', 'backup', 'enroll', 'verified'],
    replyKeywords: ['backup', 'phone', 'sign'],
    kb: ['kb-mfa', 'kb-identity'],
    solution: [
      'Verify identity first: an MFA reset is a high-risk change.',
      'Confirm the old device is gone and no backup method exists.',
      'Reset MFA registration and issue a Temporary Access Pass to the verified number.',
      'Guide enrollment on the new phone and recommend a backup method.',
    ],
    debrief:
      'MFA resets are one of the most abused help desk processes. Attackers love them. Strong verification is mandatory. Once verified, the fix is quick: clear methods, re-enroll, and add a backup method so it never happens again.',
  }),

  scenario({
    id: 'acc-disabled-return',
    title: 'Back from leave and my account is disabled',
    category: 'Accounts',
    difficulty: 2,
    priority: 'P3',
    channel: 'phone',
    targetMinutes: 6,
    requester: person('Inês Duarte', 'Quality Inspector', 'Operations', 'Warehouse B'),
    description:
      'I came back today from four months of parental leave and when I log in it says "Your account has been disabled. See your system administrator." My manager said HR should have sorted everything.',
    account: account('ines.duarte', {
      status: 'Disabled',
      statusNote: 'Disabled automatically: inactivity policy (no sign-in for 90+ days)',
      passwordExpired: true,
      passwordLastSet: '142 days ago',
      lastLogon: '127 days ago',
      activeSessions: 0,
    }),
    device: device('HPL-DT-0592', { model: 'Standard Desktop D7', uptime: '11 minutes' }),
    identity: { verifiable: true, reply: 'My employee number is 22841 and my manager is Kofi Mensah.' },
    facts: [
      { id: 'on_leave', label: 'User was on leave for four months' },
      { id: 'inactivity', label: 'Account auto-disabled by the 90-day inactivity policy' },
      { id: 'hr_return', label: 'HR confirmed return-to-work today' },
      { id: 'pw_expired', label: 'Password also expired during leave' },
    ],
    keyFacts: ['inactivity', 'hr_return', 'pw_expired'],
    questions: [
      {
        id: 'q_leave',
        text: 'How long have you been away?',
        reply: 'Four months, parental leave.',
        keywords: ['leave', 'away', 'how long', 'absence'],
        reveals: ['on_leave'],
      },
      {
        id: 'q_hr',
        text: 'Has HR or your manager confirmed your return to work?',
        reply: 'Yes, Kofi emailed HR last week and HR confirmed this morning that I am back on the system as active.',
        keywords: ['hr', 'return', 'confirmed', 'manager', 'notice'],
        reveals: ['hr_return'],
      },
      {
        id: 'q_error',
        text: 'What exactly does the message say?',
        reply: '"Your account has been disabled. Please see your system administrator."',
        keywords: ['error', 'message', 'say', 'exactly'],
      },
      {
        id: 'q_bad',
        text: 'Are you sure you still work here?',
        reply: "Excuse me? Yes. I've just come back from having a baby.",
        keywords: ['still work', 'fired', 'terminated'],
        quality: 'bad',
      },
    ],
    toolReveals: { directory: ['inactivity', 'pw_expired'] },
    actionResults: {
      enable_account: {
        result: 'Account enabled. Note: the password is still expired, so the user must set a new one before signing in.',
        accountUpdate: { status: 'Active', statusNote: undefined },
      },
      reset_password: {
        result: 'Temporary password issued through the verified channel. Inês signed in and set a new password.',
        accountUpdate: { passwordExpired: false, passwordLastSet: 'Just now' },
      },
    },
    requiredActions: ['enable_account', 'reset_password'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'inactivity', label: 'Auto-disabled by the inactivity policy while on leave' },
      { id: 'terminated', label: 'Account terminated by HR' },
      { id: 'locked', label: 'Too many failed sign-ins' },
      { id: 'compromised', label: 'Account disabled due to compromise' },
    ],
    correctRootCause: 'inactivity',
    correctOutcome: 'resolve',
    noteKeywords: ['disabled', 'inactivity', 'hr', 'enabled', 'password', 'leave'],
    replyKeywords: ['welcome', 'password', 'enabled'],
    kb: ['kb-identity', 'kb-lockouts'],
    solution: [
      'Verify identity.',
      'Check why the account is disabled: the inactivity policy, not a termination.',
      'Confirm HR return-to-work before re-enabling.',
      'Enable the account and reset the expired password.',
      'Welcome them back and confirm they can sign in.',
    ],
    debrief:
      'Inactivity policies protect dormant accounts, but they routinely catch people returning from leave. Check why an account was disabled: re-enabling a terminated account would be a serious mistake. Confirm the HR return and fix both problems (disabled and expired) in one go.',
  }),
];
