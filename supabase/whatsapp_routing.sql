-- SQL for Twilio WhatsApp Routing
-- Run this in the Supabase SQL Editor (Master DB)

-- 1. Add whatsapp_phone column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT UNIQUE;

-- 2. Index for fast lookup by phone number
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_phone ON users(whatsapp_phone);

-- 3. Example assignment (replace with real data)
-- El formato debe ser 'whatsapp:+549...'
UPDATE users SET whatsapp_phone = 'whatsapp:+5493416718905' WHERE email = 'gr@adhoc.inc';
