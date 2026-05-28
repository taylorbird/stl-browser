import { useState, useEffect } from 'react';
import { fetchModel, fileUrl } from '../api';

const EXT_COLORS = {
  '.stl': 'bg-blue-900 text-blue-300',
  '.3mf': 'bg-purple-900 text-purple-300',
  '.step': 'bg-green-900 text-green-300',
  '.stp': 'bg-green-900 text-green-300',
  '.obj': 'bg-yellow-900 text-yellow-300',
  '.gcode': 'bg-red-900 text-red-300',
};

function extBadge(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  const color = EXT_COLORS[ext] || 'bg-gray-700 text-gray-300';
  return <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>{ext}</span>;
}

export default function ModelDetail({ modelId, onClose }) {
  const [model, setModel] = useState(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
    fetchModel(modelId).then(setModel);
  }, [modelId]);

  if (!model) return <div className="text-gray-500">Loading...</div>;

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  const imageFiles = model.files.filter(f => imageExts.has('.' + f.split('.').pop().toLowerCase()));
  const downloadFiles = model.files.filter(f => !imageExts.has('.' + f.split('.').pop().toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto my-8 bg-gray-900 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold">{model.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-6">
          <div>
            {imageFiles.length > 0 && (
              <>
                <img
                  src={fileUrl(model.id, imageFiles[activeImage])}
                  alt={model.title}
                  className="w-full rounded-lg"
                />
                {imageFiles.length > 1 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                    {imageFiles.map((img, i) => (
                      <button
                        key={img}
                        onClick={() => setActiveImage(i)}
                        className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                          i === activeImage ? 'border-blue-500' : 'border-transparent hover:border-gray-600'
                        }`}
                      >
                        <img src={fileUrl(model.id, img)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-400">
              <span>{model.creator}</span>
              <span>&middot;</span>
              <span>{model.date}</span>
              {model.patreon_url && (
                <>
                  <span>&middot;</span>
                  <a href={model.patreon_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    Patreon
                  </a>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="prose prose-invert prose-sm max-h-48 overflow-y-auto mb-4 text-gray-300 whitespace-pre-wrap">
              {model.content}
            </div>

            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Files ({downloadFiles.length})
            </h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {downloadFiles.map(file => (
                <div key={file} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {extBadge(file)}
                    <span className="text-sm truncate">{file}</span>
                  </div>
                  <a
                    href={fileUrl(model.id, file)}
                    className="text-blue-400 hover:text-blue-300 text-sm shrink-0 ml-2"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
