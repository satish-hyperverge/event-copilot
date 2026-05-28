import { useEffect, useCallback } from 'react'
import { db } from '@/lib/db'
import { captureApi } from '@/lib/api'
import { useOfflineStore } from '@/store/offlineStore'

export function useSync() {
  const { setIsSyncing, setPendingCount, setLastSyncAt } = useOfflineStore()

  const updatePendingCount = useCallback(async () => {
    const [captureCount, imageCount] = await Promise.all([
      db.captures.where('synced').equals(0).count(),
      db.captureImages.where('synced').equals(0).count(),
    ])
    setPendingCount(captureCount + imageCount)
  }, [setPendingCount])

  const sync = useCallback(async () => {
    const pending = await db.captures.where('synced').equals(0).toArray()
    const pendingImages = await db.captureImages.where('synced').equals(0).toArray()
    if (pending.length === 0 && pendingImages.length === 0) return

    setIsSyncing(true)
    try {
      let captureIds: Record<string, number> = {}

      if (pending.length > 0) {
        const syncResult = await captureApi.sync(pending.map(c => ({ ...c, synced: undefined })))
        captureIds = syncResult.capture_ids || {}
        const ids = pending.map(c => c.offline_id)
        await db.captures.where('offline_id').anyOf(ids).modify({ synced: 1 })
      }

      const imagesToSync = await db.captureImages.where('synced').equals(0).toArray()
      for (const image of imagesToSync) {
        const captureId = captureIds[image.offline_id]
        if (!captureId) {
          const matchingCapture = await db.captures.get(image.offline_id)
          if (!matchingCapture?.synced) continue

          const lookup = await captureApi.sync([{ ...matchingCapture, synced: undefined }])
          Object.assign(captureIds, lookup.capture_ids || {})
        }

        const resolvedCaptureId = captureIds[image.offline_id]
        if (!resolvedCaptureId || image.id === undefined) continue

        const file = new File([image.file], image.filename, {
          type: image.file.type || 'image/jpeg',
        })
        await captureApi.uploadImage(resolvedCaptureId, file, image.image_type)
        await db.captureImages.update(image.id, { synced: true })
      }

      setLastSyncAt(new Date().toISOString())
      await updatePendingCount()
    } catch {
      // Sync failed (still offline) — will retry on next reconnect
    } finally {
      setIsSyncing(false)
    }
  }, [setIsSyncing, setLastSyncAt, updatePendingCount])

  useEffect(() => {
    updatePendingCount()

    const handleOnline = () => sync()
    window.addEventListener('online', handleOnline)

    // Also sync on mount if online
    if (navigator.onLine) sync()

    return () => window.removeEventListener('online', handleOnline)
  }, [sync, updatePendingCount])

  return { sync, updatePendingCount }
}
