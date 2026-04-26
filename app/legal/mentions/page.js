"use client"

import { Zap, Mail, MapPin, Building2, Shield, FileText } from 'lucide-react'
import Link from 'next/link'

export default function MentionsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-violet-400 mb-8">
          ← Retour
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>
        
        <div className="space-y-8 text-gray-400">
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Éditrice du service</h2>
            <p className="mb-4">
              LeadFlow IA Pro est un service SaaS (Software as a Service) édité par :
            </p>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-white font-semibold">LeadFlow IA</p>
              <p>France</p>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Hébergement</h2>
            <p className="mb-4">
              Le service est hébergé par Vercel Inc., une plateforme cloud américaine :
            </p>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-white font-semibold">Vercel Inc.</p>
              <p>340 Pine Street Suite 701</p>
              <p>San Francisco, CA 94104, USA</p>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Propriété intellectuelle</h2>
            <p>
              Tous les contenus, graphiques, logos et код sources présents sur LeadFlow IA Pro sont protégés par les droits de propriété intellectuelle.
              Toute reproduction ou utilisation non autorisée est interdite.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Responsabilité</h2>
            <p>
              Les résultats générés par l'intelligence artificielle sont fournis à titre indicatif.
              Ils ne constituent pas un conseil commercial, juridique ou financier.
              L'utilisateur reste responsable de l'utilisation qu'il fait des contenus générés.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Contact</h2>
            <p>
              Pour toute question relative aux mentions légales : 
              <a href="mailto:contact@leadflow.io" className="text-violet-400 ml-2">contact@leadflow.io</a>
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