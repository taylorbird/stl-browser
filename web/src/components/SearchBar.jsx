import { useState, useEffect } from 'react';
import { fetchCreators } from '../api';

export default function SearchBar({ filters, onChange }) {
  const [creators, setCreators] = useState([]);

  useEffect(() => {
    fetchCreators().then(setCreators);
  }, []);

  return (
    <div className="flex flex-wrap gap-3 items-center mb-6">
      <input
        type="text"
        placeholder="Search models..."
        value={filters.q || ''}
        onChange={e => onChange({ ...filters, q: e.target.value, page: 1 })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 min-w-48"
      />
      <select
        value={filters.creator || ''}
        onChange={e => onChange({ ...filters, creator: e.target.value, page: 1 })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100"
      >
        <option value="">All Creators</option>
        {creators.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
    </div>
  );
}
