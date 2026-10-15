import type { Scenario } from '../../types';
import { account, device, person, scenario } from './base';

export const hardwareScenarios: Scenario[] = [
  scenario({
    id: 'hw-print-queue',
    title: "Printer says 'Printing' but nothing comes out",
    category: 'Hardware',
    difficulty: 1,
    priority: 'P4',
    channel: 'portal',
    targetMinutes: 5,
    requester: person('Grace Lindqvist', 'Finance Manager', 'Finance', 'HQ, Floor 2'),
    description:
      "I sent a 40-page report to the Floor 2 printer an hour ago. My PC says it's printing but nothing came out. Now none of my other documents print either. Other people can print fine.",
    account: account('grace.lindqvist'),
    device: device('HPL-LT-2010'),
    facts: [
      { id: 'others_ok', label: 'Other users can print to the same printer' },
      { id: 'printer_ready', label: 'Printer shows Ready, with no jams or errors' },
      { id: 'stuck_job', label: 'A large job is stuck in "Error - Printing" at the top of the queue' },
      { id: 'jobs_behind', label: 'Three more jobs are waiting behind it' },
    ],
    keyFacts: ['others_ok', 'printer_ready', 'stuck_job'],
    questions: [
      {
        id: 'q_others',
        text: 'Can other people print to that printer?',
        reply: 'Yes, Noah just printed something.',
        keywords: ['others', 'anyone else', 'colleagues'],
        reveals: ['others_ok'],
      },
      {
        id: 'q_display',
        text: 'Does the printer display show any error or paper jam?',
        reply: 'No, it just says "Ready".',
        keywords: ['display', 'screen', 'error', 'jam', 'paper'],
        reveals: ['printer_ready'],
      },
      {
        id: 'q_queue',
        text: 'If you open your print queue, what do you see?',
        reply: 'The 40-page one is at the top and says "Error - Printing". Three more of mine are underneath it.',
        keywords: ['queue', 'jobs', 'pending', 'see'],
        reveals: ['stuck_job', 'jobs_behind'],
      },
      {
        id: 'q_hit',
        text: 'Have you tried giving the printer a good whack?',
        reply: "I'm going to pretend you didn't say that.",
        keywords: ['hit', 'whack', 'kick'],
        quality: 'bad',
      },
    ],
    terminal: {
      'get-printjob': {
        output:
          'Id  PrinterName  DocumentName               JobStatus        Pages\n--  -----------  ------------               ---------        -----\n14  FL2-MFP      Q3 Board Report.pdf        Error, Printing  40\n15  FL2-MFP      Invoice-2291.docx          Normal           2\n16  FL2-MFP      Supplier list.xlsx         Normal           1\n17  FL2-MFP      Memo.docx                  Normal           1',
        reveals: ['stuck_job', 'jobs_behind'],
        whenDone: { action: 'clear_print_queue', output: '(no print jobs)' },
      },
    },
    actionResults: {
      restart_spooler: { result: 'Print Spooler restarted. The stuck job is still in the queue.' },
      clear_print_queue: {
        result:
          'Queue cleared (4 jobs removed). Grace re-sent the documents and they printed straight away. She split the board report into two smaller files.',
      },
    },
    requiredActions: ['clear_print_queue'],
    helpfulActions: ['restart_spooler'],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'stuck_job', label: 'A stuck job blocking the local print queue' },
      { id: 'offline', label: 'Printer is offline' },
      { id: 'toner', label: 'Out of toner' },
      { id: 'driver', label: 'Printer driver missing' },
    ],
    correctRootCause: 'stuck_job',
    correctOutcome: 'resolve',
    noteKeywords: ['queue', 'stuck', 'spooler', 'cleared', 'resent', 'fl2'],
    replyKeywords: ['queue', 'print', 'resend'],
    kb: ['kb-printing'],
    solution: [
      'Scope it: others print fine and the printer is Ready, so the problem is local to this PC.',
      'Check the queue: the large job is stuck in "Error - Printing".',
      'Clear the queue (restarting the spooler helps if jobs refuse to delete).',
      'Ask the user to resend and confirm the prints come out.',
    ],
    debrief:
      "If everyone else can print, the printer isn't the problem. One corrupted or oversized job can block everything behind it in that user's queue. Clear it, have them resend, and suggest splitting very large PDFs.",
  }),

  scenario({
    id: 'hw-power-adapter',
    title: "Laptop is dead and won't turn on",
    category: 'Hardware',
    difficulty: 2,
    priority: 'P2',
    channel: 'phone',
    targetMinutes: 6,
    requester: person('Liam O\u2019Connell', 'Account Manager', 'Sales', 'Leeds branch office'),
    description:
      'My laptop was at 15% when I left yesterday. This morning, nothing. The power button does nothing, no lights at all. It is plugged in.',
    account: account('liam.oconnell'),
    device: device('HPL-LT-4419', { online: false, ip: '', gateway: '', dns: '', uptime: 'Offline since yesterday 17:52' }),
    facts: [
      { id: 'no_led', label: 'Power adapter LED is off' },
      { id: 'other_outlet', label: 'A different wall outlet makes no difference' },
      { id: 'frayed', label: 'Adapter cable is frayed near the brick' },
      { id: 'spare_works', label: "A colleague's identical adapter charges the laptop" },
      { id: 'branch', label: 'User is at a branch with no on-site IT' },
    ],
    keyFacts: ['no_led', 'frayed', 'spare_works'],
    questions: [
      {
        id: 'q_led',
        text: 'Is there a light on the power adapter or near the charging port?',
        reply: "There's normally a little white light on the brick... it's off.",
        keywords: ['light', 'led', 'adapter', 'charger', 'brick'],
        reveals: ['no_led'],
      },
      {
        id: 'q_spare',
        text: 'Does anyone nearby have the same charger you could try?',
        reply: "Sophie has the same laptop... OK, plugged hers in. The light is on, and the battery icon says it's charging!",
        keywords: ['spare', 'borrow', 'another charger', 'colleague', 'same charger'],
        reveals: ['spare_works'],
      },
      {
        id: 'q_where',
        text: 'Which office are you working from?',
        reply: "Leeds. There's no IT person here, it's just us sales folks.",
        keywords: ['office', 'where', 'location', 'branch'],
        reveals: ['branch'],
      },
      {
        id: 'q_drop',
        text: 'Has the laptop been dropped or had anything spilled on it?',
        reply: 'No, it lives in my bag and on my desk.',
        keywords: ['drop', 'dropped', 'spill', 'damage'],
        quality: 'neutral',
      },
      {
        id: 'q_careless',
        text: 'Did you forget to charge it?',
        reply: 'It was PLUGGED IN all night. That is literally the problem.',
        keywords: ['forget', 'forgot'],
        quality: 'bad',
      },
    ],
    actionResults: {
      guide_check_power: {
        result:
          'Liam tried two different outlets and the adapter LED stays off. He notices the cable is frayed where it enters the brick.',
        reveals: ['other_outlet', 'frayed', 'no_led'],
      },
      remote_restart: { result: 'Command failed: the device is powered off and unreachable.' },
    },
    requiredActions: ['guide_check_power'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'adapter', label: 'Failed / damaged power adapter' },
      { id: 'board', label: 'Motherboard failure' },
      { id: 'battery', label: 'Worn-out battery' },
      { id: 'bios', label: 'Corrupted BIOS' },
    ],
    correctRootCause: 'adapter',
    correctOutcome: 'escalate',
    escalateTo: 'Field Services',
    noteKeywords: ['adapter', 'frayed', 'led', 'replacement', 'borrow', 'leeds'],
    replyKeywords: ['adapter', 'replacement', 'safe'],
    kb: ['kb-hardware-replacement'],
    solution: [
      'Check the basics: adapter LED, a different outlet.',
      'Spot the frayed cable, a safety issue. Tell the user to stop using it.',
      'Prove it with a known-good adapter: the laptop charges.',
      'Escalate to Field Services to ship a replacement adapter to the branch.',
    ],
    debrief:
      'A "dead" laptop is very often a dead power adapter. Swapping in a known-good part is the fastest diagnosis. A frayed cable is also a safety hazard: tell the user to stop using it, and get a replacement sent through Field Services.',
  }),

  scenario({
    id: 'hw-dock-monitor',
    title: 'Second monitor not detected on the dock',
    category: 'Hardware',
    difficulty: 2,
    priority: 'P4',
    channel: 'portal',
    targetMinutes: 6,
    requester: person('Mei Tanaka', 'UX Designer', 'Digital', 'HQ, Floor 5'),
    description:
      'My second monitor shows "No signal" since Monday. The first monitor on the dock works. I already swapped the two monitors around, and whichever one is plugged into the dock\'s second DisplayPort shows no signal.',
    account: account('mei.tanaka'),
    device: device('HPL-LT-5032', {
      installedNotes: [
        'Endpoint protection: healthy',
        'VPN Client 5.1.3',
        'Dock: USB-C Dock D3, firmware 1.0.4 (approved: 1.2.1)',
        'Display driver updated 3 days ago',
      ],
    }),
    facts: [
      { id: 'port_specific', label: 'The problem follows the dock\'s second DisplayPort, not the monitor' },
      { id: 'after_update', label: 'Display driver updated over the weekend' },
      { id: 'dock_old', label: 'Dock firmware 1.0.4 is behind the approved 1.2.1' },
      { id: 'cable_ok', label: 'Cable tested good on the other port' },
    ],
    keyFacts: ['port_specific', 'dock_old', 'after_update'],
    questions: [
      {
        id: 'q_swap',
        text: 'When you swapped things around, did the problem follow the monitor or the port?',
        reply: 'The port. Whatever is plugged into DisplayPort 2 on the dock gets no signal.',
        keywords: ['swap', 'follow', 'port', 'monitor'],
        reveals: ['port_specific'],
      },
      {
        id: 'q_cable',
        text: 'Have you tried the cable on the working port?',
        reply: 'Yes, the same cable works on port 1.',
        keywords: ['cable', 'different cable'],
        reveals: ['cable_ok'],
      },
      {
        id: 'q_updates',
        text: 'Did your laptop install any updates or restart recently?',
        reply: 'Yes, it installed a bunch of updates on Sunday night and restarted.',
        keywords: ['update', 'updates', 'patch', 'restart'],
        reveals: ['after_update'],
      },
      {
        id: 'q_ugly',
        text: "Do you really need two monitors?",
        reply: "I'm a designer. Yes. Very much yes.",
        keywords: ['really need', 'two monitors'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['dock_old', 'after_update'] },
    actionResults: {
      update_dock: {
        result:
          'Dock firmware updated to 1.2.1 and the matching driver installed. After the dock power-cycled, both monitors lit up.',
        deviceUpdate: {
          installedNotes: [
            'Endpoint protection: healthy',
            'VPN Client 5.1.3',
            'Dock: USB-C Dock D3, firmware 1.2.1 (approved)',
            'Display driver updated 3 days ago',
          ],
        },
      },
      guide_reseat_cable: { result: 'Mei reseated the cables. Monitor 2 still shows "No signal".' },
      guide_restart: { result: 'Mei restarted. Monitor 2 still shows "No signal".' },
    },
    requiredActions: ['update_dock'],
    helpfulActions: ['guide_reseat_cable', 'guide_restart'],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'dock_fw', label: 'Outdated dock firmware incompatible with the new display driver' },
      { id: 'monitor', label: 'Faulty monitor' },
      { id: 'cable', label: 'Faulty cable' },
      { id: 'gpu', label: 'Laptop graphics failure' },
    ],
    correctRootCause: 'dock_fw',
    correctOutcome: 'resolve',
    noteKeywords: ['dock', 'firmware', '1.0.4', '1.2.1', 'displayport', 'driver'],
    replyKeywords: ['dock', 'monitor', 'update'],
    kb: ['kb-docks'],
    solution: [
      'Isolate: the fault follows the dock port, not the monitor or the cable.',
      'Check the endpoint: dock firmware is behind, and the display driver just updated.',
      'Deploy the approved dock firmware and driver bundle.',
      'Confirm both monitors work.',
    ],
    debrief:
      "Swapping components to see whether the fault follows the part or the port is the core troubleshooting technique. Docks have their own firmware, and a display driver update can expose old firmware bugs. Keep docks on the approved firmware.",
  }),

  scenario({
    id: 'hw-slow-disk',
    title: 'Laptop painfully slow, apps freezing',
    category: 'Hardware',
    difficulty: 1,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 5,
    requester: person('Rafael Moreno', 'Marketing Specialist', 'Marketing', 'HQ, Floor 4'),
    description:
      'My laptop has become incredibly slow this past week. Opening anything takes forever and Outlook said it couldn\'t save something. I edit a lot of campaign videos if that matters.',
    account: account('rafael.moreno'),
    device: device('HPL-LT-4180', { diskFree: '1.1 GB of 238 GB', uptime: '23 days' }),
    facts: [
      { id: 'disk_full', label: 'C: drive has only about 1 GB free' },
      { id: 'videos', label: 'Large video exports stored locally in Downloads' },
      { id: 'uptime', label: 'No restart in 23 days' },
      { id: 'temp', label: '14 GB of temp files and caches' },
    ],
    keyFacts: ['disk_full', 'videos'],
    questions: [
      {
        id: 'q_files',
        text: 'Do you keep large files on the laptop itself?',
        reply: 'Yeah, all my video exports go to Downloads. Probably 100 GB of them?',
        keywords: ['files', 'large', 'videos', 'storage', 'downloads'],
        reveals: ['videos'],
      },
      {
        id: 'q_restart',
        text: 'When did you last fully restart the laptop?',
        reply: 'Restart? I just close the lid at night.',
        keywords: ['restart', 'reboot', 'shut down', 'last'],
        reveals: ['uptime'],
      },
      {
        id: 'q_when',
        text: 'When did the slowness start?',
        reply: 'Maybe a week ago, after a big export for the autumn campaign.',
        keywords: ['when', 'start', 'since'],
      },
      {
        id: 'q_games',
        text: 'Are you downloading games or movies on your work laptop?',
        reply: 'No! These are work videos. For the campaigns. That I make.',
        keywords: ['games', 'movies', 'personal'],
        quality: 'bad',
      },
    ],
    toolReveals: { endpoint: ['disk_full', 'uptime'] },
    terminal: {
      'get-psdrive c': {
        output:
          'Name  Used (GB)  Free (GB)  Provider    Root\n----  ---------  ---------  --------    ----\nC        236.9        1.1  FileSystem  C:\\',
        reveals: ['disk_full'],
        whenDone: {
          action: 'disk_cleanup',
          output:
            'Name  Used (GB)  Free (GB)  Provider    Root\n----  ---------  ---------  --------    ----\nC        222.7       15.3  FileSystem  C:\\',
        },
      },
    },
    actionResults: {
      disk_cleanup: {
        result:
          'Disk cleanup freed 14.2 GB (temp files, update cache, recycle bin). Free space is now 15.3 GB and the laptop is noticeably faster.',
        reveals: ['temp'],
        deviceUpdate: { diskFree: '15.3 GB of 238 GB' },
      },
      reimage: {
        result: 'Reimage scheduled. All of Rafael\'s local videos, roughly 100 GB of unsynced campaign work, will be wiped.',
      },
    },
    requiredActions: ['disk_cleanup'],
    helpfulActions: ['guide_restart', 'remote_restart'],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'disk', label: 'System drive nearly full' },
      { id: 'malware', label: 'Malware infection' },
      { id: 'ram', label: 'Faulty RAM' },
      { id: 'cpu', label: 'Overheating CPU' },
    ],
    correctRootCause: 'disk',
    correctOutcome: 'resolve',
    noteKeywords: ['disk', 'space', 'cleanup', 'gb', 'videos', 'onedrive'],
    replyKeywords: ['space', 'videos', 'onedrive', 'restart'],
    kb: ['kb-slow-pc'],
    solution: [
      'Check the device health: 1 GB free on C:, uptime 23 days.',
      'Ask about large local files: 100 GB of video exports.',
      'Run disk cleanup to recover space right away.',
      'Advise moving videos to OneDrive / the shared media drive and restarting weekly.',
    ],
    debrief:
      'Windows needs free disk space for virtual memory, updates and temp files. Below a few GB, everything crawls and apps fail to save. Clean up first and educate second. Never reimage a device with unsynced user data.',
  }),
];
