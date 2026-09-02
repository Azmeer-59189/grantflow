import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts'

// Color constants matching the reference design
const COLORS = {
  navy: '#08325C',
  blue: '#0B4C8C',
  amber: '#E8A916',
  red: '#C0272D',
  green: '#1D6FB8',
  muted: '#5B6B82',
}

function Dashboard({ session }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGrant, setSelectedGrant] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [detailGrant, setDetailGrant] = useState(null)
  const [selectedSections, setSelectedSections] = useState({
    overview: true,
    financial: true,
    dates: true,
    shipping: true,
    grn: true,
    location: true,
    item: true,
    pictures: true,
    report: true,
  })
  const [activeNav, setActiveNav] = useState('dashboard')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterReport, setFilterReport] = useState('')
  const [filterShipping, setFilterShipping] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  useEffect(() => { fetchGrants() }, [])

  async function fetchGrants() {
    try {
      setLoading(true)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/grants`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.detail || 'Failed to load')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

    async function downloadReport(grantNumber, format) {
    setReportLoading(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reports/${format}/${grantNumber}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: selectedSections }),
        }
      )
      if (!response.ok) throw new Error('Report generation failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grant-${grantNumber}.${format === 'pdf' ? 'pdf' : 'docx'}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Could not generate report: ' + err.message)
    } finally {
      setReportLoading(false)
    }
  }

  function pillColor(value) {
    const green = ['Paid', 'Submitted', 'Received']
    const red = ['Overdue', 'Discrepancy', 'Not Received']
    if (green.includes(value)) return 'bg-blue-100 text-blue-700'
    if (red.includes(value)) return 'bg-red-100 text-red-700'
    return 'bg-amber-100 text-amber-700'
  }

  // Calculate chart data from grants
  function getReportStatusData() {
      if (!data?.grants) return []
      const counts = { 'Report Complete': 0, 'Pending': 0 }
      data.grants.forEach(g => {
        if (counts[g.report_status] !== undefined) counts[g.report_status]++
      })
      return [
        { name: 'Report Complete', value: counts['Report Complete'] },
        { name: 'Pending', value: counts['Pending'] },
      ].filter(d => d.value > 0)
    }

  function getPaymentStatusData() {
      if (!data?.grants) return []
      const counts = { Complete: 0, Pending: 0, Partial: 0 }
      data.grants.forEach(g => {
        if (counts[g.payment_status] !== undefined) counts[g.payment_status]++
      })
      return [
        { name: 'Complete', value: counts.Complete },
        { name: 'Pending', value: counts.Pending },
        { name: 'Partial', value: counts.Partial },
      ].filter(d => d.value > 0)
    }

  function getShippingData() {
      if (!data?.grants) return []
      const counts = {
        'Received': 0,
        'Not received': 0,
        'Received with discrepancy': 0,
        'Received with comments': 0,
        'Partial shipment documents': 0,
        'Not required': 0,
        'Not applicable': 0,
      }
      data.grants.forEach(g => {
        const status = g.shipping_documents_status
        if (status && counts[status] !== undefined) counts[status]++
      })
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .filter(d => d.value > 0)
    }

  // Grants with shipping discrepancies for alert box
  function getDiscrepancies() {
      if (!data?.grants) return []
      return data.grants.filter(g =>
        g.shipping_documents_status === 'Received with discrepancy'
      )
    }

  const reportStatusData = getReportStatusData()
  const paymentStatusData = getPaymentStatusData()
  const shippingData = getShippingData()
  const discrepancies = getDiscrepancies()

  const PIE_COLORS_REPORT = [COLORS.green, COLORS.amber, COLORS.red]
  const PIE_COLORS_PAYMENT = [COLORS.green, COLORS.amber, COLORS.blue]
  const BAR_COLORS_SHIPPING = [COLORS.green, COLORS.amber, COLORS.red]

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col"
           style={{ background: '#08325C' }}>

        {/* Brand */}
        <div className="px-5 py-6 border-b border-white border-opacity-10">
          <div className="text-white font-semibold text-base leading-tight">
            Grant Utilization<br />Ledger
          </div>
          <div className="text-xs mt-1" style={{ color: '#B9C9C4' }}>
            IHHN · FOIH
          </div>
        </div>

        {/* Nav items */}
        <nav className="mt-3 flex-1">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'records', label: 'Records' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
            className={`w-full text-left px-5 py-3 text-sm font-medium
                        flex items-center gap-2 transition
                        ${activeNav === item.id
                          ? 'text-white border-l-4 border-yellow-400'
                          : 'text-gray-300 border-l-4 border-transparent hover:text-white'
                        }`}
            style={{ background: activeNav === item.id ? 'rgba(255,255,255,0.08)' : 'transparent' }}

            >
              ◆ {item.label}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 text-xs border-t border-white border-opacity-10"
             style={{ color: '#8FA39D' }}>
          {session.user.email}
          <button
            onClick={handleLogout}
            className="block mt-2 text-red-400 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 p-8 overflow-auto">

        {/* Dashboard View */}
        {activeNav === 'dashboard' && (
          <>
            {/* Page header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800"
                  style={{ fontFamily: 'Georgia, serif' }}>
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Grant utilization overview
              </p>
            </div>

            {loading && (
              <p className="text-gray-400 text-center py-12">
                Loading grants...
              </p>
            )}
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            {data && (
              <>
                {/* KPI Ribbon */}
                <div className="bg-white rounded-xl border border-gray-200
                                flex flex-wrap mb-6 overflow-hidden">
                  {[
                    {
                      label: 'TOTAL RECORDS',
                      value: data.total_grants,
                      color: 'text-gray-800'
                    },
                    {
                      label: 'PAYMENT MADE (USD)',
                      value: `$${data.total_paid_usd.toLocaleString()}`,
                      color: 'text-yellow-500'
                    },
                    {
                      label: 'TOTAL GRANT VALUE (USD)',
                      value: `$${data.total_grant_value_usd.toLocaleString()}`,
                      color: 'text-blue-700'
                    },
                    {
                      label: 'REPORTS PENDING',
                      value: data.pending_reports,
                      color: 'text-blue-700'
                    },
                    {
                      label: 'DISCREPANCIES',
                      value: data.shipping_issues,
                      color: 'text-red-600'
                    },
                  ].map((kpi, i) => (
                    <div key={i}
                         className="flex-1 min-w-36 px-6 py-5 border-r
                                    border-gray-100 last:border-r-0">
                      <div className="text-xs font-semibold text-gray-400
                                      tracking-widest uppercase mb-2">
                        {kpi.label}
                      </div>
                      <div className={`text-2xl font-bold font-mono ${kpi.color}`}>
                        {kpi.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Discrepancy Alert Box */}
                {discrepancies.length > 0 && (
                  <div className="rounded-xl border border-red-200 mb-6 p-5"
                       style={{ background: '#FEF2F2' }}>
                    <h3 className="text-xs font-bold text-red-600 uppercase
                                   tracking-widest mb-3">
                      ⚠ Shipping / Invoice Discrepancies
                    </h3>
                    {discrepancies.slice(0, 8).map((g, i) => (
                      <div key={i}
                           className="flex justify-between items-center
                                      py-2 border-t border-red-100 text-sm">
                        <span className="text-gray-700">
                          {g.grant_number} — {g.item}
                        </span>
                        <button
                          onClick={() => setSelectedGrant(g)}
                          className="text-xs font-semibold text-red-500
                                     hover:text-red-700 underline ml-4"
                        >
                          View
                        </button>
                      </div>
                    ))}
                    {discrepancies.length > 8 && (
                      <p className="text-xs text-red-400 mt-2">
                        + {discrepancies.length - 8} more discrepancies
                      </p>
                    )}
                  </div>
                )}

                {/* Charts Row */}
{/* Charts Row */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

  {/* Report Status Donut */}
  <div className="bg-white rounded-2xl border border-gray-100
                  shadow-sm p-6">
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-semibold text-gray-700 text-sm uppercase
                     tracking-wider">
        Report Status
      </h3>
      <span className="text-xs text-gray-400">
        {data.total_grants} total
      </span>
    </div>
    {reportStatusData.length === 0 ? (
      <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
        No data yet
      </div>
    ) : (
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={reportStatusData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {reportStatusData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={['#1D6FB8', '#E8A916'][index % 2]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '12px'
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: '12px', color: '#5B6B82' }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center
                        justify-center pointer-events-none"
             style={{ top: '-20px' }}>
          <span className="text-2xl font-bold text-gray-800">
            {reportStatusData.find(d => d.name === 'Report Complete')?.value || 0}
          </span>
          <span className="text-xs text-gray-400">Complete</span>
        </div>
      </div>
    )}
  </div>

  {/* Payment Status Donut */}
  <div className="bg-white rounded-2xl border border-gray-100
                  shadow-sm p-6">
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-semibold text-gray-700 text-sm uppercase
                     tracking-wider">
        Payment Status
      </h3>
      <span className="text-xs text-gray-400">
        {data.total_grants} total
      </span>
    </div>
    {paymentStatusData.length === 0 ? (
      <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
        No data yet
      </div>
    ) : (
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={paymentStatusData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {paymentStatusData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={['#1D6FB8', '#E8A916', '#C0272D'][index % 3]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '12px'
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: '12px', color: '#5B6B82' }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center
                        justify-center pointer-events-none"
             style={{ top: '-20px' }}>
          <span className="text-2xl font-bold text-gray-800">
            {paymentStatusData.find(d => d.name === 'Complete')?.value || 0}
          </span>
          <span className="text-xs text-gray-400">Complete</span>
        </div>
      </div>
    )}
  </div>
</div>

{/* Shipping Status Bar Chart */}
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
  <div className="flex justify-between items-center mb-4">
    <h3 className="font-semibold text-gray-700 text-sm uppercase
                   tracking-wider">
      Shipping Documents Status
    </h3>
    <span className="text-xs text-gray-400">by count</span>
  </div>
  {shippingData.length === 0 ? (
    <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
      No data yet
    </div>
  ) : (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={shippingData}
        margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
        barSize={36}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#5B6B82' }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#5B6B82' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '12px'
          }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          <LabelList
            dataKey="value"
            position="top"
            style={{ fontSize: '11px', fill: '#5B6B82', fontWeight: 600 }}
          />
          {shippingData.map((entry, index) => {
            const colorMap = {
              'Received': '#1D6FB8',
              'Not received': '#C0272D',
              'Received with discrepancy': '#C0272D',
              'Received with comments': '#E8A916',
              'Partial shipment documents': '#E8A916',
              'Not required': '#9CA3AF',
              'Not applicable': '#9CA3AF',
            }
            return (
              <Cell
                key={index}
                fill={colorMap[entry.name] || '#1D6FB8'}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )}
</div>

                {/* Shipping Status Bar Chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                  <h3 className="font-semibold text-gray-700 mb-4"
                      style={{ fontFamily: 'Georgia, serif' }}>
                    Shipping Status
                  </h3>
                  {shippingData.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">
                      No data yet
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={shippingData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {shippingData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={BAR_COLORS_SHIPPING[index % BAR_COLORS_SHIPPING.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Records View */}
        {activeNav === 'records' && (
          <>
            {/* Page header */}
            {/* Page header */}
            <div className="flex justify-between items-end mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: 'Georgia, serif' }}>
                  Records
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {data?.total_grants || 0} total grants
                </p>
              </div>
              <button
                onClick={() => navigate('/add-grant')}
                className="bg-blue-700 text-white text-sm px-4 py-2
                           rounded-lg hover:bg-blue-800 transition"
              >
                + Add Grant
              </button>
            </div>

            {/* Filters */}
            {data && (
              <div className="flex flex-wrap gap-3 mb-6">
                <select
                  value={filterRegion}
                  onChange={e => setFilterRegion(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2
                             text-sm text-gray-600 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All regions</option>
                  {['FOIH USA','IDF Canada','FOIH Germany',
                    'Indus Health UAE','FOIH Australia'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <select
                  value={filterDept}
                  onChange={e => setFilterDept(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2
                             text-sm text-gray-600 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All departments</option>
                  {[...new Set(data.grants.map(g => g.department).filter(Boolean))].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={filterPayment}
                  onChange={e => setFilterPayment(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2
                             text-sm text-gray-600 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All payment statuses</option>
                  {['Pending','Partial','Complete'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={filterReport}
                  onChange={e => setFilterReport(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2
                             text-sm text-gray-600 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All report statuses</option>
                  {['Pending','Report Complete'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={filterShipping}
                  onChange={e => setFilterShipping(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2
                             text-sm text-gray-600 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All shipping statuses</option>
                  {[
                    'Not received','Received','Received with discrepancy',
                    'Received with comments','Partial shipment documents',
                    'Not required','Not applicable'
                  ].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Search grant #, supplier, item..."
                  className="border border-gray-200 rounded-lg px-3 py-2
                             text-sm text-gray-500 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500 min-w-64"
                />

                {(filterRegion || filterDept || filterPayment ||
                  filterReport || filterShipping || filterSearch) && (
                  <button
                    onClick={() => {
                      setFilterRegion('')
                      setFilterDept('')
                      setFilterPayment('')
                      setFilterReport('')
                      setFilterShipping('')
                      setFilterSearch('')
                    }}
                    className="text-sm text-red-500 hover:text-red-700 px-3"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {loading && (
              <p className="text-gray-400 text-center py-12">
                Loading grants...
              </p>
            )}

            {!loading && data && (
              <div className="bg-white rounded-xl border border-gray-200
                              overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4
                                border-b border-gray-100">
                  <h2 className="font-semibold text-gray-700">All Grants</h2>
                  <button
                    onClick={fetchGrants}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Refresh
                  </button>
                </div>

                {data.grants.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    No grants yet. Click "+ Add Grant" to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                      <table className="text-sm" style={{ minWidth: '1400px' }}>
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Grant #</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Region</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Supplier</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Item</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Department</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Project Type</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Currency</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Total Grant (USD)</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Payment (USD)</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Remaining</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Payment Status</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Report Status</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Shipping</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">GRN Status</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Location</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.grants
                          .filter(g => !filterRegion || g.region === filterRegion)
                          .filter(g => !filterDept || g.department === filterDept)
                          .filter(g => !filterPayment || g.payment_status === filterPayment)
                          .filter(g => !filterReport || g.report_status === filterReport)
                          .filter(g => !filterShipping || g.shipping_documents_status === filterShipping)
                          .filter(g => !filterSearch ||
                            g.grant_number?.toLowerCase().includes(filterSearch.toLowerCase()) ||
                            g.supplier?.toLowerCase().includes(filterSearch.toLowerCase()) ||
                            g.item?.toLowerCase().includes(filterSearch.toLowerCase())
                          )
                          .map((grant) => (
                            <tr
                              key={grant.grant_number}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => setDetailGrant(grant)}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                                {grant.grant_number}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                                {grant.region}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                {grant.supplier}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap max-w-48 truncate">
                                {grant.item}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                                {grant.department}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                {grant.project_type || '—'}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                                {grant.currency}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-gray-800 whitespace-nowrap">
                                {grant.total_grant_amount_usd
                                  ? `$${Number(grant.total_grant_amount_usd).toLocaleString()}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-gray-800 whitespace-nowrap">
                                {grant.current_payment_usd
                                  ? `$${Number(grant.current_payment_usd).toLocaleString()}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap
                                            text-amber-600">
                                {grant.remaining_payment
                                  ? `$${Number(grant.remaining_payment).toLocaleString()}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                  ${pillColor(grant.payment_status)}`}>
                                  {grant.payment_status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                  ${pillColor(grant.report_status)}`}>
                                  {grant.report_status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                  ${pillColor(grant.shipping_documents_status)}`}>
                                  {grant.shipping_documents_status || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                  ${pillColor(grant.grn_receiving_status)}`}>
                                  {grant.grn_receiving_status || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                {grant.location || '—'}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap"
                                  onClick={e => e.stopPropagation()}>
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => navigate(`/edit-grant/${grant.grant_number}`)}
                                    className="text-xs px-3 py-1 rounded border border-gray-300
                                              text-gray-600 hover:bg-gray-100 transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setSelectedGrant(grant)}
                                    className="text-xs px-3 py-1 rounded bg-blue-700
                                              text-white hover:bg-blue-800 transition"
                                  >
                                    Report
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

            {/* ── Detail Modal ─────────────────────────────────────────── */}
      {detailGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex
                        items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl
                          max-h-screen overflow-y-auto">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100
                            px-6 py-4 flex justify-between items-start
                            rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-blue-900">
                  {detailGrant.grant_number}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {detailGrant.supplier} · {detailGrant.item}
                </p>
              </div>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => {
                    setDetailGrant(null)
                    navigate(`/edit-grant/${detailGrant.grant_number}`)
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border
                             border-gray-300 text-gray-600
                             hover:bg-gray-50 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setSelectedGrant(detailGrant)
                    setDetailGrant(null)
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-700
                             text-white hover:bg-blue-800 transition"
                >
                  Generate Report
                </button>
                <button
                  onClick={() => setDetailGrant(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border
                             border-gray-200 text-gray-400
                             hover:bg-gray-50 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* Helper components */}
              {(() => {
                function Field({ label, value, color }) {
                  const displayValue = value || '—'
                  return (
                    <div className="flex gap-3">
                      <span className="text-xs text-gray-400 w-44 flex-shrink-0 pt-0.5">
                        {label}
                      </span>
                      <span className={`text-sm font-medium ${color || 'text-gray-800'}`}>
                        {displayValue}
                      </span>
                    </div>
                  )
                }

                function StatusBadge({ value }) {
                  const green = ['Complete', 'Report Complete', 'Received', 'Paid']
                  const red = ['Not received', 'Received with discrepancy', 'Overdue']
                  const gray = ['Not required', 'Not applicable']
                  if (!value) return <span className="text-sm text-gray-400">—</span>
                  const cls = green.includes(value)
                    ? 'bg-blue-100 text-blue-700'
                    : red.includes(value)
                    ? 'bg-red-100 text-red-700'
                    : gray.includes(value)
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-amber-100 text-amber-700'
                  return (
                    <span className={`text-xs px-2 py-1 rounded-full
                                     font-medium ${cls}`}>
                      {value}
                    </span>
                  )
                }

                function Section({ title, children }) {
                  return (
                    <div>
                      <h3 className="text-xs font-bold text-blue-800 uppercase
                                     tracking-widest mb-3 pb-2
                                     border-b border-gray-100">
                        {title}
                      </h3>
                      <div className="space-y-2.5">{children}</div>
                    </div>
                  )
                }

                function LinkRow({ label, value }) {
                  return (
                    <div className="flex gap-3 items-center">
                      <span className="text-xs text-gray-400 w-44 flex-shrink-0">
                        {label}
                      </span>
                      {value ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline
                                     flex items-center gap-1"
                        >
                          Open link ↗
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  )
                }

                const g = detailGrant
                const currency = g.currency || 'USD'

                return (
                  <>
                    {/* Section 1 — Overview */}
                    <Section title="Grant Overview">
                      <Field label="Region" value={g.region} />
                      <Field label="Grant Number" value={g.grant_number} />
                      <Field label="Project Type" value={g.project_type} />
                      <Field label="Department" value={g.department} />
                      <Field label="Supplier" value={g.supplier} />
                      <Field label="Item" value={g.item} />
                      <Field label="PO / WO Number" value={g.po_wo_number} />
                      <Field label="Sub Grant No." value={g.sub_grant_no} />
                    </Section>

                    {/* Section 2 — Financial */}
                    <Section title="Financial Summary">
                      <Field label="Currency" value={currency} />
                      <Field
                        label={`Total Grant (${currency})`}
                        value={g.total_grant_amount_orig
                          ? `${currency} ${Number(g.total_grant_amount_orig).toLocaleString()}`
                          : '—'}
                      />
                      <Field
                        label="Total Grant (USD)"
                        value={g.total_grant_amount_usd
                          ? `$${Number(g.total_grant_amount_usd).toLocaleString()}`
                          : '—'}
                        color="text-blue-700"
                      />
                      <Field
                        label={`Current Payment (${currency})`}
                        value={g.current_payment_orig
                          ? `${currency} ${Number(g.current_payment_orig).toLocaleString()}`
                          : '—'}
                      />
                      <Field
                        label="Current Payment (USD)"
                        value={g.current_payment_usd
                          ? `$${Number(g.current_payment_usd).toLocaleString()}`
                          : '—'}
                        color="text-green-700"
                      />
                      <Field
                        label="Remaining Payment"
                        value={g.remaining_payment
                          ? `$${Number(g.remaining_payment).toLocaleString()}`
                          : '—'}
                        color="text-amber-600"
                      />
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44 flex-shrink-0">
                          Payment Status
                        </span>
                        <StatusBadge value={g.payment_status} />
                      </div>
                      <Field label="Payment Reference" value={g.payment_reference} />
                    </Section>

                    {/* Section 3 — Key Dates */}
                    <Section title="Key Dates">
                      <Field label="Grant Receiving Date" value={g.grant_receiving_date} />
                      <Field label="Application Sent Date" value={g.grant_application_sent_date} />
                      <Field label="Dr. Zafar Signed" value={g.date_dr_zafar_signed_application} />
                      <Field label="Khaleeq Sb Approval" value={g.date_of_approval_by_khaleeq_sb} />
                      <Field label="Email to Int. Chapter" value={g.date_of_email_to_int_chapter} />
                      <Field label="Payment Date" value={g.payment_date} />
                    </Section>

                    {/* Section 4 — Shipping */}
                    <Section title="Shipping & Documents">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44 flex-shrink-0">
                          Shipping Status
                        </span>
                        <StatusBadge value={g.shipping_documents_status} />
                      </div>
                      <Field label="Commercial Invoice" value={g.commercial_invoice_no} />
                      <Field label="Bill of Lading" value={g.bill_of_lading} />
                      <Field label="Packing List Ref." value={g.packing_list_reference} />
                      <LinkRow label="Shipping Documents" value={g.link_to_shipping_documents} />
                      <LinkRow label="Complete Documents" value={g.link_to_complete_documents} />
                      {g.shipping_documents_comment && (
                        <div className="bg-amber-50 border border-amber-100
                                        rounded-lg p-3 mt-2">
                          <p className="text-xs text-amber-700 font-medium mb-1">
                            Shipping Comment
                          </p>
                          <p className="text-sm text-gray-700">
                            {g.shipping_documents_comment}
                          </p>
                        </div>
                      )}
                    </Section>

                    {/* Section 5 — GRN */}
                    <Section title="GRN / Receiving">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44 flex-shrink-0">
                          GRN Status
                        </span>
                        <StatusBadge value={g.grn_receiving_status} />
                      </div>
                      <Field label="Receiving Date" value={g.receiving_date} />
                      <Field label="GRN Number" value={g.grn_number} />
                      <LinkRow label="Link to GRN" value={g.link_to_grn} />
                      {g.grn_receiving_comments && (
                        <div className="bg-gray-50 border border-gray-100
                                        rounded-lg p-3 mt-2">
                          <p className="text-xs text-gray-500 font-medium mb-1">
                            GRN Comments
                          </p>
                          <p className="text-sm text-gray-700">
                            {g.grn_receiving_comments}
                          </p>
                        </div>
                      )}
                    </Section>

                    {/* Section 6 — Location */}
                    <Section title="Installation & Location">
                      <Field label="Installation Date" value={g.installation_date} />
                      <Field label="Location" value={g.location} />
                      <Field label="Building Name" value={g.building_name} />
                      <Field label="Floor" value={g.floor} />
                      <Field label="Room" value={g.room} />
                    </Section>

                    {/* Section 7 — Item */}
                    <Section title="Item Details">
                      <Field label="Item Model" value={g.item_model} />
                      <Field label="Serial Number" value={g.item_serial_number} />
                      <Field label="Quantity" value={g.quantity} />
                      <Field label="IHHN Asset Tag" value={g.ihhn_asset_tag_number} />
                      <Field label="No. of Beneficiaries" value={g.no_of_beneficiaries} />
                      {g.item_description && (
                        <div className="bg-blue-50 border border-blue-100
                                        rounded-lg p-3 mt-2">
                          <p className="text-xs text-blue-700 font-medium mb-1">
                            Item Description
                          </p>
                          <p className="text-sm text-gray-700">
                            {g.item_description}
                          </p>
                        </div>
                      )}
                    </Section>

                    {/* Section 8 — Pictures */}
                    <Section title="Pictures">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44 flex-shrink-0">
                          Pictures Status
                        </span>
                        <StatusBadge value={g.pictures_status} />
                      </div>
                      <Field label="POC for Pictures" value={g.poc_for_pictures} />
                      <LinkRow label="Pictures Link" value={g.pictures} />
                    </Section>

                    {/* Section 9 — Report */}
                    <Section title="Report">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44 flex-shrink-0">
                          Report Status
                        </span>
                        <StatusBadge value={g.report_status} />
                      </div>
                      <LinkRow
                        label="Utilization Report"
                        value={g.link_to_utilization_report}
                      />
                    </Section>
                  </>
                )
              })()}

            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100
                            px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setSelectedGrant(detailGrant)
                  setDetailGrant(null)
                }}
                className="flex-1 bg-blue-700 text-white py-2 rounded-lg
                           text-sm font-medium hover:bg-blue-800 transition"
              >
                Generate Report
              </button>
              <button
                onClick={() => setDetailGrant(null)}
                className="px-6 py-2 rounded-lg border border-gray-200
                           text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Report Modal ──────────────────────────────────────────── */}
      {selectedGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex
                        items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg
                          max-h-screen overflow-y-auto">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                Generate Report
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedGrant.grant_number} — {selectedGrant.supplier}
              </p>
            </div>

            {/* Section selector */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase
                            tracking-wider mb-3">
                Select sections to include
              </p>

              <div className="space-y-2">
                {[
                  { key: 'overview',  label: 'Grant Overview' },
                  { key: 'financial', label: 'Financial Summary' },
                  { key: 'dates',     label: 'Key Dates' },
                  { key: 'shipping',  label: 'Shipping & Documents' },
                  { key: 'grn',       label: 'GRN / Receiving' },
                  { key: 'location',  label: 'Installation & Location' },
                  { key: 'item',      label: 'Item Details' },
                  { key: 'pictures',  label: 'Pictures' },
                  { key: 'report',    label: 'Report Status' },
                ].map(section => (
                  <label
                    key={section.key}
                    className="flex items-center gap-3 p-3 rounded-lg
                               hover:bg-gray-50 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections[section.key]}
                      onChange={e => setSelectedSections(prev => ({
                        ...prev,
                        [section.key]: e.target.checked
                      }))}
                      className="w-4 h-4 rounded accent-blue-700"
                    />
                    <span className="text-sm text-gray-700 font-medium">
                      {section.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Select all / none */}
              <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedSections({
                    overview: true, financial: true, dates: true,
                    shipping: true, grn: true, location: true,
                    item: true, pictures: true, report: true,
                  })}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setSelectedSections({
                    overview: false, financial: false, dates: false,
                    shipping: false, grn: false, location: false,
                    item: false, pictures: false, report: false,
                  })}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Download buttons */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => downloadReport(
                  selectedGrant.grant_number, 'pdf'
                )}
                disabled={reportLoading ||
                  !Object.values(selectedSections).some(Boolean)}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-lg
                           text-sm font-medium hover:bg-red-600 transition
                           disabled:opacity-50"
              >
                {reportLoading ? 'Generating...' : '↓ Download PDF'}
              </button>
              <button
                onClick={() => downloadReport(
                  selectedGrant.grant_number, 'word'
                )}
                disabled={reportLoading ||
                  !Object.values(selectedSections).some(Boolean)}
                className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg
                           text-sm font-medium hover:bg-blue-800 transition
                           disabled:opacity-50"
              >
                {reportLoading ? 'Generating...' : '↓ Download Word'}
              </button>
            </div>

            {/* Cancel */}
            <div className="px-6 pb-4">
              <button
                onClick={() => setSelectedGrant(null)}
                className="w-full text-sm text-gray-400 hover:text-gray-600
                           py-2"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard