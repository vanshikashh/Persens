import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authenticateImages, logAction } from '@/utils/api'
import DropZone from '@/components/ui/DropZone'
import { Button, Panel, SectionLabel, StatCard, EmptyState } from '@/components/ui/primitives'
import { ATTRIBUTES, ATTR_SHORT } from '@/utils/constants'
import styles from './AppPage.module.css'

const ILLUMINATION = ['brightness', 'shininess', 'sparkle', 'movement_effect']
const INTRINSIC    = ['naturalness', 'surface_roughness', 'pattern_complexity', 'hardness', 'warmth', 'thickness']

export default function Authenticate() {
  const [refFile,  setRefFile]  = useState<File | null>(null)
  const [qryFile,  setQryFile]  = useState<File | null>(null)
  const [refPreview, setRefPreview] = useState<string | null>(null)
  const [qryPreview, setQryPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const handleRefFile = (f: File) => { setRefFile(f); setRefPreview(URL.createObjectURL(f)); setResult(null) }
  const handleQryFile = (f: File) => { setQryFile(f); setQryPreview(URL.createObjectURL(f)); setResult(null) }

  const authMut = useMutation({
    mutationFn: () => authenticateImages(refFile!, qryFile!),
    onSuccess: async (data) => {
      setResult(data)
      await logAction({ action: 'authenticate', details: { verdict: data.verdict } })
    },
  })

  const isAuthentic = result?.verdict === 'AUTHENTIC'

  return (
    <div className={styles.appLayout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <SectionLabel>Reference material</SectionLabel>
        <DropZone onFile={handleRefFile} label="Reference image" sub="Known authentic sample" accepted={refFile} accent="teal" />
        {refPreview && (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '0.5px solid var(--teal-mid)' }}>
            <img src={refPreview} alt="reference" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <SectionLabel>Query material</SectionLabel>
        <DropZone onFile={handleQryFile} label="Query image" sub="Questioned / incoming sample" accepted={qryFile} accent="accent" />
        {qryPreview && (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '0.5px solid var(--accent-mid)' }}>
            <img src={qryPreview} alt="query" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <Panel style={{ padding: '12px 14px', background: 'var(--sand)', border: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--mist)', lineHeight: 1.65 }}>
            Checks <strong style={{ color: 'var(--ink-soft)' }}>illumination-robust intrinsic attributes</strong> (naturalness, roughness, hardness) — ignores brightness and shininess which legitimately vary under different lighting.
          </div>
        </Panel>

        <div style={{ marginTop: 'auto' }}>
          <Button style={{ width: '100%' }}
            onClick={() => authMut.mutate()}
            disabled={!refFile || !qryFile || authMut.isPending}
            loading={authMut.isPending}>
            Authenticate →
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.mainPanel}>
        {authMut.isPending && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span className="spinner" style={{ width: 24, height: 24 }} />
            <p style={{ marginTop: 12, color: 'var(--mist)', fontSize: 14 }}>Comparing fingerprints…</p>
          </div>
        )}

        {!authMut.isPending && !result && (
          <EmptyState icon="◎" title="Upload reference and query to authenticate"
            sub="Calibrated on 95th-percentile intra-material fingerprint variance" />
        )}

        {result && !authMut.isPending && (
          <>
            {/* Image comparison strip */}
            {(refPreview || qryPreview) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 12, alignItems: 'center' }}>
                <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: `2px solid ${isAuthentic ? 'var(--teal)' : 'var(--accent)'}` }}>
                  {refPreview && <img src={refPreview} alt="reference" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />}
                  <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--mist)', borderTop: '0.5px solid var(--border)' }}>Reference</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 22, color: 'var(--mist)' }}>vs</div>
                <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: `2px solid ${isAuthentic ? 'var(--teal)' : 'var(--danger)'}` }}>
                  {qryPreview && <img src={qryPreview} alt="query" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />}
                  <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--mist)', borderTop: '0.5px solid var(--border)' }}>Query</div>
                </div>
              </div>
            )}

            {/* Verdict */}
            <div style={{
              padding: '20px 24px', borderRadius: 'var(--r-lg)',
              background: isAuthentic ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `0.5px solid ${isAuthentic ? '#A8D5B5' : '#E0AAAA'}`,
              display: 'flex', alignItems: 'center', gap: 18,
            }}>
              <div style={{ fontSize: 36 }}>{isAuthentic ? '✓' : '⚠'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 500, color: isAuthentic ? 'var(--success)' : 'var(--danger)' }}>
                  {result.verdict}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 3, lineHeight: 1.6 }}>
                  {result.explanation}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: isAuthentic ? 'var(--success)' : 'var(--danger)' }}>
                  {(result.confidence * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--mist)' }}>confidence</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Fingerprint distance" value={result.fingerprint_distance}
                sub={`threshold: ${result.threshold}`} accent={!isAuthentic} />
              <StatCard label="Intrinsic Δ" value={result.intrinsic_delta} sub="material-intrinsic cluster" />
              <StatCard label="Illumination Δ" value={result.illumination_delta} sub="expected to vary" />
            </div>

            {/* Suspicious attributes */}
            {result.suspicious_attributes?.length > 0 && (
              <Panel>
                <SectionLabel>Flagged intrinsic attributes</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {result.suspicious_attributes.map((attr: string) => (
                    <span key={attr} style={{
                      background: 'var(--danger-bg)', color: 'var(--danger)',
                      fontSize: 12, padding: '4px 12px', borderRadius: 20,
                      border: '0.5px solid #E0AAAA', fontWeight: 500,
                    }}>
                      {ATTR_SHORT[ATTRIBUTES.indexOf(attr as any)]} · Δ={result.per_attribute?.[attr]?.delta?.toFixed(3)}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--mist)', lineHeight: 1.65 }}>
                  These attributes are illumination-invariant — deviations indicate material substitution, not lighting change.
                </p>
              </Panel>
            )}

            {/* Cluster table */}
            <Panel>
              <SectionLabel>Attribute cluster analysis</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { label: 'Illumination-sensitive (expected to vary)', attrs: ILLUMINATION, ok: true },
                  { label: 'Material-intrinsic (should be stable)', attrs: INTRINSIC, ok: false },
                ].map(({ label, attrs, ok }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 10 }}>{label}</div>
                    {attrs.map(attr => {
                      const d = result.per_attribute?.[attr]
                      if (!d) return null
                      const flagged = !ok && result.suspicious_attributes?.includes(attr)
                      const barPct  = Math.min(d.delta * 200, 100)
                      return (
                        <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                          <span style={{ flex: 1, color: 'var(--ink-soft)' }}>
                            {ATTR_SHORT[ATTRIBUTES.indexOf(attr as any)]}
                          </span>
                          <div style={{ width: 72, height: 3, background: 'var(--sand-dark)', borderRadius: 2 }}>
                            <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 2, background: flagged ? 'var(--accent)' : 'var(--teal)' }} />
                          </div>
                          <span style={{ fontSize: 11, minWidth: 44, textAlign: 'right', color: flagged ? 'var(--accent)' : 'var(--teal)', fontWeight: flagged ? 500 : 400 }}>
                            {flagged ? '⚠ ' : ''}{d.delta.toFixed(3)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
