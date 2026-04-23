import { NextResponse } from 'next/server'

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { plan, billing, userId, email } = await request.json()
    
    // Prix en centimes
    const priceAmounts = {
      pro_monthly: { monthly: 4900, yearly: 47000 },
      agency_monthly: { monthly: 14900, yearly: 143000 }
    }
    
    const amounts = priceAmounts[plan] || priceAmounts.pro_monthly
    const amount = billing === 'yearly' ? amounts.yearly : amounts.monthly
    
    // Produit existant ou créer nouveau
    let products = await stripe.products.list({ limit: 10, active: true })
    let productName = plan === 'pro' ? 'LeadFlow Pro' : 'LeadFlow Agency'
    let product = products.data.find(p => p.name === productName && p.active)
    
    if (!product) {
      product = await stripe.products.create({
        name: productName,
        description: plan === 'pro' 
          ? 'Plan Pro - 200 requetes/mois, tous modules IA' 
          : 'Plan Agency - 1000 requetes/mois, equipe 5 utilisateurs, API'
      })
    }
    
    // Créer le prix
    const stripePrice = await stripe.prices.create({
      unit_amount: amount,
      currency: 'eur',
      recurring: { interval: billing === 'yearly' ? 'year' : 'month' },
      product: product.id
    })
    
    // URL de succès/cancel
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePrice.id,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/auth/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/auth/payment/cancel`,
      customer_email: email || undefined,
      metadata: {
        plan,
        billing,
        userId: userId?.toString() || 'guest'
      }
    })

    return NextResponse.json({ 
      url: session.url, 
      sessionId: session.id 
    })
    
  } catch (error) {
    console.error('Stripe error:', error.type, error.message, error.code)
    return NextResponse.json({ 
      error: `Erreur Stripe: ${error.message}`,
      code: error.code,
      type: error.type
    }, { status: 500 })
  }
}