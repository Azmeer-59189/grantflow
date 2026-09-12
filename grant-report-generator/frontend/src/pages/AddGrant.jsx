import { useState, useEffect, useRef } from 'react'
import FileUploadField from '../components/FileUploadField'
import { useNavigate } from 'react-router-dom'

// ── Constants ──────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  country: '',
  chapter: '',
  grant_number: '',
  project_type: '',
  department: '',
  supplier: '',
  item: '',
  po_wo_number: '',
  sub_grant_no: '',
  link_to_complete_documents: '',
  secondary_currency: '',
  total_grant_amount_orig: '',
  total_grant_amount_usd: '',
  sub_grant_amount: '',
  current_payment_orig: '',
  current_payment_usd: '',
  remaining_payment_orig: '',
  remaining_payment_usd: '',
  payment_status: 'Pending',
  payment_reference: '',
  grant_receiving_date: '',
  grant_application_sent_date: '',
  date_dr_zafar_signed_application: '',
  date_of_approval_by_khaleeq_sb: '',
  date_of_email_to_int_chapter: '',
  payment_date: '',
  date_ceo_signed_application: '',
  shipping_documents_status: '',
  shipping_documents_comment: '',
  link_to_shipping_documents: '',
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
  department_for_pictures: '',
  picture: '',
  pictures_status: '',
  no_of_beneficiaries: '',
  report_status: 'Incomplete Information',
  link_to_utilization_report: '',
  item_description: '',
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

function StatusBadge({ status }) {
  const colors = {
    'Complete': 'bg-blue-100 text-blue-700',
    'Pending': 'bg-amber-100 text-amber-700',
    'Incomplete Information': 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium
                     ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
function AddGrant() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [rateLoading, setRateLoading] = useState(false)
  const exchangeRateRef = useRef(1)
  const [form, setForm] = useState(INITIAL_FORM)

  // Calculate report status on the fly for preview
  function calcReportStatus(f) {
    const requiredFields = [
      'country', 'chapter', 'grant_number', 'project_type', 'department',
      'supplier', 'item', 'po_wo_number', 'sub_grant_no',
      'link_to_complete_documents', 'secondary_currency',
      'total_grant_amount_orig', 'total_grant_amount_usd',
      'current_payment_orig', 'current_payment_usd',
      'payment_status', 'payment_reference',
      'grant_receiving_date', 'grant_application_sent_date',
      'date_dr_zafar_signed_application', 'date_of_approval_by_khaleeq_sb',
      'date_of_email_to_int_chapter', 'payment_date',
      'date_ceo_signed_application',
      'shipping_documents_status', 'shipping_documents_comment',
      'link_to_shipping_documents', 'commercial_invoice_no',
      'bill_of_lading', 'packing_list_reference',
      'grn_receiving_status', 'receiving_date', 'grn_number',
      'link_to_grn', 'grn_receiving_comments', 'installation_date',
      'location', 'building_name', 'floor', 'room',
      'item_model', 'item_serial_number', 'quantity',
      'ihhn_asset_tag_number', 'department_for_pictures',
      'picture', 'pictures_status', 'no_of_beneficiaries',
      'item_description',
    ]
    const allFilled = requiredFields.every(k => String(f[k] || '').trim())
    const hasReportLink = String(f.link_to_utilization_report || '').trim()
    if (allFilled && hasReportLink) return 'Complete'
    if (allFilled && !hasReportLink) return 'Pending'
    return 'Incomplete Information'
  }

  // When secondary currency changes fetch exchange rate
  useEffect(() => {
    if (form.secondary_currency) {
      loadExchangeRate(form.secondary_currency)
    } else {
      setExchangeRate(1)
      exchangeRateRef.current = 1
    }
  }, [form.secondary_currency])

  async function loadExchangeRate(currency) {
    setRateLoading(true)
    try {
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
        // Recalculate remaining
        const remOrig = (parseFloat(updated.total_grant_amount_orig) || 0) -
          (parseFloat(updated.current_payment_orig) || 0)
        updated.remaining_payment_orig = remOrig.toFixed(2)
        const remUsd = usd - (parseFloat(updated.current_payment_usd) || 0)
        updated.remaining_payment_usd = remUsd.toFixed(2)
      }

      // Auto calculate Current Payment USD
      if (name === 'current_payment_orig') {
        const usd = (parseFloat(value) || 0) * exchangeRateRef.current
        updated.current_payment_usd = usd.toFixed(2)
        // Recalculate remaining orig
        const remOrig = (parseFloat(updated.total_grant_amount_orig) || 0) -
          (parseFloat(value) || 0)
        updated.remaining_payment_orig = remOrig.toFixed(2)
        // Recalculate remaining usd
        const remUsd = (parseFloat(updated.total_grant_amount_usd) || 0) - usd
        updated.remaining_payment_usd = remUsd.toFixed(2)
      }

      // Update report status preview
      updated.report_status = calcReportStatus(updated)

      return updated
    })
  }

