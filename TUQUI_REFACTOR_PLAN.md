# 🧠 TUQUI REFACTOR - PLAN EXHAUSTIVO CON CHECKPOINTS

> **Branch:** `refactor/mejoras-v2`  
> **Fecha inicio:** 2026-02-01  
> **Última actualización:** 2026-02-01  

---

## 📍 ESTADO ACTUAL

| Campo | Valor |
|-------|-------|
| **Fase actual** | `FASE 0` - Preparación |
| **Último checkpoint** | ❌ No iniciado |
| **Branch creado** | ❌ No |
| **Tests baseline** | ❌ Pendiente verificar |

### Progreso General

```
FASE 0: Preparación        [ ] ⬜⬜⬜⬜⬜ 0%
FASE 1: RAG como Tool      [ ] ⬜⬜⬜⬜⬜ 0%
FASE 2: PWA Base           [ ] ⬜⬜⬜⬜⬜ 0%
FASE 3: Modelo de Datos    [ ] ⬜⬜⬜⬜⬜ 0%
FASE 4: Push Sender        [ ] ⬜⬜⬜⬜⬜ 0%
FASE 5: Onboarding Wizard  [ ] ⬜⬜⬜⬜⬜ 0%
FASE 6: Briefing Engine    [ ] ⬜⬜⬜⬜⬜ 0%
FASE 7: Settings           [ ] ⬜⬜⬜⬜⬜ 0%
FASE 8: Alertas Proactivas [ ] ⬜⬜⬜⬜⬜ 0%
```

---

## ⚠️ MANEJO DE BASE DE DATOS CON BRANCHES

### Estrategia: Migrations Aditivas

Las migrations de Supabase son **aditivas y no destructivas**:

```sql
-- Usamos siempre IF NOT EXISTS / IF EXISTS
CREATE TABLE IF NOT EXISTS user_profiles (...)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN
```

### Flujo de trabajo

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE (una sola DB)                    │
│                                                                  │
│  Tablas existentes: tenants, users, agents, integrations, etc.  │
│  + Tablas nuevas: user_profiles, briefing_history (cuando se    │
│    apliquen las migrations)                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Ambos branches usan la misma DB
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────┐                     ┌───────────────────┐
│   Branch: main    │                     │ Branch: refactor/ │
│                   │                     │   mejoras-v2      │
│ - Código actual   │                     │                   │
│ - No usa tablas   │                     │ - Código nuevo    │
│   nuevas          │                     │ - Usa tablas      │
│ - Sigue funcio-   │                     │   nuevas          │
│   nando normal    │                     │ - Preview deploy  │
└───────────────────┘                     └───────────────────┘
```

### Reglas de oro

1. **Migrations primero en branch, luego en main**
   - Aplicamos migrations desde el branch refactor
   - Son aditivas, no rompen main
   - Main simplemente ignora las tablas nuevas

2. **Preview deploys en Vercel**
   - Cada push al branch crea preview URL
   - Testear ahí antes de mergear
   - Misma DB de producción

3. **Rollback seguro**
   - Si algo falla, las tablas nuevas quedan pero no molestan
   - Podemos borrarlas manualmente si es necesario
   - Código de main no las toca

4. **Orden de operaciones**
   ```
   1. Crear branch
   2. Aplicar migrations (una vez, afecta producción)
   3. Desarrollar código
   4. Testear en preview deploy
   5. Mergear a main
   ```

---

## 🧪 TESTS DISPONIBLES COMO RED DE SEGURIDAD

### Tests que DEBEN pasar antes de cada fase

| Test | Comando | Criterio de éxito |
|------|---------|-------------------|
| **Quick test** | `npx tsx scripts/e2e-tests/quick-test.ts` | ✅ PASS |
| **Agent evals** | `npx tsx tests/evals/run-agent-evals.ts` | ≥80% (baseline: 82.2%) |
| **Unit tests** | `npm run test` | All pass |
| **Skills integration** | `npx tsx tests/skills-integration.test.ts` | All pass |

### Tests específicos por fase

| Fase | Test adicional |
|------|----------------|
| F1: RAG Tool | Chat con agente RAG-enabled funciona |
| F2: PWA | Lighthouse PWA ≥90 |
| F3: Modelo datos | Queries a tablas nuevas funcionan |
| F5: Onboarding | Flujo completo de 5 pasos |
| F6: Briefings | Cron genera y envía briefing |

---

## FASE 0: PREPARACIÓN Y LIMPIEZA [~45 min]

> **Objetivo:** Limpiar codebase, crear branch de trabajo y establecer baseline de tests

### F0.0: Limpieza y Coherencia del Sistema

> **Pre-requisito:** Antes de empezar cualquier desarrollo, limpiar archivos basura
> y asegurar coherencia del sistema.

#### 📊 Análisis de Coherencia Realizado (2026-02-01)

| Categoría | Estado | Notas |
|-----------|--------|-------|
| Arquitectura Multi-tenant | ✅ OK | RLS correctamente implementado |
| Flujo de Sesión/Auth | ✅ OK | session.tenant.id consistente |
| Variables de Entorno | ⚠️ Limpiado | Había duplicados |
| Archivos Temporales | ⚠️ Limpiado | 16 JSON eliminados |
| Documentación | ⚠️ Limpiado | Obsoletos movidos a archive |
| API Keys | ⚠️ Helper creado | `lib/config/api-keys.ts` |
| Test Config | ⚠️ Helper creado | `tests/config.ts` |

#### Pasos de limpieza

- [x] **Eliminar JSON temporales**
  ```bash
  cd /home/gonza/adhoc\ x/tuqui-agents-alpha
  rm -f improvement-summary-*.json meli-accuracy-report-*.json
  ```
  > ✅ Completado: 16 archivos eliminados

- [x] **Mover documentación obsoleta**
  ```bash
  mkdir -p docs/archive
  mv PLAN_SKILLS_REFACTOR.md docs/archive/
  mv RESUMEN_MEJORAS_IMPLEMENTADAS.md docs/archive/
  mv RESUMEN_SESION_2026-01-09.md docs/archive/
  mv "Todo tuqui.md" docs/archive/
  ```
  > ✅ Completado: 4 archivos movidos a docs/archive/

- [x] **Eliminar archivos .env duplicados**
  ```bash
  rm -f .env.prod .env.tuqui.prod
  # Mantener: .env.example, .env.local, .env.production, .env.test, .env.tuqui
  ```
  > ✅ Completado: 2 archivos eliminados

- [x] **Crear helper unificado para API keys**
  > ✅ Creado: `lib/config/api-keys.ts`
  > Resuelve inconsistencia GEMINI_API_KEY vs GOOGLE_GENERATIVE_AI_API_KEY

- [x] **Crear configuración centralizada de tests**
  > ✅ Creado: `tests/config.ts`
  > Exporta TEST_TENANT_ID para evitar hardcodeos

#### ⚠️ Deuda técnica identificada (resolver post-merge)

| Issue | Archivos afectados | Prioridad |
|-------|-------------------|-----------|
| `getTenantClient()` deprecated | 8+ archivos | Media |
| Tests con TENANT_ID hardcodeado | 7 tests e2e | Baja |
| `supabaseAdmin` alias confuso | 1 archivo | Baja |
| TODOs en código | 3 archivos | Baja |

### F0.1: Verificar estado actual de tests

**⛔ GATE: No avanzar si fallan**

- [ ] **Quick test**
  ```bash
  cd /home/gonza/adhoc\ x/tuqui-agents-alpha
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado esperado: `✅ PASS`
  - Resultado actual: `_______________`

- [ ] **Agent evals**
  ```bash
  npx tsx tests/evals/run-agent-evals.ts 2>&1 | tee /tmp/baseline-evals.log
  ```
  - Resultado esperado: ≥80% pass rate
  - Resultado actual: `_____ / _____ = _____%`

- [ ] **Unit tests**
  ```bash
  npm run test
  ```
  - Resultado esperado: All pass
  - Resultado actual: `_______________`

### F0.2: Crear backup y branch

- [ ] **Crear tag de backup**
  ```bash
  git tag backup-pre-refactor-v2 -m "Backup before major refactor $(date +%Y-%m-%d)"
  git push origin backup-pre-refactor-v2
  ```

- [ ] **Crear branch de trabajo**
  ```bash
  git checkout -b refactor/mejoras-v2
  git push -u origin refactor/mejoras-v2
  ```

- [ ] **Verificar branch**
  ```bash
  git branch --show-current
  # Debe mostrar: refactor/mejoras-v2
  ```

### F0.3: Documentar baseline

- [ ] **Guardar resultados de tests como baseline**
  ```bash
  echo "Baseline tests - $(date)" > /tmp/baseline-tests.txt
  echo "Quick test: PASS/FAIL" >> /tmp/baseline-tests.txt
  echo "Agent evals: XX/YY = ZZ%" >> /tmp/baseline-tests.txt
  echo "Unit tests: PASS/FAIL" >> /tmp/baseline-tests.txt
  ```

### ✅ Checkpoint F0

| Check | Estado |
|-------|--------|
| Quick test pasa | [ ] |
| Agent evals ≥80% | [ ] |
| Unit tests pasan | [ ] |
| Tag backup creado | [ ] |
| Branch refactor/mejoras-v2 creado | [ ] |
| Estamos en el branch correcto | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 1**

---

## FASE 1: RAG COMO TOOL [~1 hora] ⭐

> **Objetivo:** Cambiar RAG de inyección automática a tool on-demand  
> **Riesgo:** BAJO - Si el LLM no llama la tool, es equivalente a no inyectar  
> **Beneficio:** Ahorro de tokens, respuestas más limpias

### Contexto actual

```
ANTES (inyección automática):
┌─────────────────────────────────────────────┐
│ Usuario pregunta cualquier cosa            │
│           ↓                                 │
│ if (agent.rag_enabled)                      │
│   docs = searchDocuments(query)             │
│   systemPrompt += docs  ← SIEMPRE se agrega │
│           ↓                                 │
│ LLM responde (con docs que quizás no usó)   │
└─────────────────────────────────────────────┘

DESPUÉS (tool on-demand):
┌─────────────────────────────────────────────┐
│ Usuario pregunta algo                       │
│           ↓                                 │
│ LLM decide: ¿necesito buscar en docs?       │
│   SI → llama tool search_knowledge_base     │
│   NO → responde directo                     │
│           ↓                                 │
│ Respuesta (solo usa docs si los necesitó)   │
└─────────────────────────────────────────────┘
```

### F1.1: Crear RAG tool

