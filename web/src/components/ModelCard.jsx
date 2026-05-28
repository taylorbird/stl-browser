import { previewUrl } from '../api';

export default function ModelCard({ model, onClick }) {
  return (
    <div
      onClick={() => onClick(model)}
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-600 transition-colors"
    >
      <div className="aspect-square bg-gray-800 overflow-hidden">
        {model.preview_filename ? (
          <img
            src={previewUrl(model.id)}
            alt={model.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No preview
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{model.title}</h3>
        <p className="text-xs text-gray-400 mt-1">{model.creator}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{model.date}</span>
          <span className="text-xs text-gray-500">
            {model.files.filter(f => f.endsWith('.stl')).length} STLs
          </span>
        </div>
      </div>
    </div>
  );
}
