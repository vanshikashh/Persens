import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import styles from './DropZone.module.css'

interface Props {
  onFile: (file: File) => void
  label?: string
  sub?: string
  accepted?: File | null
  accent?: 'default' | 'teal' | 'accent'
}

export default function DropZone({
  onFile, label = 'Drop image here', sub = 'JPG, PNG, WEBP',
  accepted, accent = 'default',
}: Props) {
  const onDrop = useCallback((files: File[]) => {
    if (files[0]) onFile(files[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  })

  const cls = [
    styles.zone,
    isDragActive ? styles.dragging : '',
    accepted      ? styles.accepted  : '',
    styles[accent] ?? '',
  ].join(' ')

  return (
    <div {...getRootProps()} className={cls}>
      <input {...getInputProps()} />
      {accepted ? (
        <>
          <div className={styles.checkIcon}>✓</div>
          <div className={styles.fileName}>{accepted.name}</div>
          <div className={styles.sub}>tap to change</div>
        </>
      ) : (
        <>
          <div className={styles.uploadIcon}>↑</div>
          <div className={styles.label}>{label}</div>
          <div className={styles.sub}>{sub}</div>
        </>
      )}
    </div>
  )
}
