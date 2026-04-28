"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Zap, Check, X, ArrowRight, Sparkles } from 'lucide-react'

const plans = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0',
    period: '/mois',
    description: 'Pour commencer',
    features: ['10 requêtes/mois', '2 modules', 'Support par email'],
    notIncluded: ['IA avancée', 'CRM complet', 'Templates illimités'],
    cta: 'Plan actuel',
    popular: false
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '19',
    period: '/mois',
    description: 'Pour les freelances',
    features: ['50 requêtes/mois', '6 modules', 'Support prioritaire', 'CRM de base'],
    notIncluded: ['IA avancée', 'Templates illimités'],
    cta: 'Choisir Starter',
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '39',
    period: '/mois',
    description: 'Pour les pros',
    features: ['200 requêtes/mois', '12 modules', 'IA avancée', 'CRM complet', 'Templates illimités', 'Support VIP'],
    notIncluded: [],
    cta: 'Choisir Pro',
    popular: false
  }
]

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(null)

  const handleSelectPlan = async (planId) => {
    if (planId === 'free') {
      router.push('/dashboard')
      return
    }

    setLoading(planId)
    // Simulation - En vrai, redirection vers Stripe
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert(`Redirection vers Stripe pour le plan ${planId}...`)
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto p-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choisissez votre plan
          </h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-3xl p-8 border ${
                plan.popular
                  ? 'border-violet-500 bg-violet-500/5'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              {plan.popular && (
                <div className="flex items-center gap-2 text-violet-500 text-sm font-medium mb-4">
                  <Sparkles className="w-4 h-4" />
                  Populaire
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-2">
                {plan.name}
              </h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">
                  {plan.price}€
                </span>
                <span className="text-gray-500">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className={`flex items-center gap-2 text-sm ${plan.popular ? 'text-violet-300' : 'text-gray-300'}`}>
                    <Check className="w-4 h-4 text-emerald-500" />
                    {f}
                  </li>
                ))}
                {plan.notIncluded?.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                    <X className="w-4 h-4" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-xl font-medium ${
                  plan.popular
                    ? 'bg-white text-violet-600 hover:bg-violet-50'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                } disabled:opacity-50`}
              >
                {loading === plan.id ? (
                  <div className="w-5 h-5 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin mx-auto" />
                ) : (
                  plan.cta
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
