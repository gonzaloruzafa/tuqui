# Tuqui Enterprise Brain

**Sistema de Agente IA Unificado para Empresas**

> 🧠 **Tuqui** es un asistente empresarial inteligente que conecta tu ERP, documentos y conocimiento interno en un solo punto de acceso.

---

## 🎯 ¿Qué es Tuqui?

Un agente de IA que:
- **Consulta tu ERP** (Odoo) con lenguaje natural
- **Busca en documentos** internos (manuales, políticas)
- **Compara precios** en MercadoLibre
- **Responde por WhatsApp** o web
- **Programa alertas** automáticas (Prometeo)

### Ejemplos de uso

```
👤 "¿Cuánto vendimos este mes?"
🤖 "Las ventas de diciembre fueron $12.847.320, +15% vs noviembre."

👤 "Top 5 clientes morosos"
🤖 "| Cliente | Deuda | Días Vencida |
    | ABC SA  | $500K | 45 días      |..."

👤 "¿Qué precio tiene el iPhone 15 en MercadoLibre?"
🤖 "Desde $1.200.000 en cuotas, $999.000 contado..."

👤 "¿Cómo proceso una devolución?"
🤖 "[Según el manual interno] El proceso es..."
```

---

## 🏗️ Arquitectura

### Single Database con RLS

```
┌──────────────────────────────────────────────────────┐
│              Supabase Database                        │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Todas las tablas con tenant_id                  │ │
│  │                                                 │ │
│  │  tenants          → Organizaciones              │ │
│  │  users            → Usuarios por tenant         │ │
│  │  agents           → Config del agente Tuqui    │ │
│  │  integrations     → Conexiones (Odoo, etc)     │ │
│  │  documents        → Base de conocimiento       │ │
│  │  document_chunks  → Embeddings para RAG        │ │
│  │  chat_sessions    → Historial de chats         │ │
│  │  chat_messages    → Mensajes                   │ │
│  │  prometeo_tasks   → Tareas programadas         │ │
│  │  usage_stats      → Tracking de uso            │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Row Level Security (RLS)                            │
│  └─ tenant_id = current_setting('app.tenant_id')   │
└──────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 16 (App Router) |
| Backend | Vercel Serverless Functions |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Google Gemini 2.0 Flash |
| Auth | NextAuth.js (Google OAuth) |
| WhatsApp | Twilio |
| ERP | Odoo (JSON-RPC) |

---

## 📁 Estructura del Proyecto

```
tuqui-agents-alpha/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── chat/         # Chat endpoint (Gemini)
│   │   ├── whatsapp/     # Twilio webhook
│   │   ├── prometeo/     # Scheduled tasks
│   │   └── ...
│   ├── admin/            # Admin dashboard pages
│   ├── chat/[slug]/      # Chat UI
│   └── login/            # Auth
│
├── lib/                   # Core libraries
│   ├── supabase/         # Database client (RLS)
│   ├── chat/             # Chat engine
│   ├── agents/           # Agent config & routing
│   ├── rag/              # Document search
│   ├── tools/            # Tool implementations
│   │   └── odoo/        # Odoo BI Agent
│   ├── prometeo/         # Scheduled tasks
│   └── billing/          # Usage tracking
│
├── components/           # React components
│   ├── chat/            # Chat UI components
│   └── admin/           # Admin components
│
├── supabase/
│   └── migrations/       # SQL migrations
│       ├── 100_unified_schema.sql
│       ├── 101_rls_policies.sql
│       └── 102_seed_data.sql
│
└── docs/                 # Documentation
    └── MIGRATION_RLS.md  # Migration guide
```

---

## 🚀 Setup

### 1. Clonar y instalar

```bash
git clone https://github.com/gonzaloruzafa/tuqui-agents-alpha.git
cd tuqui-agents-alpha
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completar:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=xxx

# Auth (Google OAuth)
AUTH_SECRET=xxx
AUTH_GOOGLE_ID=xxx
AUTH_GOOGLE_SECRET=xxx

# Twilio (opcional)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+14155238886
```

### 3. Setup base de datos

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar migrations en orden:
   - `supabase/migrations/100_unified_schema.sql`
   - `supabase/migrations/101_rls_policies.sql`
   - `supabase/migrations/102_seed_data.sql`

### 4. Correr local

```bash
npm run dev
```

Abrir http://localhost:3000

---

## 🔧 Configuración

### Agregar integración Odoo

1. Ir a Admin → Herramientas → Odoo
2. Configurar:
   - URL: `https://tu-empresa.odoo.com`
   - DB: `odoo`
   - Usuario: `admin@empresa.com`
   - API Key: (generar en Odoo)

### Subir documentos RAG

1. Ir a Admin → Base de Conocimiento
2. Click "Agregar documento"
3. Subir PDF/TXT o pegar contenido
4. Se generan embeddings automáticamente

### Configurar WhatsApp

1. Crear cuenta Twilio
2. Activar WhatsApp Sandbox
3. Configurar webhook: `https://tuqui.adhoc.inc/api/whatsapp/webhook`

---

## 📊 Uso de la API

### Chat

```bash
POST /api/chat
Content-Type: application/json

{
  "message": "¿Cuánto vendimos este mes?",
  "agentSlug": "tuqui",
  "sessionId": "optional-uuid"
}
```

### WhatsApp Webhook (Twilio)

```
POST /api/whatsapp/webhook
```

Twilio envía mensajes entrantes a este endpoint.

---

## 🛡️ Seguridad

- **RLS**: Cada tenant solo ve sus datos
- **Service Role**: API usa service key (server-side only)
- **Auth**: Google OAuth con dominio permitido
- **Secrets**: Credenciales Odoo encriptadas en DB

---

## 📈 Métricas

- **usage_stats**: Tokens usados por usuario/mes
- **chat_messages**: Historial completo de conversaciones
- **prometeo_executions**: Log de tareas ejecutadas

---

## 🤝 Contribuir

1. Fork el repo
2. Crear branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m "Add feature"`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abrir Pull Request

---

## 📝 Licencia

Privado - © 2026 Adhoc
