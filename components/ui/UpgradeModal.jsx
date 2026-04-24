"use client"
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Check, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function UpgradeModal({ isOpen, onClose, moduleName }) {
  const router = useRouter()
  const benefits = [
    '10 modules IA débloqués',
    '200 requêtes / mois',
    'Export PDF & Notion',
    'Scripts d\'appel & Séquences email',
    'Prédiction de deals',
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#12121a] border border-violet-500/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl shadow-violet-500/20 relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/30">
                <Zap className="w-7 h-7 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-1">
                Module <span className="text-violet-400">{moduleName}</span>
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Ce module est disponible à partir du plan Pro.
              </p>
              
              <div className="space-y-2.5 mb-7">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-sm text-gray-300">{b}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { router.push('/auth/pricing'); onClose() }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
                >
                  Passer au Pro — 49€/mois
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  Continuer en gratuit
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}