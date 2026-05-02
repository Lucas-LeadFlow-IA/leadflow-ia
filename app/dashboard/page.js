"use client"

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Sparkles, Zap, Target, Mail, Phone, FileText, BarChart3,
  ChevronRight, LogOut, User, Settings, Crown, CreditCard,
  MessageSquare, Clock, TrendingUp, Shield, Globe, Lock,
  Star, CheckCircle, ArrowRight
} from 'lucide-react'

const modules = [
  { id: 'bant', icon: '🎯', title: 'Qualification BANT', desc: 'Qualifiez vos leads en 30s', free: true, color: 'from-blue-500 to-cyan-500' },
  { id: 'email', icon: '✉️', title: 'Cold Emails IA', desc: 'Emails percutants personnalisés', free: true, color: 'from-violet-500 to-purple-500' },
  { id: 'call-script', icon: '📞', title: 'Scripts d\'Appel', desc: 'Scripts de vente irrésistibles', free: false, color: 'from-emerald-500 to-teal-500' },
  { id: 'closing', icon: '🤝', title: 'Closing IA', desc: 'Techniques de closing avancées', free: false, color: 'from-orange-500 to-red-500' },
  { id: 'needs', icon: '📊', title: 'Analyse de Besoins', desc: 'Comprenez vos prospects', free: false, color: 'from-pink-500 to-rose-500' },
  { id: 'offer', icon: '🎨', title: 'Générateur d\'Offres', desc: 'Offres irrésistibles en 1 clic', free: false, color: 'from-indigo-500 to-blue-500' },
  { id: 'objection', icon: '⚡', title: 'Objections Handler', desc: 'Véritable arsenal anti-objections', free: false, color: 'from-yellow-500 to-orange-500' },
  { id: 'followup', icon: '📧', title: 'Follow-up Sequences', desc: 'Séquences d\'emails automatiques', free: false, color: 'from-green-500 to-emerald-500' },
  { id: 'scoring', icon: '🔍', title: 'Lead Scoring', desc: 'Priorisez vos meilleurs leads', free: false, color: 'from-cyan-500 to-blue-500' },
  { id: 'pipeline', icon: '📈', title: 'Pipeline Predictor', desc: 'Prédisez vos ventes futures', free: false, color: 'from-purple-500 to-violet-500' },
  { id: 'call-analyzer', icon: '🎙️', title: 'Call Analyzer', desc: 'Analysez vos appels en temps réel', free: false, color: 'from-red-500 to-pink-500' },
  { id: 'winloss', icon: '🏆', title: 'Win-Loss Analyzer', desc: 'Comprenez pourquoi vous gagnez/perdez', free: false, color: 'from-amber-500 to-yellow-500' },
]

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  if (!user) return null

  const renderModuleIcon = (icon) => {
    if (icon.startsWith('http')) {
      return <img src={icon} alt="" className="w-8 h-8" />
    }
    return <span className="text-3xl">{icon}</span>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#12121a]/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                LeadFlow IA
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700">
                <CreditCard className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-gray-300">{user.credits || 10} crédits</span>
              </div>
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Bonjour, {user.name || 'Utilisateur'} 👋
          </h1>
          <p className="text-gray-400">
            Vous avez <span className="text-violet-400 font-semibold">{user.credits || 10} crédits</span> restants.
            {user.plan !== 'free' && (
              <span className="ml-2 px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium">
                Plan {user.plan}
              </span>
            )}
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {[
            { icon: Zap, label: 'Crédits utilisés', value: '0', color: 'from-violet-500 to-purple-500' },
            { icon: TrendingUp, label: 'Conversions', value: '0%', color: 'from-emerald-500 to-teal-500' },
            { icon: Crown, label: 'Plan actuel', value: user.plan || 'Free', color: 'from-orange-500 to-red-500' },
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-all">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Modules Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Vos Modules IA</h2>
            {user.plan === 'free' && (
              <Link
                href="/auth/pricing"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all"
              >
                <Crown className="w-4 h-4" />
                Passer au Pro
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modules.map((module, index) => {
              const isLocked = !module.free && user.plan === 'free'
              
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`group relative p-6 rounded-2xl bg-gray-900/50 border transition-all ${
                    isLocked 
                      ? 'border-gray-800 opacity-60 hover:opacity-80' 
                      : 'border-gray-800 hover:border-violet-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    {renderModuleIcon(module.icon)}
                    {isLocked ? (
                      <Lock className="w-5 h-5 text-gray-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{module.desc}</p>
                  
                  {isLocked ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Crown className="w-4 h-4" />
                      <span>Plan Pro requis</span>
                    </div>
                  ) : (
                    <Link
                      href={`/dashboard/${module.id}`}
                      className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Utiliser
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  )}

                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
