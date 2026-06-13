-- Fix: Drop triggers that reference non-existent columns
-- This fixes the error: The column 'new' does not exist
-- Safe version: Only drops triggers/functions if they exist

-- Drop the function first (this will cascade to triggers)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;