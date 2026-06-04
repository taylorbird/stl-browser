import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchModels, fetchCreators, creatorLogoUrl } from '../api';
import SearchBar from '../components/SearchBar';
import ModelCard from '../components/ModelCard';

const AVATAR_COLORS = [
  'from-rose-800 to-rose-950', 'from-sky-800 to-sky-950', 'from-emerald-800 to-emerald-950', 'from-amber-800 to-amber-950',
  'from-violet-800 to-violet-950', 'from-teal-800 to-teal-950', 'from-pink-800 to-pink-950', 'from-indigo-800 to-indigo-950',
];

function creatorColor(name) {
  const idx = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function CreatorChip({ creator, active, onClick }) {
  const hasLogo = creator.hasLogo;

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl h-24 w-36 flex-shrink-0 transition-all duration-200 ${
        active
          ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-950 scale-105'
          : 'hover:scale-105 hover:brightness-125'
      }`}
    >
      {hasLogo ? (
        <img
          src={creatorLogoUrl(creator.folder)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${creatorColor(creator.name)}`} />
      )}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="relative h-full flex items-end p-2.5">
        <span className="text-base text-amber-200 leading-none font-display tracking-widest uppercase [text-shadow:_0_2px_8px_rgb(0_0_0_/_90%)]">
          {creator.name}
        </span>
      </div>
    </button>
  );
}

const LIMIT = 24;

const SORT_OPTIONS = [
  { value: 'random', label: 'Shuffle' },
  { value: 'date', label: 'Newest' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'creator', label: 'Creator' },
];

export default function BrowsePage() {
  const [filters, setFilters] = useState({ q: '', creator: '' });
  const [sort, setSort] = useState('random');
  const [infiniteScroll, setInfiniteScroll] = useState(true);
  const [models, setModels] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [creators, setCreators] = useState([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => { fetchCreators().then(c => { setCreators(c); setCreatorsLoading(false); }); }, []);

  const loadPage = useCallback(async (pageNum, append) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const data = await fetchModels({
      q: filters.q,
      creator: filters.creator,
      page: pageNum,
      limit: LIMIT,
      sort,
      ...(sort === 'random' ? { seed } : {}),
    });

    setTotal(data.total);
    setModels(prev => append ? [...prev, ...data.models] : data.models);
    setHasMore(pageNum * LIMIT < data.total);
    setPage(pageNum);
    setLoading(false);
    loadingRef.current = false;
  }, [filters.q, filters.creator, sort, seed]);

  // Reset when filters or sort change
  useEffect(() => {
    setModels([]);
    setPage(1);
    setHasMore(true);
    loadPage(1, false);
  }, [loadPage]);

  // Infinite scroll observer
  useEffect(() => {
    if (!infiniteScroll) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadPage(page + 1, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [infiniteScroll, hasMore, page, loadPage]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters({ q: newFilters.q || '', creator: newFilters.creator || '' });
  }, []);

  const handlePageChange = (newPage) => {
    setModels([]);
    setPage(newPage);
    setHasMore(true);
    loadPage(newPage, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <SearchBar filters={filters} onChange={handleFilterChange} />

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Creators</h2>
        {creatorsLoading ? (
          <div className="flex flex-wrap gap-3 mb-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 w-36 rounded-xl bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 mb-6">
            {creators.map(c => (
              <CreatorChip
                key={c.name}
                creator={c}
                active={filters.creator === c.name}
                onClick={() => handleFilterChange({ ...filters, creator: filters.creator === c.name ? '' : c.name })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          {filters.creator || 'All Models'}
          <span className="ml-2 text-gray-600">({total})</span>
        </h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  sort === opt.value
                    ? 'bg-gray-700 text-amber-200'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-700" />

          <div className="flex items-center bg-gray-800/50 rounded-md p-0.5">
            <button
              onClick={() => setInfiniteScroll(true)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                infiniteScroll
                  ? 'bg-gray-700 text-amber-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ∞ Scroll
            </button>
            <button
              onClick={() => setInfiniteScroll(false)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                !infiniteScroll
                  ? 'bg-gray-700 text-amber-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Pages
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {models.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>

      {infiniteScroll ? (
        <div ref={sentinelRef} className="h-16 flex items-center justify-center">
          {loading && <p className="text-gray-500">Loading...</p>}
          {!hasMore && models.length > 0 && (
            <p className="text-gray-600 text-sm">All {total} models loaded</p>
          )}
        </div>
      ) : (
        totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-8">
            <button
              disabled={page <= 1}
              onClick={() => handlePageChange(1)}
              className="px-3 py-1.5 text-sm bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              «
            </button>
            <button
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              className="px-3 py-1.5 text-sm bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`gap-${i}`} className="px-2 text-gray-600">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      p === page
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              className="px-3 py-1.5 text-sm bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              ›
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => handlePageChange(totalPages)}
              className="px-3 py-1.5 text-sm bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              »
            </button>
          </div>
        )
      )}
    </div>
  );
}
