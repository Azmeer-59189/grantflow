import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    storage: window.sessionStorage,
  }
})

// Upload a file to Supabase Storage and return public URL
export async function uploadFile(file, folder = 'pictures') {
  const fileExt = file.name.split('.').pop()
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36).substring(2)}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('grant-pictures')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('grant-pictures')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}