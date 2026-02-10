-- Add is_platform_admin column to users table
-- Platform admins (super-admins) can manage all tenants from /super-admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- Set existing platform admin
UPDATE users SET is_platform_admin = true WHERE email = 'gr@adhoc.inc';
UPDATE users SET is_platform_admin = true WHERE email = 'gonzaloruzafa@gmail.com';
