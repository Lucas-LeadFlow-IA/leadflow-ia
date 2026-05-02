"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { 
  Zap, Users, Mail, Phone, Building, Calendar, Search, Filter, 
  Download, Trash2, Edit2, Check, X, Eye, ChevronRight, 
  TrendingUp, Clock, AlertCircle, CheckCircle2, UserPlus, ArrowLeft,
  MessageSquare, Send
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function LeadsPage() {
  const router = useRouter()
  const { user, theme, logout, toggleTheme, trialLeads } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  if (!user || user.plan !== 'agency') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
        <div className="text-center p-8 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Accès réservé
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            La gestion des leads est disponible uniquement pour le plan Agency.
          </p>
          <button
            onClick={() => router.push('/auth/pricing')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium"
          >
            Passer à Agency
          </button>
        </div>
      </div>
    )
  }

  const filteredLeads = trialLeads.filter(lead => {
    const isOwner = lead.ownerEmail === user?.email || lead.ownerEmail === lead.email
    if (!isOwner) return false
    const matchesSearch = 
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || lead.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const statsForUser = trialLeads.filter(l => l.ownerEmail === user?.email || l.ownerEmail === l.email)
  const stats = {
    total: statsForUser.length,
    new: statsForUser.filter(l => l.status === 'new').length,
    contacted: statsForUser.filter(l => l.status === 'contacted').length,
    converted: statsForUser.filter(l => l.status === 'converted').length
  }

  const exportCSV = () => {
    const headers = ['Email', 'Nom', 'Entreprise', 'Date', 'Statut']
    const rows = filteredLeads.map(l => [l.email, l.name || '', l.company || '', format(new Date(l.createdAt), 'dd/MM/yyyy'), l.status || 'new'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-leadflow-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Gestion des Leads
                </h1>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  {stats.total} leads capturés
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportCSV} className={`px-4 py-2 rounded-xl flex items-center gap-2 ${
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}>
              <Download className="w-4 h-4" />
              Exporter
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => { logout(); router.push('/') }} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
              🚪
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'from-violet-500 to-purple-600' },
            { label: 'Nouveaux', value: stats.new, color: 'from-blue-500 to-cyan-600' },
            { label: 'Contactés', value: stats.contacted, color: 'from-amber-500 to-orange-600' },
            { label: 'Convertis', value: stats.converted, color: 'from-emerald-500 to-teal-600' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}
            >
              <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {stat.value}
              </div>
              <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un lead..."
              className={`w-full pl-10 pr-4 py-3 rounded-xl border ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
              }`}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-3 rounded-xl border ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
            }`}
          >
            <option value="all">Tous</option>
            <option value="new">Nouveaux</option>
            <option value="contacted">Contactés</option>
            <option value="converted">Convertis</option>
          </select>
        </div>

        {filteredLeads.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {stats.total === 0 ? 'Aucun lead capturé' : 'Aucun résultat'}
            </h3>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Les leads apparaîtront ici
            </p>
          </div>
        ) : (
          <div className={`rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Lead</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Entreprise</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Statut</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLeads.map((lead, i) => (
                  <motion.tr key={lead.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {lead.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {lead.name || 'Sans nom'}
                          </div>
                          <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                            {lead.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                        {lead.company || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        {format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                        lead.status === 'contacted' ? 'bg-amber-500/20 text-amber-400' :
                        lead.status === 'converted' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {lead.status || 'new'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
