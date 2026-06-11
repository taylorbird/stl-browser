// 1.5px-stroke line icons from the MANIFOLD handoff (sidebars.js / screen.js).
const ICONS = {
  grid: { vb: '0 0 18 18', el: <><rect x="2.3" y="2.3" width="5.6" height="5.6" rx="1.2" /><rect x="10.1" y="2.3" width="5.6" height="5.6" rx="1.2" /><rect x="2.3" y="10.1" width="5.6" height="5.6" rx="1.2" /><rect x="10.1" y="10.1" width="5.6" height="5.6" rx="1.2" /></> },
  clock: { vb: '0 0 18 18', el: <><circle cx="9" cy="9" r="6.6" /><path d="M9 5.2V9l2.6 1.6" /></> },
  heart: { vb: '0 0 18 18', el: <path d="M9 15S2.6 11 2.6 6.6A3 3 0 0 1 9 5a3 3 0 0 1 6.4 1.6C15.4 11 9 15 9 15z" /> },
  alert: { vb: '0 0 18 18', el: <><path d="M9 2.6l6.6 11.8H2.4z" /><path d="M9 7.2v3.4M9 12.6v.05" /></> },
  sliders: { vb: '0 0 18 18', el: <><path d="M3 5.4h7M13 5.4h2M3 12.6h2M8 12.6h7" /><circle cx="11.5" cy="5.4" r="1.6" /><circle cx="5.5" cy="12.6" r="1.6" /></> },
  search: { vb: '0 0 18 18', el: <><circle cx="7.8" cy="7.8" r="5" /><path d="M11.5 11.5l3 3" /></> },
  plus: { vb: '0 0 18 18', el: <path d="M9 3.5v11M3.5 9h11" /> },
  chevr: { vb: '0 0 18 18', el: <path d="M7 4.5L11.5 9 7 13.5" /> },
  shuffle: { vb: '0 0 18 18', el: <><path d="M2.5 4.5h3l7 9h3" /><path d="M2.5 13.5h3l2.1-2.7M9.4 7.2l3.1-2.7h3" /><path d="M13.5 2.5l2 2-2 2M13.5 11.5l2 2-2 2" /></> },
  download: { vb: '0 0 16 16', el: <path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" /> },
  menu: { vb: '0 0 18 18', el: <path d="M3 5h12M3 9h12M3 13h12" /> },
  close: { vb: '0 0 18 18', el: <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" /> },
  refresh: { vb: '0 0 18 18', el: <><path d="M14.5 3.5v3.2h-3.2" /><path d="M14.2 6.7a5.5 5.5 0 1 0 1 4" /></> },
  bookmark: { vb: '0 0 18 18', el: <path d="M4.6 2.8h8.8a.8.8 0 0 1 .8.8v11.6l-5.2-3-5.2 3V3.6a.8.8 0 0 1 .8-.8z" /> },
  layers: { vb: '0 0 18 18', el: <><path d="M9 2.4l6.4 3.3L9 9 2.6 5.7 9 2.4z" /><path d="M2.6 9l6.4 3.3L15.4 9" /><path d="M2.6 12.3l6.4 3.3 6.4-3.3" /></> },
};

export default function Icon({ name, className = '' }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg
      viewBox={icon.vb}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {icon.el}
    </svg>
  );
}
