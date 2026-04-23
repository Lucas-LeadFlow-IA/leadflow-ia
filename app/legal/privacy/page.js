export const metadata = {
  title: 'Politique de confidentialité - LeadFlow IA',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8 text-gray-300">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Politique de confidentialité</h1>
        <p className="mb-6">Dernière mise à jour : 22 avril 2026</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Collecte des données</h2>
        <p className="mb-4">Nous collectons uniquement les données nécessaires à l'utilisation du service : email, nom, entreprise.</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Stockage et sécurité</h2>
        <p className="mb-4">Vos données sont stockées de manière sécurisée. Nous utilisons le chiffrement pour protéger vos informations.</p>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Vos droits RGPD</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l'oubli (suppression)</li>
          <li>Droit à la portabilité</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Contact</h2>
        <p>Contactez-nous à : contact@leadflow.io</p>
      </div>
    </div>
  )
}