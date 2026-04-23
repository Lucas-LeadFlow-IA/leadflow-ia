"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Play, Sparkles, Zap, Shield, Clock, Users, Check, ChevronDown, ChevronUp, Star, Quote, Mail, ArrowLeft, Moon, Sun, Menu, X } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

const features = [
  { 
    icon: '🎯', 
    title: 'Qualification BANT', 
    desc: 'Scorez vos prospects en 30 secondes avec l\'IA',
    color: 'from-indigo-500 to-purple-500',
    popular: true
  },
  { 
    icon: '📧', 
    title: 'Emails IA', 
    desc: 'Génération d\'emails personnalisés percutants',
    color: 'from-emerald-500 to-teal-500',
    popular: true
  },
  { 
    icon: '💼', 
    title: 'Recherche LinkedIn', 
    desc: 'Trouvez les meilleurs prospects qualifiés',
    color: 'from-blue-500 to-cyan-500',
    popular: false
  },
  { 
    icon: '📞', 
    title: 'Scripts Appel', 
    desc: 'Scripts de cold call qui convertissent',
    color: 'from-purple-500 to-pink-500',
    popular: false
  },
  { 
    icon: '💬', 
    title: 'Gestion Objections', 
    desc: 'Techniques de closing professionnelles',
    color: 'from-rose-500 to-red-500',
    popular: false
  },
  { 
    icon: '📬', 
    title: 'Séquences Email', 
    desc: '5 emails de follow-up optimisés',
    color: 'from-green-500 to-emerald-500',
    popular: false
  },
  { 
    icon: '💰', 
    title: 'ROI Calculator', 
    desc: 'Démontrez la valeur à vos prospects',
    color: 'from-yellow-500 to-amber-500',
    popular: false
  },
  { 
    icon: '📋', 
    title: 'Fiches CRM', 
    desc: 'Export et synchronisation Notion',
    color: 'from-violet-500 to-purple-500',
    popular: false
  },
  { 
    icon: '🔍', 
    title: 'Analyse Concurrents', 
    desc: 'Étudiez la concurrence en détail',
    color: 'from-orange-500 to-red-500',
    popular: false
  },
  { 
    icon: '📄', 
    title: 'Proposals', 
    desc: 'Créez des proposals professionnelles',
    color: 'from-cyan-500 to-blue-500',
    popular: false
  },
]

const testimonials = [
  { 
    quote: "+47% de leads qualifiés en 4 semaines. LeadFlow a transformé notre prospection!",
    author: "Marie Dupont",
    role: "Sales Director",
    company: "TechScale",
    result: "+47%",
    avatar: "👩‍💼"
  },
  { 
    quote: "2h/jour économisées sur la qualification. Je peux me concentrer sur les deals importants.",
    author: "Thomas Martin",
    role: "Commercial B2B",
    company: "GrowthAgency",
    result: "2h/jour",
    avatar: "👨‍💻"
  },
  { 
    quote: "+30% de deals fermés avec les scripts IA. Mon manager ne comprend pas comment j'y arrive!",
    author: "Sophie Bernard",
    role: "Account Executive",
    company: "ScaleUp",
    result: "+30%",
    avatar: "👩‍🔬"
  },
  { 
    quote: "Les emails générés par IA sont incroyables. Mon taux de réponse a doublé!",
    author: "Lucas Petit",
    role: "SDR Manager",
    company: "SalesForce Pro",
    result: "2x",
    avatar: "👨‍🎨"
  },
  { 
    quote: "J'utilise LeadFlow tous les jours. Indispensable pour ma prospection B2B.",
    author: "Emma Moreau",
    role: "Head of Sales",
    company: "InnovTech",
    result: "Quotidien",
    avatar: "👩‍💻"
  },
]

