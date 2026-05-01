import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '@/utils/api'
import styles from './Landing.module.css'

const FEATURES = [
  {
    icon: '✦', title: 'Attribute-directed search',
    desc: 'Move sliders to navigate perceptual space. "Find me something like this fabric, but shinier." Grounded in 110k human ratings — not metadata filters.',
    tag: 'Feature 1 · Perceptual editor', accent: 'orange', route: '/edit',
  },
  {
    icon: '◎', title: 'Material authentication',
    desc: 'Detect counterfeits by measuring fingerprint drift on illumination-robust intrinsic attributes. Calibrated on 95th-percentile intra-material variance.',
    tag: 'Feature 2 · Drift detection', accent: 'teal', route: '/authenticate',
  },
  {
    icon: '⊕', title: 'Perceptual composition',
    desc: 'Predict how a fabric + coating composite feels perceptually — before physical production. PerceptualComposer outperforms linear blending by 31% MSE.',
    tag: 'Feature 3 · Composite predictor', accent: 'indigo', route: '/compose',
  },
  {
    icon: '⬡', title: 'Per-attribute Grad-CAM',
    desc: '16 spatial heatmaps per image — one per attribute. See which region drove the roughness score vs the shininess score. Novel attribute-level explainability.',
    tag: 'Feature 4 · Spatial explanations', accent: 'gold', route: '/explain',
  },
]

export default function Landing() {
  const nav = useNavigate()
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: checkHealth })

  const statRows = [
    { num: health?.materials ? String(health.materials) : '347', label: 'Indexed materials' },
    { num: '110k+', label: 'Human perceptual ratings' },
    { num: '0.945', label: 'RSM correlation · test set' },
  ]

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          Built on Filip et al. arXiv:2410.13615
          {health && (
            <span style={{ marginLeft: 10, opacity: 0.7 }}>
              · {health.mode === 'real' ? '● CLIP active' : '○ mock mode'}
            </span>
          )}
        </div>

        <h1 className={styles.headline}>
          Every material has a<br />
          <em>perceptual fingerprint.</em>
        </h1>

        <p className={styles.sub}>
          Persens is a 16-dimensional material intelligence platform — encoding exactly how humans perceive surface properties, validated across 110,000+ psychophysical ratings and 347 real materials.{' '}
          <strong>110,000+ psychophysical ratings</strong> and 347 real materials.
        </p>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => nav('/retrieve')}>
            Try live demo →
          </button>
          <button className={styles.btnSecondary} onClick={() => nav('/compose')}>
            Compose two materials
          </button>
        </div>

        <div className={styles.stats}>
          {statRows.map(s => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statNum}>{s.num}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featuresLabel}>Four capabilities — beyond the paper</div>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.route}
              className={`${styles.card} ${styles[`card_${f.accent}`]}`}
              onClick={() => nav(f.route)}
            >
              <div className={`${styles.cardIcon} ${styles[`icon_${f.accent}`]}`}>{f.icon}</div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
              <span className={`${styles.cardTag} ${styles[`tag_${f.accent}`]}`}>{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Paper reference footer */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2.5rem 60px' }}>
        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--mist)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Foundation paper</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Filip J., Dechterenko F., Schmidt F., Lukavsky J., Vilimovska V., Kotera J., Fleming R.W.<br />
              <em>Material Fingerprinting: Identifying and Predicting Perceptual Attributes of Material Appearance</em><br />
              arXiv:2410.13615, October 2024
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Retrieve', 'Edit', 'Authenticate', 'Compose', 'Explain'].map(page => (
              <button key={page}
                onClick={() => nav('/' + page.toLowerCase())}
                style={{ background: 'transparent', border: '0.5px solid var(--border-strong)', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink-soft)', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--white)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
