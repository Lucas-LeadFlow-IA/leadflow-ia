// Input sanitization utilities

// Nettoyer une chaîne de caractères
export function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return ''
  
  return str
    .slice(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim()
}

// Valider email
export function isValidEmail(email) {
  if (typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.toLowerCase().slice(0, 254))
}

// Nettoyer un objet de données utilisateur
export function sanitizeUserData(data) {
  if (!data || typeof data !== 'object') return {}
  
  return {
    name: sanitizeString(data.name, 100),
    email: isValidEmail(data.email) ? data.email.toLowerCase().slice(0, 254) : '',
    empresa: sanitizeString(data.company || data.entreprise, 200),
    fonction: sanitizeString(data.position || data.fonction, 100),
  }
}

// Nettoyer les données pour l'IA
export function sanitizeAIData(data) {
  if (!data || typeof data !== 'object') return {}
  
  const cleaned = {}
  const allowedFields = [
    'prenom', 'nom', 'name', 'firstName', 'lastName',
    'fonction', 'position', 'role',
    'entreprise', 'company', 'enterprise',
    'budget', 'budgetMax',
    'besoin', 'need', 'notes', 'description',
    'tel', 'phone', 'telephone',
    'email', 'mail'
  ]
  
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      cleaned[key] = sanitizeString(data[key], 500)
    }
  }
  
  return cleaned
}

// Valider le plan
export function isValidPlan(plan) {
  return ['free', 'pro', 'agency'].includes(plan)
}

// Valider le plan de facturation
export function isValidBilling(billing) {
  return ['monthly', 'yearly'].includes(billing)
}