import './globals.css'
import { ThemeProvider } from '@/lib/theme-provider'
import { StoreProvider } from '@/lib/store-provider'
import { Toaster } from 'react-hot-toast'

export const viewport = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://leadflow.io'),
  title: 'LeadFlow IA Pro — Closez 3x plus de deals avec l\'IA',
  description: 'Qualification BANT, emails percutants, scripts d\'appel et closing IA en 30 secondes. L\'outil de sales automation préféré des commerciaux B2B.',
  keywords: 'sales automation, IA commerciale, qualification leads, BANT, cold email, CRM, prospection B2B, commercial B2B',
  openGraph: {
    title: 'LeadFlow IA Pro',
    description: 'Closez 3x plus de deals avec l\'IA — 12 modules sales automation',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://leadflow.io',
    siteName: 'LeadFlow IA',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LeadFlow IA Pro',
    description: 'Closez 3x plus de deals avec l\'IA',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <StoreProvider>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#12121a',
                  color: '#e2e8f0',
                  border: '1px solid #6366f1',
                  borderRadius: '12px',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#12121a',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#12121a',
                  },
                },
              }}
            />
            {children}
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
