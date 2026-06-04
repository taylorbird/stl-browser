import { useState, useEffect } from 'react';
import { fetchWeights, setWeight, creatorLogoUrl } from '../api';
import { monogram } from '../utils';

// Weight steps: how much airtime a creator gets in Featured + Shuffle
// relative to an even split. 1 = balanced default.
const STEPS = [
  { value: 0, label: 'Hide' },
  { value: 0.5, label: 'Less' },
  { value: 1, label: 'Normal' },
  { value: 2, label: 'More' },
  { value: 4, label: 'Max' },
];

export default function SettingsDialog({ creators, onDismiss }) {
  const [weights, setWeights] = useState(null);

  useEffect(() => {
    fetchWeights().then(({ weights }) => setWeights(weights || {}));
  }, []);

  const handleSet = (creator, value) => {
    setWeights((prev) => ({ ...prev, [creator]: value }));
    setWeight(creator, value).then((r) => {
      if (r?.error) fetchWeights().then(({ weights }) => setWeights(weights || {}));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onDismiss}>
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl border border-line bg-canvas"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-5">
          <h2 className="font-display text-base font-semibold">Settings</h2>
        </div>

        <div className="main-scroll flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[.2em] text-faint">
            Creator weights
          </div>
          <p className="mb-5 text-[13px] leading-relaxed text-dim">
            How often each creator shows up in Featured and Shuffle. Normal gives every
            creator an even share regardless of how many models they have.
          </p>

          {weights == null ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-md text-faint" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {creators.map((c) => {
                const current = weights[c.name] ?? 1;
                return (
                  <div key={c.name} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-panel2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-panel2 font-mono text-[9px] text-dim">
                      {c.hasLogo ? (
                        <img src={creatorLogoUrl(c.folder)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        monogram(c.name)
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{c.name}</span>
                    <div className="flex gap-0.5 rounded-lg bg-panel2 p-0.5">
                      {STEPS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => handleSet(c.name, s.value)}
                          className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                            current === s.value
                              ? s.value === 0
                                ? 'bg-panel text-ink'
                                : 'bg-accent-dim text-accent'
                              : 'text-dim hover:text-ink'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-line px-6 py-4">
          <button
            onClick={onDismiss}
            className="rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] text-dim transition-colors hover:border-accent hover:text-ink"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
