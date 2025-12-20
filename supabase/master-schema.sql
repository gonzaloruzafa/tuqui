-- MASTER DB SCHEMA
-- Ejecutar en el proyecto Supabase "Master"

-- Tenants (cada cliente/empresa)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  supabase_service_key TEXT NOT NULL,
  twilio_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Users (linked to tenants)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  image TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Master: Service Role mostly used)
CREATE POLICY "Service role full access" ON tenants USING (true);
CREATE POLICY "Service role full access" ON users USING (true);
