// ---------- Shared domain types ----------

export type Category = 'Accounts' | 'Network' | 'Hardware' | 'Software' | 'Email' | 'Security';

export const CATEGORIES: Category[] = ['Accounts', 'Network', 'Hardware', 'Software', 'Email', 'Security'];

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Difficulty = 1 | 2 | 3;
export type Channel = 'email' | 'portal' | 'phone' | 'chat';

export type Team =
  | 'Tier 2 Desktop'
  | 'Network Team'
  | 'Security Operations'
  | 'Application Support'
  | 'Field Services'
  | 'Identity & Access';

export const TEAMS: Team[] = [
  'Tier 2 Desktop',
  'Network Team',
  'Security Operations',
  'Application Support',
  'Field Services',
  'Identity & Access',
];

export type Outcome = 'resolve' | 'escalate' | 'pending';

export type ToolId = 'directory' | 'endpoint' | 'guide';

export interface CatalogAction {
  id: string;
  tool: ToolId;
  label: string;
  description: string;
  /** Requires the requester's identity to be verified first. */
  sensitive?: boolean;
  /** Default result shown when a scenario does not override it. */
  result: string;
}

export interface Requester {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  location: string;
  vip?: boolean;
}

export interface AccountState {
  username: string;
  status: 'Active' | 'Locked' | 'Disabled';
  passwordLastSet: string;
  passwordExpired: boolean;
  mfa: string;
  statusNote?: string;
  lastLogon: string;
  failedLogons: number;
  groups: string[];
  mailboxUsage?: string;
  archive?: string;
  activeSessions?: number;
}

export interface DeviceState {
  hostname: string;
  model: string;
  os: string;
  ip: string;
  gateway: string;
  dns: string;
  online: boolean;
  diskFree: string;
  uptime: string;
  lastPatch: string;
  installedNotes?: string[];
}

export interface Question {
  id: string;
  text: string;
  reply: string;
  /** Words used to match free-typed messages to this question. */
  keywords: string[];
  /** Facts this question uncovers (ids from scenario.facts). */
  reveals?: string[];
  /** Unprofessional / irrelevant questions cost communication points. */
  quality?: 'good' | 'neutral' | 'bad';
  /** Only available after these facts are known. */
  requires?: string[];
}

export interface TerminalOverride {
  /** Omit to keep the generated default output but still reveal facts. */
  output?: string;
  reveals?: string[];
  /** Output to use once a given action has been performed (e.g. after a fix). */
  whenDone?: { action: string; output: string };
}

export interface ActionOverride {
  result: string;
  reveals?: string[];
  deviceUpdate?: Partial<DeviceState>;
  accountUpdate?: Partial<AccountState>;
}

export interface Fact {
  id: string;
  label: string;
}

export interface RootCauseOption {
  id: string;
  label: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  priority: Priority;
  channel: Channel;
  /** Target handling time in real minutes. */
  targetMinutes: number;
  requester: Requester;
  description: string;
  account: AccountState;
  device: DeviceState;
  identity: { verifiable: boolean; reply: string };
  questions: Question[];
  facts: Fact[];
  /** Facts that matter for a solid investigation. */
  keyFacts: string[];
  terminal?: Record<string, TerminalOverride>;
  actionResults?: Record<string, ActionOverride>;
  /** Sign-in / audit log shown in the Directory tool. */
  signInLog?: { lines: string[]; reveals?: string[] };
  /** Facts revealed just by opening a tool panel. */
  toolReveals?: Partial<Record<'directory' | 'endpoint', string[]>>;
  /** Actions the ideal path performs. Use "a|b" when either action is acceptable. */
  requiredActions: string[];
  /** Reasonable but optional actions (no penalty). */
  helpfulActions?: string[];
  /** Actions that make things worse or break policy. */
  harmfulActions?: string[];
  rootCauses: RootCauseOption[];
  correctRootCause: string;
  correctOutcome: Outcome;
  escalateTo?: Team;
  noteKeywords: string[];
  replyKeywords: string[];
  kb: string[];
  solution: string[];
  debrief: string;
  /** Marks a scenario where verifying and refusing is the point. */
  socialEngineering?: boolean;
  custom?: boolean;
}

