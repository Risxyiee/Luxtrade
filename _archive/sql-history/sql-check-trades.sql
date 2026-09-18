-- Query yang BENAR untuk mengecek trade statistics
-- Hapus tanda kutip pada nama kolom agar case-insensitive
SELECT
    COUNT(*) as total_trades,
    SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(profit_loss) as total_profit,
    MAX(close_time) as last_trade_time
FROM "Trade"
WHERE user_id = '43f1b7d3-4e61-4aa2-8c81-75661d75f2e9';