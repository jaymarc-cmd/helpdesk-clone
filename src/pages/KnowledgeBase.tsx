import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KB_ARTICLES, KB_BY_ID } from '../data/kb';
import { useStore } from '../state/store';
import { Markdown } from '../components/ui';

const CATS = ['All', 'General', 'Accounts', 'Network', 'Hardware', 'Software', 'Email', 'Security'] as const;

export function KnowledgeBase() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const article = id ? KB_BY_ID[id] : undefined;

  useEffect(() => {
    if (article) dispatch({ type: 'kbRead', id: article.id });
  }, [article, dispatch]);

  const list = KB_ARTICLES.filter(
    (a) =>
      (cat === 'All' || a.category === cat) &&
      (!q || `${a.title} ${a.tags.join(' ')} ${a.body}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Knowledge Base</h1>
          <p>
            {KB_ARTICLES.length} runbooks and policies · {state.kbRead.length} read
          </p>
        </div>
      </div>
      <div className="split-side">
        <div className="card stack" style={{ position: 'sticky', top: 16 }}>
          <input type="search" placeholder="Search articles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search articles" />
          <div className="row" style={{ gap: 4 }}>
            {CATS.map((c) => (
              <button key={c} className={`btn btn-sm ${cat === c ? 'btn-primary' : ''}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="stack" style={{ gap: 2, maxHeight: '60vh', overflowY: 'auto' }}>
            {list.map((a) => (
              <Link
                key={a.id}
                to={`/kb/${a.id}`}
                className="spread"
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  color: 'inherit',
                  background: a.id === id ? 'var(--primary-soft)' : undefined,
                }}
              >
                <span className="small" style={{ fontWeight: a.id === id ? 700 : 500 }}>
                  {a.title}
                </span>
                {state.kbRead.includes(a.id) && <span className="tiny muted">✓</span>}
              </Link>
            ))}
            {list.length === 0 && <div className="small muted">No articles match.</div>}
          </div>
        </div>
        <div className="card" style={{ minHeight: 300 }}>
          {article ? (
            <>
              <div className="row mb">
                <span className="pill pill-primary">{article.category}</span>
                {article.tags.map((t) => (
                  <span key={t} className="pill">
                    {t}
                  </span>
                ))}
              </div>
              <h1>{article.title}</h1>
              <Markdown text={article.body} />
            </>
          ) : (
            <div className="empty">
              <p>Select an article to read it.</p>
              <p className="small">You can also open related articles straight from inside any ticket.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
