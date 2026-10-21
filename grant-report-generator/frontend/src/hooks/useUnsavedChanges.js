import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'

export default function useUnsavedChanges(form, enabled = true) {
  const [baseline, setBaseline] = useState(() => JSON.stringify(form))
  const saved = useRef(false)
  const dirty = enabled && JSON.stringify(form) !== baseline
  const blocker = useBlocker(() => dirty && !saved.current)
  useEffect(() => {
    if (!dirty) return
    const unload = event => {
      if (saved.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [dirty])
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  const updateBaseline = useCallback(value => { saved.current = false; setBaseline(JSON.stringify(value)) }, [])
  return {
    dirty,
    setBaseline: updateBaseline,
    markSaved: () => { saved.current = true },
  }
}
