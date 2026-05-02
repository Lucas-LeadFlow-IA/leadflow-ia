"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { motion } from 'framer-motion'
import { Check, Sparkles, ArrowRight } from 'lucide-react'

const steps = [
  { id: 'welcome', title: 'Bienvenue !', desc: 'Découvrez LeadFlow IA' },
  { id: 'usage', title: 'Votre usage', desc: 'Comment allez-vous utiliser l\'outil ?' },
  { id: 'ready', title: 'C\'est parti !', desc: 'Accédez à votre dashboard' }
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [usage, setUsage] = useState('')

  const handleFinish = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-gray-800 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Configuration</h1>
              <p className="text-sm text-gray-400">Étape {step + 1} sur {steps.length}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-8">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= step ? 'bg-violet-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold text-white mb-4">Bienvenue sur LeadFlow IA !</h2>
              <p className="text-gray-400 mb-6">
                Bonjour {user?.name || 'cher utilisateur'} ! Vous avez maintenant accès à 12 modules d'IA pour booster vos ventes.
              </p>
              <div className="space-y-3 mb-8">
                {['Qualification BANT automatique', 'Emails de prospection IA', 'Scripts d\'appel percutants', 'Closing assisté'].map((f) => (
                  <div key={f} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-emerald-400" />
                    {f}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold text-white mb-4">Comment vendez-vous ?</h2>
              <div className="grid grid-cols-2 gap-3 mb-8">
                {['B2B SaaS', 'Agence', 'E-commerce', 'Services', 'Immobilier', 'Autre'].map((u) => (
                  <button
                    key={u}
                    onClick={() => setUsage(u)}
                    className={`p-4 rounded-xl border transition-all ${
                      usage === u
                        ? 'border-violet-500 bg-violet-500/10 text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Tout est prêt !</h2>
              <p className="text-gray-400 mb-8">
                Votre compte est configuré. Vous avez {user?.credits || 10} crédits gratuits pour tester l'IA.
              </p>
            </motion.div>
          )}

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Retour
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                Accéder au Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
