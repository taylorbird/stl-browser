import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchMe } from '../api';

export default function Header({ reindexing, onReindex }) {
  const [user, setUser] = useState(null);

  useEffect(() => { fetchMe().then(setUser); }, []);

  return (
    <header className="mb-6 flex items-center justify-between">
      <Link to="/" className="text-2xl font-bold hover:text-gray-300 transition-colors">
        STL Browser
      </Link>
      <div className="flex items-center gap-4">
        {user?.email && (
          <span className="text-sm text-gray-400">{user.name || user.email}</span>
        )}
        {onReindex && (
          <button
            onClick={onReindex}
            disabled={reindexing}
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {reindexing ? 'Reindexing...' : 'Reindex'}
          </button>
        )}
      </div>
    </header>
  );
}
