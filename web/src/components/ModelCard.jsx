import { Link } from 'react-router-dom';
import { previewUrl } from '../api';
import LoadingImage from './LoadingImage';

export default function ModelCard({ model }) {
  const stlCount = model.files.filter(f => f.endsWith('.stl')).length;

  return (
    <Link
      to={`/models/${model.id}`}
      className="group relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ease-out block hover:scale-[1.03] hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:z-10"
    >
      <div className="aspect-square bg-gray-800 overflow-hidden">
        {model.preview_filename ? (
          <LoadingImage
            src={previewUrl(model.id)}
            alt={model.title}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No preview
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-heading font-semibold text-[0.95rem] leading-tight truncate transition-colors duration-300 group-hover:text-amber-200">
          {model.title}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-400">{model.creator}</p>
          {stlCount > 0 && (
            <span className="bg-gray-800 text-amber-300 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-md">
              {stlCount} STL{stlCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
