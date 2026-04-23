"use client"

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Home } from 'lucide-react'

export default function PaymentSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Here you would verify the session with Stripe API
    // For demo, we'll just redirect after showing success
    const timer = setTimeout(() => {
      router.push('/dashboard')
    }, 5000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 p-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </motion.div>

        <h1 className="text-4xl font-bold text-white mb-4">
          Paiement réussi ! 🎉
        </h1>
        
        <p className="text-xl text-emerald-200 mb-8">
          Bienvenue dans LeadFlow IA Pro !
        </p>

        <div className="space-y-3 mb-8">
          <p className="text-emerald-100/80">✨ Accès à tous les modules IA</p>
          <p className="text-emerald-100/80">🚀 200 requêtes par mois</p>
          <p className="text-emerald-100/80">💼 CRM complet</p>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="px-8 py-4 bg-white text-emerald-900 rounded-xl font-bold flex items-center gap-2 mx-auto hover:scale-105 transition-transform"
        >
          <Home className="w-5 h-5" />
          Aller au Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-emerald-200/50 text-sm mt-6">
          Redirection automatique dans 5 secondes...
        </p>
      </motion.div>
    </div>
  )
}