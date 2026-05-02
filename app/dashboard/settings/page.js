"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  Zap, Moon, Sun, ArrowLeft, User, Key, Users, Bell, CreditCard,
  Shield, Trash2, Plus, Copy, Check, ExternalLink, LogOut, X
} from 'lucide-react'
import { format } from 'date-fns'

export default function SettingsPage() {
  const router = useRouter()
  const {
    user, theme, toggleTheme, logout, setUser,
    apiKeys, generateApiKey, deleteApiKey,
    team, addTeamMember, removeTeamMember,
    notifications, markAsRead, clearNotifications
  } = useStore()
  
  const [activeTab, setActiveTab] = useState('profile')
  const [copied, setCopied] = useState(null)
  const [newApiKeyName, setNewApiKeyName] = useState('')
  const [newTeamEmail, setNewTeamEmail] = useState('')

  if (!user) {
    router.push('/auth/login')
    return null
  }

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'api', label: 'API Keys', icon: Key, badge: apiKeys.length },
    { id: 'team', label: 'Équipe', icon: Users, badge: team.length, requires: 'agency' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.read).length },
    { id: 'billing', label: 'Abonnement', icon: CreditCard },
    { id: 'security', label: 'Sécurité', icon: Shield },
  ]

  const copyApiKey = (key) => {
    navigator.clipboard.writeText(key)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleGenerateApiKey = () => {
    if (newApiKeyName.trim()) {
      generateApiKey()
      setNewApiKeyName('')
    }
  }

  const handleAddTeamMember = () => {
    if (newTeamEmail.trim() && newTeamEmail.includes('@')) {
      addTeamMember(newTeamEmail)
      setNewTeamEmail('')
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
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
              Paramètres
            </h1>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-6">
          <aside className={`md:w-64 rounded-2xl p-4 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isDisabled = tab.requires && user.plan !== tab.requires
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                        : isDisabled
                          ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
                          : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1 text-left">{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        activeTab === tab.id ? 'bg-white/20' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                    {isDisabled && <span className="text-xs">🔒</span>}
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className={`flex-1 rounded-2xl p-6 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            {activeTab === 'profile' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Profil
                </h2>
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {user.name}
                    </h3>
                    <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{user.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={user.name || ''}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={user.email || ''}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                      }`}
                      disabled
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Plan actuel
                    </label>
                    <div className={`px-4 py-3 rounded-xl border capitalize ${
                      user.plan === 'agency' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' :
                      user.plan === 'pro' ? 'bg-violet-500/20 border-violet-500/50 text-violet-400' :
                      'bg-gray-500/20 border-gray-500/50 text-gray-400'
                    }`}>
                      {user.plan} - {user.plan === 'free' ? 'Gratuit' : user.plan === 'pro' ? '49€/mois' : '149€/mois'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/auth/pricing')}
                  className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium"
                >
                  Changer de plan
                </button>
              </motion.div>
            )}

            {activeTab === 'api' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  API Keys
                </h2>
                <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Utilisez ces clés pour intégrer LeadFlow IA dans vos applications
                </p>

                {user.plan !== 'agency' && (
                  <div className={`p-4 rounded-xl mb-6 ${
                    theme === 'dark' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className="text-yellow-400 text-sm">
                      🔒 Les API Keys sont disponibles uniquement pour le plan Agency
                    </p>
                  </div>
                )}

                {user.plan === 'agency' && (
                  <>
                    <div className="flex gap-3 mb-6">
                      <input
                        type="text"
                        value={newApiKeyName}
                        onChange={(e) => setNewApiKeyName(e.target.value)}
                        placeholder="Nom de la clé (ex: Production)"
                        className={`flex-1 px-4 py-2.5 rounded-xl border ${
                          theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                        }`}
                      />
                      <button
                        onClick={handleGenerateApiKey}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 text-white flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Générer
                      </button>
                    </div>

                    <div className="space-y-3">
                      {apiKeys.map((apiKey) => (
                        <div key={apiKey.id} className={`p-4 rounded-xl ${
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {apiKey.name}
                            </span>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                              Créé le {format(new Date(apiKey.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className={`flex-1 px-3 py-2 rounded-lg font-mono text-sm truncate ${
                              theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {apiKey.key}
                            </code>
                            <button
                              onClick={() => copyApiKey(apiKey.key)}
                              className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400"
                            >
                              {copied === apiKey.key ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteApiKey(apiKey.id)}
                              className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'team' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Équipe
                </h2>
                <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Gérez les membres de votre équipe (plan Agency)
                </p>

                {user.plan === 'agency' ? (
                  <>
                    <div className="flex gap-3 mb-6">
                      <input
                        type="email"
                        value={newTeamEmail}
                        onChange={(e) => setNewTeamEmail(e.target.value)}
                        placeholder="Email du membre"
                        className={`flex-1 px-4 py-2.5 rounded-xl border ${
                          theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                        }`}
                      />
                      <button
                        onClick={handleAddTeamMember}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 text-white flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter
                      </button>
                    </div>

                    <div className="space-y-3">
                      {team.map((email, i) => (
                        <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                              {email.charAt(0).toUpperCase()}
                            </div>
                            <span>{email}</span>
                          </div>
                          <button
                            onClick={() => removeTeamMember(email)}
                            className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={`p-6 rounded-xl text-center ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                    <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      La gestion d'équipe est disponible sur le plan Agency
                    </p>
                    <button
                      onClick={() => router.push('/auth/pricing')}
                      className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                    >
                      Passer à Agency
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Notifications
                  </h2>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-sm text-red-400 hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {notifications.length === 0 ? (
                    <div className={`p-8 rounded-xl text-center ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                      <Bell className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Aucune notification
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`p-4 rounded-xl cursor-pointer ${
                          notif.read
                            ? theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                            : theme === 'dark' ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            notif.read ? 'bg-transparent' : 'bg-violet-500'
                          }`} />
                          <div className="flex-1">
                            <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                              {notif.message}
                            </p>
                            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                              {format(new Date(notif.createdAt), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'billing' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Abonnement
                </h2>

                <div className={`p-6 rounded-2xl mb-6 ${
                  user.plan === 'agency' ? 'bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30' :
                  user.plan === 'pro' ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30' :
                  'bg-gradient-to-r from-gray-500/20 to-gray-500/20 border border-gray-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Plan actuel
                      </p>
                      <h3 className={`text-2xl font-bold capitalize ${
                        user.plan === 'agency' ? 'text-purple-400' :
                        user.plan === 'pro' ? 'text-violet-400' : 'text-gray-400'
                      }`}>
                        {user.plan}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {user.plan === 'free' ? '0€' : user.plan === 'pro' ? '49€' : '149€'}
                        <span className="text-sm font-normal">/mois</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => router.push('/auth/pricing')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium"
                  >
                    Changer de plan
                  </button>
                  <button className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-medium">
                    Annuler l'abonnement
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Sécurité
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Changer le mot de passe
                    </h3>
                    <div className="space-y-3">
                      <input
                        type="password"
                        placeholder="Mot de passe actuel"
                        className={`w-full px-4 py-3 rounded-xl border ${
                          theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                        }`}
                      />
                      <input
                        type="password"
                        placeholder="Nouveau mot de passe"
                        className={`w-full px-4 py-3 rounded-xl border ${
                          theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                        }`}
                      />
                      <button className="px-6 py-3 rounded-xl bg-violet-600 text-white">
                        Mettre à jour
                      </button>
                    </div>
                  </div>

                  <div className={`pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-medium mb-3 text-red-400`}>
                      Zone dangereuse
                    </h3>
                    <button
                      onClick={handleLogout}
                      className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-medium"
                    >
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
