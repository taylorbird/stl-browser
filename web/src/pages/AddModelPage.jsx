import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchCreators, scrapeImages, createModel } from '../api';
import { formatSize } from '../utils';
import Icon from '../components/Icon';

function SectionLabel({ children, hint }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between">
      <h3 className="font-mono text-[11px] uppercase tracking-[.2em] text-faint">{children}</h3>
      {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

const FILE_ACCEPT = '.stl,.3mf,.obj,.step,.stp,.zip,.pdf';
const JUNK_RE = /^(\.|Thumbs\.db$|desktop\.ini$)/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
// Mirrors the server-side allowlist (MODEL_FILE_EXTS in api/src/addModel.js).
const MODEL_EXT_RE = /\.(stl|3mf|obj|step|stp|zip|pdf)$/i;

// Drain a directory reader — readEntries returns at most ~100 entries per call.
async function readAllEntries(reader) {
  const out = [];
  for (;;) {
    const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (batch.length === 0) return out;
    out.push(...batch);
  }
}

// Walk a FileSystemEntry (file or directory) into [{ file, path }].
async function walkEntry(entry, prefix = '') {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    return [{ file, path: prefix + file.name }];
  }
  if (entry.isDirectory) {
    const entries = await readAllEntries(entry.createReader());
    const nested = await Promise.all(entries.map((e) => walkEntry(e, `${prefix}${entry.name}/`)));
    return nested.flat();
  }
  return [];
}

// Flatten a drop into [{ file, path }], descending into dropped folders.
// Must be called synchronously from the drop event — entries die after an await.
function filesFromDrop(dataTransfer) {
  const entries = Array.from(dataTransfer.items || [])
    .map((i) => i.webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length === 0) {
    const flat = Array.from(dataTransfer.files).map((file) => ({ file, path: file.name }));
    return Promise.resolve(flat);
  }
  return Promise.all(entries.map((e) => walkEntry(e))).then((r) => r.flat());
}

// Append walked files to prev, skipping exact re-adds and de-colliding names
// (folder structure is flattened — the model folder on disk is a flat file list).
function mergeFiles(prev, walked) {
  const out = [...prev];
  const names = new Set(prev.map((f) => f.name));
  const sigs = new Set(prev.map((f) => `${f.name}:${f.size}`));
  for (const { file, path } of walked) {
    if (sigs.has(`${file.name}:${file.size}`)) continue;
    let name = file.name;
    if (names.has(name)) name = path.split('/').filter(Boolean).join('-');
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 2; names.has(name); n++) name = `${stem}-${n}${ext}`;
    names.add(name);
    sigs.add(`${name}:${file.size}`);
    out.push(name === file.name ? file : new File([file], name, { type: file.type }));
  }
  return out;
}

