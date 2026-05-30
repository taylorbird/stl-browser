import { useState, useCallback } from 'react';
import { triggerReindex, deleteModels } from './api';
import BrowsePage from './pages/BrowsePage';
import StaleModelsDialog from './components/StaleModelsDialog';
import Header from './components/Header';

export default function App() {
  const [reindexing, setReindexing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [staleModels, setStaleModels] = useState(null);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const stats = await triggerReindex();
      if (stats.stale.length > 0) {
        setStaleModels(stats.stale);
      }
      alert(`Reindex complete: ${stats.indexed} models indexed, ${stats.errors} errors`);
      setRefreshKey(k => k + 1);
    } catch {
      alert('Reindex failed');
    }
    setReindexing(false);
  }, []);

  const handleDeleteStale = useCallback(async (ids) => {
    try {
      const result = await deleteModels(ids);
      alert(`Removed ${result.deleted} stale models`);
      setStaleModels(null);
      setRefreshKey(k => k + 1);
    } catch {
      alert('Failed to remove stale models');
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Header reindexing={reindexing} onReindex={handleReindex} />
      <BrowsePage key={refreshKey} />
      {staleModels && (
        <StaleModelsDialog
          models={staleModels}
          onConfirm={handleDeleteStale}
          onDismiss={() => setStaleModels(null)}
        />
      )}
    </div>
  );
}
