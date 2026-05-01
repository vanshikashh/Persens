import axios from 'axios'

const BASE = "https://persens-production.up.railway.app"
const api = axios.create({ baseURL: `${BASE}/api` })

export function materialImageUrl(filename: string | null | undefined, type: 'nonspec' | 'spec' = 'nonspec'): string | null {
  if (!filename) return null
  const folder = type === 'nonspec' ? 'nonspec' : 'spec'
  return `${BASE}/images/${folder}/${filename}`
}

// ── Fingerprint ───────────────────────────────────────────────────────────────
export async function extractFingerprint(frame1: File, frame60?: File) {
  const form = new FormData()
  form.append('frame1', frame1)
  if (frame60) form.append('frame60', frame60)
  const { data } = await api.post('/fingerprint/extract', form)
  return data
}

export async function getFingerprintStatus() {
  const { data } = await api.get('/fingerprint/status')
  return data
}

// ── Retrieve ──────────────────────────────────────────────────────────────────
export async function retrieve(fingerprint: number[], topK = 5, materialId?: number) {
  const { data } = await api.post('/retrieve/', { fingerprint, top_k: topK, material_id: materialId })
  return data
}

export async function getMaterial(id: number) {
  const { data } = await api.get(`/retrieve/material/${id}`)
  return data
}

export async function getCatalogue(limit = 60, offset = 0) {
  const { data } = await api.get('/retrieve/catalogue', { params: { limit, offset } })
  return data
}

// ── Edit ──────────────────────────────────────────────────────────────────────
export async function attributeEdit(payload: {
  source_material_id?: number
  base_fingerprint?: number[]
  edits: Record<string, number>
  alpha?: number
  top_k?: number
}) {
  const { data } = await api.post('/edit/', payload)
  return data
}

// ── Authenticate ──────────────────────────────────────────────────────────────
export async function authenticateImages(reference: File, query: File) {
  const form = new FormData()
  form.append('reference', reference)
  form.append('query', query)
  const { data } = await api.post('/authenticate/images', form)
  return data
}

export async function authenticateFingerprints(payload: {
  reference_material_id?: number
  reference_fingerprint?: number[]
  query_fingerprint: number[]
}) {
  const { data } = await api.post('/authenticate/fingerprints', payload)
  return data
}

// ── Compose ───────────────────────────────────────────────────────────────────
export async function compose(payload: {
  material_id_a?: number
  material_id_b?: number
  fingerprint_a?: number[]
  fingerprint_b?: number[]
  top_k?: number
}) {
  const { data } = await api.post('/compose/', payload)
  return data
}

// ── Explain ───────────────────────────────────────────────────────────────────
export async function explainPair(payload: {
  query_material_id?: number
  match_material_id?: number
  query_fingerprint?: number[]
  match_fingerprint?: number[]
  top_n?: number
}) {
  const { data } = await api.post('/explain/pair', payload)
  return data
}

// ── History ───────────────────────────────────────────────────────────────────
export async function logAction(entry: {
  action: string
  material_id?: number
  material_name?: string
  details?: Record<string, unknown>
}) {
  await api.post('/history/log', entry).catch(() => {})
}

export async function getHistory(limit = 30) {
  const { data } = await api.get('/history/', { params: { limit } })
  return data
}

export async function saveMaterial(m: {
  material_id: number
  material_name: string
  category: string
  fingerprint: number[]
}) {
  const { data } = await api.post('/history/save', m)
  return data
}

export async function unsaveMaterial(id: number) {
  await api.delete(`/history/save/${id}`)
}

export async function getSaved() {
  const { data } = await api.get('/history/saved')
  return data
}

export async function checkHealth() {
  const { data } = await api.get('/health')
  return data
}