- [ ] **Crear archivo** `lib/tools/definitions/rag-tool.ts`
  
  ```typescript
  // CONTENIDO A CREAR:
  import { tool } from 'ai'
  import { z } from 'zod'
  import { searchDocuments, type SearchResult } from '@/lib/rag/search'
  
  export function createRagTool(tenantId: string, agentId: string) {
    return tool({
      description: `Buscar en la base de conocimiento de la empresa.
  
  USAR CUANDO el usuario pregunta sobre:
  - Procesos internos, políticas, procedimientos
  - Información de productos/servicios documentada
  - Manuales, guías, instrucciones internas
  - Cualquier cosa que diga "según el documento", "manual", "procedimiento"
  
  NO USAR PARA:
  - Datos transaccionales (ventas, stock, facturas) → usar skills de Odoo
  - Información que requiere cálculos en tiempo real`,
      
      parameters: z.object({
        query: z.string().describe('Qué buscar en los documentos. Sé específico.')
      }),
      
      execute: async ({ query }) => {
        try {
          const docs = await searchDocuments(tenantId, agentId, query, 5)
          
          if (docs.length === 0) {
            return {
              found: false,
              message: 'No encontré documentos relevantes.'
            }
          }
          
          return {
            found: true,
            count: docs.length,
            documents: docs.map((d: SearchResult) => ({
              content: d.content,
              relevance: `${Math.round(d.similarity * 100)}%`
            }))
          }
        } catch (error: any) {
          console.error('[RAG Tool] Error:', error)
          return { found: false, error: 'Error al buscar' }
        }
      }
    })
  }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/tools/definitions/rag-tool.ts
  ```

### F1.2: Integrar RAG tool en executor

- [ ] **Modificar** `lib/tools/executor.ts`
  
  Buscar la sección donde se cargan tools (después de Odoo skills) y agregar:
  
  ```typescript
  // RAG tool - solo si el agente tiene rag_enabled
  if (agent.rag_enabled) {
    const { createRagTool } = await import('./definitions/rag-tool')
    tools['search_knowledge_base'] = createRagTool(tenantId, agentId)
    console.log('[Tools] RAG tool loaded for agent:', agentId)
  }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/tools/executor.ts
  ```

### F1.3: Remover inyección automática de RAG

- [ ] **Modificar** `lib/chat/engine.ts`
  
  Buscar el bloque (aproximadamente línea 155):
  ```typescript
  // 4. RAG Context (using effective agent config)
  if (effectiveAgent.rag_enabled) {
      const docs = await searchDocuments(tenantId, agentId, inputContent)
      if (docs.length > 0) {
          systemPrompt += `\n\nCONTEXTO RELEVANTE:\n${docs.map(d => `- ${d.content}`).join('\n')}`
      }
  }
  ```
  
  **Comentarlo** (no borrar, por si necesitamos rollback):
  ```typescript
  // RAG ahora es una tool - el LLM la llama cuando la necesita
  // Ver lib/tools/definitions/rag-tool.ts
  // 
  // CÓDIGO ANTERIOR (inyección automática):
  // if (effectiveAgent.rag_enabled) {
  //     const docs = await searchDocuments(tenantId, agentId, inputContent)
  //     if (docs.length > 0) {
  //         systemPrompt += `\n\nCONTEXTO RELEVANTE:\n${docs.map(d => `- ${d.content}`).join('\n')}`
  //     }
  // }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/chat/engine.ts
  ```

### F1.4: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/tools/definitions/rag-tool.ts lib/tools/executor.ts lib/chat/engine.ts
  git commit -m "feat: RAG as tool instead of automatic injection

  - Created lib/tools/definitions/rag-tool.ts
  - Added RAG tool loading in executor.ts when agent.rag_enabled
  - Commented out automatic RAG injection in engine.ts
  - LLM now decides when to search documents (saves tokens)"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### F1.5: Verificar deploy en preview

- [ ] **Obtener URL de preview**
  ```bash
  # Vercel debería crear automáticamente
  # O forzar: npx vercel --confirm
  ```
  - URL de preview: `_________________________________`

- [ ] **Test manual en preview**
  1. Ir a la URL de preview
  2. Abrir chat con un agente que tenga `rag_enabled = true`
  3. Hacer una pregunta que requiera documentos
  4. Verificar que el LLM llama a `search_knowledge_base`
  5. Hacer una pregunta que NO requiera documentos
  6. Verificar que el LLM NO llama a la tool

### ✅ Checkpoint F1: Tests de validación

**⛔ GATE: Todos deben pasar antes de continuar**

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Agent evals** (NO debe haber regresión)
  ```bash
  npx tsx tests/evals/run-agent-evals.ts 2>&1 | tee /tmp/f1-evals.log
  tail -5 /tmp/f1-evals.log
  ```
  - Resultado: `_____ / _____ = _____%`
  - Comparar con baseline: ≥ baseline ✅ / < baseline ❌

- [ ] **Verificar logs del RAG tool**
  ```bash
  # En los logs del preview deploy, buscar:
  # "[Tools] RAG tool loaded for agent:"
  ```

| Check | Estado |
|-------|--------|
| rag-tool.ts creado y compila | [ ] |
| executor.ts modificado y compila | [ ] |
| engine.ts modificado y compila | [ ] |
| Commit y push exitoso | [ ] |
| Preview deploy funciona | [ ] |
| Quick test pasa | [ ] |
| Agent evals ≥ baseline | [ ] |
| RAG tool se carga para agentes con rag_enabled | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 2**

---

## FASE 2: PWA BASE [~4 horas]

> **Objetivo:** Tuqui se instala como app nativa desde el browser  
> **Riesgo:** BAJO - Son cambios frontend, no afectan lógica de negocio

### F2.1: Crear manifest.json

- [ ] **Crear archivo** `public/manifest.json`
  
  ```json
  {
    "name": "Tuqui - Asistente de Negocio con IA",
    "short_name": "Tuqui",
    "description": "Tu asistente empresarial inteligente",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#1e1b4b",
    "theme_color": "#6366f1",
    "orientation": "portrait-primary",
    "icons": [
      {
        "src": "/icons/icon-192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icons/icon-512.png",
        "sizes": "512x512",
        "type": "image/png"
      },
      {
        "src": "/icons/icon-maskable.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ]
  }
  ```

### F2.2: Crear íconos PWA

- [ ] **Crear directorio** `public/icons/`
- [ ] **Generar íconos** (usar logo Tuqui existente)
  - [ ] `icon-192.png` (192x192)
  - [ ] `icon-512.png` (512x512)
  - [ ] `icon-maskable.png` (512x512, con padding para safe zone)

### F2.3: Agregar metadata PWA al layout

- [ ] **Modificar** `app/layout.tsx`
  
  Agregar a la metadata existente:
  ```typescript
  export const metadata: Metadata = {
    // ...existing metadata...
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Tuqui',
    },
  }
  
  export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#6366f1',
  }
  ```

### F2.4: Mejorar Service Worker con caching

- [ ] **Modificar** `public/sw.js`
  
  Mantener TODO el código de push notifications existente (líneas ~40-86).
  Agregar al inicio:
  
  ```javascript
  const CACHE_NAME = 'tuqui-v1'
  const PRECACHE_URLS = [
    '/',
    '/chat/tuqui',
    '/offline',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
  ]
  
  // Install: precache
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(PRECACHE_URLS))
    )
    self.skipWaiting()
  })
  
  // Activate: limpiar caches viejos
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then(keys => 
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )
      )
    )
    self.clients.claim()
  })
  
  // Fetch: network first, cache fallback
  self.addEventListener('fetch', (event) => {
    // No cachear APIs
    if (event.request.url.includes('/api/')) return
    
    // Solo requests GET
    if (event.request.method !== 'GET') return
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cachear respuesta exitosa
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Si falla red, buscar en cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('/offline'))
        })
    )
  })
  
  // === PUSH HANDLING (mantener el existente) ===
  // ... (el código de push que ya existe)
  ```

### F2.5: Crear página offline

- [ ] **Crear archivo** `app/offline/page.tsx`
  
  ```typescript
  export default function OfflinePage() {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
        <div className="text-8xl mb-6">📡</div>
        <h1 className="text-3xl font-bold mb-3">Sin conexión</h1>
        <p className="text-gray-400 text-center mb-8 max-w-md">
          No hay conexión a internet. Verificá tu conexión y volvé a intentar.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-indigo-600 rounded-xl hover:bg-indigo-700 
                     transition-colors text-lg font-medium"
        >
          Reintentar
        </button>
      </div>
    )
  }
  ```

### F2.6: Actualizar middleware

- [ ] **Modificar** `middleware.ts`
  
  Actualizar el matcher para excluir rutas PWA:
  ```typescript
  export const config = {
    matcher: [
      '/((?!_next|api|sw.js|manifest.json|icons|offline|favicon.ico).*)',
    ],
  }
  ```

### F2.7: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add public/manifest.json public/icons/ public/sw.js app/offline/ app/layout.tsx middleware.ts
  git commit -m "feat: PWA support with offline caching

  - Added manifest.json for installability
  - Created PWA icons (192, 512, maskable)
  - Enhanced service worker with offline caching
  - Created offline fallback page
  - Updated middleware to exclude PWA routes"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F2: Tests de validación

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Lighthouse PWA audit**
  1. Abrir preview URL en Chrome
  2. DevTools → Lighthouse → PWA
  - Score: `_____` (objetivo: ≥90)

- [ ] **Test de instalación**
  1. En Chrome, verificar que aparece el ícono de instalar en la barra de direcciones
  - Resultado: [ ] Aparece / [ ] No aparece

- [ ] **Test offline**
  1. Instalar la app
  2. Desactivar red (DevTools → Network → Offline)
  3. Recargar
  - Resultado: [ ] Muestra página offline / [ ] Error

- [ ] **Push sigue funcionando**
  1. Enviar una notificación de prueba
  - Resultado: [ ] Llega / [ ] No llega

| Check | Estado |
|-------|--------|
| manifest.json creado | [ ] |
| Íconos generados | [ ] |
| Layout con metadata PWA | [ ] |
| SW con caching | [ ] |
| Página offline | [ ] |
| Middleware actualizado | [ ] |
| Lighthouse PWA ≥90 | [ ] |
| App instalable | [ ] |
| Offline funciona | [ ] |
| Push funciona | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 3**

---

## FASE 3: MODELO DE DATOS [~2 horas]

> **Objetivo:** Crear tablas para user profiles, briefing history  
> **Riesgo:** MEDIO - Modifica DB de producción, pero con IF NOT EXISTS  
> **⚠️ IMPORTANTE:** Las migrations se aplican a la DB de producción (compartida entre main y refactor)

### F3.1: Migration user_profiles

