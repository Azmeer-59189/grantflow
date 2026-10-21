const HINTS = {
  loading: ['text-slate-500', 'Fetching today\'s rate...'],
  live: ['text-amber-700', 'Today\'s market rate. Replace it with the rate on the payment date if different.'],
  saved: ['text-slate-500', 'Rate used when this grant was saved.'],
  manual: ['text-slate-500', 'Entered manually.'],
  error: ['text-rose-700', 'Could not fetch a rate. Enter it to calculate USD amounts.'],
}

export default function ExchangeRateField({ currency, fx, onChange }) {
  if (!currency) return null
  const [tone, hint] = HINTS[fx.source] || HINTS.manual
  return (
    <div>
      <label htmlFor="exchange_rate" className="block text-sm font-medium text-gray-700 mb-1">
        Exchange rate (1 {currency} = ? USD) <span className="text-red-500">*</span>
      </label>
      <input
        id="exchange_rate" type="number" min="0" step="any" inputMode="decimal"
        value={fx.input} onChange={event => onChange(event.target.value)}
        disabled={fx.source === 'loading'} aria-invalid={!fx.rate}
        aria-describedby="exchange_rate_hint"
        className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fx.rate ? 'border-gray-300' : 'border-rose-400'}`}
      />
      <p id="exchange_rate_hint" className={`mt-1 text-xs ${tone}`}>{hint}</p>
    </div>
  )
}
