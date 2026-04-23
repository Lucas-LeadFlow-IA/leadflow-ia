import { NextResponse } from 'next/server'
import { MODULES, getAllModules } from '@/lib/modules'

const GROQ_API_KEY = process.env.GROQ_API_KEY

const MODEL_BY_MODULE = {
  bant: 'llama-3.1-8b-instant',
  email: 'llama-3.1-8b-instant',
  crm: 'llama-3.1-8b-instant',
  roi: 'llama-3.1-8b-instant',
  proposal: 'llama-3.3-70b-versatile',
  competitor: 'llama-3.3-70b-versatile',
  sequence: 'llama-3.3-70b-versatile',
  script: 'llama-3.3-70b-versatile',
  deal: 'llama-3.1-70b-versatile',
  objection: 'llama-3.3-70b-versatile',
  linkedin: 'llama-3.3-70b-versatile',
  company: 'llama-3.3-70b-versatile',
}

const OUTPUT_FORMATS = {
  bant: `Tu es un expert commercial B2B. Analyse ce prospect avec la méthode BANT.
Réponds UNIQUEMENT avec ce format lisible (pas de JSON):

📊 SCORE GLOBAL: [X]/100

🎯 DÉTAILS:
• Budget: [X]/25 - [explication]
• Autorité: [X]/25 - [explication]
• Besoin: [X]/25 - [explication]
• Timing: [X]/25 - [explication]

💡 RECOMMANDATION: [Accepter/Rejeter/Qualifier]

🔑 POINTS CLÉS:
1. [Point clé 1]
2. [Point clé 2]
3. [Point clé 3]

⚡ ACTION: [Action immédiate à faire]`,

  email: `Tu es un expert en rédaction d'emails B2B.
Format exact:

OBJET: [Sujet - max 60 caractères]

[Corps email 80-120 mots, 1 CTA clair]

—
[Signature]`,

  linkedin: `Expert prospection LinkedIn. Format:

🔗 PROFIL: [URL LinkedIn]
📝 RÉSUMÉ: [2-3 phrases]
🎯 CONNEXIONS: [Points de contact]
💡 CONSEIL: [Comment l'approcher]`,

  company: `Expert veille entreprise. Format:

🏢 PRÉSENTATION: [3 phrases]
📈 SECTEUR: [Secteur]
👥 TAILLE: [Effectif]
📰 ACTUALITÉS: [News récentes]
🎯 DÉFIS: [Challenges]
💼 OPPORTUNITÉS: [Comment les aider]`,

  script: `Expert cold calling. Format:

⏱️ [X] min

📞 SCRIPT:
[00:00] ACCROCHE: [Phrase]
[00:30] PRÉAMBULE: [Contexte]
[01:00] Q1: [Question]
[02:00] Q2: [Question]
[03:00] PRÉSENTATION: [30s]
[04:00] OBJECTIONS: [Réponses]
[04:30] CLOSING: [Prochaine étape]`,

  sequence: `Expert email automation. 5 emails:

📧 EMAIL 1 - Jour 0:
Objet: [Sujet]
Corps: [~100 mots]
CTA: [Action]

📧 EMAIL 2 - Jour 3:
[idem]

📧 EMAIL 3 - Jour 7:
[idem]

📧 EMAIL 4 - Jour 14:
[idem]

📧 EMAIL 5 - Jour 21:
[idem]`,

  objection: `Expert closing. Format:

🤔 COMPRENDRE: [Objection]
💡 REFAME: [Reformulation]
✅ RÉPONSE: [2-3 phrases]
❓ REBOND: [Question]
🎯 CLOSING: [Technique]`,

  roi: `Expert finance. Format:

💰 RÉSULTATS:
• Temps économisé/mois: [X]h
• Économie annuelle: [X]€
• ROI: [X]%
• Payback: [X] mois

💡 ARGUMENT: [Phrase clé]`,

  crm: `Expert CRM. Format:

📋 FICHE CONTACT
Nom: [Prénom Nom]
Fonction: [Fonction]
Entreprise: [Entreprise]
Email: [Email]
Tel: [Téléphone]
Statut: [Statut]
Source: [Source]
Notes: [Notes]`,

  deal: `Expert prédictif. Format:

🎯 PROBABILITÉ: [X]%
✅ POUR: [Facteurs]
❌ CONTRE: [Facteurs]
⚠️ ALERTES: [Points]
📅 DATE: [Estimation]`,

  competitor: `Expert analyse concurrentielle. Format:

🏆 vs [Concurrent]
✅ VOS AVANTAGES: [Liste]
❌ LEURS POINTS FORTS: [Liste]
💰 PRIX: [Comparaison]
🎯 ARGUMENTS: [3 points]`,

  proposal: `Expert propositions commerciales. Format:

# PROPOSITION - [Entreprise]
📋 RÉSUMÉ: [3 lignes]
🎯 BESOIN: [Description]
💡 SOLUTION: [Votre solution]
💰 PRIX: [X]€
⏰ VALIDITÉ: [X] jours
👉 ÉTAPE: [Prochaine étape]`
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(request) {
  // 1.1 - Vérification clé API
  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY manquante dans .env.local')
    return NextResponse.json({ error: 'Configuration API manquante. Ajoutez votre clé Groq dans .env.local' }, { status: 500 })
  }

  try {
    const { moduleId, data } = await request.json()
    
    const allModules = [...(MODULES.free || []), ...(MODULES.premium || [])]
    const module = allModules.find(m => m.id === moduleId)
    if (!module) {
      return NextResponse.json({ error: 'Module non trouvé' }, { status: 404 })
    }

    const formatPrompt = OUTPUT_FORMATS[moduleId] || ''
    const userPrompt = module.fields?.map(inp => `${inp.label}: ${data[inp.name] || 'Non fourni'}`).join('\n') || ''
    
    const fullPrompt = `${formatPrompt}

DONNEES DU PROSPECT:
${userPrompt}

REGGLES ABSOLUES:
- Reponds UNIQUEMENT en francais
- Suis EXACTEMENT le format ci-dessus, section par section
- Sois precis, professionnel, concis
- N'invente pas de donnees manquantes, indique "Non-renseigne"
- Pas de preamble, pas de conclusion, juste le format demande`

    const isStreaming = request.headers.get('Accept') === 'text/event-stream'
    
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL_BY_MODULE[moduleId] || 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert commercial B2B francophone. Tu génères des contenus professionnels, lisibles, structurés en français. Réponds TOUJOURS en français strict (pas d\'anglicismes inutiles), sans JSON, sans balises de code, sans préambule. Suis exactement le format demandé. Sois concis et persuasif.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        stream: isStreaming
      })
    }
    
    const response = await fetch(GROQ_API_URL, fetchOptions)

    // 1.6 - Gestion erreurs détaillée
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Groq API error:', response.status, errorData)
      
      if (response.status === 429) {
        return NextResponse.json({ error: 'Limite API atteinte. Reessayez dans quelques secondes.' }, { status: 429 })
      }
      if (response.status === 401) {
        return NextResponse.json({ error: 'Cle API invalide. Verifiez votre .env.local' }, { status: 401 })
      }
      return NextResponse.json({ error: `Erreur IA (${response.status})` }, { status: 500 })
    }

    // Streaming response
    if (isStreaming) {
      const stream = response.body
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }

    const result = await response.json()
    const generatedText = result.choices?.[0]?.message?.content || 'Aucun	resultat'

    return NextResponse.json({ result: generatedText })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Erreur serveur: ' + error.message }, { status: 500 })
  }
}