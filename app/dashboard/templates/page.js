"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  Zap, Moon, Sun, Search, Plus, ArrowLeft, Trash2, Edit2, Star, StarOff,
  Copy, Check, FileText, Download, X
} from 'lucide-react'
import { format } from 'date-fns'

export default function TemplatesPage() {
  const router = useRouter()
  const { user, theme, toggleTheme, logout, savedResults, deleteResult } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(null)

  if (!user) {
    router.push('/auth/login')
    return null
  }

  const filteredResults = savedResults.filter(r =>
    (r.ownerEmail === user?.email || !r.ownerEmail) &&
    (r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.result?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${
        theme === 'dark' ? 'bg-[#0a0a0f]/80 border-gray-800' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Mes templates sauvegardés
            </h1>
            <span className={`text-sm px-3 py-1 rounded-full ${
              theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
            }`}>
              {savedResults.length} template{savedResults.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
              <Zap className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un template..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <FileText className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {savedResults.length === 0 ? 'Aucun template sauvegardé' : 'Aucun résultat'}
            </h3>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              {savedResults.length === 0 
                ? 'Sauvegardez vos générations favorites pour les retrouver ici'
                : 'Modifiez votre recherche'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredResults.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-2xl p-6 ${
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {item.name}
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      Module: {item.moduleId} • {format(new Date(item.createdAt), "d MMMM yyyy 'à' HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(item.result, item.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                        theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {copied === item.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copied === item.id ? 'Copié!' : 'Copier'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Voulez-vous vraiment supprimer ce template ?')) {
                          deleteResult(item.id)
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className={`p-4 rounded-xl whitespace-pre-wrap ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                  {item.result}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
