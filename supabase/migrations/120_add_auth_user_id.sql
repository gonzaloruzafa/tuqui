-- Add auth_user_id column to link with Supabase Auth
-- This is populated on first login and used for password management

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Comment
COMMENT ON COLUMN users.auth_user_id IS 'Links to auth.users.id from Supabase Auth. Populated on first login.';
