'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  mounted: false
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('leadflow-theme')
    const finalTheme = stored || 'dark'
    setTheme(finalTheme)
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add(finalTheme)
    }
  }, [])

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') {
      localStorage.setItem('leadflow-theme', theme)
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(theme)
    }
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  return context
}