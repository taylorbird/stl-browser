import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { marked } from 'marked';
import {
  fetchModel, fileUrl, creatorLogoUrl,
  fetchFavorites, setFavorite,
  fetchCollections, createCollection, fetchModelCollections, setModelInCollection,
} from '../api';
import { monogram, formatSize } from '../utils';
import LoadingImage from '../components/LoadingImage';
import CollectionDialog from '../components/CollectionDialog';
import Icon from '../components/Icon';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ext = (f) => '.' + f.split('.').pop().toLowerCase();

// The H1 title is rendered separately — drop a leading markdown heading from the description.
// Generated metadata.md also ends with "## Files" / "## Preview" listings that duplicate
// the Files UI — cut the description off at the first of those headings.
function descriptionHtml(content) {
  const stripped = (content || '')
    .replace(/^\s*#[^\n]*\n+/, '')
    .split(/^##\s*(?:Files|Preview)\s*$/m)[0];
  if (!stripped.trim()) return null;
  return marked.parse(stripped, { breaks: true });
}

function SectionLabel({ children }) {
  return (
    <h3 className="mb-3.5 font-mono text-[11px] uppercase tracking-[.2em] text-faint">{children}</h3>
  );
}

export default function ModelDetailPage() {
  const { id } = useParams();
  const [model, setModel] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [collections, setCollections] = useState([]);
  const [memberIds, setMemberIds] = useState(() => new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setActiveImage(0);
    setModel(null);
    setLogoError(false);
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

  const handleCreateCollection = async (name, hue) => {
    setShowNewCollection(false);
    const created = await createCollection(name, hue);
    setCollections((prev) => [...prev, created]);
    toggleCollection(created.id);
  };

  if (!model) {
    return (
      <div className="mx-auto max-w-[1280px] px-12 pb-20 pt-[30px]">
        <div className="flex items-center justify-center py-32">
          <span className="loading loading-spinner loading-lg text-faint" />
        </div>
      </div>
    );
  }

  const imageFiles = model.files.filter((f) => IMAGE_EXTS.has(ext(f)));
  const downloadFiles = (model.fileDetails || model.files.map((name) => ({ name, size: null })))
    .filter((f) => !IMAGE_EXTS.has(ext(f.name)));
  const stls = downloadFiles.filter((f) => ext(f.name) === '.stl');
  const totalSize = downloadFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const creatorFolder = model.folder_path.split('/')[0];
  const memberCollections = collections.filter((c) => memberIds.has(c.id));
  const nonMemberCollections = collections.filter((c) => !memberIds.has(c.id));
  const aboutHtml = descriptionHtml(model.content);

  const downloadAll = () => {
    for (const f of stls.length ? stls : downloadFiles) {
      const a = document.createElement('a');
      a.href = fileUrl(model.id, f.name);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-12 pb-20 pt-[30px] max-md:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-ink"
      >
        <Icon name="chevr" className="h-3.5 w-3.5 rotate-180" />
        Back to library
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header row */}
        <div className="mb-10 mt-6 flex items-start justify-between gap-6 max-md:flex-col">
          <div className="min-w-0">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[.2em] text-faint">
              <Link to="/" className="transition-colors hover:text-dim">Library</Link>
              <span className="mx-2 opacity-60">/</span>
              {model.creator}
            </div>
            <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-.02em]">
              {model.title}
            </h1>
            <div className="mt-3.5 flex items-center gap-2.5">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-gradient-to-br from-panel to-panel2 font-mono text-[10px] text-dim">
                {!logoError ? (
                  <img
                    src={creatorLogoUrl(creatorFolder)}
                    alt=""
                    onError={() => setLogoError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  monogram(model.creator)
                )}
              </span>
              <span className="text-[14.5px] font-medium">{model.creator}</span>
              <span className="text-dim">·</span>
              <span className="font-mono text-xs text-dim">{model.date}</span>
            </div>
          </div>

          {/* Actions cluster */}
          <div className="flex shrink-0 items-center gap-2.5">
            {downloadFiles.length > 0 && (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2.5 rounded-[11px] bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                <Icon name="download" className="h-4 w-4" />
                Download
                {stls.length > 0 && (
                  <span className="font-mono text-[10.5px] font-normal opacity-60">.stl</span>
                )}
              </button>
            )}
            <button
              onClick={toggleFavorite}
              title={favorited ? 'Remove from favorites' : 'Save to favorites'}
              className={`flex h-[46px] w-[46px] items-center justify-center rounded-[11px] border transition-colors ${
                favorited
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-line bg-panel text-dim hover:border-accent hover:text-ink'
              }`}
            >
              <Icon name="heart" className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(340px,1fr)] items-start gap-11 max-[940px]:grid-cols-1">
          {/* Gallery */}
          <div className="min-w-0">
            {imageFiles.length > 0 ? (
              <>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line2">
                  <LoadingImage
                    key={imageFiles[activeImage]}
                    src={fileUrl(model.id, imageFiles[activeImage])}
                    alt={model.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                {imageFiles.length > 1 && (
                  <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-2">
                    {imageFiles.map((img, i) => (
                      <button
                        key={img}
                        onClick={() => setActiveImage(i)}
                        className={`h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl border transition-colors ${
                          i === activeImage
                            ? 'border-accent ring-1 ring-accent'
                            : 'border-line2 hover:border-line'
                        }`}
                      >
                        <LoadingImage src={fileUrl(model.id, img)} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-line2 bg-panel2 text-sm text-faint">
                No preview
              </div>
            )}
          </div>

          {/* Info rail */}
          <div className="min-w-0">
            {aboutHtml && (
              <section className="mb-9">
                <SectionLabel>About</SectionLabel>
                <div className="prose-manifold" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
              </section>
            )}

            <section className="mb-9">
              <SectionLabel>Files ({downloadFiles.length})</SectionLabel>
              <div className="flex flex-col gap-2">
                {downloadFiles.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-3 rounded-xl border border-line2 bg-panel2 px-[15px] py-[13px]"
                  >
                    <span className="shrink-0 rounded-md bg-accent-dim px-2 py-1 font-mono text-[10px] uppercase text-accent">
                      {ext(f.name).slice(1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{f.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-faint">
                        {formatSize(f.size)} · {ext(f.name).slice(1).toUpperCase()}
                      </div>
                    </div>
                    <a
                      href={fileUrl(model.id, f.name)}
                      className="shrink-0 text-sm text-accent hover:underline"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-9">
              <SectionLabel>Collections</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {memberCollections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCollection(c.id)}
                    title="Remove from collection"
                    className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5 text-[12.5px] text-ink transition-colors hover:border-accent"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${c.hue} 58% 60%)` }} />
                    {c.name}
                  </button>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setAddOpen((x) => !x)}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 py-1.5 text-[12.5px] text-dim transition-colors hover:border-accent hover:text-ink"
                  >
                    <Icon name="plus" className="h-3 w-3" />
                    Add to collection
                  </button>
                  {addOpen && (
                    <div className="absolute left-0 top-full z-10 mt-2 min-w-44 rounded-xl border border-line bg-canvas p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.4)]">
                      {nonMemberCollections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { toggleCollection(c.id); setAddOpen(false); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-dim transition-colors hover:bg-panel hover:text-ink"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${c.hue} 58% 60%)` }} />
                          {c.name}
                        </button>
                      ))}
                      <button
                        onClick={() => { setAddOpen(false); setShowNewCollection(true); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-dim transition-colors hover:bg-panel hover:text-ink"
                      >
                        <Icon name="plus" className="h-3 w-3" />
                        New collection…
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section>
              <SectionLabel>Details</SectionLabel>
              <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2.5">
                <dt className="font-mono text-[11px] uppercase tracking-[.15em] text-faint">Creator</dt>
                <dd className="text-sm">{model.creator}</dd>
                <dt className="font-mono text-[11px] uppercase tracking-[.15em] text-faint">Source</dt>
                <dd className="text-sm">
                  {model.patreon_url ? (
                    <a href={model.patreon_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Patreon ↗
                    </a>
                  ) : (
                    'Local library'
                  )}
                </dd>
                <dt className="font-mono text-[11px] uppercase tracking-[.15em] text-faint">Added</dt>
                <dd className="font-mono text-[13px]">{model.indexed_at?.slice(0, 10) || '—'}</dd>
                <dt className="font-mono text-[11px] uppercase tracking-[.15em] text-faint">Files</dt>
                <dd className="text-sm">
                  {downloadFiles.length} · <span className="font-mono text-[13px]">{formatSize(totalSize)}</span>
                </dd>
              </dl>
            </section>
          </div>
        </div>
      </motion.div>

      {showNewCollection && (
        <CollectionDialog onCreate={handleCreateCollection} onDismiss={() => setShowNewCollection(false)} />
      )}
    </div>
  );
}
