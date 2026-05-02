"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, User, Check, X, Sparkles } from 'lucide-react'

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

export default function RegisterPage() {
  const router = useRouter()
  const { register, theme, toggleTheme } = useStore()
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const validateForm = () => {
    if (!formData.name.trim()) { setError('Le nom est requis'); return false }
    if (!formData.email.trim()) { setError('L\'email est requis'); return false }
    if (!/\S+@\S+\.\S+/.test(formData.email)) { setError('Email invalide'); return false }
    if (formData.password.length < 6) { setError('Mot de passe min 6 caractères'); return false }
    if (formData.password !== formData.confirmPassword) { setError('Mots de passe différents'); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')

    const result = await register(formData.email, formData.password, formData.name)
    
    if (result.success) {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1000)
    } else {
      setError(result.error || 'Erreur')
    }
    
    setLoading(false)
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Compte créé !</h2>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">LeadFlow IA</span>
        </div>
        <div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">Rejoignez +2,500 commerciaux</h1>
          <p className="text-xl text-emerald-200">Commencez gratuitement • 5 démos IA</p>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {[{v:'12',l:'Modules IA'},{v:'98%',l:'Satisfaction'},{v:'24/7',l:'Support'},{v:'1s',l:'Temps réponse'}].map((s,i)=>(
              <div key={i} className="p-4 rounded-xl bg-white/10"><div className="text-2xl font-bold text-white">{s.v}</div><div className="text-sm text-emerald-200">{s.l}</div></div>
            ))}
          </div>
        </div>
      </div>

      <div className={`flex-1 flex items-center justify-center p-8 ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-white'}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">LeadFlow IA</span>
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg">{theme === 'dark' ? '☀️' : '🌙'}</button>
          </div>

          <div className="text-center mb-8">
            <h2 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Créer un compte</h2>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Sans carte bancaire • Accès immédiat</p>
          </div>

          <div className={`p-4 rounded-xl mb-6 ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <p className={`text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}><Sparkles className="w-4 h-4" />5 démos gratuites vous attendent !</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Nom</label>
              <div className="relative">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={`w-full pl-12 pr-4 py-3.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="Jean Dupont" required />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                <input type="email" name="email" value={formData.email} onChange={handleChange} className={`w-full pl-12 pr-4 py-3.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="jean@entreprise.com" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Mot de passe</label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} className={`w-full pl-12 pr-12 py-3.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="••••••" required />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Confirmer</label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input type={showPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={`w-full pl-12 pr-4 py-3.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="••••••" required />
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setShowPassword(!showPassword)} className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{showPassword ? 'Masquer' : 'Afficher'} le mot de passe</button>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <X className="w-4 h-4" /> {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Créer mon compte <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <p className={`text-center mt-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Déjà un compte ? <button onClick={() => router.push('/auth/login')} className="text-emerald-400 hover:text-emerald-300 font-medium">Se connecter</button></p>
        </motion.div>
      </div>
    </div>
  )
}