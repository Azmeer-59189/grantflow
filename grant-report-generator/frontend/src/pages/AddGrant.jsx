import GrantSections from '../components/GrantSections'
import FormProgress from '../components/FormProgress'
import useUnsavedChanges from '../hooks/useUnsavedChanges'
import { apiFetch } from '../lib/api'
import { useState } from 'react'
import FileUploadField from '../components/FileUploadField'
import AppShell from '../components/AppShell'
import { StatusPill } from '../components/ui'
import {
  DateField, FormSaveBar, labelClass, LinkField, NumberField, ReadOnlyField,
  SectionHeader, SelectField, TextareaField, TextField,
} from '../components/GrantFormFields'
import ExchangeRateField from '../components/ExchangeRateField'
import useExchangeRate from '../hooks/useExchangeRate'
import useUploadCleanup from '../hooks/useUploadCleanup'
import { applyAmounts, calcReportStatus, toPayload } from '../lib/grantForm'
import { useNavigate } from 'react-router-dom'

// ── Constants ──────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  year: '',
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

const ALL_PROJECT_TYPES = ['Expansion', 'Non-Expansion']
const PROJECT_TYPES_BY_CHAPTER = { 'IHN UK': ['Expansion'] }   // keep in sync with the backend
function projectTypesFor(chapter) {
  return PROJECT_TYPES_BY_CHAPTER[chapter] || ALL_PROJECT_TYPES
}

