"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  Zap, LayoutDashboard, Clock, Users, Settings, FileText, Moon, Sun,
  Search, ChevronRight, Bot, Sparkles, LogOut, Menu, X, Copy, Check,
  Trash2, Download, Filter, Calendar, ArrowLeft
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function HistoryPage() {
  const router = useRouter()
  const { user, theme, toggleTheme, logout, history, clearHistory, searchQuery, setSearchQuery } = useStore()
  const [copied, setCopied] = useState(null)
  const [filterModule, setFilterModule] = useState('all')

  if (!user) {
    router.push('/auth/login')
    return null
  }

  const filteredHistory = history
    .filter(item => item.ownerEmail === user?.email || !item.ownerEmail)
    .filter(item => filterModule === 'all' || item.moduleId === filterModule)
    .filter(item => 
      !searchQuery || 
      item.moduleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.output?.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const uniqueModules = [...new Set(history.map(h => h.moduleId))]

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
              Historique des requêtes
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans l'historique..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className={`px-4 py-2.5 rounded-xl border ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <option value="all">Tous les modules</option>
            {uniqueModules.map(mod => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
                  clearHistory()
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Tout effacer
            </button>
          )}
        </div>

        {filteredHistory.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <Clock className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {history.length === 0 ? 'Aucun historique' : 'Aucun résultat'}
            </h3>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              {history.length === 0 ? 'Vos requêtes apparaîtront ici' : 'Modifiez vos filtres de recherche'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item, index) => (
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {item.moduleName}
                      </h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        {format(new Date(item.timestamp), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.output, item.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                      theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {copied === item.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied === item.id ? 'Copié!' : 'Copier'}
                  </button>
                </div>

                {item.input && Object.keys(item.input).length > 0 && (
                  <div className={`mb-4 p-3 rounded-xl ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                    <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      Données d'entrée :
                    </p>
                    <div className="text-sm space-y-1">
                      {Object.entries(item.input).map(([key, value]) => (
                        <div key={key} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          <span className="font-medium">{key} :</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-xl whitespace-pre-wrap ${
                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                }`}>
                  {item.output}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
