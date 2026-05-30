import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchModel, fileUrl } from '../api';
import Header from '../components/Header';
import LoadingImage from '../components/LoadingImage';

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

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export default function ModelDetailPage() {
  const { id } = useParams();
  const [model, setModel] = useState(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
    setModel(null);
    fetchModel(id).then(setModel);
  }, [id]);

  if (!model) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Header />
        <div className="flex items-center justify-center py-32">
          <span className="loading loading-spinner loading-lg text-gray-500" />
        </div>
      </div>
    );
  }

  const imageFiles = model.files.filter(f => IMAGE_EXTS.has('.' + f.split('.').pop().toLowerCase()));
  const downloadFiles = model.files.filter(f => !IMAGE_EXTS.has('.' + f.split('.').pop().toLowerCase()));

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Header />

      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
      >
        &larr; Back to browse
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold mb-6">{model.title}</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            {imageFiles.length > 0 && (
              <>
                <div className="aspect-square bg-gray-800 rounded-xl overflow-hidden">
                  <LoadingImage
                    key={imageFiles[activeImage]}
                    src={fileUrl(model.id, imageFiles[activeImage])}
                    alt={model.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                {imageFiles.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {imageFiles.map((img, i) => (
                      <button
                        key={img}
                        onClick={() => setActiveImage(i)}
                        className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                          i === activeImage ? 'border-blue-500' : 'border-transparent hover:border-gray-600'
                        }`}
                      >
                        <LoadingImage
                          src={fileUrl(model.id, img)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
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
            <div className="prose prose-invert prose-sm max-h-64 overflow-y-auto mb-6 text-gray-300 whitespace-pre-wrap">
              {model.content}
            </div>

            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              Files ({downloadFiles.length})
            </h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
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
      </motion.div>
    </div>
  );
}
