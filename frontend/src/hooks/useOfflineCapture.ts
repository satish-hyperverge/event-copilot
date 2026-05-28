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
        synced: false,
      }

      if (navigator.onLine) {
        // Online: go directly to server, no need to queue
        const savedCapture = await captureApi.create({ ...capture })
        return { capture: savedCapture, synced: true }
      }

      // Offline: save lead and image blobs to IndexedDB for later sync.
      await db.transaction('rw', db.captures, db.captureImages, async () => {
        await db.captures.add(capture)
        if (images.length > 0) {
          await db.captureImages.bulkAdd(images.map(image => ({
            offline_id: capture.offline_id,
            file: image.file,
            filename: image.file.name || `${capture.offline_id}.jpg`,
            image_type: image.imageType,
            synced: false,
            created_at: new Date().toISOString(),
          })))
        }
      })
      const count = await db.captures.where('synced').equals(0).count()
      setPendingCount(count)
      return { capture, synced: false }
    },
    [activeEventId, currentUser, setPendingCount]
  )

  return { saveCapture }
}
