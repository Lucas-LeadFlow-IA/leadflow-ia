import { NextResponse } from 'next/server'

const leads = []

export async function POST(request) {
  try {
    const { email, name, company, source } = await request.json()

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const existingIndex = leads.findIndex(l => l.email === email)
    const newLead = {
      id: Date.now(),
      email,
      name: name || '',
      company: company || '',
      source: source || 'website',
      createdAt: new Date().toISOString(),
      status: 'new',
      notes: '',
      contacted: false
    }

    if (existingIndex >= 0) {
      leads[existingIndex] = { ...leads[existingIndex], ...newLead, updatedAt: new Date().toISOString() }
    } else {
      leads.push(newLead)
    }

    console.log('📧 Nouveau lead capturé:', newLead)
    
    return NextResponse.json({ 
      success: true, 
      lead: newLead,
      message: 'Lead capturé avec succès'
    })
  } catch (error) {
    console.error('Erreur capture lead:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    leads,
    total: leads.length,
    stats: {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.contacted).length
    }
  })
}
