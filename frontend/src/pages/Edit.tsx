import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { attributeEdit, getCatalogue, logAction, materialImageUrl } from '@/utils/api'
import { useStore } from '@/store'
import RadarChart from '@/components/ui/RadarChart'
import MaterialCard from '@/components/ui/MaterialCard'
import { Button, Panel, SectionLabel, EmptyState } from '@/components/ui/primitives'
import { ATTRIBUTES, ATTR_SHORT, ATTR_DISPLAY } from '@/utils/constants'
import styles from './AppPage.module.css'

export default function Edit() {
  const { activeFP, activeMatId, activeName, addHistory } = useStore()
  const [sourceMat, setSourceMat] = useState<any>(null)
  const [sliders,   setSliders]   = useState<number[]>([])
  const [original,  setOriginal]  = useState<number[]>([])
  const [results,   setResults]   = useState<any[]>([])
  const [fidelity,  setFidelity]  = useState<Record<string, number>>({})

  const { data: catalogue } = useQuery({ queryKey: ['catalogue'], queryFn: () => getCatalogue(60, 0) })

  useEffect(() => {
    if (activeFP && activeFP.length === 16) {
      setSliders([...activeFP]); setOriginal([...activeFP])
    }
  }, [activeFP])

  function loadMaterial(mat: any) {
    setSourceMat(mat)
    const fp = mat.fingerprint as number[]
    setSliders([...fp]); setOriginal([...fp]); setResults([])
  }

  const editMut = useMutation({
    mutationFn: () => {
      const edits: Record<string, number> = {}
      ATTRIBUTES.forEach((attr, i) => {
        if (Math.abs(sliders[i] - original[i]) > 0.005) edits[attr] = sliders[i]
      })
      if (Object.keys(edits).length === 0) throw new Error('Adjust at least one slider first')
      return attributeEdit({
        base_fingerprint: original,
        source_material_id: sourceMat?.material_id ?? activeMatId ?? undefined,
        edits, alpha: 0.7, top_k: 5,
      })
    },
    onSuccess: async (data) => {
      setResults(data.results)
      setFidelity(data.attribute_fidelity_mae ?? {})
      addHistory({ action: 'edit', name: sourceMat?.name ?? activeName ?? 'custom' })
      await logAction({ action: 'edit' })
    },
  })

  const fp16       = sliders.length === 16 ? sliders : null
  const hasEdits   = fp16 ? ATTRIBUTES.some((_, i) => Math.abs(sliders[i] - original[i]) > 0.005) : false
  const sourceImgUrl = sourceMat ? materialImageUrl(sourceMat.image_nonspec, 'nonspec') : null

  return (
    <div className={styles.appLayout}>
      <aside className={styles.sidebar}>
        <SectionLabel>Source material</SectionLabel>

        {activeFP && activeFP.length === 16 && (
          <div style={{ padding: '8px 12px', background: 'var(--teal-light)', border: '0.5px solid var(--teal-mid)', borderRadius: 'var(--r)', fontSize: 11, color: 'var(--teal)', fontWeight: 500 }}>
            ✓ Active fingerprint from Retrieve
          </div>
        )}

        <select
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r)', background: 'var(--sand)', border: '0.5px solid var(--border-strong)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          defaultValue=""
          onChange={(e) => {
            const mat = catalogue?.materials?.find((m: any) => String(m.material_id) === e.target.value)
            if (mat) loadMaterial(mat)
          }}
        >
          <option value="" disabled>Pick from library…</option>
          {catalogue?.materials?.map((m: any) => (
            <option key={m.material_id} value={m.material_id}>{m.name}</option>
          ))}
        </select>

        {/* Source image preview */}
        {(sourceImgUrl || sourceMat) && (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
            {sourceImgUrl ? (
              <img src={sourceImgUrl} alt={sourceMat?.name}
                style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ height: 80, background: 'var(--sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--mist)' }}>
                {sourceMat?.name}
              </div>
            )}
          </div>
        )}

        {fp16 && (
          <>
            <div style={{ height: '0.5px', background: 'var(--border)' }} />
            <SectionLabel>Adjust perceptual attributes</SectionLabel>
            <div className={styles.attrList}>
              {ATTRIBUTES.map((attr, i) => {
                const changed = Math.abs((sliders[i] ?? 0) - (original[i] ?? 0)) > 0.01
                return (
                  <div key={attr} className={styles.attrRow} title={ATTR_DISPLAY[i]}>
                    <span className={styles.attrName} style={{ color: changed ? 'var(--accent)' : undefined, fontWeight: changed ? 500 : 400 }}>
                      {ATTR_SHORT[i]}
                    </span>
                    <input type="range" min={0} max={1} step={0.01}
                      value={sliders[i] ?? 0}
                      className={styles.attrSlider}
                      onChange={(e) => {
                        const next = [...sliders]
                        next[i] = parseFloat(e.target.value)
                        setSliders(next)
                      }}
                    />
                    <span className={styles.attrVal} style={{ color: changed ? 'var(--accent)' : undefined }}>
                      {(sliders[i] ?? 0).toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!fp16 && <EmptyState icon="✦" title="Select a material first" sub="Pick from the library above or retrieve one on the Retrieve page" />}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button style={{ width: '100%' }}
            onClick={() => editMut.mutate()}
            disabled={!fp16 || !hasEdits || editMut.isPending}
            loading={editMut.isPending}>
            Find matching materials →
          </Button>
          {fp16 && (
            <Button variant="secondary" style={{ width: '100%', fontSize: 13, padding: '9px 16px' }}
              onClick={() => { setSliders([...original]); setResults([]) }}>
              Reset to original
            </Button>
          )}
        </div>
      </aside>

      <div className={styles.mainPanel}>
        <div className={styles.resultsHeader}>
          <div>
            <div className={styles.resultsTitle}>Attribute-directed results</div>
            {results.length > 0 && Object.entries(fidelity).length > 0 && (
              <div className={styles.resultsMeta}>
                Fidelity MAE: {Object.entries(fidelity).map(([k, v]) =>
                  `${ATTR_SHORT[ATTRIBUTES.indexOf(k as any)]}=${v.toFixed(2)}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* Delta pills */}
        {fp16 && hasEdits && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ATTRIBUTES.map((attr, i) => {
              const d = sliders[i] - original[i]
              if (Math.abs(d) < 0.005) return null
              return (
                <span key={attr} style={{ background: 'var(--sand)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {ATTR_SHORT[i]}{' '}
                  <strong style={{ color: d > 0 ? 'var(--teal)' : 'var(--accent)', fontWeight: 500 }}>
                    {d > 0 ? '+' : ''}{d.toFixed(2)}
                  </strong>
                </span>
              )
            })}
          </div>
        )}

        {fp16 && results.length > 0 && (
          <Panel>
            <SectionLabel>Fingerprint comparison — original vs modified</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>Original</div>
                <RadarChart values={original} size={160} color="var(--mist)" /></div>
              <div><div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>Modified</div>
                <RadarChart values={sliders} size={160} color="var(--accent)" compareValues={original} compareColor="var(--mist)" /></div>
            </div>
          </Panel>
        )}

        {editMut.isError && (
          <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--danger)' }}>
            {(editMut.error as Error).message}
          </div>
        )}

        {editMut.isPending && (
          <div className={styles.skeletonGrid}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        )}

        {!editMut.isPending && results.length === 0 && !editMut.isError && (
          <EmptyState icon="✦"
            title={fp16 ? 'Adjust sliders then run search' : 'Select a source material to begin'}
            sub="Navigate the perceptual space — find materials that are shinier, rougher, warmer…" />
        )}

        {!editMut.isPending && results.length > 0 && (
          <div className={styles.resultsGrid}>
            {results.map((r, i) => (
              <div key={r.material_id} style={{ animationDelay: `${i * 0.07}s` }}>
                <MaterialCard material_id={r.material_id} name={r.name} category={r.category}
                  fingerprint={r.fingerprint} attributes={r.attributes} similarity={r.score}
                  image_nonspec={r.image_nonspec} image_spec={r.image_spec} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
