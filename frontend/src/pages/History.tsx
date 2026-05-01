import { useStore } from '@/store'
import { useNavigate } from 'react-router-dom'
import MaterialCard from '@/components/ui/MaterialCard'
import { Panel, SectionLabel, EmptyState } from '@/components/ui/primitives'
import { ATTRIBUTES, ATTR_SHORT } from '@/utils/constants'
import RadarChart from '@/components/ui/RadarChart'

const ACTION_META: Record<string, { icon: string; color: string; route: string }> = {
  retrieve:     { icon: '◈', color: 'var(--ink)',    route: '/retrieve' },
  edit:         { icon: '✦', color: 'var(--accent)', route: '/edit' },
  authenticate: { icon: '◎', color: 'var(--teal)',   route: '/authenticate' },
  compose:      { icon: '⊕', color: 'var(--indigo)', route: '/compose' },
  explain:      { icon: '⬡', color: 'var(--gold)',   route: '/explain' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function History() {
  const { history, saved, toggleSave } = useStore()
  const nav        = useNavigate()
  const savedList  = Object.values(saved)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 36 }}>

      {/* ── History log ── */}
      <div>
        <SectionLabel>Search history</SectionLabel>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, marginBottom: 20 }}>Past queries</h2>

        {history.length === 0 ? (
          <EmptyState icon="◈" title="No history yet"
            sub="Actions from Retrieve, Edit, Authenticate, Compose and Explain appear here" />
        ) : (
          <Panel style={{ padding: 0, overflow: 'hidden' }}>
            {history.slice(0, 25).map((h, i) => {
              const meta = ACTION_META[h.action] ?? ACTION_META.retrieve
              return (
                <div
                  key={h.id}
                  onClick={() => nav(meta.route)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 20px', cursor: 'pointer', transition: 'background 0.13s',
                    borderBottom: i < history.length - 1 ? '0.5px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--sand)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 'var(--r-sm)',
                    background: meta.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, color: meta.color, flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 1 }}>{h.action}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mist)' }}>{timeAgo(h.time)}</div>
                  <div style={{ fontSize: 12, color: 'var(--mist)', opacity: 0.5 }}>→</div>
                </div>
              )
            })}
          </Panel>
        )}
      </div>

      {/* ── Saved materials ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <SectionLabel>Saved materials</SectionLabel>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400 }}>Favourites</h2>
          </div>
          {savedList.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--mist)' }}>{savedList.length} saved</span>
          )}
        </div>

        {savedList.length === 0 ? (
          <EmptyState icon="☆" title="No saved materials yet"
            sub="Star results in Retrieve or Edit to save them here" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
              {savedList.map(m => (
                <MaterialCard
                  key={m.material_id}
                  material_id={m.material_id}
                  name={m.name}
                  category={m.category}
                  fingerprint={m.fingerprint}
                  attributes={m.attributes}
                  image_nonspec={m.image_nonspec}
                  image_spec={m.image_spec}
                />
              ))}
            </div>

            {/* Side-by-side comparison for first two saved */}
            {savedList.length >= 2 && (
              <div>
                <SectionLabel>Side-by-side comparison · first two saved</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {savedList.slice(0, 2).map((m, mi) => {
                    const other = savedList[mi === 0 ? 1 : 0]
                    return (
                      <Panel key={m.material_id}>
                        {/* Image */}
                        {m.image_nonspec ? (
                          <div style={{ height: 160, borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14, border: '0.5px solid var(--border)' }}>
                            <img
                              src={`http://localhost:8000/images/nonspec/${m.image_nonspec}`}
                              alt={m.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          </div>
                        ) : (
                          <div style={{ height: 100, background: 'var(--sand-dark)', borderRadius: 'var(--r-lg)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                            {m.category.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                          <span style={{ fontSize: 10, background: 'var(--sand-dark)', padding: '2px 8px', borderRadius: 20, color: 'var(--mist)' }}>
                            {m.category}
                          </span>
                        </div>

                        <RadarChart values={m.fingerprint} compareValues={other.fingerprint}
                          compareColor="rgba(26,22,20,0.2)" size={180} />

                        <div style={{ marginTop: 14 }}>
                          {ATTRIBUTES.slice(0, 8).map((attr, i) => {
                            const v = m.fingerprint[i] ?? 0
                            const ov = other.fingerprint[i] ?? 0
                            const diff = v - ov
                            return (
                              <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                                <span style={{ flex: 1, color: 'var(--ink-soft)' }}>{ATTR_SHORT[i]}</span>
                                <div style={{ width: 56, height: 3, background: 'var(--sand-dark)', borderRadius: 2 }}>
                                  <div style={{ width: `${v * 100}%`, height: '100%', background: Math.abs(diff) > 0.1 ? (diff > 0 ? 'var(--teal)' : 'var(--accent)') : 'var(--mist-light)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontWeight: 500, minWidth: 44, textAlign: 'right', fontSize: 11,
                                  color: Math.abs(diff) > 0.1 ? (diff > 0 ? 'var(--teal)' : 'var(--accent)') : 'var(--mist)' }}>
                                  {v.toFixed(2)}{Math.abs(diff) > 0.1 ? (diff > 0 ? ' ↑' : ' ↓') : ''}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </Panel>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
