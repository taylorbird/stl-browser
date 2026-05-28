import { useState, useEffect, useCallback } from 'react';
import { fetchModels, fetchCreators, creatorLogoUrl } from '../api';
import SearchBar from '../components/SearchBar';
import ModelCard from '../components/ModelCard';

const MAX_CREATOR_CHIPS = 8;

const AVATAR_COLORS = [
  'bg-rose-700', 'bg-sky-700', 'bg-emerald-700', 'bg-amber-700',
  'bg-violet-700', 'bg-teal-700', 'bg-pink-700', 'bg-indigo-700',
];

function CreatorAvatar({ creator }) {
  if (creator.hasLogo) {
    return (
      <img
        src={creatorLogoUrl(creator.folder)}
        alt=""
        className="w-10 h-10 rounded-lg object-cover"
      />
    );
  }
  const colorIdx = creator.name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-base font-bold text-white ${AVATAR_COLORS[colorIdx]}`}>
      {creator.name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function BrowsePage({ onSelectModel }) {
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

      {creators.length > 1 && creators.length <= MAX_CREATOR_CHIPS && (
        <div className="flex flex-wrap gap-3 mb-4">
          {creators.map(c => (
            <button
              key={c.name}
              onClick={() => setFilters(f => ({ ...f, creator: f.creator === c.name ? '' : c.name, page: 1 }))}
              className={`flex flex-col items-center gap-1.5 px-5 py-3 text-sm rounded-xl border transition-colors ${
                filters.creator === c.name
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <CreatorAvatar creator={c} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{data.total} models</p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.models.map(model => (
              <ModelCard key={model.id} model={model} onClick={onSelectModel} />
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
