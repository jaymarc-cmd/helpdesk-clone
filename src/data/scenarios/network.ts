import type { Scenario } from '../../types';
import { account, device, person, scenario } from './base';

export const networkScenarios: Scenario[] = [
  scenario({
    id: 'net-apipa',
    title: 'No internet at my desk since I moved',
    category: 'Network',
    difficulty: 1,
    priority: 'P3',
    channel: 'chat',
    targetMinutes: 5,
    requester: person('Owen Gallagher', 'Logistics Coordinator', 'Operations', 'HQ, Floor 3 (desk 3-114)'),
    description:
      "I moved desks this morning to the other side of the floor. Now my laptop says \"No internet\" with the little globe icon. My phone on Wi-Fi works fine.",
    account: account('owen.gallagher'),
    device: device('HPL-LT-3307', { ip: '169.254.88.21', gateway: '', dns: '', online: false }),
    facts: [
      { id: 'moved_desk', label: 'User moved desks and reconnected the dock themselves' },
      { id: 'apipa', label: 'Laptop has a 169.254.x.x self-assigned address (no DHCP reply)' },
      { id: 'wired', label: 'Laptop uses a wired connection through the dock; Wi-Fi is off' },
      { id: 'no_link', label: 'No link lights on the dock network port' },
    ],
    keyFacts: ['moved_desk', 'apipa', 'no_link'],
    questions: [
      {
        id: 'q_change',
        text: 'Did anything change recently with your setup?',
        reply: 'Yes, I moved desks this morning and plugged everything back into the dock myself.',
        keywords: ['change', 'changed', 'recently', 'moved', 'new'],
        reveals: ['moved_desk'],
      },
      {
        id: 'q_wired',
        text: 'Are you connected by cable or by Wi-Fi?',
        reply: "Cable, through the dock. Wi-Fi is turned off because we were told to use cables at our desks.",
        keywords: ['cable', 'wired', 'wifi', 'wi-fi', 'wireless', 'ethernet'],
        reveals: ['wired'],
      },
      {
        id: 'q_lights',
        text: 'Are there any lights next to the network port where the cable plugs in?',
        reply: 'On the dock? Hmm... no, there are no lights at all on that port.',
        keywords: ['light', 'lights', 'led', 'blinking', 'port'],
        reveals: ['no_link'],
      },
      {
        id: 'q_others',
        text: 'Is anyone near you having the same problem?',
        reply: 'No, everyone around me is working fine.',
        keywords: ['others', 'anyone else', 'colleagues', 'nearby'],
      },
      {
        id: 'q_break',
        text: 'Did you break something when you moved?',
        reply: "I don't think so? I was careful...",
        keywords: ['break', 'broke', 'damage'],
        quality: 'bad',
      },
    ],
    terminal: {
      ipconfig: { reveals: ['apipa'] },
      'ipconfig /all': { reveals: ['apipa'] },
    },
    actionResults: {
      guide_reseat_cable: {
        result:
          'Owen pushed the network cable firmly into the dock until it clicked. The port LEDs are now blinking green and the laptop picked up an address.',
        reveals: ['no_link'],
        deviceUpdate: { ip: '10.20.3.114', gateway: '10.20.3.1', dns: '10.20.0.10', online: true },
      },
      remote_restart: {
        result: 'Restart command could not be delivered: the device is not reachable from the management server.',
      },
      guide_restart: {
        result: 'Owen restarted the laptop. Still "No internet", and still a 169.254 address.',
      },
    },
    requiredActions: ['guide_reseat_cable'],
    helpfulActions: ['guide_restart'],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'cable', label: 'Network cable not seated in the dock (no link, so no DHCP)' },
      { id: 'dhcp', label: 'DHCP server outage' },
      { id: 'port', label: 'Wall port not patched to a switch' },
      { id: 'driver', label: 'Network driver corrupted' },
    ],
    correctRootCause: 'cable',
    correctOutcome: 'resolve',
    noteKeywords: ['169.254', 'apipa', 'cable', 'dock', 'dhcp', 'link'],
    replyKeywords: ['cable', 'dock', 'connected'],
    kb: ['kb-apipa'],
    solution: [
      'Ask what changed: the desk move is the big clue.',
      'Run ipconfig: a 169.254.x.x address means no DHCP reply.',
      'Check the physical layer first: link lights on the dock port.',
      'Reseat the cable, confirm a 10.x address and working internet.',
    ],
    debrief:
      'A 169.254.x.x (APIPA) address means the device never heard back from DHCP. With only one user affected right after a desk move, the physical layer (cable, dock, wall port) is the first suspect. Work bottom-up through the OSI model before blaming servers.',
  }),

  scenario({
    id: 'net-dns-intranet',
    title: "Timesheets site won't load, everything else does",
    category: 'Network',
    difficulty: 2,
    priority: 'P3',
    channel: 'portal',
    targetMinutes: 7,
    requester: person('Priya Nandakumar', 'Payroll Officer', 'Finance', 'HQ, Floor 2'),
    description:
      "Since this morning the Timesheets portal (timesheets.hpl.example) just spins and then says \"This site can't be reached\". Outlook, Teams and the web all work fine. My colleague next to me can open it.",
    account: account('priya.nandakumar'),
    device: device('HPL-LT-2088', { uptime: '9 days' }),
    facts: [
      { id: 'colleague_ok', label: 'The same site works for a colleague nearby' },
      { id: 'migrated', label: 'Timesheets moved to a new server last night' },
      { id: 'stale_cache', label: 'Laptop still resolves the old server IP (10.10.5.20) from cache' },
      { id: 'dns_correct', label: 'DNS server returns the new IP (10.10.8.45)' },
      { id: 'all_browsers', label: 'Fails in every browser' },
    ],
    keyFacts: ['migrated', 'stale_cache', 'dns_correct'],
    questions: [
      {
        id: 'q_others',
        text: 'Does the site work for anyone else?',
        reply: 'Yes, Jun next to me can open it right now.',
        keywords: ['others', 'anyone else', 'colleague', 'coworker'],
        reveals: ['colleague_ok'],
      },
      {
        id: 'q_browser',
        text: 'Does it fail in a different browser too?',
        reply: 'Yes, both Edge and Chrome do the same thing.',
        keywords: ['browser', 'chrome', 'edge', 'firefox'],
        reveals: ['all_browsers'],
      },
      {
        id: 'q_change',
        text: 'Have you seen any announcements about changes to Timesheets?',
        reply: 'There was an email saying Timesheets was moving to a new server last night. Is that related?',
        keywords: ['announcement', 'change', 'maintenance', 'moved', 'email'],
        reveals: ['migrated'],
      },
      {
        id: 'q_last',
        text: 'When did it last work for you?',
        reply: "Yesterday afternoon. I haven't restarted my laptop in ages, I just put it to sleep.",
        keywords: ['last', 'worked', 'yesterday', 'when'],
      },
      {
        id: 'q_typo',
        text: 'Are you sure you typed the address correctly?',
        reply: "It's a bookmark I've used for years.",
        keywords: ['typed', 'spelling', 'address', 'url'],
        quality: 'neutral',
      },
    ],
    servers: {
      'APP-TS02': { note: 'Timesheets moved here from the old server last night. New address 10.10.8.45.' },
    },
    toolReveals: { servers: ['migrated'] },
    terminal: {
      'ping timesheets.hpl.example': {
        output:
          'Pinging timesheets.hpl.example [10.10.5.20] with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for 10.10.5.20:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)',
        reveals: ['stale_cache'],
        whenDone: {
          action: 'flush_dns',
          output:
            'Pinging timesheets.hpl.example [10.10.8.45] with 32 bytes of data:\nReply from 10.10.8.45: bytes=32 time=2ms TTL=126\nReply from 10.10.8.45: bytes=32 time=1ms TTL=126\nReply from 10.10.8.45: bytes=32 time=1ms TTL=126\nReply from 10.10.8.45: bytes=32 time=2ms TTL=126',
        },
      },
      'nslookup timesheets.hpl.example': {
        output:
          'Server:  dns01.hpl.example\nAddress:  10.20.0.10\n\nName:    timesheets.hpl.example\nAddress:  10.10.8.45',
        reveals: ['dns_correct'],
      },
      'ipconfig /displaydns': {
        output:
          'Windows IP Configuration\n\n    timesheets.hpl.example\n    ----------------------------------------\n    Record Name . . . . . : timesheets.hpl.example\n    Record Type . . . . . : 1\n    Time To Live  . . . . : 61204\n    Data Length . . . . . : 4\n    Section . . . . . . . : Answer\n    A (Host) Record . . . : 10.10.5.20',
        reveals: ['stale_cache'],
        whenDone: { action: 'flush_dns', output: 'Windows IP Configuration\n\n    (cache is empty)' },
      },
    },
    actionResults: {
      flush_dns: {
        result: 'DNS cache flushed. timesheets.hpl.example now resolves to 10.10.8.45 and Priya can open the site.',
      },
      guide_restart: {
        result: 'Priya restarted the laptop (clearing the DNS cache). Timesheets loads normally now.',
      },
    },
    requiredActions: ['flush_dns|guide_restart'],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'stale_dns', label: 'Stale local DNS cache pointing at the old server' },
      { id: 'server_down', label: 'Timesheets server is down' },
      { id: 'proxy', label: 'Web proxy blocking the site' },
      { id: 'browser_cache', label: 'Corrupted browser cache' },
    ],
    correctRootCause: 'stale_dns',
    correctOutcome: 'resolve',
    noteKeywords: ['dns', 'cache', 'flush', 'migrat', '10.10.8.45', 'old ip'],
    replyKeywords: ['cache', 'timesheets', 'working'],
    kb: ['kb-dns'],
    solution: [
      'Scope it: one user, one site, and a colleague is fine, so it is local to this laptop.',
      'Compare ping (uses the local cache) with nslookup (asks the DNS server).',
      'Different IPs plus last night\'s migration point to a stale cache.',
      'Flush the DNS cache (or restart) and confirm the site loads.',
    ],
    debrief:
      "When a site moves servers, devices that cached the old IP keep going to the wrong place until the record's TTL expires. ping uses the local resolver cache, while nslookup queries the DNS server directly. Comparing them is a fast way to prove a stale cache.",
  }),

  scenario({
    id: 'net-vpn-cert',
    title: 'VPN fails with a certificate error',
    category: 'Network',
    difficulty: 2,
    priority: 'P2',
    channel: 'email',
    targetMinutes: 6,
    requester: person('Elena Vasquez', 'Senior Accountant', 'Finance', 'Remote (home office)'),
    description:
      "VPN stopped working today. Error: \"The server certificate could not be validated (0x800B0109)\". It worked on Friday. I need it for month-end close, please help ASAP!",
    account: account('elena.vasquez'),
    device: device('HPL-LT-1520', {
      ip: '192.168.0.23',
      gateway: '192.168.0.1',
      dns: '192.168.0.1',
      installedNotes: ['Endpoint protection: healthy', 'VPN Client 4.2.1 (minimum supported: 5.1)', '3 postponed updates'],
    }),
    facts: [
      { id: 'internet_ok', label: 'Home internet works otherwise' },
      { id: 'others_ok', label: 'Colleagues who updated their VPN client connect fine' },
      { id: 'cert_renewed', label: 'VPN gateway certificate was renewed over the weekend' },
      { id: 'old_client', label: 'VPN client 4.2.1 is below the minimum supported 5.1' },
      { id: 'postponed', label: 'User keeps postponing update prompts' },
    ],
    keyFacts: ['cert_renewed', 'old_client'],
    questions: [
      {
        id: 'q_internet',
        text: 'Is your internet working otherwise?',
        reply: 'Yes, websites and streaming work fine.',
        keywords: ['internet', 'online', 'websites', 'connection'],
        reveals: ['internet_ok'],
      },
      {
        id: 'q_others',
        text: 'Are your colleagues having the same problem?',
        reply: 'Mike said his laptop asked him to update something last week and he is fine. Mine never asked... I think.',
        keywords: ['others', 'colleagues', 'anyone else', 'team'],
        reveals: ['others_ok'],
      },
      {
        id: 'q_updates',
        text: 'Have you postponed any update prompts recently?',
        reply: 'I always click "later" on those pop-ups. They interrupt me in the middle of reconciliations.',
        keywords: ['update', 'updates', 'postpone', 'later', 'prompt'],
        reveals: ['postponed'],
      },
      {
        id: 'q_announce',
        text: 'Have you seen any IT announcements about the VPN?',
        reply: "There was something about \"certificate renewal this weekend\" but I didn't read it properly.",
        keywords: ['announcement', 'notice', 'email', 'certificate', 'maintenance'],
        reveals: ['cert_renewed'],
      },
    ],
    toolReveals: { endpoint: ['old_client'] },
    terminal: {
      'test-netconnection vpn.hpl.example -port 443': {
        output:
          'ComputerName     : vpn.hpl.example\nRemoteAddress    : 203.0.113.40\nRemotePort       : 443\nTcpTestSucceeded : True',
        reveals: ['internet_ok'],
      },
    },
    actionResults: {
      deploy_vpn: {
        result: 'VPN client 5.1.3 deployed over the internet management channel. Elena reconnected: the renewed gateway certificate now validates.',
        reveals: ['old_client'],
        deviceUpdate: {
          installedNotes: ['Endpoint protection: healthy', 'VPN Client 5.1.3', '3 postponed updates'],
        },
      },
      reset_password: {
        result: 'Password reset. The VPN still fails with the same certificate validation error.',
      },
    },
    requiredActions: ['deploy_vpn'],
    helpfulActions: ['guide_restart'],
    harmfulActions: ['grant_admin', 'reimage'],
    rootCauses: [
      { id: 'old_client', label: 'Outdated VPN client does not trust the renewed gateway certificate' },
      { id: 'isp', label: 'Home ISP blocking VPN traffic' },
      { id: 'password', label: 'Expired password' },
      { id: 'gateway_down', label: 'VPN gateway outage' },
    ],
    correctRootCause: 'old_client',
    correctOutcome: 'resolve',
    noteKeywords: ['vpn', 'certificate', '4.2', '5.1', 'client', 'update'],
    replyKeywords: ['update', 'vpn', 'connect'],
    kb: ['kb-vpn'],
    solution: [
      'Confirm internet works and the gateway port is reachable.',
      'Learn about the weekend certificate renewal and that colleagues on newer clients are fine.',
      "Check the endpoint: VPN client 4.2.1 is below the supported version.",
      'Deploy the current VPN client remotely and confirm the connection.',
      'Kindly remind the user why postponing updates causes this.',
    ],
    debrief:
      'Certificate errors right after a planned renewal usually mean the client side is out of date. Endpoint management lets you fix it without admin rights for the user. Granting admin "so they can install it" opens a much bigger risk.',
  }),

  scenario({
    id: 'net-floor-outage',
    title: 'Whole east side of Floor 3 is offline',
    category: 'Network',
    difficulty: 2,
    priority: 'P1',
    reportedPriority: 'P3',
    triageNote: 'One caller logged it as their own connection, but a whole floor is down: high impact, high urgency.',
    channel: 'phone',
    targetMinutes: 5,
    requester: person('Samuel Achebe', 'Operations Team Lead', 'Operations', 'HQ, Floor 3 (east)'),
    description:
      'None of us on the east side of Floor 3 have network, about 25 people. Desk phones are dead too. It started around 10:40. The west side is fine. We have trucks to dispatch!',
    account: account('samuel.achebe'),
    device: device('HPL-LT-3021', { ip: '169.254.10.77', gateway: '', dns: '', online: false }),
    facts: [
      { id: 'many_users', label: '~25 users affected on one side of a floor' },
      { id: 'phones_dead', label: 'Desk phones (PoE-powered) are also down' },
      { id: 'west_ok', label: 'West side of the same floor is fine' },
      { id: 'electricians', label: 'Electricians were working in the Floor 3 comms cupboard this morning' },
      { id: 'switch_down', label: 'Access switch SW-F3-EAST is unreachable' },
    ],
    keyFacts: ['many_users', 'phones_dead', 'switch_down'],
    questions: [
      {
        id: 'q_scope',
        text: 'How many people are affected, and where exactly?',
        reply: "Everyone on the east side, around 25 of us. The west side is working; I walked over to check.",
        keywords: ['how many', 'scope', 'who', 'everyone', 'where'],
        reveals: ['many_users', 'west_ok'],
      },
      {
        id: 'q_phones',
        text: 'Are your desk phones working?',
        reply: 'No, they are completely dark: no screen at all.',
        keywords: ['phone', 'phones', 'desk phone', 'voip'],
        reveals: ['phones_dead'],
      },
      {
        id: 'q_work',
        text: 'Has there been any building or maintenance work on the floor today?',
        reply: 'Now that you mention it, electricians were in the comms cupboard by the kitchen this morning.',
        keywords: ['work', 'maintenance', 'electrician', 'building', 'contractor'],
        reveals: ['electricians'],
      },
      {
        id: 'q_restart',
        text: 'Has everyone tried restarting their computers?',
        reply: "Some did, it didn't help. And the phones are dead too. They can't all be broken.",
        keywords: ['restart', 'reboot'],
        quality: 'neutral',
      },
      {
        id: 'q_home',
        text: 'Can you just send everyone home for the day?',
        reply: "That's not really your call, is it? We need this fixed.",
        keywords: ['send home', 'go home'],
        quality: 'bad',
      },
    ],
    servers: {
      'SW-F3-EAST': {
        status: 'Unreachable',
        note: 'No response since 10:41. Last message before it went quiet: power supply input lost.',
        uptime: 'Unknown',
      },
    },
    toolReveals: { servers: ['switch_down'] },
    terminal: {
      'ping sw-f3-east': {
        output:
          '(run from your admin jump box HPL-JUMP01)\nPinging sw-f3-east.hpl.example [10.20.3.2] with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for 10.20.3.2:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)',
        reveals: ['switch_down'],
      },
      'ping sw-f3-west': {
        output:
          '(run from your admin jump box HPL-JUMP01)\nPinging sw-f3-west.hpl.example [10.20.3.3] with 32 bytes of data:\nReply from 10.20.3.3: bytes=32 time=1ms TTL=254\nReply from 10.20.3.3: bytes=32 time=1ms TTL=254\nReply from 10.20.3.3: bytes=32 time<1ms TTL=254\nReply from 10.20.3.3: bytes=32 time=1ms TTL=254',
        reveals: ['west_ok'],
      },
    },
    actionResults: {
      remote_restart: { result: 'Restart command could not be delivered: device unreachable.' },
    },
    requiredActions: [],
    helpfulActions: [],
    harmfulActions: ['reimage'],
    rootCauses: [
      { id: 'switch', label: 'Floor 3 east access switch (PoE) is down' },
      { id: 'dhcp', label: 'DHCP scope exhausted' },
      { id: 'isp', label: 'Internet provider outage' },
      { id: 'worm', label: 'Network worm spreading across PCs' },
    ],
    correctRootCause: 'switch',
    correctOutcome: 'escalate',
    escalateTo: 'Network Team',
    noteKeywords: ['switch', 'floor 3', '25', 'phones', 'poe', 'electrician', 'major incident'],
    replyKeywords: ['network team', 'update', 'aware'],
    kb: ['kb-major-incident', 'kb-apipa'],
    solution: [
      'Scope it fast: 25 users, one area, phones down too. This is infrastructure, not PCs.',
      'Ping the floor switches from your jump box: SW-F3-EAST is down, west is up.',
      'Note the electricians in the comms cupboard (likely power to the switch).',
      'Raise a P1 / major incident and escalate to the Network Team with all evidence.',
      'Give the requester an update cadence (e.g. every 30 minutes).',
    ],
    debrief:
      "When many users AND PoE desk phones fail together in one area, think switch or power, not individual PCs. Tier 1's job here is fast scoping, evidence and escalation, not restarting 25 computers. Good notes save the Network Team precious minutes.",
  }),
];