- [ ] **Crear archivo** `supabase/migrations/20260201_001_user_profiles.sql`
  
  ```sql
  -- ============================================
  -- TABLA: user_profiles
  -- Perfil individual de cada usuario del tenant
  -- ============================================
  CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    display_name TEXT,
    role_title TEXT,
    role_description TEXT,
    
    -- Intereses (raw = texto libre, parsed = JSON estructurado por IA)
    interests_raw TEXT,
    interests_parsed JSONB DEFAULT '[]'::jsonb,
    
    -- Alertas (raw = texto libre, parsed = JSON estructurado por IA)
    alerts_raw TEXT,
    alerts_parsed JSONB DEFAULT '[]'::jsonb,
    
    -- Preferencias de briefing
    briefing_enabled BOOLEAN DEFAULT true,
    briefing_time TIME DEFAULT '07:00',
    briefing_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 1=Lun...7=Dom
    briefing_timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
    
    -- Preferencias de push
    push_enabled BOOLEAN DEFAULT true,
    push_priority_only BOOLEAN DEFAULT false,
    
    -- Estado de onboarding
    onboarding_step INTEGER DEFAULT 0,
    onboarding_completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(tenant_id, user_email)
  );
  
  -- Índices
  CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant 
    ON user_profiles(tenant_id);
  
  CREATE INDEX IF NOT EXISTS idx_user_profiles_briefing 
    ON user_profiles(briefing_enabled, briefing_time) 
    WHERE briefing_enabled = true;
  
  -- RLS (Row Level Security)
  ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  
  -- Policy: usuarios solo ven su propio perfil
  CREATE POLICY IF NOT EXISTS "Users can view own profile" 
    ON user_profiles FOR SELECT 
    USING (auth.email() = user_email);
  
  CREATE POLICY IF NOT EXISTS "Users can update own profile" 
    ON user_profiles FOR UPDATE 
    USING (auth.email() = user_email);
  
  -- Policy: service role puede todo
  CREATE POLICY IF NOT EXISTS "Service role full access" 
    ON user_profiles FOR ALL 
    USING (auth.role() = 'service_role');
  ```

### F3.2: Migration tenant columns

- [ ] **Crear archivo** `supabase/migrations/20260201_002_tenant_onboarding.sql`
  
  ```sql
  -- ============================================
  -- COLUMNAS NUEVAS EN tenants
  -- Para onboarding y contexto de empresa
  -- ============================================
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_industry TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_description TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_products_services TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_target_customers TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_special_instructions TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_employees_count TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_location TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_cuit TEXT;
  ```

### F3.3: Migration briefing_history

- [ ] **Crear archivo** `supabase/migrations/20260201_003_briefing_history.sql`
  
  ```sql
  -- ============================================
  -- TABLA: briefing_history
  -- Historial de briefings enviados
  -- ============================================
  CREATE TABLE IF NOT EXISTS briefing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    
    -- Contenido del briefing
    push_title TEXT NOT NULL,
    push_body TEXT NOT NULL,
    full_briefing TEXT NOT NULL,
    
    -- Metadata
    alerts JSONB DEFAULT '[]'::jsonb,
    metrics_consulted TEXT[] DEFAULT '{}',
    
    -- Timestamps
    sent_at TIMESTAMPTZ DEFAULT now(),
    opened_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
  );
  
  -- Índice para búsqueda por usuario
  CREATE INDEX IF NOT EXISTS idx_briefing_user 
    ON briefing_history(tenant_id, user_email, created_at DESC);
  
  -- RLS
  ALTER TABLE briefing_history ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY IF NOT EXISTS "Users can view own briefings" 
    ON briefing_history FOR SELECT 
    USING (auth.email() = user_email);
  
  CREATE POLICY IF NOT EXISTS "Service role full access" 
    ON briefing_history FOR ALL 
    USING (auth.role() = 'service_role');
  ```

### F3.4: Aplicar migrations

- [ ] **Verificar script de migrations existe**
  ```bash
  ls scripts/apply-migration.ts
  ```

- [ ] **Aplicar migration 1 (user_profiles)**
  ```bash
  npx tsx scripts/apply-migration.ts supabase/migrations/20260201_001_user_profiles.sql
  ```
  - Resultado: `_______________`

- [ ] **Aplicar migration 2 (tenant columns)**
  ```bash
  npx tsx scripts/apply-migration.ts supabase/migrations/20260201_002_tenant_onboarding.sql
  ```
  - Resultado: `_______________`

- [ ] **Aplicar migration 3 (briefing_history)**
  ```bash
  npx tsx scripts/apply-migration.ts supabase/migrations/20260201_003_briefing_history.sql
  ```
  - Resultado: `_______________`

### F3.5: Verificar tablas creadas

- [ ] **Verificar user_profiles**
  ```bash
  # En Supabase SQL Editor o con psql:
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name = 'user_profiles' ORDER BY ordinal_position;
  ```
  - Resultado: [ ] Tabla existe con todas las columnas

- [ ] **Verificar columnas en tenants**
  ```bash
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'tenants' AND column_name LIKE 'company_%' OR column_name LIKE 'onboarding_%';
  ```
  - Resultado: [ ] Columnas existen

- [ ] **Verificar briefing_history**
  ```bash
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name = 'briefing_history' ORDER BY ordinal_position;
  ```
  - Resultado: [ ] Tabla existe con todas las columnas

### F3.6: Crear tipos TypeScript

- [ ] **Crear archivo** `lib/types/user-profile.ts`
  
  ```typescript
  export interface UserProfile {
    id: string
    tenant_id: string
    user_email: string
    display_name: string | null
    role_title: string | null
    role_description: string | null
    interests_raw: string | null
    interests_parsed: InterestItem[]
    alerts_raw: string | null
    alerts_parsed: AlertRule[]
    briefing_enabled: boolean
    briefing_time: string
    briefing_days: number[]
    briefing_timezone: string
    push_enabled: boolean
    push_priority_only: boolean
    onboarding_step: number
    onboarding_completed_at: string | null
    created_at: string
    updated_at: string
  }
  
  export interface InterestItem {
    category: 'ventas' | 'cobranzas' | 'stock' | 'clientes' | 'finanzas' | 'compras' | 'rrhh' | 'operaciones'
    focus: string      // Subcategoría corta (ej: "por vendedor")
    detail: string     // Descripción para que el LLM sepa qué consultar
  }
  
  export interface AlertRule {
    condition: string     // Nombre corto (ej: "vendedor_sin_facturar")
    threshold: string     // Parámetro (ej: "3 días")
    priority: 'low' | 'normal' | 'high'
    description: string   // Descripción completa para que el LLM evalúe
  }
  
  export interface BriefingResult {
    push_title: string
    push_body: string
    full_briefing: string
    alerts: BriefingAlert[]
    metrics_consulted: string[]
  }
  
  export interface BriefingAlert {
    title: string
    body: string
    priority: 'low' | 'normal' | 'high'
  }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/types/user-profile.ts
  ```

### F3.7: Crear servicio de profiles

- [ ] **Crear archivo** `lib/profiles/service.ts`
  
  ```typescript
  import { getClient, getTenantClient } from '@/lib/supabase/client'
  import type { UserProfile } from '@/lib/types/user-profile'
  
  export async function getUserProfile(
    tenantId: string, 
    userEmail: string
  ): Promise<UserProfile | null> {
    const db = await getTenantClient(tenantId)
    const { data, error } = await db
      .from('user_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_email', userEmail)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('[Profiles] Error getting profile:', error)
      throw error
    }
    
    return data as UserProfile | null
  }
  
  export async function upsertUserProfile(
    tenantId: string,
    userEmail: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    const db = await getTenantClient(tenantId)
    const { data, error } = await db
      .from('user_profiles')
      .upsert({
        tenant_id: tenantId,
        user_email: userEmail,
        ...updates,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'tenant_id,user_email' 
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Profiles] Error upserting profile:', error)
      throw error
    }
    
    return data as UserProfile
  }
  
  export async function getProfilesForBriefing(
    currentTime: string,   // "07:00"
    currentDay: number     // 1=Lun...7=Dom
  ): Promise<UserProfile[]> {
    const db = getClient()
    const { data, error } = await db
      .from('user_profiles')
      .select('*, tenants!inner(id, name, company_context)')
      .eq('briefing_enabled', true)
      .eq('briefing_time', currentTime)
      .contains('briefing_days', [currentDay])
    
    if (error) {
      console.error('[Profiles] Error getting briefing profiles:', error)
      throw error
    }
    
    return (data || []) as UserProfile[]
  }
  
  export async function getProfilesWithAlerts(): Promise<UserProfile[]> {
    const db = getClient()
    const { data, error } = await db
      .from('user_profiles')
      .select('*, tenants!inner(id, name, company_context)')
      .not('alerts_parsed', 'eq', '[]')
    
    if (error) {
      console.error('[Profiles] Error getting profiles with alerts:', error)
      throw error
    }
    
    return (data || []) as UserProfile[]
  }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/profiles/service.ts
  ```

### F3.8: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add supabase/migrations/ lib/types/user-profile.ts lib/profiles/service.ts
  git commit -m "feat: Data model for user profiles and briefings

  - Migration for user_profiles table
  - Migration for tenant onboarding columns
  - Migration for briefing_history table
  - TypeScript types for profiles, interests, alerts
  - Profile service with CRUD operations"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F3: Tests de validación

- [ ] **Quick test** (verificar que no rompimos nada)
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Agent evals** (verificar que no rompimos nada)
  ```bash
  npx tsx tests/evals/run-agent-evals.ts 2>&1 | tail -5
  ```
  - Resultado: `_____ / _____ = _____%`

- [ ] **Test de inserción en user_profiles**
  ```sql
  -- Insertar perfil de prueba
  INSERT INTO user_profiles (tenant_id, user_email, display_name)
  VALUES ('de7ef34a-12bd-4fe9-9d02-3d876a9393c2', 'test@test.com', 'Test User')
  ON CONFLICT (tenant_id, user_email) DO UPDATE SET display_name = 'Test User';
  
  -- Verificar
  SELECT * FROM user_profiles WHERE user_email = 'test@test.com';
  
  -- Limpiar
  DELETE FROM user_profiles WHERE user_email = 'test@test.com';
  ```

| Check | Estado |
|-------|--------|
| Migration user_profiles aplicada | [ ] |
| Migration tenant columns aplicada | [ ] |
| Migration briefing_history aplicada | [ ] |
| Tipos TypeScript creados | [ ] |
| Servicio profiles creado | [ ] |
| Todo compila | [ ] |
| Quick test pasa | [ ] |
| Agent evals ≥ baseline | [ ] |
| Insert/Select en user_profiles funciona | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 4**

