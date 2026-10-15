import type { Scenario } from '../../types';
import { account, device, person, scenario } from './base';

export const softwareScenarios: Scenario[] = [
  scenario({
    id: 'sw-teams-camera',
    title: 'Camera not working in Teams, interviews this afternoon',
    category: 'Software',
    difficulty: 1,
    priority: 'P2',
    channel: 'chat',
    targetMinutes: 5,
    requester: person('Fatima Al-Sayed', 'Talent Acquisition Partner', 'People & Culture', 'HQ, Floor 4'),
    description:
      "My camera doesn't work in Teams. It says \"We can't find a camera\". I have candidate interviews all afternoon! The camera light doesn't turn on at all.",
    account: account('fatima.alsayed'),
    device: device('HPL-LT-2904', { lastPatch: 'Yesterday (feature update)' }),
    facts: [
      { id: 'built_in', label: 'Using the built-in laptop camera' },
      { id: 'all_apps', label: 'The Windows Camera app also fails' },
      { id: 'feature_update', label: 'A Windows feature update installed yesterday' },
      { id: 'shutter_open', label: 'Physical privacy shutter is open' },
      { id: 'privacy_off', label: 'Camera access is turned off in Windows privacy settings' },
    ],
    keyFacts: ['all_apps', 'feature_update', 'privacy_off'],
    questions: [
      {
        id: 'q_builtin',
        text: 'Is it the built-in camera or a USB one?',
        reply: 'The built-in one, above the screen.',
        keywords: ['built-in', 'usb', 'external', 'webcam', 'which camera'],
        reveals: ['built_in'],
      },
      {
        id: 'q_camera_app',
        text: 'Does the camera work in the Windows Camera app?',
        reply: 'Let me look... no. It says something about camera access being turned off?',
        keywords: ['camera app', 'other app', 'windows camera', 'outside teams'],
        reveals: ['all_apps'],
      },
      {
        id: 'q_shutter',
        text: 'Is there a privacy shutter or slider over the lens?',
        reply: "There's a little slider, and it's open. I checked that first!",
        keywords: ['shutter', 'slider', 'cover', 'lens'],
        reveals: ['shutter_open'],
      },
      {
        id: 'q_updates',
        text: 'Has the laptop installed any updates recently?',
        reply: 'Yes, a big one yesterday. It took ages.',
        keywords: ['update', 'updates', 'patch', 'upgrade'],
        reveals: ['feature_update'],
      },
      {
        id: 'q_phone',
        text: 'Can you just do the interviews on your phone?',
        reply: "I'd really rather not. I share my screen with candidates.",
        keywords: ['phone instead', 'use your phone'],
        quality: 'bad',
      },
    ],
    actionResults: {
      guide_camera_privacy: {
        result:
          'Fatima found "Camera access" switched Off after the update. She turned it on, along with "Let desktop apps access your camera". Teams now shows her video.',
        reveals: ['privacy_off'],
      },
      clear_teams_cache: { result: 'Teams cache cleared. Teams restarted, and it still reports no camera found.' },
      remote_restart: { result: 'The laptop restarted. Teams still reports no camera found.' },
    },
    requiredActions: ['guide_camera_privacy'],
    helpfulActions: ['guide_restart'],
    harmfulActions: ['reimage', 'grant_admin'],
    rootCauses: [
      { id: 'privacy', label: 'Windows camera privacy setting disabled' },
      { id: 'driver', label: 'Camera driver missing' },
      { id: 'hardware', label: 'Camera hardware failure' },
      { id: 'teams', label: 'Corrupted Teams cache' },
    ],
    correctRootCause: 'privacy',
    correctOutcome: 'resolve',
    noteKeywords: ['camera', 'privacy', 'setting', 'update', 'teams'],
    replyKeywords: ['camera', 'settings', 'interview'],
    kb: ['kb-camera'],
    solution: [
      'Test outside Teams: the Camera app also fails, so this is OS-level, not Teams.',
      'Check the simple physical things (shutter).',
      'Connect it to the feature update and check the privacy settings.',
      'Enable camera access for apps and desktop apps, then test in Teams.',
    ],
    debrief:
      'Testing in a second app tells you whether the problem is the application or the system. Feature updates sometimes reset privacy toggles. It is a 30-second fix when you know where to look, so don\'t jump to cache clears and reinstalls.',
  }),

  scenario({
    id: 'sw-excel-addin',
    title: 'Excel crashes on every workbook',
    category: 'Software',
    difficulty: 3,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 8,
    requester: person('Noah Fischer', 'Financial Analyst', 'Finance', 'HQ, Floor 2'),
    description:
      'Excel crashes ("Microsoft Excel has stopped working") every time I open a file. Started this morning. I really need it for the Q4 forecast.',
    account: account('noah.fischer'),
    device: device('HPL-LT-2205'),
    facts: [
      { id: 'all_files', label: 'Crashes with any workbook, even a new blank one' },
      { id: 'safe_ok', label: 'Excel works fine in safe mode' },
      { id: 'addin', label: 'User installed a "QuickCharts Pro" add-in yesterday' },
      { id: 'others_ok', label: "Colleagues' Excel works normally" },
      { id: 'faulting_dll', label: 'Event log names quickcharts.dll as the faulting module' },
    ],
    keyFacts: ['all_files', 'safe_ok', 'addin', 'faulting_dll'],
    questions: [
      {
        id: 'q_any',
        text: 'Does it crash with every file, including a brand-new blank workbook?',
        reply: 'Yes, even a blank one. It opens, freezes for a second, then crashes.',
        keywords: ['every file', 'any file', 'blank', 'new workbook', 'all files'],
        reveals: ['all_files'],
      },
      {
        id: 'q_new_software',
        text: 'Did you install anything new recently?',
        reply: 'Just a charting add-in, QuickCharts Pro, yesterday. Someone recommended it in a webinar.',
        keywords: ['install', 'installed', 'new software', 'add-in', 'addin', 'plugin'],
        reveals: ['addin'],
      },
      {
        id: 'q_others',
        text: 'Is Excel working for your colleagues?',
        reply: 'Yes, nobody else has this problem.',
        keywords: ['others', 'colleagues', 'anyone else'],
        reveals: ['others_ok'],
      },
      {
        id: 'q_restart',
        text: 'Have you restarted your computer?',
        reply: 'Yes, first thing I tried.',
        keywords: ['restart', 'reboot'],
        quality: 'neutral',
      },
      {
        id: 'q_google',
        text: "Did you try Googling it?",
        reply: "Isn't that... your job?",
        keywords: ['google', 'search online'],
        quality: 'bad',
      },
    ],
    terminal: {
      'get-eventlog application -newest 5': {
        output:
          'Index Time          EntryType   Source                 Message\n----- ----          ---------   ------                 -------\n88211 Oct 15 09:02  Error       Application Error      Faulting application EXCEL.EXE, faulting module quickcharts.dll 2.0.1\n88209 Oct 15 08:57  Error       Application Error      Faulting application EXCEL.EXE, faulting module quickcharts.dll 2.0.1\n88207 Oct 15 08:51  Error       Application Error      Faulting application EXCEL.EXE, faulting module quickcharts.dll 2.0.1\n88190 Oct 15 08:12  Information Office Software Prot.  License check succeeded\n88172 Oct 14 16:40  Information MsiInstaller           Product: QuickCharts Pro -- Installation completed successfully.',
        reveals: ['faulting_dll', 'addin'],
      },
    },
    actionResults: {
      guide_safe_mode: {
        result: 'Holding Ctrl, Noah opened Excel and confirmed Safe Mode. It opens workbooks without crashing.',
        reveals: ['safe_ok'],
      },
      disable_addin: {
        result: 'Disabled the "QuickCharts Pro" COM add-in for Noah. He relaunched Excel normally, with no crash.',
        reveals: ['addin'],
      },
      repair_office: {
        result: 'Office repair ran for 35 minutes. Excel still crashes, because the add-in loads again at startup.',
      },
    },
    requiredActions: ['disable_addin'],
    helpfulActions: ['guide_safe_mode'],
    harmfulActions: ['reimage', 'grant_admin'],
    rootCauses: [
      { id: 'addin', label: 'Faulty third-party COM add-in' },
      { id: 'office', label: 'Corrupted Office installation' },
      { id: 'file', label: 'Corrupted workbook' },
      { id: 'memory', label: 'Insufficient memory' },
    ],
    correctRootCause: 'addin',
    correctOutcome: 'resolve',
    noteKeywords: ['add-in', 'quickcharts', 'safe mode', 'disabled', 'event log', 'unapproved'],
    replyKeywords: ['add-in', 'excel', 'approved'],
    kb: ['kb-office-crash', 'kb-software-requests'],
    solution: [
      'Crashes with blank workbooks rule out a bad file.',
      'Safe mode works, so something that loads at startup (an add-in) is the suspect.',
      'Confirm with the event log: quickcharts.dll is the faulting module.',
      'Disable the add-in, confirm Excel works, and flag the unapproved software.',
    ],
    debrief:
      'Safe mode starts Office without add-ins. If it works there, an add-in is to blame. The application event log usually names the exact faulting module. An Office repair would waste half an hour and not fix it. Also remind the user that software from webinars must go through the approved request process.',
  }),

  scenario({
    id: 'sw-install-request',
    title: 'Please give me admin rights to install a diagram tool',
    category: 'Software',
    difficulty: 1,
    priority: 'P4',
    channel: 'email',
    targetMinutes: 4,
    requester: person('Chloe Martin', 'Business Analyst', 'Digital', 'HQ, Floor 5'),
    description:
      "Hi! Can you give me admin rights so I can install a diagram tool? I'm mapping processes for the warehouse project and found a free one online. Thanks!",
    account: account('chloe.martin'),
    device: device('HPL-LT-5118'),
    facts: [
      { id: 'download_site', label: 'User wants "FreeFlowDiagram" from an unknown download site' },
      { id: 'need', label: 'Needs a tool for process flowcharts' },
      { id: 'approved_exists', label: 'An approved diagram tool is in Software Center' },
    ],
    keyFacts: ['need', 'approved_exists'],
    questions: [
      {
        id: 'q_which',
        text: 'Which tool do you want, and what do you need it for?',
        reply: "Anything for flowcharts really. I found \"FreeFlowDiagram\" on a download site.",
        keywords: ['which', 'what tool', 'need it for', 'purpose', 'what for'],
        reveals: ['need', 'download_site'],
      },
      {
        id: 'q_catalog',
        text: 'Have you checked Software Center for approved tools?',
        reply:
          "What's Software Center? ...Oh, found it in the Start menu. There's something called \"DiagramStudio (Approved)\" here!",
        keywords: ['software center', 'catalog', 'approved', 'self-service', 'portal'],
        reveals: ['approved_exists'],
      },
      {
        id: 'q_deadline',
        text: 'When do you need it by?',
        reply: 'Ideally today, I have a workshop tomorrow morning.',
        keywords: ['when', 'deadline', 'by'],
      },
      {
        id: 'q_sure',
        text: "Sure, what's your username so I can make you an admin?",
        reply: "It's chloe.martin, thank you so much!",
        keywords: ['make you admin', 'username'],
        quality: 'bad',
      },
    ],
    actionResults: {
      guide_software_center: {
        result: 'Chloe installed DiagramStudio from Software Center in two minutes, with no admin rights needed. She is already drawing her first process map.',
        reveals: ['approved_exists'],
      },
      grant_admin: {
        result: 'Chloe now has local admin and has started installing "FreeFlowDiagram" from an unverified download site, which bundles adware.',
      },
    },
    requiredActions: ['guide_software_center'],
    helpfulActions: [],
    harmfulActions: ['grant_admin'],
    rootCauses: [
      { id: 'self_service', label: 'An approved tool is available via self-service and the user did not know' },
      { id: 'license', label: 'Licence needs purchasing' },
      { id: 'blocked', label: 'Software is blocked by policy' },
      { id: 'rights', label: 'User is missing admin rights' },
    ],
    correctRootCause: 'self_service',
    correctOutcome: 'resolve',
    noteKeywords: ['software center', 'approved', 'diagramstudio', 'admin', 'declined'],
    replyKeywords: ['software center', 'approved', 'admin'],
    kb: ['kb-software-requests'],
    solution: [
      'Find out what they actually need (a flowchart tool), not what they asked for (admin rights).',
      'Check whether an approved alternative already exists.',
      'Direct them to Software Center and decline admin rights politely, with the reason.',
    ],
    debrief:
      "Users often ask for a solution (admin rights) instead of describing their need. Uncovering the real need lets you offer a safe, approved tool in minutes. Local admin for standard users is against policy for good reason: unverified downloads are a top malware source.",
  }),
];
