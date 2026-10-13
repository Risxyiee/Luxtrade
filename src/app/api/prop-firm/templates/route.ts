import { NextResponse } from 'next/server'

export const dynamic9 = 'force-dynamic'

/**
 * Pre-configured prop firm templates.
 * No auth required — these are public reference data.
 */
const TEMPLATES = {
  FTMO: {
    firm_name: 'FTMO',
    challenge_sizes: [10000, 25000, 50000, 100000, 200000],
    max_drawdown: 10,          // % of challenge_size
    max_daily_drawdown: 5,     // % of challenge_size
    daily_drawdown_type: 'relative',
    profit_target_phase1: 10,  // % of challenge_size
    profit_target_phase2: 5,   // % of challenge_size
    min_trading_days: 4,
    profit_split: 80,
    description: 'One of the most popular prop firms with strict rules and generous profit split.',
  },
  MFF: {
    firm_name: 'MyForexFunds (MFF)',
    challenge_sizes: [10000, 25000, 50000, 100000, 200000],
    max_drawdown: 12,
    max_daily_drawdown: 5,
    daily_drawdown_type: 'relative',
    profit_target_phase1: 8,
    profit_target_phase2: 5,
    min_trading_days: 5,
    profit_split: 85,
    description: 'Higher max drawdown tolerance with a better profit split than FTMO.',
  },
  FundedNext: {
    firm_name: 'FundedNext',
    challenge_sizes: [5000, 10000, 25000, 50000, 100000],
    max_drawdown: 10,
    max_daily_drawdown: 5,
    daily_drawdown_type: 'relative',
    profit_target_phase1: 6,
    profit_target_phase2: 4,
    min_trading_days: 5,
    profit_split: 90,
    description: 'Lower profit targets with the highest profit split. Great for consistent traders.',
  },
  The5ers: {
    firm_name: 'The5ers',
    challenge_sizes: [10000, 20000, 50000, 100000],
    max_drawdown: 6,
    max_daily_drawdown: 3,
    daily_drawdown_type: 'relative',
    profit_target_phase1: 6,
    profit_target_phase2: 3,
    min_trading_days: 5,
    profit_split: 80,
    description: 'Conservative drawdown limits. Best for low-risk, steady traders.',
  },
  SurgeTrader: {
    firm_name: 'SurgeTrader',
    challenge_sizes: [25000, 50000, 100000, 200000],
    max_drawdown: 8,
    max_daily_drawdown: 4,
    daily_drawdown_type: 'relative',
    profit_target_phase1: 8,
    profit_target_phase2: 4,
    min_trading_days: 0,
    profit_split: 75,
    description: 'No minimum trading days requirement. Fastest path to funding.',
  },
}

/**
 * GET /api/prop-firm/templates — Return all pre-configured prop firm templates
 */
export async function GET() {
  return NextResponse.json({
    templates: TEMPLATES,
    firms: Object.keys(TEMPLATES),
  })
}
