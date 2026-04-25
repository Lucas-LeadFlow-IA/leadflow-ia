'use client'

import { Suspense } from 'react'

export default function LoadingWrapper({ children }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  )
}