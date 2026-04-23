"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      // Email capture for free trial leads
      trialLeads: [],
      addTrialLead: (email, name, company) => {
        const { trialLeads } = get()
        const existing = trialLeads.find(l => l.email === email)
        if (!existing) {
          const newLead = {
            id: Date.now(),
            email,
            name: name || '',
            company: company || '',
            createdAt: new Date().toISOString(),
            status: 'pending',
            trialStarted: false,
          }
          set({ trialLeads: [...trialLeads, newLead] })
          return newLead
        }
        return existing
      },
      updateTrialLead: (email, updates) => {
        const { trialLeads } = get()
        set({
          trialLeads: trialLeads.map(l => 
            l.email === email ? { ...l, ...updates } : l
          )
        })
      },
      getTrialLead: (email) => {
        const { trialLeads } = get()
        return trialLeads.find(l => l.email === email)
      },

      // User
      user: null,
      setUser: (user) => set({ user }),
      
      // Theme
      theme: 'dark',
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'dark' ? 'light' : 'dark' 
      })),
      
      // Auth
      login: async (email, password) => {
        const demoUsers = {
          'demo@leadflow.io': { id: '1', email: 'demo@leadflow.io', name: 'Marie Demo', plan: 'free', requestsUsed: 3, createdAt: '2026-01-01' },
          'pro@leadflow.io': { id: '2', email: 'pro@leadflow.io', name: 'Jean Pro', plan: 'pro', requestsUsed: 42, createdAt: '2026-02-15' },
          'agency@leadflow.io': { id: '3', email: 'agency@leadflow.io', name: 'Sophie Agency', plan: 'agency', requestsUsed: 156, createdAt: '2026-01-20', team: ['user1@corp.com', 'user2@corp.com'] },
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const user = demoUsers[email]
        // 1.3 - Corriger: pro@leadflow.io accepte pro123 OU demo123
        if (user && (password === 'demo123' || (email === 'pro@leadflow.io' && password === 'pro123'))) {
          set({ user })
          return { success: true }
        }
        
        return { success: false, error: 'Identifiants incorrects' }
      },
      
      register: async (email, password, name) => {
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { addTrialLead, updateTrialLead } = get()
        const existingLead = get().getTrialLead(email)
        
        if (existingLead) {
          updateTrialLead(email, { trialStarted: true })
        } else {
          addTrialLead(email, name, '')
        }
        
        const newUser = {
          id: Date.now().toString(),
          email,
          name: name || 'Utilisateur',
          plan: 'free',
          requestsUsed: 0,
          createdAt: new Date().toISOString(),
          trialStarted: true,
        }
        set({ user: newUser })
        return { success: true }
      },
      
      logout: () => set({ user: null }),

      // Update user plan (for Stripe)
      updateUserPlan: (plan) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, plan } })
        }
      },

      // Requests tracking
      useRequest: () => {
        const { user } = get()
        if (!user) return false
        
        const limits = { free: 5, pro: 200, agency: 1000 }
        const limit = limits[user.plan] || 5
        
        if (user.requestsUsed >= limit) return false
        
        set({
          user: {
            ...user,
            requestsUsed: user.requestsUsed + 1
          }
        })
        return true
      },
      
      getRemainingRequests: () => {
        const { user } = get()
        if (!user) return 0
        
        const limits = { free: 5, pro: 200, agency: 1000 }
        const limit = limits[user.plan] || 5
        
        return Math.max(0, limit - (user.requestsUsed || 0))
      },
      
      canUseModule: (moduleId) => {
        const { user } = get()
        if (!user) return false
        
        // 1.4 - Corriger: linkedin est premium, pas free
        const moduleAccess = {
          free: ['bant', 'email'],
          pro: ['bant', 'email', 'linkedin', 'company', 'script', 'sequence', 'objection', 'roi', 'crm', 'deal'],
          agency: ['bant', 'email', 'linkedin', 'company', 'script', 'sequence', 'objection', 'roi', 'crm', 'deal', 'competitor', 'proposal']
        }
        
        const accessible = moduleAccess[user.plan] || []
        return accessible.includes(moduleId)
      },
      
      // Favorites
      favorites: [],
      toggleFavorite: (moduleId) => {
        const { favorites } = get()
        if (favorites.includes(moduleId)) {
          set({ favorites: favorites.filter(id => id !== moduleId) })
        } else {
          set({ favorites: [...favorites, moduleId] })
        }
      },
      
      // History
      history: [],
      addToHistory: (entry) => {
        const { history } = get()
        set({
          history: [
            { ...entry, id: Date.now(), timestamp: new Date().toISOString() },
            ...history.slice(0, 99)
          ]
        })
      },
      
      clearHistory: () => set({ history: [] }),
      
      // Contacts/CRM
      contacts: [],
      addContact: (contact) => {
        const { contacts } = get()
        set({
          contacts: [
            { ...contact, id: Date.now(), createdAt: new Date().toISOString() },
            ...contacts
          ]
        })
      },
      
      updateContact: (id, updates) => {
        const { contacts } = get()
        set({
          contacts: contacts.map(c => c.id === id ? { ...c, ...updates } : c)
        })
      },
      
      deleteContact: (id) => {
        const { contacts } = get()
        set({ contacts: contacts.filter(c => c.id !== id) })
      },
      
      // Saved results/templates
      savedResults: [],
      saveResult: (moduleId, result, name) => {
        const { savedResults } = get()
        set({
          savedResults: [
            { id: Date.now(), moduleId, result, name, createdAt: new Date().toISOString() },
            ...savedResults
          ]
        })
      },
      
      deleteResult: (id) => {
        const { savedResults } = get()
        set({ savedResults: savedResults.filter(r => r.id !== id) })
      },
      
      // API Keys (Agency only)
      apiKeys: [],
      generateApiKey: () => {
        const key = `lf_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
        const { apiKeys } = get()
        set({
          apiKeys: [...apiKeys, { id: Date.now(), key, name: `Key ${apiKeys.length + 1}`, createdAt: new Date().toISOString() }]
        })
        return key
      },
      
      deleteApiKey: (id) => {
        const { apiKeys } = get()
        set({ apiKeys: apiKeys.filter(k => k.id !== id) })
      },
      
      // Team (Agency)
      team: [],
      addTeamMember: (email) => {
        const { team } = get()
        if (!team.includes(email)) {
          set({ team: [...team, email] })
        }
      },
      
      removeTeamMember: (email) => {
        const { team } = get()
        set({ team: team.filter(e => e !== email) })
      },
      
      // Notifications
      notifications: [],
      addNotification: (type, message) => {
        const { notifications } = get()
        set({
          notifications: [
            { id: Date.now(), type, message, read: false, createdAt: new Date().toISOString() },
            ...notifications
          ]
        })
      },
      
      markAsRead: (id) => {
        const { notifications } = get()
        set({
          notifications: notifications.map(n => n.id === id ? { ...n, read: true } : n)
        })
      },
      
      clearNotifications: () => set({ notifications: [] }),
      
      // Onboarding
      onboardingComplete: false,
      completeOnboarding: () => set({ onboardingComplete: true }),
      
      // Stats
      stats: {
        totalRequests: 0,
        totalLeads: 0,
        totalEmails: 0,
        totalDeals: 0,
        weeklyData: []
      },
      
      incrementStat: (stat) => {
        const { stats } = get()
        set({
          stats: {
            ...stats,
            [stat]: stats[stat] + 1
          }
        })
      },
      
      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      // Selected module
      selectedModule: null,
      setSelectedModule: (module) => set({ selectedModule: module }),
    }),
    {
      name: 'leadflow-storage',
      partialize: (state) => ({
        user: state.user,
        theme: state.theme,
        favorites: state.favorites,
        history: state.history,
        contacts: state.contacts,
        savedResults: state.savedResults,
        apiKeys: state.apiKeys,
        team: state.team,
        notifications: state.notifications,
        onboardingComplete: state.onboardingComplete,
        stats: state.stats,
        trialLeads: state.trialLeads,
      }),
    }
  )
)

export const useUser = () => useStore((state) => state.user)
export const useTheme = () => useStore((state) => state.theme)
export const useFavorites = () => useStore((state) => state.favorites)
export const useHistory = () => useStore((state) => state.history)
export const useContacts = () => useStore((state) => state.contacts)
export const useNotifications = () => useStore((state) => state.notifications)
