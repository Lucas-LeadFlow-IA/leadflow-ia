"use client"

import Link from 'next/link'
import { Zap, Cookie, Shield, Settings } from 'lucide-react'

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-violet-400 mb-8">
          ← Retour
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Politique de cookies</h1>
        
        <div className="space-y-8 text-gray-400">
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Qu'est-ce qu'un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d'un site web.
              Il permet de mémoriser des informations relatives à votre navigation.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Cookies utilisés</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5">
                <h3 className="text-white font-semibold mb-2">Essentiels</h3>
                <p>Necessaires au fonctionnement du site (authentification,	session).</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <h3 className="text-white font-semibold mb-2">Analytiques</h3>
                <p>Google Analytics pour mesurer l'audience (anonymisé).</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <h3 className="text-white font-semibold mb-2">Fonctionnels</h3>
                <p>Préférences utilisateur (thème, langue).</p>
              </div>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Gestion des cookies</h2>
            <p>
              Vous pouvez configurer votre navigateur pour refuser les cookies.
              Cependant, certaines fonctionnalités du site pourraient être limitées.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Plus d'informations</h2>
            <p>
              Pour toute question : <a href="mailto:contact@leadflow.io" className="text-violet-400">contact@leadflow.io</a>
            </p>
          </section>
          
          <p className="text-sm pt-8 border-t border-white/10">
            Dernière mise à jour : Avril 2026
          </p>
        </div>
      </div>
    </div>
  )
}