"use client"
import { Zap } from 'lucide-react'
import Link from 'next/link'

export function Logo({ size = 'md', href = '/', showText = true }) {
  const sizes = {
    sm: { container: 'w-7 h-7 rounded-lg', icon: 'w-4 h-4', text: 'text-base', badge: 'text-[9px] px-1.5 py-0.5' },
    md: { container: 'w-9 h-9 rounded-xl', icon: 'w-5 h-5', text: 'text-lg', badge: 'text-[10px] px-2 py-0.5' },
    lg: { container: 'w-12 h-12 rounded-2xl', icon: 'w-6 h-6', text: 'text-2xl', badge: 'text-xs px-2 py-1' },
  }
  
  const s = sizes[size]
  
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <div className={`${s.container} bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow`}>
        <Zap className={`${s.icon} text-white`} />
      </div>
      {showText && (
        <div className="flex items-center gap-1.5">
          <span className={`${s.text} font-extrabold text-white tracking-tight`}>
            Lead<span className="text-violet-400">Flow</span>
          </span>
          <span className={`${s.badge} rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 font-bold uppercase tracking-wider`}>
            IA
          </span>
        </div>
      )}
    </Link>
  )
}