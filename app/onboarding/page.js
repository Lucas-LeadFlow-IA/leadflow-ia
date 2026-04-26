"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Zap, User, Mail, Building, Sparkles, Check, X, ArrowRight, ArrowLeft,
  Target, Users, Phone, FileText, MessageSquare, CreditCard, Trophy, Crown,
  Bell, Settings, BarChart3, Gift, TrendingUp, Shield, Zap as ZapIcon
} from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

const steps = [
  { id: 'welcome', title: 'Bienvenue', icon: Zap },
  { id: 'profile', title: 'Votre profil', icon: User },
  { id: 'first_module', title: 'Découvrir un module', icon: Sparkles },
  { id: 'upgrade', title: 'Passer Pro', icon: Crown }
]

const modules_highlight = [
  { id: 'lead_generation', name: 'Génération de leads', emoji: '🎯', description: 'Générez des leads qualifiés avec l\'IA' },
  { id: 'email_outreach', name: 'Emails de prospection', emoji: '📧', description: 'Créez des emails persuasifs' },
  { id: 'sales_script', name: 'Scripts de vente', emoji: '💼', description: 'Optimisez vos appels' },
  { id: 'competitor_analysis', name: 'Analyse concurrent', emoji: '🔍', description: 'Comprenez vos concurrents' }
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, register, completeOnboardingStep, addContact, theme, addNotification, logActivity } = useStore()
  const { toggleTheme } = useTheme()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    company: user?.company || '',
    phone: '',
    role: ''
  })

  useState(() => {
    const t = setTimeout(() => setHydrated(true), 100)
    return () => clearTimeout(t)
  })

  if (!hydrated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      router.push('/dashboard')
    }
  }

  const handleSkip = () => {
    router.push('/dashboard')
  }

  const handleCompleteProfile = async () => {
    if (!formData.name.trim()) {
      toast.error('Veuillez entrer votre nom')
      return
    }
    setLoading(true)
    if (user) {
      completeOnboardingStep('complete_profile')
      if (formData.name || formData.company) {
        addContact({
          name: formData.name,
          company: formData.company,
          phone: formData.phone,
          status: 'lead',
          notes: `Poste: ${formData.role}`
        })
      }
      logActivity('onboarding_complete', { step: 'profile' })
    }
    setLoading(false)
    handleNext()
  }

  const handleTryModule = (moduleId) => {
    completeOnboardingStep('first_module')
    logActivity('onboarding_module_try', { moduleId })
    setCurrentStep(2)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/30"
            >
              <Zap className="w-12 h-12 text-white" />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Bienvenue sur LeadFlow IA 🚀
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-xl mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Transformez vos leads en revenus avec l'intelligence artificielle
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 gap-4 mb-8"
            >
              {[
                { emoji: '🎯', value: '12', label: 'Modules IA' },
                { emoji: '⚡', value: '< 1s', label: 'Temps réponse' },
                { emoji: '📈', value: '300%', label: 'Plus de rendez-vous' },
                { emoji: '🛡', value: '100%', label: 'Sécurisé RGPD' }
              ].map((stat, i) => (
                <div key={i} className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white border border-gray-200'}`}>
                  <div className="text-2xl mb-1">{stat.emoji}</div>
                  <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>{stat.label}</div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3 justify-center"
            >
              <button
                onClick={handleSkip}
                className={`px-6 py-3 rounded-xl ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Passer l'onboarding
              </button>
              <button
                onClick={handleNext}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold flex items-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
              >
                Commencer
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )

      case 1:
        return (
          <div>
            <div className="text-center mb-8">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4`}>
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Complétez votre profil
              </h2>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Personnalisez votre expérience
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Votre nom *
                </label>
                <div className="relative">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full pl-12 pr-4 py-3.5 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'
                    }`}
                    placeholder="Jean Dupont"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Entreprise
                </label>
                <div className="relative">
                  <Building className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className={`w-full pl-12 pr-4 py-3.5 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'
                    }`}
                    placeholder="TechCorp SAS"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Téléphone
                  </label>
                  <div className="relative">
                    <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={`w-full pl-12 pr-4 py-3.5 rounded-xl border transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'
                      }`}
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Poste
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className={`w-full px-4 py-3.5 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'
                    }`}
                    placeholder="Commercial"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-8">
              <button
                onClick={handleSkip}
                className={`px-6 py-3 rounded-xl ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Passer
              </button>
              <button
                onClick={handleCompleteProfile}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Continuer
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )

      case 2:
        return (
          <div>
            <div className="text-center mb-8">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4`}>
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Essayez un module IA
              </h2>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Découvrez comment l'IA peut vous aider
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {modules_highlight.map((module, i) => (
                <motion.button
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleTryModule(module.id)}
                  className={`p-6 rounded-2xl text-left transition-all ${
                    theme === 'dark' 
                      ? 'bg-gray-800/50 border border-gray-700 hover:border-violet-500/50 hover:bg-violet-500/10' 
                      : 'bg-white border border-gray-200 hover:border-violet-500 hover:shadow-lg'
                  }`}
                >
                  <div className="text-3xl mb-3">{module.emoji}</div>
                  <h3 className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {module.name}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {module.description}
                  </p>
                </motion.button>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSkip}
                className={`px-6 py-3 rounded-xl ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Plus tard
              </button>
              <button
                onClick={handleNext}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold flex items-center gap-2"
              >
                Aller au dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="text-center">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30`}>
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Passez à la vitesse supérieure 🚀
            </h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Débloquez tous les modules IA et fonctionnalités avancées
            </p>

            <div className={`p-6 rounded-2xl mb-6 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Pro
                </span>
                <span className="text-3xl font-bold text-violet-400">49€<span className="text-sm font-normal text-gray-400">/mois</span></span>
              </div>
              <ul className="space-y-3 text-left">
                {['200 requêtes/mois', '12 modules IA', 'CRM illimité', 'Export Excel/CSV', 'Support prioritaire'].map((feature, i) => (
                  <li key={i} className={`flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Check className="w-5 h-5 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSkip}
                className={`px-6 py-3 rounded-xl ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Plus tard
              </button>
              <button
                onClick={() => router.push('/auth/pricing')}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold flex items-center gap-2"
              >
                Voir les plans
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${theme === 'dark' ? 'bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a0f]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  i < currentStep 
                    ? 'bg-emerald-500 text-white'
                    : i === currentStep 
                      ? 'bg-violet-500 text-white'
                      : theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < currentStep ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    i < currentStep ? 'bg-emerald-500' : theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {renderStep()}
          </motion.div>
        </div>
      </div>
    </div>
  )
}