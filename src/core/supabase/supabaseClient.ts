import { createClient } from '@supabase/supabase-js'

import { SupabaseConfig } from './supabaseConfig'

export const supabase = createClient(
  SupabaseConfig.url,
  SupabaseConfig.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
