import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Cog, Cpu, FileText, Gauge, HardDrive, MemoryStick, Network, Rocket, Save, Search, type LucideIcon } from 'lucide-react';
import { APP_BY_ID, type AppId, type AppProps } from './registry';
import { readFile } from './fs';
import { Graph, Switch, WinDialog } from './shell';

// ---------------- Task Manager ----------------

interface Proc {
  key: string;
  name: string;
  icon: LucideIcon;
  group: 'Apps' | 'Background processes' | 'Windows processes';
  cpu: number;
  mem: number;
  disk: number;
  net: number;
  status?: string;
  window?: AppId;
}

type SortKey = 'name' | 'cpu' | 'mem' | 'disk' | 'net';
type Tab = 'processes' | 'performance' | 'startup';

const MEMORY_MB = 16384;
const BASE_MEMORY_MB = 4300;

/** Stable pseudo-random jitter per process and tick, so values move like a live system. */
function jitter(key: string, tick: number) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  const x = Math.sin(h + tick * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const STARTUP = [
  { name: 'OneDrive', publisher: 'Harbor & Pine (managed)', impact: 'High' },
  { name: 'Teams', publisher: 'Harbor & Pine (managed)', impact: 'High' },
  { name: 'VPN Client', publisher: 'Harbor & Pine (managed)', impact: 'Medium' },
  { name: 'Audio helper', publisher: 'Device manufacturer', impact: 'Low' },
  { name: 'Dock utility', publisher: 'Device manufacturer', impact: 'Low' },
];

export function TaskManagerApp(p: AppProps) {
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const [tab, setTab] = useState<Tab>('processes');
  const [tick, setTick] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'cpu', desc: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [ended, setEnded] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [resource, setResource] = useState<'cpu' | 'mem' | 'disk' | 'net'>('cpu');
  const [history, setHistory] = useState<Record<'cpu' | 'mem' | 'disk' | 'net', number[]>>({ cpu: [], mem: [], disk: [], net: [] });
  const [startup, setStartup] = useState<Record<string, boolean>>({});
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);

  const pending = (id: string) => sc.requiredActions.some((r) => r.split('|').includes(id)) && !p.done(id);
  const slowDisk = pending('disk_cleanup');
  const excelHung = pending('disable_addin');
  const scareware = pending('guide_close_browser');

  const procs = useMemo(() => {
    const j = (k: string) => jitter(k, tick);
    const list: Proc[] = [];
    for (const app of p.running) {
      const def = APP_BY_ID[app];
      list.push({
        key: `app:${app}`,
        name: def.title,
        icon: def.icon,
        group: 'Apps',
        window: app,
        cpu: (app === 'browser' && scareware ? 28 : 0.4) + j(app) * 2.5,
        mem: (app === 'browser' ? (scareware ? 940 : 420) : 60) + j(app + 'm') * 40,
        disk: j(app + 'd') < 0.7 ? 0 : j(app + 'd') * 0.4,
        net: app === 'browser' && d.online ? j(app + 'n') * 0.6 : 0,
      });
    }
    if (excelHung) list.push({ key: 'excel', name: 'Excel', icon: FileText, group: 'Apps', status: 'Not responding', cpu: 24 + j('x') * 6, mem: 610, disk: 0.1, net: 0 });
    if (slowDisk) list.push({ key: 'outlook', name: 'Outlook', icon: FileText, group: 'Apps', status: 'Not responding', cpu: 3 + j('o') * 3, mem: 380, disk: 2.4 + j('od') * 3, net: 0 });

    const bg: [string, number, number, number][] = [
      ['Antimalware Service Executable', 0.8, 182, slowDisk ? 14 : 0.2],
      ['OneDrive', 0.3, 64, 0.1],
      ['Teams', 1.1, 336, 0.1],
      ['VPN Client service', 0.1, 18, 0],
      ['Search Indexer', 0.2, 31, slowDisk ? 6 : 0.1],
      ['Print Spooler', 0, 9, 0],
    ];
    for (const [name, cpu, mem, disk] of bg)
      list.push({ key: name, name, icon: Cog, group: 'Background processes', cpu: cpu * (0.5 + j(name)), mem: mem + j(name + 'm') * 8, disk: disk * (0.6 + j(name + 'd') * 0.8), net: name === 'OneDrive' && d.online ? j(name) * 0.3 : 0 });
    const sys: [string, number, number][] = [
      ['System', 0.6, 4],
      ['Desktop Window Manager', 1.2, 88],
      ['Windows Explorer', 0.4, 120],
      ['Remote Desktop Services', 2.1, 26],
      ['Windows Logon Application', 0, 6],
    ];
    for (const [name, cpu, mem] of sys)
      list.push({ key: name, name, icon: Cog, group: 'Windows processes', cpu: cpu * (0.5 + j(name)), mem: mem + j(name + 'm') * 4, disk: 0, net: name === 'Remote Desktop Services' ? 0.2 + j(name) * 0.3 : 0 });
    return list.filter((x) => !ended.includes(x.key));
  }, [tick, p.running, ended, excelHung, slowDisk, scareware, d.online]);

  const totals = useMemo(() => {
    const sum = (k: 'cpu' | 'mem' | 'disk' | 'net') => procs.reduce((a, x) => a + x[k], 0);
    return {
      cpu: Math.min(100, sum('cpu')),
      mem: Math.min(100, ((BASE_MEMORY_MB + sum('mem')) / MEMORY_MB) * 100),
      disk: Math.min(100, slowDisk ? 92 + jitter('disk', tick) * 8 : sum('disk') * 4),
      net: sum('net'),
    };
  }, [procs, slowDisk, tick]);

  useEffect(() => {
    setHistory((h) => ({
      cpu: [...h.cpu, totals.cpu].slice(-40),
      mem: [...h.mem, totals.mem].slice(-40),
      disk: [...h.disk, totals.disk].slice(-40),
      net: [...h.net, totals.net].slice(-40),
    }));
  }, [totals]);

  const end = (x: Proc) => {
    if (x.group === 'Windows processes') {
      setBlocked(x.name);
      return;
    }
    if (x.window) p.closeApp(x.window);
    else setEnded((e) => [...e, x.key]);
    setSelected(null);
  };

  const sorted = (group: Proc['group']) =>
    procs
      .filter((x) => x.group === group && (!q || x.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => {
        const v = sort.key === 'name' ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key];
        return sort.desc ? -v : v;
      });

  const sel = procs.find((x) => x.key === selected);
  const col = (key: SortKey, label: string, value?: string) => (
    <button
      className={`dt-tm-col ${sort.key === key ? 'on' : ''}`}
      onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }))}
      aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}
    >
      {value && <strong className="num">{value}</strong>}
      <span>
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={11} aria-hidden /> : <ArrowUp size={11} aria-hidden />)}
      </span>
    </button>
  );

  const RES: { id: 'cpu' | 'mem' | 'disk' | 'net'; label: string; icon: LucideIcon; value: string; sub: string; max: number }[] = [
    { id: 'cpu', label: 'CPU', icon: Cpu, value: `${Math.round(totals.cpu)}%`, sub: '4 cores · 2.4 GHz', max: 100 },
    {
      id: 'mem',
      label: 'Memory',
      icon: MemoryStick,
      value: `${((totals.mem / 100) * 16).toFixed(1)}/16 GB`,
      sub: `${Math.round(totals.mem)}% in use`,
      max: 100,
    },
    { id: 'disk', label: 'Disk 0 (C:)', icon: HardDrive, value: `${Math.round(totals.disk)}%`, sub: `${d.diskFree} free`, max: 100 },
    {
      id: 'net',
      label: d.ip.startsWith('10.') ? 'Ethernet' : 'Wi-Fi',
      icon: Network,
      value: d.online ? `${(totals.net * 8).toFixed(1)} Mbps` : 'Not connected',
      sub: d.online ? `IPv4 ${d.ip}` : 'No network',
      max: 10,
    },
  ];
  const r = RES.find((x) => x.id === resource)!;

  return (
    <div className="dt-app split dt-tm">
      <nav className="dt-side">
        {(
          [
            ['processes', 'Processes', Gauge],
            ['performance', 'Performance', Cpu],
            ['startup', 'Startup apps', Rocket],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={14} aria-hidden /> {label}
          </button>
        ))}
      </nav>

      {tab === 'processes' && (
        <div className="dt-main dt-tm-main">
          <div className="dt-tm-bar">
            <span className="dt-search">
              <Search size={13} aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search processes" aria-label="Search processes" />
            </span>
            <button className="dt-btn" disabled={!sel || sel.group === 'Windows processes'} onClick={() => sel && end(sel)}>
              End task
            </button>
          </div>
          <div className="dt-tm-table" role="table" aria-label="Processes">
            <div className="dt-tm-head" role="row">
              {col('name', 'Name')}
              <span className="dt-tm-status">Status</span>
              {col('cpu', 'CPU', `${Math.round(totals.cpu)}%`)}
              {col('mem', 'Memory', `${Math.round(totals.mem)}%`)}
              {col('disk', 'Disk', `${Math.round(totals.disk)}%`)}
              {col('net', 'Network', `${Math.round((totals.net * 80) / 10)}%`)}
            </div>
            {(['Apps', 'Background processes', 'Windows processes'] as const).map((g) => {
              const rows = sorted(g);
              if (!rows.length) return null;
              return (
                <div key={g} role="rowgroup">
                  <div className="dt-tm-group">
                    {g} ({rows.length})
                  </div>
                  {rows.map((x) => (
                    <div
                      key={x.key}
                      role="row"
                      tabIndex={0}
                      className={`dt-tm-row ${selected === x.key ? 'sel' : ''} ${x.status ? 'hung' : ''}`}
                      onClick={() => setSelected(x.key)}
                      onDoubleClick={() => x.window && p.open(x.window)}
                      onKeyDown={(e) => {
                        if (e.key === 'Delete') end(x);
                        if (e.key === 'Enter') setSelected(x.key);
                      }}
                    >
                      <span className="dt-tm-name">
                        <x.icon size={14} aria-hidden />
                        {x.name}
                      </span>
                      <span className="dt-tm-status">{x.status ?? ''}</span>
                      <span className={`num heat-${Math.min(4, Math.floor(x.cpu / 6))}`}>{x.cpu.toFixed(1)}%</span>
                      <span className="num">{Math.round(x.mem)} MB</span>
                      <span className={`num heat-${Math.min(4, Math.floor(x.disk / 3))}`}>{x.disk.toFixed(1)} MB/s</span>
                      <span className="num">{x.net.toFixed(1)} Mbps</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {sel?.status && (
            <p className="dt-row-sub dt-tm-hint">
              {sel.name} is not responding. Ending it closes the app, but anything unsaved is lost and the cause is still there.
            </p>
          )}
        </div>
      )}

      {tab === 'performance' && (
        <div className="dt-tm-perf">
          <div className="dt-tm-res">
            {RES.map((x) => (
              <button key={x.id} className={resource === x.id ? 'on' : ''} onClick={() => setResource(x.id)}>
                <span className="dt-tm-mini">
                  <Graph data={history[x.id]} max={x.max} />
                </span>
                <span>
                  <strong>{x.label}</strong>
                  <span className="dt-row-sub">{x.value}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="dt-main">
            <div className="dt-tm-perf-head">
              <h3>
                <r.icon size={18} aria-hidden /> {r.label}
              </h3>
              <span className="dt-row-sub">{r.sub}</span>
            </div>
            <div className="dt-tm-big">
              <Graph data={history[r.id]} max={r.max} />
            </div>
            <dl className="dt-kv">
              <dt>{r.id === 'net' ? 'Throughput' : r.id === 'disk' ? 'Active time' : 'Utilisation'}</dt>
              <dd className="num">{r.value}</dd>
              <dt>Up time</dt>
              <dd>{d.uptime}</dd>
              <dt>Processes</dt>
              <dd className="num">{procs.length + 112}</dd>
              {r.id === 'disk' && (
                <>
                  <dt>Capacity</dt>
                  <dd>{d.diskFree}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}

      {tab === 'startup' && (
        <div className="dt-main">
          <h3 className="dt-h">Apps that start when {sc.accountOwner?.name ?? sc.requester.name} signs in</h3>
          {STARTUP.map((s) => {
            const on = startup[s.name] ?? true;
            return (
              <div key={s.name} className="dt-row">
                <Rocket size={16} className="dt-row-icon" aria-hidden />
                <div className="dt-row-text">
                  <div className="dt-row-title">{s.name}</div>
                  <div className="dt-row-sub">
                    {s.publisher} · Startup impact: {on ? s.impact : 'Not measured'}
                  </div>
                </div>
                <Switch on={on} onChange={(v) => setStartup((m) => ({ ...m, [s.name]: v }))} label={`Start ${s.name} at sign-in`} />
              </div>
            );
          })}
        </div>
      )}

      {blocked && (
        <WinDialog
          icon={Cog}
          tone="warn"
          title={`End ${blocked}?`}
          onClose={() => setBlocked(null)}
          actions={
            <button className="dt-btn primary" onClick={() => setBlocked(null)}>
              Cancel
            </button>
          }
        >
          This is a Windows process. Ending it would make the device unstable or close this remote session, so it's blocked here.
        </WinDialog>
      )}
    </div>
  );
}

// ---------------- Notepad ----------------

export function NotepadApp(p: AppProps) {
  const file = p.arg ? readFile(p, p.arg) : undefined;
  const [text, setText] = useState(file?.text ?? '');
  const [saved, setSaved] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [caret, setCaret] = useState({ ln: 1, col: 1 });
  const ref = useRef<HTMLTextAreaElement>(null);
  const name = file?.name ?? 'Untitled';

  const track = () => {
    const el = ref.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const lines = before.split('\n');
    setCaret({ ln: lines.length, col: lines[lines.length - 1].length + 1 });
  };
  const edit = (v: string) => {
    setText(v);
    setSaved(false);
  };
  const insertDate = () => {
    const el = ref.current;
    if (!el) return;
    const stamp = new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'numeric', day: 'numeric', year: 'numeric' });
    const s = el.selectionStart;
    edit(text.slice(0, s) + stamp + text.slice(el.selectionEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + stamp.length, s + stamp.length);
      track();
    });
  };

  return (
    <div className="dt-app col dt-notepad">
      <div className="dt-np-bar">
        <span className="dt-np-file">
          <FileText size={13} aria-hidden />
          {saved ? name : `${name} •`}
        </span>
        <button
          onClick={() => {
            setText('');
            setSaved(true);
          }}
        >
          New
        </button>
        <button onClick={() => setSaved(true)} disabled={saved}>
          <Save size={12} aria-hidden /> Save
        </button>
        <button onClick={insertDate}>Time/Date</button>
        <button className={wrap ? 'on' : ''} aria-pressed={wrap} onClick={() => setWrap((w) => !w)}>
          Word wrap
        </button>
      </div>
      <textarea
        ref={ref}
        className="dt-np-text"
        value={text}
        spellCheck={false}
        wrap={wrap ? 'soft' : 'off'}
        onChange={(e) => edit(e.target.value)}
        onKeyUp={track}
        onClick={track}
        onKeyDown={(e) => {
          if (e.key === 'F5') {
            e.preventDefault();
            insertDate();
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            setSaved(true);
          }
        }}
        aria-label={`${name} contents`}
      />
      <div className="dt-np-status">
        <span className="num">
          Ln {caret.ln}, Col {caret.col}
        </span>
        <span className="num">{text.length} characters</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
}
