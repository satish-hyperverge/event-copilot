import { useState, useRef, useEffect } from 'react'
import { aiApi, captureApi, type Priority } from '@/lib/api'
import { useOfflineCapture } from '@/hooks/useOfflineCapture'
import { useUIStore } from '@/store/uiStore'
import { useOfflineStore } from '@/store/offlineStore'
import {
  Mic, MicOff, Camera, FileText, CheckCircle2, Loader2,
  X, Plus, Calendar, AlertCircle, ImagePlus, ChevronLeft, ChevronRight,
  WifiOff, Cloud, CloudOff, Table2,
} from 'lucide-react'
import { syncToSheets, type SheetsPayload } from '@/lib/sheetsSync'

const PRIORITIES: { value: Priority; label: string; color: string; activeColor: string }[] = [
  { value: 'P0',        label: 'P0',         color: 'border-red-200 text-red-700 bg-red-50',     activeColor: 'border-red-500 bg-red-500 text-white ring-2 ring-red-200'   },
  { value: 'P1',        label: 'P1',         color: 'border-amber-200 text-amber-700 bg-amber-50', activeColor: 'border-amber-500 bg-amber-500 text-white ring-2 ring-amber-200' },
  { value: 'P2',        label: 'P2',         color: 'border-blue-200 text-blue-700 bg-blue-50',  activeColor: 'border-blue-500 bg-blue-500 text-white ring-2 ring-blue-200' },
  { value: 'Irrelevant',label: 'Irrelevant', color: 'border-gray-200 text-gray-500 bg-gray-50',  activeColor: 'border-gray-400 bg-gray-400 text-white ring-2 ring-gray-200' },
]

type CapturedImage = {
  id: string
  file: File
  previewUrl: string
  imageType: 'business_card' | 'photo' | 'classifying'
  scannedFields?: Record<string, string> | null
}

