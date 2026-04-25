import { NextResponse } from 'next/server'

export async function POST(request) {
  const { type, email, name, plan } = await request.json()
  
  if (!type) {
    return NextResponse.json({ error: 'Type requis' }, { status: 400 })
  }
  
  const ADMIN_EMAIL = 'lucas.legrand567@gmail.com'
  
  let subject = ''
  let html = ''
  
  if (type === 'new_user') {
    subject = '🎉 Nouveau compte créé sur LeadFlow IA!'
    html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">🚀 Nouveau compte!</h1>
        <p>Nouveau utilisateur sur LeadFlow IA:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Nom:</strong> ${name || 'Non fourni'}</li>
          <li><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</li>
        </ul>
        <p style="color: #64748b; font-size: 14px;">Connecte-toi au dashboard pour voir les détails.</p>
      </div>
    `
  } else if (type === 'new_plan') {
    subject = `💰 Nouveau client ${plan?.toUpperCase()} sur LeadFlow IA!`
    html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981;">💰 Nouveau client!</h1>
        <p>Nouveau paiement:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Plan:</strong> ${plan}</li>
          <li><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</li>
        </ul>
        <p style="color: #64748b; font-size: 14px;">Félicitations! 🎉</p>
      </div>
    `
  }
  
  console.log(`[NOTIFY] Envoi email à ${ADMIN_EMAIL}:`, subject)
  
  return NextResponse.json({ success: true, subject })
}