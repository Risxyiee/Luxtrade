'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  isProUser,
  getProDaysRemaining,
  getProExpiryDate,
  canAccessProFeature,
  getSubscriptionStatusText,
  validateSubscriptionFromMetadata
} from '@/lib/subscription'

export interface SubscriptionState {
  isPro: boolean
  daysRemaining: number
  expiryDate: string | null
  statusText: string
  canAccessFeatures: boolean
  isLoading: boolean
  error: string | null
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    isPro: false,
    daysRemaining: 0,
    expiryDate: null,
    statusText: 'FREE',
    canAccessFeatures: false,
    isLoading: true,
    error: null
  })

  useEffect(() => {
    async function checkSubscription() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setState(prev => ({ ...prev, isLoading: false, statusText: 'FREE' }))
          return
        }

        const subscription = validateSubscriptionFromMetadata(user.user_metadata)

        setState({
          isPro: isProUser(subscription),
          daysRemaining: getProDaysRemaining(subscription),
          expiryDate: getProExpiryDate(subscription),
          statusText: getSubscriptionStatusText(subscription),
          canAccessFeatures: isProUser(subscription),
          isLoading: false,
          error: null
        })
      } catch (error) {
        console.error('Error checking subscription:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to check subscription'
        }))
      }
    }

    checkSubscription()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const userSubscription = validateSubscriptionFromMetadata(session.user.user_metadata)

          setState({
            isPro: isProUser(userSubscription),
            daysRemaining: getProDaysRemaining(userSubscription),
            expiryDate: getProExpiryDate(userSubscription),
            statusText: getSubscriptionStatusText(userSubscription),
            canAccessFeatures: isProUser(userSubscription),
            isLoading: false,
            error: null
          })
        }
      } else if (event === 'SIGNED_OUT') {
        setState({
          isPro: false,
          daysRemaining: 0,
          expiryDate: null,
          statusText: 'FREE',
          canAccessFeatures: false,
          isLoading: false,
          error: null
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Check if user can access a specific PRO feature
   */
  const checkAccess = (featureName: string = 'fitur ini') => {
    const subscription = state.expiryDate ? {
      is_pro: state.isPro,
      subscription_status: state.isPro ? 'active' : 'inactive',
      subscription_until: state.expiryDate
    } : null

    return canAccessProFeature(subscription, featureName)
  }

  return {
    ...state,
    checkAccess
  }
}
