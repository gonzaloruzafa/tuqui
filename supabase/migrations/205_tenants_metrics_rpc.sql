-- RPC function to get tenants with metrics in a single query
CREATE OR REPLACE FUNCTION get_tenants_with_metrics(p_year_month TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    user_count BIGINT,
    tokens_this_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.slug,
        t.is_active,
        t.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id)::BIGINT AS user_count,
        (SELECT COALESCE(SUM(us.total_tokens), 0)
         FROM usage_stats us
         WHERE us.tenant_id = t.id
           AND us.year_month = p_year_month
        )::BIGINT AS tokens_this_month
    FROM tenants t
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