const toDateValue = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDueDate = (value: string) => {
  if (!value) return 'Select due date'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return 'Select due date'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const buildCalendarDays = (monthDate: Date) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export default function LeadCapture() {
  const { activeEventId, currentUser } = useUIStore()
  const { pendingCount, isSyncing } = useOfflineStore()
  const { saveCapture } = useOfflineCapture()

  const [manualName, setManualName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [designation, setDesignation] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [nextStep, setNextStep] = useState('')
  const [nextStepDate, setNextStepDate] = useState('')
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [activeInput, setActiveInput] = useState<'text' | 'voice' | 'scan' | null>(null)

  const [images, setImages] = useState<CapturedImage[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedFields, setScannedFields] = useState<Record<string, string> | null>(null)

  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [sheetStatus, setSheetStatus] = useState<'idle' | 'synced' | 'queued'>('idle')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptAccum = useRef('')
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedCaptureId = useRef<number | null>(null)

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  // Online/offline tracking
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const contactName = manualName
  const todayValue = toDateValue(new Date())
  const calendarDays = buildCalendarDays(calendarMonth)

  // ── Image handling ────────────────────────────────────────────────────────

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setActiveInput('scan')
    setScanError(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      const newImage: CapturedImage = { id, file, previewUrl, imageType: 'classifying' }
      setImages(prev => [...prev, newImage])
      processImage(id, file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processImage = async (id: string, file: File) => {
    try {
      const { image_type } = await aiApi.classifyImage(file)
      const isCard = image_type === 'business_card'

      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, imageType: isCard ? 'business_card' : 'photo' } : img
      ))

      if (isCard) {
        try {
          const result = await aiApi.scanCard(file)
          if (result.name) {
            setManualName(prev => prev.trim() ? prev : result.name)
          }
          if (result.company) {
            setCompanyName(prev => prev.trim() ? prev : result.company)
          }
          if (result.title) {
            setDesignation(prev => prev.trim() ? prev : result.title)
          }

          const fields: Record<string, string> = {}
          if (result.title)    fields['Title']    = result.title
          if (result.company)  fields['Company']  = result.company

          const extractedFields = Object.keys(fields).length > 0 ? fields : null
          setImages(prev => prev.map(img =>
            img.id === id ? { ...img, scannedFields: extractedFields } : img
          ))
          if (extractedFields) setScannedFields(extractedFields)
        } catch {
          setScanError('Could not extract card details. You can enter them manually.')
        }
      }
    } catch {
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, imageType: 'photo' } : img
      ))
    }
  }

  const removeImage = (id: string) => {
    setImages(prev => {
      const removing = prev.find(img => img.id === id)
      if (removing) URL.revokeObjectURL(removing.previewUrl)
      return prev.filter(img => img.id !== id)
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!contactName.trim()) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const commitment = nextStepDate ? `by ${nextStepDate}` : ''
      const captureMethod = images.some(i => i.imageType === 'business_card')
        ? 'card_scan'
        : savedAudioUrl
        ? 'voice_note'
        : 'manual'

      const result = await saveCapture({
        name: contactName,
        company: companyName.trim() || scannedFields?.Company || undefined,
        title: designation.trim() || scannedFields?.Title || undefined,
        phone: undefined,
        email: undefined,
        linkedin: undefined,
        priority: priority || 'P2',
        segment: 'cold',
        notes: notes || undefined,
        product_interest: companyType.trim() || undefined,
        next_step: nextStep || undefined,
        follow_up_date: nextStepDate || undefined,
        commitment_made: commitment || undefined,
        capture_method: captureMethod,
        image_count: images.length,
        captured_by: currentUser,
      }, images.map(img => ({
        file: img.file,
        imageType: img.imageType === 'classifying' ? 'photo' : img.imageType,
      })))

      // Upload images if online and capture was saved with an ID
      if (result.synced && images.length > 0) {
        try {
          const captureId = (result as { capture: { id?: number } }).capture?.id
          if (captureId) {
            savedCaptureId.current = captureId
            await Promise.all(
              images.map(img =>
                captureApi.uploadImage(
                  captureId,
                  img.file,
                  img.imageType === 'classifying' ? 'photo' : img.imageType
                )
              )
            )
          }
        } catch { /* image upload is non-blocking */ }
      }

      // Sync to Google Sheets (if webhook configured)
      const sheetsPayload: SheetsPayload = {
        name: contactName,
        company:  companyName.trim() || scannedFields?.Company || '',
        title:    designation.trim() || scannedFields?.Title || '',
        email:    '',
        phone:    '',
        linkedin: '',
        priority: priority || 'P2',
        notes:    [notes, companyType.trim() ? `Type of company: ${companyType.trim()}` : ''].filter(Boolean).join('\n'),
        nextSteps:   nextStep || '',
        followUpDate: nextStepDate || '',
        captureMethod,
        timestamp: new Date().toISOString(),
        imageCount: images.length,
      }

      const status = await syncToSheets(sheetsPayload)
      setSheetStatus(status)

      setSaved(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save lead. Check backend logs.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl))
    setManualName('')
    setCompanyName('')
    setCompanyType('')
    setDesignation('')
    setNotes('')
    setPriority(null)
    setNextStep('')
    setNextStepDate('')
    setActiveInput(null)
    setImages([])
    setScannedFields(null)
    setScanError(null)
    setSavedAudioUrl(null)
    setMicError(null)
    setSaved(false)
    setSaveError(null)
    setSheetStatus('idle')
    savedCaptureId.current = null
  }

  // ── Voice recording ───────────────────────────────────────────────────────

  const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
    const w = window as unknown as Record<string, unknown>
    return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognition) | null
  }

  const startRecording = async () => {
    setMicError(null)
    setSavedAudioUrl(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow access in your browser settings.'
        : 'Could not access microphone. Check your device.'
      setMicError(msg)
      return
    }

    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setSavedAudioUrl(URL.createObjectURL(blob))
    }
    mr.start()
    mediaRef.current = mr

    // Real-time transcription via Web Speech API (no backend call)
    transcriptAccum.current = ''
    const SpeechRec = getSpeechRecognition()
    if (SpeechRec) {
      const recognition = new SpeechRec()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = ''
        let interimText = ''
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i]
          if (r.isFinal) finalText += r[0].transcript
          else interimText += r[0].transcript
        }
        transcriptAccum.current = finalText
        setNotes(finalText + (interimText || ''))
      }
      recognition.onerror = () => {}
      recognition.start()
      recognitionRef.current = recognition
    }

    setIsRecording(true)
    setActiveInput('voice')
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    mediaRef.current = null
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
    const SpeechRec = getSpeechRecognition()
    if (!SpeechRec && !transcriptAccum.current) {
      setMicError('Live transcription not supported in this browser — audio saved.')
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const isClassifying = images.some(img => img.imageType === 'classifying')

  // ── Success screen ────────────────────────────────────────────────────────

  if (saved) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Lead Captured!</h2>
          <p className="text-gray-500 mt-1 text-sm">
            <span className="font-medium text-gray-700">{contactName}</span>
          </p>

          {!isOnline ? (
            <div className="mt-3 mx-auto max-w-xs px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-center gap-2">
                <CloudOff className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Saved offline</span>
              </div>
              <p className="text-xs text-amber-600 mt-0.5">Will sync automatically when you reconnect</p>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-green-600">
              <Cloud className="w-4 h-4" />
              Synced to server
            </div>
          )}

          {sheetStatus !== 'idle' && (
            <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              sheetStatus === 'synced'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {sheetStatus === 'synced' ? (
                <><Table2 className="w-3 h-3" /> Synced to Google Sheets</>
              ) : (
                <><CloudOff className="w-3 h-3" /> Queued for Sheets — will sync on reconnect</>
              )}
            </div>
          )}

          {images.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">{images.length} image{images.length > 1 ? 's' : ''} attached</p>
          )}

          <button onClick={resetForm} className="btn-primary mt-6 px-8">
            <Plus className="w-4 h-4" />
            Capture Another
          </button>
        </div>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Capture Lead</h1>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">You're offline</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Captures save locally and sync when you reconnect.
              {pendingCount > 0 && <span className="font-semibold"> {pendingCount} queued.</span>}
            </p>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
          {isSyncing
            ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            : <Cloud className="w-4 h-4 text-blue-600" />
          }
          <span className="text-sm text-blue-800">
            {isSyncing ? 'Syncing...' : `${pendingCount} capture${pendingCount > 1 ? 's' : ''} waiting to sync`}
          </span>
        </div>
      )}

      {/* ── Section 1: Who are you meeting? ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">
          Who are you meeting? <span className="text-red-600" aria-hidden="true">*</span>
        </p>

        <div className="relative mb-4">
          <input
            className="input pr-9"
            placeholder="Type a name..."
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            required
            aria-required="true"
          />
          {manualName && (
            <button
              onClick={() => setManualName('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear name"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Company Name</label>
            <input
              className="input"
              placeholder="Optional"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Type of company</label>
            <input
              className="input"
              placeholder="Optional"
              value={companyType}
              onChange={e => setCompanyType(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Designation</label>
            <input
              className="input"
              placeholder="Optional"
              value={designation}
              onChange={e => setDesignation(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Section 2: Add information ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">Add information</p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Photo / card scan */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isClassifying}
            className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-brand-300 ${
              activeInput === 'scan' ? 'border-brand-500 bg-brand-50' : ''
            }`}
          >
            {isClassifying
              ? <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
              : <Camera className="w-5 h-5 text-brand-600" />
            }
            <span className="text-xs font-medium text-gray-700">
              {isClassifying ? 'Processing...' : 'Add Photo'}
            </span>
          </button>

          {/* Text note */}
          <button
            onClick={() => setActiveInput('text')}
            className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-brand-300 ${
              activeInput === 'text' ? 'border-brand-500 bg-brand-50' : ''
            }`}
          >
            <FileText className="w-5 h-5 text-brand-600" />
            <span className="text-xs font-medium text-gray-700">Add Text</span>
          </button>

          {/* Voice note */}
          <button
            onClick={() => isRecording ? stopRecording() : startRecording()}
            className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-brand-300 ${
              isRecording
                ? 'border-red-500 bg-red-50'
                : activeInput === 'voice'
                ? 'border-brand-500 bg-brand-50'
                : ''
            }`}
          >
            {isRecording
              ? <MicOff className="w-5 h-5 text-red-600" />
              : <Mic className="w-5 h-5 text-brand-600" />
            }
            <span className="text-xs font-medium text-gray-700">
              {isRecording ? `Stop ${formatTime(recordingSeconds)}` : 'Voice Note'}
            </span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImagePick}
        />

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-red-50 border border-red-200 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-700 font-medium">Recording... {formatTime(recordingSeconds)}</span>
            <button onClick={stopRecording} className="ml-auto text-xs font-medium text-red-600 hover:text-red-800">Stop</button>
          </div>
        )}

        {/* Mic error */}
        {micError && (
          <div className="flex items-start gap-2 px-3 py-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-sm text-amber-800">{micError}</span>
            <button onClick={() => setMicError(null)} className="ml-auto text-amber-500 hover:text-amber-700 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Saved audio playback */}
        {savedAudioUrl && !isRecording && (
          <div className="mb-3 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
            <audio controls src={savedAudioUrl} className="w-full h-8" />
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className="flex items-start gap-2 px-3 py-2 mb-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{scanError}</span>
            <button onClick={() => setScanError(null)} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {saveError && (
          <div className="flex items-start gap-2 px-3 py-2 mb-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.map(img => (
              <div key={img.id} className="relative card overflow-hidden">
                <img src={img.previewUrl} alt="" className="w-full h-20 object-cover" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                >
                  <X className="w-3 h-3" />
                </button>
                {img.imageType === 'classifying' && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                  </div>
                )}
                <div className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] font-semibold text-center ${
                  img.imageType === 'business_card'
                    ? 'bg-green-600/90 text-white'
                    : img.imageType === 'classifying'
                    ? 'bg-gray-400/90 text-white'
                    : 'bg-gray-600/90 text-white'
                }`}>
                  {img.imageType === 'business_card' ? 'Business Card' : img.imageType === 'classifying' ? 'Analyzing...' : 'Photo'}
                </div>
                {img.imageType === 'business_card' && img.scannedFields && (
                  <div className="px-1.5 py-1 border-t border-gray-100 space-y-0.5">
                    {Object.entries(img.scannedFields).slice(0, 3).map(([key, val]) => (
                      <div key={key} className="text-[10px] text-gray-600 truncate">
                        <span className="text-gray-400">{key}: </span>{val}
                      </div>
                    ))}
                    {Object.keys(img.scannedFields).length > 3 && (
                      <div className="text-[10px] text-gray-400">+{Object.keys(img.scannedFields).length - 3} more</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="card h-20 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-brand-600 hover:border-brand-300 transition-colors"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-[10px] font-medium">Add more</span>
            </button>
          </div>
        )}

        {/* Notes textarea */}
        {(activeInput || notes) && (
          <textarea
            className="input"
            rows={4}
            placeholder="Notes from your conversation..."
            value={notes}
            onChange={e => { setNotes(e.target.value); if (!activeInput) setActiveInput('text') }}
            autoFocus={activeInput === 'text'}
          />
        )}
      </section>

      {/* ── Section 3: Priority ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">
          How important is this? <span className="text-red-600" aria-hidden="true">*</span>
        </p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-required="true" aria-label="Lead priority">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => setPriority(p.value)}
              role="radio"
              aria-checked={priority === p.value}
              className={`py-2.5 px-2 rounded-lg border text-sm font-semibold text-center transition-all ${
                priority === p.value ? p.activeColor : p.color
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {priority === null && (
          <p className="text-xs text-gray-400 mt-1.5">Select a priority level</p>
        )}
      </section>

      {/* ── Section 4: Next steps ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">Next steps</p>
        <div className="space-y-2">
          <div>
            <textarea
              className="input"
              rows={4}
              placeholder="What needs to happen? e.g. Send proposal, Schedule demo..."
              value={nextStep}
              onChange={e => setNextStep(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Due date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <button
                type="button"
                onClick={() => setDatePickerOpen(open => !open)}
                className={`input flex w-full items-center pl-9 text-left ${
                  nextStepDate ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {formatDueDate(nextStepDate)}
              </button>

              {datePickerOpen && (
                <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-sm font-semibold text-gray-900">
                      {new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(calendarMonth)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-gray-400">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-1">{day}</div>
                    ))}
                  </div>

                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {calendarDays.map(date => {
                      const value = toDateValue(date)
                      const isSelected = value === nextStepDate
                      const isToday = value === todayValue
                      const isPast = value < todayValue
                      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={isPast}
                          onClick={() => {
                            setNextStepDate(value)
                            setDatePickerOpen(false)
                          }}
                          className={`h-8 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-brand-600 text-white'
                              : isPast
                              ? 'cursor-not-allowed text-gray-300'
                              : isToday
                              ? 'border border-brand-500 bg-brand-50 text-brand-700'
                              : isCurrentMonth
                              ? 'text-gray-800 hover:bg-brand-50 hover:text-brand-700'
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setNextStepDate('')}
                      className="text-sm font-medium text-gray-500 hover:text-gray-800"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date()
                        setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                        setNextStepDate(toDateValue(today))
                        setDatePickerOpen(false)
                      }}
                      className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                    >
                      Today
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Save button (sticky on mobile) ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 lg:static lg:border-0 lg:bg-transparent lg:mt-2 lg:p-0 lg:backdrop-blur-none">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || !contactName.trim() || priority === null}
            className="btn-primary w-full py-3 text-base"
          >
            {isSaving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> {isOnline ? 'Save Lead' : 'Save Offline'}</>
            )}
          </button>
          {!isOnline && (
            <p className="text-center text-xs text-amber-600 mt-1.5">Will sync when back online</p>
          )}
        </div>
      </div>
    </div>
  )
}
