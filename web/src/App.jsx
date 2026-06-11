import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

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
import SettingsDialog from './components/SettingsDialog';
import StaleModelsDialog from './components/StaleModelsDialog';
import Icon from './components/Icon';

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
  const [showSettings, setShowSettings] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [staleModels, setStaleModels] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Selecting a view from the drawer should close it (mobile only — harmless on desktop).
  const handleViewChange = useCallback((v) => {
    setView(v);
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      {/* Drawer backdrop (mobile only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        view={view}
        onViewChange={handleViewChange}
        counts={counts}
        collections={collections}
        creators={creators}
        q={q}
        onSearch={setQ}
        onNewCollection={() => { setShowNewCollection(true); setSidebarOpen(false); }}
        onOpenSettings={() => { setShowSettings(true); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex h-screen min-w-0 flex-1 flex-col">
        {/* Mobile top bar — hamburger, persistent search, sync */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-2.5 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-panel text-dim hover:text-ink"
          >
            <Icon name="menu" className="h-[18px] w-[18px]" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line bg-panel px-3 py-2 focus-within:border-accent">
            <Icon name="search" className="h-4 w-4 shrink-0 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </div>
          <Link
            to="/add"
            title="Add model"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-accent/50 bg-accent-dim text-accent hover:bg-accent hover:text-accent-ink"
          >
            <Icon name="plus" className="h-[18px] w-[18px]" />
          </Link>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            title="Sync library"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-panel text-dim hover:text-ink disabled:opacity-50"
          >
            <Icon name="refresh" className={`h-[17px] w-[17px] ${reindexing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <BrowsePage
          key={refreshKey}
          view={view}
          onViewChange={setView}
          creators={creators}
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
      {showSettings && (
        <SettingsDialog
          creators={creators}
          onDismiss={() => {
            setShowSettings(false);
            setRefreshKey((k) => k + 1); // re-roll Featured/Shuffle with new weights
          }}
        />
      )}
      {staleModels && (
        <StaleModelsDialog models={staleModels} onConfirm={handleDeleteStale} onDismiss={() => setStaleModels(null)} />
      )}
    </div>
  );
}