export default function AddModelPage() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState([]);

  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [creatorFolder, setCreatorFolder] = useState(''); // set when an existing creator is matched
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [modelFiles, setModelFiles] = useState([]);     // File[]
  const [images, setImages] = useState([]);             // { key, kind, file?|url, src, name }
  const [selected, setSelected] = useState(() => new Set());
  const [previewKey, setPreviewKey] = useState(null);

  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const modelInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const keyRef = useRef(0);
  const [modelDragOver, setModelDragOver] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);

  useEffect(() => { fetchCreators().then(setCreators); }, []);
  // Revoke object URLs for uploaded images on unmount.
  useEffect(() => () => images.forEach((i) => i.kind === 'upload' && URL.revokeObjectURL(i.src)), [images]);

  // ── Model files ──
  // Images found in a drop/folder go to the review grid; junk (dotfiles etc.) is skipped.
  const ingestModelFiles = (walked) => {
    const keep = walked.filter(({ file }) => !JUNK_RE.test(file.name));
    const imgs = keep.filter(({ file }) => IMAGE_EXT_RE.test(file.name) || file.type.startsWith('image/'));
    const rest = keep.filter((w) => !imgs.includes(w) && MODEL_EXT_RE.test(w.file.name));
    if (rest.length) setModelFiles((prev) => mergeFiles(prev, rest));
    if (imgs.length) addImageUploads(imgs.map((i) => i.file));
  };
  const removeModelFile = (idx) => setModelFiles((prev) => prev.filter((_, i) => i !== idx));

  // ── Images ──
  const addImageUploads = (list) => {
    const have = new Set(images.filter((i) => i.kind === 'upload').map((i) => `${i.name}:${i.file.size}`));
    const items = Array.from(list)
      .filter((file) => !have.has(`${file.name}:${file.size}`))
      .map((file) => ({
        key: `u${keyRef.current++}`, kind: 'upload', file, src: URL.createObjectURL(file), name: file.name,
      }));
    if (items.length === 0) return;
    setImages((prev) => [...prev, ...items]);
    setSelected((prev) => { const n = new Set(prev); items.forEach((it) => n.add(it.key)); return n; });
    setPreviewKey((pk) => pk ?? items[0]?.key ?? null);
  };

  const onScrape = async () => {
    const url = scrapeUrl.trim();
    if (!url || scraping) return;
    setScraping(true); setScrapeMsg('');
    const res = await scrapeImages(url);
    setScraping(false);
    if (res.error) { setScrapeMsg(res.error); return; }
    const have = new Set(images.filter((i) => i.kind === 'scrape').map((i) => i.url));
    const fresh = (res.images || []).filter((u) => !have.has(u));
    if (fresh.length === 0) { setScrapeMsg('No new images found on that page.'); return; }
    const items = fresh.map((u) => ({ key: `s:${u}`, kind: 'scrape', url: u, src: u, name: u }));
    setImages((prev) => [...prev, ...items]); // scraped default UNchecked — opt in
    setScrapeMsg(`Found ${fresh.length} image${fresh.length > 1 ? 's' : ''} — tick the ones to keep.`);
    if (!sourceUrl) setSourceUrl(url);
  };

  const toggleImage = (key) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(key)) { n.delete(key); if (previewKey === key) setPreviewKey(null); }
    else n.add(key);
    return n;
  });
  const makePreview = (key) => { setSelected((prev) => new Set(prev).add(key)); setPreviewKey(key); };

  const onCreatorChange = (v) => {
    setCreator(v);
    const match = creators.find((c) => c.name.toLowerCase() === v.trim().toLowerCase());
    setCreatorFolder(match ? match.folder : '');
  };

  const selectedCount = images.filter((i) => selected.has(i.key)).length;
  const effectivePreview = previewKey && selected.has(previewKey)
    ? previewKey
    : images.find((i) => selected.has(i.key))?.key || null;
  const canSubmit = title.trim() && creator.trim() && modelFiles.length > 0 && !saving;

  const onSubmit = async () => {
    setError('');
    if (!title.trim() || !creator.trim()) { setError('Title and creator are required.'); return; }
    if (modelFiles.length === 0) { setError('Add at least one model file.'); return; }
    setSaving(true);

    const fd = new FormData();
    fd.set('title', title.trim());
    fd.set('creator', creator.trim());
    if (creatorFolder) fd.set('creatorFolder', creatorFolder);
    if (date) fd.set('date', date);
    if (description.trim()) fd.set('description', description.trim());
    if (sourceUrl.trim()) fd.set('sourceUrl', sourceUrl.trim());
    modelFiles.forEach((f) => fd.append('modelFiles', f));

    const chosen = images.filter((i) => selected.has(i.key));
    fd.set('imageUrls', JSON.stringify(chosen.filter((i) => i.kind === 'scrape').map((i) => i.url)));
    chosen.filter((i) => i.kind === 'upload').forEach((i) => fd.append('images', i.file));

    const pv = images.find((i) => i.key === effectivePreview);
    if (pv) fd.set('preview', pv.kind === 'upload' ? `upload:${pv.file.name}` : `url:${pv.url}`);

    const res = await createModel(fd);
    setSaving(false);
    if (res?.error || !res?.id) { setError(res?.error || 'Failed to create model.'); return; }
    navigate(`/models/${res.id}`);
  };

  const inputCls = 'w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent';

  return (
    <div className="mx-auto max-w-[920px] px-4 pb-24 pt-7 sm:px-6 lg:px-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-ink">
        <Icon name="chevr" className="h-3.5 w-3.5 rotate-180" />
        Back to library
      </Link>

      <h1 className="mb-9 mt-6 font-display text-[30px] font-bold tracking-[-.02em]">Add a model</h1>

      {/* 1 — Images */}
      <section className="mb-10">
        <SectionLabel hint={selectedCount ? `${selectedCount} selected` : 'optional'}>Images</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* From a page URL */}
          <div className="rounded-2xl border border-line2 bg-panel2 p-4">
            <div className="mb-2 text-[12.5px] font-medium text-dim">Fetch from a page URL</div>
            <div className="flex gap-2">
              <input
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onScrape()}
                placeholder="https://…"
                className={inputCls}
              />
              <button
                onClick={onScrape}
                disabled={scraping || !scrapeUrl.trim()}
                className="shrink-0 rounded-[10px] border border-line bg-panel px-3.5 py-2.5 text-[13px] text-ink transition-colors hover:border-accent disabled:opacity-40"
              >
                {scraping ? '…' : 'Fetch'}
              </button>
            </div>
            {scrapeMsg && <p className="mt-2 text-[12px] text-faint">{scrapeMsg}</p>}
          </div>
          {/* Upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setImageDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault(); setImageDragOver(false);
              filesFromDrop(e.dataTransfer).then((walked) => addImageUploads(
                walked.map((w) => w.file).filter((f) => IMAGE_EXT_RE.test(f.name) || f.type.startsWith('image/'))
              ));
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center transition-colors ${
              imageDragOver ? 'border-accent bg-accent-dim' : 'border-line bg-panel2'
            }`}
          >
            <p className="text-[12.5px] text-dim">Drag images, or</p>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="mt-2 rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] text-ink transition-colors hover:border-accent"
            >
              Upload images
            </button>
            <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={(e) => { addImageUploads(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {/* Review grid — pick which to keep; star = preview */}
        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {images.map((img) => {
              const on = selected.has(img.key);
              const isPreview = effectivePreview === img.key;
              return (
                <div
                  key={img.key}
                  className={`group relative aspect-square overflow-hidden rounded-xl border transition-all ${
                    on ? 'border-accent' : 'border-line2 opacity-55 hover:opacity-100'
                  }`}
                >
                  <img src={img.src} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => toggleImage(img.key)} className="absolute inset-0" title={on ? 'Deselect' : 'Select'} />
                  {/* checkbox */}
                  <span className={`pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-accent-ink ${
                    on ? 'border-accent bg-accent' : 'border-white/60 bg-black/40'
                  }`}>
                    {on && <Icon name="chevr" className="h-3 w-3 rotate-90" />}
                  </span>
                  {/* preview star */}
                  <button
                    onClick={() => makePreview(img.key)}
                    title="Use as preview"
                    className={`absolute right-2 top-2 rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[.1em] transition-colors ${
                      isPreview ? 'bg-accent text-accent-ink' : 'bg-black/55 text-white opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isPreview ? 'Preview' : 'Set'}
                  </button>
                  <span className="absolute bottom-1.5 left-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] uppercase text-white/70">
                    {img.kind}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2 — Details */}
      <section className="mb-10">
        <SectionLabel>Details</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-dim">Title <span className="text-accent">*</span></span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dragon Bust" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-dim">Creator <span className="text-accent">*</span></span>
            <input list="creator-options" value={creator} onChange={(e) => onCreatorChange(e.target.value)}
              placeholder="Pick existing or type new" className={inputCls} />
            <datalist id="creator-options">
              {creators.map((c) => <option key={c.folder} value={c.name} />)}
            </datalist>
            <span className="mt-1 block font-mono text-[10.5px] text-faint">
              {creatorFolder ? `existing → ${creatorFolder}/` : creator.trim() ? 'new creator' : ''}
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-dim">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-dim">Source URL</span>
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[12.5px] text-dim">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              placeholder="Markdown supported…" className={`${inputCls} resize-y`} />
          </label>
        </div>
      </section>

      {/* 3 — Model files (last — the file list grows long, keep it from burying the form) */}
      <section className="mb-10">
        <SectionLabel hint={modelFiles.length ? `${modelFiles.length} file${modelFiles.length > 1 ? 's' : ''}` : 'required'}>
          Model files
        </SectionLabel>
        <div
          onDragOver={(e) => { e.preventDefault(); setModelDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setModelDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setModelDragOver(false); filesFromDrop(e.dataTransfer).then(ingestModelFiles); }}
          className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
            modelDragOver ? 'border-accent bg-accent-dim' : 'border-line bg-panel2'
          }`}
        >
          <Icon name="download" className="mb-3 h-6 w-6 rotate-180 text-faint" />
          <p className="text-sm text-dim">Drag &amp; drop files or a folder here</p>
          <p className="mt-1 font-mono text-[11px] text-faint">folders are flattened · images inside go to the image grid</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => modelInputRef.current?.click()}
              className="rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] text-ink transition-colors hover:border-accent"
            >
              Choose files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] text-dim transition-colors hover:border-accent hover:text-ink"
            >
              Choose a folder
            </button>
          </div>
          <input ref={modelInputRef} type="file" multiple accept={FILE_ACCEPT} className="hidden"
            onChange={(e) => { ingestModelFiles(Array.from(e.target.files).map((file) => ({ file, path: file.name }))); e.target.value = ''; }} />
          <input ref={folderInputRef} type="file" webkitdirectory="" className="hidden"
            onChange={(e) => { ingestModelFiles(Array.from(e.target.files).map((file) => ({ file, path: file.webkitRelativePath || file.name }))); e.target.value = ''; }} />
        </div>
        {modelFiles.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {modelFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-line2 bg-panel2 px-[15px] py-3">
                <span className="shrink-0 rounded-md bg-accent-dim px-2 py-1 font-mono text-[10px] uppercase text-accent">
                  {(f.name.split('.').pop() || '?').slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{f.name}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-faint">{formatSize(f.size)}</div>
                </div>
                <button onClick={() => removeModelFile(i)} className="shrink-0 text-faint hover:text-ink" title="Remove">
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-[11px] bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add to library'}
        </button>
        <Link to="/" className="rounded-[11px] border border-line bg-panel px-5 py-3 text-sm text-dim transition-colors hover:text-ink">
          Cancel
        </Link>
      </div>
    </div>
  );
}
