import { type ReactNode } from 'react'
import { CATEGORY_TAGS } from '@/utils/constants'

// ── Button ────────────────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, children, style, ...rest }: BtnProps) {
  const base: React.CSSProperties = {
    fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 30, fontSize: 14, fontWeight: 500,
    transition: 'all 0.18s', border: 'none',
    padding: '11px 24px', ...style,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--ink)', color: 'var(--sand)' },
    secondary: { background: 'transparent', color: 'var(--ink)', border: '0.5px solid var(--border-strong)' },
    ghost:     { background: 'transparent', color: 'var(--mist)', border: 'none', padding: '8px 14px' },
  }

  return (
    <button
      style={{ ...base, ...variants[variant], opacity: rest.disabled ? 0.5 : 1 }}
      {...rest}
    >
      {loading && <span className="spinner spinner-white" style={{ width: 14, height: 14 }} />}
      {children}
    </button>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--white)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '22px 24px', ...style,
    }}>
      {children}
    </div>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase',
      color: 'var(--mist)', fontWeight: 500, marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

// ── CategoryTag ───────────────────────────────────────────────────────────────
export function CategoryTag({ category }: { category: string }) {
  const tag = CATEGORY_TAGS[category] ?? CATEGORY_TAGS.other
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 500,
      padding: '2px 9px', borderRadius: 20,
      background: tag.bg, color: tag.color, letterSpacing: '0.03em',
    }}>
      {category}
    </span>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: boolean
}) {
  return (
    <div style={{
      background: accent ? 'var(--accent-light)' : 'var(--sand)',
      border: `0.5px solid ${accent ? 'var(--accent-mid)' : 'var(--border)'}`,
      borderRadius: 'var(--r-lg)', padding: '18px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: accent ? 'var(--accent)' : 'var(--mist)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: "'DM Serif Display', serif", fontSize: 28,
        color: accent ? 'var(--accent)' : 'var(--ink)',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 20px', color: 'var(--mist)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{title}</div>
      {sub && <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ height: '0.5px', background: 'var(--border)', margin: '6px 0' }} />
}
