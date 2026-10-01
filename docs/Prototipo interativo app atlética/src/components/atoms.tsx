import { C } from '../theme'

// ─── Avatar ──────────────────────────────────────────────────────────────────
export function Av({ s, size = 38, bg = C.red }: { s: string; size?: number; bg?: string }) {
  return (
    <div className="f-sora font-bold flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * .36, color: '#fff', letterSpacing: 1 }}>
      {s}
    </div>
  )
}

// ─── Chip / Badge ─────────────────────────────────────────────────────────────
export function Chip({ label, color = C.red }: { label: string; color?: string }) {
  return (
    <span className="f-mono font-bold rounded"
      style={{ fontSize: 9, letterSpacing: '.06em', padding: '2px 5px',
               background: color + '22', color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  )
}

// ─── Pill filter button ───────────────────────────────────────────────────────
export function Pill({ label, active, color = C.red, onClick }:
  { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-full font-semibold text-xs transition-all"
      style={{ padding: '6px 12px',
               background: active ? color : C.card,
               color: active ? '#fff' : C.muted,
               border: `1px solid ${active ? color : C.bdr}` }}>
      {label}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, onClick, pad = 'p-4', style, className = '' }:
  { children: React.ReactNode; onClick?: () => void; pad?: string; style?: React.CSSProperties; className?: string }) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl ${pad} ${className} ${onClick ? 'active:scale-[.985] cursor-pointer transition-transform' : ''}`}
      style={{ background: C.card, border: `1px solid ${C.bdr}`, boxShadow: '0 4px 16px rgba(0,0,0,.35)', ...style }}>
      {children}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SH({ title, sub, action, onAction }:
  { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h3 className="f-sora font-bold text-base" style={{ color: C.text }}>{title}</h3>
        {sub && <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="f-mono text-[10px] font-medium" style={{ color: C.blueL }}>
          {action} →
        </button>
      )}
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled} className="rounded-full transition-all shrink-0"
      style={{ width: 44, height: 24, background: on ? C.blue : C.dim, padding: 2, opacity: disabled ? .4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <div className="rounded-full transition-all"
        style={{ width: 20, height: 20, background: '#fff', transform: `translateX(${on ? 20 : 0}px)` }} />
    </button>
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────────
export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Agendado': C.blue, 'Em andamento': C.green, 'Finalizado': C.muted, 'Cancelado': '#f43f5e',
    'Publicada': C.green, 'Rascunho': C.yellow,
    'pendente': C.yellow, 'aceito': C.green, 'rejeitado': '#f43f5e',
    'ativo': C.green,
  }
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: colors[status] ?? C.muted }} />
}

// ─── Icon components ──────────────────────────────────────────────────────────
type IP = { size?: number; color?: string; fill?: boolean }

export const IcoHome = ({ size = 22, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 22V14h6v8" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
)
export const IcoCal = ({ size = 22, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" />
    <path d="M8 3v4M16 3v4M3 10h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <rect x="7" y="14" width="3" height="3" rx=".5" fill={color} />
    <rect x="14" y="14" width="3" height="3" rx=".5" fill={color} />
  </svg>
)
export const IcoSport = ({ size = 22, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
    <path d="M12 3c0 4-2 7-2 9s2 5 2 9M3 12c4 0 7-2 9-2s5 2 9 2" stroke={color} strokeWidth="1.5" />
  </svg>
)
export const IcoUser = ({ size = 22, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoShield = ({ size = 20, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 6v6c0 5.25 3.5 10.25 8 11.5C16.5 22.25 20 17.25 20 12V6l-8-4z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoTrophy = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 2h12v8a6 6 0 01-12 0V2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M6 5H3a1 1 0 000 2 3 3 0 003 3M18 5h3a1 1 0 010 2 3 3 0 01-3 3M12 16v4M8 22h8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoChev = ({ size = 18, color = C.dim }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoBack = ({ size = 20, color = C.muted }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M15 6l-6 6 6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoCode = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M8 6l-4 6 4 6M16 6l4 6-4 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 4l-2 16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoBell = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoCheck = ({ size = 16, color = C.green }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoX = ({ size = 16, color = '#f43f5e' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)
export const IcoBin = ({ size = 16, color = C.muted }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoEdit = ({ size = 16, color = C.blueL }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoPlus = ({ size = 16, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)
export const IcoWifi = ({ size = 16, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M1 7s5-5 11-5 11 5 11 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M5 12s3.5-3.5 7-3.5 7 3.5 7 3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M9 17s1.5-1.5 3-1.5 3 1.5 3 1.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="20.5" r="1" fill={color} />
    <line x1="2" y1="2" x2="22" y2="22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoAlert = ({ size = 16, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoRefresh = ({ size = 16, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M23 4v6h-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 20v-6h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoUsers = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoNewspaper = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a4 4 0 01-4-4V6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 7h6M10 11h6M10 15h3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
export const IcoImage = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" />
    <circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    <path d="M21 15l-5-5L5 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IcoStar = ({ size = 14, color = C.yellow }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)
export const IcoClipboard = ({ size = 18, color = '#fff' }: IP) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="8" y="2" width="8" height="4" rx="1" stroke={color} strokeWidth="1.8" />
    <path d="M9 12h6M9 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
