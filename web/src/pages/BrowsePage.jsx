import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchModels } from '../api';
import ModelCard from '../components/ModelCard';
import FeaturedBento from '../components/FeaturedBento';
import CreatorShelf from '../components/CreatorShelf';
import Icon from '../components/Icon';

const LIMIT = 24;

const SORT_OPTIONS = [
  { value: 'random', label: 'Shuffle' },
  { value: 'date', label: 'Newest' },
  { value: 'title', label: 'Title' },
  { value: 'creator', label: 'Creator' },
];

function viewParams(view) {
  switch (view.type) {
    case 'recent': return { recent: 1 };
    case 'favorites': return { favorites: 1 };
    case 'missing': return { missing: 1 };
    case 'creator': return { creator: view.creator };
    case 'collection': return { collection: view.id };
    default: return {};
  }
}

function viewTitle(view) {
  switch (view.type) {
    case 'recent': return 'Recently added';
    case 'favorites': return 'Favorites';
    case 'missing': return 'Missing files';
    case 'creator': return view.creator;
    case 'collection': return view.name;
    default: return 'All models';
  }
}

const EMPTY_HINTS = {
  favorites: 'No favorites yet — hover a model and tap the heart.',
  missing: 'Nothing missing — every model has STL files.',
  collection: 'This collection is empty.',
};

export default function BrowsePage({ view, onViewChange, sort, onSortChange, q, creators, favorites, onToggleFavorite, reindexing, onReindex }) {
  const [models, setModels] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));
  const [featSeed, setFeatSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [featured, setFeatured] = useState([]);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);
  const loadingRef = useRef(false);
  const reqIdRef = useRef(0);

  const showFeatured = view.type === 'all' && !q;

  // Featured: random 5, reshuffled via featSeed
  useEffect(() => {
    if (!showFeatured) return;
    fetchModels({ limit: 5, sort: 'random', seed: featSeed }).then((d) => setFeatured(d.models));
  }, [showFeatured, featSeed]);

  const loadPage = useCallback(async (pageNum, append) => {
    // Newer calls supersede in-flight ones (e.g. fast typing in search) —
    // stale responses are discarded rather than new requests dropped.
    const reqId = ++reqIdRef.current;
    loadingRef.current = true;
    setLoading(true);

    const data = await fetchModels({
      q,
      ...viewParams(view),
      page: pageNum,
      limit: LIMIT,
      sort,
      ...(sort === 'random' ? { seed } : {}),
    });

    if (reqId !== reqIdRef.current) return;
    setTotal(data.total);
    setModels((prev) => (append ? [...prev, ...data.models] : data.models));
    setHasMore(pageNum * LIMIT < data.total);
    setPage(pageNum);
    setLoading(false);
    loadingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, seed, view.type, view.creator, view.id]);

  // Reset when view/filters/sort change
  useEffect(() => {
    setModels([]);
    setPage(1);
    setHasMore(true);
    scrollRef.current?.scrollTo({ top: 0 });
    loadPage(1, false);
  }, [loadPage]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadPage(page + 1, true);
        }
      },
      { root: scrollRef.current, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page, loadPage]);

  const title = viewTitle(view);
  const emptyHint = !loading && models.length === 0 && (EMPTY_HINTS[view.type] || 'No models match.');

  return (
    <>
      {/* Header bar */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-line px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-5 lg:px-[30px] lg:py-[18px]">
        <div className="font-display text-[19px] font-semibold">
          {title} <span className="ml-1 font-normal text-dim">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:overflow-visible lg:px-0">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`shrink-0 whitespace-nowrap rounded-lg border px-[13px] py-[7px] text-[13px] transition-colors ${
                  sort === opt.value
                    ? 'border-line bg-panel text-ink'
                    : 'border-transparent text-dim hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="hidden h-[22px] w-px bg-line lg:block" />
          <button
            onClick={onReindex}
            disabled={reindexing}
            className="hidden whitespace-nowrap rounded-[10px] border border-line bg-panel px-4 py-[9px] text-[13px] text-dim transition-colors hover:border-accent hover:text-ink disabled:opacity-50 lg:block"
          >
            {reindexing ? 'Syncing…' : 'Sync library'}
          </button>
        </div>
      </header>

      {/* Scroll area */}
      <div ref={scrollRef} className="main-scroll flex-1 overflow-y-auto px-4 pb-10 pt-5 sm:px-6 lg:px-[30px] lg:pt-[26px]">
        {showFeatured && featured.length >= 5 && (
          <>
            <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-faint">
              Featured
              <button
                onClick={() => setFeatSeed(Math.floor(Math.random() * 1000000))}
                title="Shuffle featured"
                className="flex text-faint transition-colors hover:text-accent"
              >
                <Icon name="shuffle" className="h-3.5 w-3.5" />
              </button>
            </div>
            <FeaturedBento models={featured} />
          </>
        )}

        {/* Creator shelf — homepage + creator views, hidden while searching */}
        {(view.type === 'all' || view.type === 'creator') && !q && (
          <CreatorShelf creators={creators} view={view} onViewChange={onViewChange} />
        )}

        {/* Grid meta row */}
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[.2em] text-faint">
            {view.type === 'all' && !q ? 'Everything' : title}
          </span>
          <span className="font-mono text-[11px] text-faint">
            {models.length > 0 ? `1–${models.length} of ${total.toLocaleString()}` : '0 results'}
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(224px,1fr))] sm:gap-3.5">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              favorited={favorites.has(model.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>

        {emptyHint && <p className="py-16 text-center text-sm text-dim">{emptyHint}</p>}

        <div ref={sentinelRef} className="flex h-16 items-center justify-center">
          {loading && <span className="loading loading-spinner loading-md text-faint" />}
          {!hasMore && models.length > 0 && (
            <p className="font-mono text-[11px] text-faint">All {total.toLocaleString()} models loaded</p>
          )}
        </div>
      </div>
    </>
  );
}
