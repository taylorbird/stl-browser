import { useState, useEffect, useCallback } from 'react';
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
      className={`relative overflow-hidden rounded-xl h-40 min-w-[14rem] flex-shrink-0 transition-all duration-200 ${
        active
          ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950 scale-105'
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
      <div className="relative h-full flex items-end p-3.5">
        <span className="text-2xl text-amber-200 leading-none font-display tracking-widest uppercase [text-shadow:_0_2px_10px_rgb(0_0_0_/_90%)]">
          {creator.name}
        </span>
      </div>
    </button>
  );
}

export default function BrowsePage() {
  const [filters, setFilters] = useState({ q: '', creator: '', page: 1, limit: 24 });
  const [data, setData] = useState({ models: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState([]);

  useEffect(() => { fetchCreators().then(setCreators); }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchModels(filters).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(data.total / (filters.limit || 24));

  return (
    <div>
      <SearchBar filters={filters} onChange={setFilters} />

      {creators.length > 1 && (
        <div>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Creators</h2>
        <div className="flex flex-wrap gap-3 mb-6">
          {creators.map(c => (
            <CreatorChip
              key={c.name}
              creator={c}
              active={filters.creator === c.name}
              onClick={() => setFilters(f => ({ ...f, creator: f.creator === c.name ? '' : c.name, page: 1 }))}
            />
          ))}
        </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-300">Models</h2>
        <p className="text-sm text-gray-400">{data.total} models</p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.models.map(model => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-400">
                Page {filters.page} of {totalPages}
              </span>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
