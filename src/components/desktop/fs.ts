import type { AppProps } from './registry';

/** A pretend file system for the remote device, shaped by the ticket so the evidence is where a user would keep it. */
export interface FsItem {
  name: string;
  kind: 'folder' | 'file' | 'drive' | 'net';
  /** Folder or drive this item opens. */
  to?: string;
  type: string;
  size?: string;
  modified?: string;
  /** Text shown when the file opens in Notepad. */
  text?: string;
  /** Drive usage, for drives. */
  usage?: { free: number; total: number };
}

export interface FsFolder {
  title: string;
  parent?: string;
  items: FsItem[];
  /** Opening the folder fails with this message. */
  denied?: string;
}

export const SIDEBAR: { loc: string; label: string }[] = [
  { loc: 'home', label: 'Home' },
  { loc: 'desktop', label: 'Desktop' },
  { loc: 'documents', label: 'Documents' },
  { loc: 'downloads', label: 'Downloads' },
  { loc: 'pictures', label: 'Pictures' },
  { loc: 'pc', label: 'This PC' },
];

const folder = (name: string, to: string, modified = 'Today'): FsItem => ({ name, kind: 'folder', to, type: 'File folder', modified });
const file = (name: string, type: string, size: string, modified: string, text?: string): FsItem => ({ name, kind: 'file', type, size, modified, text });

export function mappedDrives(p: AppProps) {
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const netUse = sc.terminal?.['net use']?.output ?? '';
  const mapped = [...netUse.matchAll(/^(OK|Unavailable)\s+([A-Z]:)\s+(\S+)/gm)].map((x) => ({ status: x[1], letter: x[2], path: x[3] }));
  if (!mapped.some((x) => x.letter === 'H:')) mapped.push({ status: d.online ? 'OK' : 'Unavailable', letter: 'H:', path: `\\\\fs01\\home$\\${p.work.session.account.username}` });
  // A new group membership applies once the user signs in again.
  const refreshed = p.done('guide_restart') || p.done('remote_restart');
  return mapped.map((x) => ({ ...x, ok: x.status === 'OK' || refreshed }));
}

