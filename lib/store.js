'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const StoreContext = createContext(null)

const createClientStore = () => create(persist((set, get) => ({
  trialLeads: [],
  addTrialLead: (email, name, company) => {
    const { trialLeads } = get()
    if (!trialLeads.find(l => l.email === email)) {
      set({ trialLeads: [...trialLeads, { id: Date.now(), email, name, company, createdAt: new Date().toISOString() }] })
    }
  },
  getTrialLead: (email) => get().trialLeads.find(l => l.email === email),
  updateTrialLead: (email, data) => set((state) => ({
    trialLeads: state.trialLeads.map(l => l.email === email ? { ...l, ...data } : l)
  })),
  user: null,
  setUser: (user) => set({ user }),
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  login: async (email, password) => {
    const demoUsers = {
      'demo@leadflow.io': { id: '1', email: 'demo@leadflow.io', name: 'Marie Demo', plan: 'free', requestsUsed: 3, createdAt: '2026-01-01' },
      'pro@leadflow.io': { id: '2', email: 'pro@leadflow.io', name: 'Jean Pro', plan: 'pro', requestsUsed: 42, createdAt: '2026-02-15' },
      'agency@leadflow.io': { id: '3', email: 'agency@leadflow.io', name: 'Sophie Agency', plan: 'agency', requestsUsed: 156, createdAt: '2026-01-20', team: ['user1@corp.com', 'user2@corp.com'] }
    }
    const passwords = { 'demo@leadflow.io': 'demo123', 'pro@leadflow.io': 'pro123', 'agency@leadflow.io': 'agency123' }
    await new Promise(resolve => setTimeout(resolve, 500))
    const user = demoUsers[email]
    if (user && password === passwords[email]) {
      set({ user })
      return { success: true }
    }
    return { success: false, error: user ? 'Mot de passe incorrect' : 'Identifiants incorrects' }
  },
  register: async (email, password, name) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    set({ user: { id: String(Date.now()), email, name, plan: 'free', requestsUsed: 0, createdAt: new Date().toISOString() } })
    return { success: true }
  },
  logout: () => set({ user: null }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  favorites: [],
  toggleFavorite: (id) => set((state) => ({
    favorites: state.favorites.includes(id) ? state.favorites.filter(f => f !== id) : [...state.favorites, id]
  })),
  history: [],
  addToHistory: (item) => set((state) => ({ history: [item, ...state.history.slice(0, 49)] })),
  clearHistory: () => set({ history: [] }),
  savedResults: [],
  saveResult: (moduleId, input, output) => set((state) => ({
    savedResults: [...state.savedResults, { id: Date.now(), moduleId, input, output, createdAt: new Date().toISOString() }]
  })),
  deleteSavedResult: (id) => set((state) => ({ savedResults: state.savedResults.filter(r => r.id !== id) })),
  contacts: [],
  addContact: (contact) => set((state) => ({ contacts: [...state.contacts, { ...contact, id: Date.now(), createdAt: new Date().toISOString() }] })),
  updateContact: (id, data) => set((state) => ({ contacts: state.contacts.map(c => c.id === id ? { ...c, ...data } : c) })),
  deleteContact: (id) => set((state) => ({ contacts: state.contacts.filter(c => c.id !== id) })),
  notifications: [],
  addNotification: (n) => set((state) => ({ notifications: [...state.notifications, { ...n, id: Date.now(), read: false }] })),
  markNotificationRead: (id) => set((state) => ({ notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  clearNotifications: () => set({ notifications: [] }),
  selectedModule: null,
  setSelectedModule: (m) => set({ selectedModule: m }),
  getRemainingRequests: () => {
    const { user } = get()
    const limits = { free: 5, pro: 200, agency: 1000 }
    return user ? limits[user.plan] - (user.requestsUsed || 0) : 0
  },
  canUseModule: () => { const { user } = get(); return user && user.plan !== 'free' },
  useRequest: () => set((state) => ({ user: state.user ? { ...state.user, requestsUsed: (state.user.requestsUsed || 0) + 1 } : null })),
  stats: { emailsSent: 0, callsMade: 0, meetingsBooked: 0, revenue: 0 },
  incrementStat: (key) => set((state) => ({ stats: { ...state.stats, [key]: (state.stats[key] || 0) + 1 } }))
}), { name: 'leadflow-storage' }))

let store
const getStore = () => {
  if (!store) store = createClientStore()
  return store
}

export function StoreProvider({ children }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    getStore()
  }, [])
  
  if (!mounted) return <div className="min-h-screen bg-[#0a0a0f]" />
  
  return <StoreContext.Provider value={getStore()}>{children}</StoreContext.Provider>
}

function useStoreShim(selector) {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  )
}

export function useStore(selector) {
  const store = useContext(StoreContext)
  
  if (!store) {
    try {
      return selector ? selector(getStore().getState()) : getStore()
    } catch {
      return selector ? () => undefined : { getState: () => ({}), subscribe: () => {} }
    }
  }
  
  return useSyncExternalStore(
    store.subscribe,
    () => selector ? selector(store.getState()) : store.getState(),
    () => selector ? selector(store.getState()) : store.getState()
  )
}

export const useUser = () => useStore(s => s?.user)
export const useTheme = () => useStore(s => s?.theme)
export const useFavorites = () => useStore(s => s?.favorites)
export const useHistory = () => useStore(s => s?.history)
export const useContacts = () => useStore(s => s?.contacts)
export const useNotifications = () => useStore(s => s?.notifications)