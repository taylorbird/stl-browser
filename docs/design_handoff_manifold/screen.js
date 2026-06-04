/* screen.js — renders the STL library grid screen as an HTML string.
   Two layout systems (refined / editorial), each driven by a theme's CSS vars.
   Placeholders stand in for real model photography. */
(function () {
  // ── Content ────────────────────────────────────────────────
  const CREATORS = [
    { name: '3DDb', mono: '3D' },
    { name: 'Fluid Prints', mono: 'FP' },
    { name: 'Gazzaladra', mono: 'GA' },
    { name: 'Koza Design', mono: 'KZ' },
    { name: 'Lofted Goods', mono: 'LG' },
    { name: 'Studio Loup', mono: 'SL' },
    { name: 'Bloblab', mono: 'BL' },
    { name: 'Flexi-Factory', mono: 'FF' },
    { name: 'Forgecore', mono: 'FC' },
    { name: 'Fractal', mono: 'FR' },
  ];

  const MODELS = [
    { t: '1×1 Planter Square', c: '3DDb', d: '2026-05-29', n: 1, noun: 'planter', g: 'cyl', h: 96 },
    { t: 'Storage Lid Mag Squares', c: 'Koza Design', d: '2026-05-29', n: 1, noun: 'tray', g: 'cube', h: 28 },
    { t: '1×2 Pencil Tray', c: '3DDb', d: '2026-05-29', n: 0, noun: 'tray', g: 'cube', h: 200 },
    { t: 'Controller Headset Stand', c: 'Forgecore', d: '2026-05-28', n: 2, noun: 'stand', g: 'pyr', h: 220 },
    { t: 'Hollow Ghost Keychain', c: 'Bloblab', d: '2026-05-28', n: 5, noun: 'keychain', g: 'sph', h: 268 },
    { t: 'Cable Hex Hub', c: 'Studio Loup', d: '2026-05-27', n: 3, noun: 'organizer', g: 'cyl', h: 40 },
    { t: 'Articulated Koi', c: 'Flexi-Factory', d: '2026-05-27', n: 1, noun: 'flexi', g: 'sph', h: 200 },
    { t: 'Gridfinity Bin 2×1', c: 'Fractal', d: '2026-05-26', n: 4, noun: 'bin', g: 'cube', h: 14 },
    { t: 'Lithophane Frame', c: 'Lofted Goods', d: '2026-05-26', n: 1, noun: 'frame', g: 'pyr', h: 320 },
    { t: 'Hex Soap Dish', c: 'Gazzaladra', d: '2026-05-25', n: 2, noun: 'dish', g: 'cyl', h: 160 },
    { t: 'Modular Wall Hook', c: 'Fluid Prints', d: '2026-05-25', n: 3, noun: 'hook', g: 'cube', h: 56 },
    { t: 'Desk Cable Spine', c: 'Studio Loup', d: '2026-05-24', n: 1, noun: 'organizer', g: 'cyl', h: 250 },
  ];

  // ── Placeholder "studio shot" ─────────────────────────────
  // A tonal duotone panel with a faint hatch + a thin-line geometric glyph
  // and a mono caption. Stands in for real product photography.
  const GLYPHS = {
    cube: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M24 6l16 9v18l-16 9-16-9V15z"/><path d="M24 6v9m0 0l16-9m-16 9L8 15m16 9v18"/></svg>',
    cyl:  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="24" cy="13" rx="13" ry="5"/><path d="M11 13v22a13 5 0 0 0 26 0V13"/><ellipse cx="24" cy="35" rx="13" ry="5" opacity=".5"/></svg>',
    sph:  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="24" cy="24" r="16"/><ellipse cx="24" cy="24" rx="16" ry="6"/><ellipse cx="24" cy="24" rx="6" ry="16"/></svg>',
    pyr:  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M24 6l16 30H8z"/><path d="M24 6v30m0 0l16 0M24 36L8 36" opacity=".5"/><path d="M24 6L17 36M24 6l7 30" opacity=".5"/></svg>',
  };

  function shot(m, i) {
    const hue = (i * 47 + 18) % 360;
    return (
      '<div class="shot" style="--sh:' + hue + '">' +
        '<div class="shot-hatch"></div>' +
        '<div class="shot-glyph">' + (GLYPHS[m.g] || GLYPHS.cube) + '</div>' +
        '<div class="shot-cap"><span class="shot-noun">' + m.noun + '</span><span class="shot-tag">render</span></div>' +
      '</div>'
    );
  }

  function stlBadge(n) {
    if (n === 0) return '<span class="badge badge--empty">no files</span>';
    return '<span class="badge"><span class="badge-n">' + n + '</span> STL' + (n > 1 ? 's' : '') + '</span>';
  }

  // ── Refined Dark / Light layout ───────────────────────────
  function renderRefined(t) {
    const vars = themeVars(t);
    const chips = CREATORS.map((c, i) =>
      '<button class="chip' + (i === 0 ? ' chip--on' : '') + '">' +
        '<span class="chip-mono">' + c.mono + '</span>' +
        '<span class="chip-name">' + c.name + '</span>' +
      '</button>'
    ).join('');

    const cards = MODELS.slice(0, 10).map((m, i) =>
      '<article class="card">' +
        '<div class="card-shot">' + shot(m, i) + '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + m.t + '</h3>' +
          '<div class="card-meta"><span class="card-creator">' + m.c + '</span>' +
          '<span class="card-date">' + m.d + '</span></div>' +
          '<div class="card-foot">' + stlBadge(m.n) + '</div>' +
        '</div>' +
      '</article>'
    ).join('');

    return (
      '<div class="stl stl--refined stl--' + t.mode + '" style="' + vars + '">' +
        '<header class="top">' +
          '<div class="brand"><span class="brand-mark"></span>' +
            '<span class="brand-name">MANIFOLD</span>' +
            '<span class="brand-sub">3D print library</span></div>' +
          '<div class="top-actions">' +
            '<button class="ghostbtn">Sync library</button>' +
          '</div>' +
        '</header>' +
        '<div class="searchrow">' +
          '<div class="search"><span class="search-ic">⌕</span>' +
            '<span class="search-ph">Search 1,339 models, creators, tags…</span>' +
            '<span class="search-kbd">⌘K</span></div>' +
          '<div class="select">All creators ▾</div>' +
        '</div>' +
        '<div class="sec-label">Creators <span class="sec-count">10</span></div>' +
        '<div class="chips">' + chips + '</div>' +
        '<div class="gridhead">' +
          '<div class="gridhead-l">All models <span class="gridhead-n">1,339</span></div>' +
          '<div class="tabs"><span class="tab tab--on">Shuffle</span><span class="tab">Newest</span>' +
            '<span class="tab">Title</span><span class="tab">Creator</span></div>' +
        '</div>' +
        '<div class="grid">' + cards + '</div>' +
      '</div>'
    );
  }

  // ── Editorial Archive layout ──────────────────────────────
  function renderEditorial(t) {
    const vars = themeVars(t);
    const creatorList = CREATORS.map((c, i) =>
      '<span class="ed-creator' + (i === 0 ? ' ed-creator--on' : '') + '">' + c.name +
      '<span class="ed-creator-c">' + String(12 + (i * 7) % 80).padStart(3, '0') + '</span></span>'
    ).join('<span class="ed-sep">/</span>');

    const cards = MODELS.slice(0, 9).map((m, i) =>
      '<article class="ed-card">' +
        '<div class="ed-shot">' + shot(m, i) + '<span class="ed-idx">' + String(i + 1).padStart(2, '0') + '</span></div>' +
        '<div class="ed-body">' +
          '<div class="ed-cmeta"><span>' + m.c + '</span><span>' + stlBadge(m.n) + '</span></div>' +
          '<h3 class="ed-title">' + m.t + '</h3>' +
          '<div class="ed-date">' + m.d + '</div>' +
        '</div>' +
      '</article>'
    ).join('');

    return (
      '<div class="stl stl--editorial stl--' + t.mode + '" style="' + vars + '">' +
        '<header class="ed-top">' +
          '<div class="ed-brand"><span class="ed-name">Plinth</span>' +
            '<span class="ed-tag">an archive of printable objects</span></div>' +
          '<div class="ed-top-r"><span class="ed-count">1,339 objects</span>' +
            '<span class="ed-search">Search ⌕</span></div>' +
        '</header>' +
        '<div class="ed-rule"></div>' +
        '<div class="ed-creators"><span class="ed-creators-lab">Makers</span>' +
          '<div class="ed-creators-list">' + creatorList + '</div></div>' +
        '<div class="ed-rule"></div>' +
        '<div class="ed-gridhead">' +
          '<span class="ed-gridhead-l">All objects</span>' +
          '<div class="ed-sorts"><span class="ed-sort ed-sort--on">Newest</span>' +
            '<span class="ed-sort">A–Z</span><span class="ed-sort">Maker</span>' +
            '<span class="ed-sort">Shuffle</span></div>' +
        '</div>' +
        '<div class="ed-grid">' + cards + '</div>' +
      '</div>'
    );
  }

  // ── Evolved refined-dark components ───────────────────────
  function vcard(m, i, hov) {
    return (
      '<article class="vcard' + (hov ? ' is-hover' : '') + '">' +
        '<div class="vcard-img">' + shot(m, i) +
          '<span class="vcard-pill">' + (m.n ? m.n + ' STL' + (m.n > 1 ? 's' : '') : 'no files') + '</span>' +
          '<div class="vcard-hov"><button class="vico" title="Download"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10"/></svg></button>' +
          '<button class="vico" title="Save"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13.5S2.5 9.8 2.5 6.2A2.7 2.7 0 0 1 8 5a2.7 2.7 0 0 1 5.5 1.2C13.5 9.8 8 13.5 8 13.5z"/></svg></button></div>' +
        '</div>' +
        '<div class="vcard-strip">' +
          '<div class="vcard-line"><span class="vcard-t">' + m.t + '</span></div>' +
          '<div class="vcard-sub"><span>' + m.c + '</span><span class="vcard-d">' + m.d + '</span></div>' +
        '</div>' +
      '</article>'
    );
  }

  function feat(m, i) {
    return (
      '<article class="feat"><div class="feat-img">' + shot(m, i) +
        '<div class="feat-scrim"></div>' +
        '<div class="feat-info"><span class="feat-tag">' + m.noun + '</span>' +
          '<h3 class="feat-title">' + m.t + '</h3>' +
          '<div class="feat-meta"><span>' + m.c + '</span><span class="dotsep">·</span>' +
          '<span>' + m.d + '</span><span class="feat-badge">' + stlBadge(m.n) + '</span></div>' +
        '</div></div></article>'
    );
  }

  function hcard(m, i) {
    return (
      '<article class="hcard"><div class="hcard-img">' + shot(m, i) + '</div>' +
        '<div class="hcard-info"><h4>' + m.t + '</h4>' +
          '<div class="hcard-sub">' + m.c + '</div>' + stlBadge(m.n) +
        '</div></article>'
    );
  }

  const TAGS = ['All', 'Functional', 'Desk', 'Gridfinity', 'Flexi', 'Decor', 'Keychains', 'Cosplay'];
  function tagRow() {
    return '<div class="tags2">' + TAGS.map((t, i) =>
      '<button class="tag2' + (i === 0 ? ' tag2--on' : '') + '">' + t + '</button>'
    ).join('') + '</div>';
  }

  function topbar() {
    return (
      '<header class="bar">' +
        '<div class="brand"><span class="brand-mark"></span>' +
          '<span class="brand-name">MANIFOLD</span></div>' +
        '<div class="search bar-search"><span class="search-ic">⌕</span>' +
          '<span class="search-ph">Search 1,339 models, creators, tags…</span>' +
          '<span class="search-kbd">⌘K</span></div>' +
        '<div class="select">All creators ▾</div>' +
        '<button class="ghostbtn">Sync</button>' +
      '</header>'
    );
  }

  function renderSpotlight(t) {
    const vars = themeVars(t);
    const grid = MODELS.slice(0, 8).map((m, i) => vcard(m, i, i === 2)).join('');
    return (
      '<div class="stl stl--v2 stl--dark" style="' + vars + '">' +
        topbar() +
        '<div class="v2wrap">' +
          '<div class="sec-label">Recently indexed <span class="sec-count">24</span></div>' +
          '<div class="hero">' + feat(MODELS[4], 4) +
            '<div class="hero-col">' + hcard(MODELS[3], 3) + hcard(MODELS[6], 6) + '</div>' +
          '</div>' +
          tagRow() +
          '<div class="gridhead"><div class="gridhead-l">All models <span class="gridhead-n">1,339</span></div>' +
            '<div class="tabs"><span class="tab tab--on">Shuffle</span><span class="tab">Newest</span>' +
            '<span class="tab">Title</span><span class="tab">Creator</span></div></div>' +
          '<div class="v2grid">' + grid + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderSidebar(t) {
    const vars = themeVars(t);
    const counts = [318, 142, 96, 211, 64, 173, 88, 127, 59, 142];
    const makers = CREATORS.map((c, i) =>
      '<div class="maker' + (i === 0 ? ' maker--on' : '') + '">' +
        '<span class="chip-mono chip-mono--sm">' + c.mono + '</span>' +
        '<span class="maker-name">' + c.name + '</span>' +
        '<span class="maker-count">' + counts[i] + '</span></div>'
    ).join('');
    const grid = MODELS.slice(0, 8).map((m, i) => vcard(m, i, i === 1)).join('');
    return (
      '<div class="stl stl--shell stl--dark" style="' + vars + '">' +
        '<aside class="rail">' +
          '<div class="brand"><span class="brand-mark"></span><span class="brand-name">MANIFOLD</span></div>' +
          '<div class="rs"><span class="search-ic">⌕</span><span>Search…</span><span class="search-kbd">⌘K</span></div>' +
          '<div class="nav">' +
            '<div class="navitem navitem--on"><span>All models</span><span class="nav-count">1,339</span></div>' +
            '<div class="navitem"><span>Recently added</span><span class="nav-count">24</span></div>' +
            '<div class="navitem"><span>Saved</span><span class="nav-count">18</span></div>' +
            '<div class="navitem"><span>Missing files</span><span class="nav-count">7</span></div>' +
          '</div>' +
          '<div class="rail-sec"><div class="rail-lab">Creators</div><div class="makerlist">' + makers + '</div></div>' +
        '</aside>' +
        '<div class="main">' +
          '<div class="subbar"><div class="subbar-l">All models <span class="gridhead-n">1,339</span></div>' +
            '<div class="tabs"><span class="tab tab--on">Shuffle</span><span class="tab">Newest</span>' +
            '<span class="tab">Title</span><span class="tab">Creator</span></div></div>' +
          '<div class="maincontent">' + tagRow() + '<div class="v2grid">' + grid + '</div></div>' +
        '</div>' +
      '</div>'
    );
  }

  function themeVars(t) {
    return Object.entries(t.vars).map(([k, v]) => '--' + k + ':' + v).join(';');
  }

  // ── Themes ────────────────────────────────────────────────
  const themes = {
    refinedDark: {
      mode: 'dark', render: 'refined',
      vars: {
        bg: '#0b0c10', panel: 'rgba(255,255,255,.045)', panel2: 'rgba(255,255,255,.025)',
        text: '#f3f4f7', dim: 'rgba(243,244,247,.52)', faint: 'rgba(243,244,247,.32)',
        line: 'rgba(255,255,255,.09)', line2: 'rgba(255,255,255,.05)',
        accent: '#e7b15a', accentInk: '#1c1505', accentDim: 'rgba(231,177,90,.16)',
        shotL: '62%', shotS: '24%', shotA: '0.5',
      },
    },
    refinedLight: {
      mode: 'light', render: 'refined',
      vars: {
        bg: '#f4f5f7', panel: '#ffffff', panel2: '#fbfbfd',
        text: '#16181d', dim: 'rgba(22,24,29,.55)', faint: 'rgba(22,24,29,.34)',
        line: 'rgba(0,0,0,.09)', line2: 'rgba(0,0,0,.05)',
        accent: '#a96a14', accentInk: '#fff8ec', accentDim: 'rgba(169,106,20,.12)',
        shotL: '72%', shotS: '30%', shotA: '0.5',
      },
    },
    editorialLight: {
      mode: 'light', render: 'editorial',
      vars: {
        bg: '#f3f0e9', panel: '#faf8f2', panel2: '#efeae0',
        text: '#1d1a14', dim: 'rgba(29,26,20,.58)', faint: 'rgba(29,26,20,.36)',
        line: 'rgba(29,26,20,.14)', line2: 'rgba(29,26,20,.08)',
        accent: '#9d3a28', accentInk: '#faf8f2', accentDim: 'rgba(157,58,40,.1)',
        shotL: '74%', shotS: '26%', shotA: '0.45',
      },
    },
    editorialDark: {
      mode: 'dark', render: 'editorial',
      vars: {
        bg: '#16140e', panel: '#211d15', panel2: '#1b1810',
        text: '#efe8d8', dim: 'rgba(239,232,216,.55)', faint: 'rgba(239,232,216,.34)',
        line: 'rgba(239,232,216,.14)', line2: 'rgba(239,232,216,.07)',
        accent: '#cf7a55', accentInk: '#1a130d', accentDim: 'rgba(207,122,85,.16)',
        shotL: '58%', shotS: '26%', shotA: '0.5',
      },
    },
  };

  // Evolved layouts reuse the refined-dark palette.
  themes.spotlight = { mode: 'dark', render: 'spotlight', vars: themes.refinedDark.vars };
  themes.shell = { mode: 'dark', render: 'shell', vars: themes.refinedDark.vars };

  // ── Full app main content (header + hero + tags + grid) ───
  function renderMain() {
    const grid = MODELS.slice(0, 12).map((m, i) => vcard(m, i, i === 2)).join('');
    return (
      '<header class="app-bar">' +
        '<div class="app-bar-title">All models <span class="app-bar-n">1,339</span></div>' +
        '<div class="app-bar-tools">' +
          '<div class="tabs"><span class="tab tab--on">Shuffle</span><span class="tab">Newest</span>' +
          '<span class="tab">Title</span><span class="tab">Creator</span></div>' +
          '<span class="bar-div"></span>' +
          '<button class="ghostbtn">Sync library</button>' +
        '</div>' +
      '</header>' +
      '<div class="app-scroll">' +
        '<div class="sec-label">Featured</div>' +
        heroBento() +
        tagRow() +
        '<div class="grid-meta"><span class="sec-label" style="margin:0;padding:0">Everything</span>' +
          '<span class="grid-range">1–24 of 1,339</span></div>' +
        '<div class="v2grid">' + grid + '</div>' +
      '</div>'
    );
  }

  // ── Featured hero variants (5–6 items) ────────────────────
  function fcard(m, i) {
    return '<article class="fcard"><div class="fcard-img">' + shot(m, i) +
      '<div class="fcard-scrim"></div>' +
      '<span class="vcard-pill">' + (m.n ? m.n + ' STL' + (m.n > 1 ? 's' : '') : 'no files') + '</span>' +
      '<div class="fcard-info"><span class="fcard-tag">' + m.noun + '</span>' +
      '<h4 class="fcard-title">' + m.t + '</h4><div class="fcard-meta">' + m.c + '</div></div></div></article>';
  }
  function rcard(m, i) {
    return '<article class="rcard"><div class="rcard-img">' + shot(m, i) +
      '<span class="vcard-pill">' + (m.n ? m.n + ' STL' + (m.n > 1 ? 's' : '') : 'no files') + '</span></div>' +
      '<div class="rcard-cap"><div class="rcard-t">' + m.t + '</div><div class="rcard-c">' + m.c + '</div></div></article>';
  }
  function heroShelf() { return '<div class="hshelf">' + MODELS.slice(0, 5).map((m, i) => fcard(m, i)).join('') + '</div>'; }
  function heroBento() { return '<div class="hbento">' + feat(MODELS[4], 4) + [0, 1, 5, 7].map((x, i) => fcard(MODELS[x], i)).join('') + '</div>'; }
  function heroRow() { return '<div class="hrow">' + MODELS.slice(0, 6).map((m, i) => rcard(m, i)).join('') + '</div>'; }

  function renderHeroSection(key) {
    const hero = key === 'bento' ? heroBento() : key === 'row' ? heroRow() : heroShelf();
    const grid = MODELS.slice(0, 5).map((m, i) => vcard(m, i, false)).join('');
    return '<div class="sec-label">Featured</div>' + hero + tagRow() +
      '<div class="grid-meta"><span class="sec-label" style="margin:0;padding:0">Everything</span>' +
      '<span class="grid-range">1\u201324 of 1,339</span></div><div class="v2grid">' + grid + '</div>';
  }

  function render(themeKey) {
    const t = themes[themeKey];
    if (t.render === 'editorial') return renderEditorial(t);
    if (t.render === 'spotlight') return renderSpotlight(t);
    if (t.render === 'shell') return renderSidebar(t);
    return renderRefined(t);
  }

  window.STL = { render, renderMain, renderHeroSection, heroShelf, heroBento, heroRow, themes, CREATORS, MODELS };
})();
