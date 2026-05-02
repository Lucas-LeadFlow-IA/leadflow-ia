'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const StoreContext = createContext(null)

const createClientStore = () => create(persist((set, get) => ({
  user: null,
  theme: 'dark',
  
  setUser: (user) => set({ user }),
  
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  
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
  
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  
  favorites: [],
  toggleFavorite: (id) => set((state) => ({
    favorites: state.favorites.includes(id) ? state.favorites.filter(f => f !== id) : [...state.favorites, id]
  })),
  
  history: [],
  addToHistory: (item) => set((state) => ({ history: [{ ...item, id: Date.now(), createdAt: new Date().toISOString() }, ...state.history.slice(0, 99)] })),
  clearHistory: () => set({ history: [] }),
  
  savedResults: [],
  saveResult: (moduleId, input, output) => set((state) => ({
    savedResults: [...state.savedResults, { id: Date.now(), moduleId, input, output, createdAt: new Date().toISOString() }]
  })),
  deleteSavedResult: (id) => set((state) => ({ savedResults: state.savedResults.filter(r => r.id !== id) })),
  
  contacts: [],
  addContact: (contact) => set((state) => ({ 
    contacts: [...state.contacts, { ...contact, id: Date.now(), createdAt: new Date().toISOString() }] 
  })),
  updateContact: (id, data) => set((state) => ({ 
    contacts: state.contacts.map(c => c.id === id ? { ...c, ...data } : c) 
  })),
  deleteContact: (id) => set((state) => ({ contacts: state.contacts.filter(c => c.id !== id) })),
  
  notifications: [],
  addNotification: (n) => set((state) => ({ notifications: [...state.notifications, { ...n, id: Date.now(), read: false }] })),
  clearNotifications: () => set({ notifications: [] }),
  
  selectedModule: null,
  setSelectedModule: (m) => set({ selectedModule: m }),
  
  getRemainingRequests: () => {
    const { user } = get()
    const limits = { free: 5, pro: 200, agency: 1000 }
    return user ? limits[user.plan] - (user.requestsUsed || 0) : 0
  },
  
  canUseModule: () => { const { user } = get(); return user && user.plan !== 'free' },
  
  useRequest: () => set((state) => ({ 
    user: state.user ? { ...state.user, requestsUsed: (state.user.requestsUsed || 0) + 1 } : null 
  })),
  
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

export function useStore(selector) {
  const store = useContext(StoreContext)
  if (!store) {
    try {
      return selector ? selector(getStore().getState()) : getStore()
    } catch {
      return selector ? () => null : { getState: () => null, subscribe: () => {} }
    }
  }
  return selector ? selector(store.getState()) : store.getState()
}

export const useUser = () => useStore(s => s?.user)
export const useTheme = () => useStore(s => s?.theme)
export const useFavorites = () => useStore(s => s?.favorites)
export const useHistory = () => useStore(s => s?.history)
export const useContacts = () => useStore(s => s?.contacts)
export const useNotifications = () => useStore(s => s?.notifications)