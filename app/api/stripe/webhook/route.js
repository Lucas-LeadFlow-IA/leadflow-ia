import { NextResponse } from 'next/server'

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null

export async function POST(request) {
  if (!stripe) {
    console.warn('[STRIPE] Stripe non configuré en local')
    return NextResponse.json({ received: true })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook invalide' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('❌ Erreur webhook:', err.message)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const plan = session.metadata?.plan
    const email = session.customer_email

    console.log(`[STRIPE] Paiement réussi: ${email} → plan ${plan}`)

    // TODO: Intégrer Supabase pour mettre à jour le plan utilisateur
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    console.log(`[STRIPE] Abonnement canceled: ${subscription.id}`)
  }

  return NextResponse.json({ received: true })
}