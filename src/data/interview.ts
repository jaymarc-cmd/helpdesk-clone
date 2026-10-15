import type { InterviewQuestion } from '../types';

const kp = (label: string, ...keywords: string[]) => ({ label, keywords });

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ---------- Technical ----------
  {
    id: 'iq-dns',
    category: 'Technical',
    difficulty: 1,
    question: 'What is DNS and how would you troubleshoot a user who can reach websites by IP but not by name?',
    keyPoints: [
      kp('Explains DNS translates names to IP addresses', 'name', 'ip', 'translat', 'resolv'),
      kp('Uses nslookup or similar to test resolution', 'nslookup', 'dig', 'resolve-dnsname'),
      kp('Checks configured DNS servers (ipconfig /all)', 'ipconfig', 'dns server', 'configured'),
      kp('Flushes the local DNS cache', 'flushdns', 'flush', 'cache'),
    ],
    sampleAnswer:
      'DNS translates human-friendly names into IP addresses. If IPs work but names fail, resolution is broken. I would check which DNS servers are configured with ipconfig /all, test with nslookup against the configured server and a known-good one, flush the local cache with ipconfig /flushdns, and check whether other users are affected before escalating to the network team.',
    tip: 'Show a logical order: understand, test, isolate, fix, escalate.',
  },
  {
    id: 'iq-dhcp',
    category: 'Technical',
    difficulty: 1,
    question: 'A user has a 169.254.x.x IP address. What does that tell you and what do you do?',
    keyPoints: [
      kp('APIPA / self-assigned address', 'apipa', 'self-assigned', 'automatic private', 'self assigned'),
      kp('Device got no DHCP response', 'dhcp'),
      kp('Checks physical connection (cable, link lights, Wi-Fi)', 'cable', 'link', 'light', 'physical', 'wifi', 'wi-fi'),
      kp('Releases/renews the lease', 'renew', 'release'),
      kp('Checks whether others are affected', 'others', 'other users', 'scope', 'anyone else', 'multiple'),
    ],
    sampleAnswer:
      "169.254 is an APIPA, self-assigned address: the device asked for an IP via DHCP and nobody answered. I'd check the physical layer first (cable seated, link lights, Wi-Fi connected), then try ipconfig /release and /renew. If several users in the same area have it, I'd suspect the switch or DHCP server and escalate to the network team.",
    tip: 'Mention both the single-user and multi-user angles.',
  },
  {
    id: 'iq-osi',
    category: 'Technical',
    difficulty: 2,
    question: 'How do you use the OSI model when troubleshooting?',
    keyPoints: [
      kp('Names layers or the bottom-up approach', 'physical', 'layer', 'bottom'),
      kp('Starts with physical connectivity', 'cable', 'physical', 'link'),
      kp('Moves up through IP/network', 'ip', 'network', 'ping'),
      kp('Ends with application layer', 'application', 'app'),
    ],
    sampleAnswer:
      "I use it as a checklist, usually bottom-up: physical (cable, power, link lights), data link (switch port, Wi-Fi association), network (IP address, gateway, ping), transport (ports, firewalls), then application (is the service itself working?). It stops me from jumping to complex causes when the cable is unplugged.",
    tip: "You don't need to recite all seven layers. Show you use it practically.",
  },
  {
    id: 'iq-ad',
    category: 'Technical',
    difficulty: 1,
    question: 'What is Active Directory, and what everyday tasks would you do in it at the service desk?',
    keyPoints: [
      kp('Directory service for users, computers and groups', 'directory', 'users', 'computers', 'objects'),
      kp('Password resets', 'password', 'reset'),
      kp('Account unlocks', 'unlock', 'locked'),
      kp('Group membership / access', 'group', 'membership', 'access', 'permission'),
    ],
    sampleAnswer:
      "Active Directory is Microsoft's directory service. It stores users, computers and groups and handles authentication and authorization. At the desk I'd unlock accounts, reset passwords after verifying identity, check account status, and manage group membership for access requests that have proper approval.",
    tip: 'Mention verification and approvals: it shows security awareness.',
  },
  {
    id: 'iq-ping-tracert',
    category: 'Technical',
    difficulty: 1,
    question: 'What is the difference between ping and tracert, and when would you use each?',
    keyPoints: [
      kp('Ping tests reachability / round-trip', 'reachab', 'reply', 'round', 'icmp', 'alive'),
      kp('Tracert shows the path / hops', 'hop', 'path', 'route'),
      kp('Use tracert to find where traffic stops', 'where', 'stops', 'fails', 'breaks'),
    ],
    sampleAnswer:
      "Ping sends ICMP echo requests to check if a host is reachable and how long the round trip takes. Tracert lists every hop between you and the destination, so when ping fails, tracert helps show where along the path traffic stops: local network, ISP, or the far end.",
    tip: 'A practical example helps your answer stick.',
  },
  {
    id: 'iq-slow-pc',
    category: 'Troubleshooting',
    difficulty: 1,
    question: 'A user says their computer is slow. Walk me through what you would check.',
    keyPoints: [
      kp('Asks clarifying questions (since when, what is slow)', 'when', 'since', 'what exactly', 'clarify', 'ask'),
      kp('Checks CPU / memory usage (Task Manager)', 'task manager', 'cpu', 'memory', 'ram'),
      kp('Checks disk space', 'disk', 'space', 'storage'),
      kp('Checks uptime / restarts / updates', 'restart', 'uptime', 'reboot', 'update'),
      kp('Considers malware / startup programs', 'malware', 'virus', 'startup'),
    ],
    sampleAnswer:
      "First I'd clarify: slow at what, since when, and did anything change? Then I'd check Task Manager for CPU, memory and disk usage, look at free disk space, uptime and pending updates, startup programs, and endpoint protection status. Most cases are a full disk, a runaway process or weeks without a restart.",
    tip: 'Always start with questions before tools.',
  },
  {
    id: 'iq-printer',
    category: 'Troubleshooting',
    difficulty: 1,
    question: "A user can't print. How do you approach it?",
    keyPoints: [
      kp('Scopes: one user or everyone', 'others', 'everyone', 'other users', 'scope', 'just them'),
      kp('Checks printer status (paper, toner, errors)', 'paper', 'toner', 'jam', 'error', 'display'),
      kp('Checks the print queue / spooler', 'queue', 'spooler'),
      kp('Checks correct printer / driver', 'driver', 'default printer', 'correct printer'),
    ],
    sampleAnswer:
      "I'd first find out whether others can print to the same printer. If not, it's the printer: check its display for paper, toner or jams. If others can, it's local: check they're using the right printer, look at the print queue for stuck jobs, restart the spooler if needed, and check the driver.",
    tip: 'Scoping (one vs many) is the key move interviewers look for.',
  },
  {
    id: 'iq-no-internet',
    category: 'Troubleshooting',
    difficulty: 2,
    question: 'A user reports "the internet is down". What questions do you ask and what steps do you take?',
    keyPoints: [
      kp('Clarifies what exactly fails (one site, everything)', 'one site', 'which', 'everything', 'specific'),
      kp('Checks scope (other users/devices)', 'other users', 'others', 'colleague', 'phone', 'scope'),
      kp('Checks IP configuration', 'ipconfig', 'ip address'),
      kp('Tests with ping / gateway / DNS', 'ping', 'gateway', 'dns', 'nslookup'),
    ],
    sampleAnswer:
      'I\'d clarify what "down" means: one site, everything, or just slow. Then scope it: other users, other devices like their phone? Then on the device: ipconfig to check for a valid address, ping the gateway, ping an external IP, then test DNS. That narrows it down to the device, the local network, DNS or the wider internet.',
    tip: 'Users\' descriptions are rarely precise. Show that you clarify.',
  },
  {
    id: 'iq-blue-screen',
    category: 'Troubleshooting',
    difficulty: 2,
    question: 'A laptop keeps getting blue screens. What do you do?',
    keyPoints: [
      kp('Records the stop code / error', 'stop code', 'error code', 'code', 'message'),
      kp('Asks about recent changes (drivers, updates, hardware)', 'recent', 'driver', 'update', 'change', 'installed'),
      kp('Checks event logs / dump files', 'event', 'log', 'dump', 'minidump'),
      kp('Considers hardware tests (memory/disk)', 'memory', 'ram', 'disk', 'hardware', 'diagnostic'),
      kp('Escalates if needed', 'escalat', 'tier 2'),
    ],
    sampleAnswer:
      "I'd get the stop code, ask what changed recently (new drivers, updates, docks, hardware), check the event logs and minidump files, and roll back a recent driver if it lines up. If there's no clear software cause, I'd run memory and disk diagnostics, and escalate to Tier 2 or arrange a hardware swap with the evidence collected.",
    tip: 'Mention evidence-gathering before escalation.',
  },

  // ---------- Security ----------
  {
    id: 'iq-verify',
    category: 'Security',
    difficulty: 1,
    question: 'Someone calls asking for a password reset. What do you do before resetting it?',
    keyPoints: [
      kp('Verifies identity per policy', 'verify', 'verification', 'identity'),
      kp('Uses known information (employee ID, manager)', 'employee id', 'manager', 'id'),
      kp('Callback to number on file', 'call back', 'callback', 'on file'),
      kp('Never accepts pressure / refuses if unverified', 'pressure', 'refuse', 'decline', 'urgent', 'escalat'),
    ],
    sampleAnswer:
      "I verify their identity according to policy: for example, employee ID and manager name against the directory, or a callback to the number already on file. I never use a number the caller gives me, and if they can't be verified I politely decline and offer the proper channels, however urgent or senior they claim to be. Suspicious calls go to Security.",
    tip: 'Interviewers love hearing "callback to the number on file".',
  },
  {
    id: 'iq-phishing',
    category: 'Security',
    difficulty: 2,
    question: 'A user tells you they entered their password on a suspicious website. What are your next steps?',
    keyPoints: [
      kp('Treats it as urgent / thanks the user', 'urgent', 'thank', 'quick', 'immediately'),
      kp('Resets the password', 'reset', 'password'),
      kp('Revokes sessions / tokens', 'revoke', 'session', 'sign out', 'token'),
      kp('Checks sign-in logs / MFA prompts', 'log', 'sign-in', 'mfa', 'prompt'),
      kp('Escalates to security team', 'security', 'escalat', 'soc'),
    ],
    sampleAnswer:
      'I thank them for reporting quickly, verify their identity, then reset the password and revoke all active sessions, because tokens can survive a reset. I ask whether they approved any MFA prompts, check the sign-in logs for unusual locations, have them report the email, and escalate to the security team as an incident.',
    tip: 'Mention session revocation. Many candidates forget it.',
  },
  {
    id: 'iq-least-privilege',
    category: 'Security',
    difficulty: 2,
    question: 'A manager demands local admin rights for their team "to save time". How do you respond?',
    keyPoints: [
      kp('Explains least privilege / security risk', 'least privilege', 'risk', 'security', 'malware'),
      kp('Understands the underlying need', 'need', 'why', 'what they', 'underlying'),
      kp('Offers alternatives (self-service catalog, elevated request)', 'software center', 'catalog', 'self-service', 'alternative'),
      kp('Follows policy / escalates for approval', 'policy', 'approval', 'escalat', 'exception'),
    ],
    sampleAnswer:
      "I'd stay respectful and ask what they're trying to achieve, which is usually installing specific software. Then I'd explain least privilege: admin rights greatly increase malware and misconfiguration risk. I'd offer alternatives like the self-service software catalog or a software request, and if they still need an exception, route it through the proper approval process rather than deciding myself.",
    tip: 'Find the need behind the request.',
  },

  // ---------- Customer service ----------
  {
    id: 'iq-angry',
    category: 'Customer Service',
    difficulty: 1,
    question: 'How do you handle an angry or frustrated caller?',
    keyPoints: [
      kp('Stays calm and listens', 'calm', 'listen', 'patient'),
      kp('Shows empathy / acknowledges impact', 'empath', 'understand', 'acknowledg', 'frustrat'),
      kp("Doesn't take it personally", 'personal', 'professional'),
      kp('Focuses on solution / next steps', 'solution', 'next step', 'fix', 'plan'),
      kp('Sets expectations / follows up', 'expectation', 'follow up', 'update', 'follow-up'),
    ],
    sampleAnswer:
      "I let them explain without interrupting, stay calm, and don't take it personally. They're frustrated with the situation, not me. I acknowledge the impact, apologise for the inconvenience, then move to a clear plan: what I'll do now, what happens next and when they'll hear from me. Then I make sure I actually follow up.",
    tip: 'A short real example (STAR) makes this answer much stronger.',
  },
  {
    id: 'iq-nontech',
    category: 'Customer Service',
    difficulty: 1,
    question: 'How would you explain a technical problem to a non-technical user?',
    keyPoints: [
      kp('Avoids jargon / plain language', 'jargon', 'plain', 'simple', 'everyday'),
      kp('Uses analogies', 'analog', 'like a', 'compare', 'example'),
      kp('Checks understanding', 'check', 'understand', 'confirm', 'repeat back'),
      kp('Focuses on what they need to do', 'what they need', 'next step', 'action', 'impact'),
    ],
    sampleAnswer:
      "I skip the jargon and focus on what it means for them and what they need to do. Analogies help: DNS is like a phone book for websites. I keep it short, check they understood by asking them to try the step, and never make them feel silly for not knowing.",
    tip: 'Give an actual analogy in your answer.',
  },
  {
    id: 'iq-unknown',
    category: 'Customer Service',
    difficulty: 1,
    question: "What do you do when you don't know the answer to a user's problem?",
    keyPoints: [
      kp('Is honest with the user', 'honest', "don't know", 'admit', 'transparent'),
      kp('Researches (KB, documentation, search)', 'knowledge base', 'kb', 'documentation', 'research', 'search'),
      kp('Asks colleagues / escalates', 'colleague', 'escalat', 'senior', 'tier 2', 'team'),
      kp('Sets expectations and follows up', 'expectation', 'follow up', 'update', 'get back'),
      kp('Documents what was learned', 'document', 'notes', 'kb article', 'write'),
    ],
    sampleAnswer:
      "I'm honest that I need to look into it, and I tell them when they'll hear back. Then I check the knowledge base and documentation, ask a colleague or escalate with good notes if needed. Once it's solved, I document the fix, ideally as a KB article, so the next person doesn't have to start from scratch.",
    tip: 'Honesty plus a process answers this well.',
  },
  {
    id: 'iq-priority',
    category: 'Customer Service',
    difficulty: 2,
    question: 'You have five tickets waiting. How do you decide which to work on first?',
    keyPoints: [
      kp('Impact and urgency / priority matrix', 'impact', 'urgency', 'priority', 'matrix'),
      kp('Number of users affected', 'many users', 'number of users', 'how many', 'multiple users', 'outage'),
      kp('SLA deadlines', 'sla', 'deadline', 'response time'),
      kp('Security issues first', 'security'),
      kp('Communicates with waiting users', 'communicat', 'update', 'let them know'),
    ],
    sampleAnswer:
      "I prioritise by business impact and urgency: outages affecting many people and security incidents first, then users who are completely blocked with time-critical work, then degraded service and requests. I watch SLA deadlines, and for tickets I can't start yet, I send a quick update so users know they're in the queue.",
    tip: 'Security incidents jump the queue. Say so.',
  },

  // ---------- Behavioral ----------
  {
    id: 'iq-why',
    category: 'Behavioral',
    difficulty: 1,
    question: 'Why do you want to work on a service desk?',
    keyPoints: [
      kp('Enjoys helping people', 'help', 'people', 'customer'),
      kp('Enjoys problem solving', 'problem', 'solv', 'troubleshoot', 'puzzle'),
      kp('Wants to learn / grow in IT', 'learn', 'grow', 'career', 'develop'),
      kp('Mentions specific motivation or experience', 'experience', 'because', 'example', 'when i'),
    ],
    sampleAnswer:
      "I like solving problems and I like helping people, and the service desk is where those meet every day. It's also the best place to learn a broad range of skills, from networking and identity to hardware and security, and grow my career in IT. For example, I've been the go-to IT person for family and friends for years and want to make that my profession.",
    tip: 'Be genuine and specific. Avoid "I just need a job".',
  },
  {
    id: 'iq-mistake',
    category: 'Behavioral',
    difficulty: 2,
    question: 'Tell me about a time you made a mistake. How did you handle it?',
    keyPoints: [
      kp('Describes a specific situation', 'when', 'time', 'situation', 'once'),
      kp('Takes ownership', 'responsib', 'owned', 'ownership', 'admitted', 'my mistake'),
      kp('Explains how it was fixed', 'fix', 'resolv', 'correct'),
      kp('Shares what was learned / changed', 'learn', 'now i', 'since then', 'prevent', 'checklist'),
    ],
    sampleAnswer:
      'Situation: I once closed a ticket after a fix without confirming with the user, and the problem returned the next day. I owned it, apologised, reopened the ticket and solved the actual root cause. Since then I always confirm with the user before closing and note how I verified the fix.',
    tip: 'Use STAR: Situation, Task, Action, Result. Focus on what you learned.',
  },
  {
    id: 'iq-pressure',
    category: 'Behavioral',
    difficulty: 2,
    question: 'Describe how you stay organized when many things happen at once.',
    keyPoints: [
      kp('Prioritises by impact', 'priorit', 'impact', 'urgent'),
      kp('Uses the ticketing system / lists', 'ticket', 'list', 'notes', 'track'),
      kp('Communicates proactively', 'communicat', 'update', 'inform'),
      kp('Stays calm / focused', 'calm', 'focus', 'one thing at a time'),
    ],
    sampleAnswer:
      "I keep everything in the ticketing system so nothing lives only in my head, prioritise by impact, and focus on one thing at a time. I send quick updates to anyone waiting, and if something big like an outage hits, I flag it to my lead immediately instead of trying to juggle silently.",
    tip: 'Mention the ticketing system as your source of truth.',
  },
  {
    id: 'iq-team',
    category: 'Behavioral',
    difficulty: 1,
    question: 'How do you share knowledge with your team?',
    keyPoints: [
      kp('Writes KB articles / documentation', 'kb', 'knowledge', 'document', 'article'),
      kp('Writes good ticket notes', 'notes', 'ticket'),
      kp('Shares in meetings / chat', 'meeting', 'chat', 'share', 'huddle', 'standup'),
      kp('Helps/mentors colleagues', 'help', 'mentor', 'teach', 'shadow'),
    ],
    sampleAnswer:
      "When I solve something new, I write or update a KB article and make sure my ticket notes would let anyone pick it up. I share recurring issues in team huddles or chat so we can spot patterns early, and I'm happy to pair with newer colleagues on tricky tickets.",
    tip: 'Documentation is a big plus for service desk roles.',
  },
  {
    id: 'iq-escalate',
    category: 'Troubleshooting',
    difficulty: 2,
    question: 'When should you escalate a ticket, and what makes a good escalation?',
    keyPoints: [
      kp('Escalate when outside skills/access/time', 'access', 'permission', 'skill', 'outside', 'sla', 'time'),
      kp('Escalate major/security incidents immediately', 'security', 'outage', 'major', 'immediately'),
      kp('Includes steps already taken', 'steps', 'tried', 'already'),
      kp('Includes evidence (logs, errors)', 'evidence', 'log', 'error', 'screenshot'),
      kp('Keeps user informed', 'user', 'inform', 'update', 'expectation'),
    ],
    sampleAnswer:
      "I escalate when the fix needs access or skills I don't have, when I'm near SLA without progress, and immediately for outages or security incidents. A good escalation has a clear summary and impact, everything I've tried, evidence like errors and logs, and the user's availability, so the next team doesn't repeat my work. I also tell the user what happens next.",
    tip: 'Show you escalate with context, not just "pass it on".',
  },
  {
    id: 'iq-mfa',
    category: 'Security',
    difficulty: 1,
    question: 'What is MFA and why do organizations require it?',
    keyPoints: [
      kp('Multiple factors (know/have/are)', 'something you', 'factor', 'know', 'have'),
      kp('Protects against stolen passwords', 'stolen', 'password', 'phish', 'compromis'),
      kp('Mentions MFA fatigue / approving unexpected prompts', 'fatigue', 'unexpected', 'prompt', "didn't request", 'approve'),
    ],
    sampleAnswer:
      "Multi-factor authentication requires two or more factors: something you know (password), have (phone or key) or are (biometrics). A stolen password alone is then not enough. Users must also learn never to approve prompts they didn't trigger, because attackers use MFA fatigue to get around it.",
    tip: 'Mentioning MFA fatigue shows current awareness.',
  },
  {
    id: 'iq-sla',
    category: 'Customer Service',
    difficulty: 1,
    question: 'What is an SLA and why does it matter on a service desk?',
    keyPoints: [
      kp('Service level agreement definition', 'service level', 'agreement'),
      kp('Response vs resolution times', 'response', 'resolution', 'time'),
      kp('Linked to priority', 'priority', 'p1', 'critical'),
      kp('Sets expectations / measures performance', 'expectation', 'measure', 'performance', 'trust'),
    ],
    sampleAnswer:
      "A Service Level Agreement defines the expected response and resolution times, usually by priority: a P1 outage might need a response in 15 minutes, a P4 request within a business day. SLAs set clear expectations with the business and measure how well the desk performs.",
    tip: 'Differentiate response time from resolution time.',
  },
];
