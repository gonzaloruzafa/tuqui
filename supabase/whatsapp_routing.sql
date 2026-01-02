-- SQL for Twilio WhatsApp Routing
-- Run this in the Supabase SQL Editor (Master DB)

-- 1. Add whatsapp_phone column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT UNIQUE;

-- 2. Index for fast lookup by phone number
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_phone ON users(whatsapp_phone);

-- 3. Example assignment (replace with real data)
-- UPDATE users SET whatsapp_phone = 'whatsapp:+123456789' WHERE email = 'your-email@example.com';
