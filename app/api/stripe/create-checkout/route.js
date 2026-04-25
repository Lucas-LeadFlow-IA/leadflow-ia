import { NextResponse } from 'next/server'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Validation de la clé Stripe
let stripe = null
let stripeError = null

if (!stripeSecretKey) {
  stripeError = 'Stripe non configuré'
} else if (stripeSecretKey.startsWith('rk_live_')) {
  stripeError = 'Clé restreinte détectée. Utilisez une clé secrete (sk_live_...) depuis Stripe Dashboard'
} else if (!stripeSecretKey.startsWith('sk_live_') && !stripeSecretKey.startsWith('sk_test_')) {
  stripeError = 'Clé Stripe invalide. Doit commencer par sk_live_ ou sk_test_'
} else {
  try {
    stripe = require('stripe')(stripeSecretKey)
  } catch (e) {
    stripeError = 'Erreur avec la clé Stripe'
  }
}

export async function POST(request) {
  // Check if Stripe is configured correctly
  if (stripeError || !stripe) {
    console.error('Stripe config error:', stripeError)
    return NextResponse.json({ 
      error: stripeError || 'Stripe non configuré',
      hint: stripeSecretKey?.startsWith('rk_live_') ? 'Utilisez une clé secrete (sk_live_...), pas une clé restreinte (rk_live_...)' : 'Configurez STRIPE_SECRET_KEY dans les variables d\'environnement'
    }, { status: 500 })
  }

  try {
    const { plan, billing, userId, email } = await request.json()

    if (!plan || !['pro', 'agency'].includes(plan)) {
      return NextResponse.json({ error: 'Plan invalide. Choisissez Pro ou Agency.' }, { status: 400 })
    }

    const priceAmounts = {
      pro:    { monthly: 4900,  yearly: 47088 },
      agency: { monthly: 14900, yearly: 143088 },
    }

    const planPrices = priceAmounts[plan]
    const amount = billing === 'yearly' ? planPrices.yearly : planPrices.monthly
    const interval = billing === 'yearly' ? 'year' : 'month'

    const productNames = {
      pro: 'LeadFlow IA Pro',
      agency: 'LeadFlow IA Agency',
    }

    // Try to find existing product
    let product
    try {
      const existingProducts = await stripe.products.list({ limit: 20, active: true })
      product = existingProducts.data.find(p => p.metadata?.plan_id === plan)
    } catch (e) {
      // Product listing failed, try to create anyway
    }

    // Create product if not found
    if (!product) {
      try {
        product = await stripe.products.create({
          name: productNames[plan],
          metadata: { plan_id: plan },
          description: plan === 'pro'
            ? '200 requêtes/mois · 12 modules IA · Export PDF & Notion'
            : '1000 requêtes/mois · 12 modules IA · Équipe 5 utilisateurs · API Keys',
        })
      } catch (e) {
        return NextResponse.json({ 
          error: 'Erreur Stripe: Impossible de créer le produit. Vérifiez les permissions de la clé API.' 
        }, { status: 500 })
      }
    }

    // Create price
    let stripePrice
    try {
      stripePrice = await stripe.prices.create({
        unit_amount: amount,
        currency: 'eur',
        recurring: { interval },
        product: product.id,
        metadata: { plan_id: plan, billing_type: billing },
      })
    } catch (e) {
      return NextResponse.json({ 
        error: 'Erreur Stripe: Impossible de créer le prix. Vérifiez les permissions de la clé API.' 
      }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create checkout session
    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        locale: 'fr',
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        success_url: `${baseUrl}/auth/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
        cancel_url: `${baseUrl}/auth/pricing`,
        customer_email: email || undefined,
        metadata: { plan, billing, userId: userId?.toString() || 'guest' },
        subscription_data: {
          metadata: { plan, userId: userId?.toString() || 'guest' },
          trial_period_days: 0,
        },
      })
    } catch (e) {
      return NextResponse.json({ 
        error: 'Erreur Stripe: Impossible de créer la session. Vérifiez les permissions.' 
      }, { status: 500 })
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })

  // Send admin notification
  try {
    await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'new_plan', email: email || 'unknown', plan }),
    })
  } catch (e) {
    console.error('Notif failed:', e)
  }

  return NextResponse.json({ url: session.url, sessionId: session.id })

  } catch (error) {
    console.error('Stripe error:', error.type, error.message)
    
    let errorMessage = 'Erreur lors du paiement.'
    
    if (error.type === 'invalid_request_error') {
      errorMessage = 'Clé API invalide ou permissions insuffisantes.'
    } else if (error.type === 'authentication_error') {
      errorMessage = 'Erreur d\'authentification Stripe.'
    }
    
    return NextResponse.json({
      error: errorMessage,
      details: error.message,
    }, { status: 500 })
  }
}

export async function sendAdminNotification(type, email, plan) {
  try {
    await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, email, plan }),
    })
  } catch (e) {
    console.error('Notif failed:', e)
  }
}