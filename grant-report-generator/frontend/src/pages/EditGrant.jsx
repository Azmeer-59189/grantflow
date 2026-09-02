import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// ── Constants ──────────────────────────────────────────────────────────────
const REGION_CURRENCY = {
  'FOIH USA': 'USD',
  'IDF Canada': 'CAD',
  'FOIH Germany': 'EUR',
  'Indus Health UAE': 'AED',
  'FOIH Australia': 'AUD',
}

// ── Field components — defined OUTSIDE so they never remount ───────────────
const inputClass = `w-full border border-gray-300 rounded-lg px-4 py-2
  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
const labelClass = `block text-sm font-medium text-gray-700 mb-1`

function SectionHeader({ title }) {
  return (
    <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
      <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  )
}

function TextField({ name, label, placeholder, required, value, onChange, disabled }) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder || ''}
        disabled={disabled}
        className={`${inputClass} ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
      />
      {disabled && (
        <p className="text-xs text-gray-400 mt-1">Cannot be changed</p>
      )}
    </div>
  )
}

function NumberField({ name, label, readOnly, hint, value, onChange }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {hint && <p className="text-xs text-blue-500 mb-1">{hint}</p>}
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        min="0"
        step="0.01"
        className={`${inputClass} ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
      />
    </div>
  )
}

function DateField({ name, label, value, onChange }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className={inputClass}
      />
    </div>
  )
}

function SelectField({ name, label, options, required, value, onChange }) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={inputClass}
      >
        <option value="">— Select —</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

function LinkField({ name, label, value, onChange }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input
          type="url"
          name={name}
          value={value}
          onChange={onChange}
          placeholder="https://"
          className={`${inputClass} flex-1`}
        />
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 bg-blue-700 text-white text-xs
                       px-3 py-2 rounded-lg hover:bg-blue-800 transition
                       flex items-center"
          >
            Open
          </a>
        )}
      </div>
    </div>
  )
}

function TextareaField({ name, label, value, onChange }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        className={`${inputClass} resize-none`}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
function EditGrant() {
  const navigate = useNavigate()
  const { grantNumber } = useParams()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [rateLoading, setRateLoading] = useState(false)
  const exchangeRateRef = useRef(1)

  const [form, setForm] = useState({
    region: '',
    grant_number: '',
    project_type: '',
    department: '',
    supplier: '',
    item: '',
    po_wo_number: '',
    sub_grant_no: '',
    currency: '',
    total_grant_amount_orig: '',
    total_grant_amount_usd: '',
    sub_grant_amount: '',
    current_payment_orig: '',
    current_payment_usd: '',
    remaining_payment: '',
    payment_status: 'Pending',
    payment_reference: '',
    grant_receiving_date: '',
    grant_application_sent_date: '',
    date_dr_zafar_signed_application: '',
    date_of_approval_by_khaleeq_sb: '',
    date_of_email_to_int_chapter: '',
    payment_date: '',
    shipping_documents_status: '',
    shipping_documents_comment: '',
    link_to_shipping_documents: '',
    link_to_complete_documents: '',
    commercial_invoice_no: '',
    bill_of_lading: '',
    packing_list_reference: '',
    grn_receiving_status: '',
    receiving_date: '',
    grn_number: '',
    link_to_grn: '',
    grn_receiving_comments: '',
    installation_date: '',
    location: '',
    building_name: '',
    floor: '',
    room: '',
    item_model: '',
    item_serial_number: '',
    quantity: '',
    ihhn_asset_tag_number: '',
    pictures_status: '',
    pictures: '',
    poc_for_pictures: '',
    no_of_beneficiaries: '',
    report_status: 'Pending',
    link_to_utilization_report: '',
    item_description: '',
  })

  // Load existing grant data
  useEffect(() => {
    fetchGrant()
  }, [])

  async function fetchGrant() {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/grants/${encodeURIComponent(grantNumber)}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Grant not found')

      // Pre-fill form with existing data
      setForm({
        region: data.region || '',
        grant_number: data.grant_number || '',
        project_type: data.project_type || '',
        department: data.department || '',
        supplier: data.supplier || '',
        item: data.item || '',
        po_wo_number: data.po_wo_number || '',
        sub_grant_no: data.sub_grant_no || '',
        currency: data.currency || '',
        total_grant_amount_orig: data.total_grant_amount_orig || '',
        total_grant_amount_usd: data.total_grant_amount_usd || '',
        sub_grant_amount: data.sub_grant_amount || '',
        current_payment_orig: data.current_payment_orig || '',
        current_payment_usd: data.current_payment_usd || '',
        remaining_payment: data.remaining_payment || '',
        payment_status: data.payment_status || 'Pending',
        payment_reference: data.payment_reference || '',
        grant_receiving_date: data.grant_receiving_date || '',
        grant_application_sent_date: data.grant_application_sent_date || '',
        date_dr_zafar_signed_application: data.date_dr_zafar_signed_application || '',
        date_of_approval_by_khaleeq_sb: data.date_of_approval_by_khaleeq_sb || '',
        date_of_email_to_int_chapter: data.date_of_email_to_int_chapter || '',
        payment_date: data.payment_date || '',
        shipping_documents_status: data.shipping_documents_status || '',
        shipping_documents_comment: data.shipping_documents_comment || '',
        link_to_shipping_documents: data.link_to_shipping_documents || '',
        link_to_complete_documents: data.link_to_complete_documents || '',
        commercial_invoice_no: data.commercial_invoice_no || '',
        bill_of_lading: data.bill_of_lading || '',
        packing_list_reference: data.packing_list_reference || '',
        grn_receiving_status: data.grn_receiving_status || '',
        receiving_date: data.receiving_date || '',
        grn_number: data.grn_number || '',
        link_to_grn: data.link_to_grn || '',
        grn_receiving_comments: data.grn_receiving_comments || '',
        installation_date: data.installation_date || '',
        location: data.location || '',
        building_name: data.building_name || '',
        floor: data.floor || '',
        room: data.room || '',
        item_model: data.item_model || '',
        item_serial_number: data.item_serial_number || '',
        quantity: data.quantity || '',
        ihhn_asset_tag_number: data.ihhn_asset_tag_number || '',
        pictures_status: data.pictures_status || '',
        pictures: data.pictures || '',
        poc_for_pictures: data.poc_for_pictures || '',
        no_of_beneficiaries: data.no_of_beneficiaries || '',
        report_status: data.report_status || 'Pending',
        link_to_utilization_report: data.link_to_utilization_report || '',
        item_description: data.item_description || '',
      })

      // Load exchange rate for the grant's currency
      await loadExchangeRate(data.currency || 'USD')

    } catch (err) {
      setError(err.message)
    } finally {
      setFetching(false)
    }
  }

  async function loadExchangeRate(currency) {
    setRateLoading(true)
    try {
      if (currency === 'USD') {
        setExchangeRate(1)
        exchangeRateRef.current = 1
        return
      }
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${currency}`
      )
      const data = await res.json()
      const rate = data.rates?.USD || 1
      setExchangeRate(rate)
      exchangeRateRef.current = rate
    } catch {
      setExchangeRate(1)
      exchangeRateRef.current = 1
    } finally {
      setRateLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }

      // Auto calculate Total Grant Amount USD
      if (name === 'total_grant_amount_orig') {
        const usd = (parseFloat(value) || 0) * exchangeRateRef.current
        updated.total_grant_amount_usd = usd.toFixed(2)
        const remaining = usd - (parseFloat(updated.current_payment_usd) || 0)
        updated.remaining_payment = remaining.toFixed(2)
      }

      // Auto calculate Current Payment USD
      if (name === 'current_payment_orig') {
        const usd = (parseFloat(value) || 0) * exchangeRateRef.current
        updated.current_payment_usd = usd.toFixed(2)
        const remaining =
          (parseFloat(updated.total_grant_amount_usd) || 0) - usd
        updated.remaining_payment = remaining.toFixed(2)
      }

      return updated
    })
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/grants/${encodeURIComponent(grantNumber)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            total_grant_amount_orig: parseFloat(form.total_grant_amount_orig) || 0,
            total_grant_amount_usd: parseFloat(form.total_grant_amount_usd) || 0,
            sub_grant_amount: parseFloat(form.sub_grant_amount) || 0,
            current_payment_orig: parseFloat(form.current_payment_orig) || 0,
            current_payment_usd: parseFloat(form.current_payment_usd) || 0,
            remaining_payment: parseFloat(form.remaining_payment) || 0,
            quantity: parseFloat(form.quantity) || 0,
            no_of_beneficiaries: parseFloat(form.no_of_beneficiaries) || 0,
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to update grant')
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Shorthand to pass value and onChange
  const f = (name) => ({
    name,
    value: form[name],
    onChange: handleChange,
  })

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading grant data...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4
                      flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-blue-900">GrantFlow</h1>
        <div className="flex items-center gap-4">
          {rateLoading && (
            <span className="text-xs text-gray-400">
              Fetching exchange rate...
            </span>
          )}
          {!rateLoading && form.currency !== 'USD' && (
            <span className="text-xs text-green-600 font-medium">
              1 {form.currency} = {exchangeRate.toFixed(4)} USD
            </span>
          )}
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Edit Grant</h2>
        <p className="text-sm text-gray-500 mb-6">
          Editing: <span className="font-mono text-blue-700">{grantNumber}</span>
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-2 gap-4">

            {/* ── Basic Information ─────────────────────────────── */}
            <SectionHeader title="Basic Information" />
            <SelectField
              {...f('region')} label="Region" required
              options={[
                'FOIH USA', 'IDF Canada', 'FOIH Germany',
                'Indus Health UAE', 'FOIH Australia'
              ]}
            />
            <TextField
              {...f('grant_number')} label="Grant Number"
              required disabled
            />
            <SelectField
              {...f('project_type')} label="Project Type"
              options={['Expansion', 'Non-Expansion']}
            />
            <TextField
              {...f('department')} label="Department"
              placeholder="Department name"
            />
            <TextField
              {...f('supplier')} label="Supplier" required
              placeholder="Supplier name"
            />
            <TextField
              {...f('item')} label="Item" required
              placeholder="Item description"
            />
            <TextField
              {...f('po_wo_number')} label="PO / WO Number"
              placeholder="Purchase or work order number"
            />
            <TextField
              {...f('sub_grant_no')} label="Sub Grant No."
              placeholder="Sub grant number if applicable"
            />

            {/* ── Financial Details ─────────────────────────────── */}
            <SectionHeader title="Financial Details" />

            <div>
              <label className={labelClass}>Currency</label>
              <input
                type="text"
                value={form.currency}
                readOnly
                className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`}
              />
              <p className="text-xs text-gray-400 mt-1">
                Auto-set based on region
              </p>
            </div>

            <NumberField
              {...f('total_grant_amount_orig')}
              label={`Total Grant Amount (${form.currency})`}
              hint="USD value auto-calculates below"
            />
            <NumberField
              {...f('total_grant_amount_usd')}
              label="Total Grant Amount (USD)" readOnly
            />
            <NumberField
              {...f('sub_grant_amount')} label="Sub Grant Amount"
            />
            <NumberField
              {...f('current_payment_orig')}
              label={`Current Payment (${form.currency})`}
              hint="USD value auto-calculates below"
            />
            <NumberField
              {...f('current_payment_usd')}
              label="Current Payment (USD)" readOnly
            />
            <NumberField
              {...f('remaining_payment')}
              label="Remaining Payment (USD)" readOnly
            />
            <SelectField
              {...f('payment_status')} label="Payment Status" required
              options={['Pending', 'Partial', 'Complete']}
            />
            <TextField
              {...f('payment_reference')} label="Payment Reference"
              placeholder="Reference number or note"
            />

            {/* ── Key Dates ─────────────────────────────────────── */}
            <SectionHeader title="Key Dates" />
            <DateField {...f('grant_receiving_date')} label="Grant Receiving Date" />
            <DateField {...f('grant_application_sent_date')} label="Grant Application Sent Date" />
            <DateField {...f('date_dr_zafar_signed_application')} label="Date Dr. Zafar Signed Application" />
            <DateField {...f('date_of_approval_by_khaleeq_sb')} label="Date of Approval by Khaleeq Sb" />
            <DateField {...f('date_of_email_to_int_chapter')} label="Date of Email to Int. Chapter" />
            <DateField {...f('payment_date')} label="Payment Date" />

            {/* ── Shipping & Documents ──────────────────────────── */}
            <SectionHeader title="Shipping & Documents" />
            <SelectField
              {...f('shipping_documents_status')}
              label="Shipping Documents Status"
              options={[
                'Not received', 'Received',
                'Received with discrepancy',
                'Received with comments',
                'Partial shipment documents',
                'Not required', 'Not applicable'
              ]}
            />
            <TextField
              {...f('commercial_invoice_no')} label="Commercial Invoice No."
              placeholder="Invoice number"
            />
            <TextField
              {...f('bill_of_lading')} label="Bill of Lading"
              placeholder="Bill of lading reference"
            />
            <TextField
              {...f('packing_list_reference')} label="Packing List Reference"
              placeholder="Packing list reference"
            />
            <div className="col-span-2">
              <TextareaField
                {...f('shipping_documents_comment')}
                label="Shipping Documents Comment"
              />
            </div>
            <div className="col-span-2">
              <LinkField
                {...f('link_to_shipping_documents')}
                label="Link to Shipping Documents"
              />
            </div>
            <div className="col-span-2">
              <LinkField
                {...f('link_to_complete_documents')}
                label="Link to Complete Documents"
              />
            </div>

            {/* ── GRN / Receiving ───────────────────────────────── */}
            <SectionHeader title="GRN / Receiving" />
            <SelectField
              {...f('grn_receiving_status')} label="GRN / Receiving Status"
              options={[
                'Not received', 'Received',
                'Received with comments', 'Not required'
              ]}
            />
            <DateField {...f('receiving_date')} label="Receiving Date" />
            <TextField
              {...f('grn_number')} label="GRN Number"
              placeholder="GRN reference number"
            />
            <div className="col-span-2">
              <LinkField {...f('link_to_grn')} label="Link to GRN" />
            </div>
            <div className="col-span-2">
              <TextareaField
                {...f('grn_receiving_comments')}
                label="GRN / Receiving Comments"
              />
            </div>

            {/* ── Installation & Location ───────────────────────── */}
            <SectionHeader title="Installation & Location" />
            <DateField {...f('installation_date')} label="Installation Date" />
            <TextField
              {...f('location')} label="Location"
              placeholder="e.g. Karachi Campus"
            />
            <TextField
              {...f('building_name')} label="Building Name"
              placeholder="Building name"
            />
            <TextField {...f('floor')} label="Floor" placeholder="Floor number or name" />
            <TextField {...f('room')} label="Room" placeholder="Room number or name" />

            {/* ── Item Details ──────────────────────────────────── */}
            <SectionHeader title="Item Details" />
            <TextField
              {...f('item_model')} label="Item Model"
              placeholder="Model name or number"
            />
            <TextField
              {...f('item_serial_number')} label="Item Serial Number"
              placeholder="Serial number"
            />
            <NumberField {...f('quantity')} label="Quantity" />
            <TextField
              {...f('ihhn_asset_tag_number')} label="IHHN Asset Tag Number"
              placeholder="Asset tag number"
            />
            <div className="col-span-2">
              <TextareaField {...f('item_description')} label="Item Description" />
            </div>

            {/* ── Pictures ──────────────────────────────────────── */}
            <SectionHeader title="Pictures" />
            <SelectField
              {...f('pictures_status')} label="Pictures' Status"
              options={['Yes', 'No', 'Consumable', 'Not applicable']}
            />
            <TextField
              {...f('poc_for_pictures')} label="POC for Pictures"
              placeholder="Point of contact name"
            />
            <div className="col-span-2">
              <LinkField {...f('pictures')} label="Pictures Link" />
            </div>

            {/* ── Report ────────────────────────────────────────── */}
            <SectionHeader title="Report" />
            <NumberField {...f('no_of_beneficiaries')} label="No. of Beneficiaries" />
            <SelectField
              {...f('report_status')} label="Report Status" required
              options={['Pending', 'Report Complete']}
            />
            <div className="col-span-2">
              <LinkField
                {...f('link_to_utilization_report')}
                label="Link to Utilization Report"
              />
            </div>

          </div>

          {/* Submit */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-700 text-white py-3 rounded-lg
                         font-medium hover:bg-blue-800 transition
                         disabled:opacity-50"
            >
              {loading ? 'Saving changes...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditGrant