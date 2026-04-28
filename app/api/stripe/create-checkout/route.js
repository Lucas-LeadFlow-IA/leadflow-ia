import { NextResponse } from 'next/server'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Validation de la clé Stripe
let stripe = null
let stripeError = null

if (!stripeSecretKey) {
  stripeError = 'Stripe non configuré'
} else if (stripeSecretKey.startsWith('rk_')) {
  stripeError = 'Clé restreinte détectée. Utilisez une clé secrete (sk_...)'
} else if (stripeSecretKey.startsWith('sk_')) {
  try {
    stripe = require('stripe')(stripeSecretKey)
  } catch (e) {
    stripeError = 'Erreur avec la clé Stripe: ' + e.message
  }
} else {
  stripeError = 'Clé Stripe invalide'
}

// Price IDs from env
const getPriceId = (plan, billing) => {
  const key = `STRIPE_${plan.toUpperCase()}_${billing === 'yearly' ? 'YEARLY' : 'MONTHLY'}_PRICE_ID`
  return process.env[key]
}

export async function POST(request) {
  if (stripeError || !stripe) {
    console.error('Stripe config error:', stripeError)
    return NextResponse.json({ 
      error: stripeError || 'Stripe non configuré',
      hint: 'Configurez les variables STRIPE_*_PRICE_ID dans .env.local'
    }, { status: 500 })
  }

  try {
    const { plan, billing, userId, email } = await request.json()
    
    if (!plan || !['starter', 'pro', 'agency'].includes(plan)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    // Use existing Price ID from env
    const priceId = getPriceId(plan, billing)
    
    if (priceId && priceId.startsWith('price_')) {
      // Use existing price
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leadflow-ia-lac.vercel.app'
      
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        locale: 'fr',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/auth/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
        cancel_url: `${baseUrl}/auth/pricing`,
        customer_email: email || undefined,
        metadata: { plan, billing, userId: userId?.toString() || 'guest' },
        subscription_data: {
          metadata: { plan, userId: userId?.toString() || 'guest' },
        },
      })

      // Send admin notification
      try {
        await fetch(`${baseUrl}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'new_plan', email: email || 'unknown', plan }),
        })
      } catch (e) {
        console.error('Notif failed:', e)
      }

      return NextResponse.json({ url: session.url, sessionId: session.id })
    }

    // Fallback: create price on the fly if no env var
    const planDetails = {
      starter: { name: 'LeadFlow IA Starter', monthly: 1900, yearly: 18000 },
      pro: { name: 'LeadFlow IA Pro', monthly: 3900, yearly: 34800 },
      agency: { name: 'LeadFlow IA Agency', monthly: 9700, yearly: 92400 },
    }

    const details = planDetails[plan]
    const amount = billing === 'yearly' ? details.yearly : details.monthly
    const interval = billing === 'yearly' ? 'year' : 'month'

    let product
    try {
      const existingProducts = await stripe.products.list({ limit: 20, active: true })
      product = existingProducts.data.find(p => p.metadata?.plan_id === plan)
    } catch (e) {}

    if (!product) {
      try {
        product = await stripe.products.create({
          name: details.name,
          metadata: { plan_id: plan },
        })
      } catch (e) {
        return NextResponse.json({ 
          error: 'Erreur Stripe: Impossible de créer le produit.' 
        }, { status: 500 })
      }
    }

    const stripePrice = await stripe.prices.create({
      unit_amount: amount,
      currency: 'eur',
      recurring: { interval },
      product: product.id,
      metadata: { plan_id: plan, billing_type: billing },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leadflow-ia-lac.vercel.app'

    const session = await stripe.checkout.sessions.create({
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
      },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })

  } catch (error) {
    console.error('Stripe error:', error)
    return NextResponse.json({
      error: 'Erreur lors du paiement.',
      details: error.message,
    }, { status: 500 })
  }
}
