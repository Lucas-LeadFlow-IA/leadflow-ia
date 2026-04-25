"use client"

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { ArrowRight, Sparkles, Zap, Shield, Clock, Users, Check, Star, Quote, Menu, X, Play, Target, Mail, MessageSquare, Phone, CreditCard, ThumbsUp, AlertCircle, ChevronRight, Gift, Download, Search, FileText, Lock, UsersRound, Rocket, BarChart, DollarSign, ArrowDown, TrendingUp, Headphones } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'
import { useStore } from '@/lib/store'

const features = [
  { 
    icon: Target, 
    title: 'Qualification BANT', 
    desc: 'Scorez vos prospects en 30 secondes',
    color: 'from-indigo-500 to-purple-500'
  },
  { 
    icon: Mail, 
    title: 'Emails IA', 
    desc: 'Générez des emails personnalisés',
    color: 'from-emerald-500 to-teal-500'
  },
  { 
    icon: Search, 
    title: 'Recherche LinkedIn', 
    desc: 'Trouvez les prospects qualifiés',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    icon: Phone, 
    title: 'Scripts Appel', 
    desc: 'Scripts de cold call qui convertissent',
    color: 'from-purple-500 to-pink-500'
  },
  { 
    icon: MessageSquare, 
    title: 'Gestion Objections', 
    desc: 'Techniques de closing pro',
    color: 'from-rose-500 to-red-500'
  },
  { 
    icon: FileText, 
    title: 'Séquences Email', 
    desc: 'Follow-ups optimisés',
    color: 'from-green-500 to-emerald-500'
  },
]

const stats = [
  { value: 10000, suffix: '+', label: 'Leads qualifiés', prefix: '' },
  { value: 50000, suffix: '+', label: 'Emails générés', prefix: '' },
  { value: 98, suffix: '%', label: 'Satisfaction', prefix: '' },
  { value: 500, suffix: '+', label: 'Utilisateurs', prefix: '' },
]

const testimonials = [
  { 
    quote: "+47% de leads qualifiés en 4 semaines. LeadFlow a transformé notre prospection!",
    author: "Marie Dupont",
    role: "Sales Director",
    company: "TechScale",
    result: "+47%",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie"
  },
  { 
    quote: "2h/jour économisées sur la qualification. Je peux me concentrer sur les deals.",
    author: "Thomas Martin",
    role: "Commercial B2B",
    company: "GrowthAgency",
    result: "2h/jour",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas"
  },
  { 
    quote: "+30% de deals fermés avec les scripts IA. Incroyable!",
    author: "Sophie Bernard",
    role: "Account Executive",
    company: "ScaleUp",
    result: "+30%",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie"
  },
  { 
    quote: "Les emails IA ontboosté mon taux de réponse de 3x. Je recommande à tout commercial!",
    author: "Lucas Bernard",
    role: "SDR",
    company: "CloudTech",
    result: "3x",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas"
  },
  { 
    quote: " finally une outil qui me fait gagner du temps concret. ROI en 2 semaines.",
    author: "Julie Moreau",
    role: "Head of Sales",
    company: "DataPro",
    result: "2sem",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Julie"
  },
]

const plans = [
  { id: 'free', name: 'Gratuit', price: 0, period: 'pour toujours', features: ['3 modules IA', '5 démos/mois', 'Historique limité'] },
  { id: 'pro', name: 'Pro', price: 49, period: '/mois', popular: true, features: ['12 modules IA', '200 req/mois', 'Historique illimité', 'Emails IA', 'Scripts de vente'] },
  { id: 'agency', name: 'Agency', price: 149, period: '/mois', features: ['1000 req/mois', ' Équipe (5)', 'API Keys', 'Support dédié'] },
]

const trustBadges = [
  { icon: Shield, label: 'Sécurisé SSL' },
  { icon: Lock, label: 'Données chiffrées' },
  { icon: CreditCard, label: 'Paiement sécurisé' },
  { icon: ThumbsUp, label: '98% satisfait' },
]

const leadsMagnets = [
  { title: 'Guide : 10 scripts qui tuent les objections', downloads: 1247 },
  { title: 'Checklist : Qualifier un lead en 30s', downloads: 892 },
  { title: 'Template : Email de prospection parfait', downloads: 2103 },
]

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ days: 7, hours: 0, minutes: 0, seconds: 0 })
  
  useEffect(() => {
    const storedEndDate = localStorage.getItem('offerEndDate')
    let endDate
    
    if (storedEndDate) {
      endDate = new Date(storedEndDate)
    } else {
      endDate = new Date()
      endDate.setDate(endDate.getDate() + 7)
      localStorage.setItem('offerEndDate', endDate.toISOString())
    }
    
    const calculateTimeLeft = () => {
      const now = new Date()
      const diff = endDate.getTime() - now.getTime()
      
      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }
      
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      }
    }
    
    setTimeLeft(calculateTimeLeft())
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 text-red-500 font-mono text-lg font-bold">
      <span className="bg-red-500/20 px-3 py-1 rounded-lg">{String(timeLeft.days).padStart(2, '0')}</span>
      <span>j</span>
      <span className="bg-red-500/20 px-3 py-1 rounded-lg">{String(timeLeft.hours).padStart(2, '0')}</span>
      <span>h</span>
      <span className="bg-red-500/20 px-3 py-1 rounded-lg">{String(timeLeft.minutes).padStart(2, '0')}</span>
      <span>m</span>
    </div>
  )
}