---

## FASE 4: PUSH SENDER GENÉRICO [~2 horas]

> **Objetivo:** Extraer lógica de push a un módulo reutilizable  
> **Riesgo:** BAJO - Refactor interno, misma funcionalidad  
> **Dependencias:** Fase 3 completada (tablas existen)

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿Limpiar subscriptions expiradas automáticamente?**
   - [ ] Sí, eliminar de la DB cuando webpush devuelve 410/404
   - [ ] No, solo loguear

2. **¿Logging de push enviados?**
   - [ ] Sí, guardar en tabla `push_logs`
   - [ ] No, solo console.log

3. **¿Rate limiting?**
   - [ ] Sí, máximo X push por usuario por hora
   - [ ] No, sin límites

**Confirmación:** [ ] Usuario revisó y aprobó → Proceder con desarrollo

---

### F4.1: Crear módulo push sender

- [ ] **Crear archivo** `lib/push/sender.ts`
  
  ```typescript
  import webpush from 'web-push'
  import { getClient } from '@/lib/supabase/client'
  
  // Configurar VAPID
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  
  export interface PushPayload {
    title: string
    body: string
    url?: string
    icon?: string
    badge?: string
    tag?: string
    priority?: 'low' | 'normal' | 'high'
  }
  
  export interface PushOptions {
    tenantId: string
    userEmails?: string[]  // Si vacío/undefined, envía a todos del tenant
  }
  
  export interface PushResult {
    sent: number
    failed: number
    cleaned: number  // Subscriptions inválidas eliminadas
    errors: string[]
  }
  
  export async function sendPush(
    payload: PushPayload,
    options: PushOptions
  ): Promise<PushResult> {
    const db = getClient()
    const result: PushResult = { sent: 0, failed: 0, cleaned: 0, errors: [] }
    
    // Obtener subscriptions
    let query = db
      .from('push_subscriptions')
      .select('*')
      .eq('tenant_id', options.tenantId)
    
    if (options.userEmails?.length) {
      query = query.in('user_email', options.userEmails)
    }
    
    const { data: subscriptions, error } = await query
    
    if (error) {
      console.error('[Push] Error fetching subscriptions:', error)
      result.errors.push(error.message)
      return result
    }
    
    if (!subscriptions?.length) {
      console.log('[Push] No subscriptions found')
      return result
    }
    
    console.log(`[Push] Sending to ${subscriptions.length} subscriptions`)
    
    // Enviar a cada subscription
    for (const sub of subscriptions) {
      try {
        const pushPayload = JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          icon: payload.icon || '/icons/icon-192.png',
          badge: payload.badge || '/icons/icon-192.png',
          tag: payload.tag,
        })
        
        await webpush.sendNotification(
          JSON.parse(sub.subscription),
          pushPayload
        )
        
        result.sent++
      } catch (err: any) {
        // Subscription expirada o inválida
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Push] Cleaning expired subscription: ${sub.id}`)
          await db.from('push_subscriptions').delete().eq('id', sub.id)
          result.cleaned++
        } else {
          console.error(`[Push] Error sending to ${sub.id}:`, err.message)
          result.failed++
          result.errors.push(err.message)
        }
      }
    }
    
    console.log(`[Push] Result: sent=${result.sent}, failed=${result.failed}, cleaned=${result.cleaned}`)
    return result
  }
  
  // Helper para enviar a un solo usuario
  export async function sendPushToUser(
    payload: PushPayload,
    tenantId: string,
    userEmail: string
  ): Promise<PushResult> {
    return sendPush(payload, { tenantId, userEmails: [userEmail] })
  }
  
  // Helper para enviar a todo el tenant
  export async function sendPushToTenant(
    payload: PushPayload,
    tenantId: string
  ): Promise<PushResult> {
    return sendPush(payload, { tenantId })
  }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/push/sender.ts
  ```

### F4.2: Crear tipos de push

- [ ] **Crear archivo** `lib/push/types.ts`
  
  ```typescript
  export interface PushSubscriptionData {
    id: string
    tenant_id: string
    user_email: string
    subscription: string  // JSON string of PushSubscription
    created_at: string
    updated_at: string
  }
  
  export interface PushNotificationPayload {
    title: string
    body: string
    url?: string
    icon?: string
    badge?: string
    tag?: string
    actions?: PushAction[]
    requireInteraction?: boolean
    silent?: boolean
    vibrate?: number[]
  }
  
  export interface PushAction {
    action: string
    title: string
    icon?: string
  }
  ```

### F4.3: Refactorizar Prometeo notifier

- [ ] **Modificar** `lib/prometeo/notifier.ts`
  
  Buscar donde se usa `webpush.sendNotification` directamente y reemplazar:
  
  ```typescript
  // ANTES:
  // import webpush from 'web-push'
  // await webpush.sendNotification(subscription, payload)
  
  // DESPUÉS:
  import { sendPush } from '@/lib/push/sender'
  
  // En la función sendPushNotification:
  await sendPush(
    { 
      title: payload.title, 
      body: payload.body, 
      url: payload.link || '/' 
    },
    { 
      tenantId, 
      userEmails: payload.target_users 
    }
  )
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit lib/prometeo/notifier.ts
  ```

### F4.4: Test de push sender

- [ ] **Crear archivo** `tests/push/sender.test.ts`
  
  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  
  describe('Push Sender', () => {
    it('should export sendPush function', async () => {
      const { sendPush } = await import('@/lib/push/sender')
      expect(typeof sendPush).toBe('function')
    })
    
    it('should return empty result when no subscriptions', async () => {
      // Mock de Supabase que retorna array vacío
      const { sendPush } = await import('@/lib/push/sender')
      // Este test requiere mock de Supabase
    })
  })
  ```

### F4.5: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/push/ lib/prometeo/notifier.ts tests/push/
  git commit -m "refactor: Extract push sender to reusable module

  - Created lib/push/sender.ts with sendPush, sendPushToUser, sendPushToTenant
  - Created lib/push/types.ts with push-related types
  - Refactored prometeo/notifier.ts to use new sender
  - Auto-cleanup of expired subscriptions (410/404)"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F4: Tests de validación

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Test manual de push**
  1. Ir a preview deploy
  2. Activar notificaciones si no están activas
  3. Triggear una notificación de Prometeo
  - Resultado: [ ] Llega correctamente / [ ] No llega

- [ ] **Verificar logs de push**
  ```bash
  # En logs de Vercel, buscar:
  # "[Push] Sending to X subscriptions"
  # "[Push] Result: sent=X, failed=Y, cleaned=Z"
  ```

| Check | Estado |
|-------|--------|
| lib/push/sender.ts creado | [ ] |
| lib/push/types.ts creado | [ ] |
| prometeo/notifier.ts refactorizado | [ ] |
| Todo compila | [ ] |
| Quick test pasa | [ ] |
| Push notification llega | [ ] |
| Prometeo sigue funcionando | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 5**

---

## FASE 5: ONBOARDING WIZARD [~8 horas]

> **Objetivo:** Wizard de 5 pasos para configurar empresa, perfil y alertas  
> **Riesgo:** MEDIO - Nuevo flujo de usuario, afecta UX  
> **Dependencias:** Fase 3 (user_profiles), Fase 4 (push sender)

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿El onboarding es obligatorio?**
   - [ ] Sí, no puede usar el chat sin completarlo
   - [ ] Sí, pero puede skipear pasos
   - [ ] No, es opcional (puede acceder desde settings)

2. **¿Qué pasos ve cada rol?**
   - [ ] Admin ve los 5 pasos (empresa, integraciones, equipo, perfil, alertas)
   - [ ] Usuario normal ve solo 2 pasos (perfil, alertas)
   - [ ] Otra configuración: `_______________`

3. **¿Integración con Odoo en onboarding?**
   - [ ] Sí, test de conexión en paso 2
   - [ ] No, ya está configurado antes del onboarding

4. **¿Invitar equipo en onboarding?**
   - [ ] Sí, paso 3 permite agregar emails
   - [ ] No, eso se hace en /admin/users

5. **¿Parseo de intereses/alertas con IA?**
   - [ ] Sí, en background después de guardar
   - [ ] No, solo guardar texto libre

6. **¿Activar push en onboarding?**
   - [ ] Sí, paso 5 incluye botón de activar push
   - [ ] No, se hace después manualmente

**Confirmación:** [ ] Usuario revisó y aprobó → Proceder con desarrollo

---

### F5.1: API de onboarding

