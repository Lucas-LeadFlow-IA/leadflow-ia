"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Zap, Sparkles, Target, ArrowRight } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

export default function DemoPage() {
  const { theme } = useTheme()
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [used, setUsed] = useState(false)

  useEffect(() => {
    const demoUsed = localStorage.getItem('leadflow_demo_used')
    if (demoUsed) setUsed(true)
  }, [])

  const runDemo = async () => {
    if (used) return
    setLoading(true)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: 'bant',
          data: {
            name: 'Jean-Pierre Dubois',
            position: 'PDG',
            company: 'Innov Tech',
            budget: '30000€',
            challenge: 'Digitaliser son processus commercial'
          }
        })
      })
      const data = await response.json()
      
      if (data.result) {
        setResult(data.result)
        localStorage.setItem('leadflow_demo_used', 'true')
        setUsed(true)
        toast.success('Analyse terminée !')
      }
    } catch (error) {
      toast.error('Erreur lors de l\'analyse')
    }
    setLoading(false)
  }

  const copyResult = () => {
    navigator.clipboard.writeText(result)
    toast.success('Copié !')
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-purple-900/10 to-indigo-900/20"></div>
      
      <header className={`relative z-10 p-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl">LeadFlow IA</span>
          </div>
          <div className="flex gap-3">
            <Link href="/auth/login" className="px-4 py-2 text-sm hover:text-violet-500">Connexion</Link>
            <Link href="/auth/register" className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-medium">
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/20 rounded-full text-violet-400 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Démo gratuite - Aucune inscription</span>
          </div>
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Qualifiez vos <span className="text-violet-500">prospects en 30s</span>
          </h1>
          <p className={`text-xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Testez notre module BANT gratuitement, sans créer de compte
          </p>
        </div>

        <div className={`rounded-3xl p-8 ${theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white shadow-xl'}`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Module BANT</h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Score de qualification automatically</p>
            </div>
          </div>

          <div className={`p-4 rounded-xl mb-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Prospect à analyser :</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div><span className="text-gray-500">Nom:</span> <span className={theme === 'dark' ? 'text-white ml-2' : 'text-gray-900 ml-2'}>Jean-Pierre Dubois</span></div>
              <div><span className="text-gray-500">Poste:</span> <span className={theme === 'dark' ? 'text-white ml-2' : 'text-gray-900 ml-2'}>PDG</span></div>
              <div><span className="text-gray-500">Entreprise:</span> <span className={theme === 'dark' ? 'text-white ml-2' : 'text-gray-900 ml-2'}>Innov Tech</span></div>
              <div><span className="text-gray-500">Budget:</span> <span className={theme === 'dark' ? 'text-white ml-2' : 'text-gray-900 ml-2'}>30 000€</span></div>
            </div>
          </div>

          <button
            onClick={runDemo}
            disabled={loading || used}
            className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : used ? (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Déjà utilisé - Créez un compte</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Lancer l'analyse IA</span>
              </>
            )}
          </button>
        </div>

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-8 p-8 rounded-3xl ${theme === 'dark' ? 'bg-gray-900 border border-violet-500/30' : 'bg-white shadow-xl border-2 border-violet-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Résultat</h3>
              <button onClick={copyResult} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400">
                Copier
              </button>
            </div>
            <pre className={`whitespace-pre-wrap text-sm font-mono ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'} max-h-60 overflow-y-auto`}>{result}</pre>

            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600">
              <p className="text-white font-semibold mb-2">Convaincu par les résultats ?</p>
              <p className="text-white/80 text-sm mb-4">Créez votre compte gratuit avec 5 analyses IA offertes</p>
              <Link href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-violet-600 rounded-xl font-semibold hover:bg-white/90">
                Commencer gratuitement <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}

        <div className="mt-12 grid grid-cols-3 gap-6 text-center">
          <div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>12</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Modules IA</p>
          </div>
          <div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>30s</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Temps moyen</p>
          </div>
          <div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>+47%</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Leads qualifiés</p>
          </div>
        </div>
      </main>
    </div>
  )
}