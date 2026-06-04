import { useState, useEffect, useCallback } from 'react';

// Debounce a fast-changing value (e.g. search keystrokes) before it triggers fetches.
function useDebouncedValue(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
import {
  triggerReindex, deleteModels,
  fetchFavorites, setFavorite,
  fetchCollections, createCollection,
  fetchCounts, fetchCreators,
} from './api';
import BrowsePage from './pages/BrowsePage';
import Sidebar from './components/Sidebar';
import CollectionDialog from './components/CollectionDialog';
import StaleModelsDialog from './components/StaleModelsDialog';

export default function App() {
  const [view, setView] = useState({ type: 'all' });
  const [sort, setSort] = useState('random');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 250);
  const [favorites, setFavorites] = useState(() => new Set());
  const [collections, setCollections] = useState([]);
  const [counts, setCounts] = useState(null);
  const [creators, setCreators] = useState([]);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [staleModels, setStaleModels] = useState(null);

  const refreshSidebar = useCallback(() => {
    fetchCounts().then(setCounts);
    fetchCollections().then(setCollections);
    fetchCreators().then(setCreators);
  }, []);

  useEffect(() => {
    refreshSidebar();
    fetchFavorites().then(({ ids }) => setFavorites(new Set(ids)));
  }, [refreshSidebar]);

  const handleToggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const on = !next.has(id);
      if (on) next.add(id); else next.delete(id);
      setFavorite(id, on).then((r) => {
        if (r?.error) {
          // Write rejected (e.g. no auth identity) — revert the optimistic update
          setFavorites((cur) => {
            const reverted = new Set(cur);
            if (on) reverted.delete(id); else reverted.add(id);
            return reverted;
          });
        } else {
          fetchCounts().then(setCounts);
        }
      });
      return next;
    });
  }, []);

  const handleCreateCollection = useCallback(async (name, hue) => {
    const created = await createCollection(name, hue);
    setShowNewCollection(false);
    if (created?.error) {
      alert(`Could not create collection: ${created.error}`);
      return;
    }
    fetchCollections().then(setCollections);
  }, []);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const stats = await triggerReindex();
      if (stats.stale?.length > 0) setStaleModels(stats.stale);
      refreshSidebar();
      setRefreshKey((k) => k + 1);
    } catch {
      alert('Sync failed');
    }
    setReindexing(false);
  }, [refreshSidebar]);

  const handleDeleteStale = useCallback(async (ids) => {
    try {
      await deleteModels(ids);
      setStaleModels(null);
      refreshSidebar();
      setRefreshKey((k) => k + 1);
    } catch {
      alert('Failed to remove stale models');
    }
  }, [refreshSidebar]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <Sidebar
        view={view}
        onViewChange={setView}
        counts={counts}
        collections={collections}
        creators={creators}
        q={q}
        onSearch={setQ}
        onNewCollection={() => setShowNewCollection(true)}
      />
      <main className="flex h-screen min-w-0 flex-1 flex-col">
        <BrowsePage
          key={refreshKey}
          view={view}
          sort={sort}
          onSortChange={setSort}
          q={debouncedQ}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          reindexing={reindexing}
          onReindex={handleReindex}
        />
      </main>
      {showNewCollection && (
        <CollectionDialog onCreate={handleCreateCollection} onDismiss={() => setShowNewCollection(false)} />
      )}
      {staleModels && (
        <StaleModelsDialog models={staleModels} onConfirm={handleDeleteStale} onDismiss={() => setStaleModels(null)} />
      )}
    </div>
  );
}
