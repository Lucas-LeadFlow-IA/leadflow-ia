"use client"

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react'

export default function PaymentCancel() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-rose-900 to-orange-900 p-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto mb-8"
        >
          <XCircle className="w-12 h-12 text-red-400" />
        </motion.div>

        <h1 className="text-4xl font-bold text-white mb-4">
          Paiement annulé
        </h1>
        
        <p className="text-xl text-red-200 mb-8">
          Aucun montant n'a été prélevé.
        </p>

        <div className="bg-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-center gap-2 text-red-100 mb-4">
            <CreditCard className="w-5 h-5" />
            <span>Vous pouvez réessayer quand vous voulez</span>
          </div>
          <p className="text-red-200/70 text-sm">
            Votre compte gratuit reste actif avec 5 démos par mois.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push('/auth/pricing')}
            className="px-8 py-4 bg-white text-red-900 rounded-xl font-bold flex items-center gap-2 mx-auto hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
            Choisir un autre plan
          </button>
          
          <button
            onClick={() => router.push('/dashboard')}
            className="px-8 py-4 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
          >
            Retour au Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  )
}