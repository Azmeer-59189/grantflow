import { useCallback, useEffect, useMemo, useRef } from 'react'
import { deleteUploads } from '../supabase'

function discardQuietly(paths) {
  deleteUploads(paths).catch(error => console.warn('Could not remove unused upload', error))
}

// Tracks files uploaded on this page that are not saved to a grant yet.
// They are deleted when replaced, removed, or when the page is left unsaved.
// Files that were already saved on the grant are never deleted from here.
export default function useUploadCleanup() {
  const pending = useRef(new Map())  // url -> storage path

  useEffect(() => {
    const uploads = pending.current
    return () => {
      discardQuietly([...uploads.values()])
      uploads.clear()
    }
  }, [])

  const track = useCallback((url, path) => { pending.current.set(url, path) }, [])
  const discard = useCallback(url => {
    const path = pending.current.get(url)
    if (!path) return
    pending.current.delete(url)
    discardQuietly([path])
  }, [])
  // Call after a successful save: the files now belong to the grant.
  const commit = useCallback(() => { pending.current.clear() }, [])

  return useMemo(() => ({ track, discard, commit }), [track, discard, commit])
}
