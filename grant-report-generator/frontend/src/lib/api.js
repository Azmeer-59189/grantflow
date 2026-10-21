import { supabase } from '../supabase'

export async function apiFetch(url, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) throw new Error('Please sign in to continue.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(url, { ...options, headers })
}
