import { useCallback } from 'react'
import { db, type OfflineCapture } from '@/lib/db'
import { captureApi } from '@/lib/api'
import { useOfflineStore } from '@/store/offlineStore'
import { useUIStore } from '@/store/uiStore'

type OfflineImageInput = {
  file: File
  imageType: string
}

export function useOfflineCapture() {
  const { setPendingCount } = useOfflineStore()
  const { activeEventId, currentUser } = useUIStore()

  const queueCapture = useCallback(async (capture: OfflineCapture, images: OfflineImageInput[]) => {
    await db.transaction('rw', db.captures, db.captureImages, async () => {
      await db.captures.put(capture)
      if (images.length > 0) {
        await db.captureImages.bulkAdd(images.map(image => ({
          offline_id: capture.offline_id,
          file: image.file,
          filename: image.file.name || `${capture.offline_id}.jpg`,
          image_type: image.imageType,
          synced: 0,
          created_at: new Date().toISOString(),
        })))
      }
    })
    const captureCount = await db.captures.where('synced').equals(0).count()
    setPendingCount(captureCount)
  }, [setPendingCount])

  const saveCapture = useCallback(
    async (
      data: Omit<OfflineCapture, 'offline_id' | 'captured_at' | 'synced' | 'event_id'>,
      images: OfflineImageInput[] = []
    ) => {
      const capture: OfflineCapture = {
        ...data,
        offline_id: crypto.randomUUID(),
        event_id: activeEventId || 1,
        captured_by: data.captured_by || currentUser,
        captured_at: new Date().toISOString(),
        synced: 0,
      }

      if (navigator.onLine) {
        try {
          const { synced: _synced, ...payload } = capture
          const savedCapture = await captureApi.create(payload)
          return { capture: savedCapture, synced: true }
        } catch (err) {
          if (!navigator.onLine) {
            await queueCapture(capture, images)
            return { capture, synced: false }
          }
          throw err
        }
      }

      // Offline: save lead and image blobs to IndexedDB for later sync.
      await queueCapture(capture, images)
      return { capture, synced: false }
    },
    [activeEventId, currentUser, queueCapture]
  )

  return { saveCapture }
}
