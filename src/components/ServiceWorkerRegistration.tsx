'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!window.isSecureContext && window.location.hostname !== 'localhost') return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA installability should not block normal app usage.
    })
  }, [])

  return null
}
