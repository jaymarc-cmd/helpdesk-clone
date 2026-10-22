import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Ban,
  CircleCheck,
  History,
  KeyRound,
  Laptop,
  Lock,
  type LucideIcon,
  Mail,
  Minus,
  Plus,
  Search,
  SearchX,
  ShieldAlert,
  Ticket,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { ACTION_BY_ID, groupActionId } from '../data/actions';
import { ALL_GROUPS, PRIVILEGED_GROUPS, directoryPeople, type DirectoryPerson } from '../data/directory';
import { useStore } from '../state/store';
import { allAssets } from '../data/assets';
import type { AccountState, PastTicket, Scenario } from '../types';
import { EmptyState, PageHeader, initials } from '../components/ui';
import { ActingFor, ActionList, NoTicketNotice, SignInLog, type ActionItem } from '../components/work';
import '../styles/workspace.css';
import '../styles/workstation.css';

function StatusPill({ status }: { status: AccountState['status'] }) {
  const tone = status === 'Active' ? 'success' : 'danger';
  const Icon = status === 'Active' ? CircleCheck : status === 'Locked' ? Lock : Ban;
  return (
    <span className={`pill pill-${tone}`}>
      <Icon aria-hidden />
      {status}
    </span>
  );
}

export function DirectoryPage() {
  const { username } = useParams();
  return username ? <PersonPage key={username} username={username} /> : <PeopleList />;
}

function usePeople(): DirectoryPerson[] {
  const { scenarios, works } = useStore();
  return useMemo(() => {
    const people = directoryPeople(scenarios);
    // Accounts on your open tickets show their live state.
    return people.map((p) => {
      const w = works.find((x) => x.scenario.account.username === p.username);
      return w ? { ...p, account: w.session.account } : p;
    });
  }, [scenarios, works]);
}

