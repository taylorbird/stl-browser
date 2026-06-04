/* sidebars.js — sidebar/rail explorations for the MANIFOLD (refined dark) system.
   Depends on window.STL for CREATORS + theme vars. Exposes window.SIDEBARS. */
(function () {
  const VARS = () => Object.entries(window.STL.themes.refinedDark.vars).map(([k, v]) => '--' + k + ':' + v).join(';') + ';--shotInk:rgba(255,255,255,.7)';
  const C = window.STL.CREATORS;
  const COUNTS = [318, 142, 96, 211, 64, 173, 88, 127, 59, 142];
  const MAX = 318;

  const P = {
    grid: '<rect x="2.3" y="2.3" width="5.6" height="5.6" rx="1.2"/><rect x="10.1" y="2.3" width="5.6" height="5.6" rx="1.2"/><rect x="2.3" y="10.1" width="5.6" height="5.6" rx="1.2"/><rect x="10.1" y="10.1" width="5.6" height="5.6" rx="1.2"/>',
    clock: '<circle cx="9" cy="9" r="6.6"/><path d="M9 5.2V9l2.6 1.6"/>',
    bookmark: '<path d="M4.5 2.8h9v12.4l-4.5-3-4.5 3z"/>',
    alert: '<path d="M9 2.6l6.6 11.8H2.4z"/><path d="M9 7.2v3.4M9 12.6v.05"/>',
    hash: '<path d="M6.4 2.8L4.8 15.2M13.2 2.8l-1.6 12.4M3.4 6.4h11.2M2.8 11.6H14"/>',
    folder: '<path d="M2.6 4.6h4l1.4 1.8h5.4v7.4H2.6z"/>',
    users: '<circle cx="9" cy="6" r="2.8"/><path d="M3.4 15.4c0-3 2.5-5 5.6-5s5.6 2 5.6 5"/>',
    sliders: '<path d="M3 5.4h7M13 5.4h2M3 12.6h2M8 12.6h7"/><circle cx="11.5" cy="5.4" r="1.6"/><circle cx="5.5" cy="12.6" r="1.6"/>',
    search: '<circle cx="7.8" cy="7.8" r="5"/><path d="M11.5 11.5l3 3"/>',
    check: '<path d="M3.5 8.6l3 3 6-6.6"/>',
    plus: '<path d="M9 3.5v11M3.5 9h11"/>',
    box: '<path d="M9 2.5l6 3.3v6.4L9 15.5l-6-3.3V5.8z"/><path d="M3 5.8l6 3.3 6-3.3M9 9.1v6.4"/>',
    heart: '<path d="M9 15S2.6 11 2.6 6.6A3 3 0 0 1 9 5a3 3 0 0 1 6.4 1.6C15.4 11 9 15 9 15z"/>',
    chev: '<path d="M4.5 7l4.5 4.5L13.5 7"/>',
    chevr: '<path d="M7 4.5L11.5 9 7 13.5"/>',
    layers: '<path d="M9 2.5l6.5 3.4L9 9.3 2.5 5.9z"/><path d="M2.5 9l6.5 3.4L15.5 9"/><path d="M2.5 12.1l6.5 3.4 6.5-3.4"/>',
  };
  function ic(n) { return '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + P[n] + '</svg>'; }

  function brand(small) {
    return '<div class="sb-brand"><span class="brand-mark"></span>' + (small ? '' : '<span class="brand-name">MANIFOLD</span>') + '</div>';
  }
  function searchbox() {
    return '<div class="sb-search"><span class="sb-sic">' + ic('search') + '</span><span class="sb-sp">Search\u2026</span><span class="kbd">\u2318K</span></div>';
  }
  function ni(icon, label, count, on) {
    return '<div class="ni' + (on ? ' ni--on' : '') + '"><span class="ni-ic">' + ic(icon) + '</span><span class="ni-l">' + label + '</span>' + (count ? '<span class="ni-n">' + count + '</span>' : '') + '</div>';
  }
  function makerRow(c, i, on) {
    return '<div class="mk' + (on ? ' mk--on' : '') + '"><span class="mk-mono">' + c.mono + '</span><span class="mk-name">' + c.name + '</span><span class="mk-n">' + COUNTS[i] + '</span></div>';
  }

  // A — Standard
  function std() {
    return '<div class="sb sb--std" style="' + VARS() + '">' +
      brand() + searchbox() +
      '<nav class="sb-nav">' + ni('grid', 'All models', '1,339', true) + ni('clock', 'Recently added', '24') + ni('bookmark', 'Saved', '18') + ni('alert', 'Missing files', '7') + '</nav>' +
      '<div class="sb-group"><div class="sb-lab sb-lab--row">Creators <span class="sb-lab-n">10</span></div><div class="sb-makers">' +
        C.slice(0, 7).map((c, i) => makerRow(c, i, i === 0)).join('') + '<div class="mk mk--more">Show all 10 \u203a</div></div></div>' +
      '<div class="sb-foot"><span class="mk-mono" style="background:var(--accent);color:var(--accentInk);border:none">A</span><span class="sb-foot-name">Library owner</span><span class="ni-ic" style="margin-left:auto;opacity:.6">' + ic('sliders') + '</span></div>' +
      '</div>';
  }

  // B — Icon rail (collapsed)
  function rail() {
    const btn = (icon, on, tip) => '<button class="rb' + (on ? ' rb--on' : '') + '">' + ic(icon) + (tip ? '<span class="rb-tip">' + tip + '</span>' : '') + '</button>';
    return '<div class="sb sb--rail" style="' + VARS() + '">' +
      '<div class="rail-top"><span class="brand-mark"></span>' +
      '<div class="rail-nav">' + btn('grid', true) + btn('clock') + btn('bookmark') + btn('hash') + btn('users') + '</div></div>' +
      '<div class="rail-foot">' + btn('sliders') + '<span class="rail-av">A</span></div>' +
      '</div>';
  }

  // C — Creator-forward
  function creators() {
    const rows = C.map((c, i) => {
      const w = Math.round(COUNTS[i] / MAX * 100);
      return '<div class="cf' + (i === 0 ? ' cf--on' : '') + '"><span class="cf-av" style="--sh:' + ((i * 41 + 20) % 360) + '">' + c.mono + '</span>' +
        '<div class="cf-main"><div class="cf-name">' + c.name + '</div><div class="cf-bar"><i style="width:' + w + '%"></i></div></div>' +
        '<span class="cf-n">' + COUNTS[i] + '</span></div>';
    }).join('');
    return '<div class="sb sb--creators" style="' + VARS() + '">' +
      brand() + searchbox() +
      '<nav class="sb-nav sb-nav--mini">' + ni('grid', 'All models', '1,339', true) + ni('bookmark', 'Saved', '18') + '</nav>' +
      '<div class="sb-lab sb-lab--row">Browse by creator <span class="sb-lab-n">10</span></div>' +
      '<div class="cf-list">' + rows + '</div></div>';
  }

  // D — Faceted filters
  function filters() {
    const cats = [['Functional', 412, true], ['Desk', 188, true], ['Gridfinity', 96, false], ['Flexi', 64, false], ['Decor', 173, false], ['Keychains', 88, false]];
    const cb = ([l, n, on]) => '<label class="cb' + (on ? ' cb--on' : '') + '"><span class="cbx">' + (on ? ic('check') : '') + '</span><span class="cb-l">' + l + '</span><span class="cb-n">' + n + '</span></label>';
    return '<div class="sb sb--filter" style="' + VARS() + '">' +
      '<div class="fl-head"><span class="fl-title">Filters</span><span class="fl-reset">Reset</span></div>' +
      '<div class="fl-sec"><div class="fl-lab">Sort</div><div class="seg"><button class="seg--on">Shuffle</button><button>Newest</button><button>A\u2013Z</button></div></div>' +
      '<div class="fl-sec"><div class="fl-lab">Files</div>' +
        '<div class="tg"><span>Has STL files</span><span class="sw sw--on"><i></i></span></div>' +
        '<div class="tg"><span>Hide duplicates</span><span class="sw"><i></i></span></div></div>' +
      '<div class="fl-sec"><div class="fl-lab">Category</div>' + cats.map(cb).join('') + '</div>' +
      '<div class="fl-sec"><div class="fl-lab">Creator</div>' +
        cb(['3DDb', 318, true]) + cb(['Studio Loup', 173, false]) + cb(['Koza Design', 211, false]) +
        '<div class="fl-more">Show all 10 \u203a</div></div>' +
      '<div class="fl-foot"><span class="fl-count">1,204 results</span><button class="fl-apply">Apply</button></div>' +
      '</div>';
  }

  // E — Collections + tags
  function collections() {
    const colls = [['To print', 42, 230], ['Printed', 118, 150], ['Gift ideas', 16, 30], ['Cosplay build', 9, 300]];
    const cr = ([l, n, h]) => '<div class="co"><span class="co-dot" style="background:hsl(' + h + ' 55% 60%)"></span><span class="co-l">' + l + '</span><span class="co-n">' + n + '</span></div>';
    const TAGS = ['functional', 'gridfinity', 'flexi', 'desk', 'decor', 'keychain', 'organizer', 'planter', 'miniature', 'cosplay'];
    return '<div class="sb sb--coll" style="' + VARS() + '">' +
      brand() + searchbox() +
      '<nav class="sb-nav sb-nav--mini">' + ni('grid', 'All models', '1,339', true) + ni('clock', 'Recently added', '24') + '</nav>' +
      '<div class="sb-lab sb-lab--row">Collections <span class="sb-add">' + ic('plus') + '</span></div>' +
      '<div class="co-list">' + colls.map(cr).join('') + '</div>' +
      '<div class="sb-lab">Tags</div>' +
      '<div class="tagcloud">' + TAGS.map((t, i) => '<span class="tc' + (i === 0 ? ' tc--on' : '') + '">' + t + '</span>').join('') + '</div>' +
      '</div>';
  }

  // F — Two-tier (rail + contextual panel)
  function twotier() {
    const btn = (icon, on) => '<button class="rb' + (on ? ' rb--on' : '') + '">' + ic(icon) + '</button>';
    return '<div class="sb sb--two" style="' + VARS() + '">' +
      '<div class="tt-rail"><span class="brand-mark"></span>' +
      '<div class="rail-nav">' + btn('grid') + btn('clock') + btn('bookmark') + btn('users', true) + btn('hash') + '</div>' +
      '<span class="rail-av" style="margin-top:auto">A</span></div>' +
      '<div class="tt-panel"><div class="tt-head">Creators <span class="sb-lab-n">10</span></div>' +
      '<div class="tt-search"><span class="sb-sic">' + ic('search') + '</span><span class="sb-sp">Filter creators\u2026</span></div>' +
      '<div class="sb-makers">' + C.map((c, i) => makerRow(c, i, i === 3)).join('') + '</div></div></div>';
  }

  const COLLS = [['To print', 42, 28], ['Printed', 118, 150], ['Gift ideas', 16, 45], ['Cosplay build', 9, 280]];
  function coRow([l, n, h]) {
    return '<div class="co"><span class="co-dot" style="background:hsl(' + h + ' 58% 60%)"></span><span class="co-l">' + l + '</span><span class="co-n">' + n + '</span></div>';
  }

  // A1 — Standard, evolved: Favorites in nav + Collections section
  function stdSection() {
    return '<div class="sb sb--std" style="' + VARS() + '">' +
      brand() + searchbox() +
      '<nav class="sb-nav">' + ni('grid', 'All models', '1,339', true) + ni('clock', 'Recently added', '24') + ni('heart', 'Favorites', '32') + ni('alert', 'Missing files', '7') + '</nav>' +
      '<div class="sect"><div class="sb-lab sb-lab--row">Collections <span class="sb-add">' + ic('plus') + '</span></div>' +
        '<div class="co-list">' + COLLS.map(coRow).join('') + '<div class="co co--new"><span class="co-plus">' + ic('plus') + '</span><span class="co-l">New collection</span></div></div></div>' +
      '<div class="sb-group"><div class="sb-lab sb-lab--row">Creators <span class="sb-lab-n">10</span></div><div class="sb-makers">' +
        C.slice(0, 4).map((c, i) => makerRow(c, i, i === 0)).join('') + '<div class="mk mk--more">Show all 10 \u203a</div></div></div>' +
      '<div class="sb-foot"><span class="mk-mono" style="background:var(--accent);color:var(--accentInk);border:none">A</span><span class="sb-foot-name">Library owner</span><span class="ni-ic" style="margin-left:auto;opacity:.6">' + ic('sliders') + '</span></div>' +
      '</div>';
  }

  // A2 — Standard, evolved: collapsible groups (scales as lists grow)
  function stdGroups() {
    const grpHead = (icon, label, n, open) => '<button class="grp"><span class="grp-ch">' + ic(open ? 'chev' : 'chevr') + '</span><span class="grp-ic">' + ic(icon) + '</span><span class="grp-l">' + label + '</span><span class="grp-n">' + n + '</span></button>';
    return '<div class="sb sb--std" style="' + VARS() + '">' +
      brand() + searchbox() +
      '<nav class="sb-nav">' + ni('grid', 'All models', '1,339', true) + ni('clock', 'Recently added', '24') + ni('heart', 'Favorites', '32') + ni('alert', 'Missing files', '7') + '</nav>' +
      '<div class="sect">' + grpHead('layers', 'Collections', '4', true) +
        '<div class="co-list co-list--in">' + COLLS.map(coRow).join('') + '<div class="co co--new"><span class="co-plus">' + ic('plus') + '</span><span class="co-l">New collection</span></div></div></div>' +
      '<div class="sect">' + grpHead('users', 'Creators', '10', false) + '</div>' +
      '<div class="sb-foot"><span class="mk-mono" style="background:var(--accent);color:var(--accentInk);border:none">A</span><span class="sb-foot-name">Library owner</span><span class="ni-ic" style="margin-left:auto;opacity:.6">' + ic('sliders') + '</span></div>' +
      '</div>';
  }

  const VARIANTS = { std, rail, creators, filters, collections, twotier, stdSection, stdGroups };
  window.SIDEBARS = { render: (k) => VARIANTS[k](), keys: Object.keys(VARIANTS) };
})();
