import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, CircleCheck, Clock, FileText, LibraryBig, Search, SearchX, Tag, X, type LucideIcon } from 'lucide-react';
import { KB_ARTICLES, KB_BY_ID } from '../data/kb';
import { useStore } from '../state/store';
import { CategoryPill, EmptyState, IconTile, Markdown, PageHeader, ProgressBar } from '../components/ui';
import { CATEGORY_ICON } from '../components/icons';
import type { KbArticle } from '../types';
import '../styles/interview-kb.css';

const CATS = ['All', 'General', 'Accounts', 'Network', 'Hardware', 'Software', 'Email', 'Security'] as const;
type Cat = (typeof CATS)[number];
type ArticleCat = KbArticle['category'];

const ARTICLE_CATS = CATS.filter((c): c is Exclude<Cat, 'All'> => c !== 'All');

/** Same glyphs as the shared CategoryPill (BookOpen for General). */
function categoryIcon(category: ArticleCat): LucideIcon {
  return category === 'General' ? BookOpen : CATEGORY_ICON[category];
}

function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
}

export function KnowledgeBase() {
  const { id } = useParams();
  const { state, dispatch, work } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('All');
  const article = id ? KB_BY_ID[id] : undefined;
  const articleRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (article) dispatch({ type: 'kbRead', id: article.id });
    // Reading an article while a ticket is assigned is recorded on that ticket.
    if (article && work) work.emit({ type: 'openKb', id: article.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, dispatch]);

  // On a single-column layout the article sits below the list, so bring it into view when one is opened.
  useEffect(() => {
    if (!article || !articleRef.current) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 860px)').matches) {
      articleRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [article]);

  // Keep the open article visible inside the scrolling list (e.g. when it is opened from a ticket).
  useEffect(() => {
    const listEl = listRef.current;
    const row = listEl?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!listEl || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < listEl.scrollTop || bottom > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = Math.max(0, top - (listEl.clientHeight - row.offsetHeight) / 2);
    }
  }, [id]);

  const list = KB_ARTICLES.filter(
    (a) =>
      (cat === 'All' || a.category === cat) &&
      (!q || `${a.title} ${a.tags.join(' ')} ${a.body}`.toLowerCase().includes(q.toLowerCase())),
  );

  const isReadId = (aid: string) => state.kbRead.includes(aid);
  const readCount = KB_ARTICLES.filter((a) => isReadId(a.id)).length;
  const filtered = q !== '' || cat !== 'All';
  const isRead = article ? isReadId(article.id) : false;
  const nextUnread = KB_ARTICLES.find((a) => !isReadId(a.id));

  return (
    <div className="page kb-page">
      <PageHeader
        eyebrow={
          <>
            <LibraryBig size={14} aria-hidden />
            <span>Resources</span>
          </>
        }
        title="Knowledge base"
        description={`${KB_ARTICLES.length} runbooks and policies used across the service desk. Related articles also open from inside any ticket.`}
        actions={
          <div className="kb-progress">
            <div className="kb-progress-top">
              <span className="label">Articles read</span>
              <span className="kb-progress-count num">
                {readCount}
                <span className="faint">/{KB_ARTICLES.length}</span>
              </span>
            </div>
            <ProgressBar value={readCount / Math.max(1, KB_ARTICLES.length)} tone={readCount === KB_ARTICLES.length ? 'success' : undefined} />
          </div>
        }
      />

      <div className={`split-side kb-split ${article ? 'has-article' : 'no-article'}`}>
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
            <ul className="kb-list" ref={listRef}>
              {list.map((a) => {
                const active = a.id === id;
                const read = isReadId(a.id);
                return (
                  <li key={a.id}>
                    <Link to={`/kb/${a.id}`} className={`kb-row ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <FileText size={16} className="kb-row-icon" aria-hidden />
                      <span className="kb-row-text">
                        <span className="kb-row-title">{a.title}</span>
                        {cat === 'All' && <span className="kb-row-cat">{a.category}</span>}
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

        <article className="card kb-article" ref={articleRef} aria-label={article ? article.title : 'Browse the knowledge base'}>
          {article ? (
            <>
              <header className="kb-article-head">
                <h2 className="kb-title">{article.title}</h2>
                <div className="meta-row kb-meta">
                  <CategoryPill category={article.category} />
                  <span className="inline-icon">
                    <Clock size={14} aria-hidden />
                    {readingMinutes(article.body)} min read
                  </span>
                  {isRead && (
                    <span className="inline-icon kb-read-flag">
                      <CircleCheck size={14} aria-hidden />
                      Read
                    </span>
                  )}
                  {article.tags.length > 0 && (
                    <span className="kb-tagline">
                      <Tag size={14} aria-hidden />
                      <span className="kb-sr">Tags: </span>
                      <span className="kb-tag-list">
                        {article.tags.map((t) => (
                          <span key={t} className="kb-tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                </div>
              </header>
              <Markdown text={article.body} />
            </>
          ) : (
            <>
              <div className="card-head">
                <h2>
                  <LibraryBig size={18} aria-hidden />
                  Browse the library
                </h2>
              </div>
              <p className="card-sub">Pick a runbook or policy from the list, or narrow the list to one category below.</p>

              <div className="kb-home">
                <div className="kb-home-section">
                  <span className="label" id="kb-cats-label">
                    Categories
                  </span>
                  <ul className="kb-cats" aria-labelledby="kb-cats-label">
                    {ARTICLE_CATS.map((c) => {
                      const inCat = KB_ARTICLES.filter((a) => a.category === c);
                      const readInCat = inCat.filter((a) => isReadId(a.id)).length;
                      const done = inCat.length > 0 && readInCat === inCat.length;
                      return (
                        <li key={c}>
                          <button type="button" className={`kb-cat ${cat === c ? 'active' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
                            <IconTile icon={categoryIcon(c)} tone={cat === c ? 'primary' : 'neutral'} size="sm" />
                            <span className="kb-cat-name">{c}</span>
                            <span className="kb-cat-bar" aria-hidden>
                              <ProgressBar value={readInCat / Math.max(1, inCat.length)} tone={done ? 'success' : undefined} />
                            </span>
                            <span className="kb-cat-count num">
                              {readInCat}
                              <span className="faint">/{inCat.length} read</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {nextUnread && (
                  <Link to={`/kb/${nextUnread.id}`} className="kb-next">
                    <span className="kb-next-text">
                      <span className="label">Next unread</span>
                      <span className="kb-next-title">{nextUnread.title}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                )}
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