const faqs = [
  {
    q: "Comment fonctionne l'essai gratuit?",
    a: "Vous avez accès à 5 démos gratuites sans carte bancaire. Testez tous les modules et décidez si LeadFlow vous convient."
  },
  {
    q: "Puis-je annuler à tout moment?",
    a: "Oui, vous pouvez annuler votre abonnement à tout moment depuis vos paramètres. Aucun engagement."
  },
  {
    q: "L'IA est-elle vraiment efficace?",
    a: "Nos modèles sont entraînés sur des millions de données B2B. 98% de nos utilisateurs recommandent LeadFlow."
  },
  {
    q: "Combien de temps pour voir des résultats?",
    a: "La plupart de nos utilisateurs voient une amélioration dès la première semaine d'utilisation."
  },
  {
    q: "Puis-je inviter mon équipe?",
    a: "Le plan Agency inclut jusqu'à 10 utilisateurs avec partage de contacts et historique."
  },
  {
    q: "Mes données sont-elles sécurisées?",
    a: "Oui, nous utilisons un chiffrement de niveau bancaire et respectons le RGPD."
  },
]

export default function Landing() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [showVideo, setShowVideo] = useState(false)

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
            >
              <Zap className="w-6 h-6 text-white" />
            </motion.div>
            <span className="text-xl font-bold">LeadFlow IA</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link href="/auth/login" className={`font-medium ${theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              Connexion
            </Link>
            <Link href="/auth/register" className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-violet-500/25 transition-all">
              Essayer gratuit
            </Link>
          </div>

          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className={`absolute right-0 top-0 bottom-0 w-80 p-6 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
            >
              <div className="flex justify-between items-center mb-8">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                <Link href="/auth/login" className="block py-3 text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Connexion</Link>
                <Link href="/auth/register" className="block py-3 text-lg font-medium text-violet-500" onClick={() => setMobileMenuOpen(false)}>Essai gratuit</Link>
                <Link href="/auth/pricing" className="block py-3 text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Tarifs</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-400 text-sm mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nouveau : 10 modules IA + Export Notion</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`text-5xl md:text-7xl font-bold mb-6 leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
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
            className={`text-xl mb-10 max-w-2xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Assistant commercial qui qualifie vos leads, génère vos emails et répond aux objections.
            En 30 secondes par prospect.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/auth/register" className="group px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl font-bold text-lg text-white hover:shadow-xl hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2">
              Démarrer gratuitement
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/auth/pricing" className={`px-8 py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
              <Star className="w-5 h-5 text-yellow-500" />
              Voir les tarifs
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`mt-6 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
          >
            ✓ Aucune carte bancaire requise • ✓ 5 démos gratuites • ✓ Accès instantané
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className={`py-16 px-6 border-y ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '10,000+', label: 'Leads qualifiés', icon: '🎯' },
            { value: '50,000+', label: 'Emails générés', icon: '📧' },
            { value: '98%', label: 'Satisfaction', icon: '⭐' },
            { value: '500+', label: 'Utilisateurs actifs', icon: '👥' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4"
            >
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</div>
              <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              10 outils pour <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">fermer plus vite</span>
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Du premier contact au closing, automatisez votre prospection B2B avec l'IA
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`group p-6 rounded-2xl border transition-all cursor-pointer hover:scale-105 ${
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 hover:border-violet-500 hover:bg-gray-800'
                    : 'bg-white border-gray-200 hover:border-violet-500 hover:shadow-xl'
                } ${f.popular ? (theme === 'dark' ? 'border-violet-500/50' : 'border-violet-500 shadow-lg shadow-violet-500/10') : ''}`}
              >
                {f.popular && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs font-medium mb-3">
                    <Star className="w-3 h-3" />
                    Populaire
                  </div>
                )}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{f.title}</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`py-24 px-6 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'}`}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Comment ça marche ?
            </h2>
            <p className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Commencez en 3 étapes simples
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Créez votre compte', desc: 'Inscription gratuite en 30 secondes, sans carte bancaire', icon: '✍️' },
              { step: '2', title: 'Choisissez un module', desc: 'Sélectionnez l\'outil IA adapté à votre besoin', icon: '🎯' },
              { step: '3', title: 'Générez et convertissez', desc: 'Obtenez des résultats en 30 secondes et fermez plus de deals', icon: '🚀' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative"
              >
                <div className={`p-8 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl mb-4">
                    {item.icon}
                  </div>
                  <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-violet-400' : 'text-violet-600'}`}>
                    Étape {item.step}
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{item.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className={`w-8 h-8 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Ils ont transformé leur <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">prospection</span>
            </h2>
            <p className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Rejoignez les commerciaux qui utilisent LeadFlow chaque jour
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.slice(0, 3).map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`p-8 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}
              >
                <Quote className="w-10 h-10 text-violet-500/50 mb-4" />
                <div className="text-3xl font-bold text-violet-500 mb-4">{t.result}</div>
                <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-lg">
                    {t.avatar}
                  </div>
                  <div>
                    <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.author}</div>
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{t.role} @ {t.company}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={`py-24 px-6 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'}`} id="pricing">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Tarifs <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">simples</span>
            </h2>
            <p className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Commencez gratuitement. Évoluez selon vos besoins.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-6 h-6 text-gray-400" />
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Gratuit</h3>
              </div>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Pour découvrir LeadFlow</p>
              <div className="mb-8">
                <span className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>0€</span>
                <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>/pour toujours</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>3 modules IA</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>5 démos/mois</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Historique limité</span>
                </li>
              </ul>
              <Link href="/auth/register" className="block text-center py-4 rounded-xl font-semibold transition bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg">
                Commencer gratuit
              </Link>
            </motion.div>

            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`p-8 rounded-3xl border-2 border-violet-500 relative ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
            >
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full text-xs font-bold text-white">
                ⭐ LE PLUS POPULAIRE
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-violet-500" />
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pro</h3>
              </div>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Pour les commerciaux sérieux</p>
              <div className="mb-8">
                <span className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>49€</span>
                <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>/mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>10 modules IA</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>200 req/mois</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Historique illimité</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>CRM complet</span>
                </li>
              </ul>
              <Link href="/auth/pricing" className="block text-center py-4 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg">
                Choisir Pro
              </Link>
            </motion.div>

            {/* Agency */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-purple-500" />
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Agency</h3>
              </div>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Pour les équipes sales</p>
              <div className="mb-8">
                <span className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>149€</span>
                <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>/mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Tout illimité</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>5 utilisateurs</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>API Keys</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Support prioritaire</span>
                </li>
              </ul>
              <Link href="/auth/pricing" className="block text-center py-4 rounded-xl font-semibold transition bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:shadow-lg">
                Choisir Agency
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Questions fréquentes
            </h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white border border-gray-200'}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-5 h-5 text-violet-500" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`px-6 pb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className={`text-center p-12 md:p-16 rounded-3xl ${theme === 'dark' ? 'bg-gradient-to-br from-violet-900/50 to-purple-900/50 border border-violet-500/30' : 'bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200'}`}
          >
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-8"
            >
              <Zap className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Prêt à fermer plus de deals ?
            </h2>
            <p className={`text-xl mb-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Rejoignez 500+ commerciaux qui utilisent LeadFlow IA chaque jour.
            </p>
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl font-bold text-xl text-white hover:shadow-xl hover:shadow-violet-500/25 transition-all">
              Démarrer gratuitement
              <ArrowRight className="w-6 h-6" />
            </Link>
            <p className={`mt-6 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
              Sans carte bancaire • Accès instantané • 5 démos gratuites
            </p>
          </motion.div>
        </div>
      </section>

      {/* Trust badges */}
      <section className={`py-12 px-6 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-400">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Données sécurisées</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">RGPD Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm">Support 24/7</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm">Mis à jour hebdomadairement</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 px-6 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">LeadFlow IA</span>
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
            © 2026 LeadFlow IA. Tous droits réservés.
          </div>
          <div className="flex gap-4">
            <Link href="/auth/pricing" className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Tarifs</Link>
            <Link href="/demo" className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Démo</Link>
            <Link href="/legal/privacy" className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Confidentialité</Link>
            <Link href="/legal/terms" className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>CGU</Link>
            <Link href="mailto:contact@leadflow.io" className={`text-sm ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Contact</Link>
          </div>
        </div>
      </footer>

      {/* Floating CTA */}
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="fixed bottom-6 right-6 z-40"
      >
        <Link href="/auth/register" className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full font-semibold text-white shadow-xl shadow-violet-500/25 hover:shadow-2xl transition-all">
          <Sparkles className="w-5 h-5" />
          <span className="hidden sm:inline">Essai gratuit</span>
        </Link>
      </motion.div>
    </div>
  )
}
