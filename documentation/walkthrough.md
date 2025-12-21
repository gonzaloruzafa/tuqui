# Tuqui Agents Alpha - Walkthrough

## Resumen
Se ha completado la implementación de "Tuqui Agents Alpha", una plataforma multi-tenant de agentes de IA.

### Características Implementadas
1.  **Autenticación**: NextAuth.js con Google + Tenant Injection.
2.  **Multi-Tenancy**: Arquitectura de Master DB (routing) + Tenant DBs (aislamiento).
3.  **Agentes**:
    *   **Out-of-the-box**: Tuqui Chat, Odoo, MercadoLibre, Legal, Contador.
    *   **Custom**: Soporte para agentes definidos en base de datos.
4.  **RAG**: Sistema de búsqueda vectorial con Gemini `text-embedding-004` y pgvector.
5.  **Tools**:
    *   **Odoo**: Cliente JSON-RPC multi-tenant.
    *   **MercadoLibre**: Scraping tools (Search, Prices, Details).
    *   **Executor**: Sistema centralizado de ejecución de tools.
6.  **Panel de Administración (/admin)**:
    *   **Dashboard Central**: Acceso rápido a todos los módulos.
    *   **Gestión de Usuarios**: Invitar y eliminar miembros del equipo.
    *   **Editor de Agentes**: Configuración avanzada de Prompt de Sistema, activación de RAG (con modo estricto), selección de documentos específicos y habilitación de Tools.
    *   **Configuración de Empresa**: Definición de identidad, industria y tono de voz (global para agentes).
    *   **Integraciones (Tools)**: Habilitar/Deshabilitar conectores (Odoo, MercadoLibre, WhatsApp).
    *   **Base de Conocimiento (RAG)**: Gestión de documentos indexados.
7.  **Billing y Uso**:
    *   **Límites de Uso**: Control de tokens por usuario/tenant.
    *   **Tracking de Tokens**: Monitoreo del consumo de tokens.
8.  **Prometeo**: Runner para notificaciones push programadas.
9.  **WhatsApp**: Webhook de Twilio para interacción vía chat.
10. **Frontend**: Dashboard y Chat UI replicados y modernizados.

## Verificación Manual

### 1. Setup Base de Datos
Debes ejecutar los scripts SQL en tu proyecto Supabase:
1.  Copiar contenido de `supabase/master-schema.sql` y ejecutar en SQL Editor del proyecto Master.
2.  Copiar contenido de `supabase/tenant-schema.sql` y ejecutar en SQL Editor del proyecto Tenant.

### 2. Configurar Entorno
Asegurate de tener `.env.local` configurado con las claves reales (ver `.env.example`).

### 3. Seed Inicial
Se ha creado un script para facilitar el inicio (crea tenant demo y usuario admin):
```bash
npx tsx scripts/setup.ts
```
*Nota: Edita el script para poner TU email de Google si quieres loguearte.*

### 4. Correr la App
```bash
npm run dev
```

### 5. Probar
1.  Login con Google.
2.  Verás el Dashboard con tu Tenant (ej: Demo Company).
3.  Entrar a "Tuqui Chat".
4.  Probar tools: "Busca un iphone en mercadolibre".

## Archivos Clave
*   `app/api/chat/route.ts`: Core logic (Auth + Billing + RAG + Tools + AI).
*   `lib/agents/service.ts`: Lógica de merging de agentes (Builtin + DB).
*   `lib/supabase/tenant.ts`: Factory de conexiones dinámicas.

## Próximos Pasos (Beta)
*   Deploy a Vercel con configuración de Cron Jobs.
*   Setup real de Twilio y Web Push.
*   Integracion Stripe real.
