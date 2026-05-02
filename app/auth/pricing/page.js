"use client"

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Sparkles, Crown, Check, X, Zap, ArrowRight,
  Star, CreditCard, Loader2
} from 'lucide-react'

const plans = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    credits: 10,
    description: 'Pour tester l\'IA',
    features: ['2 modules (BANT + Email)', '10 crédits/mois', 'Support communauté', 'Export limité'],
    cta: 'Actuel',
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    credits: 50,
    description: 'Pour les commerciaux solo',
    features: ['6 modules IA', '50 crédits/mois', 'Support email', 'Export CSV', 'Historique 30j'],
    cta: 'Choisir Starter',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    credits: 200,
    description: 'Pour les pros des ventes',
    features: ['12 modules IA', '200 crédits/mois', 'Support prioritaire', 'Export complet', 'Historique illimité', 'API access'],
    cta: 'Choisir Pro',
    popular: false,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 97,
    credits: 1000,
    description: 'Pour les agences et équipes',
    features: ['12 modules IA', '1000 crédits/mois', 'Support dédié', 'White-label', 'Multi-utilisateurs', 'API illimitée'],
    cta: 'Choisir Agency',
    popular: false,
  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const router = useRouter()

  const handleChoosePlan = async (planId) => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    if (planId === 'free') return
    
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      
      const { url } = await response.json()
      if (url) window.location.href = url
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Choisissez votre plan
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Débloquez tout le potentiel de l'IA pour vos ventes
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl border transition-all ${
                plan.popular
                  ? 'border-violet-500 bg-violet-500/5 scale-105'
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium">
                  Populaire
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-white">{plan.price}€</span>
                  <span className="text-gray-400">/mois</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">{plan.credits} crédits/mois</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChoosePlan(plan.id)}
                disabled={user?.plan === plan.id}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  user?.plan === plan.id
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500'
                    : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                }`}
              >
                {user?.plan === plan.id ? 'Plan actuel' : plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-400 mb-4">Tous les plans incluent :</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Résultats en 30s</span>
            <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> IA de pointe</span>
            <span className="flex items-center gap-2"><Star className="w-4 h-4" /> Annulation libre</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
