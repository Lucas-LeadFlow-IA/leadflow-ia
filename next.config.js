/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['zustand'],
  },
  
  // Configuration pour nom de domaine personnalisé
  // Pour deploiement sur Vercel:
  // 1. Allez sur vercel.com
  // 2. Settings > Domains
  // 3. Ajoutez votre domaine (ex: leadflow.io)
  // 4. Les reglages ci-dessous s'appliqueront automatiquement
  
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
  
  // Pour config domaine externe (remplacez votre-domaine.com):
  // async headers() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  //         { key: 'X-Content-Type-Options', value: 'nosniff' },
  //       ],
  //     },
  //   ]
  // }
}

module.exports = nextConfig