// ── Main component ─────────────────────────────────────────────────────────
function AddGrant() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(INITIAL_FORM)
  const fx = useExchangeRate()
  const uploads = useUploadCleanup()
  const rateMissing = Boolean(form.secondary_currency) && !fx.rate

  const { dirty, markSaved } = useUnsavedChanges(form)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => {
      let updated = { ...prev, [name]: value }

      if (name === 'chapter') {
        const allowed = projectTypesFor(value)
        if (!allowed.includes(updated.project_type)) {
          updated.project_type = allowed.length === 1 ? allowed[0] : ''
        }
      }

      // USD amounts follow the original-currency amounts and the exchange rate
      if (name === 'total_grant_amount_orig') updated = applyAmounts(updated, fx.rate, ['total'])
      if (name === 'current_payment_orig') updated = applyAmounts(updated, fx.rate, ['current'])
      if (name === 'secondary_currency') updated = applyAmounts(updated, value ? null : 1)

      return updated
    })
    if (name === 'secondary_currency') {
      fx.loadRate(value).then(rate => { if (rate) setForm(prev => applyAmounts(prev, rate)) })
    }
  }

  function handleRateChange(value) {
    fx.setRate(value)
    const rate = parseFloat(value)
    setForm(prev => applyAmounts(prev, rate > 0 ? rate : null))
  }

  async function handleSubmit() {
    if (rateMissing) {
      setError(`Enter the ${form.secondary_currency} to USD exchange rate before saving.`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch(
        `${import.meta.env.VITE_API_URL}/api/grants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...toPayload(form), exchange_rate: form.secondary_currency ? fx.rate : null }),
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
      markSaved()
      uploads.commit()
      navigate('/',{ state: { notice: data.audit_warning || 'Grant saved successfully.' } })
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
    <AppShell
      title="Add new grant"
      subtitle={"Required fields are marked with *. Everything else can be filled in as it arrives."}
      back={{ to: '/?view=records', label: 'Back to records' }}
      actions={form.secondary_currency && fx.rate && (
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          1 {form.secondary_currency} = {fx.rate.toFixed(4)} USD
        </span>
      )}
    >
          <fieldset disabled={loading} className="min-w-0">
          <GrantSections form={form} aside={<FormProgress form={form} dirty={dirty} />}>

            {/* ── Basic Information ─────────────────────────────── */}
            <SectionHeader sectionMarker title="Basic Information" />
            <TextField
              {...f('year')}
              label="Year"
              required
              placeholder="e.g. 2026"
            />
            <SelectField
              {...f('country')} label="Country" required
              options={[
                'United States', 'Canada', 'United Kingdom',
                'Germany', 'Switzerland', 'UAE'
              ]}
            />
            <SelectField
              {...f('chapter')} label="Chapter" required
              options={['FOIHUS', 'IDF', 'TIH UAE', 'IHN UK', 'FOIH Germany', 'FOIH Switzerland']}
            />
            <TextField
              {...f('grant_number')} label="Grant Number" required
              placeholder="e.g. IHHN-FOIH-USA-Grant-0001-2026"
            />
            <SelectField
              {...f('project_type')} label="Project Type" required
              options={projectTypesFor(form.chapter)}
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
            <div className="col-span-full">
              <LinkField
                {...f('link_to_complete_documents')}
                label="Link to Complete Documents (Grant Application, PO & Invoice)"
              />
            </div>

            {/* ── Financial Details ─────────────────────────────── */}
            <SectionHeader sectionMarker title="Financial Details" />

            {/* Primary currency — always USD */}
            <ReadOnlyField id="primary_currency" label="Primary currency" value="USD" hint="All amounts are also kept in USD." />

            {/* Secondary currency — user selects */}
            <SelectField
              {...f('secondary_currency')} label="Secondary Currency"
              options={['CAD', 'EUR', 'AED', 'AUD', 'GBP']}
            />
            <ExchangeRateField currency={form.secondary_currency} fx={fx} onChange={handleRateChange} />

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
            <div className="col-span-full">
              <FileUploadField
                name="payment_reference"
                label="Payment Reference (Attachment)"
                value={form.payment_reference}
                onChange={handleChange}
                folder="payment-references"
                uploads={uploads}
              />
            </div>

            {/* ── Key Dates ─────────────────────────────────────── */}
            <SectionHeader sectionMarker title="Key Dates" />
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
            <SectionHeader sectionMarker title="Shipping & Documents" />
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
            <div className="col-span-full">
              <TextareaField
                {...f('shipping_documents_comment')}
                label="Shipping Documents Comment"
              />
            </div>
            <div className="col-span-full">
              <LinkField
                {...f('link_to_shipping_documents')}
                label="Link to Shipping Documents"
              />
            </div>

            {/* ── GRN / Receiving ───────────────────────────────── */}
            <SectionHeader sectionMarker title="GRN / Receiving" />
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
            <div className="col-span-full">
              <LinkField {...f('link_to_grn')} label="Link to GRN" />
            </div>
            <div className="col-span-full">
              <TextareaField
                {...f('grn_receiving_comments')}
                label="GRN / Receiving Comments"
              />
            </div>

            {/* ── Installation & Location ───────────────────────── */}
            <SectionHeader sectionMarker title="Installation & Location" />
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
            <SectionHeader sectionMarker title="Item Details" />
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
            <div className="col-span-full">
              <TextareaField
                {...f('item_description')} label="Item Description"
              />
            </div>

            {/* ── Pictures ──────────────────────────────────────── */}
            <SectionHeader sectionMarker title="Pictures" />
            <SelectField
              {...f('pictures_status')} label="Pictures' Status"
              options={['Yes', 'No', 'Consumable', 'Not applicable']}
            />
            <TextField
              {...f('department_for_pictures')}
              label="Department for Pictures"
              placeholder="Department name"
            />
            <div className="col-span-full">
              <FileUploadField
                name="picture"
                label="Picture / Attachment"
                value={form.picture}
                onChange={handleChange}
                folder="pictures"
                uploads={uploads}
              />
            </div>

            {/* ── Report ────────────────────────────────────────── */}
            <SectionHeader sectionMarker title="Report" />
            <NumberField
              {...f('no_of_beneficiaries')} label="No. of Beneficiaries"
            />
            <div>
              <p className={labelClass}>Report Status</p>
              <div className="mt-2">
                <StatusPill value={reportStatus} />
                <p className="mt-1.5 text-xs text-slate-500">
                  Auto-calculated based on filled fields
                </p>
              </div>
            </div>
            <div className="col-span-full">
              <LinkField
                {...f('link_to_utilization_report')}
                label="Link to Utilization Report"
              />
            </div>

          </GrantSections>
          </fieldset>

      <FormSaveBar
        status={reportStatus} dirty={dirty} error={error}
        saving={loading} disabled={rateMissing}
        saveLabel={'Add grant'} savingLabel={'Saving to Google Sheets…'}
        onSave={handleSubmit} onCancel={() => navigate(-1)}
      />
    </AppShell>
  )
}

export default AddGrant