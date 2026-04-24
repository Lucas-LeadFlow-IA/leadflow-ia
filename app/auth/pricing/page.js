"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Zap, Check, X, ArrowLeft, Sparkles, Users, Building, CreditCard, ArrowRight, AlertCircle } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

const PLANS = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    period: 'pour toujours',
    description: 'Parfait pour découvrir LeadFlow',
    features: [
      { text: '5 requêtes / mois', included: true },
      { text: '3 modules IA', included: true },
      { text: 'Historique limité (50)', included: true },
      { text: '10 contacts CRM', included: true },
      { text: 'Templates prédéfinis', included: true },
      { text: 'Emails IA', included: false },
      { text: 'Scripts de vente', included: false },
      { text: 'Analyse concurrentielle', included: false },
      { text: 'Team collaboration', included: false },
      { text: 'API Keys', included: false },
    ],
    cta: 'Commencer gratuitement',
    popular: false,
    color: 'gray',
  },
  {
    id: 'pro',
    name: 'Professionnel',
    price: 49,
    period: '/ mois',
    description: 'Pour les commerciaux sérieux',
    features: [
      { text: '200 requêtes / mois', included: true },
      { text: '12 modules IA', included: true },
      { text: 'Historique illimité', included: true },
      { text: 'Contacts CRM illimités', included: true },
      { text: 'Templates personnalisés', included: true },
      { text: 'Emails IA', included: true },
      { text: 'Scripts de vente', included: true },
      { text: 'Analyse concurrentielle', included: true },
      { text: 'Team collaboration', included: false },
      { text: 'API Keys', included: false },
    ],
    cta: 'Choisir Pro',
    popular: true,
    color: 'violet',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 149,
    period: '/ mois',
    description: 'Pour les équipes et agencies',
    features: [
      { text: '1000 requêtes / mois', included: true },
      { text: '12 modules IA', included: true },
      { text: 'Historique illimité', included: true },
      { text: 'Contacts CRM illimités', included: true },
      { text: 'Templates personnalisés', included: true },
      { text: 'Emails IA', included: true },
      { text: 'Scripts de vente', included: true },
      { text: 'Analyse concurrentielle', included: true },
      { text: 'Team collaboration (5)', included: true },
      { text: 'API Keys', included: true },
    ],
    cta: 'Choisir Agency',
    popular: false,
    color: 'purple',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const { user, theme, setUser } = useStore()
  const { toggleTheme } = useTheme()
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState(null)

const handleSelectPlan = async (planId) => {
    if (!user) {
      router.push('/auth/register')
      return
    }

    if (planId === 'free') {
      setUser({ ...user, plan: 'free' })
      router.push('/dashboard')
      return
    }

    setLoading(planId)
    
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          billing,
          userId: user.id,
          email: user.email
        })
      })
      
      const data = await response.json()
      
      if (data.error) {
        if (data.error.includes('permissions') || data.error.includes('clé')) {
          toast.error(
            <div className="flex flex-col gap-2">
              <p className="font-bold">Configuration Stripe incorrecte</p>
              <p className="text-sm">Vérifiez les permissions de la clé API</p>
            </div>,
            { icon: <AlertCircle className="w-5 h-5 text-red-500" />, duration: 8000 }
          )
        } else {
          toast.error(
            <div className="flex flex-col gap-2">
              <p className="font-bold">Erreur de paiement</p>
              <p className="text-sm">{data.error}</p>
            </div>,
            { icon: <AlertCircle className="w-5 h-5 text-red-500" />, duration: 6000 }
          )
        }
        setLoading(null)
        return
      }
      
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Erreur</p>
          <p className="text-sm">Une erreur est survenue. Réessayez plus tard.</p>
        </div>,
        { icon: <AlertCircle className="w-5 h-5 text-red-500" /> }
      )
    }
    setLoading(null)
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-purple-900/10 to-indigo-900/20"></div>
      
      <header className={`relative z-10 p-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className={`flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">LeadFlow IA</span>
            </div>
          </div>
          {user ? (
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
            >
              Dashboard
            </button>
          ) : (
            <button 
              onClick={() => router.push('/auth/login')}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
            >
              Se connecter
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Prix spéciaux pour le lancement</span>
            </motion.div>
            
            <h1 className={`text-5xl md:text-6xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Choisissez votre plan
            </h1>
            <p className={`text-xl max-w-2xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Sans engagement. Annulez à tout moment. Accès immédiat après inscription.
            </p>

            <div className={`inline-flex items-center gap-4 p-2 rounded-xl mt-8 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
              <button
                onClick={() => setBilling('monthly')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  billing === 'monthly'
                    ? 'bg-violet-600 text-white'
                    : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  billing === 'yearly'
                    ? 'bg-violet-600 text-white'
                    : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Annuel
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {PLANS.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-3xl p-8 ${
                  plan.popular
                    ? theme === 'dark'
                      ? 'bg-gradient-to-b from-violet-900/50 to-purple-900/50 border-2 border-violet-500'
                      : 'bg-gradient-to-b from-violet-50 to-purple-50 border-2 border-violet-500 shadow-xl shadow-violet-500/10'
                    : theme === 'dark'
                      ? 'bg-gray-800/50 border border-gray-700'
                      : 'bg-white border border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold">
                      ⭐ Le plus populaire
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    {plan.id === 'agency' ? (
                      <Building className="w-5 h-5 text-purple-400" />
                    ) : plan.id === 'pro' ? (
                      <Users className="w-5 h-5 text-violet-400" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-gray-400" />
                    )}
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h3>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {billing === 'yearly' && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price}€
                  </span>
                  {plan.price > 0 && (
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      {billing === 'yearly' ? '/ mois' : plan.period}
                    </span>
                  )}
                  {billing === 'yearly' && plan.price > 0 && (
                    <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      Économisez {Math.round(plan.price * 12 * 0.2)}€ / an
                    </div>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      {feature.included ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-emerald-400" />
                        </div>
                      ) : (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <X className={`w-3 h-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                      )}
                      <span className={feature.included ? (theme === 'dark' ? 'text-gray-300' : 'text-gray-700') : (theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading !== null}
                  className={`w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-500/25'
                      : plan.id === 'free'
                        ? theme === 'dark'
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:shadow-lg'
                  }`}
                >
                  {loading === plan.id ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {plan.cta}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </div>

          <div className={`text-center mt-16 p-8 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <h3 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              💼 Besoin d'un plan entreprise ?
            </h3>
            <p className={`mb-6 max-w-xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Contactez-nous pour un devis personnalisé avec nombre illimité de requêtes, support dédié et formation.
            </p>
            <button className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:shadow-lg transition-all">
              Contacter les ventes
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
