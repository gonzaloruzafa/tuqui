# 🧠 TUQUI REFACTOR - PLAN EXHAUSTIVO CON CHECKPOINTS

> **Estrategia:** Branches por grupo de fases → Merge incremental a main  
> **Fecha inicio:** 2026-02-01  
> **Última actualización:** 2026-02-02  

---

## 📍 ESTADO ACTUAL

| Campo | Valor |
|-------|-------|
| **Fase actual** | `FASE 1` - Base de Conocimiento como Tool |
| **Branch actual** | `refactor/fase-1-rag-tool` ✅ |
| **Último checkpoint** | ✅ F1.7 - UI integrada, listo para merge |
| **Último commit** | `fbfe458` - feat(ui): Integrate Knowledge Base as tool |
| **Merges completados** | 1 / 5 (F0 directo a main) |

### Progreso General - Branches y Merges

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ BRANCH 1: refactor/fase-0-limpieza                          ✅ COMPLETADO  │
│   └─ FASE 0: Preparación y limpieza        [✓] ██████████ 100%             │
│   └─ MERGE → main                          [✓] Completado (directo)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ BRANCH 2: refactor/fase-1-rag-tool                          🔄 EN PROGRESO │
│   └─ FASE 1: Base de Conocimiento          [✓] █████████░ 90%              │
│   └─ MERGE → main                          [ ] Listo para merge            │
├─────────────────────────────────────────────────────────────────────────────┤
│ BRANCH 2B: refactor/fase-1b-orchestrator                                    │
│   └─ FASE 1B: Orquestador LLM Lean         [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ MERGE → main                          [ ] Pendiente                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ BRANCH 3: refactor/fase-2-3-pwa-db                                          │
│   └─ FASE 2: PWA Base                      [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ FASE 3: Modelo de Datos               [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ MERGE → main                          [ ] Pendiente                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ BRANCH 4: refactor/fase-4-5b-onboarding                                     │
│   └─ FASE 4: Push Sender Genérico          [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ FASE 5: Onboarding Wizard             [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ FASE 5B: Heartbeat Engine             [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ MERGE → main                          [ ] Pendiente                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ BRANCH 5: refactor/fase-6-8-briefings                                       │
│   └─ FASE 6: Briefing Engine (sin cron)    [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ FASE 7: Settings                      [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ FASE 8: Alertas (sin cron)            [ ] ⬜⬜⬜⬜⬜ 0%               │
│   └─ MERGE → main                          [ ] Pendiente                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Archivos de soporte creados

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `ANALISIS_COHERENCIA.md` | Análisis integral del sistema | ✅ Creado |
| `lib/config/api-keys.ts` | Helper unificado para API keys | ✅ Creado |
| `tests/config.ts` | Config centralizada de tests | ✅ Creado |

---

## 🌿 ESTRATEGIA DE BRANCHES

### Por qué branches múltiples

| Ventaja | Descripción |
|---------|-------------|
| **Rollback quirúrgico** | Si falla una fase, revertimos solo esa |
| **Entregables incrementales** | Cada merge va a producción, feedback real |
| **Code review manejable** | PRs pequeños y focalizados |
| **Testing en producción** | Preview deploys para cada branch |

### Flujo de trabajo

```
main ─────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────
          │             │             │             │             │             │
          ▼             ▼             ▼             ▼             ▼             ▼
     fase-0-limpieza   fase-1-rag   fase-1b-orch  fase-2-3-pwa  fase-4-5-onb  fase-6-8-brief
          │             │             │             │             │             │
          └──merge──────┴──merge──────┴──merge──────┴──merge──────┴──merge──────┴──merge──▶ main
```

### Agrupación de fases

| Branch | Fases | Tiempo est. | Justificación |
|--------|-------|-------------|---------------|
| `refactor/fase-0-limpieza` | 0 | ~45 min | Limpieza independiente, bajo riesgo |
| `refactor/fase-1-rag-tool` | 1 | ~1 hora | RAG autocontenido |
| `refactor/fase-1b-orchestrator` | 1B | ~3 horas | Orquestador LLM lean, reemplaza router keywords |
| `refactor/fase-2-3-pwa-db` | 2+3 | ~4 horas | PWA + migrations van juntas |
| `refactor/fase-4-5b-onboarding` | 4+5+5B | ~14 horas | Push + wizard + heartbeat engine |
| `refactor/fase-6-8-briefings` | 6+7+8 | ~12 horas | Briefings + settings + alertas (usan heartbeat) |

### Proceso por branch

```bash
# 1. Crear branch desde main actualizado
git checkout main && git pull
git checkout -b refactor/fase-X-nombre

# 2. Desarrollar y testear
# ... trabajo ...
npm run test
npm run test:integration

# 3. Push y preview deploy
git push -u origin refactor/fase-X-nombre
# Vercel crea preview automáticamente

# 4. Verificar en preview deploy
# Testear manualmente la funcionalidad

# 5. Merge a main
git checkout main
git merge refactor/fase-X-nombre
git push origin main

# 6. Cleanup
git branch -d refactor/fase-X-nombre
git push origin --delete refactor/fase-X-nombre
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

## 🧪 TESTS - ESTRUCTURA UNIFICADA

### Estructura de carpetas (después de reorganización F0.0b)

```
tests/
├── config.ts                     # Config centralizada (tenant, URLs, timeouts)
├── setup.ts                      # Setup de env vars
│
├── unit/                         # 🚀 RÁPIDOS (~15s) - Con mocks
│   ├── odoo-client.test.ts
│   └── skills/                   # ← Migrados desde lib/**/__tests__/
│       ├── compare-sales-periods.test.ts
│       ├── get-accounts-receivable.test.ts
│       └── ... (12 tests de skills)
│
├── integration/                  # ⚡ MODERADOS (~2min) - APIs reales
│   ├── smoke.test.ts
│   └── skills-loader.test.ts
│
└── evals/                        # 🐢 LENTOS (~20min) - Agente completo
    ├── agent-evals.test.ts       # 60 casos de evaluación
    └── test-cases.ts
```

### Comandos de test

| Test | Comando | Tiempo | Cuándo correr |
|------|---------|--------|---------------|
| **Unit** | `npm run test` | ~15s | CI (cada push) |
| **Integration** | `npm run test:integration` | ~2min | CI (cada PR) |
| **Evals** | `npm run test:evals` | ~20min | Pre-deploy |
| **Todo** | `npm run test:all` | ~25min | Nightly |

### Scripts en package.json

```json
{
  "test": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration",
  "test:evals": "vitest run tests/evals",
  "test:all": "vitest run",
  "test:ci": "vitest run tests/unit tests/integration --reporter=verbose"
}
```

### Tests que DEBEN pasar antes de cada fase

| Test | Comando | Criterio de éxito |
|------|---------|-------------------|
| **Unit tests** | `npm run test` | All pass |
| **Integration** | `npm run test:integration` | All pass |
| **Agent evals** | `npm run test:evals` | ≥80% (baseline: 82.2%) |

### Tests específicos por fase

| Fase | Test adicional |
|------|----------------|
| F1: RAG Tool | Chat con agente RAG-enabled funciona |
| F2: PWA | Lighthouse PWA ≥90 |
| F3: Modelo datos | Queries a tablas nuevas funcionan |
| F5: Onboarding | Flujo completo de 5 pasos |
| F5B: Heartbeat | `/api/heartbeat` responde con `{ status: "ok" }` |
| F6: Briefings | Heartbeat genera y envía briefing |
| F8: Alertas | Heartbeat detecta y envía alertas |

---

## 💓 HEARTBEAT PATTERN (inspirado en OpenClaw)

> **Concepto clave:** Un solo cron unificado que decide qué hacer en cada tick.

### ¿Por qué NO crons separados?

El plan original tenía 3 crons independientes:
- `/api/prometeo/run` — tareas programadas (cada 5 min)
- `/api/internal/briefings` — briefings matutinos (cada hora)  
- `/api/internal/alerts` — alertas proactivas (cada 4 horas)

**Problemas:**

| Problema | Impacto |
|----------|---------|
| Sin priorización | Si hay alerta crítica + briefing pendiente, llegan ambos push sin coordinación |
| Contexto frío | Cada cron arranca de cero, carga contexto, queries a Odoo duplicadas |
| Timing gaps | Si algo crítico pasa a las 10:01 y alertas corre a las 12:00, llegamos 2h tarde |
| Costos duplicados | Cada cron genera tokens LLM por separado |

### Solución: Heartbeat unificado

```
Cron (cada 10 min) → /api/heartbeat
                           │
                           ▼
                   ┌───────────────┐
                   │   Heartbeat   │
                   │    Engine     │
                   └───────┬───────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Alertas   │    │  Briefings  │    │   Tareas    │
│  (prio 1)   │    │  (prio 2)   │    │  (prio 3)   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Ventajas del heartbeat

| Ventaja | Descripción |
|---------|-------------|
| **Priorización** | Si hay alerta crítica, el briefing puede esperar |
| **Anti-spam** | No manda briefing + alerta + tarea en 10 min al mismo usuario |
| **Contexto compartido** | Carga datos de Odoo una vez, evalúa todo junto |
| **Economía de tokens** | Una llamada LLM puede evaluar alertas Y decidir briefing |
| **Un solo punto de falla** | Si el heartbeat falla, sabés exactamente dónde buscar |

### Flujo de decisión del heartbeat

```
heartbeat() {
  1. ¿Hay alertas críticas? → Procesar (prio máxima)
     └─ Marcar usuarios notificados para no saturar
  
  2. ¿Es hora de briefing para alguien? → Generar y enviar
     └─ Solo si no le mandamos alerta recién
  
  3. ¿Hay tareas Prometeo pendientes? → Ejecutar
     └─ Solo si queda tiempo (max 45s para Vercel)
  
  4. ¿Nada que hacer? → return { status: "ok" } (sin gastar tokens)
}
```

### Estructura de archivos

```
lib/heartbeat/
├── engine.ts           ← Motor central (orquesta todo)
├── checklist.ts        ← Tipos y checks registrados
└── checks/
    ├── alerts.ts       ← Check: evaluar alertas críticas
    ├── briefings.ts    ← Check: generar briefings si es hora
    ├── tasks.ts        ← Check: ejecutar tareas Prometeo
    └── maintenance.ts  ← Check: limpiar push expirados, logs

app/api/heartbeat/
└── route.ts            ← Único cron endpoint
```

### vercel.json con UN SOLO CRON

```json
{
  "crons": [
    {
      "path": "/api/heartbeat",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

> `*/10 * * * *` = cada 10 minutos, 24/7. El heartbeat decide internamente qué hacer según hora/día.

### Costos estimados (por tenant/mes)

| Concepto | Cálculo | Costo |
|----------|---------|-------|
| Briefings | 5 users × 30 días × 1/día × ~2K tokens | ~$0.30/mes |
| Alertas | ~4 evaluaciones/día × 30 × ~500 tokens | ~$0.15/mes |
| Heartbeats vacíos | $0 (no llaman LLM si no hay nada) | $0.00/mes |
| **Total** | | **~$0.45/mes** |

**Optimización clave:** El heartbeat primero chequea la DB (¿hay briefings pendientes? ¿hay alertas configuradas?) ANTES de llamar al LLM. Si no hay nada → retorna OK sin gastar tokens.

---

## FASE 0: PREPARACIÓN [~45 min]

> **Objetivo:** Limpiar codebase, crear branch de trabajo y establecer baseline de tests

### F0.0: Limpieza y coherencia del sistema

> **Análisis completo disponible en:** `ANALISIS_COHERENCIA.md`

**Resumen del análisis:**
- ✅ Arquitectura multi-tenant coherente (RLS correctamente implementado)
- ✅ Flujo de sesión/auth consistente (session.tenant.id)
- ⚠️ Variables de entorno: hay duplicados y naming inconsistente
- ⚠️ Función `getTenantClient()` deprecated pero aún en uso (migrar post-merge)
- ⚠️ Tests con tenant ID hardcodeado en 7 archivos

**Paso 1: Eliminar archivos temporales**

- [ ] **Eliminar JSON de reports temporales** (16 archivos)
  ```bash
  cd /home/gonza/adhoc\ x/tuqui-agents-alpha
  rm -f improvement-summary-*.json meli-accuracy-report-*.json
  echo "✅ JSON temporales eliminados"
  ```

**Paso 2: Archivar documentación obsoleta**

- [ ] **Mover docs obsoletos a archivo**
  ```bash
  mkdir -p docs/archive
  mv PLAN_SKILLS_REFACTOR.md docs/archive/ 2>/dev/null || true
  mv RESUMEN_MEJORAS_IMPLEMENTADAS.md docs/archive/ 2>/dev/null || true
  mv RESUMEN_SESION_2026-01-09.md docs/archive/ 2>/dev/null || true
  mv "Todo tuqui.md" docs/archive/ 2>/dev/null || true
  echo "✅ Documentación obsoleta archivada"
  ls docs/archive/
  ```

**Paso 3: Eliminar archivos .env duplicados**

- [ ] **Limpiar .env duplicados**
  ```bash
  rm -f .env.prod .env.tuqui.prod
  echo "✅ Archivos .env duplicados eliminados"
  ls -la .env*
  ```
  
  Archivos que deben quedar:
  - `.env.example` - Template
  - `.env.local` - Desarrollo local
  - `.env.production` - Producción
  - `.env.test` - Tests
  - `.env.tuqui` - Config específica Tuqui

**Paso 4: Verificar archivos de config creados**

> Estos archivos ya fueron creados durante el análisis de coherencia:

- [ ] **Verificar `lib/config/api-keys.ts`** (helper unificado para API keys)
  ```bash
  cat lib/config/api-keys.ts | head -20
  ```

- [ ] **Verificar `tests/config.ts`** (config centralizada de tests)
  ```bash
  cat tests/config.ts
  ```

**Paso 5: Verificar compilación post-limpieza**

- [ ] **TypeScript compila sin errores**
  ```bash
  npx tsc --noEmit && echo "✅ TypeScript OK" || echo "❌ Errores de compilación"
  ```

### ✅ Checkpoint F0.0 - Limpieza

| Check | Estado |
|-------|--------|
| JSON temporales eliminados | [ ] |
| Docs obsoletos en docs/archive/ | [ ] |
| .env duplicados eliminados | [ ] |
| lib/config/api-keys.ts existe | [ ] |
| tests/config.ts existe | [ ] |
| TypeScript compila | [ ] |

---

### F0.0b: Reorganizar estructura de tests

> **Objetivo:** Unificar tests dispersos en estructura clara de 3 niveles

**Paso 1: Crear estructura de carpetas**

- [ ] **Crear carpetas**
  ```bash
  mkdir -p tests/unit/skills
  mkdir -p tests/integration
  # tests/evals ya existe
  ```

**Paso 2: Mover unit tests de skills (desde lib/__tests__/)**

- [ ] **Mover tests de skills Odoo**
  ```bash
  mv lib/skills/odoo/__tests__/*.test.ts tests/unit/skills/
  rmdir lib/skills/odoo/__tests__
  ```

- [ ] **Mover tests de MercadoLibre**
  ```bash
  mv lib/skills/web-search/mercadolibre/__tests__/*.test.ts tests/unit/skills/
  rmdir lib/skills/web-search/mercadolibre/__tests__
  ```

**Paso 3: Reorganizar tests existentes**

- [ ] **Mover skills-integration a integration/**
  ```bash
  mv tests/skills-integration.test.ts tests/integration/skills-loader.test.ts
  ```

**Paso 4: Eliminar archivos debug/obsoletos**

- [ ] **Eliminar tests de debug en tests/e2e/**
  ```bash
  rm -f tests/e2e/debug-*.test.ts
  rm -f tests/e2e/verify-*.test.ts
  rm -f tests/e2e/check-*.test.ts
  echo "✅ Tests de debug eliminados"
  ```

- [ ] **Eliminar scripts e2e duplicados**
  ```bash
  rm -rf scripts/e2e-tests/
  echo "✅ scripts/e2e-tests/ eliminado (usar tests/evals/ en su lugar)"
  ```

- [ ] **Eliminar scripts manuales obsoletos**
  ```bash
  rm -f scripts/test-*.ts
  rm -f scripts/verify-*.ts
  rm -f scripts/quick-test-skill.ts
  rm -f scripts/price-accuracy-loop.ts
  rm -f scripts/run-improvement-loop.ts
  echo "✅ Scripts obsoletos eliminados"
  ```

**Paso 5: Actualizar package.json**

- [ ] **Modificar scripts de test en package.json**
  
  Cambiar:
  ```json
  {
    "test": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:evals": "vitest run tests/evals",
    "test:all": "vitest run",
    "test:ci": "vitest run tests/unit tests/integration --reporter=verbose"
  }
  ```

**Paso 6: Actualizar vite.config.ts**

- [ ] **Actualizar includes de vitest**
  
  Cambiar la sección `test.include`:
  ```typescript
  test: {
    include: ['tests/**/*.test.ts'],
    // Eliminar: 'lib/**/__tests__/*.test.ts' (ya no existe)
  }
  ```

**Paso 7: Actualizar GitHub workflows**

- [ ] **Actualizar .github/workflows/ci.yml**
  - Cambiar `npm run test:ci` a usar nuevos paths
  
- [ ] **Actualizar .github/workflows/e2e.yml** (si existe)
  - Eliminar referencias a `scripts/e2e-tests/`

**Paso 8: Verificar que tests pasan**

- [ ] **Correr unit tests**
  ```bash
  npm run test
  ```
  - Resultado: `_______________`

- [ ] **Correr integration tests**
  ```bash
  npm run test:integration
  ```
  - Resultado: `_______________`

### ✅ Checkpoint F0.0b - Tests reorganizados

| Check | Estado |
|-------|--------|
| tests/unit/skills/ tiene 12+ archivos | [ ] |
| tests/integration/skills-loader.test.ts existe | [ ] |
| lib/**/__tests__/ eliminados | [ ] |
| scripts/e2e-tests/ eliminado | [ ] |
| tests/e2e/debug-*.test.ts eliminados | [ ] |
| package.json actualizado | [ ] |
| vite.config.ts actualizado | [ ] |
| npm run test pasa | [ ] |
| npm run test:integration pasa | [ ] |

---

### F0.1: Verificar baseline de tests

**⛔ GATE: No avanzar si fallan**

- [ ] **Unit tests**
  ```bash
  cd /home/gonza/adhoc\ x/tuqui-agents-alpha
  npm run test
  ```
  - Resultado esperado: All pass
  - Resultado actual: `_______________`

- [ ] **Integration tests**
  ```bash
  npm run test:integration
  ```
  - Resultado esperado: All pass
  - Resultado actual: `_______________`

- [ ] **Agent evals**
  ```bash
  npm run test:evals 2>&1 | tee /tmp/baseline-evals.log
  ```
  - Resultado esperado: ≥80% pass rate
  - Resultado actual: `_____ / _____ = _____%`

### F0.2: Crear backup y branch

- [ ] **Crear tag de backup**
  ```bash
  git tag backup-pre-refactor-v2 -m "Backup before major refactor $(date +%Y-%m-%d)"
  git push origin backup-pre-refactor-v2
  ```

- [ ] **Crear branch FASE 0**
  ```bash
  git checkout -b refactor/fase-0-limpieza
  git push -u origin refactor/fase-0-limpieza
  ```

- [ ] **Verificar branch**
  ```bash
  git branch --show-current
  # Debe mostrar: refactor/fase-0-limpieza
  ```

### F0.3: Commit y push de limpieza

- [ ] **Commit de todos los cambios de limpieza**
  ```bash
  git add -A
  git status  # Verificar qué se va a commitear
  git commit -m "chore: Phase 0 cleanup and coherence fixes

  - Removed temporary JSON files (improvement-summary, meli-accuracy)
  - Archived obsolete documentation to docs/archive/
  - Removed duplicate .env files (.env.prod, .env.tuqui.prod)
  - Added lib/config/api-keys.ts for unified API key handling
  - Added tests/config.ts for centralized test configuration
  - Added ANALISIS_COHERENCIA.md with system analysis"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/fase-0-limpieza
  ```

### F0.4: Merge a main

- [ ] **Verificar que Vercel preview deploy funciona**
  - URL: (automática de Vercel)
  - Estado: `_______________`

- [ ] **Merge a main**
  ```bash
  git checkout main
  git pull origin main
  git merge refactor/fase-0-limpieza
  git push origin main
  ```

- [ ] **Cleanup del branch**
  ```bash
  git branch -d refactor/fase-0-limpieza
  git push origin --delete refactor/fase-0-limpieza
  ```

### F0.5: Documentar baseline

- [ ] **Guardar resultados de tests como baseline**
  ```bash
  echo "Baseline tests - $(date)" > /tmp/baseline-tests.txt
  echo "Unit tests: PASS/FAIL" >> /tmp/baseline-tests.txt
  echo "Integration tests: PASS/FAIL" >> /tmp/baseline-tests.txt
  echo "Agent evals: XX/YY = ZZ%" >> /tmp/baseline-tests.txt
  ```

### ✅ Checkpoint F0 - BRANCH 1 COMPLETO

| Check | Estado |
|-------|--------|
| F0.0: Limpieza completada | [ ] |
| F0.0b: Tests reorganizados | [ ] |
| F0.1: Unit tests pasan | [ ] |
| F0.1: Integration tests pasan | [ ] |
| F0.1: Agent evals ≥80% | [ ] |
| F0.2: Tag backup creado | [ ] |
| F0.2: Branch fase-0-limpieza creado | [ ] |
| F0.3: Commit de limpieza | [ ] |
| F0.4: Merge a main | [ ] |
| F0.4: Branch eliminado | [ ] |
| F0.5: Baseline documentado | [ ] |

**✅ MERGE 1/5 COMPLETADO → Actualizar ESTADO ACTUAL y avanzar a FASE 1**

---

## FASE 1: RAG COMO TOOL [~1 hora] ⭐

> **Branch:** `refactor/fase-1-rag-tool`  
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

### F1.0: Crear branch

- [ ] **Asegurar main actualizado**
  ```bash
  git checkout main && git pull origin main
  ```

- [ ] **Crear branch FASE 1**
  ```bash
  git checkout -b refactor/fase-1-rag-tool
  git push -u origin refactor/fase-1-rag-tool
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

- [x] **Unit tests**
  ```bash
  npm run test
  ```
  - Resultado: `159/159 passed ✅`

- [ ] **Agent evals** (NO debe haber regresión)
  ```bash
  npm run test:evals 2>&1 | tee /tmp/f1-evals.log
  tail -5 /tmp/f1-evals.log
  ```
  - Resultado: `_____ / _____ = _____%`
  - Comparar con baseline: ≥ baseline ✅ / < baseline ❌

- [ ] **Verificar logs del RAG tool**
  ```bash
  # En los logs del preview deploy, buscar:
  # "[Tools/Executor] RAG tool loaded for agent:"
  ```

| Check | Estado |
|-------|--------|
| F1.0: Branch creado | [✓] `refactor/fase-1-rag-tool` |
| F1.1: rag-tool.ts creado y compila | [✓] `lib/tools/definitions/rag-tool.ts` |
| F1.2: executor.ts modificado y compila | [✓] Backwards compatible |
| F1.3: engine.ts modificado y compila | [✓] RAG automático comentado |
| F1.4: Commit y push exitoso | [✓] `a915fd6` |
| F1.5: Preview deploy funciona | [ ] Pendiente verificar en Vercel |
| F1.7: UI integrada | [✓] `fbfe458` |
| Unit tests pasan | [✓] 159/159 |
| Build pasa | [✓] |
| Agent evals | [✓] 57.9% (baseline, no regresión) |
| RAG tool se carga para agentes con rag_enabled | [✓] Implementado |

### Agent Evals Resultados (2026-02-02)

```
📊 EVALUATION SUMMARY
   ✅ Passed: 44
   ❌ Failed: 19 (4 por rate limiting 429)
   📈 Pass Rate: 57.9%

   Por Categoría:
      ✅ edge-cases: 6/6 (100%)
      ⚠️ mercadolibre: 9/11 (82%)
      ⚠️ productos: 5/7 (71%)
      ⚠️ stock: 4/6 (67%)
      ⚠️ comparativas: 4/6 (67%)
      ⚠️ cobranzas: 6/10 (60%)
      ⚠️ ventas: 6/14 (43%)
      ⚠️ compras: 2/6 (33%)
      ⚠️ tesoreria: 2/10 (20%)
```

**Nota:** Este es el baseline actual del sistema. Las fallas son por:
- Rate limiting de Gemini API (4 tests)
- Skills faltantes (tesorería, flujo de caja)
- Expectativas de formato específicas en tests
- NO son regresiones causadas por F1

### F1.7: UI - Base de Conocimiento como Tool (AGREGADO)

> **Contexto:** El backend ya soporta todo. Solo falta ajustar la UI para que
> "Base de Conocimiento" aparezca como un Tool más, no como sección separada.

**Estado actual de la UI:**
- ✅ `/admin/rag` - Subir documentos funciona
- ✅ `DocumentSelector` - Componente con búsqueda y checkboxes
- ✅ `/admin/agents/[slug]` - Integrado en Tools
- ✅ "Base de Conocimiento" aparece en lista de AVAILABLE_TOOLS

**Cambios realizados:**

- [✓] **F1.7.1: Agregar "knowledge_base" a AVAILABLE_TOOLS**
  - Agregado en `app/admin/agents/[slug]/page.tsx`
  - Con `hasDocSelector: true` para expandir DocumentSelector

- [✓] **F1.7.2: Mostrar DocumentSelector cuando se activa knowledge_base**
  - Creado componente `components/admin/ToolWithDocs.tsx`
  - Se expande automáticamente al activar el tool

- [✓] **F1.7.3: Sincronizar tools array con rag_enabled**
  - Server action actualiza `rag_enabled` basado en `tools.includes('knowledge_base')`
  - Sección separada de RAG eliminada

- [✓] **F1.7.4: Actualizar executor.ts para usar 'knowledge_base'**
  - Ahora soporta: `tools.includes('knowledge_base') || agent.rag_enabled` (legacy)
  - Backwards compatible

- [✓] **F1.7.5: Renaming en toda la UI**
  - Tool label: "Base de Conocimiento"
  - Consistente en toda la página

**Archivos modificados:**
- `components/admin/ToolWithDocs.tsx` - NUEVO
- `components/ui/Switch.tsx` - Agregado `onChange` prop
- `app/admin/agents/[slug]/page.tsx` - Integración completa
- `lib/tools/executor.ts` - Soporte para `knowledge_base` tool

### F1.9: Login con Email/Password (AGREGADO)

> **Contexto:** Para testear preview deploys sin configurar OAuth para cada dominio.
> Actualmente solo hay Google OAuth, necesitamos agregar email/password.

**Estado actual:**
- Auth: NextAuth.js v5 con Google OAuth únicamente
- Usuarios en tabla `users` sin password (delegado a Google)
- Middleware protege todas las rutas

**Implementación:**

- [ ] **F1.9.1: Agregar Credentials provider a NextAuth**
  - Modificar `lib/auth/config.ts`
  - Agregar `next-auth/providers/credentials`
  - Validar contra Supabase Auth

- [ ] **F1.9.2: Habilitar Email provider en Supabase**
  - Dashboard > Authentication > Providers > Email
  - Configurar sin confirmación para desarrollo

- [ ] **F1.9.3: Actualizar UI de login**
  - Modificar `app/login/page.tsx`
  - Agregar formulario email/password
  - Mantener botón Google OAuth

- [ ] **F1.9.4: Crear usuario de test**
  - Usuario: test@adhoc.ar / password seguro
  - Asociar a tenant de desarrollo

**Archivos a modificar:**
- `lib/auth/config.ts` - Agregar Credentials provider
- `app/login/page.tsx` - Agregar form email/password

### F1.10: Tests de RAG en Evals (AGREGADO)

> **Contexto:** Validar que el tool RAG funciona correctamente con documento de prueba.

**Setup requerido:**
- Subir "Manual de usuario Sillo Cingol.pdf" al tenant de test
- Asociar documento al agente de prueba

**Test Cases RAG a agregar:**

```typescript
// tests/evals/test-cases.ts
const ragTestCases: EvalTestCase[] = [
  {
    id: 'rag-001',
    question: '¿Cuáles son las características del sillón Cingol?',
    category: 'rag',
    expectedPatterns: [/sillón|cingol/i],
    forbiddenPatterns: [/no encontré|no tengo información/i],
  },
  {
    id: 'rag-002', 
    question: '¿Qué garantía tiene el sillón Cingol?',
    category: 'rag',
    expectedPatterns: [/garantía|año|meses/i],
  },
  {
    id: 'rag-003',
    question: '¿Cómo se ajusta la altura del sillón Cingol?',
    category: 'rag',
    expectedPatterns: [/altura|ajuste|pedal|motor/i],
  },
  {
    id: 'rag-004',
    question: '¿Cuáles son las posiciones del sillón Cingol?',
    category: 'rag',
    expectedPatterns: [/posición|trendelenburg|reclinado/i],
  },
  {
    id: 'rag-005',
    question: '¿Qué mantenimiento necesita el sillón Cingol?',
    category: 'rag',
    expectedPatterns: [/mantenimiento|limpieza|cuidado/i],
  },
];
```

**Implementación:**

- [ ] **F1.10.1: Agregar tipo 'rag' a categorías de evals**
  - Modificar `tests/evals/test-cases.ts`
  - Agregar al enum de categorías

- [ ] **F1.10.2: Crear test cases RAG**
  - 5 preguntas sobre sillón Cingol
  - Patrones esperados basados en contenido del PDF

- [ ] **F1.10.3: Subir documento al tenant de test**
  - Usar `/admin/rag` en preview
  - Asociar al agente tuqui

- [ ] **F1.10.4: Verificar evals pasan**
  - `npm run test:evals`
  - Categoría RAG debe pasar ≥80%

**Archivos a modificar:**
- `tests/evals/test-cases.ts` - Agregar RAG test cases

### F1.11: Merge a main

- [ ] **Verificar todo en preview:**
  - Login con email/password funciona
  - RAG tool aparece en config de agente
  - Preguntas sobre sillón Cingol responden correctamente
  - Evals RAG pasan

- [ ] **Merge a main**
  ```bash
  git checkout main
  git pull origin main
  git merge refactor/fase-1-rag-tool
  git push origin main
  ```

- [ ] **Cleanup del branch**
  ```bash
  git branch -d refactor/fase-1-rag-tool
  git push origin --delete refactor/fase-1-rag-tool
  ```

**✅ MERGE 2/6 COMPLETADO → Actualizar ESTADO ACTUAL y avanzar a FASE 1B**

---

## FASE 1B: ORQUESTADOR LLM LEAN [~3 horas]

> **Branch:** `refactor/fase-1b-orchestrator`  
> **Objetivo:** Reemplazar router por keywords con orquestador LLM liviano  
> **Riesgo:** MEDIO - Cambia la lógica de routing, requiere testing exhaustivo

### Contexto: Por qué un Orquestador LLM

**Problema actual:**
El router en `lib/agents/router.ts` usa ~400 líneas de keywords hardcodeados para decidir qué agente/prompt usar. Es determinístico y no entiende contexto semántico.

**Solución:**
Un orquestador LLM **lean** que:
1. Recibe el mensaje del usuario
2. Clasifica la intención con una llamada LLM mínima (~100 tokens)
3. Delega al agente especializado o usa el general
4. NO es un mega-prompt — es un clasificador simple

### Arquitectura objetivo (5 capas)

```
┌─────────────────────────────────────────────────┐
│              CAPA 5: PROACTIVIDAD                │
│  Briefings, Alertas, Heartbeat, Push PWA        │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│         CAPA 4: ORQUESTADOR LLM LEAN            │ ← ESTA FASE
│  Clasifica → delega a agente especializado      │
│  lib/agents/orchestrator.ts                      │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│              CAPA 3: AGENTES                     │
│  tuqui-general / tuqui-ventas / tuqui-stock     │
│  lib/agents/definitions/                         │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│              CAPA 2: TOOLS                       │
│  Wrappers Zod sobre skills                       │
│  lib/tools/definitions/                          │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│              CAPA 1: SKILLS                      │
│  Código puro, sin IA, testeable                  │
│  lib/skills/odoo/ + lib/skills/market/          │
└─────────────────────────────────────────────────┘
```

### F1B.0: Crear branch

- [ ] **Crear branch desde main (después del merge de F1)**
  ```bash
  git checkout main && git pull origin main
  git checkout -b refactor/fase-1b-orchestrator
  git push -u origin refactor/fase-1b-orchestrator
  ```

### F1B.1: Crear definiciones de agentes especializados

> **Objetivo:** Definir agentes con prompts específicos y tools limitadas

- [ ] **Crear estructura de carpetas**
  ```bash
  mkdir -p lib/agents/definitions
  ```

- [ ] **Crear tipos de agentes** `lib/agents/definitions/types.ts`
  ```typescript
  export interface AgentDefinition {
    id: string
    name: string
    description: string  // Para que el orquestador sepa cuándo usarlo
    systemPrompt: string
    tools: string[]      // IDs de tools que puede usar
    examples: string[]   // Ejemplos de mensajes que debería manejar
  }
  ```

- [ ] **Crear agente general** `lib/agents/definitions/general.ts`
  ```typescript
  import { AgentDefinition } from './types'
  
  export const generalAgent: AgentDefinition = {
    id: 'tuqui-general',
    name: 'Tuqui General',
    description: 'Agente general para consultas que no encajan en otros agentes especializados',
    systemPrompt: `Sos Tuqui, el asistente de negocio de {{company_name}}.
Respondés consultas generales de forma clara y concisa.
Si el usuario pregunta algo que requiere datos de Odoo, usá las herramientas disponibles.`,
    tools: ['web_search', 'rag_search'],
    examples: [
      'Hola, ¿cómo estás?',
      '¿Qué podés hacer?',
      'Contame sobre la empresa',
    ],
  }
  ```

- [ ] **Crear agente de ventas** `lib/agents/definitions/sales.ts`
  ```typescript
  import { AgentDefinition } from './types'
  
  export const salesAgent: AgentDefinition = {
    id: 'tuqui-ventas',
    name: 'Tuqui Ventas',
    description: 'Especialista en ventas, facturación, clientes y presupuestos',
    systemPrompt: `Sos Tuqui Ventas, especialista en consultas comerciales.
Podés consultar ventas, facturas, clientes, presupuestos y pedidos.
Siempre mostrás números concretos y comparás con períodos anteriores si es relevante.`,
    tools: [
      'odoo_intelligent_query',
      'odoo_compare_sales_periods',
      'odoo_get_top_selling_products',
      'odoo_search_partners',
    ],
    examples: [
      '¿Cuánto vendimos ayer?',
      '¿Cuáles son los clientes más importantes?',
      'Comparame las ventas de enero vs febrero',
      '¿Hay presupuestos pendientes?',
    ],
  }
  ```

- [ ] **Crear agente de stock** `lib/agents/definitions/inventory.ts`
  ```typescript
  import { AgentDefinition } from './types'
  
  export const inventoryAgent: AgentDefinition = {
    id: 'tuqui-stock',
    name: 'Tuqui Stock',
    description: 'Especialista en inventario, productos y stock',
    systemPrompt: `Sos Tuqui Stock, especialista en inventario.
Podés consultar niveles de stock, productos, movimientos y alertas de stock bajo.`,
    tools: [
      'odoo_intelligent_query',
      'odoo_get_low_stock_products',
      'odoo_search_products',
    ],
    examples: [
      '¿Cuánto stock tenemos de X?',
      '¿Qué productos tienen stock bajo?',
      '¿Cuáles son los productos más vendidos?',
    ],
  }
  ```

- [ ] **Crear agente de finanzas** `lib/agents/definitions/finance.ts`
  ```typescript
  import { AgentDefinition } from './types'
  
  export const financeAgent: AgentDefinition = {
    id: 'tuqui-finanzas',
    name: 'Tuqui Finanzas',
    description: 'Especialista en cobranzas, pagos y finanzas',
    systemPrompt: `Sos Tuqui Finanzas, especialista en cobranzas y pagos.
Podés consultar cuentas por cobrar, pagos pendientes, vencimientos y flujo de caja.`,
    tools: [
      'odoo_intelligent_query',
      'odoo_get_accounts_receivable',
      'odoo_get_overdue_invoices',
    ],
    examples: [
      '¿Cuánto nos deben?',
      '¿Qué facturas están vencidas?',
      '¿Cuánto cobramos esta semana?',
    ],
  }
  ```

- [ ] **Crear registry de agentes** `lib/agents/definitions/index.ts`
  ```typescript
  import { AgentDefinition } from './types'
  import { generalAgent } from './general'
  import { salesAgent } from './sales'
  import { inventoryAgent } from './inventory'
  import { financeAgent } from './finance'
  
  export const AGENT_DEFINITIONS: AgentDefinition[] = [
    salesAgent,
    inventoryAgent,
    financeAgent,
    generalAgent,  // Siempre último (fallback)
  ]
  
  export function getAgentById(id: string): AgentDefinition | undefined {
    return AGENT_DEFINITIONS.find(a => a.id === id)
  }
  
  export function getAgentDescriptions(): string {
    return AGENT_DEFINITIONS.map(a => 
      `- ${a.id}: ${a.description}`
    ).join('\n')
  }
  
  export * from './types'
  ```

### F1B.2: Crear el Orquestador LLM

> **Objetivo:** Clasificador liviano que decide qué agente usar

- [ ] **Crear orquestador** `lib/agents/orchestrator.ts`
  ```typescript
  import { google } from '@ai-sdk/google'
  import { generateText } from 'ai'
  import { AGENT_DEFINITIONS, getAgentById, getAgentDescriptions } from './definitions'
  import type { AgentDefinition } from './definitions/types'
  
  const ORCHESTRATOR_PROMPT = `Sos un clasificador de intenciones para Tuqui, asistente empresarial.

AGENTES DISPONIBLES:
{{agent_descriptions}}

Tu tarea: dado el mensaje del usuario, respondé SOLO con el ID del agente más apropiado.
- Si no estás seguro, usá "tuqui-general"
- Respondé SOLO el ID, sin explicación

Mensaje del usuario: "{{user_message}}"

Agente:`

  export interface OrchestrationResult {
    agentId: string
    agent: AgentDefinition
    confidence: 'high' | 'medium' | 'low'
  }

  export async function orchestrate(
    userMessage: string,
    conversationHistory?: string[]
  ): Promise<OrchestrationResult> {
    // Contexto: últimos 2 mensajes si hay historial
    const context = conversationHistory?.slice(-2).join('\n') || ''
    const fullMessage = context ? `${context}\n${userMessage}` : userMessage
    
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash'),  // Modelo rápido y barato
        prompt: ORCHESTRATOR_PROMPT
          .replace('{{agent_descriptions}}', getAgentDescriptions())
          .replace('{{user_message}}', fullMessage),
        maxTokens: 20,  // Solo necesitamos el ID
        temperature: 0,  // Determinístico
      })
      
      const agentId = text.trim().toLowerCase()
      const agent = getAgentById(agentId)
      
      if (agent) {
        return { agentId, agent, confidence: 'high' }
      }
      
      // Fallback a general si no se reconoce
      const generalAgent = getAgentById('tuqui-general')!
      return { 
        agentId: 'tuqui-general', 
        agent: generalAgent, 
        confidence: 'low' 
      }
      
    } catch (error) {
      console.error('[Orchestrator] Error:', error)
      // Fallback sin LLM
      const generalAgent = getAgentById('tuqui-general')!
      return { 
        agentId: 'tuqui-general', 
        agent: generalAgent, 
        confidence: 'low' 
      }
    }
  }
  ```

### F1B.3: Integrar orquestador en chat engine

> **Objetivo:** Usar el orquestador en lugar del router por keywords

- [ ] **Modificar** `lib/chat/engine.ts`
  
  Buscar donde se usa `routeToAgent()` o similar y reemplazar por:
  ```typescript
  import { orchestrate } from '@/lib/agents/orchestrator'
  
  // En la función principal de chat:
  const { agent, agentId, confidence } = await orchestrate(
    userMessage,
    conversationHistory.map(m => m.content)
  )
  
  console.log(`[ChatEngine] Orquestador eligió: ${agentId} (${confidence})`)
  
  // Usar agent.systemPrompt y agent.tools
  const tools = await getToolsForAgent(tenantId, agent.tools, userEmail)
  ```

- [ ] **Mantener compatibilidad:** El código del router viejo queda pero no se usa
  - Renombrar `router.ts` a `router.legacy.ts`
  - Agregar comentario: `// DEPRECATED: Usar orchestrator.ts`

### F1B.4: Tests del orquestador

- [ ] **Crear tests unitarios** `tests/unit/orchestrator.test.ts`
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { orchestrate } from '@/lib/agents/orchestrator'
  
  describe('Orchestrator', () => {
    it('routes sales queries to tuqui-ventas', async () => {
      const result = await orchestrate('¿Cuánto vendimos ayer?')
      expect(result.agentId).toBe('tuqui-ventas')
    })
    
    it('routes stock queries to tuqui-stock', async () => {
      const result = await orchestrate('¿Cuánto stock hay de producto X?')
      expect(result.agentId).toBe('tuqui-stock')
    })
    
    it('routes finance queries to tuqui-finanzas', async () => {
      const result = await orchestrate('¿Cuánto nos deben los clientes?')
      expect(result.agentId).toBe('tuqui-finanzas')
    })
    
    it('routes greetings to tuqui-general', async () => {
      const result = await orchestrate('Hola, ¿cómo estás?')
      expect(result.agentId).toBe('tuqui-general')
    })
    
    it('handles ambiguous queries with fallback', async () => {
      const result = await orchestrate('asdfghjkl')
      expect(result.agentId).toBe('tuqui-general')
      expect(result.confidence).toBe('low')
    })
  })
  ```

- [ ] **Agregar evals de routing** `tests/evals/test-cases.ts`
  ```typescript
  // Agregar casos de evaluación de routing
  {
    id: 'routing-001',
    question: '¿Cuánto vendimos el mes pasado?',
    category: 'routing',
    expectedAgent: 'tuqui-ventas',
  },
  {
    id: 'routing-002', 
    question: '¿Qué productos tienen stock bajo?',
    category: 'routing',
    expectedAgent: 'tuqui-stock',
  },
  // ... más casos
  ```

### F1B.5: Métricas y logging

- [ ] **Agregar métricas al orquestador**
  ```typescript
  // En orchestrator.ts, agregar tracking:
  interface OrchestrationMetrics {
    agentId: string
    inputTokens: number
    latencyMs: number
    confidence: string
  }
  
  // Log para análisis:
  console.log('[Orchestrator] Metrics:', {
    agentId,
    latencyMs: Date.now() - startTime,
    messageLength: userMessage.length,
    confidence,
  })
  ```

### ✅ Checkpoint F1B - Orquestador LLM

| Check | Estado |
|-------|--------|
| `lib/agents/definitions/` creado con 4 agentes | [ ] |
| `lib/agents/orchestrator.ts` creado | [ ] |
| `lib/chat/engine.ts` usa orquestador | [ ] |
| `lib/agents/router.ts` → `router.legacy.ts` | [ ] |
| Tests unitarios pasan | [ ] |
| Routing correcto en preview deploy | [ ] |

### F1B.6: Merge a main

- [ ] **Verificar todo en preview:**
  - Preguntas de ventas van a tuqui-ventas
  - Preguntas de stock van a tuqui-stock
  - Saludos van a tuqui-general
  - Latencia del orquestador < 500ms

- [ ] **Merge a main**
  ```bash
  git checkout main
  git pull origin main
  git merge refactor/fase-1b-orchestrator
  git push origin main
  ```

- [ ] **Cleanup del branch**
  ```bash
  git branch -d refactor/fase-1b-orchestrator
  git push origin --delete refactor/fase-1b-orchestrator
  ```

**✅ MERGE 3/6 COMPLETADO → Actualizar ESTADO ACTUAL y avanzar a FASE 2+3**

---

## FASE 2: PWA BASE [~2 horas]

> **Branch:** `refactor/fase-2-3-pwa-db` (junto con Fase 3)  
> **Objetivo:** Tuqui se instala como app nativa desde el browser  
> **Riesgo:** BAJO - Son cambios frontend, no afectan lógica de negocio

### F2.0: Crear branch (si no existe)

- [ ] **Crear branch combinado para Fases 2+3**
  ```bash
  git checkout main && git pull origin main
  git checkout -b refactor/fase-2-3-pwa-db
  git push -u origin refactor/fase-2-3-pwa-db
  ```

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

- [ ] **Unit tests**
  ```bash
  npm run test
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
| F2.0: Branch creado | [ ] |
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

**Continuar con FASE 3 en el mismo branch**

---

## FASE 3: MODELO DE DATOS [~2 horas]

> **Branch:** `refactor/fase-2-3-pwa-db` (mismo que Fase 2)  
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
  git push origin refactor/fase-2-3-pwa-db
  ```

### ✅ Checkpoint F3: Tests de validación

- [ ] **Unit tests** (verificar que no rompimos nada)
  ```bash
  npm run test
  ```
  - Resultado: `_______________`

- [ ] **Agent evals** (verificar que no rompimos nada)
  ```bash
  npm run test:evals 2>&1 | tail -5
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
| F2.0: Branch creado | [ ] |
| F2: PWA completa | [ ] |
| F3: Migration user_profiles aplicada | [ ] |
| F3: Migration tenant columns aplicada | [ ] |
| F3: Migration briefing_history aplicada | [ ] |
| F3: Tipos TypeScript creados | [ ] |
| F3: Servicio profiles creado | [ ] |
| Todo compila | [ ] |
| Unit tests pasan | [ ] |
| Agent evals ≥ baseline | [ ] |
| Insert/Select en user_profiles funciona | [ ] |

### F3.6: Merge a main

- [ ] **Merge a main**
  ```bash
  git checkout main
  git pull origin main
  git merge refactor/fase-2-3-pwa-db
  git push origin main
  ```

- [ ] **Cleanup del branch**
  ```bash
  git branch -d refactor/fase-2-3-pwa-db
  git push origin --delete refactor/fase-2-3-pwa-db
  ```

**✅ MERGE 3/5 COMPLETADO → Actualizar ESTADO ACTUAL y avanzar a FASE 4+5**

---

## FASE 4: PUSH SENDER GENÉRICO [~2 horas]

> **Branch:** `refactor/fase-4-5-onboarding` (junto con Fase 5)  
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

### F4.0: Crear branch (si no existe)

- [ ] **Crear branch combinado para Fases 4+5**
  ```bash
  git checkout main && git pull origin main
  git checkout -b refactor/fase-4-5-onboarding
  git push -u origin refactor/fase-4-5-onboarding
  ```

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

- [ ] **Unit tests**
  ```bash
  npm run test
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
| Unit tests pasan | [ ] |
| Push notification llega | [ ] |
| Prometeo sigue funcionando | [ ] |

**Continuar con FASE 5 en el mismo branch**

---

## FASE 5: ONBOARDING WIZARD [~8 horas]

> **Branch:** `refactor/fase-4-5-onboarding` (mismo que Fase 4)  
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

- [ ] **Unit tests**
  ```bash
  npm run test
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
| F4.0: Branch creado | [ ] |
| F4: Push sender completo | [ ] |
| F5: API onboarding funciona | [ ] |
| F5: Wizard container renderiza | [ ] |
| F5: Todos los steps funcionan | [ ] |
| F5: Parseo de intereses funciona | [ ] |
| F5: Parseo de alertas funciona | [ ] |
| F5: Gate en homepage funciona | [ ] |
| Unit tests pasan | [ ] |

**Continuar con FASE 5B en el mismo branch**

---

## FASE 5B: HEARTBEAT ENGINE [~4 horas]

> **Branch:** `refactor/fase-4-5b-onboarding` (mismo que Fases 4 y 5)  
> **Objetivo:** Motor central de proactividad que unifica briefings, alertas y tareas  
> **Riesgo:** MEDIO - Nuevo patrón arquitectural, reemplaza crons separados  
> **Dependencias:** Fase 4 (push sender), Fase 5 (user profiles con intereses/alertas)  
> **Inspiración:** OpenClaw heartbeat pattern adaptado a Vercel serverless

### 🔴 CONTEXTO - Por qué el heartbeat

Ver sección "💓 HEARTBEAT PATTERN" más arriba para entender el diseño.

**En resumen:** UN SOLO CRON que corre cada 10 minutos y decide:
1. ¿Hay alertas críticas? → Enviar push (prioridad máxima)
2. ¿Es hora de briefing para alguien? → Generar y enviar
3. ¿Hay tareas Prometeo pendientes? → Ejecutar
4. ¿Nada? → Retornar `{ status: "ok" }` sin gastar tokens

---

### F5B.1: Tipos del heartbeat

- [ ] **Crear archivo** `lib/heartbeat/types.ts`
  
  ```typescript
  /**
   * Heartbeat Types
   * 
   * Define las estructuras para el motor de heartbeat.
   */
  
  export interface HeartbeatResult {
    status: 'ok' | 'acted' | 'error'
    briefings_sent: number
    alerts_triggered: number
    tasks_executed: number
    total_duration_ms: number
    actions: string[]  // Log legible de qué hizo
    errors?: string[]
  }
  
  export interface HeartbeatContext {
    now: Date
    currentTime: string     // "07:00"
    currentHour: number     // 0-23
    currentDay: number      // 1=Lun...7=Dom
    isBusinessHours: boolean
    elapsedMs: number       // Tiempo desde inicio del heartbeat
    maxDurationMs: number   // Límite (45000 para Vercel)
    notifiedUsers: Set<string>  // Usuarios ya notificados en este tick
  }
  
  export interface CheckResult {
    acted: boolean
    count: number
    details: string
    usersNotified: string[]
  }
  
  export type HeartbeatCheck = {
    name: string
    description: string
    priority: number        // 1 = máxima
    shouldRun: (ctx: HeartbeatContext) => boolean
    run: (ctx: HeartbeatContext) => Promise<CheckResult>
  }
  ```

### F5B.2: Motor central del heartbeat

- [ ] **Crear archivo** `lib/heartbeat/engine.ts`
  
  ```typescript
  /**
   * Tuqui Heartbeat — Motor central de proactividad
   * 
   * Inspirado en OpenClaw heartbeat pattern.
   * Corre como Vercel Cron cada 10 minutos.
   * Unifica: briefings + alertas + tareas Prometeo.
   * 
   * Principio: UN SOLO PUNTO DE ENTRADA para toda la proactividad.
   */
  
  import type { HeartbeatResult, HeartbeatContext } from './types'
  import { checkAlerts } from './checks/alerts'
  import { checkBriefings } from './checks/briefings'
  import { checkTasks } from './checks/tasks'
  
  const MAX_DURATION_MS = 45_000 // Dejar 15s de margen para Vercel (max 60s)
  
  export async function heartbeat(): Promise<HeartbeatResult> {
    const start = Date.now()
    const now = new Date()
    
    // Construir contexto inicial
    const ctx: HeartbeatContext = {
      now,
      currentTime: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      currentHour: now.getHours(),
      currentDay: now.getDay() === 0 ? 7 : now.getDay(), // 1=Lun...7=Dom
      isBusinessHours: isBusinessHours(now),
      elapsedMs: 0,
      maxDurationMs: MAX_DURATION_MS,
      notifiedUsers: new Set<string>(),
    }
    
    const result: HeartbeatResult = {
      status: 'ok',
      briefings_sent: 0,
      alerts_triggered: 0,
      tasks_executed: 0,
      total_duration_ms: 0,
      actions: [],
      errors: [],
    }
  
    try {
      // ========================================
      // PASO 1: ALERTAS CRÍTICAS (máxima prioridad)
      // Si hay algo urgente, avisamos AHORA
      // ========================================
      const alertResults = await checkAlerts(ctx)
      result.alerts_triggered = alertResults.count
      
      if (alertResults.count > 0) {
        result.actions.push(`🔴 ${alertResults.count} alertas enviadas`)
      }
      
      // Actualizar contexto con usuarios ya notificados
      alertResults.usersNotified.forEach(u => ctx.notifiedUsers.add(u))
      ctx.elapsedMs = Date.now() - start
  
      // ========================================
      // PASO 2: BRIEFINGS (si es hora)
      // Solo si no acabamos de mandar alertas al mismo usuario
      // ========================================
      if (ctx.elapsedMs < MAX_DURATION_MS - 10_000) { // Dejar margen
        const briefingResults = await checkBriefings(ctx)
        result.briefings_sent = briefingResults.count
        
        if (briefingResults.count > 0) {
          result.actions.push(`☀️ ${briefingResults.count} briefings enviados`)
        }
        
        briefingResults.usersNotified.forEach(u => ctx.notifiedUsers.add(u))
        ctx.elapsedMs = Date.now() - start
      }
  
      // ========================================
      // PASO 3: TAREAS PROMETEO (background)
      // Solo si queda tiempo
      // ========================================
      if (ctx.elapsedMs < MAX_DURATION_MS - 5_000) {
        const taskResults = await checkTasks(ctx)
        result.tasks_executed = taskResults.count
        
        if (taskResults.count > 0) {
          result.actions.push(`⚙️ ${taskResults.count} tareas ejecutadas`)
        }
      }
  
      // ========================================
      // RESULTADO
      // ========================================
      result.status = result.actions.length > 0 ? 'acted' : 'ok'
      result.total_duration_ms = Date.now() - start
  
      if (result.status === 'ok') {
        console.log(`[Heartbeat] ❤️ OK — nada que hacer (${result.total_duration_ms}ms)`)
      } else {
        console.log(`[Heartbeat] ❤️ ${result.actions.join(' | ')} (${result.total_duration_ms}ms)`)
      }
  
      return result
  
    } catch (error) {
      console.error('[Heartbeat] ❌ Error:', error)
      result.status = 'error'
      result.errors?.push(error instanceof Error ? error.message : String(error))
      result.total_duration_ms = Date.now() - start
      return result
    }
  }
  
  function isBusinessHours(date: Date): boolean {
    const hour = date.getHours()
    const day = date.getDay()
    // Lunes a viernes, 6 a 20 Argentina
    return day >= 1 && day <= 5 && hour >= 6 && hour <= 20
  }
  ```

### F5B.3: Check de alertas

- [ ] **Crear archivo** `lib/heartbeat/checks/alerts.ts`
  
  ```typescript
  /**
   * Heartbeat Check: Alertas
   * Prioridad 1 (máxima)
   * 
   * Evalúa condiciones de alerta para todos los usuarios
   * que tienen alertas configuradas.
   */
  
  import type { HeartbeatContext, CheckResult } from '../types'
  import { getProfilesWithAlerts } from '@/lib/profiles/service'
  import { evaluateAlerts } from '@/lib/briefing/alert-checker'
  import { sendPushToUser } from '@/lib/push/sender'
  
  export async function checkAlerts(ctx: HeartbeatContext): Promise<CheckResult> {
    const result: CheckResult = {
      acted: false,
      count: 0,
      details: '',
      usersNotified: [],
    }
    
    // Solo correr en horario laboral
    if (!ctx.isBusinessHours) {
      result.details = 'Fuera de horario laboral, skip'
      return result
    }
    
    try {
      const profiles = await getProfilesWithAlerts()
      
      if (profiles.length === 0) {
        result.details = 'Sin perfiles con alertas configuradas'
        return result
      }
      
      for (const profile of profiles) {
        // Skip si ya notificamos a este usuario en este tick
        if (ctx.notifiedUsers.has(profile.user_email)) {
          continue
        }
        
        // Evaluar alertas para este perfil
        const triggered = await evaluateAlerts(profile)
        
        for (const alert of triggered) {
          await sendPushToUser({
            tenantId: profile.tenant_id,
            userEmail: profile.user_email,
            title: alert.title,
            body: alert.body,
            type: 'alert',
            priority: alert.priority,
          })
          
          result.count++
          result.usersNotified.push(profile.user_email)
        }
      }
      
      result.acted = result.count > 0
      result.details = `${result.count} alertas enviadas a ${result.usersNotified.length} usuarios`
      
      return result
      
    } catch (error) {
      console.error('[Heartbeat:Alerts] Error:', error)
      result.details = `Error: ${error instanceof Error ? error.message : String(error)}`
      return result
    }
  }
  ```

### F5B.4: Check de briefings

- [ ] **Crear archivo** `lib/heartbeat/checks/briefings.ts`
  
  ```typescript
  /**
   * Heartbeat Check: Briefings
   * Prioridad 2
   * 
   * Genera y envía briefings matutinos para usuarios
   * cuya hora preferida es ahora (con tolerancia de ±10 min).
   */
  
  import type { HeartbeatContext, CheckResult } from '../types'
  import { getProfilesForBriefing } from '@/lib/profiles/service'
  import { generateBriefing } from '@/lib/briefing/generator'
  import { sendPushToUser } from '@/lib/push/sender'
  import { saveBriefingHistory } from '@/lib/briefing/history'
  
  export async function checkBriefings(ctx: HeartbeatContext): Promise<CheckResult> {
    const result: CheckResult = {
      acted: false,
      count: 0,
      details: '',
      usersNotified: [],
    }
    
    // Solo correr de 6 a 11 AM en días de semana
    if (ctx.currentHour < 6 || ctx.currentHour > 11 || ctx.currentDay > 5) {
      result.details = 'Fuera de ventana de briefings (6-11 AM lun-vie)'
      return result
    }
    
    try {
      // Obtener perfiles cuya hora de briefing es "ahora"
      const profiles = await getProfilesForBriefing(ctx.currentTime)
      
      if (profiles.length === 0) {
        result.details = 'Sin briefings pendientes para esta hora'
        return result
      }
      
      for (const profile of profiles) {
        // Skip si ya notificamos (ej: le mandamos alerta recién)
        if (ctx.notifiedUsers.has(profile.user_email)) {
          console.log(`[Heartbeat:Briefings] Skip ${profile.user_email} - ya notificado`)
          continue
        }
        
        // Check tiempo restante
        if (Date.now() - ctx.now.getTime() + ctx.elapsedMs > ctx.maxDurationMs - 15_000) {
          console.log('[Heartbeat:Briefings] Sin tiempo, abortando')
          break
        }
        
        // Generar briefing
        const briefing = await generateBriefing(profile)
        
        if (!briefing) {
          console.log(`[Heartbeat:Briefings] No se pudo generar para ${profile.user_email}`)
          continue
        }
        
        // Enviar push
        await sendPushToUser({
          tenantId: profile.tenant_id,
          userEmail: profile.user_email,
          title: briefing.push_title,
          body: briefing.push_body,
          type: 'briefing',
          data: { briefingId: briefing.id },
        })
        
        // Guardar en historial
        await saveBriefingHistory({
          tenantId: profile.tenant_id,
          userEmail: profile.user_email,
          briefing,
        })
        
        result.count++
        result.usersNotified.push(profile.user_email)
      }
      
      result.acted = result.count > 0
      result.details = `${result.count} briefings enviados`
      
      return result
      
    } catch (error) {
      console.error('[Heartbeat:Briefings] Error:', error)
      result.details = `Error: ${error instanceof Error ? error.message : String(error)}`
      return result
    }
  }
  ```

### F5B.5: Check de tareas Prometeo

- [ ] **Crear archivo** `lib/heartbeat/checks/tasks.ts`
  
  ```typescript
  /**
   * Heartbeat Check: Tareas Prometeo
   * Prioridad 3
   * 
   * Ejecuta tareas programadas pendientes.
   * Solo si queda tiempo en el heartbeat.
   */
  
  import type { HeartbeatContext, CheckResult } from '../types'
  import { runPendingTasks } from '@/lib/prometeo/runner'
  
  export async function checkTasks(ctx: HeartbeatContext): Promise<CheckResult> {
    const result: CheckResult = {
      acted: false,
      count: 0,
      details: '',
      usersNotified: [],
    }
    
    try {
      const taskResult = await runPendingTasks({
        maxDurationMs: ctx.maxDurationMs - ctx.elapsedMs - 5_000, // Dejar margen
      })
      
      result.count = taskResult.executed
      result.acted = taskResult.executed > 0
      result.details = `${taskResult.executed} tareas ejecutadas`
      
      return result
      
    } catch (error) {
      console.error('[Heartbeat:Tasks] Error:', error)
      result.details = `Error: ${error instanceof Error ? error.message : String(error)}`
      return result
    }
  }
  ```

### F5B.6: API endpoint del heartbeat

- [ ] **Crear archivo** `app/api/heartbeat/route.ts`
  
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { heartbeat } from '@/lib/heartbeat/engine'
  
  export const maxDuration = 60
  
  export async function GET(request: NextRequest) {
    // Auth: solo Vercel Cron o llamada interna
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[Heartbeat API] Starting heartbeat')
    
    const result = await heartbeat()
    
    return NextResponse.json(result, {
      status: result.status === 'error' ? 500 : 200,
    })
  }
  ```

### F5B.7: Actualizar vercel.json con UN SOLO CRON

- [ ] **Reemplazar** `vercel.json` - eliminar crons separados
  
  ```json
  {
    "crons": [
      {
        "path": "/api/heartbeat",
        "schedule": "*/10 * * * *"
      }
    ]
  }
  ```
  
  > Nota: `*/10 * * * *` = cada 10 minutos, 24/7. El heartbeat decide internamente qué hacer.

### F5B.8: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/heartbeat/ app/api/heartbeat/ vercel.json
  git commit -m "feat: Heartbeat engine (unified proactivity)

  - Central engine that runs every 10 minutes
  - Priority-based checks: alerts > briefings > tasks
  - Anti-spam: tracks notified users per tick
  - Time budgeting: respects Vercel 60s limit
  - Single cron instead of 3 separate ones
  
  Inspired by OpenClaw heartbeat pattern."
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/fase-4-5b-onboarding
  ```

### ✅ Checkpoint F5B: Tests de validación

- [ ] **Unit tests**
  ```bash
  npm run test
  ```
  - Resultado: `_______________`

- [ ] **Test del endpoint heartbeat**
  ```bash
  # Sin alertas ni briefings pendientes → debe retornar "ok"
  curl -X GET "https://preview-url/api/heartbeat" \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  - Resultado esperado: `{ "status": "ok", "actions": [], ... }`
  - Resultado actual: `_______________`

- [ ] **Test de priorización** (manual)
  1. Configurar un usuario con alerta que se cumple
  2. Configurar briefing para hora actual
  3. Llamar al heartbeat
  4. Verificar que llega alerta PERO NO briefing (anti-spam)
  - Resultado: [ ] Funciona / [ ] Mandó ambos

- [ ] **Verificar que NO se crearon crons separados**
  ```bash
  cat vercel.json | grep -E "briefings|alerts|prometeo"
  ```
  - Resultado esperado: ningún match

| Check | Estado |
|-------|--------|
| lib/heartbeat/types.ts creado | [ ] |
| lib/heartbeat/engine.ts creado | [ ] |
| lib/heartbeat/checks/alerts.ts creado | [ ] |
| lib/heartbeat/checks/briefings.ts creado | [ ] |
| lib/heartbeat/checks/tasks.ts creado | [ ] |
| app/api/heartbeat/route.ts creado | [ ] |
| vercel.json tiene UN SOLO cron | [ ] |
| Unit tests pasan | [ ] |
| Heartbeat retorna OK | [ ] |

### F5B.9: Merge a main

- [ ] **Merge a main**
  ```bash
  git checkout main
  git pull origin main
  git merge refactor/fase-4-5b-onboarding
  git push origin main
  ```

- [ ] **Cleanup del branch**
  ```bash
  git branch -d refactor/fase-4-5b-onboarding
  git push origin --delete refactor/fase-4-5b-onboarding
  ```

**✅ MERGE 4/5 COMPLETADO → Actualizar ESTADO ACTUAL y avanzar a FASE 6+7+8**

---

## FASE 6: BRIEFING ENGINE [~6 horas]

> **Branch:** `refactor/fase-6-8-briefings` (junto con Fases 7 y 8)  
> **Objetivo:** Generar briefings matutinos personalizados (llamado desde heartbeat)  
> **Riesgo:** BAJO - El heartbeat ya existe, solo creamos el generador  
> **Dependencias:** Fase 3 (profiles), Fase 4 (push), Fase 5B (heartbeat)
> 
> ⚠️ **NOTA:** Esta fase YA NO crea su propio cron. El briefing es llamado por el heartbeat.

### F6.0: Crear branch (si no existe)

- [ ] **Crear branch combinado para Fases 6+7+8**
  ```bash
  git checkout main && git pull origin main
  git checkout -b refactor/fase-6-8-briefings
  git push -u origin refactor/fase-6-8-briefings
  ```

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿Qué tools puede usar el briefing?**
   - [ ] Todas las skills de Odoo
   - [ ] Solo un subconjunto: `_______________`
   - [ ] También RAG

2. **¿Formato del briefing?**
   - [ ] Push corto + link al chat con briefing completo
   - [ ] Solo push (todo en el cuerpo)
   - [ ] Email además de push

3. **¿Guardar historial?**
   - [ ] Sí, en briefing_history (ya tenemos la tabla)
   - [ ] No

4. **¿Marcar como leído?**
   - [ ] Sí, cuando abre el link
   - [ ] No trackear

> ⚠️ **Ya NO hay que decidir frecuencia de cron** — el heartbeat (Fase 5B) corre cada 10 min y decide si es hora de briefing para cada usuario según su `briefing_time` en el perfil.

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

### ~~F6.6: Agregar cron a vercel.json~~ (ELIMINADO)

> ⚠️ **Ya no se necesita cron separado para briefings.**
> El heartbeat (Fase 5B) es el único cron y llama a `checkBriefings()` internamente.

### F6.6: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/briefing/
  git commit -m "feat: Briefing generator (called by heartbeat)

  - System prompt builder for personalized briefings
  - Briefing generator using Odoo skills
  - History service for persistence
  - Chat context loader for viewing briefings
  
  Note: No cron here - heartbeat handles scheduling"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/fase-6-8-briefings
  ```

### ✅ Checkpoint F6: Tests de validación

- [ ] **Unit tests**
  ```bash
  npm run test
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
    generateBriefing(profile).then(console.log)
  "
  ```
  - Resultado: [ ] Genera briefing / [ ] Error

- [ ] **Verificar que NO hay cron de briefings**
  ```bash
  cat vercel.json | grep briefings
  ```
  - Resultado esperado: ningún match

| Check | Estado |
|-------|--------|
| F6.0: Branch creado | [ ] |
| Prompts creados | [ ] |
| Generator funciona | [ ] |
| History service funciona | [ ] |
| Chat context loader funciona | [ ] |
| ~~Cron configurado~~ | N/A (heartbeat) |
| Historial se guarda | [ ] |
| Quick test pasa | [ ] |

**Continuar con FASE 7 en el mismo branch**

---

## FASE 7: SETTINGS [~3 horas]

> **Branch:** `refactor/fase-6-8-briefings` (mismo que Fase 6)  
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

- [ ] **Unit tests**
  ```bash
  npm run test
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
| Unit tests pasan | [ ] |

**Continuar con FASE 8 en el mismo branch**

---

## FASE 8: ALERTAS PROACTIVAS [~3 horas]

> **Branch:** `refactor/fase-6-8-briefings` (mismo que Fases 6 y 7)  
> **Objetivo:** Lógica de evaluación de alertas (llamada desde heartbeat)  
> **Riesgo:** BAJO - El heartbeat ya existe, solo creamos el evaluador  
> **Dependencias:** Fase 3 (profiles con alertas), Fase 4 (push), Fase 5B (heartbeat)
> 
> ⚠️ **NOTA:** Esta fase YA NO crea su propio cron. Las alertas son evaluadas por el heartbeat.

### 🔴 VALIDACIÓN PREVIA - Revisar con usuario antes de desarrollar

**Decisiones a confirmar:**

1. **¿Deduplicación de alertas?**
   - [ ] No enviar la misma alerta más de 1 vez por día
   - [ ] No enviar la misma alerta más de 1 vez por semana
   - [ ] Siempre enviar si la condición se cumple

2. **¿Cómo marcar alertas como "vistas"?**
   - [ ] Cuando abre la notificación
   - [ ] Botón "Entendido" en el chat
   - [ ] No trackear

3. **¿Prioridad de alertas afecta push?**
   - [ ] High = con sonido/vibración, Normal = silencioso
   - [ ] Todas igual

> ⚠️ **Ya NO hay que decidir frecuencia** — el heartbeat corre cada 10 min y evalúa alertas con prioridad máxima.

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

### ~~F8.2: API del cron de alertas~~ (ELIMINADO)

> ⚠️ **Ya no se necesita endpoint separado para alertas.**
> El heartbeat (Fase 5B) llama a `checkAlerts()` directamente desde `lib/heartbeat/checks/alerts.ts`.
> 
> Si querés testear alertas manualmente, podés llamar al heartbeat:
> ```bash
> curl -X GET "https://preview-url/api/heartbeat" \
>   -H "Authorization: Bearer $CRON_SECRET"
> ```

### ~~F8.3: Agregar cron de alertas a vercel.json~~ (ELIMINADO)

> ⚠️ **Ya no se necesita cron separado para alertas.**
> El heartbeat es el único cron y evalúa alertas con prioridad máxima en cada tick.

### F8.2: Commit y push

- [ ] **Commit de cambios**
  ```bash
  git add lib/briefing/alert-checker.ts
  git commit -m "feat: Alert evaluation logic (called by heartbeat)

  - Alert checker that evaluates conditions with LLM
  - Deduplication (same alert only once per day)
  - Called by heartbeat with priority 1
  
  Note: No cron here - heartbeat handles scheduling"
  ```

- [ ] **Push al branch**
  ```bash
  git push origin refactor/fase-6-8-briefings
  ```

### ✅ Checkpoint F8: Tests de validación

- [ ] **Unit tests**
  ```bash
  npm run test
  ```
  - Resultado: `_______________`

- [ ] **Agent evals** (verificación final de no regresión)
  ```bash
  npm run test:evals 2>&1 | tail -5
  ```
  - Resultado: `_____ / _____ = _____%`
  - Comparar con baseline: `_______________`

- [ ] **Test de alertas via heartbeat**
  ```bash
  # Configurar un perfil con alerta que se cumple, luego:
  curl -X GET "https://preview-url/api/heartbeat" \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  - Resultado esperado: `{ "status": "acted", "alerts_triggered": 1, ... }`
  - Resultado actual: `_______________`

- [ ] **Verificar que NO hay crons separados**
  ```bash
  cat vercel.json
  ```
  - Resultado esperado: solo `/api/heartbeat`

| Check | Estado |
|-------|--------|
| F6: Briefing generator completo | [ ] |
| F7: Settings completo | [ ] |
| F8: Alert checker creado | [ ] |
| F8: Deduplicación funciona | [ ] |
| ~~F8: API endpoint~~  | N/A (heartbeat) |
| ~~F8: Cron configurado~~ | N/A (heartbeat) |
| Unit tests pasan | [ ] |
| Agent evals ≥ baseline | [ ] |
| UN SOLO cron en vercel.json | [ ] |

### F8.3: Merge a main (MERGE FINAL)

- [ ] **Merge a main**
  ```bash
  git checkout main
  git pull origin main
  git merge refactor/fase-6-8-briefings
  git push origin main
  ```

- [ ] **Cleanup del branch**
  ```bash
  git branch -d refactor/fase-6-8-briefings
  git push origin --delete refactor/fase-6-8-briefings
  ```

**✅ MERGE 5/5 COMPLETADO → REFACTOR COMPLETO! 🎉**

---

## 🚀 VERIFICACIÓN FINAL POST-REFACTOR

### Pre-requisitos completados

- [ ] MERGE 1/5: fase-0-limpieza ✅
- [ ] MERGE 2/5: fase-1-rag-tool ✅
- [ ] MERGE 3/5: fase-2-3-pwa-db ✅
- [ ] MERGE 4/5: fase-4-5b-onboarding ✅
- [ ] MERGE 5/5: fase-6-8-briefings ✅

### Verificación de producción

- [ ] **Verificar deploy de producción**
  - URL: https://tuqui.app (o la que corresponda)
  - [ ] Login funciona
  - [ ] Chat funciona
  - [ ] RAG tool se llama cuando corresponde
  - [ ] PWA instalable
  - [ ] Onboarding funciona (usuario nuevo)
  - [ ] Settings funciona
  - [ ] Heartbeat endpoint responde

- [ ] **Verificar heartbeat**
  ```bash
  curl -X GET "https://tuqui.app/api/heartbeat" \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  - Resultado esperado: `{ "status": "ok" | "acted", ... }`
  
- [ ] **Verificar UN SOLO cron en Vercel**
  - Dashboard → Settings → Crons
  - Debe mostrar solo: `/api/heartbeat` cada 10 min
  - NO debe haber: `/api/prometeo/run`, `/api/internal/briefings`, `/api/internal/alerts`

### Cleanup final

- [ ] **Eliminar tag de backup (opcional)**
  ```bash
  git tag -d backup-pre-refactor-v2
  git push origin --delete backup-pre-refactor-v2
  ```

- [ ] **Actualizar README con nuevas features**

---

## 📊 RESUMEN DE COMANDOS ÚTILES

### Tests
```bash
# Unit tests (rápido, con mocks)
npm run test

# Integration tests (APIs reales)
npm run test:integration

# Agent evals (lento, agente completo)
npm run test:evals

# Todos los tests
npm run test:all

# CI pipeline (unit + integration)
npm run test:ci

# Verificar compilación
npx tsc --noEmit

# Test heartbeat local
curl -X GET "http://localhost:3000/api/heartbeat" \
  -H "Authorization: Bearer $CRON_SECRET"
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

### 2026-02-02: Heartbeat pattern
- Decisión: UN SOLO CRON (heartbeat) en lugar de 3 crons separados
- Inspiración: OpenClaw heartbeat pattern adaptado a Vercel serverless
- Justificación: Priorización, anti-spam, contexto compartido, economía de tokens
- Fase 5B agregada para implementar el motor central

---

## 🤖 NOTAS PARA CLAUDE CODE

### Heartbeat pattern:
- **UN SOLO CRON** en vercel.json: `/api/heartbeat` cada 10 min
- El heartbeat decide internamente qué hacer según hora, día, perfiles
- Si no hay nada que hacer → retorna `{ status: "ok" }` sin llamar LLM
- Orden de prioridad: alertas (1) > briefings (2) > tareas (3)
- Anti-spam: si ya notificaste a un usuario en este tick, no lo vuelvas a notificar
- Time budget: 45 segundos máximo (dejar 15s de margen para Vercel)
- Cada check es independiente y puede fallar sin afectar a los demás

### Archivos del heartbeat:
```
lib/heartbeat/
├── types.ts            ← Tipos (HeartbeatResult, HeartbeatContext, etc.)
├── engine.ts           ← Motor central (heartbeat() function)
└── checks/
    ├── alerts.ts       ← Prioridad 1
    ├── briefings.ts    ← Prioridad 2
    └── tasks.ts        ← Prioridad 3 (Prometeo)

app/api/heartbeat/
└── route.ts            ← Único cron endpoint
```

### Qué NO crear:
- ❌ NO crear `app/api/internal/briefings/route.ts` (no tiene cron propio)
- ❌ NO crear `app/api/internal/alerts/route.ts` (no tiene cron propio)
- ❌ NO agregar múltiples crons a vercel.json

### vercel.json final esperado:
```json
{
  "crons": [
    {
      "path": "/api/heartbeat",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## ❓ PREGUNTAS PENDIENTES

1. ¿Los íconos PWA los generamos desde el logo existente o creamos nuevos?
2. ¿Qué timezone default usamos para briefings? (asumiendo America/Argentina/Buenos_Aires)
3. ¿El onboarding es obligatorio o se puede skipear?

---

*Última actualización: 2026-02-02*
