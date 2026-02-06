-- supabase/migrations/132_add_memory_tool_to_tuqui.sql
-- Add 'memory' tool to the main 'tuqui' agent

UPDATE agents
SET tools = array_append(tools, 'memory')
WHERE slug = 'tuqui'
AND NOT (tools @> ARRAY['memory']);
