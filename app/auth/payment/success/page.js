"use client"
export const dynamic = 'force-dynamic';

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Home } from 'lucide-react'

function PaymentSuccessContent() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard')
    }, 5000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md mx-auto p-8"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Paiement réussi!</h1>
        <p className="text-gray-400 mb-8">Votre abonnement a été activé. Redirection...</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-8 py-3 rounded-xl bg-violet-600 text-white font-medium flex items-center gap-2 mx-auto"
        >
          Accéder au dashboard <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  )
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
