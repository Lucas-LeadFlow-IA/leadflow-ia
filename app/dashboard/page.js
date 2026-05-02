"use client"

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

const modules = [
  { id: 'bant', icon: '🎯', title: 'Qualification BANT', desc: 'Qualifiez vos leads en 30s', free: true },
  { id: 'email', icon: '✉️', title: 'Cold Emails IA', desc: 'Emails percutants personnalisés', free: true },
  { id: 'call-script', icon: '📞', title: 'Scripts d\'Appel', desc: 'Scripts de vente irrésistibles', free: false },
  { id: 'closing', icon: '🤝', title: 'Closing IA', desc: 'Techniques de closing avancées', free: false },
  { id: 'needs', icon: '📊', title: 'Analyse de Besoins', desc: 'Comprenez vos prospects', free: false },
  { id: 'offer', icon: '🎨', title: 'Générateur d\'Offres', desc: 'Offres irrésistibles en 1 clic', free: false },
  { id: 'objection', icon: '⚡', title: 'Objections Handler', desc: 'Véritable arsenal anti-objections', free: false },
  { id: 'followup', icon: '📧', title: 'Follow-up Sequences', desc: 'Séquences d\'emails automatiques', free: false },
  { id: 'scoring', icon: '🔍', title: 'Lead Scoring', desc: 'Priorisez vos meilleurs leads', free: false },
  { id: 'pipeline', icon: '📈', title: 'Pipeline Predictor', desc: 'Prédisez vos ventes futures', free: false },
  { id: 'call-analyzer', icon: '🎙️', title: 'Call Analyzer', desc: 'Analysez vos appels en temps réel', free: false },
  { id: 'winloss', icon: '🏆', title: 'Win-Loss Analyzer', desc: 'Comprenez pourquoi vous gagnez/perdez', free: false },
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

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="border-b border-gray-800 bg-[#12121a]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold">LF</span>
              </div>
              <span className="text-xl font-bold text-white">LeadFlow IA</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">{user.credits || 10} crédits</span>
              <button onClick={() => logout()} className="text-gray-400 hover:text-white">
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          Bonjour, {user.name || 'Utilisateur'} 👋
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules.map((module) => {
            const isLocked = !module.free && user.plan === 'free'
            return (
              <div
                key={module.id}
                onClick={() => router.push(`/dashboard/${module.id}`)}
                className={`p-6 rounded-2xl bg-gray-900/50 border transition-all cursor-pointer ${
                  isLocked ? 'border-gray-800 opacity-60' : 'border-gray-800 hover:border-violet-500'
                }`}
              >
                <div className="text-3xl mb-4">{module.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{module.desc}</p>
                {isLocked ? (
                  <span className="text-xs text-gray-500">🔒 Plan Pro requis</span>
                ) : (
                  <span className="text-xs text-violet-400">Utiliser →</span>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
