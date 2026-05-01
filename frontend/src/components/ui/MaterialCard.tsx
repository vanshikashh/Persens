import { useState } from 'react'
import { useStore } from '@/store'
import { CATEGORY_TAGS } from '@/utils/constants'
import { materialImageUrl } from '@/utils/api'
import styles from './MaterialCard.module.css'

interface Props {
  material_id: number
  name: string
  category: string
  fingerprint?: number[]
  attributes?: Record<string, number>
  similarity?: number
  image_nonspec?: string
  image_spec?: string
  onClick?: () => void
  showSave?: boolean
  size?: 'normal' | 'large'
}

const CAT_FALLBACK_BG: Record<string, string> = {
  fabric:  'linear-gradient(135deg,#e8d5f0 0%,#d4b8e8 100%)',
  wood:    'linear-gradient(135deg,#f0e0c0 0%,#d4b88a 100%)',
  coating: 'linear-gradient(135deg,#c8e8e0 0%,#a0d4c8 100%)',
  paper:   'linear-gradient(135deg,#dce8f8 0%,#b8d0f0 100%)',
  plastic: 'linear-gradient(135deg,#f8dcd8 0%,#f0b8b0 100%)',
  metal:   'linear-gradient(135deg,#dce0e8 0%,#b8c0d0 100%)',
  leather: 'linear-gradient(135deg,#e8d8c8 0%,#c8a880 100%)',
  other:   'linear-gradient(135deg,#e0e0e0 0%,#c8c8c8 100%)',
}

export default function MaterialCard({
  material_id, name, category, fingerprint, attributes,
  similarity, image_nonspec, image_spec, onClick, showSave = true, size = 'normal',
}: Props) {
  const { isSaved, toggleSave } = useStore()
  const [imgError, setImgError] = useState(false)
  const saved = isSaved(material_id)
  const tag   = CATEGORY_TAGS[category] ?? CATEGORY_TAGS.other
  const pct   = similarity !== undefined ? Math.round(similarity * 100) : null
  const imgUrl = materialImageUrl(image_nonspec, 'nonspec')

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (!fingerprint || !attributes) return
    toggleSave({ material_id, name, category, fingerprint, attributes,
                 image_nonspec, image_spec })
  }

  const imgH = size === 'large' ? 200 : 130

  return (
    <div
      className={`${styles.card} ${saved ? styles.saved : ''} ${size === 'large' ? styles.large : ''} animate-fade-up`}
      onClick={onClick}
    >
      <div className={styles.imgWrap} style={{ height: imgH }}>
        {imgUrl && !imgError ? (
          <img
            src={imgUrl}
            alt={name}
            className={styles.img}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={styles.imgFallback}
            style={{ background: CAT_FALLBACK_BG[category] ?? CAT_FALLBACK_BG.other }}
          >
            <span className={styles.catInitial}>
              {category.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className={styles.imgOverlay} />
        <span className={styles.idBadge}>#{material_id}</span>
        {showSave && fingerprint && (
          <button
            className={`${styles.saveBtn} ${saved ? styles.saveBtnActive : ''}`}
            onClick={handleSave}
            title={saved ? 'Unsave' : 'Save'}
          >
            {saved ? '★' : '☆'}
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.name} title={name}>{name}</div>
        <span className={styles.tag} style={{ background: tag.bg, color: tag.color }}>
          {category}
        </span>

        {pct !== null && (
          <div className={styles.simRow}>
            <div className={styles.simBar}>
              <div
                className={styles.simFill}
                style={{
                  width: `${pct}%`,
                  background: pct > 85 ? 'var(--teal)' : pct > 70 ? 'var(--indigo)' : 'var(--accent)',
                }}
              />
            </div>
            <span className={styles.simPct}
              style={{ color: pct > 85 ? 'var(--teal)' : pct > 70 ? 'var(--indigo)' : 'var(--accent)' }}>
              {pct}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