function PeopleList() {
  const people = usePeople();
  const { works } = useStore();
  const [q, setQ] = useState('');
  const list = people.filter((p) => !q || `${p.name} ${p.username} ${p.department} ${p.title}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page ws-root wk-app">
      <PageHeader
        title="Directory"
        description="User accounts, sign-in security, group memberships and mailboxes for everyone at Harbor & Pine."
      />
      <section className="card">
        <div className="search wk-search">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Search by name, username or department…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the directory" autoFocus />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={SearchX} title="No one matches that search">
            Check the spelling, or search by username (first.last).
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table wk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th className="wk-hide-sm">Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.username}>
                    <td>
                      <Link to={`/directory/${p.username}`} className="wk-person">
                        <span className="avatar wk-avatar-xs" aria-hidden>
                          {initials(p.name)}
                        </span>
                        <span>
                          <span className="wk-person-name">{p.name}</span>
                          <span className="wk-person-title">{p.title}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="mono small">
                      {p.username}
                      {works.some((w) => w.scenario.account.username === p.username) && <span className="pill pill-info wk-inline-pill">Your ticket</span>}
                    </td>
                    <td className="wk-hide-sm">{p.department}</td>
                    <td>
                      <StatusPill status={p.account.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type Tab = 'overview' | 'auth' | 'groups' | 'mailbox' | 'devices' | 'tickets' | 'signin';
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'auth', label: 'Authentication', icon: KeyRound },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'mailbox', label: 'Mailbox', icon: Mail },
  { id: 'devices', label: 'Devices', icon: Laptop },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'signin', label: 'Sign-in log', icon: History },
];

const AUTH_ACTIONS = ['unlock_account', 'reset_password', 'enable_account', 'disable_account', 'reset_mfa', 'revoke_sessions'];
const MAILBOX_ACTIONS = ['enable_archive', 'raise_quota', 'grant_mailbox_access'];
const DEVICE_ACTIONS = ['view_bitlocker_key', 'mdm_wipe_device'];

/** Earlier tickets for a person: the scenario's own history, or a plausible quiet record. */
function pastTickets(person: DirectoryPerson, scenarios: Scenario[]): PastTicket[] {
  const sc = scenarios.find((x) => x.account.username === person.username && x.history?.length);
  if (sc) return sc.history!;
  const h = Math.abs([...person.username].reduce((n, c) => (n * 31 + c.charCodeAt(0)) | 0, 3));
  const pool: PastTicket[] = [
    { ticket: `INC-${40000 + (h % 9000)}`, daysAgo: 20 + (h % 40), title: 'Outlook search not returning results', resolution: 'Rebuilt the search index. Confirmed with the user.' },
    { ticket: `INC-${30000 + (h % 9000)}`, daysAgo: 90 + (h % 60), title: 'New monitor setup', resolution: 'Delivered and connected a 27" monitor.' },
    { ticket: `INC-${20000 + (h % 9000)}`, daysAgo: 150 + (h % 90), title: 'Password reset', resolution: 'Reset after identity verification.' },
  ];
  return pool.slice(0, h % 3);
}

function catalogItems(ids: string[]): ActionItem[] {
  return ids
    .map((id) => ACTION_BY_ID[id])
    .filter(Boolean)
    .map((a) => ({ id: a.id, label: a.label, description: a.description, sensitive: a.sensitive, destructive: a.id === 'revoke_sessions' }));
}

function PersonPage({ username }: { username: string }) {
  const people = usePeople();
  const { works, work: focused } = useStore();
  // Act for whichever open ticket this account belongs to.
  const work = works.find((w) => w.scenario.account.username === username) ?? focused;
  const [tab, setTab] = useState<Tab>('overview');
  const person = people.find((p) => p.username === username);
  const editable = !!work && work.scenario.account.username === username;
  const s = editable ? work.session : null;
  const { scenarios } = useStore();
  const devices = useMemo(() => (person ? allAssets(scenarios).filter((a) => a.assignedTo === person.name) : []), [person, scenarios]);
  const past = useMemo(() => (person ? pastTickets(person, scenarios) : []), [person, scenarios]);
  // Reading someone's ticket history is evidence on their ticket.
  useEffect(() => {
    if (tab === 'tickets' && editable) work.emit({ type: 'openTool', tool: 'history' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editable]);

  useEffect(() => {
    if (editable) work.emit({ type: 'openTool', tool: 'directory' });
    // Opening the record once is what counts; later renders must not re-send it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  if (!person) {
    return (
      <div className="page ws-root wk-app">
        <PageHeader back={{ to: '/directory', label: 'Directory' }} title="User not found" />
        <div className="card">
          <EmptyState icon={SearchX} title={`No account called ${username}`}>
            <Link className="btn btn-sm" to="/directory">
              Search the directory
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  const a = person.account;
  const run = (id: string) => work?.emit({ type: 'action', actionId: id });

  return (
    <div className="page ws-root wk-app">
      <PageHeader
        back={{ to: '/directory', label: 'Directory' }}
        title={person.name}
        meta={
          <>
            <span className="mono meta-id">{person.username}</span>
            <StatusPill status={a.status} />
            <span className="pill">{person.department}</span>
            <span className="inline-icon">{person.title}</span>
            {editable && <span className="pill pill-info">Your open ticket</span>}
          </>
        }
      />

      {editable ? (
        <ActingFor work={work} what={`account ${person.username}`} />
      ) : (
        <NoTicketNotice>
          <strong>Read-only.</strong>{' '}
          {work ? (
            <>
              Your open ticket is for <Link to={`/directory/${work.scenario.account.username}`}>{work.scenario.account.username}</Link>. Changes to other
              accounts need their own ticket.
            </>
          ) : (
            <>
              Account changes are recorded against a ticket. Assign yourself one in the <Link to="/tickets">ticket queue</Link> first.
            </>
          )}
        </NoTicketNotice>
      )}

      <section className="card wk-tabs-card">
        <div className="tabs" role="tablist" aria-label="Account sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="wk-tab-body">
          {tab === 'overview' && (
            <div className="stack">
              {a.statusNote && (
                <div className="callout warning small">
                  <TriangleAlert size={16} aria-hidden />
                  <div className="callout-body">{a.statusNote}</div>
                </div>
              )}
              <dl className="kv wk-kv">
                <dt>Username</dt>
                <dd className="mono">{a.username}</dd>
                <dt>Email</dt>
                <dd>{person.email}</dd>
                <dt>Location</dt>
                <dd>{person.location}</dd>
                <dt>Phone</dt>
                <dd className="num">{person.phone}</dd>
                <dt>Status</dt>
                <dd>
                  <StatusPill status={a.status} />
                </dd>
                <dt>Last sign-in</dt>
                <dd>{a.lastLogon}</dd>
                <dt>Active sessions</dt>
                <dd className="num">{a.activeSessions ?? 0}</dd>
              </dl>
            </div>
          )}

          {tab === 'auth' && (
            <div className="stack">
              <dl className="kv wk-kv">
                <dt>Password set</dt>
                <dd>
                  {a.passwordLastSet} {a.passwordExpired && <span className="pill pill-danger">Expired</span>}
                </dd>
                <dt>Lockout</dt>
                <dd>{a.status === 'Locked' ? <span className="pill pill-danger">Locked out</span> : 'Not locked'}</dd>
                <dt>Failed sign-ins</dt>
                <dd>{a.failedLogons > 0 ? <span className="pill pill-warning">{a.failedLogons}</span> : <span className="num">0</span>}</dd>
                <dt>MFA</dt>
                <dd>{a.mfa}</dd>
              </dl>
              <ActionList items={catalogItems(AUTH_ACTIONS)} session={s} onRun={run} disabled={!editable} />
            </div>
          )}

          {tab === 'groups' && <GroupsTab account={a} editable={editable} onRun={run} results={s?.actionResults ?? []} />}

          {tab === 'mailbox' && (
            <div className="stack">
              <dl className="kv wk-kv">
                <dt>Mailbox</dt>
                <dd>{person.email}</dd>
                <dt>Usage</dt>
                <dd>{a.mailboxUsage ?? '–'}</dd>
                <dt>Online archive</dt>
                <dd>{a.archive ?? '–'}</dd>
              </dl>
              <ActionList items={catalogItems(MAILBOX_ACTIONS)} session={s} onRun={run} disabled={!editable} />
            </div>
          )}

          {tab === 'devices' && (
            <div className="stack">
              {devices.length === 0 ? (
                <p className="ws-empty-hint">No managed devices are assigned to {person.name}.</p>
              ) : (
                <ul className="wk-device-list">
                  {devices.map((d) => (
                    <li key={d.tag}>
                      <span className="mono">{d.tag}</span>
                      <span>
                        {d.type} · {d.model}
                        {d.hostname && (
                          <>
                            {' · '}
                            <Link to={`/devices/${d.hostname}`} className="mono">
                              {d.hostname}
                            </Link>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ActionList items={catalogItems(DEVICE_ACTIONS)} session={s} onRun={run} disabled={!editable} />
            </div>
          )}

          {tab === 'tickets' && (
            <div className="stack">
              {past.length === 0 ? (
                <p className="ws-empty-hint">No earlier tickets from {person.name}.</p>
              ) : (
                <ol className="wk-history">
                  {past.map((t) => (
                    <li key={t.ticket}>
                      <span className="wk-history-head">
                        <span className="mono">{t.ticket}</span> <strong>{t.title}</strong>
                        <span className="muted"> · {t.daysAgo === 1 ? 'yesterday' : `${t.daysAgo} days ago`}</span>
                      </span>
                      <span className="small muted">{t.resolution}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === 'signin' && (
            <div className="stack">
              {!editable ? (
                <p className="ws-empty-hint">Sign-in logs open from the account your ticket is about.</p>
              ) : !s?.signInLogViewed ? (
                <div className="row">
                  <button className="btn" onClick={() => work.emit({ type: 'viewSignInLog' })}>
                    <History size={16} aria-hidden />
                    Load the last 24 hours
                  </button>
                  <span className="muted small">Loading the log is recorded on the ticket.</span>
                </div>
              ) : (
                <SignInLog
                  lines={
                    work.scenario.signInLog?.lines ?? [`${a.lastLogon}  SUCCESS  Windows sign-in  ${work.session.device.hostname}`, 'No failures in the last 24 hours.']
                  }
                />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function GroupsTab({
  account,
  editable,
  onRun,
  results,
}: {
  account: AccountState;
  editable: boolean;
  onRun: (id: string) => void;
  results: { id: string; text: string }[];
}) {
  const [pick, setPick] = useState('');
  const available = ALL_GROUPS.filter((g) => !account.groups.includes(g));
  const last = results.filter((r) => r.id.startsWith('grp')).slice(-1)[0];
  return (
    <div className="stack">
      <ul className="wk-groups">
        {account.groups.map((g) => (
          <li key={g}>
            <Users size={14} aria-hidden />
            <span className="wk-group-name">{g}</span>
            {PRIVILEGED_GROUPS.includes(g) && (
              <span className="pill pill-warning">
                <ShieldAlert aria-hidden />
                Privileged
              </span>
            )}
            {editable && (
              <button className="btn btn-ghost btn-sm" onClick={() => onRun(groupActionId('remove', g))} aria-label={`Remove from ${g}`}>
                <Minus size={14} aria-hidden />
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form
          className="wk-add-group"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pick) return;
            onRun(groupActionId('add', pick));
            setPick('');
          }}
        >
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Group to add">
            <option value="">Add to a group…</option>
            {available.map((g) => (
              <option key={g} value={g}>
                {g}
                {PRIVILEGED_GROUPS.includes(g) ? ' (privileged)' : ''}
              </option>
            ))}
          </select>
          <button className="btn" disabled={!pick}>
            <Plus size={16} aria-hidden />
            Add
          </button>
        </form>
      )}
      {last && (
        <div className="result-item" role="status">
          {last.text}
        </div>
      )}
    </div>
  );
}
