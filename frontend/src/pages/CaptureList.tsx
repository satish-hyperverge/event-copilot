import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { captureApi, type LeadCapture, type Priority } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import {
  RefreshCw, Search, Table2, Mail, Phone, Linkedin, CalendarDays, Image as ImageIcon,
  X, User, Building2, FileText, Download,
} from 'lucide-react'

const PRIORITY_CLASS: Record<Priority, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  Irrelevant: 'bg-gray-100 text-gray-500',
}

function parseServerDate(value?: string) {
  if (!value) return '-'
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
}

function formatDate(value?: string) {
  const date = parseServerDate(value)
  if (date === '-') return '-'
  if (Number.isNaN(date.getTime())) return value || '-'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date).replace(/\b(am|pm)\b/g, match => match.toUpperCase())
}

function formatDueDate(value?: string) {
  if (!value) return '-'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatCsvDateTime(value?: string) {
  const date = parseServerDate(value)
  if (date === '-') return ''
  if (Number.isNaN(date.getTime())) return value || ''
  return date.toISOString()
}

function csvValue(value?: string | number | null) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return `"${normalized.replace(/"/g, '""')}"`
}

function downloadCsv(captures: LeadCapture[]) {
  const headers = [
    'Name',
    'Company name',
    'Type of company',
    'Designation',
    'Email',
    'Phone',
    'LinkedIn',
    'Priority',
    'Segment',
    'Notes',
    'Next steps',
    'Due date',
    'Commitment made',
    'Capture method',
    'Image count',
    'Captured by',
    'Date of capture',
  ]

  const rows = captures.map(capture => [
    capture.name,
    capture.company,
    capture.product_interest,
    capture.title,
    capture.email,
    capture.phone,
    capture.linkedin,
    capture.priority,
    capture.segment,
    capture.notes,
    capture.next_step,
    capture.follow_up_date,
    capture.commitment_made,
    capture.capture_method || 'manual',
    capture.image_count ?? 0,
    capture.captured_by,
    formatCsvDateTime(capture.captured_at),
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(csvValue).join(','))
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `saved-leads-${date}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
        {value === null || value === undefined || value === '' ? '-' : value}
      </dd>
    </div>
  )
}

function ContactField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value?: string | null
}) {
  if (!value) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase text-gray-400">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-gray-900">{value}</dd>
      </div>
    </div>
  )
}

function CaptureImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-48 w-full items-center justify-center bg-gray-50 px-4 text-center text-sm text-gray-500">
        Image unavailable
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-48 w-full object-cover transition-transform group-hover:scale-[1.02]"
      onError={() => setFailed(true)}
    />
  )
}

function CaptureDetailsModal({
  capture,
  onClose,
}: {
  capture: LeadCapture
  onClose: () => void
}) {
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['capture-images', capture.id],
    queryFn: () => captureApi.listImages(capture.id),
    enabled: Boolean(capture.id),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[92vh] overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-w-3xl sm:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-gray-200 px-5 py-4">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 break-words">{capture.name}</h2>
              <span className={`badge ${PRIORITY_CLASS[capture.priority] || PRIORITY_CLASS.P2}`}>
                {capture.priority}
              </span>
            </div>
            <p className="text-sm text-gray-500 break-words">{capture.company || 'No company'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close lead details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-82px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section>
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900">
                <Building2 className="w-4 h-4 text-gray-400" />
                Lead profile
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Name" value={capture.name} />
                <DetailField label="Company Name" value={capture.company} />
                <DetailField label="Type of company" value={capture.product_interest} />
                <DetailField label="Designation" value={capture.title} />
                <DetailField label="Priority" value={capture.priority} />
              </dl>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900">
                <Mail className="w-4 h-4 text-gray-400" />
                Contact
              </div>
              <dl className="grid gap-2">
                <ContactField icon={Mail} label="Email" value={capture.email} />
                <ContactField icon={Phone} label="Phone" value={capture.phone} />
                <ContactField icon={Linkedin} label="LinkedIn" value={capture.linkedin} />
                {!capture.email && !capture.phone && !capture.linkedin && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
                    No contact details saved
                  </div>
                )}
              </dl>
            </section>
          </div>

          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900">
              <FileText className="w-4 h-4 text-gray-400" />
              Notes and next steps
            </div>
            <dl className="grid gap-4">
              <DetailField label="Notes" value={capture.notes} />
              <DetailField label="Next steps" value={capture.next_step} />
              <DetailField label="Due date" value={formatDueDate(capture.follow_up_date)} />
            </dl>
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              Images
            </div>
            {imagesLoading ? (
              <div className="text-sm text-gray-500">Loading images...</div>
            ) : images.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {images.map(image => (
                  <a
                    key={image.id}
                    href={captureApi.imageUrl(image.filename)}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <CaptureImagePreview src={captureApi.imageUrl(image.filename)} alt={image.image_type} />
                    <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600">
                      <span>{image.image_type}</span>
                      <span>{formatDate(image.created_at)}</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No images attached</div>
            )}
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              Capture
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Capture method" value={capture.capture_method || 'manual'} />
              <DetailField label="Image count" value={capture.image_count ?? 0} />
              <DetailField label="Date of lead capture" value={formatDate(capture.captured_at)} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

function CaptureRow({
  capture,
  onOpen,
}: {
  capture: LeadCapture
  onOpen: (capture: LeadCapture) => void
}) {
  return (
    <tr
      onClick={() => onOpen(capture)}
      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(capture)
        }
      }}
    >
      <td className="w-[240px] px-4 py-3 align-top">
        <div className="font-medium text-gray-900">{capture.name}</div>
      </td>
      <td className="w-[240px] px-4 py-3 align-top text-sm text-gray-700">{capture.company || '-'}</td>
      <td className="w-[210px] px-4 py-3 align-top text-sm text-gray-700">{capture.product_interest || '-'}</td>
      <td className="w-[220px] px-4 py-3 align-top text-sm text-gray-700">
        <div>{capture.title || '-'}</div>
      </td>
      <td className="w-[290px] px-4 py-3 align-top">
        <div className="space-y-1 text-xs text-gray-600">
          {capture.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate max-w-[190px]">{capture.email}</span>
            </div>
          )}
          {capture.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>{capture.phone}</span>
            </div>
          )}
          {capture.linkedin && (
            <div className="flex items-center gap-1.5">
              <Linkedin className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate max-w-[190px]">{capture.linkedin}</span>
            </div>
          )}
          {!capture.email && !capture.phone && !capture.linkedin && '-'}
        </div>
      </td>
      <td className="w-[110px] px-4 py-3 align-top">
        <span className={`badge ${PRIORITY_CLASS[capture.priority] || PRIORITY_CLASS.P2}`}>
          {capture.priority}
        </span>
      </td>
      <td className="w-[260px] px-4 py-3 align-top text-sm text-gray-700">
        <p className="max-h-16 overflow-hidden whitespace-pre-wrap">{capture.notes || '-'}</p>
      </td>
      <td className="w-[260px] px-4 py-3 align-top text-sm text-gray-700">
        <p className="max-h-16 overflow-hidden whitespace-pre-wrap">{capture.next_step || '-'}</p>
      </td>
      <td className="w-[150px] px-4 py-3 align-top text-sm text-gray-700">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
          {formatDueDate(capture.follow_up_date)}
        </div>
      </td>
      <td className="w-[170px] px-4 py-3 align-top text-sm text-gray-700">{formatDate(capture.captured_at)}</td>
    </tr>
  )
}

export default function CaptureList() {
  const { activeEventId } = useUIStore()
  const [search, setSearch] = useState('')
  const [selectedCapture, setSelectedCapture] = useState<LeadCapture | null>(null)

  const params = activeEventId ? { event_id: activeEventId, limit: 200 } : { limit: 200 }
  const { data: captures = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['captures', params],
    queryFn: () => captureApi.list(params),
  })

  const filteredCaptures = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return captures
    return captures.filter(c =>
      [c.name, c.company, c.title, c.email, c.phone, c.linkedin, c.notes, c.next_step]
        .some(value => value?.toLowerCase().includes(q))
    )
  }, [captures, search])

  const counts = useMemo(() => ({
    total: captures.length,
    P0: captures.filter(c => c.priority === 'P0').length,
    withImages: captures.filter(c => (c.image_count ?? 0) > 0).length,
  }), [captures])

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts.total} captures, {counts.P0} P0, {counts.withImages} with images
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:self-start">
          <button
            onClick={() => downloadCsv(filteredCaptures)}
            className="btn-secondary"
            disabled={isLoading || filteredCaptures.length === 0}
            title="Download visible saved leads as CSV"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search saved leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading saved leads...</div>
        ) : filteredCaptures.length === 0 ? (
          <div className="p-10 text-center">
            <Table2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">No saved leads found</p>
            <p className="text-xs text-gray-500 mt-1">Captures saved from the form will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2150px] table-fixed text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[240px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Name</th>
                  <th className="w-[240px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Company name</th>
                  <th className="w-[210px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Type of company</th>
                  <th className="w-[220px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Designation</th>
                  <th className="w-[290px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Contact</th>
                  <th className="w-[110px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Priority</th>
                  <th className="w-[260px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Notes</th>
                  <th className="w-[260px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Next steps</th>
                  <th className="w-[150px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Due date</th>
                  <th className="w-[170px] px-4 py-3 text-xs font-semibold uppercase text-gray-500">Date of capture</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredCaptures.map(capture => (
                  <CaptureRow key={capture.id} capture={capture} onOpen={setSelectedCapture} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCapture && (
        <CaptureDetailsModal
          capture={selectedCapture}
          onClose={() => setSelectedCapture(null)}
        />
      )}
    </div>
  )
}
