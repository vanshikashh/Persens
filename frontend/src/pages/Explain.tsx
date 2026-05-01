import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { explainPair, getCatalogue, logAction, materialImageUrl } from '@/utils/api'
import RadarChart from '@/components/ui/RadarChart'
import { Button, Panel, SectionLabel, EmptyState } from '@/components/ui/primitives'
import { ATTRIBUTES, ATTR_SHORT, ATTR_DISPLAY } from '@/utils/constants'
import styles from './AppPage.module.css'

function HeatmapOverlay({ data, width = 90, height = 90, color = '196,96,42' }: {
  data: number[][], width?: number, height?: number, color?: string
}) {
  const draw = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    const cellW = width / data[0].length
    const cellH = height / data.length
    data.forEach((row, r) =>
      row.forEach((val, c) => {
        ctx.fillStyle = `rgba(${color},${(val * 0.85).toFixed(2)})`
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH)
      })
    )
  }
  return (
    <canvas ref={draw} width={width} height={height}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' }} />
  )
}

export default function Explain() {
  const [matQ, setMatQ] = useState<any>(null)
  const [matM, setMatM] = useState<any>(null)
  const [topN, setTopN] = useState(4)
  const [result, setResult] = useState<any>(null)

  const { data: catalogue } = useQuery({ queryKey: ['catalogue'], queryFn: () => getCatalogue(60, 0) })

  const explainMut = useMutation({
    mutationFn: () => explainPair({ query_material_id: matQ.material_id, match_material_id: matM.material_id, top_n: topN }),
    onSuccess: async (data) => {
      setResult(data)
      await logAction({ action: 'explain', material_name: `${matQ.name} vs ${matM.name}` })
    },
  })

  const MatSelect = ({ value, onChange, label }: { value: any, onChange: (m: any) => void, label: string }) => {
    const imgUrl = value ? materialImageUrl(value.image_nonspec, 'nonspec') : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--mist)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
        {imgUrl && (
          <div style={{ borderRadius: 'var(--r)', overflow: 'hidden', height: 80, background: 'var(--sand-dark)' }}>
            <img src={imgUrl} alt={value.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <select
          style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r)', background: 'var(--sand)', border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
          value={value?.material_id ?? ''}
          onChange={e => {
            const mat = catalogue?.materials?.find((m: any) => String(m.material_id) === e.target.value)
            if (mat) onChange(mat)
          }}
        >
          <option value="" disabled>Select material…</option>
          {catalogue?.materials?.map((m: any) => (
            <option key={m.material_id} value={m.material_id}>{m.name}</option>
          ))}
        </select>
      </div>
    )
  }

  const topAttrs: string[] = result?.top_discriminative_attributes?.slice(0, topN) ?? []

  // Attribute delta list before running
  const previewDeltas = matQ && matM
    ? ATTRIBUTES.map((attr, i) => ({
        attr, i,
        delta: Math.abs((matQ.fingerprint?.[i] ?? 0) - (matM.fingerprint?.[i] ?? 0)),
      })).sort((a, b) => b.delta - a.delta).filter(d => d.delta > 0.04)
    : []

  return (
    <div className={styles.appLayout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <SectionLabel>Material pair</SectionLabel>
        <MatSelect value={matQ} onChange={setMatQ} label="Query material" />
        <MatSelect value={matM} onChange={setMatM} label="Matched material" />

        <div>
          <SectionLabel>Explain top N attributes</SectionLabel>
          <select
            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r)', background: 'var(--sand)', border: '0.5px solid var(--border-strong)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
            value={topN} onChange={e => setTopN(Number(e.target.value))}
          >
            <option value={4}>Top 4 (recommended)</option>
            <option value={6}>Top 6</option>
            <option value={8}>Top 8</option>
          </select>
        </div>

        {previewDeltas.length > 0 && (
          <div>
            <SectionLabel>Attribute deltas preview</SectionLabel>
            {previewDeltas.slice(0, 8).map(({ attr, i, delta }) => (
              <div key={attr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{ATTR_SHORT[i]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 48, height: 3, background: 'var(--sand-dark)', borderRadius: 2 }}>
                    <div style={{ width: `${delta * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                  <span style={{ color: 'var(--accent)', fontWeight: 500, minWidth: 32, textAlign: 'right' }}>
                    {delta.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <Button style={{ width: '100%' }}
            onClick={() => explainMut.mutate()}
            disabled={!matQ || !matM || explainMut.isPending}
            loading={explainMut.isPending}>
            Generate Grad-CAM →
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.mainPanel}>
        <div className={styles.resultsHeader}>
          <div>
            <div className={styles.resultsTitle}>Per-attribute spatial explanations</div>
            <div className={styles.resultsMeta}>
              {topN} heatmaps · one per most-discriminative attribute · {result?.method ?? 'select materials to begin'}
            </div>
          </div>
        </div>

        {explainMut.isPending && (
          <div className={styles.heatmapGrid}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        )}

        {!explainMut.isPending && !result && (
          <EmptyState icon="⬡" title="Select a material pair and run Grad-CAM"
            sub="Each heatmap shows which spatial region drove that attribute's prediction score" />
        )}

        {result && !explainMut.isPending && (
          <>
            {/* Fingerprint comparison with images */}
            <Panel>
              <SectionLabel>Fingerprint comparison</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px 1fr', gap: 16, alignItems: 'center' }}>
                <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', height: 120 }}>
                  {materialImageUrl(matQ?.image_nonspec) ? (
                    <img src={materialImageUrl(matQ?.image_nonspec)!} alt={matQ?.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: '100%', background: 'var(--sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>◈</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 4 }}>{matQ?.name} · query</div>
                  <RadarChart values={Object.values(result.query_fingerprint) as number[]}
                    compareValues={Object.values(result.match_fingerprint) as number[]}
                    compareColor="var(--teal)" color="var(--accent)" size={160} />
                </div>
                <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', height: 120 }}>
                  {materialImageUrl(matM?.image_nonspec) ? (
                    <img src={materialImageUrl(matM?.image_nonspec)!} alt={matM?.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: '100%', background: 'var(--sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>◈</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--teal)', marginBottom: 4 }}>{matM?.name} · match</div>
                  <RadarChart values={Object.values(result.match_fingerprint) as number[]}
                    compareValues={Object.values(result.query_fingerprint) as number[]}
                    compareColor="var(--accent)" color="var(--teal)" size={160} />
                </div>
              </div>
            </Panel>

            {/* Heatmap grid */}
            <div className={styles.heatmapGrid}>
              {topAttrs.map((attr) => {
                const info = result.explanations?.[attr]
                if (!info) return null
                const attrIdx  = ATTRIBUTES.indexOf(attr as any)
                const qImgUrl  = materialImageUrl(matQ?.image_nonspec)
                const mImgUrl  = materialImageUrl(matM?.image_nonspec)
                const higher   = info.query_score > info.match_score

                return (
                  <div key={attr} className={styles.heatmapCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{ATTR_DISPLAY[attrIdx]}</div>
                        <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>{info.spatial_description}</div>
                      </div>
                      <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                        Δ {info.delta?.toFixed(3)}
                      </span>
                    </div>

                    <div className={styles.heatmapPair}>
                      {[
                        { imgUrl: qImgUrl, heatmap: info.heatmap_query, score: info.query_score, label: 'Query', isHigher: higher },
                        { imgUrl: mImgUrl, heatmap: info.heatmap_match, score: info.match_score, label: 'Match', isHigher: !higher },
                      ].map(({ imgUrl, heatmap, score, label, isHigher }) => (
                        <div key={label} className={styles.heatmapItem}>
                          <div className={styles.heatmapBg} style={{ position: 'relative', overflow: 'hidden' }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={label}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ position: 'absolute', inset: 0, background: 'var(--sand-dark)' }} />
                            )}
                            {heatmap && <HeatmapOverlay data={heatmap} />}
                          </div>
                          <div className={styles.heatmapLabel} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{label}</span>
                            <span style={{ color: isHigher ? 'var(--teal)' : 'var(--mist)', fontWeight: isHigher ? 500 : 400 }}>
                              {score?.toFixed(3)} {isHigher ? '↑' : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Why they match */}
            <Panel>
              <SectionLabel>Why these materials match</SectionLabel>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.75 }}>
                The top discriminative attribute is <strong>{ATTR_DISPLAY[ATTRIBUTES.indexOf(topAttrs[0] as any)]}</strong> (Δ={result.explanations?.[topAttrs[0]]?.delta?.toFixed(3)}).
                The heatmap shows which spatial region of each image drove that score — brighter areas contributed more.
                Standard Grad-CAM gives one heatmap per model decision; this system produces {ATTRIBUTES.length} separate spatial maps,
                one per perceptual attribute, allowing attribute-level spatial attribution.
              </p>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, background: 'var(--teal-light)', color: 'var(--teal)', padding: '4px 12px', borderRadius: 20 }}>
                  {ATTRIBUTES.length} Grad-CAM heatmaps computed
                </span>
                <span style={{ fontSize: 12, background: 'var(--gold-light)', color: 'var(--gold)', padding: '4px 12px', borderRadius: 20 }}>
                  method: {result.method}
                </span>
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
