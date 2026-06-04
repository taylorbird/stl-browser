import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  fetchModel, fileUrl,
  fetchFavorites, setFavorite,
  fetchCollections, fetchModelCollections, setModelInCollection,
} from '../api';
import LoadingImage from '../components/LoadingImage';
import Icon from '../components/Icon';

const EXT_COLORS = {
  '.stl': 'bg-accent-dim text-accent',
  '.3mf': 'bg-purple-900 text-purple-300',
  '.step': 'bg-green-900 text-green-300',
  '.stp': 'bg-green-900 text-green-300',
  '.obj': 'bg-yellow-900 text-yellow-300',
  '.gcode': 'bg-red-900 text-red-300',
};

function extBadge(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  const color = EXT_COLORS[ext] || 'bg-panel text-dim';
  return <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${color}`}>{ext}</span>;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export default function ModelDetailPage() {
  const { id } = useParams();
  const [model, setModel] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [collections, setCollections] = useState([]);
  const [memberIds, setMemberIds] = useState(() => new Set());

  useEffect(() => {
    setActiveImage(0);
    setModel(null);
    fetchModel(id).then(setModel);
    fetchFavorites().then(({ ids }) => setFavorited(ids.includes(Number(id))));
    fetchCollections().then(setCollections);
    fetchModelCollections(id).then(({ ids }) => setMemberIds(new Set(ids)));
  }, [id]);

  const toggleFavorite = () => {
    const on = !favorited;
    setFavorited(on);
    setFavorite(Number(id), on);
  };

  const toggleCollection = (collectionId) => {
    setMemberIds((prev) => {
      const next = new Set(prev);
      const on = !next.has(collectionId);
      if (on) next.add(collectionId); else next.delete(collectionId);
      setModelInCollection(collectionId, Number(id), on);
      return next;
    });
  };

  if (!model) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-center py-32">
          <span className="loading loading-spinner loading-lg text-faint" />
        </div>
      </div>
    );
  }

  const imageFiles = model.files.filter(f => IMAGE_EXTS.has('.' + f.split('.').pop().toLowerCase()));
  const downloadFiles = model.files.filter(f => !IMAGE_EXTS.has('.' + f.split('.').pop().toLowerCase()));

  return (
    <div className="container mx-auto max-w-7xl px-6 py-6">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1 text-sm text-dim transition-colors hover:text-ink"
      >
        &larr; Back to library
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">{model.title}</h1>
          <button
            onClick={toggleFavorite}
            title={favorited ? 'Remove from favorites' : 'Save to favorites'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors ${
              favorited
                ? 'border-transparent bg-accent text-accent-ink'
                : 'border-line bg-panel text-dim hover:border-accent hover:text-ink'
            }`}
          >
            <Icon name="heart" className="h-[17px] w-[17px]" />
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            {imageFiles.length > 0 && (
              <>
                <div className="aspect-square overflow-hidden rounded-xl border border-line2 bg-panel2">
                  <LoadingImage
                    key={imageFiles[activeImage]}
                    src={fileUrl(model.id, imageFiles[activeImage])}
                    alt={model.title}
                    className="h-full w-full object-contain"
                  />
                </div>
                {imageFiles.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {imageFiles.map((img, i) => (
                      <button
                        key={img}
                        onClick={() => setActiveImage(i)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                          i === activeImage ? 'border-accent' : 'border-transparent hover:border-line'
                        }`}
                      >
                        <LoadingImage
                          src={fileUrl(model.id, img)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-dim">
              <span>{model.creator}</span>
              <span>&middot;</span>
              <span className="font-mono text-[13px]">{model.date}</span>
              {model.patreon_url && (
                <>
                  <span>&middot;</span>
                  <a href={model.patreon_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Patreon
                  </a>
                </>
              )}
            </div>

            {collections.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-faint">Collections</h3>
                <div className="flex flex-wrap gap-2">
                  {collections.map((c) => {
                    const member = memberIds.has(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCollection(c.id)}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                          member ? 'border-line bg-panel text-ink' : 'border-line2 text-dim hover:border-line hover:text-ink'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${c.hue} 58% 60%)` }} />
                        {c.name}
                        {member && <Icon name="plus" className="h-3 w-3 rotate-45 text-faint" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="prose prose-invert prose-sm mb-6 max-h-64 overflow-y-auto whitespace-pre-wrap text-dim">
              {model.content}
            </div>

            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-faint">
              Files ({downloadFiles.length})
            </h3>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {downloadFiles.map(file => (
                <div key={file} className="flex items-center justify-between rounded-lg border border-line2 bg-panel2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {extBadge(file)}
                    <span className="truncate text-sm">{file}</span>
                  </div>
                  <a
                    href={fileUrl(model.id, file)}
                    className="ml-2 shrink-0 text-sm text-accent hover:underline"
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
