import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string) => {
  const val = process.env[key];
  if (!val || val.includes('YOUR_')) return fallback;
  return val;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder-project.supabase.co');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'placeholder-anon-key');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
