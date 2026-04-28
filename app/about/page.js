"use client"

import Link from 'next/link'
import { Zap, MapPin, Mail, Phone, Building2, Shield, CheckCircle2 } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-violet-400 mb-12 hover:text-violet-300">
          ← Retour
        </Link>

        <h1 className="text-4xl font-bold mb-8">À propos de LeadFlow IA</h1>

        <div className="space-y-12 text-gray-400">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Notre mission</h2>
            <p className="text-lg leading-relaxed">
              LeadFlow IA aide les commerciaux B2B à vendre plus en utilisant l'intelligence artificielle.
              Nous avons créé la plateforme la plus complète pour qualifier les prospects, générer des emails personnalisés
              et closez plus de deals.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">L'équipe</h2>
            <p className="mb-6">
              LeadFlow IA est développé par une équipe de experts en vente B2B et en intelligence artificielle.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Lucas Legrand', role: 'Fondateur & CEO', desc: '10 ans d\'expérience en vente B2B' },
                { name: 'Équipe IA', role: 'R&D', desc: 'Experts en LLM et NLP' },
                { name: 'Support Client', role: 'Success', desc: 'Disponible 24/7' },
              ].map((member) => (
                <div key={member.name} className="p-6 rounded-2xl bg-white/5">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl font-bold mb-4">
                    {member.name[0]}
                  </div>
                  <h3 className="text-white font-bold mb-1">{member.name}</h3>
                  <p className="text-violet-400 text-sm mb-3">{member.role}</p>
                  <p className="text-sm">{member.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Nos valeurs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Transparence', desc: 'Prix clairs, pas de frais cachés' },
                { title: 'Innovation', desc: 'Toujours à la pointe de l\'IA' },
                { title: 'Résultats', desc: 'Focus sur votre ROI' },
                { title: 'Support', desc: 'Accompagnement personnalisé' },
              ].map((value) => (
                <div key={value.title} className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold">{value.title}</p>
                    <p className="text-sm">{value.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact</h2>
            <div className="space-y-3">
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-violet-400" /> contact@leadflow.io</p>
              <p className="flex items-center gap-2"><Building2 className="w-4 h-4 text-violet-400" /> France</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Garanties</h2>
            <div className="space-y-3">
              {[
                '30 jours satisfait ou remboursé',
                'Données sécurisées (RGPD)',
                'Annulation en 1 clic',
                'Support prioritaire pour les plans Pro+',
              ].map((g) => (
                <div key={g} className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>{g}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}