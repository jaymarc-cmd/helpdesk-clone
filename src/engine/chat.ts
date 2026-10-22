import type { Scenario } from '../types';

/**
 * Small-talk understanding and the requester's voice. Pure and deterministic: the same transcript always
 * produces the same reply, so sessions replay identically and tests stay stable.
 */

export type Intent = 'greeting' | 'empathy' | 'hold' | 'thanks' | 'checkin' | 'closing' | 'remote' | 'restartRequest' | 'restartWarn' | 'update';

const PATTERNS: Record<Intent, RegExp> = {
  greeting: /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b|\b(my name is|this is \w+ (from|at|with) (the )?(it|service desk|support|help ?desk))\b/i,
  empathy:
    /\b(sorry|apolog|i understand|understandable|frustrat|that sounds|must be (annoying|stressful|frustrating)|i can imagine|no worries|happy to help|glad to help|i('| a)m here to help|i can help|we('ll| will) (get|sort)|thanks for (reaching|contacting|getting in touch|letting|your patience|waiting|bearing))/i,
  hold: /\b(one moment|a moment|a sec(ond)?|a minute|bear with me|let me (check|look|have a look|take a look|investigate|see)|please (wait|hold)|hang on|hold on|i('| wi)ll (check|look|investigate|have a look))\b/i,
  thanks: /^\s*(thanks|thank you|cheers|ty)\b/i,
  checkin: /\b(are you still there|still with me|you there\??|any luck|how('s| is) it (going|looking))\b/i,
  closing: /\b(anything else|is there anything|have a (great|good|nice|lovely) (day|one|afternoon|evening)|glad (i|we) could help|take care)\b/i,
  remote: /\b(remote(ly)? (session|access|in|into|desktop|connection|control|connect)|connect (to|into) your|take (control|a look at your (screen|laptop|pc|computer))|screen ?shar|remote into|log ?in(to)? your (pc|laptop|computer|machine))\b/i,
  restartRequest: /\b((can|could|would) you( please)?( try)? (restart|reboot|turn (it|your \w+) off and on)|please (restart|reboot)|try (restarting|rebooting)|restart (your|the) (pc|laptop|computer|machine|device))\b/i,
  restartWarn: /\b(i('| a)m going to|i('| wi)ll|going to|about to|need to) (restart|reboot)\b|\b(it|your (pc|laptop|computer|machine|device)) (will|is going to) (restart|reboot)\b/i,
  update: /\b(update|still (working|looking|checking) on|making progress|nearly there|almost (done|there)|found (the|a|what)|i('| ha)ve (found|fixed|changed|applied|unlocked|reset))\b/i,
};

export function intentsOf(text: string): Set<Intent> {
  const out = new Set<Intent>();
  for (const [k, re] of Object.entries(PATTERNS) as [Intent, RegExp][]) if (re.test(text)) out.add(k);
  return out;
}

export type Tone = 'calm' | 'stressed' | 'annoyed';

export function startingPatience(sc: Scenario): number {
  return { P1: 55, P2: 65, P3: 75, P4: 85 }[sc.priority] ?? 75;
}

export function toneFor(sc: Scenario, patience: number): Tone {
  if (patience < 35) return 'annoyed';
  return sc.priority === 'P1' || sc.priority === 'P2' ? 'stressed' : 'calm';
}

export function moodLabel(patience: number): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (patience >= 70) return { label: 'Calm', tone: 'success' };
  if (patience >= 40) return { label: 'Getting impatient', tone: 'warning' };
  return { label: 'Frustrated', tone: 'danger' };
}

/** Deterministic pick so a replayed session gets the same words. */
export function pick<T>(xs: T[], seed: number): T {
  return xs[Math.abs(seed) % xs.length];
}

type Lines = Record<Tone, string[]>;

const LINES: Record<string, Lines> = {
  greeting: {
    calm: ["Hi! Thanks for picking this up.", 'Hello, thanks for getting back to me so quickly.', 'Hi there, thanks for helping.'],
    stressed: ['Hi. Thanks, can we please sort this out quickly?', "Hi, I'm really glad someone's on this. It's urgent."],
    annoyed: ['Hi. Finally.', "Hello. I've been waiting a while."],
  },
  empathy: {
    calm: ['Thanks, I appreciate it.', "Thank you, that's reassuring.", 'No problem, thanks for helping.'],
    stressed: ["Thanks. I just really need this working.", 'I appreciate that. It has been a stressful morning.'],
    annoyed: ['Okay. I just want it fixed.', 'Fine. Can we get on with it?'],
  },
  hold: {
    calm: ['Sure, take your time.', "No problem, I'll wait.", 'Okay, I will be here.'],
    stressed: ['Okay, but please be quick.', "Alright. I'll wait, but I'm short on time."],
    annoyed: ['Again? Okay.', 'Fine. Please hurry.'],
  },
  thanks: {
    calm: ["You're welcome!", 'No problem.'],
    stressed: ['Sure.', 'Okay.'],
    annoyed: ['Mm-hm.', 'Okay.'],
  },
  checkin: {
    calm: ["Yes, I'm still here.", "I'm here!"],
    stressed: ["Yes, I'm here. Any progress?", 'Still here. Is it fixed?'],
    annoyed: ["Yes. I've been here the whole time.", "I'm here. Waiting."],
  },
  remote: {
    calm: ['Sure, go ahead. Do I need to do anything?', 'Yes, that is fine. Go ahead.'],
    stressed: ['Yes, please, whatever is quickest.', 'Go ahead.'],
    annoyed: ['If it gets this fixed, yes.', 'Fine, go ahead.'],
  },
  restartWarn: {
    calm: ['Okay, let me save my work first. Done, go ahead.', 'Sure, give me a second to save. Okay, ready.'],
    stressed: ["Okay, I'll save everything quickly. Go.", 'Fine, saving now. Go ahead.'],
    annoyed: ['Ugh, okay. Saved. Go.', 'Fine.'],
  },
  update: {
    calm: ['Great, thanks for the update!', 'Thanks for letting me know.'],
    stressed: ['Okay, thanks. How much longer?', 'Good to hear. Is it nearly done?'],
    annoyed: ['Okay.', 'Right.'],
  },
  question: {
    calm: ["I'm not sure, sorry. I'm not very technical. What should I look for?", "Hmm, I don't really know. Could you explain what you mean?"],
    stressed: ["I don't know! Can you just tell me what to check?", "I'm not sure, sorry. What do you need me to do?"],
    annoyed: ["I really don't know. Isn't that what you can check?", 'No idea.'],
  },
  statement: {
    calm: ['Okay.', 'Alright, thanks.', 'Okay, sounds good.'],
    stressed: ['Okay. What happens next?', 'Right. So what now?'],
    annoyed: ['Okay.', 'Sure.'],
  },
  closingFixed: {
    calm: ["No, that's everything. Thanks so much for your help!", "That's all, thank you! Have a good day."],
    stressed: ["That's all, thank you. You've saved my day.", 'No, all good now. Thanks!'],
    annoyed: ["No, that's it. Thanks.", "That's all."],
  },
  closingBroken: {
    calm: ["Well, it still isn't working on my side, though.", "Actually, I don't think it's fixed yet."],
    stressed: ["But it isn't fixed yet! I can't do my work.", "Wait, it's still not working."],
    annoyed: ["It's not fixed. Are you closing this already?", "Nothing's changed on my end."],
  },
};

export function line(key: keyof typeof LINES, tone: Tone, seed: number): string {
  return pick(LINES[key][tone], seed);
}

/** What the requester says when they have been left waiting, by how many times they have chased already. */
export function nudgeLine(sc: Scenario, nudges: number, tone: Tone): string {
  const first = [
    ['Hello? Are you still there?', 'Hi, just checking you are still with me?'],
    ['Any update on this? I really need it working.', 'Hello? Is anyone looking at this?'],
    [`I've been waiting quite a while now. Is someone actually working on this?`, 'This is taking a long time. Should I call instead?'],
  ][Math.min(nudges, 2)];
  const urgent = sc.priority === 'P1' || sc.priority === 'P2';
  const text = pick(first, nudges);
  return urgent && tone !== 'calm' && nudges === 0 ? `${text} This is urgent.` : text;
}

/** Seconds of silence before the requester chases. Longer when the analyst said they were checking something. */
export const NUDGE_AFTER_SEC = 90;
export const HOLD_GRACE_SEC = 180;
export const MAX_NUDGES = 3;
