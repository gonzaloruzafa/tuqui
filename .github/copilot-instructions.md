# Tuqui - Copilot Instructions

## ⚠️ REGLAS OBLIGATORIAS DE GIT

### NUNCA trabajar directamente en main

**Antes de hacer cualquier cambio de código:**

1. **Crear branch** desde main:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <tipo>/<descripcion>
   ```

2. **Tipos de branch:**
   - `refactor/fase-X-nombre` - Para fases del refactor
   - `fix/descripcion` - Para bug fixes
   - `feat/descripcion` - Para features nuevos

3. **Workflow obligatorio:**
   ```
   crear branch → hacer cambios → npm run test → commit → push → merge a main
   ```

### Antes de merge a main

- [ ] Todos los tests pasan (`npm run test`)
- [ ] Tests de integración pasan (`npm run test:integration`)
- [ ] Build exitoso (`npm run build`)

---

## 📋 Contexto del Proyecto

### Refactor en progreso
Ver `TUQUI_REFACTOR_PLAN.md` para el plan completo con fases y checkpoints.

### ⚠️ REGLA: Actualizar el Plan de Refactor

**Después de completar cada paso o tarea:**

1. **Marcar como completado** en `TUQUI_REFACTOR_PLAN.md`:
   - Cambiar `[ ]` → `[✓]` o `[x]`
   - Actualizar barras de progreso `⬜⬜⬜⬜⬜` → `██████░░░░`
   - Llenar resultados: `Resultado: ___` → `Resultado: 159/159 passed`

2. **Actualizar estado actual** en la sección `📍 ESTADO ACTUAL`:
   - Branch actual
   - Último checkpoint
   - Fase actual

3. **Commit del plan** junto con los cambios de código:
   ```bash
   git add TUQUI_REFACTOR_PLAN.md <otros-archivos>
   git commit -m "feat: descripción + update plan"
   ```

**Esto mantiene el plan como fuente de verdad del progreso.**

---

### Estructura de Tests

```
tests/
├── unit/           # npm run test (~15s) - Tests rápidos
├── integration/    # npm run test:integration (~2min) - Smoke + skills
└── evals/          # npm run test:evals (~20min) - Agent evaluations
```

### Comandos de Test

| Comando | Uso |
|---------|-----|
| `npm run test` | Unit tests - correr siempre antes de commit |
| `npm run test:integration` | Smoke tests - correr antes de merge |
| `npm run test:evals` | Agent evals - correr después de deploy |
| `npm run test:ci` | Unit + Integration - lo que corre en CI |

---

## 🔧 Stack Técnico

- **Framework:** Next.js 15 (App Router)
- **Runtime:** Node.js 20
- **DB:** Supabase (PostgreSQL)
- **AI:** Vercel AI SDK con Google Gemini
- **Testing:** Vitest
- **Language:** TypeScript

---

## 📁 Estructura de Código

```
app/                 # Next.js App Router
lib/
├── ai/              # Vercel AI SDK integration
├── config/          # Configuración centralizada
├── db/              # Supabase clients
├── skills/          # Skills del agente (Odoo, MeLi, etc)
└── tools/           # AI tools
```

---

## ✅ Checklist Pre-Commit

Antes de cada commit, verificar:

1. `npm run test` pasa
2. `npx tsc --noEmit` sin errores
3. Mensaje de commit descriptivo
4. Branch correcto (NO main)
