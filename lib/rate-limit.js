import { NextResponse } from 'next/server'

// Simple rate limiter par IP
const rateLimitMap = new Map()
const RATE_LIMIT = 30 // 30 requêtes
const WINDOW_MS = 60 * 1000 // 1 minute

export function rateLimit(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] 
    || request.headers.get('x-real-ip') 
    || 'unknown'
  
  const now = Date.now()
  const key = `${ip}:${request.nextUrl.pathname}`
  
  // Nettoyer les anciennes entrées
  for (const [k, v] of rateLimitMap) {
    if (now - v.timestamp > WINDOW_MS) {
      rateLimitMap.delete(k)
    }
  }
  
  const entry = rateLimitMap.get(key) || { count: 0, timestamp: now }
  
  if (now - entry.timestamp > WINDOW_MS) {
    entry.count = 0
    entry.timestamp = now
  }
  
  entry.count++
  rateLimitMap.set(key, entry)
  
  if (entry.count > RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans 1 minute.' },
      { status: 429 }
    )
  }
  
  return null // Pas de limite dépassée
}

export function withRateLimit(handler) {
  return async (request) => {
    const rateLimitError = rateLimit(request)
    if (rateLimitError) return rateLimitError
    return handler(request)
  }
}