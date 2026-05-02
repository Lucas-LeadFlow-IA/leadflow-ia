"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, Check, X } from 'lucide-react'

const useStore = create(persist((set, get) => ({
  user: null,
  users: [],
  theme: 'dark',
  
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  
  login: async (email, password) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const users = get().users || []
    const user = users.find(u => u.email === email && u.password === password)
    if (user) {
      set({ user: { id: user.id, email: user.email, name: user.name, plan: user.plan || 'free', requestsUsed: user.requestsUsed || 0 } })
      return { success: true }
    }
    return { success: false, error: 'Email ou mot de passe incorrect' }
  },
  
  register: async (email, password, name) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const users = get().users || []
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Ce compte existe déjà' }
    }
    const newUser = { id: String(Date.now()), email, name, password, plan: 'free', requestsUsed: 0, createdAt: new Date().toISOString() }
    set({ users: [...users, newUser], user: { id: newUser.id, email: newUser.email, name: newUser.name, plan: 'free', requestsUsed: 0 } })
    return { success: true }
  },
  
  logout: () => set({ user: null }),

  getRemainingRequests: () => {
    const user = get().user
    const limits = { free: 5, pro: 200, agency: 1000 }
    return user ? limits[user.plan] - (user.requestsUsed || 0) : 0
  },
  
  useRequest: () => set((state) => ({ 
    user: state.user ? { ...state.user, requestsUsed: (state.user.requestsUsed || 0) + 1 } : null 
  })),
  
  canUseModule: () => { const user = get().user; return user && user.plan !== 'free' },

  contacts: [],
  addContact: (contact) => set((state) => ({ contacts: [...state.contacts, { ...contact, id: Date.now(), createdAt: new Date().toISOString() }] })),
  history: [],
  addToHistory: (item) => set((state) => ({ history: [{ ...item, id: Date.now(), createdAt: new Date().toISOString() }, ...state.history.slice(0, 99)] })),
  favorites: [],
  toggleFavorite: (id) => set((state) => ({ favorites: state.favorites.includes(id) ? state.favorites.filter(f => f !== id) : [...state.favorites, id] })),
  savedResults: [],
  saveResult: (moduleId, input, output) => set((state) => ({ savedResults: [...state.savedResults, { id: Date.now(), moduleId, input, output, createdAt: new Date().toISOString() }] })),
  stats: { totalRequests: 0 },
  incrementStat: (key) => set((state) => ({ stats: { ...state.stats, [key]: (state.stats[key] || 0) + 1 } }))
}), { name: 'leadflow-storage' }))

export default function LoginPage() {
  const router = useRouter()
  const { login, theme, toggleTheme } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!email || !password) {
      setError('Veuillez remplir tous les champs')
      setLoading(false)
      return
    }

    const result = await login(email, password)
    
    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 800)
    } else {
      setError(result.error || 'Identifiants incorrects')
    }
    
    setLoading(false)
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Connexion réussie !</h2>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">LeadFlow IA</span>
        </div>
        <div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">Transformez vos leads en revenus</h1>
          <p className="text-xl text-purple-200">12 modules IA pour multiplier vos ventes</p>
        </div>
      </div>

      <div className={`flex-1 flex items-center justify-center p-8 ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-white'}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">LeadFlow IA</span>
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg">{theme === 'dark' ? '☀️' : '🌙'}</button>
          </div>

          <div className="text-center mb-8">
            <h2 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Connexion</h2>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Accédez à votre espace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full pl-12 pr-4 py-3.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="vous@entreprise.com" required />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Mot de passe</label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full pl-12 pr-12 py-3.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <X className="w-4 h-4" /> {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Se connecter <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <p className={`text-center mt-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Pas de compte ? <button onClick={() => router.push('/auth/register')} className="text-violet-400 hover:text-violet-300 font-medium">Créer un compte</button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}