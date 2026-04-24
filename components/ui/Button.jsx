"use client"
import { motion } from 'framer-motion'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  onClick,
  className = '',
  ...props
}) {
  const variants = {
    primary: `
      bg-gradient-to-r from-violet-600 to-purple-600
      hover:from-violet-500 hover:to-purple-500
      text-white shadow-lg shadow-violet-500/25
      hover:shadow-violet-500/40 hover:scale-[1.02]
      active:scale-[0.98]
    `,
    secondary: `
      bg-white/5 border border-white/10
      hover:bg-white/10 hover:border-white/20
      text-gray-300 hover:text-white
    `,
    ghost: `
      bg-transparent hover:bg-white/5
      text-gray-400 hover:text-white
    `,
    danger: `
      bg-red-500/10 border border-red-500/20
      hover:bg-red-500/20 text-red-400 hover:text-red-300
    `,
    success: `
      bg-emerald-500/10 border border-emerald-500/20
      hover:bg-emerald-500/20 text-emerald-400
    `,
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-8 py-4 text-base rounded-2xl gap-2.5',
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: variant === 'primary' ? 1.02 : 1.01 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
      className={`
        relative inline-flex items-center justify-center font-semibold
        transition-all duration-200 select-none
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
          <span className="opacity-70">Chargement...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
          {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
        </>
      )}
    </motion.button>
  )
}