- [ ] **Crear archivo** `app/api/onboarding/route.ts`
  
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { auth } from '@/lib/auth/config'
  import { getClient } from '@/lib/supabase/client'
  import { getUserProfile, upsertUserProfile } from '@/lib/profiles/service'
  
  // GET: Obtener estado actual del onboarding
  export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const tenantId = session.user.tenantId
    const userEmail = session.user.email
    const isAdmin = session.user.role === 'admin'
    
    const db = getClient()
    
    // Obtener datos del tenant
    const { data: tenant } = await db
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()
    
    // Obtener perfil del usuario
    const profile = await getUserProfile(tenantId, userEmail)
    
    return NextResponse.json({
      tenant: {
        id: tenant?.id,
        name: tenant?.name,
        onboarding_completed: tenant?.onboarding_completed,
        onboarding_step: tenant?.onboarding_step,
        company_industry: tenant?.company_industry,
        company_description: tenant?.company_description,
      },
      profile: profile,
      isAdmin,
      // Qué pasos debe ver este usuario
      steps: isAdmin 
        ? ['company', 'integrations', 'team', 'profile', 'alerts']
        : ['profile', 'alerts']
    })
  }
  
  // POST: Guardar un paso del wizard
  export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const tenantId = session.user.tenantId
    const userEmail = session.user.email
    const isAdmin = session.user.role === 'admin'
    
    const body = await request.json()
    const { step, data } = body
    
    const db = getClient()
    
    try {
      switch (step) {
        case 'company':
          if (!isAdmin) throw new Error('Solo admins pueden editar empresa')
          await db.from('tenants').update({
            name: data.name,
            company_industry: data.industry,
            company_description: data.description,
            company_location: data.location,
            company_employees_count: data.employees_count,
            onboarding_step: 1,
          }).eq('id', tenantId)
          break
          
        case 'integrations':
          if (!isAdmin) throw new Error('Solo admins pueden editar integraciones')
          // Por ahora solo actualizamos el step
          await db.from('tenants').update({
            onboarding_step: 2,
          }).eq('id', tenantId)
          break
          
        case 'team':
          if (!isAdmin) throw new Error('Solo admins pueden invitar equipo')
          // Lógica de invitación de usuarios
          await db.from('tenants').update({
            onboarding_step: 3,
          }).eq('id', tenantId)
          break
          
        case 'profile':
          await upsertUserProfile(tenantId, userEmail, {
            display_name: data.display_name,
            role_title: data.role_title,
            role_description: data.role_description,
            interests_raw: data.interests_raw,
            onboarding_step: 4,
          })
          // TODO: Parsear intereses con IA en background
          break
          
        case 'alerts':
          await upsertUserProfile(tenantId, userEmail, {
            alerts_raw: data.alerts_raw,
            briefing_enabled: data.briefing_enabled ?? true,
            briefing_time: data.briefing_time ?? '07:00',
            briefing_days: data.briefing_days ?? [1,2,3,4,5],
            push_enabled: data.push_enabled ?? true,
            onboarding_step: 5,
            onboarding_completed_at: new Date().toISOString(),
          })
          
          // Marcar onboarding completo si es admin
          if (isAdmin) {
            await db.from('tenants').update({
              onboarding_completed: true,
              onboarding_step: 5,
            }).eq('id', tenantId)
          }
          break
          
        default:
          throw new Error(`Step desconocido: ${step}`)
      }
      
      return NextResponse.json({ success: true, step })
    } catch (error: any) {
      console.error('[Onboarding] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }
  ```

- [ ] **Verificar que compila**
  ```bash
  npx tsc --noEmit app/api/onboarding/route.ts
  ```

### F5.2: Parseo de intereses con IA

- [ ] **Crear archivo** `lib/onboarding/parse-interests.ts`
  
  ```typescript
  import { generateText } from 'ai'
  import { google } from '@ai-sdk/google'
  import type { InterestItem } from '@/lib/types/user-profile'
  import { upsertUserProfile } from '@/lib/profiles/service'
  
  export async function parseInterestsAsync(
    tenantId: string,
    userEmail: string,
    interestsRaw: string,
    roleTitle: string
  ): Promise<void> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash'),
        system: `Sos un parser de intereses empresariales.
  
  Dado el texto libre de un usuario y su rol, extraé intereses estructurados.
  
  Categorías válidas: ventas, cobranzas, stock, clientes, finanzas, compras, rrhh, operaciones
  
  Cada interés debe tener:
  - category: una de las categorías válidas
  - focus: subcategoría corta (ej: "por vendedor", "vencidos", "bajo mínimo")
  - detail: descripción de qué consultar en el sistema (ej: "ventas agrupadas por vendedor del mes actual")
  
  Respondé SOLO un JSON array, sin markdown ni explicaciones.`,
        prompt: `Rol del usuario: ${roleTitle}
  
  Texto de intereses:
  ${interestsRaw}
  
  JSON:`,
      })
      
      const parsed: InterestItem[] = JSON.parse(text)
      
      await upsertUserProfile(tenantId, userEmail, {
        interests_parsed: parsed,
      })
      
      console.log(`[ParseInterests] Parsed ${parsed.length} interests for ${userEmail}`)
    } catch (error) {
      console.error('[ParseInterests] Error:', error)
      // No lanzar error - es un proceso en background
    }
  }
  ```

### F5.3: Parseo de alertas con IA

- [ ] **Crear archivo** `lib/onboarding/parse-alerts.ts`
  
  ```typescript
  import { generateText } from 'ai'
  import { google } from '@ai-sdk/google'
  import type { AlertRule } from '@/lib/types/user-profile'
  import { upsertUserProfile } from '@/lib/profiles/service'
  
  export async function parseAlertsAsync(
    tenantId: string,
    userEmail: string,
    alertsRaw: string,
    roleTitle: string
  ): Promise<void> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash'),
        system: `Sos un parser de reglas de alerta empresarial.
  
  Dado el texto libre de un usuario, extraé reglas de alerta estructuradas.
  
  Cada alerta debe tener:
  - condition: nombre corto de la condición (ej: "vendedor_sin_facturar", "stock_bajo", "factura_vencida")
  - threshold: parámetro de la alerta (ej: "3 días", "10 unidades", "30 días")
  - priority: low | normal | high
  - description: descripción completa para que un agente IA pueda evaluar la condición
  
  Respondé SOLO un JSON array, sin markdown ni explicaciones.`,
        prompt: `Rol del usuario: ${roleTitle}
  
  Texto de alertas:
  ${alertsRaw}
  
  JSON:`,
      })
      
      const parsed: AlertRule[] = JSON.parse(text)
      
      await upsertUserProfile(tenantId, userEmail, {
        alerts_parsed: parsed,
      })
      
      console.log(`[ParseAlerts] Parsed ${parsed.length} alerts for ${userEmail}`)
    } catch (error) {
      console.error('[ParseAlerts] Error:', error)
    }
  }
  ```

### F5.4: Componente OnboardingWizard (container)

- [ ] **Crear archivo** `components/onboarding/OnboardingWizard.tsx`
  
  ```typescript
  'use client'
  
  import { useState, useEffect } from 'react'
  import { useRouter } from 'next/navigation'
  
  // Steps
  import { CompanyStep } from './steps/CompanyStep'
  import { IntegrationsStep } from './steps/IntegrationsStep'
  import { TeamStep } from './steps/TeamStep'
  import { ProfileStep } from './steps/ProfileStep'
  import { AlertsStep } from './steps/AlertsStep'
  import { CompleteStep } from './steps/CompleteStep'
  
  interface Props {
    initialStep?: number
    steps: string[]
    isAdmin: boolean
    tenant: any
    profile: any
  }
  
  const STEP_COMPONENTS: Record<string, React.ComponentType<any>> = {
    company: CompanyStep,
    integrations: IntegrationsStep,
    team: TeamStep,
    profile: ProfileStep,
    alerts: AlertsStep,
  }
  
  export function OnboardingWizard({ initialStep = 0, steps, isAdmin, tenant, profile }: Props) {
    const router = useRouter()
    const [currentStepIndex, setCurrentStepIndex] = useState(initialStep)
    const [isLoading, setIsLoading] = useState(false)
    const [stepData, setStepData] = useState<Record<string, any>>({})
    
    const currentStepName = steps[currentStepIndex]
    const StepComponent = STEP_COMPONENTS[currentStepName]
    const isLastStep = currentStepIndex === steps.length - 1
    
    async function handleNext(data: any) {
      setIsLoading(true)
      
      try {
        // Guardar datos del paso actual
        const response = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: currentStepName, data }),
        })
        
        if (!response.ok) throw new Error('Error guardando')
        
        // Guardar en estado local
        setStepData(prev => ({ ...prev, [currentStepName]: data }))
        
        // Avanzar al siguiente paso
        if (isLastStep) {
          // Mostrar pantalla de completado
          setCurrentStepIndex(steps.length) // triggers CompleteStep
        } else {
          setCurrentStepIndex(prev => prev + 1)
        }
      } catch (error) {
        console.error('Error en onboarding:', error)
        alert('Hubo un error. Por favor intentá de nuevo.')
      } finally {
        setIsLoading(false)
      }
    }
    
    function handleBack() {
      if (currentStepIndex > 0) {
        setCurrentStepIndex(prev => prev - 1)
      }
    }
    
    function handleComplete() {
      router.push('/chat/tuqui')
    }
    
    // Mostrar CompleteStep si pasamos el último paso
    if (currentStepIndex >= steps.length) {
      return <CompleteStep onComplete={handleComplete} profile={profile} />
    }
    
    if (!StepComponent) {
      return <div>Error: Step {currentStepName} no encontrado</div>
    }
    
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Progress bar */}
        <div className="w-full bg-gray-800 h-2">
          <div 
            className="bg-indigo-500 h-2 transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
        
        {/* Step indicator */}
        <div className="text-center py-4 text-gray-400 text-sm">
          Paso {currentStepIndex + 1} de {steps.length}
        </div>
        
        {/* Step content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <StepComponent
            data={stepData[currentStepName] || {}}
            tenant={tenant}
            profile={profile}
            isAdmin={isAdmin}
            isLoading={isLoading}
            onNext={handleNext}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
          />
        </div>
      </div>
    )
  }
  ```

### F5.5: Steps individuales (esqueleto)

- [ ] **Crear archivo** `components/onboarding/steps/CompanyStep.tsx`
- [ ] **Crear archivo** `components/onboarding/steps/IntegrationsStep.tsx`
- [ ] **Crear archivo** `components/onboarding/steps/TeamStep.tsx`
- [ ] **Crear archivo** `components/onboarding/steps/ProfileStep.tsx`
- [ ] **Crear archivo** `components/onboarding/steps/AlertsStep.tsx`
- [ ] **Crear archivo** `components/onboarding/steps/CompleteStep.tsx`

> **Nota:** Cada step se detallará en tickets individuales durante el desarrollo.
> Por ahora, crear esqueletos básicos que muestren el nombre del paso.

### F5.6: Página del wizard

- [ ] **Crear archivo** `app/onboarding/page.tsx`
  
  ```typescript
  import { auth } from '@/lib/auth/config'
  import { redirect } from 'next/navigation'
  import { getClient } from '@/lib/supabase/client'
  import { getUserProfile } from '@/lib/profiles/service'
  import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
  
  export default async function OnboardingPage() {
    const session = await auth()
    if (!session?.user?.email) {
      redirect('/auth/signin')
    }
    
    const tenantId = session.user.tenantId
    const userEmail = session.user.email
    const isAdmin = session.user.role === 'admin'
    
    const db = getClient()
    
    // Obtener datos del tenant
    const { data: tenant } = await db
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()
    
    // Obtener perfil del usuario
    const profile = await getUserProfile(tenantId, userEmail)
    
    // Si ya completó onboarding, ir al chat
    if (profile?.onboarding_completed_at) {
      redirect('/chat/tuqui')
    }
    
    // Determinar pasos según rol
    const steps = isAdmin 
      ? ['company', 'integrations', 'team', 'profile', 'alerts']
      : ['profile', 'alerts']
    
    // Determinar en qué paso está
    const initialStep = profile?.onboarding_step || 0
    
    return (
      <OnboardingWizard
        initialStep={Math.min(initialStep, steps.length - 1)}
        steps={steps}
        isAdmin={isAdmin}
        tenant={tenant}
        profile={profile}
      />
    )
  }
  ```

### F5.7: Gate en homepage

- [ ] **Modificar** `app/page.tsx`
  
  Agregar al inicio, después de verificar sesión:
  
  ```typescript
  // Verificar si completó onboarding
  const profile = await getUserProfile(tenantId, userEmail)
  if (!profile?.onboarding_completed_at) {
    redirect('/onboarding')
  }
  ```

### F5.8: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add app/api/onboarding/ lib/onboarding/ components/onboarding/ app/onboarding/ app/page.tsx
  git commit -m "feat: Onboarding wizard with 5 steps

  - API routes for GET/POST onboarding state
  - Interest and alert parsing with AI
  - Wizard container with progress bar
  - Step components (Company, Integrations, Team, Profile, Alerts)
  - Homepage gate to redirect new users
  - Complete step with celebration"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F5: Tests de validación

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Test manual de onboarding**
  1. Crear un usuario nuevo en Supabase (sin perfil)
  2. Ir a preview deploy
  3. Login con ese usuario
  4. Verificar que redirige a /onboarding
  - Resultado: [ ] Redirige / [ ] No redirige

- [ ] **Completar wizard completo**
  1. Llenar paso 1 (empresa)
  2. Llenar paso 2 (integraciones) - puede skipear
  3. Llenar paso 3 (equipo) - puede skipear
  4. Llenar paso 4 (perfil)
  5. Llenar paso 5 (alertas)
  6. Verificar que llega a /chat/tuqui
  - Resultado: [ ] Funciona / [ ] Error en paso `___`

- [ ] **Verificar datos guardados**
  ```sql
  SELECT * FROM user_profiles WHERE user_email = 'tu@email.com';
  ```

| Check | Estado |
|-------|--------|
| API onboarding funciona | [ ] |
| Wizard container renderiza | [ ] |
| Todos los steps funcionan | [ ] |
| Parseo de intereses funciona | [ ] |
| Parseo de alertas funciona | [ ] |
| Gate en homepage funciona | [ ] |
| Quick test pasa | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 6**

---

## FASE 6: BRIEFING ENGINE [~8 horas]

> **Objetivo:** Generar briefings matutinos personalizados y enviarlos por push  
> **Riesgo:** MEDIO - Nuevo proceso cron, consume API de LLM  
> **Dependencias:** Fase 3 (profiles), Fase 4 (push), Fase 5 (intereses parseados)

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿Frecuencia del cron?**
   - [ ] Cada 5 minutos (de 6 a 11 AM)
   - [ ] Cada 15 minutos
   - [ ] Cada hora

2. **¿Qué tools puede usar el briefing?**
   - [ ] Todas las skills de Odoo
   - [ ] Solo un subconjunto: `_______________`
   - [ ] También RAG

3. **¿Formato del briefing?**
   - [ ] Push corto + link al chat con briefing completo
   - [ ] Solo push (todo en el cuerpo)
   - [ ] Email además de push

4. **¿Guardar historial?**
   - [ ] Sí, en briefing_history (ya tenemos la tabla)
   - [ ] No

5. **¿Marcar como leído?**
   - [ ] Sí, cuando abre el link
   - [ ] No trackear

6. **¿Límite de intentos si falla?**
   - [ ] 1 intento (si falla, no reintenta hasta mañana)
   - [ ] 3 intentos con backoff
   - [ ] Sin límite

**Confirmación:** [ ] Usuario revisó y aprobó → Proceder con desarrollo

---

### F6.1: System prompt del briefing

- [ ] **Crear archivo** `lib/briefing/prompts.ts`
  
  ```typescript
  import type { UserProfile } from '@/lib/types/user-profile'
  
  export function buildBriefingSystemPrompt(
    profile: UserProfile,
    companyContext: string | null
  ): string {
    const today = new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    
    return `Sos Tuqui, el asistente de negocio con IA de la empresa.

  TU TAREA: Generá un briefing matutino personalizado para este usuario.
  
  USUARIO:
  - Nombre: ${profile.display_name || 'Usuario'}
  - Rol: ${profile.role_title || 'No especificado'}
  - Descripción del rol: ${profile.role_description || 'No especificado'}
  
  LO QUE LE IMPORTA (en sus palabras):
  ${profile.interests_raw || 'No especificó intereses'}
  
  INTERESES ESTRUCTURADOS:
  ${JSON.stringify(profile.interests_parsed || [], null, 2)}
  
  ALERTAS CONFIGURADAS:
  ${profile.alerts_raw || 'Sin alertas'}
  
  ALERTAS ESTRUCTURADAS:
  ${JSON.stringify(profile.alerts_parsed || [], null, 2)}
  
  ${companyContext ? `CONTEXTO DE LA EMPRESA:\n${companyContext}` : ''}
  
  FECHA ACTUAL: ${today}
  
  INSTRUCCIONES:
  1. Usá las herramientas para consultar datos relevantes a los intereses del usuario.
  2. Compará con períodos anteriores para detectar tendencias (ayer vs hoy, esta semana vs anterior).
  3. Evaluá las condiciones de alerta - si alguna se cumple, incluila como alerta.
  4. Sé conciso pero informativo - el usuario lee esto en 30-60 segundos.
  5. Usá emojis para hacer el texto más scaneable.
  
  FORMATO DE RESPUESTA (JSON estricto, sin markdown):
  {
    "push_title": "☀️ Buenos días [nombre]",
    "push_body": "Resumen de 1-2 líneas con lo más importante",
    "full_briefing": "Briefing completo en markdown con secciones para cada área de interés",
    "alerts": [
      { "title": "⚠️ Título de alerta", "body": "Detalle", "priority": "high" }
    ],
    "metrics_consulted": ["ventas_totales", "deuda_vencida", ...]
  }`
  }
  ```

### F6.2: Generador de briefings

- [ ] **Crear archivo** `lib/briefing/generator.ts`
  
  ```typescript
  import { google } from '@ai-sdk/google'
  import { generateText } from 'ai'
  import { getToolsForAgent } from '@/lib/tools/executor'
  import type { UserProfile, BriefingResult } from '@/lib/types/user-profile'
  import { buildBriefingSystemPrompt } from './prompts'
  import { getClient } from '@/lib/supabase/client'
  
  export async function generateBriefing(
    tenantId: string,
    agentId: string,
    profile: UserProfile
  ): Promise<BriefingResult | null> {
    console.log(`[Briefing] Generating for ${profile.user_email}`)
    
    try {
      const db = getClient()
      
      // Obtener contexto de empresa
      const { data: tenant } = await db
        .from('tenants')
        .select('company_context')
        .eq('id', tenantId)
        .single()
      
      // Obtener tools (skills de Odoo)
      const tools = await getToolsForAgent(tenantId, agentId, {
        id: agentId,
        skills_enabled: true,
        rag_enabled: false,
        tools: [],
      })
      
      const systemPrompt = buildBriefingSystemPrompt(
        profile,
        tenant?.company_context || null
      )
      
      const { text, toolCalls } = await generateText({
        model: google('gemini-2.0-flash'),
        system: systemPrompt,
        messages: [
          { role: 'user', content: 'Generá mi briefing matutino de hoy.' }
        ],
        tools,
        maxSteps: 10,  // Permitir múltiples llamadas a tools
      })
      
      console.log(`[Briefing] Tool calls: ${toolCalls?.length || 0}`)
      
      // Parsear respuesta JSON
      const result: BriefingResult = JSON.parse(text)
      
      return result
    } catch (error) {
      console.error(`[Briefing] Error generating for ${profile.user_email}:`, error)
      return null
    }
  }
  ```

### F6.3: Runner de briefings (cron)

- [ ] **Crear archivo** `lib/briefing/runner.ts`
  
  ```typescript
  import { getProfilesForBriefing } from '@/lib/profiles/service'
  import { generateBriefing } from './generator'
  import { sendPushToUser } from '@/lib/push/sender'
  import { getClient } from '@/lib/supabase/client'
  
  export async function runBriefings(): Promise<{ sent: number; failed: number; skipped: number }> {
    const now = new Date()
    const currentTime = now.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires'
    })
    const currentDay = now.getDay() || 7  // 1=Lun...7=Dom (getDay retorna 0 para domingo)
    
    console.log(`[BriefingRunner] Running at ${currentTime}, day ${currentDay}`)
    
    // Obtener perfiles que necesitan briefing ahora
    const profiles = await getProfilesForBriefing(currentTime, currentDay)
    
    console.log(`[BriefingRunner] Found ${profiles.length} profiles`)
    
    let sent = 0, failed = 0, skipped = 0
    const db = getClient()
    
    for (const profile of profiles) {
      try {
        // Verificar que no enviamos ya hoy
        const { data: existing } = await db
          .from('briefing_history')
          .select('id')
          .eq('tenant_id', profile.tenant_id)
          .eq('user_email', profile.user_email)
          .gte('sent_at', new Date().toISOString().split('T')[0])
          .single()
        
        if (existing) {
          console.log(`[BriefingRunner] Already sent today to ${profile.user_email}`)
          skipped++
          continue
        }
        
        // Generar briefing
        const agentId = 'tuqui'  // Usar agente principal
        const briefing = await generateBriefing(profile.tenant_id, agentId, profile)
        
        if (!briefing) {
          console.error(`[BriefingRunner] Failed to generate for ${profile.user_email}`)
          failed++
          continue
        }
        
        // Enviar push
        const pushResult = await sendPushToUser(
          {
            title: briefing.push_title,
            body: briefing.push_body,
            url: `/chat/tuqui?context=briefing`,
            priority: 'normal',
          },
          profile.tenant_id,
          profile.user_email
        )
        
        // Guardar en historial
        await db.from('briefing_history').insert({
          tenant_id: profile.tenant_id,
          user_email: profile.user_email,
          push_title: briefing.push_title,
          push_body: briefing.push_body,
          full_briefing: briefing.full_briefing,
          alerts: briefing.alerts || [],
          metrics_consulted: briefing.metrics_consulted || [],
          sent_at: new Date().toISOString(),
        })
        
        if (pushResult.sent > 0) {
          sent++
          console.log(`[BriefingRunner] Sent to ${profile.user_email}`)
        } else {
          failed++
          console.error(`[BriefingRunner] Push failed for ${profile.user_email}`)
        }
      } catch (error) {
        console.error(`[BriefingRunner] Error for ${profile.user_email}:`, error)
        failed++
      }
    }
    
    console.log(`[BriefingRunner] Complete: sent=${sent}, failed=${failed}, skipped=${skipped}`)
    return { sent, failed, skipped }
  }
  ```

### F6.4: API del cron

- [ ] **Crear archivo** `app/api/internal/briefings/route.ts`
  
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { runBriefings } from '@/lib/briefing/runner'
  
  export const maxDuration = 60  // 60 segundos máximo
  
  export async function GET(request: NextRequest) {
    // Verificar auth (solo Vercel Cron o llamada con secret)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[Briefings API] Starting briefing run')
    
    try {
      const result = await runBriefings()
      return NextResponse.json(result)
    } catch (error: any) {
      console.error('[Briefings API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  ```

### F6.5: Contexto de briefing en chat

- [ ] **Crear archivo** `lib/briefing/chat-context.ts`
  
  ```typescript
  import { getClient } from '@/lib/supabase/client'
  
  export async function getLatestBriefing(
    tenantId: string, 
    userEmail: string
  ): Promise<{ briefing: string; sentAt: string } | null> {
    const db = getClient()
    
    const { data, error } = await db
      .from('briefing_history')
      .select('full_briefing, sent_at')
      .eq('tenant_id', tenantId)
      .eq('user_email', userEmail)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error || !data) return null
    
    // Marcar como leído
    await db
      .from('briefing_history')
      .update({ opened_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('user_email', userEmail)
      .eq('sent_at', data.sent_at)
    
    return {
      briefing: data.full_briefing,
      sentAt: data.sent_at,
    }
  }
  ```

### F6.6: Agregar cron a vercel.json

- [ ] **Modificar** `vercel.json`
  
  ```json
  {
    "crons": [
      {
        "path": "/api/prometeo/run",
        "schedule": "0 8 * * *"
      },
      {
        "path": "/api/internal/briefings",
        "schedule": "*/5 9-14 * * 1-5"
      }
    ]
  }
  ```
  
  > Nota: `*/5 9-14 * * 1-5` = cada 5 minutos, de 9 a 14 UTC (6 a 11 Argentina), lunes a viernes

### F6.7: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/briefing/ app/api/internal/briefings/ vercel.json
  git commit -m "feat: Briefing engine with cron

  - System prompt builder for personalized briefings
  - Briefing generator using Odoo skills
  - Cron runner with deduplication
  - API endpoint for Vercel cron
  - Chat context loader for briefings
  - Cron schedule: every 5 min, 6-11 AM Argentina, Mon-Fri"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F6: Tests de validación

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Test manual del generador**
  ```bash
  # Crear script temporal para probar
  npx tsx -e "
    const { generateBriefing } = require('./lib/briefing/generator')
    const profile = { 
      user_email: 'test@test.com',
      display_name: 'Test',
      role_title: 'Gerente',
      interests_raw: 'ventas del día, stock bajo'
    }
    generateBriefing('tenant-id', 'tuqui', profile).then(console.log)
  "
  ```
  - Resultado: [ ] Genera briefing / [ ] Error

- [ ] **Test del endpoint**
  ```bash
  curl -X GET "https://preview-url/api/internal/briefings" \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  - Resultado: `_______________`

