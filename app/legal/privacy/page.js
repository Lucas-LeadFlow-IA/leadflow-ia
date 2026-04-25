export const metadata = {
  title: 'Politique de confidentialité - LeadFlow IA',
  description: 'Politique de confidentialité et protection des données personnelles LeadFlow IA',
}

export const viewport = 'width=device-width, initial-scale=1'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8 text-gray-300">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Politique de confidentialité</h1>
        <p className="mb-6">Dernière mise à jour : 22 avril 2026</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Responsable du traitement</h2>
        <p className="mb-4">LeadFlow IA, exploité par [Nom de l'entreprise], est responsable du traitement de vos données personnelles.</p>
        <p className="mb-6">Contact : contact@leadflow.io</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Données collectées</h2>
        <p className="mb-4">Nous collectons les données suivantes :</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Informations de compte : email, nom, mot de passe chiffré</li>
          <li>Informations d&apos;entreprise : nom de société (optionnel)</li>
          <li>Données d&apos;utilisation : requêtes IA, historique, contacts CRM</li>
          <li>Données de paiement : gérées par Stripe (nous ne stockons pas vos coordonnées bancaires)</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Finalités du traitement</h2>
        <p className="mb-4">Vos données sont utilisées pour :</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Fournir et améliorer nos services IA</li>
          <li>Gérer votre compte et vos abonnements</li>
          <li>Envoyer des emails transactionnels (confirmation, rappel)</li>
          <li>Analyser l&apos;utilisation pour optimiser le service</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Cookies</h2>
        <p className="mb-4">Nous utilisons des cookies essentiels pour :</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Authentification et sécurité</li>
          <li>Préférences utilisateur (thème clair/foncé)</li>
          <li>Stockage local pour l&apos;expérience utilisateur</li>
        </ul>
        <p className="mb-4">Nous ne utilisons pas de cookies de tracking tiers ni de publicité.</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Partage avec des tiers</h2>
        <p className="mb-4">Vos données peuvent être transmises à :</p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Stripe</strong> : pour le traitement des paiements (leurs conditions s&apos;appliquent)</li>
          <li><strong>Groq</strong> : pour le traitement des requêtes IA (traitées de manière anonyme)</li>
          <li><strong>Supabase</strong> : pour l&apos;hébergement de nos données (UE)</li>
        </ul>
        <p className="mb-4">Nous ne vendons jamais vos données personnelles.</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Durée de conservation</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>Données de compte : durée de l&apos;abonnement + 2 ans</li>
          <li>Données d&apos;utilisation : 12 mois</li>
          <li>Données de paiement : durée légale obligatoire (10 ans)</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Vos droits RGPD</h2>
        <p className="mb-4">Vous disposez des droits suivants :</p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données</li>
          <li><strong>Droit de rectification</strong> : corriger vos données inexactes</li>
          <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de vos données</li>
          <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
          <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement</li>
        </ul>
        <p className="mb-6">Pour exercer vos droits, contactez-nous à : contact@leadflow.io</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Sécurité</h2>
        <p className="mb-4">Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Modifications</h2>
        <p className="mb-6">Nous pouvons mettre à jour cette politique périodiquement. Les modifications significatives vous seront notifiées par email.</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Contact</h2>
        <p>Pour toute question concernant cette politique :</p>
        <p className="mt-2">Email : contact@leadflow.io</p>
        <p className="mt-2">Délégué à la protection des données : dpo@leadflow.io</p>
      </div>
    </div>
  )
}