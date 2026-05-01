import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { extractFingerprint, retrieve, logAction, checkHealth, materialImageUrl } from '@/utils/api'
import { useStore } from '@/store'
import RadarChart from '@/components/ui/RadarChart'
import MaterialCard from '@/components/ui/MaterialCard'
import DropZone from '@/components/ui/DropZone'
import { Button, Panel, SectionLabel, EmptyState } from '@/components/ui/primitives'
import { ATTR_SHORT } from '@/utils/constants'
import styles from './AppPage.module.css'

export default function Retrieve() {
  const { setActive, addHistory } = useStore()
  const [file1,   setFile1]   = useState<File | null>(null)
  const [file60,  setFile60]  = useState<File | null>(null)
  const [fpData,  setFpData]  = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { data: health } = useQuery({ queryKey: ['health'], queryFn: checkHealth })

  const handleFile1 = useCallback((f: File) => {
    setFile1(f)
    setPreviewUrl(URL.createObjectURL(f))
    setFpData(null); setResults([])
  }, [])

  const extractMut = useMutation({
    mutationFn: () => extractFingerprint(file1!, file60 ?? undefined),
    onSuccess: async (data) => {
      const fp = data.fingerprint.values as number[]
      setFpData(data)
      setActive(fp, undefined, file1!.name.replace(/\.[^.]+$/, ''))
      addHistory({ action: 'retrieve', name: file1!.name })
      await logAction({ action: 'retrieve', material_name: file1!.name })
      retrieveMut.mutate(fp)
    },
  })

  const retrieveMut = useMutation({
    mutationFn: (fp: number[]) => retrieve(fp, 5),
    onSuccess: (data) => setResults(data.results),
  })

  const fp = fpData?.fingerprint?.values as number[] | undefined
  const isLoading = extractMut.isPending || retrieveMut.isPending
  const confidence = fpData?.fingerprint?.confidence
  const realCV = fpData?.real_cv ?? health?.real_cv

  return (
    <div className={styles.appLayout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        {/* Status banner */}
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--r)',
          background: realCV ? 'var(--teal-light)' : 'var(--gold-light)',
          border: `0.5px solid ${realCV ? 'var(--teal-mid)' : 'var(--gold)'}`,
          fontSize: 11, color: realCV ? 'var(--teal)' : 'var(--gold)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{realCV ? '●' : '○'}</span>
          {realCV ? 'CLIP + C-MLP active' : 'Mock extractor — add weights for real CV'}
        </div>

        <SectionLabel>Upload material</SectionLabel>
        <DropZone
          onFile={handleFile1}
          label="Frame 1 · non-specular"
          sub="Drop any material photo"
          accepted={file1}
        />

        {previewUrl && (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
            <img src={previewUrl} alt="preview" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <div>
          <DropZone
            onFile={setFile60}
            label="Frame 60 · near-specular (optional)"
            sub="Improves shininess/sparkle accuracy"
            accepted={file60}
            accent="teal"
          />
        </div>

        {fp && (
          <div>
            <SectionLabel>Perceptual fingerprint</SectionLabel>
            <Panel style={{ padding: '8px 4px' }}>
              <RadarChart values={fp} size={220} />
            </Panel>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--mist)' }}>Confidence</span>
              <span style={{
                fontSize: 11, fontWeight: 500,
                padding: '2px 9px', borderRadius: 20,
                background: confidence > 0.85 ? 'var(--teal-light)' : 'var(--gold-light)',
                color: confidence > 0.85 ? 'var(--teal)' : 'var(--gold)',
              }}>
                {(confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Top attribute values */}
        {fp && (
          <div>
            <SectionLabel>Top attributes</SectionLabel>
            {[...fp.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v).slice(0, 5).map(({ v, i }) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                <span style={{ flex: 1, color: 'var(--ink-soft)' }}>{ATTR_SHORT[i]}</span>
                <div style={{ width: 80, height: 3, background: 'var(--sand-dark)', borderRadius: 2 }}>
                  <div style={{ width: `${v * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--mist)', minWidth: 30, textAlign: 'right' }}>{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <Button style={{ width: '100%' }}
            onClick={() => file1 && extractMut.mutate()}
            disabled={!file1 || isLoading} loading={isLoading}>
            {isLoading ? (extractMut.isPending ? 'Extracting fingerprint…' : 'Searching 347 materials…') : 'Fingerprint & retrieve →'}
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.mainPanel}>
        <div className={styles.resultsHeader}>
          <div>
            <div className={styles.resultsTitle}>
              {results.length > 0 ? `${results.length} materials retrieved` : 'Upload a material to begin'}
            </div>
            {results.length > 0 && (
              <div className={styles.resultsMeta}>
                {health?.materials ?? '—'} materials indexed · cosine similarity · {realCV ? 'real CLIP features' : 'mock features'}
              </div>
            )}
          </div>
        </div>

        {(extractMut.isError || retrieveMut.isError) && (
          <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--danger)' }}>
            Error — is the backend running? Check the terminal.
          </div>
        )}

        {isLoading && (
          <div className={styles.skeletonGrid}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        )}

        {!isLoading && results.length === 0 && !extractMut.isError && (
          <EmptyState icon="◈" title="Your retrieval results will appear here"
            sub="Top-5 by cosine similarity in 16-dimensional perceptual fingerprint space" />
        )}

        {!isLoading && results.length > 0 && (
          <>
            {/* Compare fingerprints */}
            {fp && results[0] && (
              <Panel>
                <SectionLabel>Query vs best match — fingerprint overlay</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>Your material</div>
                    <RadarChart values={fp} size={180} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>{results[0].name} · {Math.round(results[0].score * 100)}% match</div>
                    <RadarChart values={results[0].fingerprint} size={180} color="var(--teal)" compareValues={fp} compareColor="var(--accent)" />
                  </div>
                </div>
              </Panel>
            )}

            <div className={styles.resultsGrid}>
              {results.map((r, i) => (
                <div key={r.material_id} style={{ animationDelay: `${i * 0.07}s` }}>
                  <MaterialCard
                    material_id={r.material_id}
                    name={r.name}
                    category={r.category}
                    fingerprint={r.fingerprint}
                    attributes={r.attributes}
                    similarity={r.score}
                    image_nonspec={r.image_nonspec}
                    image_spec={r.image_spec}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
