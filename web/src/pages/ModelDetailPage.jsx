import { useState, useEffect, useRef } from 'react';
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
  const filesRef = useRef(null);

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
    setFavorite(Number(id), on).then((r) => {
      if (r?.error) setFavorited(!on); // write rejected — revert
    });
  };

  const toggleCollection = (collectionId) => {
    setMemberIds((prev) => {
      const next = new Set(prev);
      const on = !next.has(collectionId);
      if (on) next.add(collectionId); else next.delete(collectionId);
      setModelInCollection(collectionId, Number(id), on).then((r) => {
        if (r?.error) {
          setMemberIds((cur) => {
            const reverted = new Set(cur);
            if (on) reverted.delete(collectionId); else reverted.add(collectionId);
            return reverted;
          });
        }
      });
      return next;
    });
  };

  const handleCreateCollection = async (name, hue) => {
    setShowNewCollection(false);
    const created = await createCollection(name, hue);
    if (created?.error || !created?.id) return;
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
  // Distinct downloadable file types, .stl first, for the badges under the Download button.
  const fileTypes = [...new Set(downloadFiles.map((f) => ext(f.name).slice(1).toUpperCase()))]
    .sort((a, b) => (a === 'STL' ? -1 : b === 'STL' ? 1 : a.localeCompare(b)));

  const scrollToFiles = () => filesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const creatorFolder = model.folder_path.split('/')[0];
  const memberCollections = collections.filter((c) => memberIds.has(c.id));
  const aboutHtml = descriptionHtml(model.content);

  // Bento gallery: active image is the hero; next 4 fill the side matrix; the rest go below.
  const otherImages = imageFiles.map((img, i) => ({ img, i })).filter(({ i }) => i !== activeImage);
  const sideImages = otherImages.slice(0, 4);
  const extraImages = otherImages.slice(4);

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
        {/* Breadcrumb — own line so the title and actions cluster start at the same height */}
        <div className="mb-3 mt-6 font-mono text-[11px] uppercase tracking-[.2em] text-faint">
          <Link to="/" className="transition-colors hover:text-dim">Library</Link>
          <span className="mx-2 opacity-60">/</span>
          {model.creator}
        </div>

        {/* Header row — title wraps at ~hero's right edge; actions top-aligned with title */}
        <div className="mb-8 flex items-start justify-between gap-10 max-md:flex-col">
          <div className="min-w-0 max-w-[63%] max-md:max-w-full">
            <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-.02em]">
              {model.title}
            </h1>
            {/* Subtitle: creator · source · added */}
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[13.5px] text-dim">
              <span className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-gradient-to-br from-panel to-panel2 font-mono text-[8px] text-dim">
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
                <span className="font-medium text-ink">{model.creator}</span>
              </span>
              <span className="opacity-50">·</span>
              {model.patreon_url ? (
                <a href={model.patreon_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {/patreon\.com/i.test(model.patreon_url) ? 'Patreon ↗' : 'Source ↗'}
                </a>
              ) : (
                <span>Local library</span>
              )}
              <span className="opacity-50">·</span>
              <span>
                Added <span className="font-mono text-[12.5px]">{model.indexed_at?.slice(0, 10) || '—'}</span>
              </span>
            </div>
          </div>

          {/* Actions cluster */}
          <div className="flex shrink-0 items-start gap-2.5">
            {downloadFiles.length > 0 && (
              <div className="flex flex-col items-stretch gap-2">
                <button
                  onClick={scrollToFiles}
                  className="flex items-center justify-center gap-2.5 rounded-[11px] bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
                >
                  <Icon name="download" className="h-4 w-4" />
                  Download
                  <span className="rounded-md bg-accent-ink/10 px-1.5 py-0.5 font-mono text-[11px] font-normal">
                    {downloadFiles.length}
                  </span>
                </button>
                {fileTypes.length > 0 && (
                  <div className="flex flex-wrap justify-start gap-1.5">
                    {fileTypes.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-accent-dim px-2 py-1 font-mono text-[10px] uppercase tracking-[.04em] text-accent"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
            <div className="relative">
              <button
                onClick={() => setAddOpen((x) => !x)}
                title="Add to collection"
                className={`flex h-[46px] w-[46px] items-center justify-center rounded-[11px] border transition-colors ${
                  memberCollections.length > 0
                    ? 'border-accent bg-accent-dim text-accent'
                    : 'border-line bg-panel text-dim hover:border-accent hover:text-ink'
                }`}
              >
                <Icon name="layers" className="h-[18px] w-[18px]" />
              </button>
              {addOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 min-w-52 rounded-xl border border-line bg-canvas p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.4)]">
                  {collections.map((c) => {
                    const on = memberIds.has(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCollection(c.id)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-dim transition-colors hover:bg-panel hover:text-ink"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${c.hue} 58% 60%)` }} />
                        <span className="flex-1">{c.name}</span>
                        {on && <Icon name="chevr" className="h-3 w-3 rotate-90 text-accent" />}
                      </button>
                    );
                  })}
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
        </div>

        {/* Gallery — homepage-style bento: hero + side matrix, extras below */}
        {imageFiles.length > 0 ? (
          <>
            <div
              className={otherImages.length > 0
                ? 'flex flex-col gap-3.5 min-[1180px]:flex-row'
                : ''}
            >
              <div
                className={`relative overflow-hidden rounded-2xl border border-line2 ${
                  otherImages.length > 0
                    ? 'h-[260px] min-[1180px]:h-auto min-[1180px]:aspect-[4/3] min-[1180px]:flex-[1.7]'
                    : 'h-[300px] sm:h-[420px]'
                }`}
              >
                <LoadingImage
                  key={imageFiles[activeImage]}
                  src={fileUrl(model.id, imageFiles[activeImage])}
                  alt={model.title}
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,8,11,.85)] from-0% via-[rgba(7,8,11,.2)] via-[30%] to-transparent to-[50%]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
                  <div className="flex items-center gap-2.5 text-[13px] text-white/70">
                    <span>{model.date}</span>
                    {stls.length > 0 && (
                      <span className="rounded-md bg-[rgba(231,177,90,.18)] px-2 py-1 font-mono text-[10.5px] uppercase tracking-[.04em] text-accent">
                        <b>{stls.length}</b> STL{stls.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {sideImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3.5 min-[1180px]:flex-1 min-[1180px]:grid-rows-2">
                  {sideImages.map(({ img, i }) => (
                    <button
                      key={img}
                      onClick={() => setActiveImage(i)}
                      className="group relative block aspect-square overflow-hidden rounded-[14px] border border-line2 transition-colors hover:border-accent min-[1180px]:aspect-auto"
                    >
                      <LoadingImage
                        src={fileUrl(model.id, img)}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {extraImages.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {extraImages.map(({ img, i }) => (
                  <button
                    key={img}
                    onClick={() => setActiveImage(i)}
                    className="h-[96px] w-[96px] overflow-hidden rounded-xl border border-line2 transition-colors hover:border-accent"
                  >
                    <LoadingImage src={fileUrl(model.id, img)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-[260px] items-center justify-center rounded-2xl border border-line2 bg-panel2 text-sm text-faint">
            No preview
          </div>
        )}

        {/* Collections — membership display (add/remove lives in the bookmark button up top) */}
        {memberCollections.length > 0 && (
          <section className="mt-8">
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
            </div>
          </section>
        )}

        {/* About — full width under the hero */}
        {aboutHtml && (
          <section className="mt-10 max-w-[820px]">
            <SectionLabel>About</SectionLabel>
            <div className="prose-manifold" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
          </section>
        )}

        {/* Files — under About, dense grid */}
        {downloadFiles.length > 0 && (
          <section ref={filesRef} className="mt-10 scroll-mt-6">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-[.2em] text-faint">
                Files ({downloadFiles.length}) · {formatSize(totalSize)}
              </h3>
              <button onClick={downloadAll} className="text-sm text-accent hover:underline">
                Download all
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {downloadFiles.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-2.5 rounded-xl border border-line2 bg-panel2 px-3 py-2"
                >
                  <span className="shrink-0 rounded-md bg-accent-dim px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-accent">
                    {ext(f.name).slice(1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]" title={f.name}>{f.name}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-faint">{formatSize(f.size)}</span>
                  <a
                    href={fileUrl(model.id, f.name)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11.5px] text-dim transition-colors hover:border-accent hover:text-ink"
                  >
                    <Icon name="download" className="h-3 w-3" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </motion.div>

      {showNewCollection && (
        <CollectionDialog onCreate={handleCreateCollection} onDismiss={() => setShowNewCollection(false)} />
      )}
    </div>
  );
}
