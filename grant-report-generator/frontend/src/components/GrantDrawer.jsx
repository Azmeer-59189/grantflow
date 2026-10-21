import { formatDate } from '../lib/dates'
import { grantStage } from '../lib/pipeline'
import GrantTimeline from './GrantTimeline'
import { Button, Drawer, Icon, StatusPill } from './ui'

const usd = v => (v || v === 0 ? `$${Number(v).toLocaleString()}` : '—')

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}
function Field({ label, value, emphasis }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-medium ${emphasis || 'text-slate-900'}`}>{value || value === 0 ? value : '—'}</dd>
    </div>
  )
}
function Status({ label, value }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1"><StatusPill value={value} /></dd></div>
}
function LinkField({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-800 hover:underline">
            Open <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        ) : <span className="text-slate-400">—</span>}
      </dd>
    </div>
  )
}
function Note({ title, children }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5 sm:col-span-2">
      <p className="mb-1 text-xs font-semibold text-slate-600">{title}</p>
      <p className="whitespace-pre-line text-sm text-slate-700">{children}</p>
    </div>
  )
}

export default function GrantDrawer({ grant: g, onClose, onEdit, onReport, canEdit }) {
  if (!g) return null
  const currency = g.secondary_currency || 'USD'
  const orig = v => (v || v === 0 ? `${currency} ${Number(v).toLocaleString()}` : '—')
  const paidShare = g.total_grant_amount_usd ? Math.min(100, Math.round((Number(g.current_payment_usd) || 0) / g.total_grant_amount_usd * 100)) : 0
  return (
    <Drawer open onClose={onClose} label={`Grant ${g.grant_number}`}>
      <header className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-600">{[g.chapter, g.country].filter(Boolean).join(' · ')}</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{g.grant_number}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">{[g.supplier, g.item].filter(Boolean).join(' — ')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill value={g.report_status} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/15">
            Next: {grantStage(g).label}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" icon="edit" disabled={!canEdit} title={!canEdit ? 'Editor access required' : undefined} onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="primary" icon="file" onClick={onReport}>Generate report</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/50 px-6 py-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs text-slate-500">Grant value</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{usd(g.total_grant_amount_usd)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs text-slate-500">Paid</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{usd(g.current_payment_usd)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-label="Share paid" aria-valuenow={paidShare} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${paidShare}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs text-slate-500">Beneficiaries</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{g.no_of_beneficiaries ?? '—'}</p>
          </div>
        </section>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><GrantTimeline grant={g} /></div>

        <div className="space-y-5 [&>section]:bg-white">
          <Section title="Grant overview">
            <Field label="Year" value={g.year} />
            <Field label="Project type" value={g.project_type} />
            <Field label="Department" value={g.department} />
            <Field label="PO / WO number" value={g.po_wo_number} />
            <Field label="Sub grant no." value={g.sub_grant_no} />
            <LinkField label="Complete documents" value={g.link_to_complete_documents} />
          </Section>

          <Section title="Financial summary">
            <Field label="Secondary currency" value={currency} />
            <Field label={`Total grant (${currency})`} value={orig(g.total_grant_amount_orig)} />
            <Field label={`Current payment (${currency})`} value={orig(g.current_payment_orig)} />
            <Field label="Remaining (USD)" value={usd(g.remaining_payment_usd)} emphasis="text-amber-700" />
            <Status label="Payment status" value={g.payment_status} />
            <LinkField label="Payment reference" value={g.payment_reference} />
          </Section>

          <Section title="Shipping & documents">
            <Status label="Shipping status" value={g.shipping_documents_status} />
            <Field label="Commercial invoice" value={g.commercial_invoice_no} />
            <Field label="Bill of lading" value={g.bill_of_lading} />
            <Field label="Packing list ref." value={g.packing_list_reference} />
            <LinkField label="Shipping documents" value={g.link_to_shipping_documents} />
            {g.shipping_documents_comment && <Note title="Shipping comment">{g.shipping_documents_comment}</Note>}
          </Section>

          <Section title="GRN / receiving">
            <Status label="GRN status" value={g.grn_receiving_status} />
            <Field label="Receiving date" value={formatDate(g.receiving_date)} />
            <Field label="GRN number" value={g.grn_number} />
            <LinkField label="Link to GRN" value={g.link_to_grn} />
            {g.grn_receiving_comments && <Note title="GRN comments">{g.grn_receiving_comments}</Note>}
          </Section>

          <Section title="Installation & item">
            <Field label="Installation date" value={formatDate(g.installation_date)} />
            <Field label="Location" value={[g.location, g.building_name, g.floor, g.room].filter(Boolean).join(', ')} />
            <Field label="Item model" value={g.item_model} />
            <Field label="Serial number" value={g.item_serial_number} />
            <Field label="Quantity" value={g.quantity} />
            <Field label="IHHN asset tag" value={g.ihhn_asset_tag_number} />
            {g.item_description && <Note title="Item description">{g.item_description}</Note>}
          </Section>

          <Section title="Pictures & report">
            <Status label="Pictures status" value={g.pictures_status} />
            <Field label="Department for pictures" value={g.department_for_pictures} />
            <LinkField label="Picture" value={g.picture} />
            <LinkField label="Utilization report" value={g.link_to_utilization_report} />
          </Section>
        </div>
      </div>
    </Drawer>
  )
}