| Check | Estado |
|-------|--------|
| Prompts creados | [ ] |
| Generator funciona | [ ] |
| Runner funciona | [ ] |
| API endpoint funciona | [ ] |
| Cron configurado | [ ] |
| Historial se guarda | [ ] |
| Quick test pasa | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 7**

---

## FASE 7: SETTINGS [~3 horas]

> **Objetivo:** Página para editar perfil, intereses, alertas y relanzar wizard  
> **Riesgo:** BAJO - Nueva página, no afecta funcionalidad existente  
> **Dependencias:** Fase 3 (profiles), Fase 5 (onboarding)

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿Qué puede editar el usuario?**
   - [ ] Nombre, rol, descripción
   - [ ] Intereses (texto libre)
   - [ ] Alertas (texto libre)
   - [ ] Horario de briefing
   - [ ] Preferencias de push

2. **¿Relanzar wizard completo o solo ciertos pasos?**
   - [ ] Botón "Reconfigurar todo" → wizard desde paso 1
   - [ ] Botones individuales por sección

3. **¿Mostrar historial de briefings?**
   - [ ] Sí, últimos 5-10
   - [ ] No

4. **¿Admin puede editar settings de otros usuarios?**
   - [ ] Sí, desde /admin/users
   - [ ] No

**Confirmación:** [ ] Usuario revisó y aprobó → Proceder con desarrollo