// ---------- Attempt / grading ----------

export interface ScoreItem {
  ok: boolean;
  text: string;
}

export interface ScoreSection {
  key: 'diagnosis' | 'resolution' | 'investigation' | 'process' | 'communication' | 'documentation' | 'time';
  label: string;
  score: number;
  max: number;
  items: ScoreItem[];
}

export interface TicketResult {
  total: number;
  grade: string;
  csat: number;
  sections: ScoreSection[];
  xp: number;
}

export interface TicketSubmission {
  rootCause: string;
  outcome: Outcome;
  team?: Team;
  note: string;
  reply: string;
}

export interface WorkLogEntry {
  at: number; // seconds since ticket opened
  kind: 'question' | 'action' | 'terminal' | 'kb' | 'hint' | 'system';
  text: string;
}

export interface TicketAttempt {
  id: string;
  scenarioId: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  mode: 'practice' | 'shift';
  completedAt: string;
  durationSec: number;
  result: TicketResult;
  submission: TicketSubmission;
  log: WorkLogEntry[];
  hintsUsed: number;
}

// ---------- Calls ----------

export interface CallOption {
  text: string;
  next: string;
  points: number;
  mood: number;
  feedback: string;
}

export interface CallNode {
  id: string;
  caller: string;
  options?: CallOption[];
  /** Ending summary when there are no options. */
  ending?: string;
}

export interface CallScenario {
  id: string;
  title: string;
  caller: string;
  role: string;
  summary: string;
  difficulty: Difficulty;
  skills: string[];
  startMood: number;
  voice: { pitch: number; rate: number; prefer?: 'female' | 'male' };
  start: string;
  nodes: CallNode[];
}

export interface CallAttempt {
  id: string;
  callId: string;
  title: string;
  completedAt: string;
  score: number;
  finalMood: number;
  transcript: { speaker: 'caller' | 'agent'; text: string; feedback?: string; points?: number }[];
}

// ---------- Interview ----------

export interface InterviewQuestion {
  id: string;
  category: 'Technical' | 'Troubleshooting' | 'Behavioral' | 'Customer Service' | 'Security';
  difficulty: Difficulty;
  question: string;
  keyPoints: { label: string; keywords: string[] }[];
  sampleAnswer: string;
  tip: string;
}

export interface InterviewAnswerResult {
  questionId: string;
  answer: string;
  matched: string[];
  missed: string[];
  score: number;
  seconds: number;
}

export interface InterviewAttempt {
  id: string;
  completedAt: string;
  score: number;
  answers: InterviewAnswerResult[];
}

// ---------- Knowledge base ----------

export interface KbArticle {
  id: string;
  title: string;
  category: Category | 'General';
  tags: string[];
  body: string;
}

// ---------- Shift ----------

export interface ShiftTicket {
  scenarioId: string;
  arrivedAt: number; // ms epoch
  status: 'waiting' | 'done';
  attemptId?: string;
  slaBreached?: boolean;
}

export interface ActiveShift {
  startedAt: number;
  durationMin: number;
  tickets: ShiftTicket[];
  /** scenario ids still to arrive, in order */
  pending: string[];
  nextArrivalAt: number;
}

export interface ShiftReport {
  id: string;
  completedAt: string;
  durationMin: number;
  handled: number;
  missed: number;
  breaches: number;
  avgScore: number;
  avgCsat: number;
}

// ---------- Persistent state ----------

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  voice: boolean;
  voiceRate: number;
  hints: boolean;
}

export interface AppState {
  version: 1;
  profile: { name: string; createdAt: string } | null;
  settings: Settings;
  tickets: TicketAttempt[];
  calls: CallAttempt[];
  interviews: InterviewAttempt[];
  shifts: ShiftReport[];
  badges: { id: string; earnedAt: string }[];
  kbRead: string[];
  customScenarios: Scenario[];
  activeShift: ActiveShift | null;
}
