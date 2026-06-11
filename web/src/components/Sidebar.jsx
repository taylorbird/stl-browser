import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchMe, creatorLogoUrl } from '../api';
import { monogram } from '../utils';
import Icon from './Icon';

function NavItem({ icon, label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left transition-colors ${
        active ? 'bg-accent-dim text-ink' : 'text-dim hover:bg-panel hover:text-ink'
      }`}
    >
      <Icon name={icon} className={`h-[17px] w-[17px] shrink-0 ${active ? 'text-accent' : 'text-faint'}`} />
      <span className="flex-1 truncate text-[13.5px]">{label}</span>
      {count != null && (
        <span className={`font-mono text-[10.5px] ${active ? 'text-accent' : 'text-faint'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div className="mb-[11px] flex items-center justify-between px-[11px] font-mono text-[10px] uppercase tracking-[.2em] text-faint">
      <span>{children}</span>
      {right}
    </div>
  );
}

const CREATORS_COLLAPSED = 6;

export default function Sidebar({
  view, onViewChange, counts, collections, creators,
  q, onSearch, onNewCollection, onOpenSettings, open = false, onClose,
}) {
  const [owner, setOwner] = useState(null);
  const [creatorsExpanded, setCreatorsExpanded] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { fetchMe().then(setOwner); }, []);

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleCreators = creatorsExpanded ? creators : creators.slice(0, CREATORS_COLLAPSED);
  const ownerLabel = owner?.name || owner?.email || 'Library owner';

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] shrink-0 flex-col border-r border-line bg-canvas px-3.5 py-[18px] transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand */}
      <div className="mb-5 flex items-center gap-[11px] px-1.5 py-1">
        <span className="relative h-7 w-7 shrink-0 rounded-lg bg-accent">
          <span className="absolute inset-[7px] rotate-45 rounded-[2px] border-[1.5px] border-accent-ink" />
        </span>
        <span className="font-display text-[17px] font-bold tracking-[.15em]">CURIO</span>
        {/* Close (drawer only) */}
        <button
          onClick={onClose}
          title="Close menu"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-dim hover:bg-panel hover:text-ink lg:hidden"
        >
          <Icon name="close" className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Search */}
      <div className="mb-[22px] flex items-center gap-[9px] rounded-[10px] border border-line bg-panel px-3 py-2.5 transition-colors focus-within:border-accent hover:border-accent">
        <Icon name="search" className="h-4 w-4 shrink-0 text-faint" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
        <kbd className="rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim">⌘K</kbd>
      </div>

      {/* Add model */}
      <Link
        to="/add"
        onClick={onClose}
        className="mb-[18px] flex items-center justify-center gap-2 rounded-[10px] border border-accent/50 bg-accent-dim px-3 py-2.5 text-[13px] font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
      >
        <Icon name="plus" className="h-4 w-4" />
        Add model
      </Link>

      {/* Library nav */}
      <nav className="mb-6 flex flex-col gap-0.5">
        <NavItem icon="grid" label="All models" count={counts?.all} active={view.type === 'all'} onClick={() => onViewChange({ type: 'all' })} />
        <NavItem icon="clock" label="Recently added" count={counts?.recent} active={view.type === 'recent'} onClick={() => onViewChange({ type: 'recent' })} />
        <NavItem icon="heart" label="Favorites" count={counts?.favorites} active={view.type === 'favorites'} onClick={() => onViewChange({ type: 'favorites' })} />
        <NavItem icon="alert" label="Missing files" count={counts?.missing} active={view.type === 'missing'} onClick={() => onViewChange({ type: 'missing' })} />
      </nav>

      {/* Collections */}
      <div className="mb-[22px]">
        <SectionLabel
          right={
            <button onClick={onNewCollection} className="flex text-dim hover:text-ink" title="New collection">
              <Icon name="plus" className="h-[13px] w-[13px]" />
            </button>
          }
        >
          Collections
        </SectionLabel>
        <div className="flex flex-col gap-px">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => onViewChange({ type: 'collection', id: c.id, name: c.name })}
              className={`flex w-full items-center gap-[11px] rounded-lg px-[11px] py-2 text-left text-[13.5px] transition-colors ${
                view.type === 'collection' && view.id === c.id ? 'bg-panel text-ink' : 'text-dim hover:bg-panel'
              }`}
            >
              <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: `hsl(${c.hue} 58% 60%)` }} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[10px] text-faint">{c.count}</span>
            </button>
          ))}
          <button onClick={onNewCollection} className="flex w-full items-center gap-[11px] rounded-lg px-[11px] py-2 text-left text-[13.5px] text-dim transition-colors hover:bg-panel">
            <span className="-mx-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-dashed border-line text-faint">
              <Icon name="plus" className="h-[9px] w-[9px]" />
            </span>
            <span className="flex-1">New collection</span>
          </button>
        </div>
      </div>

      {/* Creators — flexible, scrolls */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SectionLabel right={<span className="text-dim">{creators.length}</span>}>Creators</SectionLabel>
        <div className="sidebar-scroll flex flex-col gap-px overflow-y-auto">
          {visibleCreators.map((c) => {
            const active = view.type === 'creator' && view.creator === c.name;
            return (
              <button
                key={c.name}
                onClick={() => onViewChange({ type: 'creator', creator: c.name })}
                className={`flex w-full items-center gap-2.5 rounded-lg px-[11px] py-1.5 text-left text-[13px] transition-colors ${
                  active ? 'bg-panel text-ink' : 'text-dim hover:bg-panel'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-panel2 font-mono text-[9px] text-dim">
                  {c.hasLogo ? (
                    <img src={creatorLogoUrl(c.folder)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    monogram(c.name)
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-faint">{c.count}</span>
              </button>
            );
          })}
          {creators.length > CREATORS_COLLAPSED && (
            <button
              onClick={() => setCreatorsExpanded((x) => !x)}
              className="px-[11px] pb-0.5 pt-2 text-left text-xs text-accent"
            >
              {creatorsExpanded ? 'Show less ‹' : `Show all ${creators.length} ›`}
            </button>
          )}
        </div>
      </div>

      {/* Owner footer */}
      <div className="mt-3.5 flex items-center gap-2.5 border-t border-line px-[11px] pb-0.5 pt-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-[9px] font-bold text-accent-ink">
          {ownerLabel[0].toUpperCase()}
        </span>
        <span className="truncate text-[13px] text-dim">{ownerLabel}</span>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="ml-auto flex shrink-0 text-faint opacity-60 transition-opacity hover:text-ink hover:opacity-100"
        >
          <Icon name="sliders" className="h-[17px] w-[17px]" />
        </button>
      </div>
    </aside>
  );
}