---

### F7.1: Página de settings

- [ ] **Crear archivo** `app/settings/page.tsx`
  
  ```typescript
  import { auth } from '@/lib/auth/config'
  import { redirect } from 'next/navigation'
  import { getUserProfile } from '@/lib/profiles/service'
  import { getClient } from '@/lib/supabase/client'
  import { SettingsForm } from '@/components/settings/SettingsForm'
  import { BriefingHistory } from '@/components/settings/BriefingHistory'
  
  export default async function SettingsPage() {
    const session = await auth()
    if (!session?.user?.email) {
      redirect('/auth/signin')
    }
    
    const tenantId = session.user.tenantId
    const userEmail = session.user.email
    
    const profile = await getUserProfile(tenantId, userEmail)
    
    // Obtener últimos briefings
    const db = getClient()
    const { data: briefings } = await db
      .from('briefing_history')
      .select('id, push_title, push_body, sent_at, opened_at')
      .eq('tenant_id', tenantId)
      .eq('user_email', userEmail)
      .order('sent_at', { ascending: false })
      .limit(5)
    
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-8">
            Mi perfil y alertas
          </h1>
          
          <SettingsForm profile={profile} />
          
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Últimos briefings
            </h2>
            <BriefingHistory briefings={briefings || []} />
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">
              Reconfigurar
            </h2>
            <a 
              href="/onboarding?mode=reconfigure"
              className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 
                         rounded-lg text-white transition-colors"
            >
              Volver a configurar mi perfil
            </a>
          </div>
        </div>
      </div>
    )
  }
  ```

### F7.2: Componente SettingsForm

- [ ] **Crear archivo** `components/settings/SettingsForm.tsx`
  
  ```typescript
  'use client'
  
  import { useState } from 'react'
  import type { UserProfile } from '@/lib/types/user-profile'
  
  interface Props {
    profile: UserProfile | null
  }
  
  export function SettingsForm({ profile }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
      display_name: profile?.display_name || '',
      role_title: profile?.role_title || '',
      role_description: profile?.role_description || '',
      interests_raw: profile?.interests_raw || '',
      alerts_raw: profile?.alerts_raw || '',
      briefing_enabled: profile?.briefing_enabled ?? true,
      briefing_time: profile?.briefing_time || '07:00',
      push_enabled: profile?.push_enabled ?? true,
    })
    
    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      setIsLoading(true)
      
      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        
        if (!response.ok) throw new Error('Error guardando')
        
        alert('✅ Configuración guardada')
      } catch (error) {
        alert('❌ Error guardando configuración')
      } finally {
        setIsLoading(false)
      }
    }
    
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección: Perfil */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tu perfil</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input
                type="text"
                value={formData.display_name}
                onChange={e => setFormData(p => ({ ...p, display_name: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rol</label>
              <input
                type="text"
                value={formData.role_title}
                onChange={e => setFormData(p => ({ ...p, role_title: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descripción del rol</label>
              <textarea
                value={formData.role_description}
                onChange={e => setFormData(p => ({ ...p, role_description: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
              />
            </div>
          </div>
        </section>
        
        {/* Sección: Intereses */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tus intereses</h3>
          <p className="text-sm text-gray-400 mb-3">
            ¿Qué información te gustaría recibir cada mañana?
          </p>
          <textarea
            value={formData.interests_raw}
            onChange={e => setFormData(p => ({ ...p, interests_raw: e.target.value }))}
            rows={4}
            placeholder="Ej: Cuánto vendió cada vendedor ayer, si estamos llegando al objetivo del mes..."
            className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
          />
        </section>
        
        {/* Sección: Alertas */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tus alertas</h3>
          <p className="text-sm text-gray-400 mb-3">
            ¿Hay algo que quieras que Tuqui te avise urgente?
          </p>
          <textarea
            value={formData.alerts_raw}
            onChange={e => setFormData(p => ({ ...p, alerts_raw: e.target.value }))}
            rows={4}
            placeholder="Ej: Si un vendedor lleva más de 3 días sin facturar..."
            className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
          />
        </section>
        
        {/* Sección: Notificaciones */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Notificaciones</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.briefing_enabled}
                onChange={e => setFormData(p => ({ ...p, briefing_enabled: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="text-white">Recibir resumen diario</span>
            </label>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Horario</label>
              <select
                value={formData.briefing_time}
                onChange={e => setFormData(p => ({ ...p, briefing_time: e.target.value }))}
                className="px-4 py-2 bg-gray-700 rounded-lg text-white"
              >
                <option value="06:00">06:00</option>
                <option value="07:00">07:00</option>
                <option value="08:00">08:00</option>
                <option value="09:00">09:00</option>
                <option value="10:00">10:00</option>
              </select>
            </div>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.push_enabled}
                onChange={e => setFormData(p => ({ ...p, push_enabled: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="text-white">Recibir notificaciones push</span>
            </label>
          </div>
        </section>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 
                     rounded-xl text-white font-medium transition-colors
                     disabled:opacity-50"
        >
          {isLoading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    )
  }
  ```

### F7.3: API de settings

