import { createClient } from '@supabase/supabase-js';

// Next.jsの仕様上、process.env.NEXT_PUBLIC_xxx は静的（ドット記法）に直接参照する必要があります。
// process.env[key] のような動的参照はブラウザ側で値を読み込めません。
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getValidValue = (val: string | undefined, fallback: string) => {
  if (!val || val.includes('YOUR_') || val === '') return fallback;
  return val;
};

let supabaseUrl = getValidValue(rawUrl, 'https://placeholder-project.supabase.co');
// 末尾の /rest/v1/ や /rest/v1 がついていたら自動で取り除く
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

const supabaseAnonKey = getValidValue(rawKey, 'placeholder-anon-key');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
