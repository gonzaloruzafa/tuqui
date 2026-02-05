# 🚀 Tuqui - Plan de Implementación Exhaustivo

**Fecha:** 20 Diciembre 2025  
**Estado Actual:** MVP Alpha funcional con gaps identificados  
**Objetivo:** Plataforma SaaS production-ready

---

## 📊 ANÁLISIS DEL ESTADO ACTUAL

### ✅ Completado
| Módulo | Estado | Notas |
|--------|--------|-------|
| Multi-tenancy base | ✅ | Master + Tenant DBs funcionando |
| Auth Google | ✅ | NextAuth v5 + tenant injection |
| Agentes Built-in | ✅ | 6 agentes en registry |
| API Chat | ✅ | Streaming + RAG + Tools |
| Admin Dashboard | ✅ | Cards principales |
| Admin Agents | ✅ | CRUD básico + config prompts |
| Admin RAG Upload | ✅ | Subir PDF/TXT, eliminar |
| Admin Users | ✅ | Invitar/eliminar usuarios |
| Admin Tools | ✅ | Toggle integraciones |
| Admin Company | ✅ | Info básica de empresa |
| Billing Tracker | ✅ | Conteo de tokens básico |
| Prometeo Runner | ✅ | Lógica básica de tareas |
| WhatsApp Webhook | ✅ | Recepción + respuesta básica |

### ⚠️ Gaps Críticos Identificados
| Módulo | Problema | Prioridad |
|--------|----------|-----------|
| RAG Embeddings | Los docs se suben pero NO se generan embeddings | 🔴 CRÍTICO |
| Agents Seed | Los agentes built-in no se seedean en tenant DB | 🔴 CRÍTICO |
| Documents Schema | Tabla tiene `agent_id` required pero docs son globales | 🔴 CRÍTICO |
| Prometeo UI | No hay UI para crear/gestionar tareas | 🟡 ALTO |
| Push Subscriptions | No hay tabla ni UI para push | 🟡 ALTO |
| Tools Credentials | No hay UI para ingresar credenciales Odoo/MELI | 🟡 ALTO |
| Stripe Integration | Solo placeholders, sin checkout real | 🟡 ALTO |
| Middleware deprecado | Next.js 16 advierte sobre middleware | 🟢 MEDIO |
| Crypto real | Usa base64, no AES-GCM | 🟢 MEDIO |
| Vercel Cron | No hay vercel.json con cron config | 🟢 MEDIO |
| PWA/Service Worker | No hay SW para push notifications | 🟢 MEDIO |

---

## 🛠️ PLAN DE IMPLEMENTACIÓN POR FASES

---

## FASE 1: FIXES CRÍTICOS (Prioridad Máxima)
**Tiempo estimado: 4-6 horas**

### 1.1 Fix RAG Pipeline Completo
**Problema:** Los documentos se suben pero no generan embeddings/chunks

**Archivos a modificar:**
- `app/admin/rag/actions.ts` - Agregar chunking + embedding
- `lib/rag/chunker.ts` - CREAR - Lógica de chunking
- `supabase/tenant-schema.sql` - Ajustar schema documents

**Implementación:**
```typescript
// lib/rag/chunker.ts
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[]

// app/admin/rag/actions.ts
export async function uploadDocument(formData: FormData) {
    // 1. Read file
    // 2. Chunk content
    // 3. Generate embeddings para cada chunk
    // 4. Insert document + chunks con embeddings
}
```

### 1.2 Fix Schema Documents
**Problema:** `agent_id` es required pero docs deberían ser globales

**Cambios en SQL:**
```sql
-- documents.agent_id debe ser nullable para docs globales
ALTER TABLE documents ALTER COLUMN agent_id DROP NOT NULL;

-- Agregar columna is_global
ALTER TABLE documents ADD COLUMN is_global BOOLEAN DEFAULT false;
```

### 1.3 Seed Agents Built-in en Tenant DB
**Problema:** Los agentes del registry no se crean automáticamente

**Crear:** `scripts/seed-agents.ts`
```typescript
// Script que inserta los 6 agentes built-in en la DB del tenant
// Debe correrse después de crear un nuevo tenant
```

**Agregar a:** `scripts/setup.ts` - Llamar seed-agents después de crear tenant

### 1.4 Fix Agent Service para DB
**Problema:** `getAgentsForTenant` busca en DB pero built-ins no están