- [ ] **Crear archivo** `app/api/settings/route.ts`
  
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { auth } from '@/lib/auth/config'
  import { upsertUserProfile } from '@/lib/profiles/service'
  import { parseInterestsAsync } from '@/lib/onboarding/parse-interests'
  import { parseAlertsAsync } from '@/lib/onboarding/parse-alerts'
  
  export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const tenantId = session.user.tenantId
    const userEmail = session.user.email
    
    const body = await request.json()
    
    try {
      await upsertUserProfile(tenantId, userEmail, {
        display_name: body.display_name,
        role_title: body.role_title,
        role_description: body.role_description,
        interests_raw: body.interests_raw,
        alerts_raw: body.alerts_raw,
        briefing_enabled: body.briefing_enabled,
        briefing_time: body.briefing_time,
        push_enabled: body.push_enabled,
      })
      
      // Re-parsear intereses y alertas en background
      if (body.interests_raw) {
        parseInterestsAsync(tenantId, userEmail, body.interests_raw, body.role_title || '')
      }
      if (body.alerts_raw) {
        parseAlertsAsync(tenantId, userEmail, body.alerts_raw, body.role_title || '')
      }
      
      return NextResponse.json({ success: true })
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }
  ```

### F7.4: Link en menú de usuario

- [ ] **Modificar** `components/UserMenu.tsx` (o equivalente)
  
  Agregar link a settings:
  ```tsx
  <a href="/settings" className="...">
    Mi perfil y alertas
  </a>
  ```

### F7.5: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add app/settings/ app/api/settings/ components/settings/ components/UserMenu.tsx
  git commit -m "feat: Settings page for profile and preferences

  - Settings page with editable profile
  - Settings form with interests, alerts, briefing prefs
  - Settings API with re-parsing of interests/alerts
  - Briefing history display
  - Link in user menu"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F7: Tests de validación

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Test manual**
  1. Ir a /settings en preview
  2. Editar nombre y guardar
  3. Verificar que se guardó en DB
  - Resultado: [ ] Funciona / [ ] Error

| Check | Estado |
|-------|--------|
| Página settings renderiza | [ ] |
| Form editable | [ ] |
| API guarda cambios | [ ] |
| Re-parseo funciona | [ ] |
| Link en menú | [ ] |
| Quick test pasa | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL arriba y avanzar a FASE 8**

---

## FASE 8: ALERTAS PROACTIVAS [~4 horas]

> **Objetivo:** Evaluar condiciones de alerta periódicamente y notificar si se cumplen  
> **Riesgo:** MEDIO - Nuevo cron, consume LLM para evaluación  
> **Dependencias:** Fase 3 (profiles con alertas), Fase 4 (push), Fase 6 (briefing patterns)

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿Frecuencia del chequeo de alertas?**
   - [ ] Cada 2 horas (de 8 a 20)
   - [ ] Cada 4 horas
   - [ ] Solo con briefing matutino

2. **¿Deduplicación de alertas?**
   - [ ] No enviar la misma alerta más de 1 vez por día
   - [ ] No enviar la misma alerta más de 1 vez por semana
   - [ ] Siempre enviar si la condición se cumple

3. **¿Cómo marcar alertas como "vistas"?**
   - [ ] Cuando abre la notificación
   - [ ] Botón "Entendido" en el chat
   - [ ] No trackear

4. **¿Prioridad de alertas afecta push?**
   - [ ] High = con sonido/vibración, Normal = silencioso
   - [ ] Todas igual

**Confirmación:** [ ] Usuario revisó y aprobó → Proceder con desarrollo

---

### F8.1: Alert checker

- [ ] **Crear archivo** `lib/briefing/alert-checker.ts`
  
  ```typescript
  import { getProfilesWithAlerts } from '@/lib/profiles/service'
  import { generateText } from 'ai'
  import { google } from '@ai-sdk/google'
  import { getToolsForAgent } from '@/lib/tools/executor'
  import { sendPushToUser } from '@/lib/push/sender'
  import { getClient } from '@/lib/supabase/client'
  
  interface TriggeredAlert {
    condition: string
    title: string
    body: string
    priority: 'low' | 'normal' | 'high'
  }
  
  export async function checkAlerts(): Promise<{ checked: number; triggered: number }> {
    const profiles = await getProfilesWithAlerts()
    
    console.log(`[AlertChecker] Checking ${profiles.length} profiles`)
    
    let checked = 0, triggered = 0
    const db = getClient()
    
    for (const profile of profiles) {
      if (!profile.alerts_parsed?.length) continue
      
      checked++
      
      try {
        const tools = await getToolsForAgent(profile.tenant_id, 'tuqui', {
          id: 'tuqui',
          skills_enabled: true,
          rag_enabled: false,
          tools: [],
        })
        
        const { text } = await generateText({
          model: google('gemini-2.0-flash'),
          system: `Sos un evaluador de alertas empresariales.

ALERTAS CONFIGURADAS POR EL USUARIO:
${JSON.stringify(profile.alerts_parsed, null, 2)}

Tu tarea: Para cada alerta, usá las herramientas para consultar los datos necesarios
y determiná si la condición se cumple AHORA.

RESPUESTA (JSON estricto):
{
  "triggered": [
    { 
      "condition": "nombre_condicion", 
      "title": "⚠️ Título corto", 
      "body": "Descripción de qué pasó", 
      "priority": "high|normal|low" 
    }
  ]
}

Si ninguna condición se cumple: { "triggered": [] }`,
          messages: [{ role: 'user', content: 'Evaluá mis alertas ahora.' }],
          tools,
          maxSteps: 5,
        })
        
        const result = JSON.parse(text)
        
        for (const alert of result.triggered || []) {
          // Verificar deduplicación (no enviar la misma alerta hoy)
          const alreadySent = await wasAlertSentToday(
            profile.tenant_id, 
            profile.user_email, 
            alert.condition
          )
          
          if (alreadySent) {
            console.log(`[AlertChecker] Alert ${alert.condition} already sent today`)
            continue
          }
          
          // Enviar push
          await sendPushToUser(
            {
              title: alert.title,
              body: alert.body,
              url: '/chat/tuqui?context=alert',
              priority: alert.priority,
            },
            profile.tenant_id,
            profile.user_email
          )
          
          // Registrar que se envió
          await db.from('briefing_history').insert({
            tenant_id: profile.tenant_id,
            user_email: profile.user_email,
            push_title: alert.title,
            push_body: alert.body,
            full_briefing: `Alerta: ${alert.condition}`,
            alerts: [alert],
            metrics_consulted: [],
            sent_at: new Date().toISOString(),
          })
          
          triggered++
        }
      } catch (error) {
        console.error(`[AlertChecker] Error for ${profile.user_email}:`, error)
      }
    }
    
    console.log(`[AlertChecker] Complete: checked=${checked}, triggered=${triggered}`)
    return { checked, triggered }
  }
  
  async function wasAlertSentToday(
    tenantId: string, 
    userEmail: string, 
    condition: string
  ): Promise<boolean> {
    const db = getClient()
    const today = new Date().toISOString().split('T')[0]
    
    const { data } = await db
      .from('briefing_history')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_email', userEmail)
      .gte('sent_at', today)
      .contains('alerts', [{ condition }])
      .limit(1)
    
    return (data?.length || 0) > 0
  }
  ```

### F8.2: API del cron de alertas

- [ ] **Crear archivo** `app/api/internal/alerts/route.ts`
  
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { checkAlerts } from '@/lib/briefing/alert-checker'
  
  export const maxDuration = 60
  
  export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[Alerts API] Starting alert check')
    
    try {
      const result = await checkAlerts()
      return NextResponse.json(result)
    } catch (error: any) {
      console.error('[Alerts API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  ```

### F8.3: Agregar cron de alertas a vercel.json

- [ ] **Modificar** `vercel.json`
  
  ```json
  {
    "crons": [
      {
        "path": "/api/prometeo/run",
        "schedule": "0 8 * * *"
      },
      {
        "path": "/api/internal/briefings",
        "schedule": "*/5 9-14 * * 1-5"
      },
      {
        "path": "/api/internal/alerts",
        "schedule": "0 11,13,15,17,19,21,23 * * 1-5"
      }
    ]
  }
  ```
  
  > Nota: Cada 2 horas de 8 a 20 Argentina (11-23 UTC), lunes a viernes

### F8.4: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/briefing/alert-checker.ts app/api/internal/alerts/ vercel.json
  git commit -m "feat: Proactive alert checking

  - Alert checker that evaluates conditions with LLM
  - Deduplication (same alert only once per day)
  - API endpoint for cron
  - Cron schedule: every 2 hours, business hours"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/mejoras-v2
  ```

### ✅ Checkpoint F8: Tests de validación

- [ ] **Quick test**
  ```bash
  npx tsx scripts/e2e-tests/quick-test.ts
  ```
  - Resultado: `_______________`

- [ ] **Agent evals** (verificación final de no regresión)
  ```bash
  npx tsx tests/evals/run-agent-evals.ts 2>&1 | tail -5
  ```
  - Resultado: `_____ / _____ = _____%`
  - Comparar con baseline: `_______________`

- [ ] **Test del endpoint de alertas**
  ```bash
  curl -X GET "https://preview-url/api/internal/alerts" \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  - Resultado: `_______________`

| Check | Estado |
|-------|--------|
| Alert checker creado | [ ] |
| Deduplicación funciona | [ ] |
| API endpoint funciona | [ ] |
| Cron configurado | [ ] |
| Quick test pasa | [ ] |
| Agent evals ≥ baseline | [ ] |

**Si todo está ✅, actualizar ESTADO ACTUAL y proceder a MERGE FINAL**

---

## 🚀 MERGE FINAL

### Pre-requisitos

- [ ] Todas las fases completadas (0-8)
- [ ] Todos los checkpoints ✅
- [ ] Agent evals ≥ baseline
- [ ] Testing manual en preview exitoso
- [ ] No hay errores en logs de Vercel

### Proceso de merge

- [ ] **Actualizar main**
  ```bash
  git checkout main
  git pull origin main
  ```

- [ ] **Merge del branch**
  ```bash
  git merge refactor/mejoras-v2
  ```

- [ ] **Push a producción**
  ```bash
  git push origin main
  ```

- [ ] **Verificar deploy de producción**
  - URL: https://tuqui.app (o la que corresponda)
  - [ ] Login funciona
  - [ ] Chat funciona
  - [ ] Onboarding funciona (si es usuario nuevo)
  - [ ] Settings funciona

### Cleanup

- [ ] **Eliminar branch local**
  ```bash
  git branch -d refactor/mejoras-v2
  ```

- [ ] **Eliminar branch remoto**
  ```bash
  git push origin --delete refactor/mejoras-v2
  ```

---

## 📊 RESUMEN DE COMANDOS ÚTILES

### Tests
```bash
# Quick test
npx tsx scripts/e2e-tests/quick-test.ts

# Agent evals completos
npx tsx tests/evals/run-agent-evals.ts 2>&1 | tee /tmp/evals.log

# Unit tests
npm run test

# Verificar compilación
npx tsc --noEmit
```

### Git
```bash
# Ver branch actual
git branch --show-current

# Ver cambios
git status

# Ver diff
git diff

# Commit
git add . && git commit -m "mensaje"

# Push
git push origin refactor/mejoras-v2
```

### Vercel
```bash
# Deploy manual a preview
npx vercel --confirm

# Ver logs
npx vercel logs [deployment-url]
```

### Supabase
```bash
# Aplicar migration
npx tsx scripts/apply-migration.ts supabase/migrations/NOMBRE.sql

# Query directo (si tenés psql configurado)
psql $DATABASE_URL -c "SELECT * FROM user_profiles LIMIT 1;"
```

---

## 📝 NOTAS Y DECISIONES

### 2026-02-01: Inicio del refactor
- Decisión: RAG como tool primero porque es bajo riesgo y alto impacto
- Decisión: PWA antes de onboarding para poder testear con notificaciones
- Nota: Las migrations son aditivas, se aplican a producción desde el branch

---

## ❓ PREGUNTAS PENDIENTES

1. ¿Los íconos PWA los generamos desde el logo existente o creamos nuevos?
2. ¿Qué timezone default usamos para briefings? (asumiendo America/Argentina/Buenos_Aires)
3. ¿El onboarding es obligatorio o se puede skipear?

---

*Última actualización: 2026-02-01*
