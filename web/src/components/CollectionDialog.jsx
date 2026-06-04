import { useState } from 'react';

const HUES = [28, 150, 45, 280, 200, 330];

export default function CollectionDialog({ onCreate, onDismiss }) {
  const [name, setName] = useState('');
  const [hue, setHue] = useState(HUES[0]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await onCreate(trimmed, hue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onDismiss}>
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-display text-base font-semibold">New collection</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Collection name"
          className="mb-4 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="mb-6 flex items-center gap-2.5">
          {HUES.map((h) => (
            <button
              key={h}
              onClick={() => setHue(h)}
              className={`h-6 w-6 rounded-full transition-transform ${hue === h ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-canvas' : ''}`}
              style={{ background: `hsl(${h} 58% 60%)` }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onDismiss} className="rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] text-dim hover:text-ink">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="rounded-[10px] bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
