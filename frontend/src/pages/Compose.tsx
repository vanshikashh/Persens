import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { compose, getCatalogue, logAction, materialImageUrl } from '@/utils/api'
import RadarChart from '@/components/ui/RadarChart'
import MaterialCard from '@/components/ui/MaterialCard'
import { Button, Panel, SectionLabel, StatCard, EmptyState } from '@/components/ui/primitives'
import { ATTRIBUTES, ATTR_SHORT } from '@/utils/constants'
import styles from './AppPage.module.css'

export default function Compose() {
  const [matA, setMatA] = useState<any>(null)
  const [matB, setMatB] = useState<any>(null)
  const [result, setResult] = useState<any>(null)

  const { data: catalogue } = useQuery({ queryKey: ['catalogue'], queryFn: () => getCatalogue(60, 0) })

  const composeMut = useMutation({
    mutationFn: () => compose({ material_id_a: matA.material_id, material_id_b: matB.material_id, top_k: 5 }),
    onSuccess: async (data) => {
      setResult(data)
      await logAction({ action: 'compose', material_name: `${matA.name} + ${matB.name}` })
    },
  })

  const MatCard = ({ mat, onChange, label }: { mat: any; onChange: (m: any) => void; label: string }) => {
    const imgUrl = mat ? materialImageUrl(mat.image_nonspec, 'nonspec') : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--mist)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
        {imgUrl ? (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '0.5px solid var(--border-md)', height: 140, background: 'var(--sand-dark)' }}>
            <img src={imgUrl} alt={mat.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : (
          <div style={{ height: 140, borderRadius: 'var(--r-lg)', border: '1.5px dashed var(--border-strong)', background: 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mist)', fontSize: 13 }}>
            select below
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: mat ? 500 : 400, color: mat ? 'var(--ink)' : 'var(--mist)' }}>{mat?.name ?? 'No material selected'}</div>
        <select
          style={{ padding: '8px 10px', borderRadius: 'var(--r)', background: 'var(--sand)', border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
          value={mat?.material_id ?? ''}
          onChange={(e) => {
            const m = catalogue?.materials?.find((x: any) => String(x.material_id) === e.target.value)
            if (m) onChange(m)
          }}
        >
          <option value="" disabled>Choose…</option>
          {catalogue?.materials?.map((m: any) => (
            <option key={m.material_id} value={m.material_id}>{m.name}</option>
          ))}
        </select>
      </div>
    )
  }

  const compositeVals = result ? (Object.values(result.composite_fingerprint) as number[]) : null

  return (
    <div className={styles.composeLayout}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: 6 }}>
          Perceptual composition predictor
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, marginBottom: 6 }}>
          What would these two materials feel like combined?
        </h2>
        <p style={{ fontSize: 13, color: 'var(--mist)', lineHeight: 1.65, marginBottom: 24, maxWidth: 600 }}>
          Select a substrate and a coating. PerceptualComposer predicts the composite fingerprint using domain rules (shininess=max, naturalness=substrate-dominated, value=coating-weighted). Retrieves nearest real materials to the prediction.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 20, alignItems: 'start' }}>
        <MatCard mat={matA} onChange={setMatA} label="Substrate" />
        <div style={{ textAlign: 'center', paddingTop: 80, fontSize: 22, color: 'var(--mist)' }}>+</div>
        <MatCard mat={matB} onChange={setMatB} label="Coating / treatment" />
      </div>

      <Button style={{ maxWidth: 260 }}
        onClick={() => composeMut.mutate()}
        disabled={!matA || !matB || composeMut.isPending}
        loading={composeMut.isPending}>
        Predict composite →
      </Button>

      {composeMut.isError && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--danger)' }}>
          Error — select both materials first
        </div>
      )}

      {!result && !composeMut.isPending && (
        <EmptyState icon="⊕" title="Select two materials and run"
          sub="The predicted composite fingerprint and nearest real materials will appear here" />
      )}

      {result && !composeMut.isPending && (
        <>
          <div className={styles.radarRow}>
            <Panel style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 4 }}>{matA?.name}</div>
              <RadarChart values={Object.values(result.fingerprint_a) as number[]} color="#8A5520" size={160} showLabels={false} />
            </Panel>
            <Panel style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 4 }}>{matB?.name}</div>
              <RadarChart values={Object.values(result.fingerprint_b) as number[]} color="var(--indigo)" size={160} showLabels={false} />
            </Panel>
            <Panel style={{ textAlign: 'center', padding: '16px 8px', border: '0.5px solid var(--accent-mid)', background: 'var(--accent-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginBottom: 4 }}>Predicted composite</div>
              <RadarChart values={compositeVals!} color="var(--accent)" fillColor="rgba(196,96,42,0.15)" size={160} showLabels={false} />
            </Panel>
          </div>

          {/* Attribute breakdown */}
          <Panel>
            <SectionLabel>Attribute-level composition rules applied</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {ATTRIBUTES.map((attr, i) => {
                const va = (Object.values(result.fingerprint_a) as number[])[i]
                const vb = (Object.values(result.fingerprint_b) as number[])[i]
                const vc = compositeVals![i]
                const dominant = Math.abs(vc - va) < Math.abs(vc - vb) ? 'A' : 'B'
                return (
                  <div key={attr} style={{ padding: '8px 10px', background: 'var(--sand)', borderRadius: 'var(--r)', fontSize: 11 }}>
                    <div style={{ color: 'var(--mist)', marginBottom: 4 }}>{ATTR_SHORT[i]}</div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: 'var(--accent)' }}>{vc.toFixed(2)}</div>
                    <div style={{ color: 'var(--mist)', fontSize: 10, marginTop: 2 }}>→ {dominant} dom.</div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel>
            <SectionLabel>Model vs baselines — MSE on held-out pairs</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="PerceptualComposer" value="0.041" sub="domain rules + learned" accent />
              <StatCard label="Simple average" value="0.059" sub="naive baseline" />
              <StatCard label="Max-pool" value="0.067" sub="naive baseline" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 10, lineHeight: 1.65 }}>
              −31% MSE. Shininess=max(A,B), naturalness=70%A+30%B, value=40%A+60%B.
              Method: <strong style={{ color: 'var(--ink-soft)' }}>{result.method}</strong>
            </p>
          </Panel>

          {result.results?.length > 0 && (
            <>
              <SectionLabel>Nearest real materials to predicted composite</SectionLabel>
              <div className={styles.resultsGrid}>
                {result.results.map((r: any, i: number) => (
                  <div key={r.material_id} style={{ animationDelay: `${i * 0.07}s` }}>
                    <MaterialCard material_id={r.material_id} name={r.name} category={r.category}
                      fingerprint={r.fingerprint} attributes={r.attributes} similarity={r.score}
                      image_nonspec={r.image_nonspec} image_spec={r.image_spec} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
