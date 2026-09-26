'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface PushSubscriptionState {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
}

interface UsePushSubscriptionReturn extends PushSubscriptionState {
  requestPermission: () => Promise<boolean>
  subscribe: (userId: string, isPro?: boolean) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    permission: 'unsupported',
    isSubscribed: false,
    isLoading: false,
    error: null,
  })

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // Check support & current state
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) {
      setState((s) => ({ ...s, isSupported: false, permission: 'unsupported' }))
      return
    }

    setState((s) => ({
      ...s,
      isSupported: true,
      permission: Notification.permission,
    }))

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      registrationRef.current = reg
      return reg.pushManager.getSubscription()
    }).then((sub) => {
      setState((s) => ({ ...s, isSubscribed: !!sub }))
    }).catch(() => {})
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false

    try {
      const permission = await Notification.requestPermission()
      setState((s) => ({ ...s, permission }))
      return permission === 'granted'
    } catch {
      return false
    }
  }, [state.isSupported])

  const subscribe = useCallback(async (userId: string, isPro?: boolean): Promise<boolean> => {
    if (!state.isSupported || !userId) return false

    // Pro check — push notifications require Pro account
    if (isPro === false) {
      setState((s) => ({
        ...s,
        error: 'Upgrade ke Pro untuk mengaktifkan notifikasi push',
      }))
      return false
    }

    setState((s) => ({ ...s, isLoading: true, error: null }))

    try {
      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) {
          setState((s) => ({ ...s, isLoading: false, error: 'Permission denied' }))
          return false
        }
      }

      // Get VAPID public key from server
      const keyRes = await fetch('/api/push/vapid-key')
      if (!keyRes.ok) {
        throw new Error('Push not configured on server')
      }
      const { publicKey } = await keyRes.json()

      if (!publicKey) {
        throw new Error('VAPID public key not available')
      }

      // Get service worker registration
      const reg = registrationRef.current || await navigator.serviceWorker.ready

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      })

      const subJson = subscription.toJSON()
      const endpoint = subJson.endpoint
      const p256dh = subJson.keys?.p256dh
      const auth = subJson.keys?.auth

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Invalid subscription data')
      }

      // Save to server
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent,
        }),
      })

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({}))
        // If server says not Pro, show upgrade message
        if (saveRes.status === 403) {
          throw new Error('Upgrade ke Pro untuk mengaktifkan notifikasi push')
        }
        throw new Error(errorData.error || 'Failed to save subscription')
      }

      setState((s) => ({
        ...s,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
      }))

      return true
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message || 'Failed to subscribe',
      }))
      return false
    }
  }, [state.isSupported, requestPermission])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, isLoading: true, error: null }))

    try {
      const reg = registrationRef.current || await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()

      if (subscription) {
        // Remove from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })

        // Unsubscribe from browser
        await subscription.unsubscribe()
      }

      setState((s) => ({
        ...s,
        isSubscribed: false,
        isLoading: false,
      }))

      return true
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message || 'Failed to unsubscribe',
      }))
      return false
    }
  }, [])

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
  }
}

/** Convert VAPID base64 public key to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
