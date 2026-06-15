import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string) => {
  const val = process.env[key];
  if (!val || val.includes('YOUR_')) return fallback;
  return val;
};

let supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder-project.supabase.co');
// 末尾に /rest/v1/ や /rest/v1 がついていたら自動で取り除く安全処理
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'placeholder-anon-key');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
