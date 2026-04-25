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
import { Logo } from '@/components/Logo'
import { UpgradeModal } from '@/components/ui/UpgradeModal'

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
  const [upgradeModal, setUpgradeModal] = useState({ open: false, moduleName: '' })
  const [hydrated, setHydrated] = useState(false)
  const [lockedModuleName, setLockedModuleName] = useState('')
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  // Hydration check for Zustand
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!user) router.push('/auth/login')
  }, [user, router])

  // Auto-close upgrade toast
  useEffect(() => {
    if (showUpgradePrompt) {
      const t = setTimeout(() => setShowUpgradePrompt(false), 4000)
      return () => clearTimeout(t)
    }
  }, [showUpgradePrompt])

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

  const allModules = getAllModules() || []
  const filteredModules = allModules.filter(m => {
    if (!m || !m.name) return false
    const q = (searchQuery || '').toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q)
  })

  const openModule = (module) => {
    if (!canUseModule(module.id)) {
      setLockedModuleName(module.name)
      setShowUpgradePrompt(true)
      return
    }
    setSelectedModule(module)
    setShowModulePanel(true)
    setInputData({})
    setResult('')
  }

  const handleGenerate = async () => {
    const rawRemaining = getRemainingRequests()
  const remaining = isFinite(rawRemaining) && !isNaN(rawRemaining)
    ? Math.max(0, rawRemaining)
    : 0
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

  const rawRemaining = getRemainingRequests()
  const remaining = isFinite(rawRemaining) && !isNaN(rawRemaining)
    ? Math.max(0, rawRemaining)
    : 0
  const limits = { free: 5, pro: 200, agency: 1000 }
  const limit = limits[user.plan] || 5
  const used = user.requestsUsed || 0
  const pct = Math.min((used / limit) * 100, 100)

  const planBadgeColors = {
    free: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
    pro: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
    agency: 'bg-purple-500/20 text-purple-300 border-purple-500/20'
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      {/* Sidebar Redesign */}
      <aside className={`
        ${sidebarOpen ? 'w-64' : 'w-16'} 
        hidden md:flex flex-col
        ${theme === 'dark' ? 'bg-[#0d0d15] border-r border-white/5' : 'bg-white border-r border-gray-200'}
        transition-all duration-300
        h-screen sticky top-0
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-white/5 ${!sidebarOpen && 'justify-center'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-white text-sm leading-tight">LeadFlow</p>
              <p className="text-violet-400 text-xs font-semibold">IA Pro</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                    : theme === 'dark' ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }
                  ${!sidebarOpen && 'justify-center'}
                `}
              >
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-violet-400' : ''}`} />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                {sidebarOpen && isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Quota bar */}
        {sidebarOpen && user && (
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${planBadgeColors[user.plan]}`}>
                {user.plan === 'free' ? 'Gratuit' : user.plan === 'pro' ? '⚡ Pro' : '🏢 Agency'}
              </span>
              {user.plan === 'free' && (
                <button
                  onClick={() => router.push('/auth/pricing')}
                  className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
                >
                  Upgrader →
                </button>
              )}
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500">Requêtes</span>
                <span className={pct > 80 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                  {used}/{limit}
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* User footer */}
        <div className={`p-3 border-t border-white/5 flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          )}
          {sidebarOpen && (
            <button onClick={handleLogout} className="text-gray-600 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className={`absolute left-0 top-0 bottom-0 w-64 p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <Logo size="sm" />
              <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => { router.push(item.path); setMobileMenuOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${isActive ? 'bg-violet-500/15 text-violet-300' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}`}>
        <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-gray-800/50' : 'bg-white/80 border-gray-200'}`}>
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
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="Rechercher un module..." 
                  className={`w-80 pl-10 pr-4 py-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'}`} 
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium hidden sm:block ${remaining > 10 ? 'bg-emerald-500/20 text-emerald-400' : remaining > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                {remaining} requêtes
              </div>
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl stat-card ${theme === 'dark' ? 'bg-[#1a1a28] border border-white/5' : 'bg-white border border-gray-200'}`}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stats.totalRequests}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Requêtes IA</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-4 rounded-2xl stat-card ${theme === 'dark' ? 'bg-[#1a1a28] border border-white/5' : 'bg-white border border-gray-200'}`}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20">
                <Users className="w-5 h-5 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{contacts.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Contacts CRM</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-4 rounded-2xl stat-card ${theme === 'dark' ? 'bg-[#1a1a28] border border-white/5' : 'bg-white border border-gray-200'}`}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{savedResults.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Favoris</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-4 rounded-2xl stat-card ${theme === 'dark' ? 'bg-[#1a1a28] border border-white/5' : 'bg-white border border-gray-200'}`}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20">
                <History className="w-5 h-5 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{history.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Historique</p>
            </motion.div>
          </div>

          {/* Welcome */}
          <div className="mb-8">
            <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Bonjour, {user.name?.split(' ')[0]} 👋
            </h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Quel module IA souhaitez-vous utiliser aujourd'hui ?</p>
          </div>

          {/* Module Cards - Premium Design */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModules.map((module, index) => {
              const isFavorite = favorites.includes(module.id)
              const isLocked = !canUseModule(module.id)

              return (
                <motion.div
                  key={module.id}
                  onClick={() => openModule(module)}
                  whileHover={!isLocked ? { y: -4, scale: 1.01 } : {}}
                  whileTap={!isLocked ? { scale: 0.98 } : {}}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`
                    relative group cursor-pointer rounded-2xl p-5 border transition-all duration-300
                    ${!isLocked
                      ? `${theme === 'dark' ? 'bg-[#1a1a28] border-white/5 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10' : 'bg-white border-gray-200 hover:border-violet-500 hover:shadow-xl'}`
                      : `${theme === 'dark' ? 'bg-[#12121a] border-white/3 opacity-60' : 'bg-gray-50 border-gray-200 opacity-60'}`
                    }
                  `}
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/0 to-purple-500/0 group-hover:from-violet-500/5 group-hover:to-purple-500/5 transition-all duration-300" />
                  
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center text-xl shadow-lg`}>
                      {isLocked ? <Lock className="w-5 h-5 text-white" /> : module.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {isFavorite && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      )}
                      {!isLocked && (
                        <ChevronRight className={`w-4 h-4 text-gray-500 group-hover:text-violet-400 group-hover:translate-x-1 transition-all ${theme === 'dark' ? '' : ''}`} />
                      )}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div>
                    <p className={`font-semibold text-sm mb-1 group-hover:text-violet-300 transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {module.name}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">{module.description}</p>
                  </div>

                  {/* Category */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">
                      {isLocked ? (
                        <span className="flex items-center gap-1 text-violet-400">
                          <Lock className="w-3 h-3" /> Pro requis
                        </span>
                      ) : module.category}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </main>
      </div>

      {/* Module Panel */}
      {showModulePanel && selectedModule && (
        <div 
          className={`fixed inset-0 z-50 ${isFullscreen ? 'bg-black' : 'bg-black/60'} flex items-center justify-center`} 
          onClick={() => { setShowModulePanel(false); setIsFullscreen(false) }}
        >
          <div 
            className={`w-full ${isFullscreen ? 'h-screen p-0' : 'max-w-3xl max-h-[90vh] p-6'} ${theme === 'dark' ? 'bg-[#12121a]' : 'bg-white'} overflow-hidden flex flex-col rounded-2xl ${!isFullscreen && 'shadow-2xl shadow-violet-500/20'}`} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
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
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
                >
                  {isFullscreen ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => { setShowModulePanel(false); setIsFullscreen(false) }} 
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`p-6 flex-1 overflow-y-auto ${isFullscreen ? 'p-4' : ''}`}>
              {/* Form */}
              <div className="grid gap-4">
                {selectedModule.fields?.map((field) => (
                  <div key={field.name}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea 
                        value={inputData[field.name] || ''} 
                        onChange={(e) => setInputData({ ...inputData, [field.name]: e.target.value })} 
                        placeholder={field.placeholder} 
                        rows={4} 
                        className={`w-full p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#1a1a28] border-white/10 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'}`} 
                      />
                    ) : (
                      <input 
                        type={field.type || 'text'} 
                        value={inputData[field.name] || ''} 
                        onChange={(e) => setInputData({ ...inputData, [field.name]: e.target.value })} 
                        placeholder={field.placeholder} 
                        className={`w-full p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#1a1a28] border-white/10 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'}`} 
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Result */}
              {result && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Résultat
                    </label>
                    <div className="flex gap-2">
                      <button onClick={copyResult} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copié!' : 'Copier'}
                      </button>
                      <button onClick={copyAsMarkdown} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        Notion
                      </button>
                      <button onClick={downloadPDF} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        PDF
                      </button>
                      <button onClick={handleSaveResult} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 flex items-center gap-1.5 transition-all">
                        {saveSuccess ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                        {saveSuccess ? 'Sauvegardé!' : 'Sauvegarder'}
                      </button>
                    </div>
                  </div>
                  <div className={`p-5 rounded-2xl whitespace-pre-wrap border-2 ${theme === 'dark' ? 'bg-[#1a1a28] border-violet-500/30' : 'bg-violet-50 border-violet-200'}`}>
                    <pre className={`whitespace-pre-wrap font-mono text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{result}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex-shrink-0 ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
              <button 
                onClick={handleGenerate} 
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
              >
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModal.open}
        moduleName={upgradeModal.moduleName}
        onClose={() => setUpgradeModal({ open: false, moduleName: '' })}
      />
    </div>
  )
}