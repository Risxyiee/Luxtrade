// Trading Account Types for MetaApi Auto-Journal Feature

export type TradingPlatform = 'MT4' | 'MT5';
export type TradingAccountStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING' | 'ERROR';

export interface TradingAccount {
  id: string;
  user_id: string;
  account_number: string;
  broker_server: string;
  platform: TradingPlatform;
  metaapi_account_id?: string | null;
  status: TradingAccountStatus;
  created_at: string;
}

export interface CreateTradingAccountInput {
  account_number: string;
  broker_server: string;
  platform: TradingPlatform;
  metaapi_account_id?: string;
}

export interface UpdateTradingAccountInput {
  metaapi_account_id?: string;
  status?: TradingAccountStatus;
}

// Quota limits based on subscription plan
export enum AccountQuota {
  FREE = 1,
  PRO = 3,
  ULTRA = 5
}

export interface AccountQuotaCheck {
  currentAccounts: number;
  maxAllowed: number;
  canAddMore: boolean;
  remainingQuota: number;
}
