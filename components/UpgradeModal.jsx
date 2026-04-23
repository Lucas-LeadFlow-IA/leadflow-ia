"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Check, X, Crown, ArrowRight } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

export function UpgradeModal({ isOpen, onClose, reason }) {
  const router = useRouter()
  const { theme } = useTheme()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md p-8 rounded-3xl ${
            theme === 'dark' ? 'bg-gray-900 border border-violet-500/30' : 'bg-white shadow-2xl'
          }`}
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Passez à Pro
            </h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {reason || 'Déverrouiller tous les modules et supprimer les limites'}
            </p>
            
            <div className="space-y-3 mb-8 text-left">
              {[
                '200 requêtes/mois',
                '12 modules IA',
                'CRM illimité',
                'Export PDF & Notion',
                'Support prioritaire'
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-xl font-semibold ${
                  theme === 'dark' 
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Plus tard
              </button>
              <button
                onClick={() => router.push('/auth/pricing')}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 flex items-center justify-center gap-2"
              >
                Voir les plans <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}