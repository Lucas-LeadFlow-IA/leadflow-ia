// Configuration Supabase optionnelle
// Pour activer : npm install @supabase/supabase-js et configurer .env.local

let supabase = null

if (typeof window !== 'undefined') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    import('@supabase/supabase-js').then(({ createClient }) => {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }).catch(() => {
      console.log('Supabase non configuré - utilisation localStorage')
    })
  }
}

export { supabase }