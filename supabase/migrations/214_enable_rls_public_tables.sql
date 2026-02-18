-- Enable RLS on public tables that were missing it
-- These tables are accessed only via service_role key which bypasses RLS by default,
-- so enabling RLS without extra policies is safe and resolves Security Advisor errors.

ALTER TABLE public.company_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_agent_documents ENABLE ROW LEVEL SECURITY;
