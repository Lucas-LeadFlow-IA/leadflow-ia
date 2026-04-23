// Template de configuration Supabase
// Pour activer Supabase :
// 1. Créer un projet sur supabase.com
// 2. npm install @supabase/supabase-js
// 3. Remplir les variables d'environnement
// 4. Créer les tables dans le dashboard Supabase

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Instructions pour créer les tables dans Supabase :
/*
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'free',
  requests_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  module_id TEXT NOT NULL,
  input_data JSONB,
  result TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  email TEXT,
  company TEXT,
  position TEXT,
  status TEXT DEFAULT 'lead',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE saved_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  module_id TEXT,
  name TEXT,
  result TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
*/

// Fonctions helper pour remplacer Zustand
export const db = {
  // Users
  async getUser(email) {
    if (!supabase) return null
    const { data } = await supabase.from('users').select('*').eq('email', email).single()
    return data
  },
  
  async createUser(email, name) {
    if (!supabase) return null
    const { data, error } = await supabase.from('users').insert({ email, name }).select().single()
    return { data, error }
  },
  
  // History
  async addHistory(userId, moduleId, inputData, result) {
    if (!supabase) return null
    const { data, error } = await supabase.from('history').insert({
      user_id: userId,
      module_id: moduleId,
      input_data: inputData,
      result
    }).select().single()
    return { data, error }
  },
  
  async getHistory(userId) {
    if (!supabase) return []
    const { data } = await supabase.from('history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return data || []
  },
  
  // Contacts
  async addContact(userId, contact) {
    if (!supabase) return null
    const { data, error } = await supabase.from('contacts').insert({
      user_id: userId,
      ...contact
    }).select().single()
    return { data, error }
  },
  
  // Saved Results
  async saveResult(userId, moduleId, name, result) {
    if (!supabase) return null
    const { data, error } = await supabase.from('saved_results').insert({
      user_id: userId,
      module_id: moduleId,
      name,
      result
    }).select().single()
    return { data, error }
  }
}