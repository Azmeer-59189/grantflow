import { useCallback, useEffect, useRef, useState } from 'react'

// The live rate is only a suggestion: users can always type the rate actually
// used, and a failed lookup never falls back to 1:1.
// source: 'usd' | 'loading' | 'live' | 'saved' | 'manual' | 'error'
export default function useExchangeRate() {
  const [state, setState] = useState({ input: '1', source: 'usd' })
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  const setRate = useCallback((input, source = 'manual') => {
    request.current?.abort()
    request.current = null
    setState({ input: String(input ?? ''), source })
  }, [])

  // Resolves to the new rate, or null if it failed or a newer request replaced it.
  const loadRate = useCallback(async currency => {
    request.current?.abort()
    if (!currency) {
      request.current = null
      setState({ input: '1', source: 'usd' })
      return 1
    }
    const controller = new AbortController()
    request.current = controller
    setState({ input: '', source: 'loading' })
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`, { signal: controller.signal })
      const data = await response.json()
      const rate = data?.rates?.USD
      if (!response.ok || !(rate > 0)) throw new Error('Exchange rate unavailable')
      if (request.current !== controller) return null
      setState({ input: String(rate), source: 'live' })
      return rate
    } catch {
      if (request.current !== controller) return null
      setState({ input: '', source: 'error' })
      return null
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [])

  const number = parseFloat(state.input)
  return { rate: number > 0 ? number : null, input: state.input, source: state.source, setRate, loadRate }
}
