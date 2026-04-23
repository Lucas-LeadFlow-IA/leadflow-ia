"use client"

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getAllModules } from '@/lib/modules'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Zap, LayoutDashboard, Clock, Users, Settings, FileText, Moon, Sun,
  Search, Star, ChevronRight, Bot, Sparkles, TrendingUp, Mail, MessageSquare,
  Target, DollarSign, FileSearch, Send, BarChart3, History, X, Copy, Check,
  LogOut, Bell, Menu, ArrowLeft, Trash2, Save, AlertCircle, CheckCircle2, Lock, Crown
} from 'lucide-react'
import { format } from 'date-fns'

const iconMap = {
  Bot, Sparkles, TrendingUp, Mail, MessageSquare, Target, DollarSign,
  FileSearch, Send, BarChart3, Zap, FileText
}

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const {
    user, theme, toggleTheme, logout, searchQuery, setSearchQuery,
    favorites, toggleFavorite, history, addToHistory,
    canUseModule, useRequest, getRemainingRequests, selectedModule, setSelectedModule,
    savedResults, saveResult, contacts, addContact, incrementStat, stats
  } = useStore()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showModulePanel, setShowModulePanel] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [inputData, setInputData] = useState({})
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!user) router.push('/auth/login')
  }, [user, router])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showModulePanel && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleGenerate()
      }
      if (showModulePanel && e.key === 'Escape') {
        setShowModulePanel(false)
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModulePanel, inputData, loading])

  if (!user) return null

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: History, label: 'Historique', path: '/dashboard/history' },
    { icon: Users, label: 'Contacts', path: '/dashboard/contacts' },
    { icon: FileText, label: 'Templates', path: '/dashboard/templates' },
    { icon: Settings, label: 'Paramètres', path: '/dashboard/settings' },
  ]

  if (user.plan === 'agency') {
    navItems.splice(3, 0, { icon: TrendingUp, label: 'Leads', path: '/dashboard/leads' })
  }

  const filteredModules = getAllModules().filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openModule = (module) => {
    if (!canUseModule(module.id)) {
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Module verrouillé</p>
          <p className="text-sm">Passez à Pro pour accéder à "{module.name}"</p>
          <button 
            onClick={() => router.push('/auth/pricing')}
            className="mt-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-sm font-semibold"
          >
            Mettre à niveau
          </button>
        </div>,
        { icon: <Lock className="w-5 h-5 text-red-500" />, duration: 6000 }
      )
      return
    }
    setSelectedModule(module)
    setShowModulePanel(true)
    setInputData({})
    setResult('')
  }

  const handleGenerate = async () => {
    const remaining = getRemainingRequests()
    if (remaining <= 0) {
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Quota épuisé</p>
          <p className="text-sm">Vous avez utilisé toutes vos requêtes</p>
        </div>,
        { icon: <AlertCircle className="w-5 h-5 text-red-500" />, duration: 6000 }
      )
      return
    }

    if (!useRequest()) {
      toast.error('Limite de requêtes atteinte')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: selectedModule.id, data: inputData })
      })
      const data = await response.json()
      
      if (data.error) {
        toast.error(data.error)
        setResult('')
        setLoading(false)
        return
      }
      
      setResult(data.result || 'Aucun résultat généré')
      addToHistory({ moduleId: selectedModule.id, moduleName: selectedModule.name, input: inputData, output: data.result })
      incrementStat('totalRequests')
      toast.success('Généré avec succès !', {
        icon: <Sparkles className="w-5 h-5 text-violet-500" />
      })
    } catch (error) {
      setResult('Erreur lors de la génération. Veuillez réessayer.')
    }
    setLoading(false)
  }

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      toast.success('Copié dans le presse-papiers !', {
        icon: <Copy className="w-5 h-5 text-violet-500" />
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyAsMarkdown = () => {
    if (result) {
      const md = result
        .replace(/^📋 /gm, '## ')
        .replace(/^🎯 /gm, '### ')
        .replace(/^💰 /gm, '### ')
        .replace(/^• /gm, '- ')
        .replace(/^📊 /gm, '## ')
      navigator.clipboard.writeText(md)
      toast.success('Copié pour Notion !', {
        icon: <Copy className="w-5 h-5 text-violet-500" />
      })
    }
  }

  const downloadPDF = () => {
    if (!result) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LeadFlow - ${selectedModule.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
            h1 { color: #7c3aed; margin-bottom: 20px; }
            pre { white-space: pre-wrap; font-family: inherit; }
          </style>
        </head>
        <body>
          <h1>${selectedModule.name}</h1>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
          <hr>
          <pre>${result}</pre>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleSaveResult = () => {
    if (result) {
      saveResult(selectedModule.id, result, `${selectedModule.name} - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`)
      setSaveSuccess(true)
      toast.success('Sauvegardé dans vos favoris !', {
        icon: <Save className="w-5 h-5 text-violet-500" />
      })
      setTimeout(() => setSaveSuccess(false), 2000)
    }
  }

  const handleLogout = () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      logout()
      router.push('/')
    }
  }

  const remaining = getRemainingRequests()
  const planColors = {
    free: 'bg-gray-500/20 text-gray-400',
    pro: 'bg-violet-500/20 text-violet-400',
    agency: 'bg-purple-500/20 text-purple-400'
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <aside className={`fixed top-0 left-0 h-full z-50 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} ${theme === 'dark' ? 'bg-gray-900/80 border-r border-gray-800' : 'bg-white border-r border-gray-200'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && <span className="font-bold text-lg">LeadFlow</span>}
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => { router.push(item.path); setMobileMenuOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className={`absolute bottom-32 left-0 right-0 px-4 ${sidebarOpen ? '' : 'hidden'}`}>
          <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Quota mensuel</span>
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {getRemainingRequests()} / {user.limits?.requests || 5}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${remaining > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`} style={{ width: `${Math.min(100, (remaining / (user.limits?.requests || 5)) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold">
              {user.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.name}</div>
                <div className={`text-xs capitalize ${planColors[user.plan] || 'text-gray-500'}`}>{user.plan}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:block">
                <Menu className="w-6 h-6" />
              </button>
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden">
                <Menu className="w-6 h-6" />
              </button>
              <div className="relative hidden sm:block">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un module..." className={`w-80 pl-10 pr-4 py-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'}`} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${remaining > 10 ? 'bg-emerald-500/20 text-emerald-400' : remaining > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                {remaining} requêtes restantes
              </div>
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800" title="Déconnexion">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stats.totalRequests}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Requêtes IA</p>
            </div>
            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{contacts.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Contacts CRM</p>
            </div>
            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{savedResults.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Favoris</p>
            </div>
            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
                  <History className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{history.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Historique</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Bonjour, {user.name?.split(' ')[0]} 👋
            </h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Quel module IA souhaitez-vous utiliser aujourd'hui ?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModules.map((module, index) => {
              const Icon = iconMap[module.icon] || Bot
              const isFavorite = favorites.includes(module.id)
              const isLocked = !canUseModule(module.id)

              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => !isLocked && openModule(module)}
                  className={`relative group cursor-pointer rounded-2xl p-6 transition-all ${theme === 'dark' ? 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-violet-500' : 'bg-white hover:shadow-xl border border-gray-200 hover:border-violet-500'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isFavorite && (
                    <div className="absolute top-4 right-4">
                      <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isLocked ? 'bg-gray-700' : 'bg-gradient-to-br from-violet-500 to-purple-600'}`}>
                    {isLocked ? <X className="w-6 h-6 text-gray-500" /> : <Icon className="w-6 h-6 text-white" />}
                  </div>
                  <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{module.name}</h3>
                  <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{module.description}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-lg ${isLocked ? 'bg-gray-700 text-gray-500' : theme === 'dark' ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                      {isLocked ? 'Plan supérieur requis' : module.category}
                    </span>
                    {!isLocked && <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </main>
      </div>

      {showModulePanel && selectedModule && (
        <div className={`fixed inset-0 z-50 ${isFullscreen ? 'bg-black' : 'bg-black/60'} flex items-center justify-center`} onClick={() => { setShowModulePanel(false); setIsFullscreen(false) }}>
          <div 
            className={`w-full ${isFullscreen ? 'h-screen p-0' : 'max-w-3xl max-h-[90vh] p-6'} ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} overflow-hidden flex flex-col`} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'} flex items-center justify-between flex-shrink-0`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedModule.name}</h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{selectedModule.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)} 
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                  title={isFullscreen ? 'Réduire' : 'Plein écran'}
                >
                  {isFullscreen ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => { setShowModulePanel(false); setIsFullscreen(false) }} 
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`p-4 flex-1 overflow-y-auto ${isFullscreen ? 'p-4' : 'p-6'}`}>
              <div className="grid gap-4">
                {selectedModule.fields?.map((field) => (
                  <div key={field.name}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea value={inputData[field.name] || ''} onChange={(e) => setInputData({ ...inputData, [field.name]: e.target.value })} placeholder={field.placeholder} rows={4} className={`w-full p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'}`} />
                    ) : (
                      <input type={field.type || 'text'} value={inputData[field.name] || ''} onChange={(e) => setInputData({ ...inputData, [field.name]: e.target.value })} placeholder={field.placeholder} className={`w-full p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'}`} />
                    )}
                  </div>
                ))}
              </div>

              {result && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Résultat
                    </label>
                    <div className="flex gap-2">
                      <button onClick={copyResult} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copié!' : 'Copier'}
                      </button>
                      <button onClick={copyAsMarkdown} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        Notion
                      </button>
                      <button onClick={downloadPDF} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        PDF
                      </button>
                      <button onClick={handleSaveResult} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 flex items-center gap-1.5 transition-all">
                        {saveSuccess ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                        {saveSuccess ? 'Sauvegardé!' : 'Sauvegarder'}
                      </button>
                    </div>
                  </div>
                  <div className={`p-5 rounded-2xl whitespace-pre-wrap border-2 ${theme === 'dark' ? 'bg-gray-800/30 border-violet-500/30' : 'bg-violet-50 border-violet-200'}`}>
                    <pre className={`whitespace-pre-wrap font-mono text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{result}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 border-t flex-shrink-0 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <button onClick={handleGenerate} disabled={loading} className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Générer avec l'IA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}