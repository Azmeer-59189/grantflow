import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line, ComposedChart, Area
} from 'recharts'

const CHAPTERS = ['FOIHUS', 'IDF', 'TIH UAE', 'IHN UK', 'FOIH Germany', 'FOIH Switzerland']
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'Switzerland', 'UAE']

function Dashboard({ session }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGrant, setSelectedGrant] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [detailGrant, setDetailGrant] = useState(null)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [activeChapter, setActiveChapter] = useState('')
  const [selectedSections, setSelectedSections] = useState({
    overview: true, financial: true, dates: true,
    shipping: true, grn: true, location: true,
    item: true, pictures: true, report: true,
  })

  // Records filters
  const [filterCountry, setFilterCountry] = useState('')
  const [filterChapter, setFilterChapter] = useState('')
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
    const green = ['Complete', 'Report Complete', 'Received', 'Paid']
    const red = ['Overdue', 'Discrepancy', 'Not Received',
      'Incomplete Information', 'Not received',
      'Received with discrepancy']
    if (green.includes(value)) return 'bg-blue-100 text-blue-700'
    if (red.includes(value)) return 'bg-red-100 text-red-700'
    return 'bg-amber-100 text-amber-700'
  }

  // Filter grants by active chapter
  const filteredGrants = data?.grants?.filter(g =>
    !activeChapter || g.chapter === activeChapter
  ) || []

  // ── KPI Calculations ──────────────────────────────────────────────────
  const totalGrantValueUSD = filteredGrants.reduce(
    (sum, g) => sum + (parseFloat(g.total_grant_amount_usd) || 0), 0
  )
  const totalCount = filteredGrants.length
  const highestGrant = filteredGrants.reduce((max, g) =>
    (parseFloat(g.total_grant_amount_usd) || 0) >
    (parseFloat(max?.total_grant_amount_usd) || 0) ? g : max,
    null
  )
  const pendingReports = filteredGrants.filter(
    g => g.report_status === 'Pending' ||
      g.report_status === 'Incomplete Information'
  ).length
  const shippingIssues = filteredGrants.filter(
    g => g.shipping_documents_status?.toLowerCase().includes('discrepancy')
  ).length

  // ── Chart Data ────────────────────────────────────────────────────────
  function getProjectTypeData() {
    const counts = { Expansion: 0, 'Non-Expansion': 0 }
    filteredGrants.forEach(g => {
      if (g.project_type === 'Expansion') counts.Expansion++
      else if (g.project_type === 'Non-Expansion') counts['Non-Expansion']++
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
  }

  function getReportStatusData() {
    const counts = { 'Complete': 0, 'Pending': 0, 'Incomplete Information': 0 }
    filteredGrants.forEach(g => {
      if (counts[g.report_status] !== undefined) counts[g.report_status]++
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
  }

  function getCountryData() {
    const counts = {}
    filteredGrants.forEach(g => {
      const c = g.country || 'Unknown'
      counts[c] = (counts[c] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }

  function getActivityData() {
    const dated = filteredGrants
      .filter(g => g.grant_receiving_date)
      .map(g => ({
        date: g.grant_receiving_date,
        payment: parseFloat(g.current_payment_usd) || 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    if (dated.length === 0) return []

    const grouped = {}
    dated.forEach(({ date, payment }) => {
      if (!grouped[date]) grouped[date] = { date, count: 0, payment: 0 }
      grouped[date].count += 1
      grouped[date].payment += payment
    })

    let cumCount = 0
    let cumPayment = 0
    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => {
        cumCount += d.count
        cumPayment += d.payment
        return { date: d.date, grants: cumCount, payment: Math.round(cumPayment) }
      })
  }

  const projectTypeData = getProjectTypeData()
  const reportStatusData = getReportStatusData()
  const countryData = getCountryData()
  const activityData = getActivityData()
  const discrepancies = filteredGrants.filter(
    g => g.shipping_documents_status?.toLowerCase().includes('discrepancy')
  )

  const PROJECT_COLORS = ['#08325C', '#E8A916']
  const REPORT_COLORS = ['#1D6FB8', '#E8A916', '#C0272D']

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <div className="hidden md:flex w-56 flex-shrink-0 flex-col"
           style={{ background: '#08325C' }}>
        <div className="px-5 py-6 border-b border-white border-opacity-10">
          <div className="text-white font-semibold text-base leading-tight">
            Grant Utilization<br />Ledger
          </div>
          <div className="text-xs mt-1" style={{ color: '#B9C9C4' }}>
            IHHN · FOIH
          </div>
        </div>
        <nav className="mt-3 flex-1">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'records', label: 'Records' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full text-left px-5 py-3 text-sm font-medium
                         flex items-center gap-2 transition border-l-4
                         ${activeNav === item.id
                           ? 'text-white border-yellow-400'
                           : 'text-gray-300 border-transparent hover:text-white'
                         }`}
              style={{
                background: activeNav === item.id
                  ? 'rgba(255,255,255,0.08)' : 'transparent'
              }}
            >
              ◆ {item.label}
            </button>
          ))}
        </nav>
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
      <div className="flex-1 overflow-auto">

        {/* Mobile navbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3
                        border-b border-gray-200 bg-white sticky top-0 z-10">
          <div>
            <div className="text-sm font-bold text-blue-900">
              Grant Utilization Ledger
            </div>
            <div className="text-xs text-gray-400">IHHN · FOIH</div>
          </div>
          <div className="flex gap-2">
            {['dashboard', 'records'].map(nav => (
              <button
                key={nav}
                onClick={() => setActiveNav(nav)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize
                  ${activeNav === nav
                    ? 'bg-blue-700 text-white'
                    : 'text-gray-500 border border-gray-200'}`}
              >
                {nav}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="text-xs text-red-500">
            Sign out
          </button>
        </div>

        <div className="p-4 md:p-8">

          {/* ── DASHBOARD VIEW ──────────────────────────────────── */}
          {activeNav === 'dashboard' && (
            <>
              {/* Page header */}
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-800"
                    style={{ fontFamily: 'Georgia, serif' }}>
                  Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Grant utilization across all regions
                </p>
              </div>

              {/* Chapter Filter Buttons */}
              <div className="bg-white rounded-xl border border-gray-100
                              shadow-sm p-4 mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase
                               tracking-wider mb-3">
                  Filter by Chapter
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveChapter('')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium
                                transition border
                      ${activeChapter === ''
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                  >
                    All Chapters
                  </button>
                  {CHAPTERS.map(chapter => (
                    <button
                      key={chapter}
                      onClick={() => setActiveChapter(
                        activeChapter === chapter ? '' : chapter
                      )}
                      className={`px-4 py-2 rounded-lg text-sm font-medium
                                  transition border
                        ${activeChapter === chapter
                          ? 'bg-blue-900 text-white border-blue-900'
                          : 'text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                    >
                      {chapter}
                    </button>
                  ))}
                </div>
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
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-5 shadow-sm
                                    border border-gray-100">
                      <p className="text-xs text-gray-400 uppercase
                                    tracking-wide">
                        Total Records
                      </p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">
                        {totalCount}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm
                                    border border-gray-100">
                      <p className="text-xs text-gray-400 uppercase
                                    tracking-wide">
                        Total Grant Value
                      </p>
                      <p className="text-2xl font-bold text-amber-500 mt-1">
                        ${totalGrantValueUSD.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm
                                    border border-gray-100">
                      <p className="text-xs text-gray-400 uppercase
                                    tracking-wide">
                        Reports Pending
                      </p>
                      <p className="text-3xl font-bold text-blue-700 mt-1">
                        {pendingReports}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm
                                    border border-gray-100">
                      <p className="text-xs text-gray-400 uppercase
                                    tracking-wide">
                        Discrepancies
                      </p>
                      <p className="text-3xl font-bold text-red-600 mt-1">
                        {shippingIssues}
                      </p>
                    </div>

                    {/* Highest Grant Card */}
                    {highestGrant && (
                      <div className="bg-white rounded-xl p-5 shadow-sm
                                      border border-gray-100 col-span-2
                                      md:col-span-1">
                        <p className="text-xs text-gray-400 uppercase
                                      tracking-wide mb-2">
                          Highest Grant
                        </p>
                        <p className="text-xl font-bold text-blue-900">
                          ${parseFloat(
                            highestGrant.total_grant_amount_usd || 0
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 0
                          })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {highestGrant.grant_number}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {highestGrant.supplier}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {highestGrant.item}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Discrepancy Alert */}
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
                    </div>
                  )}

                  {/* Charts Row 1 — Project Type + Report Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                    {/* Project Type Donut */}
                    <div className="bg-white rounded-2xl border border-gray-100
                                    shadow-sm p-6">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm">
                            Distribution of Project Type
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Expansion vs Non-Expansion
                          </p>
                        </div>
                        <div className="flex gap-3">
                          {projectTypeData.map((d, i) => (
                            <div key={i} className="text-right">
                              <div className="text-lg font-bold"
                                   style={{ color: PROJECT_COLORS[i] }}>
                                {d.value}
                              </div>
                              <div className="text-xs text-gray-400">
                                {d.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {projectTypeData.length === 0 ? (
                        <div className="flex items-center justify-center
                                        h-40 text-gray-300 text-sm">
                          No data yet
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={projectTypeData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {projectTypeData.map((_, i) => (
                                <Cell key={i}
                                  fill={PROJECT_COLORS[i % 2]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                borderRadius: '10px', border: 'none',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                fontSize: '12px'
                              }}
                            />
                            <Legend
                              iconType="circle" iconSize={7}
                              formatter={v => (
                                <span style={{
                                  fontSize: '12px', color: '#5B6B82'
                                }}>
                                  {v}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Report Status Donut */}
                    <div className="bg-white rounded-2xl border border-gray-100
                                    shadow-sm p-6">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm">
                            Report Status
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {totalCount} total grants
                          </p>
                        </div>
                        <div className="flex gap-3">
                          {reportStatusData.map((d, i) => (
                            <div key={i} className="text-right">
                              <div className="text-lg font-bold"
                                   style={{ color: REPORT_COLORS[i] }}>
                                {d.value}
                              </div>
                              <div className="text-xs text-gray-400">
                                {d.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {reportStatusData.length === 0 ? (
                        <div className="flex items-center justify-center
                                        h-40 text-gray-300 text-sm">
                          No data yet
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={reportStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {reportStatusData.map((_, i) => (
                                <Cell key={i}
                                  fill={REPORT_COLORS[i % 3]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                borderRadius: '10px', border: 'none',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                fontSize: '12px'
                              }}
                            />
                            <Legend
                              iconType="circle" iconSize={7}
                              formatter={v => (
                                <span style={{
                                  fontSize: '12px', color: '#5B6B82'
                                }}>
                                  {v}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Records by Country Bar Chart */}
                  <div className="bg-white rounded-2xl border border-gray-100
                                  shadow-sm p-6 mb-6">
                    <div className="mb-4">
                      <h3 className="font-bold text-gray-800 text-sm">
                        Records by Country
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        grant count per country
                      </p>
                    </div>
                    {countryData.length === 0 ? (
                      <div className="flex items-center justify-center
                                      h-40 text-gray-300 text-sm">
                        No data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={countryData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
                          barSize={32}
                        >
                          <CartesianGrid strokeDasharray="3 3"
                                         stroke="#f5f5f5" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#5B6B82' }}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '10px', border: 'none',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                              fontSize: '12px'
                            }}
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}
                               fill="#08325C">
                            <LabelList
                              dataKey="value" position="top"
                              style={{
                                fontSize: '11px', fill: '#5B6B82',
                                fontWeight: 600
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Grant Activity Line Chart */}
                  <div className="bg-white rounded-2xl border border-gray-100
                                  shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm">
                          Grant Activity Over Time
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          cumulative grants and payments by receiving date
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-blue-600">
                          </div>
                          <span className="text-xs text-gray-500">Grants</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-amber-400">
                          </div>
                          <span className="text-xs text-gray-500">
                            Payment (USD)
                          </span>
                        </div>
                      </div>
                    </div>
                    {activityData.length < 2 ? (
                      <div className="flex items-center justify-center
                                      h-48 text-gray-300 text-sm">
                        Add grants with different receiving dates to see activity
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart
                          data={activityData}
                          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                        >
                          <defs>
                            <linearGradient id="grantsGrad"
                              x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1D6FB8"
                                stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#1D6FB8"
                                stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="paymentGrad"
                              x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#E8A916"
                                stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#E8A916"
                                stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3"
                                         stroke="#f0f0f0" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis yAxisId="left" orientation="left"
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            axisLine={false} tickLine={false} width={30}
                          />
                          <YAxis yAxisId="right" orientation="right"
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            axisLine={false} tickLine={false} width={50}
                            tickFormatter={v =>
                              `$${(v / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '10px', border: 'none',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                              fontSize: '12px', padding: '10px 14px'
                            }}
                            formatter={(value, name) => [
                              name === 'payment'
                                ? `$${value.toLocaleString()}` : value,
                              name === 'payment' ? 'Payment USD' : 'Grants'
                            ]}
                          />
                          <Area yAxisId="left" type="monotone"
                            dataKey="grants" stroke="#1D6FB8"
                            strokeWidth={2.5}
                            fill="url(#grantsGrad)"
                            dot={{ fill: '#1D6FB8', r: 4, strokeWidth: 0 }}
                            activeDot={{
                              r: 6, fill: '#1D6FB8', strokeWidth: 0
                            }}
                          />
                          <Area yAxisId="right" type="monotone"
                            dataKey="payment" stroke="#E8A916"
                            strokeWidth={2.5}
                            fill="url(#paymentGrad)"
                            dot={{ fill: '#E8A916', r: 4, strokeWidth: 0 }}
                            activeDot={{
                              r: 6, fill: '#E8A916', strokeWidth: 0
                            }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── RECORDS VIEW ────────────────────────────────────── */}
          {activeNav === 'records' && (
            <>
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
                    value={filterCountry}
                    onChange={e => setFilterCountry(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2
                               text-sm text-gray-600 bg-white focus:outline-none
                               focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All countries</option>
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <select
                    value={filterChapter}
                    onChange={e => setFilterChapter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2
                               text-sm text-gray-600 bg-white focus:outline-none
                               focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All chapters</option>
                    {CHAPTERS.map(c => (
                      <option key={c} value={c}>{c}</option>
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
                    {[...new Set(
                      data.grants.map(g => g.department).filter(Boolean)
                    )].map(d => (
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
                    {['Pending', 'Partial', 'Complete'].map(s => (
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
                    {['Complete', 'Pending', 'Incomplete Information'].map(s => (
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

                  {(filterCountry || filterChapter || filterDept ||
                    filterPayment || filterReport || filterSearch) && (
                    <button
                      onClick={() => {
                        setFilterCountry('')
                        setFilterChapter('')
                        setFilterDept('')
                        setFilterPayment('')
                        setFilterReport('')
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
                      <table className="text-sm"
                             style={{ minWidth: '1600px' }}>
                        <thead className="bg-gray-50 text-gray-500
                                          uppercase text-xs">
                          <tr>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Grant #
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Country
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Chapter
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Supplier
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Item
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Department
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Project Type
                            </th>
                            <th className="px-4 py-3 text-right whitespace-nowrap">
                              Total Grant (USD)
                            </th>
                            <th className="px-4 py-3 text-right whitespace-nowrap">
                              Payment (USD)
                            </th>
                            <th className="px-4 py-3 text-right whitespace-nowrap">
                              Remaining
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              Payment
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              Report
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              Shipping
                            </th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">
                              Location
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.grants
                            .filter(g => !filterCountry ||
                              g.country === filterCountry)
                            .filter(g => !filterChapter ||
                              g.chapter === filterChapter)
                            .filter(g => !filterDept ||
                              g.department === filterDept)
                            .filter(g => !filterPayment ||
                              g.payment_status === filterPayment)
                            .filter(g => !filterReport ||
                              g.report_status === filterReport)
                            .filter(g => !filterSearch ||
                              g.grant_number?.toLowerCase().includes(
                                filterSearch.toLowerCase()) ||
                              g.supplier?.toLowerCase().includes(
                                filterSearch.toLowerCase()) ||
                              g.item?.toLowerCase().includes(
                                filterSearch.toLowerCase())
                            )
                            .map((grant) => (
                              <tr
                                key={grant.grant_number}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => setDetailGrant(grant)}
                              >
                                <td className="px-4 py-3 font-mono text-xs
                                               text-gray-700 whitespace-nowrap">
                                  {grant.grant_number}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600
                                               whitespace-nowrap">
                                  {grant.country}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600
                                               whitespace-nowrap">
                                  {grant.chapter}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700
                                               whitespace-nowrap">
                                  {grant.supplier}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600
                                               whitespace-nowrap max-w-48
                                               truncate">
                                  {grant.item}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600
                                               whitespace-nowrap">
                                  {grant.department}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500
                                               whitespace-nowrap">
                                  {grant.project_type || '—'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono
                                               text-xs text-gray-800
                                               whitespace-nowrap">
                                  {grant.total_grant_amount_usd
                                    ? `$${Number(grant.total_grant_amount_usd
                                      ).toLocaleString()}`
                                    : '—'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono
                                               text-xs text-gray-800
                                               whitespace-nowrap">
                                  {grant.current_payment_usd
                                    ? `$${Number(grant.current_payment_usd
                                      ).toLocaleString()}`
                                    : '—'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono
                                               text-xs text-amber-600
                                               whitespace-nowrap">
                                  {grant.remaining_payment_usd
                                    ? `$${Number(grant.remaining_payment_usd
                                      ).toLocaleString()}`
                                    : '—'}
                                </td>
                                <td className="px-4 py-3 text-center
                                               whitespace-nowrap">
                                  <span className={`px-2 py-1 rounded-full
                                    text-xs font-medium
                                    ${pillColor(grant.payment_status)}`}>
                                    {grant.payment_status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center
                                               whitespace-nowrap">
                                  <span className={`px-2 py-1 rounded-full
                                    text-xs font-medium
                                    ${pillColor(grant.report_status)}`}>
                                    {grant.report_status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center
                                               whitespace-nowrap">
                                  <span className={`px-2 py-1 rounded-full
                                    text-xs font-medium
                                    ${pillColor(
                                      grant.shipping_documents_status)}`}>
                                    {grant.shipping_documents_status || '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500
                                               whitespace-nowrap">
                                  {grant.location || '—'}
                                </td>
                                <td className="px-4 py-3 text-center
                                               whitespace-nowrap"
                                    onClick={e => e.stopPropagation()}>
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => navigate(
                                        `/edit-grant/${grant.grant_number}`
                                      )}
                                      className="text-xs px-3 py-1 rounded
                                                 border border-gray-300
                                                 text-gray-600
                                                 hover:bg-gray-100 transition"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => setSelectedGrant(grant)}
                                      className="text-xs px-3 py-1 rounded
                                                 bg-blue-700 text-white
                                                 hover:bg-blue-800 transition"
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
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      {detailGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex
                        items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl
                          max-h-screen overflow-y-auto">
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
              {(() => {
                function Field({ label, value, color }) {
                  return (
                    <div className="flex gap-3">
                      <span className="text-xs text-gray-400 w-44
                                       flex-shrink-0 pt-0.5">
                        {label}
                      </span>
                      <span className={`text-sm font-medium
                        ${color || 'text-gray-800'}`}>
                        {value || '—'}
                      </span>
                    </div>
                  )
                }

                function StatusBadge({ value }) {
                  const green = ['Complete', 'Received', 'Paid']
                  const red = ['Not received', 'Received with discrepancy',
                    'Incomplete Information']
                  const gray = ['Not required', 'Not applicable']
                  if (!value) return (
                    <span className="text-sm text-gray-400">—</span>
                  )
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
                      <h3 className="text-xs font-bold text-blue-800
                                     uppercase tracking-widest mb-3 pb-2
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
                      <span className="text-xs text-gray-400 w-44
                                       flex-shrink-0">
                        {label}
                      </span>
                      {value ? (
                        <a href={value} target="_blank" rel="noreferrer"
                           className="text-sm text-blue-600 hover:underline
                                      flex items-center gap-1">
                          Open link ↗
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  )
                }

                const g = detailGrant
                const currency = g.secondary_currency || 'USD'

                return (
                  <>
                    <Section title="Grant Overview">
                      <Field label="Country" value={g.country} />
                      <Field label="Chapter" value={g.chapter} />
                      <Field label="Grant Number" value={g.grant_number} />
                      <Field label="Project Type" value={g.project_type} />
                      <Field label="Department" value={g.department} />
                      <Field label="Supplier" value={g.supplier} />
                      <Field label="Item" value={g.item} />
                      <Field label="PO / WO Number" value={g.po_wo_number} />
                      <Field label="Sub Grant No." value={g.sub_grant_no} />
                      <LinkRow label="Complete Documents"
                        value={g.link_to_complete_documents} />
                    </Section>

                    <Section title="Financial Summary">
                      <Field label="Secondary Currency" value={currency} />
                      <Field
                        label={`Total Grant (${currency})`}
                        value={g.total_grant_amount_orig
                          ? `${currency} ${Number(
                            g.total_grant_amount_orig).toLocaleString()}`
                          : '—'}
                      />
                      <Field
                        label="Total Grant (USD)"
                        value={g.total_grant_amount_usd
                          ? `$${Number(
                            g.total_grant_amount_usd).toLocaleString()}`
                          : '—'}
                        color="text-blue-700"
                      />
                      <Field
                        label={`Current Payment (${currency})`}
                        value={g.current_payment_orig
                          ? `${currency} ${Number(
                            g.current_payment_orig).toLocaleString()}`
                          : '—'}
                      />
                      <Field
                        label="Current Payment (USD)"
                        value={g.current_payment_usd
                          ? `$${Number(
                            g.current_payment_usd).toLocaleString()}`
                          : '—'}
                        color="text-green-700"
                      />
                      <Field
                        label="Remaining (USD)"
                        value={g.remaining_payment_usd
                          ? `$${Number(
                            g.remaining_payment_usd).toLocaleString()}`
                          : '—'}
                        color="text-amber-600"
                      />
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44
                                         flex-shrink-0">
                          Payment Status
                        </span>
                        <StatusBadge value={g.payment_status} />
                      </div>
                      <LinkRow label="Payment Reference"
                        value={g.payment_reference} />
                    </Section>

                    <Section title="Key Dates">
                      <Field label="Grant Receiving Date"
                        value={g.grant_receiving_date} />
                      <Field label="Application Sent"
                        value={g.grant_application_sent_date} />
                      <Field label="Dr. Zafar Signed"
                        value={g.date_dr_zafar_signed_application} />
                      <Field label="CEO Signed"
                        value={g.date_ceo_signed_application} />
                      <Field label="Khaleeq Sb Approval"
                        value={g.date_of_approval_by_khaleeq_sb} />
                      <Field label="Email to Int. Chapter"
                        value={g.date_of_email_to_int_chapter} />
                      <Field label="Payment Date" value={g.payment_date} />
                    </Section>

                    <Section title="Shipping & Documents">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44
                                         flex-shrink-0">
                          Shipping Status
                        </span>
                        <StatusBadge value={g.shipping_documents_status} />
                      </div>
                      <Field label="Commercial Invoice"
                        value={g.commercial_invoice_no} />
                      <Field label="Bill of Lading"
                        value={g.bill_of_lading} />
                      <Field label="Packing List Ref."
                        value={g.packing_list_reference} />
                      <LinkRow label="Shipping Documents"
                        value={g.link_to_shipping_documents} />
                      {g.shipping_documents_comment && (
                        <div className="bg-amber-50 border border-amber-100
                                        rounded-lg p-3 mt-2">
                          <p className="text-xs text-amber-700 font-medium
                                        mb-1">
                            Shipping Comment
                          </p>
                          <p className="text-sm text-gray-700">
                            {g.shipping_documents_comment}
                          </p>
                        </div>
                      )}
                    </Section>

                    <Section title="GRN / Receiving">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44
                                         flex-shrink-0">
                          GRN Status
                        </span>
                        <StatusBadge value={g.grn_receiving_status} />
                      </div>
                      <Field label="Receiving Date"
                        value={g.receiving_date} />
                      <Field label="GRN Number" value={g.grn_number} />
                      <LinkRow label="Link to GRN" value={g.link_to_grn} />
                      {g.grn_receiving_comments && (
                        <div className="bg-gray-50 border border-gray-100
                                        rounded-lg p-3 mt-2">
                          <p className="text-xs text-gray-500 font-medium
                                        mb-1">
                            GRN Comments
                          </p>
                          <p className="text-sm text-gray-700">
                            {g.grn_receiving_comments}
                          </p>
                        </div>
                      )}
                    </Section>

                    <Section title="Installation & Location">
                      <Field label="Installation Date"
                        value={g.installation_date} />
                      <Field label="Location" value={g.location} />
                      <Field label="Building Name"
                        value={g.building_name} />
                      <Field label="Floor" value={g.floor} />
                      <Field label="Room" value={g.room} />
                    </Section>

                    <Section title="Item Details">
                      <Field label="Item Model" value={g.item_model} />
                      <Field label="Serial Number"
                        value={g.item_serial_number} />
                      <Field label="Quantity" value={g.quantity} />
                      <Field label="IHHN Asset Tag"
                        value={g.ihhn_asset_tag_number} />
                      <Field label="No. of Beneficiaries"
                        value={g.no_of_beneficiaries} />
                      {g.item_description && (
                        <div className="bg-blue-50 border border-blue-100
                                        rounded-lg p-3 mt-2">
                          <p className="text-xs text-blue-700 font-medium
                                        mb-1">
                            Item Description
                          </p>
                          <p className="text-sm text-gray-700">
                            {g.item_description}
                          </p>
                        </div>
                      )}
                    </Section>

                    <Section title="Pictures">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44
                                         flex-shrink-0">
                          Pictures Status
                        </span>
                        <StatusBadge value={g.pictures_status} />
                      </div>
                      <Field label="Department for Pictures"
                        value={g.department_for_pictures} />
                      <LinkRow label="Picture" value={g.picture} />
                    </Section>

                    <Section title="Report">
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-gray-400 w-44
                                         flex-shrink-0">
                          Report Status
                        </span>
                        <StatusBadge value={g.report_status} />
                      </div>
                      <LinkRow label="Utilization Report"
                        value={g.link_to_utilization_report} />
                    </Section>
                  </>
                )
              })()}
            </div>

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
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                Generate Report
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedGrant.grant_number} — {selectedGrant.supplier}
              </p>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase
                            tracking-wider mb-3">
                Select sections to include
              </p>
              <div className="space-y-2">
                {[
                  { key: 'overview', label: 'Grant Overview' },
                  { key: 'financial', label: 'Financial Summary' },
                  { key: 'dates', label: 'Key Dates' },
                  { key: 'shipping', label: 'Shipping & Documents' },
                  { key: 'grn', label: 'GRN / Receiving' },
                  { key: 'location', label: 'Installation & Location' },
                  { key: 'item', label: 'Item Details' },
                  { key: 'pictures', label: 'Pictures' },
                  { key: 'report', label: 'Report Status' },
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