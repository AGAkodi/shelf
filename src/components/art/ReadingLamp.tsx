import { useId } from 'react'

// Spine cloth for up to four books: bottle green, oxblood, navy, ochre.
const spines = [
  { fill: '#2c5643', band: '#1f4031', ink: '#e8d9b4' },
  { fill: '#6e2a2c', band: '#521e20', ink: '#f0dcc0' },
  { fill: '#283a5c', band: '#1c2b45', ink: '#dfe3ea' },
  { fill: '#9a7330', band: '#7a5a24', ink: '#2a2014' },
]

/**
 * The home hero's one rendered object: a banker's lamp lighting a stack of the catalogue's books.
 * Spine titles come from real published books; nothing here is a fabricated title.
 */
export function ReadingLamp({ titles, compact = false }: { titles: string[]; compact?: boolean }) {
  const id = useId().replace(/:/g, '')
  const books = (titles.length ? titles : ['Shelf']).slice(0, compact ? 3 : 4)
  const stackTop = 312 - books.length * 34
  return (
    <svg viewBox="0 0 560 380" role="img" aria-label={`A reading lamp lighting a stack of books${titles.length ? `: ${titles.slice(0, books.length).join(', ')}` : ''}`} preserveAspectRatio="xMidYMax meet">
      <defs>
        <radialGradient id={`pool${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f2c06a" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="#f2c06a" stopOpacity="0.08" />
          <stop offset="1" stopColor="#f2c06a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cone${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6cf86" stopOpacity="0.24" />
          <stop offset="1" stopColor="#f6cf86" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`shade${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7a56" />
          <stop offset="0.55" stopColor="#1c5239" />
          <stop offset="1" stopColor="#123826" />
        </linearGradient>
        <linearGradient id={`brass${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5a26" />
          <stop offset="0.45" stopColor="#d9b46a" />
          <stop offset="1" stopColor="#8a672c" />
        </linearGradient>
        <linearGradient id={`desk${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b201d" />
          <stop offset="1" stopColor="#111513" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Desk */}
      <rect x="0" y="312" width="560" height="68" fill={`url(#desk${id})`} />
      <line x1="0" y1="312" x2="560" y2="312" stroke="#e9ede9" strokeOpacity="0.07" />
      <ellipse cx="290" cy="316" rx="250" ry="46" fill={`url(#pool${id})`} />

      {/* Light falling from the shade */}
      <polygon points="96,118 228,118 470,312 40,312" fill={`url(#cone${id})`} />

      {/* Book stack */}
      {books.map((title, i) => {
        const s = spines[i % spines.length]
        const y = 312 - (i + 1) * 34
        const inset = [0, 18, 6, 26][i] ?? 0
        const x = 196 + inset
        const w = 260 - inset * 1.4
        return (
          <g key={title + i}>
            <rect x={x} y={y + 4} width={w} height={30} rx="4" fill="#000" opacity="0.28" />
            <rect x={x} y={y} width={w} height={30} rx="4" fill={s.fill} />
            <rect x={x} y={y} width={w} height={6} rx="3" fill="#fff" opacity="0.07" />
            <rect x={x + 16} y={y} width="10" height={30} fill={s.band} />
            <rect x={x + w - 26} y={y} width="10" height={30} fill={s.band} />
            <line x1={x + 34} y1={y + 6} x2={x + 34} y2={y + 24} stroke="#d9b46a" strokeOpacity="0.55" />
            <line x1={x + w - 34} y1={y + 6} x2={x + w - 34} y2={y + 24} stroke="#d9b46a" strokeOpacity="0.55" />
            <text x={x + w / 2} y={y + 20} textAnchor="middle" fill={s.ink} fontFamily="'Playfair Display', Georgia, serif" fontSize="13" letterSpacing="0.04em">
              {title.length > 26 ? title.slice(0, 25) + '…' : title}
            </text>
          </g>
        )
      })}
      {/* Page edges on the top book */}
      <rect x="214" y={stackTop + 2} width="226" height="3" fill="#efe6d2" opacity="0.35" />

      {/* Lamp */}
      <ellipse cx="130" cy="312" rx="62" ry="9" fill="#000" opacity="0.35" />
      <path d="M78 312 Q78 296 130 294 Q182 296 182 312 Z" fill={`url(#brass${id})`} />
      <rect x="125" y="150" width="10" height="146" rx="5" fill={`url(#brass${id})`} />
      <rect x="112" y="138" width="36" height="10" rx="4" fill={`url(#brass${id})`} />
      <path d="M88 120 Q90 84 162 84 Q234 84 236 120 Z" fill={`url(#shade${id})`} />
      <path d="M100 104 Q120 92 162 91" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="84" y="116" width="156" height="6" rx="3" fill={`url(#brass${id})`} />
      <ellipse cx="162" cy="124" rx="56" ry="4" fill="#f6cf86" opacity="0.55" />
      <line x1="196" y1="124" x2="196" y2="150" stroke={`url(#brass${id})`} strokeWidth="2" />
      <circle cx="196" cy="154" r="4" fill={`url(#brass${id})`} />
    </svg>
  )
}
