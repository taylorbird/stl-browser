import { useState } from 'react';

export default function StaleModelsDialog({ models, onConfirm, onDismiss }) {
  const [selected, setSelected] = useState(() => new Set(models.map(m => m.id)));

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === models.length) setSelected(new Set());
    else setSelected(new Set(models.map(m => m.id)));
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="max-w-lg mx-auto my-16 bg-gray-900 rounded-xl border border-gray-700">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold">Stale Models Detected</h2>
          <p className="text-sm text-gray-400 mt-1">
            {models.length} model{models.length !== 1 ? 's' : ''} in the database no longer exist on disk. Remove them?
          </p>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto space-y-1">
          <label className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === models.length}
              onChange={toggleAll}
              className="accent-blue-500"
            />
            <span className="text-sm font-semibold text-gray-300">Select all</span>
          </label>
          {models.map(m => (
            <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="accent-blue-500"
              />
              <div className="min-w-0">
                <div className="text-sm truncate">{m.title}</div>
                <div className="text-xs text-gray-500">{m.creator} &middot; {m.folder_path}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
          >
            Keep All
          </button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="px-4 py-2 text-sm bg-red-700 border border-red-600 rounded-lg hover:bg-red-600 disabled:opacity-30"
          >
            Remove {selected.size} Model{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
