import Dexie, { type Table } from 'dexie'
import type { Priority, Segment } from './api'

export interface OfflineCapture {
  offline_id: string  // primary key, crypto.randomUUID()
  event_id: number
  captured_by?: string
  name: string
  company?: string
  title?: string
  phone?: string
  email?: string
  linkedin?: string
  priority: Priority
  segment: Segment
  notes?: string
  product_interest?: string
  next_step?: string
  follow_up_date?: string
  commitment_made?: string
  capture_method?: string
  image_count?: number
  captured_at: string
  synced: boolean
  prospect_id?: number
}

export interface OfflineCaptureImage {
  id?: number
  offline_id: string
  file: Blob
  filename: string
  image_type: string
  synced: boolean
  created_at: string
}

class ConferenceLeadDB extends Dexie {
  captures!: Table<OfflineCapture>
  captureImages!: Table<OfflineCaptureImage, number>

  constructor() {
    super('ConferenceLeadPlatform')
    this.version(1).stores({
      captures: 'offline_id, event_id, synced, captured_at',
    })
    this.version(2).stores({
      captures: 'offline_id, event_id, synced, captured_at',
      captureImages: '++id, offline_id, synced, created_at',
    })
  }
}

export const db = new ConferenceLeadDB()
