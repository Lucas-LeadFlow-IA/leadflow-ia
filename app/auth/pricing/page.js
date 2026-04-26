"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { 
  Zap, Check, X, ArrowLeft, Sparkles, Users, Shield, CreditCard, ArrowRight, AlertCircle, 
  CheckCircle2, Clock, TrendingUp, DollarSign, Gift, Mail, Phone, Building2, Award, Users2
} from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

const socialProof = {
  users: 2847,
  reviews: 156,
  rating: 4.9,
  avgDeal: 2500
}

const guarantees = [
  { icon: Shield, title: '30 jours satisfait', desc: 'Remboursement intégral' },
  { icon: Clock, title: 'Sans engagement', desc: 'Résiliation anytime' },
  { icon: CheckCircle2, title: 'Accès immédiat', desc: 'Après inscription' },
]

const PLANS = [
  {
    id: 'free',
    name: 'Découverte',
    price: 0,
    priceYearly: 0,
    period: 'pour toujours',
    description: 'Testez sans risque',
    features: [
      { text: '5 démos IA / mois', included: true },
      { text: '3 modules IA', included: true },
      { text: 'Historique (50)', included: true },
      { text: '10 contacts CRM', included: true },
      { text: 'Support community', included: true },
    ],
    notIncluded: [
      { text: 'Emails IA personnalisés' },
      { text: 'Scripts premium' },
      { text: 'API Keys' },
    ],
    cta: 'Essayer gratuit',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    priceYearly: 39,
    period: '/mois',
    description: 'Pour les commerciaux',
    features: [
      { text: '200 requêtes / mois', included: true },
      { text: '12 modules IA', included: true },
      { text: 'Historique illimité', included: true },
      { text: 'CRM illimité', included: true },
      { text: 'Emails IA', included: true },
      { text: 'Scripts premium', included: true },
      { text: 'Export CSV/JSON', included: true },
      { text: 'Support prioritaire', included: true },
    ],
    notIncluded: [
      { text: 'API Keys' },
      { text: 'Équipe' },
    ],
    cta: 'Démarrer Pro',
    popular: true,
    savings: 120,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 149,
    priceYearly: 119,
    period: '/mois',
    description: 'Pour les équipes',
    features: [
      { text: '1000 requêtes / mois', included: true },
      { text: '12 modules IA', included: true },
      { text: 'CRM illimité', included: true },
      { text: '5 utilisateurs', included: true },
      { text: 'API Keys', included: true },
      { text: 'Segmentation', included: true },
      { text: 'Formation équipe', included: true },
      { text: 'Support dédié', included: true },
    ],
    notIncluded: [],
    cta: 'Demander un devis',
    popular: false,
    savings: 360,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const { user, theme, setUser } = useStore()
  const { toggleTheme } = useTheme()
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (hydrated && !user) {
      router.push('/auth/login')
    }
  }, [hydrated, user, router])

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

    if (planId === 'agency') {
      window.location.href = 'mailto:lucas.legrand567@gmail.com?subject=Devis LeadFlow Agency'
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
        toast.error(
          <div className="flex flex-col gap-2">
            <p className="font-bold">Erreur de configuration</p>
            <p className="text-sm">{data.error}</p>
          </div>,
          { icon: <AlertCircle className="w-5 h-5 text-red-500" />, duration: 8000 }
        )
        setLoading(null)
        return
      }
      
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Erreur</p>
          <p className="text-sm">Une erreur est survenue</p>
        </div>,
        { icon: <AlertCircle className="w-5 h-5 text-red-500" /> }
      )
    }
    setLoading(null)
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-purple-900/5 to-indigo-900/10"></div>
      
      <header className={`relative z-10 p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">LeadFlow IA</span>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-6"
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{socialProof.users.toLocaleString()}+ utilisateurs actifs</span>
            </motion.div>
            
            <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Choisissez votre plan
            </h1>
            <p className={`text-lg max-w-xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Sans engagement. Résiliez quand vous voulez. Support français intégré.
            </p>

            {/* Billing Toggle */}
            <div className="flex justify-center mt-8">
              <div className={`inline-flex items-center gap-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setBilling('monthly')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${billing === 'monthly' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setBilling('yearly')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-1 ${billing === 'yearly' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
                >
                  Annuel
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">-20%</span>
                </button>
              </div>
            </div>
          </div>

          {/* Social Proof Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { icon: Users, value: socialProof.users.toLocaleString(), label: 'Utilisateurs' },
              { icon: Award, value: socialProof.rating + '/5', label: 'Note moyenne' },
              { icon: TrendingUp, value: '+47%', label: 'ROI moyen' },
              { icon: DollarSign, value: socialProof.avgDeal + '€', label: 'Panier moyen' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl text-center ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}
              >
                <stat.icon className="w-5 h-5 text-violet-500 mx-auto mb-2" />
                <div className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-6 rounded-2xl ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-violet-600 to-purple-600 text-white' 
                    : theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-violet-600 text-xs font-bold rounded-full">
                    Meilleure vente
                  </div>
                )}
                
                <h3 className={`text-xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? 'text-violet-200' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
                
                <div className="mb-4">
                  <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {billing === 'yearly' && plan.priceYearly ? plan.priceYearly : plan.price}€
                  </span>
                  <span className={plan.popular ? 'text-violet-200' : 'text-gray-500'}>{plan.period}</span>
                  {billing === 'yearly' && plan.savings > 0 && (
                    <div className="text-emerald-400 text-sm">Économisez {plan.savings}€/an</div>
                  )}
                </div>
                
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${plan.popular ? 'text-violet-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      <Check className={`w-4 h-4 ${plan.popular ? 'text-white' : 'text-emerald-500'}`} /> {f.text}
                    </li>
                  ))}
                  {plan.notIncluded?.map((f, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${plan.popular ? 'text-violet-300/50' : 'text-gray-400'}`}>
                      <X className="w-4 h-4" /> {f.text}
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

          {/* Guarantees */}
          <div className="flex flex-wrap justify-center gap-6 mt-12">
            {guarantees.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <g.icon className="w-5 h-5 text-emerald-500" />
                <span>{g.title}</span>
                <span className="text-gray-400">•</span>
                <span>{g.desc}</span>
              </div>
            ))}
          </div>

          {/* FAQ or Contact */}
          <div className="text-center mt-12">
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
              Questions ? <a href="mailto:lucas.legrand567@gmail.com" className="text-violet-500 hover:underline">Contactez-nous</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}