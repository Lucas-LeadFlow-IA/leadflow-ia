"use client"

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Sparkles, Zap, Target, Mail, Phone, FileText, BarChart3, 
  Shield, ChevronRight, Star, Check, ArrowRight, Menu, X,
  MessageSquare, Clock, TrendingUp, Users, Globe, Lock
} from 'lucide-react'

const modules = [
  { icon: '🎯', title: 'Qualification BANT', desc: 'Qualifiez vos leads en 30s', free: true },
  { icon: '✉️', title: 'Cold Emails IA', desc: 'Emails percutants personnalisés', free: true },
  { icon: '📞', title: 'Scripts d\'Appel', desc: 'Scripts de vente irrésistibles', free: false },
  { icon: '🤝', title: 'Closing IA', desc: 'Techniques de closing avancées', free: false },
  { icon: '📊', title: 'Analyse de Besoins', desc: 'Comprenez vos prospects', free: false },
  { icon: '🎨', title: 'Générateur d\'Offres', desc: 'Offres irrésistibles en 1 clic', free: false },
  { icon: '⚡', title: 'Objections Handler', desc: 'Véritable arsenal anti-objections', free: false },
  { icon: '📧', title: 'Follow-up Sequences', desc: 'Séquences d\'emails automatiques', free: false },
  { icon: '🔍', title: 'Lead Scoring', desc: 'Priorisez vos meilleurs leads', free: false },
  { icon: '📈', title: 'Pipeline Predictor', desc: 'Prédisez vos ventes futures', free: false },
  { icon: '🎙️', title: 'Call Analyzer', desc: 'Analysez vos appels en temps réel', free: false },
  { icon: '🏆', title: 'Win-Loss Analyzer', desc: 'Comprenez pourquoi vous gagnez/perdez', free: false },
]

const testimonials = [
  { name: 'Thomas Dubois', role: 'Sales Director, TechCorp', content: 'LeadFlow IA a transformé notre processus de vente. +40% de closing en 3 mois !', rating: 5 },
  { name: 'Sarah Martin', role: 'Account Executive, SaaS Pro', content: 'L\'IA qualifie mes leads BANT en 30 secondes. Un game-changer !', rating: 5 },
  { name: 'Marc Leroy', role: 'Business Developer', content: 'Les emails générés convertissent 3x mieux que les miens. Incroyable !', rating: 5 },
]

const faq = [
  { q: 'Combien de crédits gratuits ?', a: '10 crédits offerts à l\'inscription, sans carte bancaire.' },
  { q: 'Les modules BANT et Email sont-ils vraiment gratuits ?', a: 'Oui, ces 2 modules restent gratuits même sans abonnement.' },
  { q: 'Puis-je annuler à tout moment ?', a: 'Oui, sans engagement. Annulation en 1 clic depuis votre dashboard.' },
  { q: 'L\'IA est-elle vraiment performante ?', a: 'Oui, nous utilisons Groq pour une vitesse de génération fulgurante.' },
]

export default function Home() {
  const [theme, setTheme] = useState('dark')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                LeadFlow IA
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#modules" className="text-gray-300 hover:text-white transition-colors">Modules</Link>
              <Link href="/about" className="text-gray-300 hover:text-white transition-colors">À propos</Link>
              <Link href="/legal/mentions" className="text-gray-300 hover:text-white transition-colors">Mentions</Link>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="hidden md:block px-4 py-2 text-violet-400 hover:text-violet-300 transition-colors"
              >
                Connexion
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 md:px-6 md:py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all"
              >
                Essai Gratuit
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-gray-300"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#12121a] border-t border-gray-800 p-4"
          >
            <Link href="#modules" className="block py-3 text-gray-300">Modules</Link>
            <Link href="/about" className="block py-3 text-gray-300">À propos</Link>
            <Link href="/auth/login" className="block py-3 text-violet-400">Connexion</Link>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-transparent" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-violet-500/3 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm mb-8">
              <Sparkles className="w-4 h-4" />
              <span>12 Modules IA • Résultats en 30 secondes</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent">
                Closez 3x plus
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                de deals avec l'IA
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Qualification BANT, emails percutants, scripts d'appel et closing IA. 
              Le seul outil qu'il vous faut pour dominer vos ventes B2B.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2 group"
              >
                Commencer Gratuitement
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/demo"
                className="px-8 py-4 rounded-xl border border-gray-700 text-white font-semibold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                Voir la Démo
              </Link>
            </div>

            <p className="mt-6 text-sm text-gray-500">
              ✨ 10 crédits offerts • Aucune carte bancaire requise
            </p>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50">
            {['TechCorp', 'SaaS Pro', 'B2B Leaders', 'Sales Elite', 'GrowthHub'].map((brand) => (
              <div key={brand} className="text-2xl font-bold text-gray-600">{brand}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                12 Modules IA
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour convertir plus de prospects
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modules.map((module, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group relative p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-violet-500/50 transition-all cursor-pointer"
              >
                <div className="text-4xl mb-4">{module.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{module.desc}</p>
                {module.free ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    <Check className="w-3 h-3" /> Gratuit
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-medium">
                    <Sparkles className="w-3 h-3" /> Pro
                  </span>
                )}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ils ont transformé leurs ventes
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 italic">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-gray-400">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Questions fréquentes</h2>
          </motion.div>

          <div className="space-y-4">
            {faq.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800"
              >
                <h3 className="text-lg font-semibold text-white mb-2">{item.q}</h3>
                <p className="text-gray-400">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Prêt à 3x vos ventes ?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Rejoignez des centaines de commerciaux qui utilisent déjà LeadFlow IA
            </p>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all group"
            >
              Commencer Maintenant
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">LeadFlow IA</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/legal/mentions" className="hover:text-white transition-colors">Mentions légales</Link>
              <Link href="/legal/privacy" className="hover:text-white transition-colors">Politique de confidentialité</Link>
              <Link href="/legal/cookies" className="hover:text-white transition-colors">Cookies</Link>
              <Link href="/legal/terms" className="hover:text-white transition-colors">CGV</Link>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 LeadFlow IA. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
