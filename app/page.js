"use client"

import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [theme, setTheme] = useState('dark')
  
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="p-8">
        <h1 className="text-4xl font-bold">LeadFlow IA</h1>
        <p>Test page</p>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          Toggle theme (current: {theme})
        </button>
        <p>Welcome to LeadFlow IA</p>
        <Link href="/auth/login">Login</Link>
      </div>
    </main>
  )
}
