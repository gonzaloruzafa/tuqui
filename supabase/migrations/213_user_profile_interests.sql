-- Add interests column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS interests TEXT;
