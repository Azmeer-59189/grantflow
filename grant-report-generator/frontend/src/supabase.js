import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
  }
})

const BUCKET = 'grant-pictures'

// Keep in sync with allowed_mime_types in migrations/20261022_safe_writes_uploads.sql,
// which Storage enforces. The extension comes from the type, not the file name.
export const UPLOAD_TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Upload a file to Supabase Storage and return its public URL and storage path
export async function uploadFile(file, folder = 'pictures') {
  const fileExt = UPLOAD_TYPES[file.type]
  if (!fileExt) throw new Error('Upload an image, PDF, Word or Excel file.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File too large. Max 10MB.')
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return { url: urlData.publicUrl, path }
}

export async function deleteUploads(paths) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}
