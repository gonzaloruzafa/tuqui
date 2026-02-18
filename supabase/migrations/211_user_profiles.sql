-- User profiles for personalization context
-- Stores display name, role, area, bio
-- Bio gets synced to memory_facts for intelligent recall

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT,
  role_title TEXT,
  area TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_tenant 
  ON user_profiles(user_id, tenant_id);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON user_profiles
  FOR ALL USING (true) WITH CHECK (true);
