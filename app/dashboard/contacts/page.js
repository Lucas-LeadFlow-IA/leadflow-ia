"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Zap, Users, Moon, Sun, Search, Plus, ArrowLeft, Trash2, Edit2, Mail,
  Phone, Building, Briefcase, X, Check, Download, Upload, ChevronDown, AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'

export default function ContactsPage() {
  const router = useRouter()
  const { user, theme, toggleTheme, logout, contacts, addContact, updateContact, deleteContact, incrementStat } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company: '', position: '', status: 'lead', notes: ''
  })

  if (!user) {
    router.push('/auth/login')
    return null
  }

  const filteredContacts = contacts.filter(c =>
    (c.ownerEmail === user?.email || !c.ownerEmail) &&
    (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const statusColors = {
    lead: 'bg-blue-500/20 text-blue-400',
    prospect: 'bg-yellow-500/20 text-yellow-400',
    client: 'bg-emerald-500/20 text-emerald-400',
    inactive: 'bg-gray-500/20 text-gray-400'
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.email) {
      toast.error('Nom et email sont requis', {
        icon: <AlertCircle className="w-5 h-5 text-red-500" />
      })
      return
    }
    if (editingContact) {
      updateContact(editingContact.id, formData)
      toast.success('Contact mis à jour !')
    } else {
      addContact(formData)
      incrementStat('totalLeads')
      toast.success('Contact ajouté !')
    }
    setShowAddModal(false)
    setEditingContact(null)
    setFormData({ name: '', email: '', phone: '', company: '', position: '', status: 'lead', notes: '' })
  }

  const handleEdit = (contact) => {
    setFormData(contact)
    setEditingContact(contact)
    setShowAddModal(true)
  }

  const handleDelete = (id) => {
    if (confirm('Voulez-vous vraiment supprimer ce contact ?')) {
      deleteContact(id)
    }
  }

  const exportCSV = () => {
    const headers = ['Nom', 'Email', 'Téléphone', 'Entreprise', 'Poste', 'Statut', 'Notes', 'Créé le']
    const rows = contacts.map(c => [
      c.name, c.email, c.phone, c.company, c.position, c.status, c.notes, format(new Date(c.createdAt), 'dd/MM/yyyy')
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts-leadflow.csv'
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
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Contacts CRM
            </h1>
            <span className={`text-sm px-3 py-1 rounded-full ${
              theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
            }`}>
              {contacts.length} contact{contacts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportCSV} className={`px-4 py-2 rounded-xl flex items-center gap-2 ${
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
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
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un contact..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
          <button
            onClick={() => { setShowAddModal(true); setEditingContact(null); setFormData({ name: '', email: '', phone: '', company: '', position: '', status: 'lead', notes: '' }) }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau contact
          </button>
        </div>

        {filteredContacts.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {contacts.length === 0 ? 'Aucun contact' : 'Aucun résultat'}
            </h3>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              {contacts.length === 0 ? 'Ajoutez votre premier contact pour commencer' : 'Modifiez votre recherche'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredContacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-2xl p-6 ${
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                      {contact.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {contact.name}
                      </h3>
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {contact.position} {contact.company && `@ ${contact.company}`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${statusColors[contact.status]}`}>
                    {contact.status}
                  </span>
                </div>

                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className={`flex items-center gap-2 text-sm ${
                      theme === 'dark' ? 'text-gray-400 hover:text-violet-400' : 'text-gray-600 hover:text-violet-600'
                    }`}>
                      <Mail className="w-4 h-4" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className={`flex items-center gap-2 text-sm ${
                      theme === 'dark' ? 'text-gray-400 hover:text-violet-400' : 'text-gray-600 hover:text-violet-600'
                    }`}>
                      <Phone className="w-4 h-4" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.company && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      <Building className="w-4 h-4" />
                      {contact.company}
                    </div>
                  )}
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    Ajouté le {format(new Date(contact.createdAt), 'dd/MM/yyyy')}
                  </div>
                </div>

                {contact.notes && (
                  <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    📝 {contact.notes}
                  </p>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(contact)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAddModal(false)} />
          <div className={`fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] rounded-3xl p-6 z-50 ${
            theme === 'dark' ? 'bg-gray-900' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editingContact ? 'Modifier le contact' : 'Nouveau contact'}
              </h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    placeholder="jean@exemple.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Statut
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <option value="lead">Lead</option>
                    <option value="prospect">Prospect</option>
                    <option value="client">Client</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Entreprise
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    placeholder="TechCorp SAS"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Poste
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    placeholder="Directeur Commercial"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-2.5 rounded-xl border ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                  placeholder="Notes sur ce contact..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className={`px-6 py-2.5 rounded-xl ${
                  theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                }`}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium"
              >
                {editingContact ? 'Mettre à jour' : 'Créer le contact'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