function StatCounter({ value, suffix, label, prefix }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (isInView) {
      const duration = 2000
      const steps = 60
      const increment = value / steps
      let current = 0
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setCount(value)
          clearInterval(timer)
        } else {
          setCount(Math.floor(current))
        }
      }, duration / steps)
      return () => clearInterval(timer)
    }
  }, [isInView, value])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
        {prefix}{count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </motion.div>
  )
}

function FeatureCard({ feature, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -5 }}
      className="group p-6 rounded-2xl bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 backdrop-blur-sm hover:border-violet-500/50 transition-all cursor-pointer"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <feature.icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{feature.desc}</p>
    </motion.div>
  )
}

function LeadMagnet() {
  return (
    <section className="py-16 px-6 bg-gradient-to-r from-violet-600 to-purple-600">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Gift className="w-12 h-12 text-white mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">
            Téléchargez nos guides gratuits
          </h2>
          <p className="text-violet-100 mb-6">
            Resources exclusives pour booster votre prospection
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {leadsMagnets.map((item, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-pointer hover:bg-white/20 transition"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-8 h-8 text-white" />
                  <div className="text-left">
                    <p className="text-white font-medium text-sm">{item.title}</p>
                    <p className="text-violet-200 text-xs">{item.downloads.toLocaleString()} téléchargements</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default function Landing() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { user } = useStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  const handleStartClick = () => {
    if (user && user.email) {
      router.push('/auth/login')
    } else {
      router.push('/auth/register')
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] overflow-x-hidden">

      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#0a0a0f]/80 border-b border-gray-200/10 dark:border-gray-800/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">LeadFlow IA</span>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {user && user.email ? (
              <>
                <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  Dashboard
                </Link>
                <Link href="/dashboard/leads" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  Mes Leads
                </Link>
                <Link href="/dashboard/contacts" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  Contacts
                </Link>
                <Link href="/dashboard/settings" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  Paramètres
                </Link>
                <a href="mailto:lucas.legrand567@gmail.com" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  <Headphones className="w-4 h-4" />
                  Support
                </a>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name || user.email.split('@')[0]}</span>
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/pricing" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  Tarifs
                </Link>
                <Link href="/auth/login" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition">
                  Connexion
                </Link>
                <Link href="/auth/register" className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-violet-500/25 transition-all">
                  Essayer gratuit
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute right-0 top-0 bottom-0 w-80 p-6 bg-white dark:bg-gray-900">
              <div className="flex justify-between items-center mb-8">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                {user && user.email ? (
                  <>
                    <Link href="/dashboard" className="block py-3 font-medium" onClick={() => setMobileMenuOpen(false)}>📊 Dashboard</Link>
                    <Link href="/dashboard/leads" className="block py-3" onClick={() => setMobileMenuOpen(false)}>🎯 Mes Leads</Link>
                    <Link href="/dashboard/contacts" className="block py-3" onClick={() => setMobileMenuOpen(false)}>👥 Contacts</Link>
                    <Link href="/dashboard/settings" className="block py-3" onClick={() => setMobileMenuOpen(false)}>⚙️ Paramètres</Link>
                    <a href="mailto:lucas.legrand567@gmail.com" className="block py-3 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>🎧 Support</a>
                    <div className="py-3 text-violet-600 font-medium">
                      {user.name || user.email}
                    </div>
                  </>
                ) : (
                  <>
                    <Link href="/auth/pricing" className="block py-3" onClick={() => setMobileMenuOpen(false)}>Tarifs</Link>
                    <Link href="/auth/login" className="block py-3" onClick={() => setMobileMenuOpen(false)}>Connexion</Link>
                    <button onClick={handleStartClick} className="block py-3 text-violet-600 font-medium text-left">
                      {user && user.email ? 'Se connecter' : 'Essai gratuit'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero with Urgency */}
      <section className="pt-40 pb-24 px-6 relative">
        <div className="max-w-5xl mx-auto text-center">
          {/* Urgency Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 mb-6"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Offre lancement : -20% sur le plan Pro</span>
            <CountdownTimer />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
          >
            Ferme plus de deals<br />
            <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
              avec l'Intelligence Artificielle
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto"
          >
            Assistant commercial intelligent qui qualifie vos leads, génère vos emails et répond aux objections. En 30 secondes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button onClick={handleStartClick} className="group px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl font-bold text-lg text-white hover:shadow-xl hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2">
              {user && user.email ? 'Se connecter' : 'Démarrer gratuitement'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-6 mt-8"
          >
            {trustBadges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <badge.icon className="w-5 h-5 text-emerald-500" />
                {badge.label}
              </div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 text-sm text-gray-500"
          >
            ✓ Aucune carte bancaire • ✓ 5 démos gratuites • ✓ Accès instantané • <span className="text-emerald-500 font-medium">Garantie satisfait ou remboursé 30 jours</span>
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 border-y border-gray-200/10 dark:border-gray-800/10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <StatCounter key={i} {...stat} />
          ))}
        </div>
      </section>

      {/* Lead Magnet Section */}
      <LeadMagnet />

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Tout ce qu'il faut pour <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">fermer plus vite</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              12 modules IA powered by Groq pour automatiser votre prospection B2B
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FeatureCard key={i} feature={{...f, icon: f.icon}} index={i} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link href="/auth/register" className="inline-flex items-center gap-2 text-violet-600 font-semibold hover:gap-3 transition-all">
              Commencer maintenant <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Extended Social Proof */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-violet-5 to-transparent dark:via-violet-500/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Ils ont transformé leur <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">prospection</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Rejoignez les commerciaux qui utilisent LeadFlow chaque jour
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.slice(0, 3).map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-6">"{t.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{t.author}</div>
                    <div className="text-sm text-gray-500">{t.role} @ {t.company}</div>
                  </div>
                  <div className="text-3xl font-bold text-violet-600">{t.result}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* More testimonials */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 grid md:grid-cols-2 gap-4"
          >
            {testimonials.slice(3).map((t, i) => (
              <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex items-center gap-4">
                <div className="text-2xl font-bold text-violet-600">{t.result}</div>
                <div>
                  <p className="text-gray-900 dark:text-white text-sm">"{t.quote}"</p>
                  <p className="text-gray-500 text-xs">{t.author} - {t.role}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6" id="pricing">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Des tarifs <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">simples</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Commencez gratuitement. Évoluez selon vos besoins.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-8 rounded-3xl ${plan.popular ? 'bg-gradient-to-b from-violet-600 to-purple-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-violet-600 text-xs font-bold rounded-full">
                    ⭐ -20% CE MOIS
                  </div>
                )}
                <h3 className={`text-xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                <p className={`text-sm mb-6 ${plan.popular ? 'text-violet-100' : 'text-gray-500'}`}>
                  {plan.id === 'free' ? 'Pour découvrir' : 'Pour les pros'}
                </p>
                <div className="mb-6">
                  <span className={`text-5xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {plan.price}€
                  </span>
                  <span className={plan.popular ? 'text-violet-200' : 'text-gray-500'}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <Check className={`w-5 h-5 ${plan.popular ? 'text-white' : 'text-emerald-500'}`} />
                      <span className={plan.popular ? 'text-violet-100' : 'text-gray-600 dark:text-gray-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register" className={`block text-center py-4 rounded-xl font-semibold transition ${
                  plan.popular 
                    ? 'bg-white text-violet-600 hover:bg-violet-50' 
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg'
                }`}>
                  {plan.id === 'free' ? 'Commencer gratuit' : 'Choisir ' + plan.name}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Money Back Guarantee */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 text-sm">
              <Shield className="w-4 h-4" />
              Garantie satisfait ou remboursé 30 jours - Pas de risque
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-16 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-600 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-30"></div>
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Prêt à transformer votre prospection ?
              </h2>
              <p className="text-xl text-violet-100 mb-8 max-w-xl mx-auto">
                Rejoignez 500+ commerciaux qui génèrent plus de leads avec LeadFlow
              </p>
              <Link href="/auth/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-violet-600 rounded-xl font-bold text-lg hover:shadow-xl transition-all">
                Commencer gratuitement
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">LeadFlow IA</span>
              </div>
              <p className="text-gray-500 text-sm">Assistant commercial intelligent pour les pros du B2B.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/auth/pricing" className="hover:text-violet-600">Tarifs</Link></li>
                <li><Link href="/dashboard" className="hover:text-violet-600">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/legal/privacy" className="hover:text-violet-600">Confidentialité</Link></li>
                <li><Link href="/legal/terms" className="hover:text-violet-600">CGV</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Contact</h4>
              <p className="text-sm text-gray-500">lucas.legrand567@gmail.com</p>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500">© 2026 LeadFlow IA. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}