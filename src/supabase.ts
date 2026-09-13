import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  supabaseUrl && publishableKey
    ? createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function getRandomMemeMasterGif(excludeUrl?: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from('meme-master')
    .list('gifs', { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });

  if (error) throw error;

  const paths = (data ?? [])
    .filter(file => /\.(gif|webp)$/i.test(file.name))
    .map(file => `gifs/${file.name}`);

  if (!paths.length) return null;

  const alternatives = excludeUrl
    ? paths.filter(path => !excludeUrl.includes(encodeURIComponent(path)) && !excludeUrl.endsWith(path))
    : paths;
  const choices = alternatives.length ? alternatives : paths;
  const path = choices[Math.floor(Math.random() * choices.length)];

  return supabase.storage.from('meme-master').getPublicUrl(path).data.publicUrl;
}
