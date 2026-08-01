import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zxuiybythajwdoijdakt.supabase.co';

// Get key from environment variable or localStorage fallback
export function getStoredAnonKey(): string {
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envKey && envKey !== 'YOUR_SUPABASE_ANON_KEY') {
    return envKey;
  }
  const localKey = localStorage.getItem('supabase_anon_key');
  if (localKey) {
    return localKey;
  }
  return '';
}

export function setStoredAnonKey(key: string) {
  if (key) {
    localStorage.setItem('supabase_anon_key', key.trim());
  } else {
    localStorage.removeItem('supabase_anon_key');
  }
}

const initialKey = getStoredAnonKey() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(SUPABASE_URL, initialKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const PROJECT_URL = SUPABASE_URL;
