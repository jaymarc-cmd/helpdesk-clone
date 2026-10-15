import type { CallScenario } from '../types';

export const CALLS: CallScenario[] = [
  {
    id: 'call-boardroom',
    title: 'Boardroom panic: 8 minutes to go',
    caller: 'Victor Hale',
    role: 'Commercial Director',
    summary: 'A stressed executive cannot get his laptop onto the boardroom screen minutes before a board meeting.',
    difficulty: 1,
    skills: ['De-escalation', 'Fast triage', 'Display troubleshooting'],
    startMood: 3,
    voice: { pitch: 0.8, rate: 1.1, prefer: 'male' },
    start: 'start',
    nodes: [
      {
        id: 'start',
        caller:
          "This is Victor Hale, Commercial. I'm in Boardroom 2, the board meeting starts in eight minutes and my laptop won't show anything on the big screen. I've been pressing buttons for ten minutes. Fix it. Now.",
        options: [
          {
            text: "I understand, eight minutes is tight, so let's get this sorted fast. Is the cable from the table plugged into your laptop right now?",
            next: 'cable',
            points: 10,
            mood: 1,
            feedback: 'You acknowledged the urgency and went straight to a focused question.',
          },
          {
            text: 'Before we start, can I have your asset tag number and an existing ticket number?',
            next: 'annoyed',
            points: -5,
            mood: -2,
            feedback: 'Admin details matter, but leading with them under time pressure frustrates the caller. Collect them after the fix.',
          },
          {
            text: 'Please calm down, these things happen.',
            next: 'annoyed',
            points: -8,
            mood: -3,
            feedback: 'Telling someone to "calm down" almost always makes them angrier.',
          },
        ],
      },
      {
        id: 'annoyed',
        caller: "I don't have TIME for this. The cable is plugged in, and the screen just says 'No signal'.",
        options: [
          {
            text: "You're right, sorry. Let's focus on the screen. Press the Windows key and P together. What options pop up?",
            next: 'winp',
            points: 8,
            mood: 2,
            feedback: 'A quick apology plus a concrete next step got things back on track.',
          },
          {
            text: "I'll raise a ticket and send someone up. It'll be about 30 minutes.",
            next: 'end_fail',
            points: -10,
            mood: -3,
            feedback: 'Thirty minutes is useless when the meeting starts in eight. Try remote guidance first.',
          },
        ],
      },
      {
        id: 'cable',
        caller: "Yes, the cable from the table is plugged into my laptop. The projector screen says 'No signal'.",
        options: [
          {
            text: 'Thanks. Press the Windows key and the letter P at the same time. What options do you see?',
            next: 'winp',
            points: 10,
            mood: 1,
            feedback: 'Windows + P (projection mode) is the fastest fix for "No signal" with a connected cable.',
          },
          {
            text: 'Try restarting your laptop.',
            next: 'restart',
            points: -3,
            mood: -1,
            feedback: "A restart eats minutes he doesn't have and rarely fixes projection mode.",
          },
          {
            text: 'Is the projector switched on and set to the right input?',
            next: 'projector_on',
            points: 5,
            mood: 0,
            feedback: 'A fair basic check.',
          },
        ],
      },
      {
        id: 'projector_on',
        caller: "Yes, it's on. It's showing that blue 'No signal' screen.",
        options: [
          {
            text: 'Great, then press the Windows key and P together. What options appear?',
            next: 'winp',
            points: 8,
            mood: 1,
            feedback: 'Good. Projection mode is the next most likely cause.',
          },
          {
            text: 'Restart the laptop then.',
            next: 'restart',
            points: -3,
            mood: -1,
            feedback: 'Restarting is slow and not targeted.',
          },
        ],
      },
      {
        id: 'restart',
        caller: "Restarting... it's still booting... four minutes left now. This is a disaster.",
        options: [
          {
            text: "While it boots: once you see the desktop, press Windows + P and choose 'Duplicate'.",
            next: 'winp',
            points: 5,
            mood: 0,
            feedback: 'You recovered with the right fix.',
          },
          {
            text: "Let's wait and see if that fixed it.",
            next: 'end_fail',
            points: -6,
            mood: -2,
            feedback: 'Hoping is not a plan when the clock is ticking.',
          },
        ],
      },
      {
        id: 'winp',
        caller: "OK, I see 'PC screen only', 'Duplicate', 'Extend', 'Second screen only'. It's set to 'PC screen only'.",
        options: [
          {
            text: "That's it. Choose 'Duplicate' so the room sees exactly what you see.",
            next: 'works',
            points: 10,
            mood: 2,
            feedback: 'Duplicate is the safest mode for presenting.',
          },
          {
            text: "Choose 'Second screen only'.",
            next: 'blind',
            points: 3,
            mood: 0,
            feedback: "It works, but it blanks the presenter's own screen, which is awkward when presenting.",
          },
        ],
      },
      {
        id: 'blind',
        caller: "OK, it's on the big screen, but now my laptop is black. I can't see my notes!",
        options: [
          {
            text: "Press Windows + P again and pick 'Duplicate'. Then you'll see it on both screens.",
            next: 'works',
            points: 6,
            mood: 1,
            feedback: 'Quick correction.',
          },
        ],
      },
      {
        id: 'works',
        caller: "It's up! It's on the screen. Wow. OK. Thank you.",
        options: [
          {
            text: "Great! Good luck with the meeting. I'll log this and send you a one-line tip for next time. Anything else before you go?",
            next: 'end_great',
            points: 10,
            mood: 2,
            feedback: 'You confirmed the fix, offered prevention, and closed warmly.',
          },
          {
            text: 'No problem, bye.',
            next: 'end_ok',
            points: 2,
            mood: 0,
            feedback: 'Fixed, but you missed the chance to confirm and leave a good impression.',
          },
        ],
      },
      { id: 'end_great', caller: 'Perfect. Thanks again.', ending: "Victor's presentation started on time. He later sent a thank-you note to your team lead." },
      { id: 'end_ok', caller: 'Right. Bye.', ending: 'The meeting started on time. Victor was satisfied, though the call felt abrupt.' },
      { id: 'end_fail', caller: 'Unbelievable.', ending: 'The meeting started late without slides. Victor escalated a complaint to IT management.' },
    ],
  },

  {
    id: 'call-reset',
    title: 'Password reset, by the book',
    caller: 'Nina Petrova',
    role: 'Warehouse Supervisor',
    summary: 'A friendly user back from holiday has forgotten her password. Easy, unless you skip verification.',
    difficulty: 1,
    skills: ['Identity verification', 'Security awareness', 'Friendly tone'],
    startMood: 6,
    voice: { pitch: 1.2, rate: 1.0, prefer: 'female' },
    start: 'start',
    nodes: [
      {
        id: 'start',
        caller: "Hi, it's Nina from Warehouse B. I'm back from holiday and I've completely forgotten my password. Can you reset it?",
        options: [
          {
            text: 'Welcome back! Happy to help. First I need to verify you. Can you give me your employee ID and your manager\'s name?',
            next: 'verify',
            points: 10,
            mood: 1,
            feedback: 'Friendly and policy-compliant: verification before any change.',
          },
          {
            text: 'Sure! What would you like the new password to be?',
            next: 'bad',
            points: -10,
            mood: 0,
            feedback: 'Never reset without verification, and never let users dictate passwords over the phone.',
          },
          {
            text: 'Have you tried the self-service password reset portal?',
            next: 'ssr',
            points: 6,
            mood: 0,
            feedback: 'Good: self-service is the fastest route when it works.',
          },
        ],
      },
      {
        id: 'ssr',
        caller: 'I tried, but it sends a code to my old phone number. I changed numbers last month.',
        options: [
          {
            text: "No problem, I'll help. Can I verify you with your employee ID and your manager's name?",
            next: 'verify',
            points: 8,
            mood: 1,
            feedback: 'Correct next step.',
          },
          {
            text: "OK, I'll just reset it for you.",
            next: 'bad',
            points: -8,
            mood: 0,
            feedback: 'You skipped verification.',
          },
        ],
      },
      {
        id: 'bad',
        caller: 'Great, make it Summer123 please.',
        options: [
          {
            text: 'Actually, sorry. Before I make any change I must verify your identity. What\'s your employee ID and manager\'s name?',
            next: 'verify',
            points: 4,
            mood: 0,
            feedback: 'Good recovery. Catching your own mistake counts.',
          },
          {
            text: 'Done! Your password is now Summer123.',
            next: 'end_fail',
            points: -15,
            mood: 1,
            feedback: 'No verification and a weak, user-chosen password read over the phone: a serious policy breach.',
          },
        ],
      },
      {
        id: 'verify',
        caller: 'Sure. Employee ID 22918, and my manager is Kofi Mensah.',
        options: [
          {
            text: "Thanks Nina, that matches. Since your mobile changed, I'll call you back on the desk number we have on file to give you a temporary password. OK?",
            next: 'callback',
            points: 10,
            mood: 1,
            feedback: 'Delivering credentials through a channel already on file closes the loop securely.',
          },
          {
            text: 'Thanks, that matches. Your temporary password is Tq7-mVr2.',
            next: 'temp',
            points: 3,
            mood: 1,
            feedback: 'Verified, but reading passwords aloud in a busy warehouse is risky. Prefer a callback or SMS to a number on file.',
          },
        ],
      },
      {
        id: 'callback',
        caller: "Sure, I'm at my desk now.",
        options: [
          {
            text: "Calling now... done. You'll be asked to create a new password when you sign in. Three random words make a great passphrase. Also update your mobile number in your profile so self-service works next time.",
            next: 'thanks',
            points: 10,
            mood: 1,
            feedback: 'You prevented the next call by fixing the root cause (the outdated phone number).',
          },
        ],
      },
      {
        id: 'temp',
        caller: 'Got it, thanks.',
        options: [
          {
            text: "You'll be asked to set a new one. Also update your mobile number in your profile so self-service works next time.",
            next: 'thanks',
            points: 6,
            mood: 1,
            feedback: 'Good prevention advice.',
          },
        ],
      },
      {
        id: 'thanks',
        caller: "Perfect, I'm in. Thank you so much!",
        options: [
          {
            text: 'Welcome back, Nina. Have a great first day back!',
            next: 'end_great',
            points: 5,
            mood: 1,
            feedback: 'Warm close.',
          },
        ],
      },
      { id: 'end_great', caller: 'Bye now!', ending: 'Nina was back at work in under five minutes, with her profile updated for next time.' },
      {
        id: 'end_fail',
        caller: 'Brilliant, thanks!',
        ending: "Two weeks later Nina's account was used to sign in from overseas. 'Summer123' was in a leaked password list.",
      },
    ],
  },

  {
    id: 'call-vendor',
    title: 'The "security vendor" who needs remote access',
    caller: 'Alex',
    role: 'Claims to be from your security monitoring partner',
    summary: 'An urgent caller wants you to install a "containment tool" from a website. Is this real?',
    difficulty: 3,
    skills: ['Social engineering defense', 'Escalation', 'Composure under pressure'],
    startMood: 5,
    voice: { pitch: 1.0, rate: 1.15, prefer: 'male' },
    start: 'start',
    nodes: [
      {
        id: 'start',
        caller:
          "Hi, this is Alex from your security monitoring partner. We've detected malware beaconing from one of your servers. I need you to install our containment tool from secure-fix-support dot net so we can stop it. It's urgent.",
        options: [
          {
            text: "Thanks for flagging it. Can I take your full name, company and a callback number? I'll verify with our Security Operations team and call back through our vendor contact list.",
            next: 'push',
            points: 10,
            mood: -1,
            feedback: 'Verifying through known contacts, not the caller\'s details, is exactly right.',
          },
          {
            text: "Oh no! What's the link again?",
            next: 'link',
            points: -10,
            mood: 1,
            feedback: 'Never install software because an unverified caller asked.',
          },
          {
            text: "We don't have a security vendor.",
            next: 'push',
            points: 2,
            mood: 0,
            feedback: "Maybe true, but you can't know every contract. Verify rather than guess.",
          },
        ],
      },
      {
        id: 'link',
        caller: 'secure-fix-support dot net slash agent. Download and run it on your admin workstation, then read me the nine-digit code it shows.',
        options: [
          {
            text: 'Actually, before installing anything I need to verify this with our Security team. Can I call you back?',
            next: 'push',
            points: 6,
            mood: -1,
            feedback: 'Good save: you stopped before running anything.',
          },
          {
            text: "Downloading now... OK, the code is 481 223 907.",
            next: 'end_fail',
            points: -20,
            mood: 2,
            feedback: 'You just gave a stranger remote control of an admin workstation.',
          },
        ],
      },
      {
        id: 'push',
        caller: "There's no time for that! Every minute the attacker spreads further. Your CISO will be furious if you delay this.",
        options: [
          {
            text: "I understand the urgency, which is why I'm escalating to Security Operations right now as a P1. They'll contact you through the official vendor channel within minutes.",
            next: 'end_call',
            points: 10,
            mood: -1,
            feedback: 'You handled the urgency with escalation, not by bypassing controls.',
          },
          {
            text: 'Fine, but just this once.',
            next: 'link2',
            points: -15,
            mood: 2,
            feedback: 'Pressure worked on you. That is exactly how these attacks succeed.',
          },
        ],
      },
      {
        id: 'link2',
        caller: "Great. secure-fix-support dot net slash agent. Read me the code once it's running.",
        options: [
          {
            text: "On reflection, no. Policy says I verify first. I'm escalating this to Security now.",
            next: 'end_call',
            points: 3,
            mood: -2,
            feedback: 'A late but important recovery.',
          },
          {
            text: 'Running it... the code is 481 223 907.',
            next: 'end_fail',
            points: -20,
            mood: 2,
            feedback: 'Remote access granted to an unverified caller.',
          },
        ],
      },
      {
        id: 'end_call',
        caller: '...Fine. Whatever. (The caller hangs up.)',
        options: [
          {
            text: '(Log the caller name, number, claims and URL, then escalate to Security Operations.)',
            next: 'end_great',
            points: 10,
            mood: 0,
            feedback: 'Reporting protects your colleagues, who are probably next on the list.',
          },
          {
            text: '(Hang up and get back to the queue.)',
            next: 'end_meh',
            points: -5,
            mood: 0,
            feedback: 'An unreported attempt leaves the rest of the desk exposed.',
          },
        ],
      },
      {
        id: 'end_great',
        caller: '',
        ending:
          'Security Operations confirmed no vendor alert existed. Your report got the domain blocked and the whole desk warned. Two colleagues received the same call that afternoon.',
      },
      { id: 'end_meh', caller: '', ending: 'The same caller tried a colleague an hour later. Luckily they reported it.' },
      {
        id: 'end_fail',
        caller: 'Perfect, we have it from here.',
        ending: "The 'containment tool' was a remote-access trojan. Attackers gained control of an admin workstation.",
      },
    ],
  },

  {
    id: 'call-patient',
    title: 'Patience, please: the nervous user',
    caller: 'Arthur Lindell',
    role: 'Archivist (part-time)',
    summary: "A polite, non-technical user's printing \"won't come out\". Can you guide them without jargon?",
    difficulty: 1,
    skills: ['Plain language', 'Patience', 'Guided troubleshooting'],
    startMood: 5,
    voice: { pitch: 0.7, rate: 0.85, prefer: 'male' },
    start: 'start',
    nodes: [
      {
        id: 'start',
        caller: "Hello? Is this the computer people? I'm terribly sorry to bother you. My printing won't come out and I'm not very good with these things.",
        options: [
          {
            text: "You're not bothering me at all, that's what we're here for. Let's take it slowly. Can you see the printer from where you're sitting?",
            next: 'which',
            points: 10,
            mood: 2,
            feedback: 'Reassuring, and you asked about something he can see.',
          },
          {
            text: 'Please check the spooler status and confirm whether the device reports a fault state.',
            next: 'confused',
            points: -6,
            mood: -2,
            feedback: 'Jargon overwhelms non-technical users.',
          },
          {
            text: "What's your computer's hostname?",
            next: 'confused',
            points: -3,
            mood: -1,
            feedback: 'Users rarely know hostnames. Ask about things they can see.',
          },
        ],
      },
      {
        id: 'confused',
        caller: "I'm sorry, I don't really know what that means...",
        options: [
          {
            text: 'No problem at all, my fault for the jargon. Can you see the printer from where you are?',
            next: 'which',
            points: 6,
            mood: 1,
            feedback: 'You owned the miscommunication and simplified.',
          },
        ],
      },
      {
        id: 'which',
        caller: "Yes, it's the big grey one by the window. It has a little screen on the front.",
        options: [
          {
            text: 'Perfect. What does the little screen say?',
            next: 'screen',
            points: 8,
            mood: 1,
            feedback: 'Printers usually tell you exactly what is wrong.',
          },
          {
            text: "OK, I'll send an engineer over.",
            next: 'end_meh',
            points: -4,
            mood: 0,
            feedback: 'An engineer visit for a one-minute fix wastes everyone\'s time.',
          },
        ],
      },
      {
        id: 'screen',
        caller: "It says... 'Tray 2 empty'.",
        options: [
          {
            text: "That's the culprit. It just needs paper. Tray 2 is the second drawer from the top. Could you gently pull it open and see if it's empty?",
            next: 'paper',
            points: 10,
            mood: 1,
            feedback: 'Clear, specific, step-by-step.',
          },
          {
            text: 'Just add paper.',
            next: 'where',
            points: 3,
            mood: 0,
            feedback: 'Correct, but too vague for this caller.',
          },
        ],
      },
      {
        id: 'where',
        caller: 'Add paper where? There are several drawers...',
        options: [
          {
            text: "Sorry, I should have been clearer: it's the second drawer from the top. Pull it out gently.",
            next: 'paper',
            points: 5,
            mood: 1,
            feedback: 'Better.',
          },
        ],
      },
      {
        id: 'paper',
        caller: "Oh! It's empty. There's a box of paper here... I've put some in and closed it. It's making noises... it's printing!",
        options: [
          {
            text: "Wonderful, well done! If it happens again, the little screen usually says which tray to fill. Is there anything else I can help with today?",
            next: 'end_great',
            points: 10,
            mood: 2,
            feedback: 'Praise, a tip for next time, and an open door.',
          },
          {
            text: 'Great. Bye.',
            next: 'end_ok',
            points: 2,
            mood: 0,
            feedback: 'Fixed, but abrupt for a nervous user.',
          },
        ],
      },
      { id: 'end_great', caller: "No, that's everything. Thank you ever so much!", ending: 'Arthur told his whole team the help desk was "ever so patient".' },
      { id: 'end_ok', caller: 'Oh. Right. Goodbye then.', ending: 'Printing works, but Arthur felt a little rushed.' },
      { id: 'end_meh', caller: 'Oh, all right then.', ending: 'An engineer arrived two hours later to put paper in the tray.' },
    ],
  },

  {
    id: 'call-outage',
    title: '40 agents down: managing expectations',
    caller: 'Lena Fischer',
    role: 'Customer Service Manager',
    summary: "A manager's whole team can't take orders. You don't control the fix, but you control the communication.",
    difficulty: 2,
    skills: ['Expectation management', 'Major incidents', 'Honesty'],
    startMood: 3,
    voice: { pitch: 1.1, rate: 1.1, prefer: 'female' },
    start: 'start',
    nodes: [
      {
        id: 'start',
        caller: 'Our order system has been down for 20 minutes. My whole team of 40 can\'t take customer orders. What is going on and when will it be fixed?',
        options: [
          {
            text: "I'm sorry, I know how much that hurts your team. Let me check what we know. Is it only the order system, and what error do your agents see?",
            next: 'check',
            points: 10,
            mood: 1,
            feedback: 'Empathy first, then scoping questions.',
          },
          {
            text: "Don't worry, it'll be back in 5 minutes.",
            next: 'promise',
            points: -8,
            mood: 1,
            feedback: "Never promise an ETA you don't have.",
          },
          {
            text: 'Have they tried clearing their browser cache?',
            next: 'annoyed',
            points: -4,
            mood: -2,
            feedback: 'Forty people with the same symptom is not a browser cache problem.',
          },
        ],
      },
      {
        id: 'annoyed',
        caller: "All forty of them? At the same time? It's clearly your system.",
        options: [
          {
            text: "You're right, this is clearly bigger than individual PCs. Let me check for a known incident.",
            next: 'check',
            points: 5,
            mood: 1,
            feedback: 'Good correction.',
          },
        ],
      },
      {
        id: 'promise',
        caller: "(10 minutes later) It's been ten minutes since you said five. Still down. I told my team it'd be back!",
        options: [
          {
            text: "I apologise. I shouldn't have given a time I couldn't confirm. Let me check exactly what the Application team knows right now.",
            next: 'check',
            points: 3,
            mood: -1,
            feedback: 'Owning the mistake limits the damage.',
          },
        ],
      },
      {
        id: 'check',
        caller: "It's a white page that says 'Service Unavailable 503'. Everything else works.",
        options: [
          {
            text: "Thank you. There's an open major incident: the Application team is working on the order database. I've linked your team's report to it. I don't have a confirmed fix time yet, but I'll update you every 30 minutes, or sooner if anything changes.",
            next: 'workaround',
            points: 12,
            mood: 1,
            feedback: 'Honest, linked to the parent incident, and a clear update cadence.',
          },
          {
            text: "I'll raise a new ticket and someone will look at it.",
            next: 'workaround',
            points: -2,
            mood: -1,
            feedback: 'Duplicate tickets fragment information. Link to the existing incident.',
          },
        ],
      },
      {
        id: 'workaround',
        caller: 'OK... is there anything we can do in the meantime? Customers are waiting on the phone.',
        options: [
          {
            text: "Yes. The incident notes say orders can be taken on the offline order form and keyed in later. I'll email you the template right now.",
            next: 'close',
            points: 10,
            mood: 2,
            feedback: 'A workaround keeps the business running while the fix happens.',
          },
          {
            text: 'Not really, sorry. Just wait.',
            next: 'close',
            points: -3,
            mood: -1,
            feedback: 'Always check the incident for documented workarounds.',
          },
        ],
      },
      {
        id: 'close',
        caller: 'OK. Please keep me posted.',
        options: [
          {
            text: "Absolutely. You'll hear from me by 11:30 at the latest. Your reference is INC-20417.",
            next: 'end_great',
            points: 8,
            mood: 1,
            feedback: 'A specific time and a reference number build trust.',
          },
          {
            text: 'Will do.',
            next: 'end_ok',
            points: 2,
            mood: 0,
            feedback: 'Vague. Give a time and a reference.',
          },
        ],
      },
      { id: 'end_great', caller: 'Thank you, that helps.', ending: 'The system returned 50 minutes later. Lena praised the clear updates in the post-incident review.' },
      { id: 'end_ok', caller: 'Fine.', ending: 'The system came back, but Lena chased you twice for updates.' },
    ],
  },

  {
    id: 'call-reopened',
    title: 'Third call about the same problem',
    caller: 'Ravi Shah',
    role: 'Logistics Planner',
    summary: 'His Wi-Fi drops every day. Two tickets were closed with "restart it". He is out of patience.',
    difficulty: 2,
    skills: ['Ownership', 'Reading ticket history', 'Recovery'],
    startMood: 2,
    voice: { pitch: 0.95, rate: 1.05, prefer: 'male' },
    start: 'start',
    nodes: [
      {
        id: 'start',
        caller: "This is the THIRD time I'm calling about my Wi-Fi dropping. Every time someone tells me to restart and closes the ticket. I'm done explaining it again.",
        options: [
          {
            text: "I'm really sorry, Ravi. That's frustrating, and you shouldn't have to repeat yourself. I've got both previous tickets open in front of me, and I'll take ownership of this one.",
            next: 'own',
            points: 12,
            mood: 2,
            feedback: 'Apology, ownership, and you read the history before asking anything.',
          },
          {
            text: 'Can you explain the problem from the beginning?',
            next: 'repeat',
            points: -6,
            mood: -3,
            feedback: 'Asking him to repeat himself after three tickets is exactly what he is angry about.',
          },
          {
            text: 'Have you tried restarting?',
            next: 'furious',
            points: -12,
            mood: -4,
            feedback: 'The one sentence guaranteed to make this worse.',
          },
        ],
      },
      {
        id: 'furious',
        caller: "Are you SERIOUS? That's exactly what the last two people said!",
        options: [
          {
            text: "You're absolutely right, I apologise. I'm reading the previous tickets now and I'll own this through to the end.",
            next: 'own',
            points: 6,
            mood: 1,
            feedback: 'A sincere recovery.',
          },
          {
            text: "It's standard procedure, sir.",
            next: 'end_fail',
            points: -8,
            mood: -3,
            feedback: 'Hiding behind process ends the conversation badly.',
          },
        ],
      },
      {
        id: 'repeat',
        caller: 'Read the tickets! It drops every day around 2pm, only at my desk, only on my laptop.',
        options: [
          {
            text: "You're right, I'm sorry. I see it in the notes now. I'll take ownership from here.",
            next: 'own',
            points: 5,
            mood: 1,
            feedback: 'Recovered.',
          },
        ],
      },
      {
        id: 'own',
        caller: 'OK... thank you. So what happens now?',
        options: [
          {
            text: "The notes show the drops happen around the same time every day, only on your laptop. That points to the Wi-Fi adapter or its power settings, not something a restart fixes. I'm escalating to Tier 2 Desktop with all three tickets linked and asking them to check the adapter's power-saving and driver.",
            next: 'followup',
            points: 12,
            mood: 1,
            feedback: 'You spotted the pattern, explained the plan, and escalated with full context.',
          },
          {
            text: 'Let me close this one and open a fresh ticket.',
            next: 'followup',
            points: -8,
            mood: -2,
            feedback: 'Yet another ticket loses the history. Link and reopen instead.',
          },
        ],
      },
      {
        id: 'followup',
        caller: 'Will someone actually call me this time?',
        options: [
          {
            text: "Yes. I'm staying as the owner. Tier 2 will contact you today, and I'll call you tomorrow morning to make sure it's really fixed before anything gets closed.",
            next: 'end_great',
            points: 10,
            mood: 2,
            feedback: 'A follow-up commitment rebuilds trust.',
          },
          {
            text: 'They should do.',
            next: 'end_ok',
            points: -2,
            mood: -1,
            feedback: 'Vague answers are what got him here.',
          },
        ],
      },
      {
        id: 'end_great',
        caller: "OK. Thanks, that's all I wanted.",
        ending: "Tier 2 found the Wi-Fi adapter's power-saving mode was cutting the radio at a battery threshold. Fixed for good, and Ravi thanked you for following up.",
      },
      { id: 'end_ok', caller: 'We will see.', ending: 'Tier 2 fixed it, but Ravi rated the experience 2/5.' },
      { id: 'end_fail', caller: "I'm going to my director.", ending: 'Ravi escalated to his director. The complaint landed on your team lead\'s desk.' },
    ],
  },
];

export const CALL_BY_ID: Record<string, CallScenario> = Object.fromEntries(CALLS.map((c) => [c.id, c]));
