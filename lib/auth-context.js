"use client"

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [contacts, setContacts] = useState([])
  const [history, setHistory] = useState([])
  const [savedResults, setSavedResults] = useState([])
  const [favorites, setFavorites] = useState([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('leadflow-user')
      const savedTheme = localStorage.getItem('leadflow-theme')
      const savedContacts = localStorage.getItem('leadflow-contacts')
      const savedHistory = localStorage.getItem('leadflow-history')
      const savedResults = localStorage.getItem('leadflow-results')
      const savedFavs = localStorage.getItem('leadflow-favorites')
      
      if (savedUser) setUser(JSON.parse(savedUser))
      if (savedTheme) setTheme(savedTheme)
      if (savedContacts) setContacts(JSON.parse(savedContacts))
      if (savedHistory) setHistory(JSON.parse(savedHistory))
      if (savedResults) setSavedResults(JSON.parse(savedResults))
      if (savedFavs) setFavorites(JSON.parse(savedFavs))
    } catch (e) {
      console.error('Error loading from localStorage:', e)
    }
  }, [])

  const login = async (email, password) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const users = JSON.parse(localStorage.getItem('leadflow-users') || '[]')
    const user = users.find(u => u.email === email && u.password === password)
    if (user) {
      const userData = { id: user.id, email: user.email, name: user.name, plan: user.plan || 'free', requestsUsed: user.requestsUsed || 0 }
      setUser(userData)
      localStorage.setItem('leadflow-user', JSON.stringify(userData))
      return { success: true }
    }
    return { success: false, error: 'Email ou mot de passe incorrect' }
  }

  const register = async (email, password, name) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const users = JSON.parse(localStorage.getItem('leadflow-users') || '[]')
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Ce compte existe déjà' }
    }
    const newUser = { 
      id: String(Date.now()), email, name, password, 
      plan: 'free', requestsUsed: 0, createdAt: new Date().toISOString() 
    }
    const updatedUsers = [...users, newUser]
    localStorage.setItem('leadflow-users', JSON.stringify(updatedUsers))
    const userData = { id: newUser.id, email: newUser.email, name: newUser.name, plan: 'free', requestsUsed: 0 }
    setUser(userData)
    localStorage.setItem('leadflow-user', JSON.stringify(userData))
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('leadflow-user')
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('leadflow-theme', newTheme)
  }

  const addContact = (contact) => {
    const newContact = { ...contact, id: Date.now(), createdAt: new Date().toISOString() }
    const updated = [...contacts, newContact]
    setContacts(updated)
    localStorage.setItem('leadflow-contacts', JSON.stringify(updated))
  }

  const deleteContact = (id) => {
    const updated = contacts.filter(c => c.id !== id)
    setContacts(updated)
    localStorage.setItem('leadflow-contacts', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{
      user, setUser, theme, toggleTheme, login, register, logout,
      contacts, addContact, deleteContact,
      history, setHistory,
      savedResults, setSavedResults,
      favorites, setFavorites
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