async function handleSubmit() {
    setLoading(true)
    setError('')
    console.log('Form data:', form)  // add this line
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/grants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            total_grant_amount_orig: parseFloat(form.total_grant_amount_orig) || 0,
            total_grant_amount_usd: parseFloat(form.total_grant_amount_usd) || 0,
            sub_grant_amount: parseFloat(form.sub_grant_amount) || 0,
            current_payment_orig: parseFloat(form.current_payment_orig) || 0,
            current_payment_usd: parseFloat(form.current_payment_usd) || 0,
            remaining_payment_orig: parseFloat(form.remaining_payment_orig) || 0,
            remaining_payment_usd: parseFloat(form.remaining_payment_usd) || 0,
            quantity: parseFloat(form.quantity) || 0,
            no_of_beneficiaries: parseFloat(form.no_of_beneficiaries) || 0,
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        const detail = data.detail
        if (Array.isArray(detail)) {
          throw new Error(detail.map(e => e.msg).join(', '))
        }
        throw new Error(typeof detail === 'string' ? detail : 'Failed to add grant')
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const f = (name) => ({
    name,
    value: form[name],
    onChange: handleChange,
  })

  const reportStatus = calcReportStatus(form)

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
          {!rateLoading && form.secondary_currency && (
            <span className="text-xs text-green-600 font-medium">
              1 {form.secondary_currency} = {exchangeRate.toFixed(4)} USD
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Add New Grant</h2>
            <p className="text-sm text-gray-500 mt-1">
              Required fields marked with *
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Report Status:</span>
            <StatusBadge status={reportStatus} />
          </div>
        </div>

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
              {...f('country')} label="Country" required
              options={[
                'United States', 'Canada', 'United Kingdom',
                'Germany', 'Switzerland', 'UAE'
              ]}
            />
            <SelectField
              {...f('chapter')} label="Chapter"
              options={[
                'FOIHUS', 'IDF', 'TIH UAE',
                'IHN UK', 'FOIH Germany', 'FOIH Switzerland'
              ]}
            />
            <TextField
              {...f('grant_number')} label="Grant Number" required
              placeholder="e.g. IHHN-FOIH-USA-Grant-0001-2026"
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
            <div className="col-span-2">
              <LinkField
                {...f('link_to_complete_documents')}
                label="Link to Complete Documents (Grant Application, PO & Invoice)"
              />
            </div>

            {/* ── Financial Details ─────────────────────────────── */}
            <SectionHeader title="Financial Details" />

            {/* Primary currency — always USD */}
            <div>
              <label className={labelClass}>Primary Currency</label>
              <input
                type="text"
                value="USD"
                readOnly
                className={`${inputClass} bg-gray-50 text-gray-500
                            cursor-not-allowed`}
              />
              <p className="text-xs text-gray-400 mt-1">
                Always USD — all amounts converted to USD
              </p>
            </div>

            {/* Secondary currency — user selects */}
            <SelectField
              {...f('secondary_currency')} label="Secondary Currency"
              options={['CAD', 'EUR', 'AED', 'AUD', 'GBP']}
            />

            <NumberField
              {...f('total_grant_amount_orig')}
              label={`Total Grant Amount ${form.secondary_currency ? `(${form.secondary_currency})` : '(orig)'}`}
              hint={form.secondary_currency ? "USD value auto-calculates" : "Select secondary currency first"}
            />
            <NumberField
              {...f('total_grant_amount_usd')}
              label="Total Grant Amount (USD)"
              readOnly
            />
            <NumberField
              {...f('sub_grant_amount')}
              label="Sub Grant Amount"
            />
            <NumberField
              {...f('current_payment_orig')}
              label={`Current Payment ${form.secondary_currency ? `(${form.secondary_currency})` : '(orig)'}`}
              hint={form.secondary_currency ? "USD value auto-calculates" : "Select secondary currency first"}
            />
            <NumberField
              {...f('current_payment_usd')}
              label="Current Payment (USD)"
              readOnly
            />
            <NumberField
              {...f('remaining_payment_orig')}
              label={`Remaining Payment ${form.secondary_currency ? `(${form.secondary_currency})` : '(orig)'}`}
              readOnly
            />
            <NumberField
              {...f('remaining_payment_usd')}
              label="Remaining Payment (USD)"
              readOnly
            />
            <SelectField
              {...f('payment_status')} label="Payment Status" required
              options={['Pending', 'Partial', 'Complete']}
            />
            <div className="col-span-2">
              <FileUploadField
                name="payment_reference"
                label="Payment Reference (Attachment)"
                value={form.payment_reference}
                onChange={handleChange}
                folder="payment-references"
              />
            </div>

            {/* ── Key Dates ─────────────────────────────────────── */}
            <SectionHeader title="Key Dates" />
            <DateField
              {...f('grant_receiving_date')}
              label="Grant Receiving Date"
            />
            <DateField
              {...f('grant_application_sent_date')}
              label="Grant Application Sent Date"
            />
            <DateField
              {...f('date_dr_zafar_signed_application')}
              label="Date Dr. Zafar Signed Application"
            />
            <DateField
              {...f('date_ceo_signed_application')}
              label="Date CEO Signed Application"
            />
            <DateField
              {...f('date_of_approval_by_khaleeq_sb')}
              label="Date of Approval by Khaleeq Sb"
            />
            <DateField
              {...f('date_of_email_to_int_chapter')}
              label="Date of Email to Int. Chapter"
            />
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
              {...f('commercial_invoice_no')}
              label="Commercial Invoice No."
              placeholder="Invoice number"
            />
            <TextField
              {...f('bill_of_lading')} label="Bill of Lading"
              placeholder="Bill of lading reference"
            />
            <TextField
              {...f('packing_list_reference')}
              label="Packing List Reference"
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

            {/* ── GRN / Receiving ───────────────────────────────── */}
            <SectionHeader title="GRN / Receiving" />
            <SelectField
              {...f('grn_receiving_status')}
              label="GRN / Receiving Status"
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
            <DateField
              {...f('installation_date')} label="Installation Date"
            />
            <TextField
              {...f('location')} label="Location"
              placeholder="e.g. Karachi Campus"
            />
            <TextField
              {...f('building_name')} label="Building Name"
              placeholder="Building name"
            />
            <TextField
              {...f('floor')} label="Floor"
              placeholder="Floor number or name"
            />
            <TextField
              {...f('room')} label="Room"
              placeholder="Room number or name"
            />

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
              <TextareaField
                {...f('item_description')} label="Item Description"
              />
            </div>

            {/* ── Pictures ──────────────────────────────────────── */}
            <SectionHeader title="Pictures" />
            <SelectField
              {...f('pictures_status')} label="Pictures' Status"
              options={['Yes', 'No', 'Consumable', 'Not applicable']}
            />
            <TextField
              {...f('department_for_pictures')}
              label="Department for Pictures"
              placeholder="Department name"
            />
            <div className="col-span-2">
              <FileUploadField
                name="picture"
                label="Picture / Attachment"
                value={form.picture}
                onChange={handleChange}
                folder="pictures"
              />
            </div>

            {/* ── Report ────────────────────────────────────────── */}
            <SectionHeader title="Report" />
            <NumberField
              {...f('no_of_beneficiaries')} label="No. of Beneficiaries"
            />
            <div>
              <label className={labelClass}>Report Status</label>
              <div className="mt-2">
                <StatusBadge status={reportStatus} />
                <p className="text-xs text-gray-400 mt-1">
                  Auto-calculated based on filled fields
                </p>
              </div>
            </div>
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
              {loading ? 'Saving to Google Sheets...' : 'Add Grant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddGrant