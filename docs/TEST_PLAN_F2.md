# Test Plan — F2.4 & F2.5 (Tenant Management)

> Features: Password change, user create/delete, tenant delete, integrations view, agent sync info

---

## 🧪 Tests Automatizados (Vitest)

### `tests/unit/super-admin/tenant-users-api.test.ts`

| # | Test | Qué valida |
|---|------|-----------|
| 1 | Cambiar password: requiere min 6 chars | Devuelve 400 si password < 6 |
| 2 | Cambiar password: user debe pertenecer al tenant | 404 si userId no está en ese tenant |
| 3 | Cambiar password: llama auth.admin.updateUserById | Mock verifica args correctos |
| 4 | Eliminar user: no permite eliminar último admin | 400 si es el único admin |
| 5 | Eliminar user: elimina de public.users + auth | Verifica ambos deletes |
| 6 | Eliminar user: user debe pertenecer al tenant | 404 si userId incorrecto |
| 7 | Ambos endpoints: requieren super-admin auth | 403 sin sesión válida |

### `tests/unit/super-admin/tenant-delete-api.test.ts`

| # | Test | Qué valida |
|---|------|-----------|
| 1 | Delete tenant: elimina auth users primero | Llama deleteUser por cada user |
| 2 | Delete tenant: limpia todas las tablas | Verifica delete en cada tabla del cascade |
| 3 | Delete tenant: 404 si tenant no existe | Error correcto |
| 4 | Delete tenant: requiere super-admin auth | 403 sin sesión válida |

### `tests/unit/super-admin/tenant-detail-api.test.ts`

| # | Test | Qué valida |
|---|------|-----------|
| 1 | GET detail: retorna integraciones del tenant | Response incluye array de integrations |
| 2 | GET detail: agentes incluyen sync info | Response tiene master_version_synced, last_synced_at |
| 3 | GET detail: usage aggregation correct | Tokens y requests se suman bien |

---

## 📝 Endpoints API (solo backend, no tienen vistas propias)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/super-admin/tenants/{id}` | GET | Detalle de tenant (users, agents, integrations, usage) |
| `/api/super-admin/tenants/{id}` | PATCH | Actualizar nombre/is_active |
| `/api/super-admin/tenants/{id}` | DELETE | Eliminar tenant + cascade |
| `/api/super-admin/tenants/{id}/users` | POST | Crear usuario (email, password, is_admin) |
| `/api/super-admin/tenants/{id}/users/{userId}` | PATCH | Cambiar password |
| `/api/super-admin/tenants/{id}/users/{userId}` | DELETE | Eliminar usuario |

> Todos son API-only. La UI está en `/super-admin/tenants/{id}` (page.tsx).

---

## ✅ Tests Manuales (Checklist para ejecutar en staging/prod)

### Cambiar password de usuario
- [Ok] Ir a `/super-admin/tenants/{id}` → click ícono 🔑 en un usuario
- [Ok] Verificar que aparece modal con email correcto
- [Ok] Intentar guardar con menos de 6 chars → debe mostrar error
- [Ok] Guardar password válido → modal se cierra
- [Ok] Cerrar sesión → loguearse con el usuario usando la nueva password
- [Ok] Verificar que funciona

### Crear usuario
- [ ] Click ícono ➕ en sección usuarios → aparece modal
- [ ] Ingresar email inválido → error
- [ ] Ingresar password < 6 chars → error
- [ ] Crear usuario válido → aparece en la lista
- [ ] Crear usuario duplicado → error "Ya existe"
- [ ] Nuevo usuario puede loguearse

### Eliminar usuario
- [Ok] Click ícono 🗑️ en usuario → confirm dialog aparece
- [ ] Mensaje indica que conversaciones se conservan
- [Ok] Cancelar → nada pasa
- [Ok] Confirmar → usuario desaparece de la lista
- [Ok] Verificar que no puede loguearse más
- [Ok] Intentar eliminar el último admin → debe mostrar error

### Eliminar tenant
- [Ok] Scroll al fondo → sección roja "Zona peligrosa"
- [Ok] Click "Eliminar tenant" → prompt pide escribir nombre
- [ ] Mensaje indica qué se borra (usuarios, agentes, conversaciones, documentos)
- [Ok] Escribir nombre incorrecto → no pasa nada
- [Ok] Escribir nombre correcto → redirige a lista de tenants
- [Ok] Verificar que el tenant ya no aparece en la lista
- [Ok] Verificar que los usuarios del tenant no pueden loguearse

### Integraciones
- [ ] Tenant con integraciones (ej: Cedent) → muestra tipo + estado (Activa/Inactiva)
- [ ] Tenant sin integraciones → muestra "Sin integraciones configuradas"
- [ ] Odoo muestra "Activa" (ya está configurado en Cedent)

### Agent sync info
- [ ] Agentes con `last_synced_at` → muestra fecha de último sync con ícono 🔄
- [Ok] Agentes con `custom_instructions` → muestra badge "📝 custom prompt"
- [Ok] Agentes sin master_agent_id → muestra badge "custom"
- [Ok] Agentes con master_agent_id → muestra badge "base"

### Tenant isolation (regresión)
- [Ok] Login como gonza@logos.com → NO debe ver datos de Cedent
- [Ok] Login como martin@cedent.com.ar → NO debe ver datos de Logos
- [Ok] Verificar documentos, agentes son del tenant correcto

---

## 🔒 Security checks
- [ ] Acceder a `/api/super-admin/tenants/{id}/users/{userId}` sin sesión → 403
- [ ] Acceder con usuario no-admin → 403
- [ ] PATCH/DELETE con userId de otro tenant → 404 (no leak de info)

---

## ⚡ Orden de ejecución recomendado

1. Correr tests automatizados: `npx vitest tests/unit/super-admin/`
2. Tests manuales de password change (no destructivo)
3. Tests manuales de integrations/sync view (no destructivo)
4. Tests manuales de user delete (**en tenant de test, no Cedent!**)
5. Tests manuales de tenant delete (**crear un tenant dummy primero**)
6. Regresión de tenant isolation
