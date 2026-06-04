import { Link } from 'react-router-dom';
import { previewUrl, fileUrl } from '../api';
import LoadingImage from './LoadingImage';
import Icon from './Icon';

const GLASS = 'bg-[rgba(7,8,11,.5)] backdrop-blur-[6px] border border-white/15';

export default function ModelCard({ model, favorited, onToggleFavorite }) {
  const stls = model.files.filter((f) => f.toLowerCase().endsWith('.stl'));

  const handleDownload = (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const f of stls) {
      const a = document.createElement('a');
      a.href = fileUrl(model.id, f);
      a.download = f;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(model.id);
  };

  return (
    <Link
      to={`/models/${model.id}`}
      className="group block overflow-hidden rounded-[13px] border border-line2 bg-panel2 transition-colors hover:border-line"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {model.preview_filename ? (
          <LoadingImage
            src={previewUrl(model.id)}
            alt={model.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-panel text-sm text-faint">
            No preview
          </div>
        )}

        {/* STL pill */}
        <span className={`absolute right-[9px] top-[9px] rounded-[7px] px-2 py-1 font-mono text-[10px] uppercase tracking-[.04em] text-white ${GLASS}`}>
          {stls.length ? `${stls.length} STL${stls.length > 1 ? 's' : ''}` : 'no files'}
        </span>

        {/* Hover actions */}
        <div className="absolute left-[9px] top-[9px] flex -translate-y-[3px] gap-1.5 opacity-0 transition-all duration-[180ms] group-hover:translate-y-0 group-hover:opacity-100">
          {stls.length > 0 && (
            <button
              onClick={handleDownload}
              title="Download STLs"
              className={`flex h-[31px] w-[31px] items-center justify-center rounded-[9px] text-white hover:border-transparent hover:bg-accent hover:text-accent-ink ${GLASS}`}
            >
              <Icon name="download" className="h-[15px] w-[15px]" />
            </button>
          )}
          <button
            onClick={handleFavorite}
            title={favorited ? 'Remove from favorites' : 'Save to favorites'}
            className={`flex h-[31px] w-[31px] items-center justify-center rounded-[9px] hover:border-transparent hover:bg-accent hover:text-accent-ink ${
              favorited ? 'border border-transparent bg-accent text-accent-ink' : `text-white ${GLASS}`
            }`}
          >
            <Icon name="heart" className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>

      <div className="px-[13px] pb-[13px] pt-[11px]">
        <h3 className="truncate font-display text-[13px] font-semibold">{model.title}</h3>
        <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-dim">
          <span className="truncate">{model.creator}</span>
          <span className="ml-2 shrink-0 font-mono text-[10px] text-faint">{model.date}</span>
        </div>
      </div>
    </Link>
  );
}
