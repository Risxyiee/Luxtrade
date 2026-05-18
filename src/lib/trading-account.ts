/**
 * Trading Account Helper Functions
 * Handles quota checking and trading account management logic
 */

import { supabase } from './supabase'
import { AccountQuota, AccountQuotaCheck, TradingAccount, TradingAccountStatus } from '@/types/trading-account'

/**
 * Get the maximum number of trading accounts allowed based on subscription plan
 */
export function getMaxAccountsByPlan(plan: string | null): number {
  switch (plan?.toLowerCase()) {
    case 'pro':
      return AccountQuota.PRO
    case 'ultra':
    case 'lifetime':
      return AccountQuota.ULTRA
    case 'free':
    default:
      return AccountQuota.FREE
  }
}

/**
 * Check if user can add more trading accounts based on their quota
 */
export async function checkAccountQuota(userId: string, userPlan: string | null): Promise<AccountQuotaCheck> {
  try {
    // Get current count of active accounts
    const { count, error } = await supabase
      .from('trading_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['CONNECTED', 'PENDING'])

    if (error) {
      console.error('Error checking account quota:', error)
      throw error
    }

    const currentAccounts = count || 0
    const maxAllowed = getMaxAccountsByPlan(userPlan)
    const remainingQuota = Math.max(0, maxAllowed - currentAccounts)
    const canAddMore = remainingQuota > 0

    return {
      currentAccounts,
      maxAllowed,
      canAddMore,
      remainingQuota
    }
  } catch (error) {
    console.error('Error in checkAccountQuota:', error)
    throw error
  }
}

/**
 * Get all trading accounts for a user
 */
export async function getUserTradingAccounts(userId: string): Promise<TradingAccount[]> {
  try {
    console.log('🔍 [getUserTradingAccounts] Fetching accounts for userId:', userId)

    const { data, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('🔴 [getUserTradingAccounts] Error fetching trading accounts:', error)
      console.error('🔴 [getUserTradingAccounts] Error code:', error.code)
      console.error('🔴 [getUserTradingAccounts] Error message:', error.message)
      console.error('🔴 [getUserTradingAccounts] Error details:', error.details)
      throw error
    }

    console.log('✅ [getUserTradingAccounts] Successfully fetched accounts:', data?.length || 0)
    console.log('📋 [getUserTradingAccounts] Accounts data:', data)

    return data || []
  } catch (error) {
    console.error('🔴 [getUserTradingAccounts] Error in getUserTradingAccounts:', error)
    throw error
  }
}

/**
 * Create a new trading account
 */
export async function createTradingAccount(
  userId: string,
  accountData: {
    account_number: string
    broker_server: string
    platform: 'MT4' | 'MT5'
    metaapi_account_id?: string
  }
): Promise<TradingAccount> {
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .insert({
        user_id: userId,
        account_number: accountData.account_number,
        broker_server: accountData.broker_server,
        platform: accountData.platform,
        metaapi_account_id: accountData.metaapi_account_id || null,
        status: 'PENDING' // Default status when creating
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating trading account:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in createTradingAccount:', error)
    throw error
  }
}

/**
 * Update trading account (metaapi_account_id or status)
 */
export async function updateTradingAccount(
  accountId: string,
  updates: {
    metaapi_account_id?: string
    status?: TradingAccountStatus
  }
): Promise<TradingAccount> {
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single()

    if (error) {
      console.error('Error updating trading account:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in updateTradingAccount:', error)
    throw error
  }
}

/**
 * Delete a trading account
 */
export async function deleteTradingAccount(accountId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId) // Ensure user can only delete their own accounts

    if (error) {
      console.error('Error deleting trading account:', error)
      throw error
    }
  } catch (error) {
    console.error('Error in deleteTradingAccount:', error)
    throw error
  }
}

/**
 * Check if account number already exists for user (prevent duplicates)
 */
export async function checkAccountNumberExists(userId: string, accountNumber: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('account_number', accountNumber)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found", which is fine
      console.error('Error checking account number:', error)
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Error in checkAccountNumberExists:', error)
    throw error
  }
}
