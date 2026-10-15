import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Check, CircleCheck, Clock, FileText, Info, Search, SearchX, Tag, X } from 'lucide-react';
import { KB_ARTICLES, KB_BY_ID } from '../data/kb';
import { useStore } from '../state/store';
import { EmptyState, Markdown, PageHeader, ProgressBar } from '../components/ui';
import { CategoryIcon } from '../components/icons';
import type { KbArticle } from '../types';
import '../styles/interview-kb.css';

const CATS = ['All', 'General', 'Accounts', 'Network', 'Hardware', 'Software', 'Email', 'Security'] as const;

function ArticleCategoryIcon({ category, size = 14 }: { category: KbArticle['category']; size?: number }) {
  if (category === 'General') return <Info size={size} aria-hidden />;
  return <CategoryIcon category={category} size={size} />;
}

function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
}

export function KnowledgeBase() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const article = id ? KB_BY_ID[id] : undefined;
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (article) dispatch({ type: 'kbRead', id: article.id });
  }, [article, dispatch]);

  // On a single-column layout the article sits below the list, so bring it into view when one is opened.
  useEffect(() => {
    if (!article || !articleRef.current) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 860px)').matches) {
      articleRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [article]);

  const list = KB_ARTICLES.filter(
    (a) =>
      (cat === 'All' || a.category === cat) &&
      (!q || `${a.title} ${a.tags.join(' ')} ${a.body}`.toLowerCase().includes(q.toLowerCase())),
  );

  const readCount = KB_ARTICLES.filter((a) => state.kbRead.includes(a.id)).length;
  const filtered = q !== '' || cat !== 'All';
  const isRead = article ? state.kbRead.includes(article.id) : false;

  return (
    <div className="kb-page">
      <PageHeader
        eyebrow="Reference"
        title="Knowledge base"
        description={`${KB_ARTICLES.length} runbooks and policies used across the service desk. Related articles also open from inside any ticket.`}
        actions={
          <div className="kb-progress">
            <div className="kb-progress-top">
              <span className="label">Articles read</span>
              <span className="kb-progress-count num">
                {readCount}
                <span className="faint"> / {KB_ARTICLES.length}</span>
              </span>
            </div>
            <ProgressBar value={readCount / Math.max(1, KB_ARTICLES.length)} tone={readCount === KB_ARTICLES.length ? 'success' : undefined} />
          </div>
        }
      />

      <div className="split-side">
        <nav className="card kb-side" aria-label="Knowledge base articles">
          <div className="search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Search articles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search articles" />
          </div>

          <div className="seg kb-seg" role="group" aria-label="Filter by category">
            {CATS.map((c) => (
              <button key={c} type="button" className={cat === c ? 'active' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="kb-list-head">
            <span className="label num">
              {list.length} {list.length === 1 ? 'article' : 'articles'}
            </span>
            {filtered && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQ('');
                  setCat('All');
                }}
              >
                <X size={14} aria-hidden />
                Clear filters
              </button>
            )}
          </div>

          {list.length > 0 ? (
            <ul className="kb-list">
              {list.map((a) => {
                const active = a.id === id;
                const read = state.kbRead.includes(a.id);
                return (
                  <li key={a.id}>
                    <Link to={`/kb/${a.id}`} className={`kb-row ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <FileText size={16} className="kb-row-icon" aria-hidden />
                      <span className="kb-row-text">
                        <span className="kb-row-title">{a.title}</span>
                        <span className="kb-row-cat">{a.category}</span>
                      </span>
                      {read && (
                        <span className="kb-row-read" title="Read">
                          <Check size={14} aria-hidden />
                          <span className="kb-sr">Read</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={SearchX} title="No articles match">
              Try a different search term or category.
            </EmptyState>
          )}
        </nav>

        <article className="card kb-article" ref={articleRef} aria-label={article ? article.title : 'Article'}>
          {article ? (
            <>
              <header className="kb-article-head">
                <div className="kb-tags">
                  <span className="pill pill-primary">
                    <ArticleCategoryIcon category={article.category} />
                    {article.category}
                  </span>
                  {article.tags.map((t) => (
                    <span key={t} className="pill pill-outline">
                      <Tag aria-hidden />
                      {t}
                    </span>
                  ))}
                </div>
                <h1 className="kb-title">{article.title}</h1>
                <div className="kb-meta">
                  <span className="inline-icon">
                    <Clock size={14} aria-hidden />
                    {readingMinutes(article.body)} min read
                  </span>
                  {isRead && (
                    <span className="pill pill-success">
                      <CircleCheck aria-hidden />
                      Read
                    </span>
                  )}
                </div>
              </header>
              <Markdown text={article.body} />
            </>
          ) : (
            <EmptyState icon={BookOpen} title="Select an article">
              Pick a runbook or policy from the list to read it. You can also open related articles straight from inside any ticket.
            </EmptyState>
          )}
        </article>
      </div>
    </div>
  );
}
