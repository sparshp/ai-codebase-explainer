import { create } from 'zustand'

interface Citation {
  filePath:  string
  line:      number
  verified:  boolean
  chunkText?: string
}

interface UIState {
  activeCitation:    Citation | null
  activeRepoId:      string | null
  sidebarOpen:       boolean
  setActiveCitation: (c: Citation | null) => void
  setActiveRepoId:   (id: string | null)  => void
  toggleSidebar:     () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeCitation:    null,
  activeRepoId:      null,
  sidebarOpen:       true,
  setActiveCitation: (c)  => set({ activeCitation: c }),
  setActiveRepoId:   (id) => set({ activeRepoId: id }),
  toggleSidebar:     ()   => set(s => ({ sidebarOpen: !s.sidebarOpen })),
}))

