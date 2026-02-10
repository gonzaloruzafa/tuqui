# Test Plan — F2.4 & F2.5 (Tenant Management)

> Features: Password change, user delete, tenant delete, integrations view, agent sync info

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
| 1 | GET detail: retorna integraciones | Response incluye array de integrations |
| 2 | GET detail: agentes incluyen sync info | Response tiene master_version_synced, last_synced_at |
| 3 | GET detail: usage aggregation correct | Tokens y requests se suman bien |

---

## ✅ Tests Manuales (Checklist para ejecutar en staging/prod)

### Cambiar password de usuario
- [ ] Ir a `/super-admin/tenants/{id}` → click ícono 🔑 en un usuario
- [ ] Verificar que aparece modal con email correcto
- [ ] Intentar guardar con menos de 6 chars → debe mostrar error
- [ ] Guardar password válido → modal se cierra
- [ ] Cerrar sesión → loguearse con el usuario usando la nueva password
- [ ] Verificar que funciona

### Eliminar usuario
- [ ] Click ícono 🗑️ en usuario → confirm dialog aparece
- [ ] Cancelar → nada pasa
- [ ] Confirmar → usuario desaparece de la lista
- [ ] Verificar que no puede loguearse más
- [ ] Intentar eliminar el último admin → debe mostrar error

### Eliminar tenant
- [ ] Scroll al fondo → sección roja "Zona peligrosa"
- [ ] Click "Eliminar tenant" → prompt pide escribir nombre
- [ ] Escribir nombre incorrecto → no pasa nada
- [ ] Escribir nombre correcto → redirige a lista de tenants
- [ ] Verificar que el tenant ya no aparece en la lista
- [ ] Verificar que los usuarios del tenant no pueden loguearse

### Integrations section
- [ ] Tenant con integraciones → muestra tipo + estado (✅/❌)
- [ ] Tenant sin integraciones → muestra "Sin integraciones configuradas"

### Agent sync info
- [ ] Agentes con `last_synced_at` → muestra fecha de último sync
- [ ] Agentes con `custom_instructions` → muestra badge "📝 custom prompt"
- [ ] Agentes sin master_agent_id → muestra badge "custom"
- [ ] Agentes con master_agent_id → muestra badge "base"

### Tenant isolation (regresión)
- [ ] Login como gonza@logos.com → NO debe ver datos de Cedent
- [ ] Login como martin@cedent.com.ar → NO debe ver datos de Logos
- [ ] Verificar documentos, integraciones, agentes son del tenant correcto

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
