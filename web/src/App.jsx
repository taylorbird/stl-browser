import { useState, useCallback } from 'react';
import { triggerReindex, deleteModels } from './api';
import BrowsePage from './pages/BrowsePage';
import ModelDetail from './components/ModelDetail';
import StaleModelsDialog from './components/StaleModelsDialog';

export default function App() {
  const [selectedModel, setSelectedModel] = useState(null);
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
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">STL Browser</h1>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {reindexing ? 'Reindexing...' : 'Reindex'}
        </button>
      </header>
      <BrowsePage key={refreshKey} onSelectModel={m => setSelectedModel(m)} />
      {selectedModel && (
        <ModelDetail modelId={selectedModel.id} onClose={() => setSelectedModel(null)} />
      )}
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
