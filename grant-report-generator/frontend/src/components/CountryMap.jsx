import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Map geometry names -> our country names
const GEO_NAME_MAP = {
  'United States of America': 'United States',
  'United Kingdom': 'United Kingdom',
  'Germany': 'Germany',
  'Switzerland': 'Switzerland',
  'United Arab Emirates': 'UAE',
  'Canada': 'Canada',
}

// Sequential: one hue (brand ramp), light -> dark = less -> more grant value.
const STEPS = ['#cfd3ff', '#aeb5fc', '#8991f4', '#595bd0', '#403e94']
const NO_DATA = '#eef0f4'
const fullUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function fillFor(value, max) {
  if (!value) return NO_DATA
  return STEPS[Math.min(STEPS.length - 1, Math.floor((value / max) * STEPS.length))]
}

// `rows` come from valueByCountry(): { country, value, count }.
export default function CountryMap({ rows }) {
  const byCountry = Object.fromEntries(rows.map(row => [row.country, row]))
  const max = Math.max(...rows.map(row => row.value), 1)
  const [position, setPosition] = useState({ coordinates: [10, 30], zoom: 1 })
  const [active, setActive] = useState(null)
  const shown = active && byCountry[active]

  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-50/50" style={{ height: 320 }}>
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 120, center: [10, 30] }}
                     style={{ width: '100%', height: '100%' }} aria-label="Map of grant value by country">
        <ZoomableGroup zoom={position.zoom} center={position.coordinates} minZoom={0.8} maxZoom={8}
                       onMoveEnd={({ coordinates, zoom }) => setPosition({ coordinates, zoom })}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) => geographies.map(geo => {
              const name = GEO_NAME_MAP[geo.properties.name]
              const row = name && byCountry[name]
              const fill = row ? fillFor(row.value, max) : NO_DATA
              const interactive = Boolean(row)
              return (
                <Geography
                  key={geo.rsmKey} geography={geo} fill={fill} stroke="#ffffff" strokeWidth={0.6}
                  tabIndex={interactive ? 0 : -1}
                  aria-label={interactive ? `${name}: ${fullUsd.format(row.value)}, ${row.count} grants` : undefined}
                  onMouseEnter={() => interactive && setActive(name)}
                  onMouseLeave={() => interactive && setActive(null)}
                  onFocus={() => interactive && setActive(name)}
                  onBlur={() => interactive && setActive(null)}
                  onClick={() => interactive && setActive(current => (current === name ? null : name))}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: interactive ? '#24234c' : NO_DATA, cursor: interactive ? 'pointer' : 'default' },
                    pressed: { outline: 'none' },
                  }}
                />
              )
            })}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {shown ? (
        <div role="status" className="pointer-events-none absolute right-3 top-3 min-w-48 rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-lg">
          <p className="mb-1 text-sm font-semibold text-slate-900">{active}</p>
          <p className="flex justify-between gap-4 text-slate-600"><span>Grant value</span><span className="font-semibold tabular-nums text-slate-900">{fullUsd.format(shown.value)}</span></p>
          <p className="flex justify-between gap-4 text-slate-600"><span>Grants</span><span className="tabular-nums text-slate-900">{shown.count}</span></p>
        </div>
      ) : (
        <p className="pointer-events-none absolute right-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] text-slate-500">Tap or hover a country · scroll to zoom</p>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] text-slate-500">
        <span>Less</span>
        {STEPS.map(color => <span key={color} className="h-2.5 w-5 rounded-sm" style={{ background: color }} />)}
        <span>More</span>
      </div>
      <button type="button" onClick={() => setPosition({ coordinates: [10, 30], zoom: 1 })}
              className="absolute bottom-3 right-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
        Reset view
      </button>
    </div>
  )
}
