import {
  Activity,
  Folder,
  Globe,
  Mail,
  NotebookPen,
  Printer,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShieldHalf,
  SquareTerminal,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { Work } from '../../state/store';
import type { DesktopPrefs, SetPref } from './shell';

export type AppId =
  | 'explorer'
  | 'browser'
  | 'vpn'
  | 'mail'
  | 'updates'
  | 'printers'
  | 'security'
  | 'terminal'
  | 'settings'
  | 'trash'
  | 'taskmgr'
  | 'notepad';

export interface AppDef {
  id: AppId;
  title: string;
  icon: LucideIcon;
  tone: string;
  width: number;
  height: number;
  /** Words the Start menu search also matches. */
  keywords?: string;
  /** Shown as a desktop shortcut. */
  desktop?: boolean;
}

export const APPS: AppDef[] = [
  { id: 'explorer', title: 'File Explorer', icon: Folder, tone: 'amber', width: 680, height: 420, keywords: 'files folders drives documents downloads', desktop: true },
  { id: 'browser', title: 'Web Browser', icon: Globe, tone: 'teal', width: 740, height: 470, keywords: 'internet intranet web', desktop: true },
  { id: 'mail', title: 'Mail', icon: Mail, tone: 'sky', width: 760, height: 450, keywords: 'outlook email inbox', desktop: true },
  { id: 'vpn', title: 'VPN Client', icon: ShieldHalf, tone: 'indigo', width: 440, height: 400, keywords: 'remote access', desktop: true },
  { id: 'updates', title: 'Software Updates', icon: RefreshCw, tone: 'coral', width: 580, height: 460, keywords: 'install software center patch', desktop: true },
  { id: 'printers', title: 'Printers', icon: Printer, tone: 'slate', width: 580, height: 420, keywords: 'print queue spooler', desktop: true },
  { id: 'security', title: 'Security', icon: ShieldCheck, tone: 'green', width: 480, height: 400, keywords: 'antivirus scan defender', desktop: true },
  { id: 'terminal', title: 'PowerShell', icon: SquareTerminal, tone: 'ink', width: 700, height: 460, keywords: 'terminal command prompt cmd', desktop: true },
  { id: 'settings', title: 'Settings', icon: Settings, tone: 'graphite', width: 760, height: 500, keywords: 'control panel', desktop: true },
  { id: 'taskmgr', title: 'Task Manager', icon: Activity, tone: 'teal', width: 720, height: 470, keywords: 'processes performance cpu memory startup' },
  { id: 'notepad', title: 'Notepad', icon: NotebookPen, tone: 'sky', width: 560, height: 400, keywords: 'text editor notes', desktop: true },
  { id: 'trash', title: 'Recycle Bin', icon: Trash2, tone: 'glass', width: 520, height: 340, keywords: 'deleted', desktop: true },
];
export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;

/** Props every desktop app receives. `run` performs a ticket action; the desktop pops a notification. */
export interface AppProps {
  work: Work;
  run: (actionId: string) => void;
  /** Latest result text for an action, if it was performed. */
  result: (actionId: string) => string | undefined;
  done: (actionId: string) => boolean;
  open: (app: AppId, arg?: string) => void;
  closeApp: (app: AppId) => void;
  running: AppId[];
  /** What the window was opened with: a folder, file, URL or settings page. */
  arg?: string;
  /** Changes every time the window is opened with an argument, even the same one. */
  argSeq: number;
  prefs: DesktopPrefs;
  setPref: SetPref;
}
