# Migración a Supabase Única con RLS

## 📋 Resumen Ejecutivo

**Estado actual:** Multi-database (1 Master + N Tenant DBs por cliente)  
**Estado objetivo:** Single-database con Row Level Security (RLS)  
**Complejidad:** Media-Alta  
**Beneficios:**
- ✅ Un solo proyecto Supabase a mantener
- ✅ Menor costo (un solo proyecto)
- ✅ Queries cross-tenant para analytics (admin)
- ✅ Onboarding de clientes sin crear proyecto nuevo
- ✅ Backups y migraciones simplificadas

---

## 🏗️ Arquitectura

### Antes (Multi-DB)
```
┌─────────────────────┐
│   Master Supabase   │
│  ┌───────────────┐  │
│  │   tenants     │  │  ← Guarda URLs y keys de cada tenant
│  │   users       │  │
│  └───────────────┘  │
└─────────────────────┘
         │
         ▼ lookup credentials
┌─────────────────────┐  ┌─────────────────────┐
│ Tenant A Supabase   │  │ Tenant B Supabase   │
│  - agents           │  │  - agents           │
│  - documents        │  │  - documents        │
│  - chat_sessions    │  │  - chat_sessions    │
│  - integrations     │  │  - integrations     │
└─────────────────────┘  └─────────────────────┘
```

### Después (Single-DB + RLS)
```
┌──────────────────────────────────────────────────────┐
│              Unified Supabase Database               │
│  ┌────────────────────────────────────────────────┐  │
│  │ tenants (sin credenciales, solo metadata)      │  │
│  │ users (con tenant_id FK)                       │  │
│  │ agents (con tenant_id FK) ← RLS                │  │
│  │ documents (con tenant_id FK) ← RLS             │  │
│  │ document_chunks (con tenant_id FK) ← RLS       │  │
│  │ integrations (con tenant_id FK) ← RLS          │  │
│  │ chat_sessions (con tenant_id FK) ← RLS         │  │
│  │ chat_messages (hereda de session) ← RLS        │  │
│  │ prometeo_tasks (con tenant_id FK) ← RLS        │  │
│  │ usage_stats (con tenant_id FK) ← RLS           │  │
│  │ ...                                            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  RLS Policy: tenant_id = current_setting('app.tid') │
└──────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Involucrados

### Crear Nuevos
| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/100_unified_schema.sql` | Schema completo unificado |
| `supabase/migrations/101_rls_policies.sql` | Políticas RLS |
| `supabase/migrations/102_seed_data.sql` | Datos iniciales (agentes, Adhoc tenant) |

### Modificar
| Archivo | Cambios |
|---------|---------|
| `lib/supabase/tenant.ts` | Reemplazar multi-DB por cliente único + `setTenant()` |
| `lib/supabase/index.ts` | Actualizar exports |
| `lib/rag/search.ts` | Agregar tenant_id a match_documents |
| `lib/chat/engine.ts` | Ya usa tenant del session, sin cambios |
| `app/api/**/*.ts` | 40+ archivos - cambiar `getTenantClient` por nuevo patrón |

### Eliminar
| Archivo | Razón |
|---------|-------|
| `lib/supabase/master.ts` | Ya no hay master separado |
| `app/api/debug/odoo/route.ts` | Endpoint de debug temporal |
| `supabase/master-schema.sql` | Obsoleto |
| `scripts/test-*.ts` | Scripts de test que usan multi-DB |

---

## 🔧 Implementación

### Paso 1: Schema Unificado

Ver `supabase/migrations/100_unified_schema.sql`

### Paso 2: Políticas RLS

Ver `supabase/migrations/101_rls_policies.sql`

### Paso 3: Nuevo Cliente Supabase

```typescript
// lib/supabase/client.ts (nuevo)
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente singleton
let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
    if (!client) {
        client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        })
    }
    return client
}

/**
 * Ejecutar query con tenant_id seteado para RLS
 * Usa SET LOCAL que solo afecta la transacción actual
 */
export async function withTenant<T>(
    tenantId: string,
    operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
    const db = getSupabaseClient()
    
    // Setear tenant_id para esta sesión
    await db.rpc('set_tenant_context', { p_tenant_id: tenantId })
    
    return operation(db)
}
```

### Paso 4: Migrar Queries

**Antes:**
```typescript
const db = await getTenantClient(tenantId)
const { data } = await db.from('agents').select('*')
```

**Después:**
```typescript
import { withTenant } from '@/lib/supabase/client'

const { data } = await withTenant(tenantId, async (db) => {
    return db.from('agents').select('*')
})
```

---

## 📊 Variables de Entorno

### Antes
```env
# Master
NEXT_PUBLIC_MASTER_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_MASTER_SUPABASE_ANON_KEY=xxx
MASTER_SUPABASE_SERVICE_KEY=xxx

# Initial Tenant (para dev)
INITIAL_TENANT_URL=https://yyy.supabase.co
INITIAL_TENANT_ANON_KEY=xxx
INITIAL_TENANT_SERVICE_KEY=xxx
```

### Después
```env
# Single Database
NEXT_PUBLIC_SUPABASE_URL=https://unified.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 🎯 Datos a Preservar

### Agente Tuqui (Default)
```json
{
  "slug": "tuqui",
  "name": "Tuqui",
  "description": "Tu asistente de IA empresarial",
  "icon": "Sparkles",
  "color": "adhoc-violet",
  "rag_enabled": true,
  "tools": ["odoo_intelligent_query", "meli_search", "web_search"],
  "system_prompt": "..." // Ver lib/agents/unified.ts
}
```

### Tenant Adhoc (Inicial)
```json
{
  "slug": "adhoc",
  "name": "Cliente Adhoc",
  "is_active": true
}
```

### Integración Odoo (Ejemplo)
```json
{
  "type": "odoo",
  "is_active": true,
  "config": {
    "odoo_url": "https://train-cedent-09-12-2.adhoc.ar",
    "odoo_db": "odoo",
    "odoo_user": "fdelpazo",
    "odoo_password": "enc:xxx"
  }
}
```

---

## ✅ Checklist de Migración

- [ ] Crear nuevo proyecto Supabase unificado
- [ ] Ejecutar `100_unified_schema.sql`
- [ ] Ejecutar `101_rls_policies.sql`
- [ ] Ejecutar `102_seed_data.sql`
- [ ] Actualizar variables de entorno en Vercel
- [ ] Refactorizar `lib/supabase/`
- [ ] Migrar todas las queries (40+ archivos)
- [ ] Eliminar archivos obsoletos
- [ ] Test local
- [ ] Deploy a production
- [ ] Verificar funcionamiento WhatsApp
- [ ] Verificar funcionamiento Web

---

## 🚨 Rollback Plan

Si algo falla:
1. Revertir variables de entorno en Vercel a las originales
2. Revertir código a commit anterior
3. Los proyectos Supabase originales siguen intactos

---

## 📚 Referencias

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-tenant with RLS](https://supabase.com/docs/guides/auth/managing-user-data#multi-tenancy)
