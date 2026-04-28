import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(persist((set, get) => ({
  // User
  user: null,
  theme: 'dark',
  
  setUser: (user) => set({ user }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  
  // Auth
  login: async (email, password) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const state = get()
    const users = state.users || []
    const user = users.find(u => u.email === email && u.password === password)
    if (user) {
      set({ user: { id: user.id, email: user.email, name: user.name, plan: user.plan || 'free', requestsUsed: user.requestsUsed || 0 } })
      return { success: true }
    }
    return { success: false, error: 'Email ou mot de passe incorrect' }
  },
  
  register: async (email, password, name) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const state = get()
    const users = state.users || []
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Ce compte existe déjà' }
    }
    const newUser = { id: String(Date.now()), email, name, password, plan: 'free', requestsUsed: 0, createdAt: new Date().toISOString() }
    set({ users: [...users, newUser], user: { id: newUser.id, email: newUser.email, name: newUser.name, plan: 'free', requestsUsed: 0 } })
    return { success: true }
  },
  
  logout: () => set({ user: null }),

  // Plans & Requests
  getRemainingRequests: () => {
    const { user } = get()
    const limits = { free: 10, starter: 50, pro: 200, agency: 1000 }
    return user ? limits[user.plan] - (user.requestsUsed || 0) : 0
  },
  
  canUseModule: (moduleId) => {
    const { user } = get()
    if (!user) return false
    const freeModules = ['bant', 'email']
    if (freeModules.includes(moduleId)) return true
    return user.plan !== 'free'
  },

  useRequest: () => set((state) => ({ 
    user: state.user ? { ...state.user, requestsUsed: (state.user.requestsUsed || 0) + 1 } : null 
  })),

  // CRM
  contacts: [],
  addContact: (contact) => set((state) => ({ 
    contacts: [...state.contacts, { ...contact, id: Date.now(), createdAt: new Date().toISOString() }] 
  })),
  updateContact: (id, data) => set((state) => ({ 
    contacts: state.contacts.map(c => c.id === id ? { ...c, ...data } : c) 
  })),
  deleteContact: (id) => set((state) => ({ contacts: state.contacts.filter(c => c.id !== id) })),

  // History
  history: [],
  addToHistory: (item) => set((state) => ({ 
    history: [{ ...item, id: Date.now(), createdAt: new Date().toISOString() }, ...state.history.slice(0, 99)] 
  })),
  clearHistory: () => set({ history: [] }),

  // Favorites
  favorites: [],
  toggleFavorite: (id) => set((state) => ({
    favorites: state.favorites.includes(id) ? state.favorites.filter(f => f !== id) : [...state.favorites, id]
  })),

  // Saved Results
  savedResults: [],
  saveResult: (moduleId, output, title) => set((state) => ({
    savedResults: [...state.savedResults, { id: Date.now(), moduleId, output, title, createdAt: new Date().toISOString() }]
  })),
  deleteSavedResult: (id) => set((state) => ({ savedResults: state.savedResults.filter(r => r.id !== id) })),

  // Notifications
  notifications: [],
  addNotification: (n) => set((state) => ({ notifications: [...state.notifications, { ...n, id: Date.now(), read: false }] })),
  clearNotifications: () => set({ notifications: [] }),

  // Modules
  selectedModule: null,
  setSelectedModule: (m) => set({ selectedModule: m }),

  // Search
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Stats
  stats: { totalRequests: 0, totalLeads: 0 },
  incrementStat: (key) => set((state) => ({ stats: { ...state.stats, [key]: (state.stats[key] || 0) + 1 } })),
}), {
  name: 'leadflow-storage',
  partialize: (state) => ({ 
    user: state.user,
    theme: state.theme,
    contacts: state.contacts,
    history: state.history,
    favorites: state.favorites,
    savedResults: state.savedResults,
    stats: state.stats,
    users: state.users,
  })
}))

export default useStore
