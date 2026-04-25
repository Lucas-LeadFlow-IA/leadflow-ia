// API d'envoi d'email de bienvenue
// Pour activer :
// 1. Obtenir une clé API Resend sur resend.com
// 2. Ajouter RESEND_API_KEY dans .env.local
// 3. npm install resend

import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, name } = await request.json()
  
  if (!email) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 })
  }
  
  // Simulation uniquement (Resend non installé)
  // Pour activer, installez: npm install resend et ajoutez RESEND_API_KEY dans .env.local
  console.log('[WELCOME] Email de bienvenue simulé pour:', email, 'nom:', name)
  return NextResponse.json({ success: true, simulated: true })
}