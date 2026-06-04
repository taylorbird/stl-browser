import { Link } from 'react-router-dom';
import { previewUrl } from '../api';
import LoadingImage from './LoadingImage';

function stlLabel(files) {
  const n = files.filter((f) => f.toLowerCase().endsWith('.stl')).length;
  return n ? `${n} STL${n > 1 ? 's' : ''}` : 'no files';
}

function StlBadge({ files }) {
  const n = files.filter((f) => f.toLowerCase().endsWith('.stl')).length;
  if (!n) {
    return (
      <span className="rounded-md bg-line2 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[.04em] text-faint">
        no files
      </span>
    );
  }
  return (
    <span className="rounded-md bg-[rgba(231,177,90,.18)] px-2 py-1 font-mono text-[10.5px] uppercase tracking-[.04em] text-accent">
      <b>{n}</b> STL{n > 1 ? 's' : ''}
    </span>
  );
}

function CardImage({ model }) {
  return model.preview_filename ? (
    <LoadingImage
      src={previewUrl(model.id)}
      alt={model.title}
      className="h-full w-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-105"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-panel text-sm text-faint">No preview</div>
  );
}

export default function FeaturedBento({ models }) {
  if (!models || models.length < 5) return null;
  const [hero, ...small] = models.slice(0, 5);

  return (
    <div className="mb-[30px] grid grid-cols-2 gap-3.5 min-[1180px]:grid-cols-[1.5fr_1fr_1fr] min-[1180px]:grid-rows-[188px_188px]">
      {/* Large card */}
      <Link
        to={`/models/${hero.id}`}
        className="group relative col-span-2 block h-[260px] overflow-hidden rounded-2xl border border-line2 min-[1180px]:col-span-1 min-[1180px]:row-span-2 min-[1180px]:h-auto"
      >
        <div className="absolute inset-0"><CardImage model={hero} /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,8,11,.92)] from-0% via-[rgba(7,8,11,.35)] via-[42%] to-transparent to-[68%]" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3 className="mb-[11px] font-display text-[26px] font-bold tracking-[-.02em] text-white">{hero.title}</h3>
          <div className="flex items-center gap-2.5 text-[13px] text-white/70">
            <span>{hero.creator}</span>
            <span className="opacity-50">·</span>
            <span>{hero.date}</span>
            <StlBadge files={hero.files} />
          </div>
        </div>
      </Link>

      {/* Four small cards */}
      {small.map((m) => (
        <Link
          key={m.id}
          to={`/models/${m.id}`}
          className="group relative block h-[160px] overflow-hidden rounded-[14px] border border-line2 min-[1180px]:h-auto"
        >
          <div className="absolute inset-0"><CardImage model={m} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,8,11,.93)] from-0% via-[rgba(7,8,11,.25)] via-[46%] to-transparent to-[72%]" />
          <span className="absolute right-[9px] top-[9px] rounded-[7px] border border-white/15 bg-[rgba(7,8,11,.5)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.04em] text-white backdrop-blur-[6px]">
            {stlLabel(m.files)}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3.5 pb-[15px]">
            <h4 className="mb-1.5 line-clamp-2 font-display text-sm font-semibold leading-[1.18] text-white">{m.title}</h4>
            <div className="text-[11.5px] text-white/65">{m.creator}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
