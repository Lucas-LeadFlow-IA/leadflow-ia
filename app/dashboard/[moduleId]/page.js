"use client"

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, Sparkles, Send, Loader2, AlertCircle, Copy,
} from 'lucide-react'
import { getAllModules } from '@/lib/modules'

export default function ModulePage({ params }) {
  const { moduleId } = params
  const { user } = useAuth()
  const router = useRouter()
  const [module, setModule] = useState(null)
  const [formData, setFormData] = useState({})
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    const allModules = getAllModules()
    const found = allModules.find(m => m.id === moduleId)
    if (!found) {
      router.push('/dashboard')
      return
    }
    setModule(found)

    const initData = {}
    found.fields?.forEach(f => {
      initData[f.name] = ''
    })
    setFormData(initData)
  }, [moduleId, user, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, data: formData }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur serveur')
      }

      setResult(data.result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result)
    alert('Copié !')
  }

  if (!module) return null

  const isLocked = !module.free && user?.plan === 'free'

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-gray-800 bg-[#12121a]/50 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-white">{module.name}</h1>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-gray-300">{user?.credits || 10} crédits</span>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLocked ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Module Premium</h2>
            <p className="text-gray-400 mb-8">
              Ce module est réservé aux membres Pro et Agency.
            </p>
            <Link
              href="/auth/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all"
            >
              Passer au Pro <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Form */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800">
              <h2 className="text-xl font-semibold text-white mb-6">{module.name}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {module.fields?.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                        className="w-full px-4 py-3 rounded-xl border bg-gray-800 border-gray-700 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                      >
                        <option value="">Sélectionner...</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="w-full px-4 py-3 rounded-xl border bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                      />
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={loading || (user?.credits || 0) <= 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Générer avec l'IA
                    </>
                  )}
                </button>

                {(user?.credits || 0) <= 0 && (
                  <p className="text-sm text-red-400 text-center">
                    Plus de crédits. <Link href="/auth/pricing" className="underline">Mettre à niveau</Link>
                  </p>
                )}
              </form>
            </div>

            {/* Result */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Résultat</h2>
                {result && (
                  <button
                    onClick={copyToClipboard}
                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {!result && !error && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                  <p>Remplissez le formulaire et cliquez sur "Générer"</p>
                </div>
              )}

              {result && (
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
                    {result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
