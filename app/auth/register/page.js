"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Building, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    
    if (formData.password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères')
      return
    }

    setLoading(true)
    const result = await register(formData.email, formData.password, formData.name)
    setLoading(false)

    if (result.success) {
      router.push('/onboarding')
    } else {
      setError(result.error)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a0f]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Créer un compte</h1>
          <p className="text-gray-400">Rejoignez LeadFlow IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Nom complet"
                required
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border bg-gray-900 border-gray-700 text-white placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email"
                required
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border bg-gray-900 border-gray-700 text-white placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Mot de passe"
                required
                className="w-full pl-12 pr-12 py-3.5 rounded-xl border bg-gray-900 border-gray-700 text-white placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirmer le mot de passe"
                required
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border bg-gray-900 border-gray-700 text-white placeholder-gray-500"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
            >
              <X className="w-4 h-4" /> {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                Créer mon compte <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400">
          Déjà un compte ?{' '}
          <button onClick={() => router.push('/auth/login')} className="text-emerald-400 hover:text-emerald-300 font-medium">
            Se connecter
          </button>
        </p>
      </motion.div>
    </div>
  )
}