**Modificar:** `lib/agents/service.ts`
```typescript
// Opción A: Siempre insertar built-ins si no existen (upsert on-demand)
// Opción B: Solo usar DB, seed previo obligatorio
// Recomiendo Opción A para self-healing
```

---

## FASE 2: FUNCIONALIDADES CORE FALTANTES
**Tiempo estimado: 8-10 horas**

### 2.1 Admin: Crear Agentes Custom
**Crear:** `app/admin/agents/new/page.tsx`
- Formulario para crear agente personalizado
- Campos: name, slug, description, system_prompt, icon, color
- Selección de tools y docs iniciales

### 2.2 Admin: Configurar Credenciales de Integraciones
**Modificar:** `app/admin/tools/page.tsx`
- Agregar formulario expandible por cada tool
- Campos específicos por integración:
  - **Odoo:** url, database, username, password
  - **MercadoLibre:** (solo scraping, no requiere creds)
  - **Twilio:** account_sid, auth_token, phone_number
- Guardar encriptado en `integrations.config`

**Crear:** `app/admin/tools/[slug]/page.tsx` - Config detallada por tool

### 2.3 Admin: Gestión de Prometeo (Tareas Programadas)
**Crear:** `app/admin/prometeo/page.tsx`
- Listar tareas activas del tenant
- Crear nueva tarea: nombre, agente, prompt, schedule (dropdown: diario, semanal)
- Activar/desactivar tareas
- Ver historial de ejecución

**Crear:** `app/admin/prometeo/new/page.tsx`
**Crear:** `app/api/prometeo/tasks/route.ts` - CRUD de tareas

### 2.4 Push Notifications Completo
**Crear tabla en schema:**
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  subscription JSONB NOT NULL, -- PushSubscription object
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Crear:** `public/sw.js` - Service Worker
**Crear:** `app/api/push/subscribe/route.ts`
**Crear:** `components/PushPrompt.tsx` - Componente para pedir permiso

---

## FASE 3: BILLING & STRIPE
**Tiempo estimado: 6-8 horas**

### 3.1 Modelo de Datos Billing
**Agregar a master-schema.sql:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free', -- 'free', 'pro'
  status TEXT DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Stripe Checkout Flow
**Crear:** `app/api/billing/checkout/route.ts`
- Crear Stripe Checkout Session
- Redirect a Stripe

**Crear:** `app/api/billing/webhook/route.ts`
- Manejar eventos: checkout.session.completed, subscription.updated, subscription.deleted

**Crear:** `app/billing/page.tsx`
- Ver plan actual
- Botón upgrade/manage
- Historial de uso

### 3.3 Integrar Límites Reales
**Modificar:** `lib/billing/limits.ts`
- Leer plan real de DB
- Aplicar límites según plan

**Modificar:** `lib/billing/tracker.ts`
- Mejorar estimación de tokens
- Guardar breakdown por agente

---

## FASE 4: MEJORAS DE UX/UI
**Tiempo estimado: 4-5 horas**

### 4.1 Dashboard Mejorado
**Modificar:** `app/page.tsx`
- Mostrar stats rápidos: mensajes hoy, docs en RAG, tareas activas
- Card de "Últimas conversaciones"
- Acceso rápido a agentes favoritos

### 4.2 Chat Mejorado
**Modificar:** `app/chat/[slug]/page.tsx`
- Historial de sesiones en sidebar (ya existe parcial)
- Renombrar/eliminar sesiones
- Exportar conversación
- Indicador de "escribiendo..."
- Mejor manejo de errores

### 4.3 Onboarding Flow
**Crear:** `app/onboarding/page.tsx`
- Wizard para nuevos tenants
- Paso 1: Datos de empresa
- Paso 2: Subir primeros documentos
- Paso 3: Configurar primer agente
- Paso 4: Probar chat

---

## FASE 5: ROBUSTEZ & PRODUCCIÓN
**Tiempo estimado: 6-8 horas**

### 5.1 Migrar Middleware a Proxy (Next.js 16)
**Renombrar:** `middleware.ts` → `proxy.ts` (o adaptar según docs)

### 5.2 Crypto Real
**Modificar:** `lib/crypto.ts`
- Implementar AES-256-GCM real
- Key derivation desde NEXTAUTH_SECRET

### 5.3 Error Handling Global
**Crear:** `app/error.tsx` - Error boundary
**Crear:** `app/not-found.tsx` - 404 custom
**Agregar:** Logging con contexto (tenant_id, user_email)

