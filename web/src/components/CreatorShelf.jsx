import { creatorLogoUrl } from '../api';
import { monogram } from '../utils';

// Deterministic fallback hue per creator (no logo case)
function creatorHue(name) {
  return name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
}

function CreatorCard({ creator, active, onClick }) {
  const hue = creatorHue(creator.name);
  return (
    <button
      onClick={onClick}
      className={`relative h-24 w-full overflow-hidden rounded-[13px] border text-left transition-all duration-200 ${
        active
          ? 'border-transparent ring-2 ring-accent ring-offset-2 ring-offset-canvas scale-[1.04]'
          : 'border-line2 hover:scale-[1.04] hover:border-line hover:brightness-125'
      }`}
    >
      {creator.hasLogo ? (
        <img
          src={creatorLogoUrl(creator.folder)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-lg text-white/30"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 30% 26%), hsl(${hue} 30% 13%))` }}
        >
          {monogram(creator.name)}
        </div>
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-2 p-2.5">
        <span className="truncate font-display text-[13px] font-semibold uppercase tracking-[.08em] text-white [text-shadow:0_2px_8px_rgb(0_0_0/.9)]">
          {creator.name}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-white/60">{creator.count}</span>
      </div>
    </button>
  );
}

export default function CreatorShelf({ creators, view, onViewChange }) {
  if (!creators?.length) return null;
  return (
    <div className="mb-12">
      <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-faint">
        Creators <span className="text-accent">{creators.length}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {creators.map((c) => {
          const active = view.type === 'creator' && view.creator === c.name;
          return (
            <CreatorCard
              key={c.name}
              creator={c}
              active={active}
              onClick={() => onViewChange(active ? { type: 'all' } : { type: 'creator', creator: c.name })}
            />
          );
        })}
      </div>
    </div>
  );
}
