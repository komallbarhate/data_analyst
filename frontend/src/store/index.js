import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Auth Store ────────────────────────────────────────────────────────────

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ user: null, token: null })
      },
    }),
    { name: 'auth-storage' }
  )
)

// ─── Dataset Store ─────────────────────────────────────────────────────────

export const useDatasetStore = create((set, get) => ({
  datasets: [],
  activeDataset: null,
  setDatasets: (datasets) => set({ datasets }),
  addDataset: (dataset) => set((state) => ({ datasets: [dataset, ...state.datasets] })),
  removeDataset: (id) =>
    set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
  setActiveDataset: (dataset) => set({ activeDataset: dataset }),
}))

// ─── Chat Store ────────────────────────────────────────────────────────────

export const useChatStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],          // messages for the active session
  isLoading: false,
  reasoning: [],         // current reasoning trace

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id, messages: [] }),
  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
  setReasoning: (reasoning) => set({ reasoning }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastAssistantMessage: (data) =>
    set((state) => {
      const msgs = [...state.messages]
      const lastIdx = msgs.map((m) => m.role).lastIndexOf('assistant')
      if (lastIdx >= 0) {
        msgs[lastIdx] = { ...msgs[lastIdx], ...data }
      }
      return { messages: msgs }
    }),
}))

// ─── UI Store ──────────────────────────────────────────────────────────────

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  activeTab: 'chat',      // 'chat' | 'datasets' | 'history'
  showReasoning: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleReasoning: () => set((state) => ({ showReasoning: !state.showReasoning })),
}))
