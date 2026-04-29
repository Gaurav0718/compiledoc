import { createClient } from '@supabase/supabase-js';

const URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const ANON = import.meta.env.VITE_SUPABASE_ANON || '';

export const supabase     = URL && ANON ? createClient(URL, ANON) : null;
export const isConfigured = () => !!(URL && ANON);

// Safe wrapper — always returns { data, error }
export async function sb(fn) {
  if (!supabase) return { data: null, error: { message: 'offline' } };
  try   { return await fn(supabase); }
  catch (e) { return { data: null, error: e }; }
}