export function buildFs(p: AppProps): Record<string, FsFolder> {
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const user = p.work.session.account.username;
  const name = sc.accountOwner?.name ?? sc.requester.name;
  const m = d.diskFree.match(/([\d.]+)\s*GB of\s*([\d.]+)/i);
  const free = m ? parseFloat(m[1]) : 100;
  const total = m ? parseFloat(m[2]) : 238;
  const bigDownloads = sc.facts.some((f) => f.id === 'videos');
  const drives = mappedDrives(p);

  const fs: Record<string, FsFolder> = {
    home: {
      title: 'Home',
      items: [
        folder('Desktop', 'desktop'),
        folder('Documents', 'documents'),
        folder('Downloads', 'downloads'),
        folder('Pictures', 'pictures'),
        file('Meeting notes.txt', 'Text Document', '2 KB', 'Today 09:12', MEETING_NOTES),
        file('Team rota.xlsx', 'Excel Worksheet', '48 KB', 'Yesterday'),
      ],
    },
    desktop: {
      title: 'Desktop',
      parent: 'home',
      items: [file('Read me - IT help.txt', 'Text Document', '1 KB', '12 Jan', IT_README), file('Expenses.xlsx', 'Excel Worksheet', '36 KB', 'Last week')],
    },
    documents: {
      title: 'Documents',
      parent: 'home',
      items: [
        folder('Projects', 'projects', 'Last week'),
        file('Meeting notes.txt', 'Text Document', '2 KB', 'Today 09:12', MEETING_NOTES),
        file('To do.txt', 'Text Document', '1 KB', 'Yesterday', `- Book travel for the regional review\n- Send ${name.split(' ')[0]}'s team the updated rota\n- Ask IT about the issue on this ticket`),
        file('Quarterly review.pptx', 'PowerPoint Presentation', '6.4 MB', 'Last month'),
        file('Budget draft.xlsx', 'Excel Worksheet', '212 KB', 'Last month'),
      ],
    },
    projects: {
      title: 'Projects',
      parent: 'documents',
      items: [file('Plan.docx', 'Word Document', '88 KB', 'Last week'), file('Notes.txt', 'Text Document', '1 KB', 'Last week', 'Kick-off moved to Thursday. Bring the vendor shortlist.')],
    },
    downloads: {
      title: 'Downloads',
      parent: 'home',
      items: bigDownloads
        ? Array.from({ length: 63 }, (_, i) =>
            file(
              `Campaign_${String(i + 1).padStart(2, '0')}_export_final.mp4`,
              'MP4 Video',
              `${(1.25 + ((i * 37) % 60) / 100 + (i < 44 ? 0.01 : 0)).toFixed(2)} GB`,
              i < 5 ? 'This week' : i < 20 ? 'Last week' : 'Last month',
            ),
          )
        : [file('Approved software list.pdf', 'PDF Document', '340 KB', 'Last month'), file('Invoice 4471.pdf', 'PDF Document', '120 KB', 'Last week')],
    },
    pictures: {
      title: 'Pictures',
      parent: 'home',
      items: [file('Team offsite.png', 'PNG Image', '2.1 MB', 'Last month'), file('Floor plan.png', 'PNG Image', '860 KB', 'Last month')],
    },
    pc: {
      title: 'This PC',
      items: [
        { name: 'Local Disk (C:)', kind: 'drive', to: 'c', type: 'Local Disk', usage: { free, total } },
        ...drives.map(
          (x): FsItem => ({
            name: `${x.path.split('\\').filter(Boolean).slice(-1)[0]} (${x.letter})`,
            kind: 'net',
            to: `net:${x.letter}`,
            type: x.ok ? x.path : 'Disconnected network drive',
          }),
        ),
      ],
    },
    c: {
      title: 'Local Disk (C:)',
      parent: 'pc',
      items: [folder('Program Files', 'progfiles', '3 weeks ago'), folder('Users', 'home', 'Today'), folder('Windows', 'windows', d.lastPatch)],
    },
    progfiles: {
      title: 'Program Files',
      parent: 'c',
      items: (d.installedNotes ?? []).map((n) => {
        const app = n.split(':')[0].replace(/\s[\d.]+$/, '');
        return folder(app, `progfiles/${app}`, d.lastPatch);
      }),
    },
    windows: {
      title: 'Windows',
      parent: 'c',
      items: [],
      denied: "You don't currently have permission to access this folder. Ask your administrator for access.",
    },
  };

  for (const x of drives) {
    const share = x.path.split('\\').filter(Boolean).slice(-1)[0];
    fs[`net:${x.letter}`] = {
      title: `${share} (${x.letter})`,
      parent: 'pc',
      denied: x.ok ? undefined : `${x.path} is not accessible. You might not have permission to use this network resource. Access is denied.`,
      items:
        x.letter === 'H:'
          ? [folder('Archive', `net:${x.letter}/Archive`, 'Last year'), file(`${user} notes.txt`, 'Text Document', '3 KB', 'Last month', 'Personal drive. Backed up nightly.')]
          : [
              file(`README - ${share}.txt`, 'Text Document', '1 KB', 'Last month', `This share is managed by IT.\nAccess is granted through a security group, approved by the data owner.\nPath: ${x.path}`),
              file('Monthly report - September.xlsx', 'Excel Worksheet', '1.2 MB', 'Last week'),
              file('Monthly report - August.xlsx', 'Excel Worksheet', '1.1 MB', 'Last month'),
              folder('Archive', `net:${x.letter}/Archive`, 'Last year'),
            ],
    };
  }
  return fs;
}

/** A folder by location. Unknown sub-folders (e.g. "net:F:/Archive") open as empty folders. */
export function folderAt(fs: Record<string, FsFolder>, loc: string): FsFolder {
  if (fs[loc]) return fs[loc];
  const i = loc.lastIndexOf('/');
  return { title: loc.slice(i + 1), parent: i > 0 ? loc.slice(0, i) : 'home', items: [] };
}

/** Text of a file by its "folder/name" path, for Notepad. */
export function readFile(p: AppProps, path: string): { name: string; text: string } | undefined {
  const i = path.lastIndexOf('/');
  const f = buildFs(p)[path.slice(0, i)]?.items.find((x) => x.name === path.slice(i + 1));
  return f?.text !== undefined ? { name: f.name, text: f.text } : undefined;
}

const MEETING_NOTES = `Weekly sync
- Numbers for the regional review due Friday
- New starter joins on Monday: laptop and access requested
- Printer on this floor keeps jamming, raise with Facilities`;

const IT_README = `Harbor & Pine IT Service Desk

Portal:  it.hpl.example
Phone:   extension 4357 (HELP)

IT will never ask for your password or an MFA code.
If something looks wrong, report it before you click.`;
