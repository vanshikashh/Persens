import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MaterialRecord {
  material_id: number
  name: string
  category: string
  fingerprint: number[]
  attributes: Record<string, number>
  image_nonspec?: string
  image_spec?: string
}

interface AppState {
  activeFP: number[] | null
  activeMatId: number | null
  activeName: string | null
  setActive: (fp: number[], id?: number, name?: string) => void
  clearActive: () => void

  saved: Record<number, MaterialRecord>
  toggleSave: (m: MaterialRecord) => void
  isSaved: (id: number) => boolean

  history: Array<{
    id: string; action: string; name: string; time: string; matId?: number
  }>
  addHistory: (entry: { action: string; name: string; matId?: number }) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeFP: null, activeMatId: null, activeName: null,
      setActive: (fp, id, name) =>
        set({ activeFP: fp, activeMatId: id ?? null, activeName: name ?? null }),
      clearActive: () => set({ activeFP: null, activeMatId: null, activeName: null }),

      saved: {},
      toggleSave: (m) => set((s) => {
        const next = { ...s.saved }
        if (next[m.material_id]) { delete next[m.material_id] } else { next[m.material_id] = m }
        return { saved: next }
      }),
      isSaved: (id) => !!get().saved[id],

      history: [],
      addHistory: ({ action, name, matId }) => set((s) => ({
        history: [{
          id: Math.random().toString(36).slice(2, 8),
          action, name, matId,
          time: new Date().toISOString(),
        }, ...s.history].slice(0, 50),
      })),
    }),
    {
      name: 'lensid-store',
      partialize: (s) => ({ saved: s.saved, history: s.history }),
    }
  )
)