### 5.4 Rate Limiting
**Crear:** `lib/rate-limit.ts`
- Rate limit por IP/user en chat endpoint
- Protección contra abuse

### 5.5 Vercel Config
**Crear:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/prometeo/run",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## FASE 6: DEPLOY & TESTING
**Tiempo estimado: 4-6 horas**

### 6.1 Variables de Entorno en Vercel
- Copiar todas las vars de `.env.local`
- Generar nuevas keys para producción

### 6.2 Ejecutar SQL Schemas
- Master DB: ejecutar `master-schema.sql`
- Tenant DB: ejecutar `tenant-schema.sql`
- Seed datos iniciales

### 6.3 Testing Manual
- [ ] Login con Google
- [ ] Ver dashboard
- [ ] Crear documento RAG
- [ ] Chat con agente + verificar RAG funciona
- [ ] Invitar usuario
- [ ] Probar WhatsApp (si Twilio configurado)

### 6.4 Monitoreo
**Configurar:** 
- Vercel Analytics
- Supabase logs
- Error tracking (Sentry opcional)

---

## 📋 RESUMEN DE ARCHIVOS A CREAR/MODIFICAR

### CREAR (Nuevos)
```
lib/rag/chunker.ts                    # Chunking de documentos
scripts/seed-agents.ts                # Seed agentes built-in
app/admin/agents/new/page.tsx         # Crear agente custom
app/admin/tools/[slug]/page.tsx       # Config credenciales por tool
app/admin/prometeo/page.tsx           # Lista tareas
app/admin/prometeo/new/page.tsx       # Crear tarea
app/api/prometeo/tasks/route.ts       # CRUD tareas
app/api/push/subscribe/route.ts       # Subscribe push
app/api/billing/checkout/route.ts     # Stripe checkout
app/api/billing/webhook/route.ts      # Stripe webhook
app/billing/page.tsx                  # Billing dashboard
app/onboarding/page.tsx               # Wizard onboarding
app/error.tsx                         # Error boundary
app/not-found.tsx                     # 404
public/sw.js                          # Service worker
components/PushPrompt.tsx             # Prompt notificaciones
lib/rate-limit.ts                     # Rate limiting
vercel.json                           # Config deploy + crons
```

### MODIFICAR (Existentes)
```
app/admin/rag/actions.ts              # Agregar embeddings pipeline
app/admin/tools/page.tsx              # Agregar forms de credenciales
lib/agents/service.ts                 # Auto-seed built-ins
lib/crypto.ts                         # Crypto real
lib/billing/limits.ts                 # Leer plan de DB
lib/billing/tracker.ts                # Mejor tracking
scripts/setup.ts                      # Agregar seed-agents
supabase/tenant-schema.sql            # Push subscriptions + fixes
supabase/master-schema.sql            # Subscriptions table
middleware.ts → proxy.ts              # Migración Next.js 16
app/page.tsx                          # Stats dashboard
app/chat/[slug]/page.tsx              # Mejoras UX
```

---

## ⏱️ TIMELINE ESTIMADO

| Fase | Horas | Acumulado |
|------|-------|-----------|
| Fase 1: Fixes Críticos | 4-6h | 6h |
| Fase 2: Core Faltante | 8-10h | 16h |
| Fase 3: Billing | 6-8h | 24h |
| Fase 4: UX/UI | 4-5h | 29h |
| Fase 5: Producción | 6-8h | 37h |
| Fase 6: Deploy | 4-6h | 43h |

**Total estimado: ~40-45 horas de desarrollo**

---

## 🎯 RECOMENDACIÓN DE PRIORIDADES

### Si querés MVP funcional RÁPIDO:
1. ✅ Fase 1 completa (RAG + Agents - 6h)
2. ✅ 2.2 Credenciales tools (2h)
3. ✅ Fase 6 Deploy (4h)
**= 12 horas para MVP deployable**

### Si querés producto COMPLETO:
- Seguir fases en orden
- ~40 horas totales

---

## ✅ CHECKLIST PARA DAR OK

Revisá este plan y confirmame:

- [ ] ¿Priorizar MVP rápido o producto completo?
- [ ] ¿El modelo de billing ($5/user) está OK?
- [ ] ¿Agregar alguna feature no contemplada?
- [ ] ¿Modificar alguna prioridad?

**Cuando des OK, empiezo por Fase 1.1 (Fix RAG Pipeline)**

