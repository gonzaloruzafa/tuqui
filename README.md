# Tuqui Enterprise Brain

**Sistema Operativo de Agentes Especializados para Empresas**

> 🧠 **Concepto Central:** Tuqui no es un chatbot. Es un cerebro empresarial que combina agentes especializados, memoria organizacional persistente y ejecución proactiva para que tu empresa tome mejores decisiones en tiempo real.

---

## 🎯 ¿Qué es Tuqui?

Tuqui es una plataforma que convierte los datos dispersos de tu empresa (ERP, emails, documentos, decisiones históricas) en **inteligencia accionable** a través de agentes especializados que:

- **Anticipan problemas** antes que ocurran (cash flow, stock, atrasos)
- **Responden con contexto completo** (histórico + datos actuales + políticas)
- **Ejecutan acciones** con tu aprobación (órdenes de compra, alertas, notificaciones)
- **Aprenden de decisiones pasadas** (memoria organizacional)

### Un día con Tuqui

**8:47 AM** → *"Caja estable esta semana. Atención: 2 facturas >60 días, Producto A se agota en 6 días"*  
Sin abrir dashboards. Con criterio, no solo datos.

**10:30 AM** → Usuario: *"¿Puedo dar 15% descuento al cliente X?"*  
Tuqui: *"Sí en productos A y B. No en C (margen cae a 8%). Último descuento hace 4 meses: 10%, funcionó bien. Cliente paga a tiempo."*  
Decisión en 3 segundos. Contexto completo.

**13:15 PM** → *"Ventas de Producto A aceleradas 220%. Se agota en 6 días. ¿Genero orden de compra?"*  
Anticipación, no reacción.

**18:00 PM** → *"Hoy evitaste: 1 quiebre de stock, 1 decisión incorrecta, 3 interrupciones internas"*  
Tuqui no hizo ruido. Pero cambió el día.

---

## 🏗️ Arquitectura Core

### 1. Suite de Agentes Especializados

Cada agente domina un área específica:

- **Finance Agent**: Margen, cash flow, comportamiento de pago, riesgo crediticio
- **Sales Agent**: Políticas de descuento, pipeline, forecasting, historial de ventas
- **Inventory Agent**: Stock, reorden automático, detección de tendencias
- **Legal Agent**: Contratos, compliance, regulaciones locales (AFIP, etc.)
- **HR Agent**: Onboarding, políticas internas, consultas de empleados
- **Customer Support Agent**: FAQs, tickets, resolución de problemas

Los agentes **colaboran**: una consulta compleja activa múltiples agentes en paralelo.

### 2. Memoria Empresarial (5 Capas)

| Capa | Qué Guarda | Para Qué Sirve |
|------|------------|----------------|
| **📄 Documentos (RAG)** | Manuales, políticas, contratos | Búsqueda semántica en conocimiento escrito |
| **📊 Event Stream** | Decisiones históricas, acciones ejecutadas | "La última vez que aprobamos esto..." |
| **💾 Structured Data** | Datos actuales de ERP/CRM en tiempo real | Stock actual, facturas, órdenes |
| **📋 Políticas** | Reglas de negocio (margen mínimo, límites) | Límites claros para decisiones automáticas |
| **💬 Contexto Conversacional** | Histórico de chats, resúmenes | Continuidad entre sesiones |

**Clave**: Cuando un agente responde, combina las 5 capas. No solo "busca documentos" — usa experiencia acumulada.

### 3. Prometeo (Scheduler Inteligente)

Sistema de ejecución proactiva basado en:
- **Triggers temporales**: "Todos los lunes 9 AM, resumen de caja"
- **Triggers de eventos**: "Si stock < 7 días, alertar"
- **Triggers de condiciones**: "Si factura >30 días impaga, escalar"

Los agentes **no esperan que preguntes**. Te alertan cuando importa.

### 4. Conectores Pluggables

Tuqui funciona con **cualquier stack tecnológico**:

| Sistema | Conectores Disponibles |
|---------|------------------------|
| **ERP** | Odoo (todas las versiones), SAP, Dynamics, Google Sheets |
| **CRM** | Salesforce, HubSpot, Pipedrive |
| **Email** | Gmail, Outlook |
| **Docs** | Google Drive, SharePoint, Notion |
| **Chat** | Slack, Teams, WhatsApp (Twilio) |
| **Custom** | REST API, Webhooks |

**No eres rehén de un sistema**: Cambias de Odoo a SAP, Tuqui sigue funcionando.

---

## 🔐 Multi-Tenancy Estricto

### Database per Tenant (Máximo Aislamiento)
```
┌─────────────────────────────────────┐
│         MASTER DB                   │
│  • Tenants (registro + routing)     │
│  • Users (email → tenant mapping)   │
│  • Agent Registry (global)          │
└─────────────────────────────────────┘
              ↓
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│Tenant A│ │Tenant B│ │Tenant N│
│  DB    │ │  DB    │ │  DB    │
│        │ │        │ │        │
│• Vectors│ • Vectors│ • Vectors│
│• Events │ • Events │ • Events │
│• Configs│ • Configs│ • Configs│
│• Chat   │ • Chat   │ • Chat   │
└────────┘ └────────┘ └────────┘
```

**Ventajas**:
- ✅ Compliance enterprise (datos aislados físicamente)
- ✅ Performance predecible (no hay "noisy neighbors")
- ✅ Backup/restore independiente por cliente
- ✅ Escalabilidad horizontal (nuevos clientes = nuevas DBs)

**Client Factory** (`lib/supabase/tenant.ts`): dado un `tenantId`, obtiene credenciales y devuelve cliente conectado a la DB específica.

---

## 🚀 Stack Tecnológico

### Backend
- **Next.js 14** (App Router)
- **TypeScript** (type-safety end-to-end)
- **Vercel AI SDK** (streaming, tool calling, multi-agent)
- **Google Gemini 2.0 Flash** (LLM principal)
- **Supabase** (PostgreSQL + pgvector + Auth)

### AI/ML
- **RAG**: `text-embedding-004` + `pgvector` (búsqueda semántica)
- **Multi-Agent**: Orquestador inteligente (decide qué agentes activar)
- **Tool Calling**: Agentes ejecutan funciones específicas (consultar ERP, generar reportes)

### Integraciones
- **Odoo**: XML-RPC (todas las versiones)
- **MercadoLibre**: REST API
- **WhatsApp**: Twilio API
- **Gmail/Drive**: Google APIs
- **Custom**: Arquitectura de conectores extensible

### Auth & Security
- **NextAuth.js** (Google OAuth)
- **Tenant injection** (sesión sabe a qué tenant pertenece)
- **RLS policies** (row-level security en Supabase)
- **API Key rotation** (credenciales tenant encriptadas)

---

## 📁 Estructura del Proyecto
```
/
├── app/
│   ├── api/
│   │   ├── chat/              # Orquestador multi-agent
│   │   ├── agents/            # CRUD de agentes
│   │   ├── prometeo/          # Scheduler (triggers proactivos)
│   │   ├── whatsapp/          # Webhook Twilio
│   │   └── integrations/      # Config de conectores
│   │
│   ├── chat/                  # UI principal (single chat multi-agent)
│   ├── agents/                # Gestión de agentes
│   ├── integrations/          # Setup de conectores
│   ├── prometeo/              # Config de tareas programadas
│   └── login/                 # Auth custom
│
├── lib/
│   ├── agents/
│   │   ├── finance-agent.ts   # Skills de Finance
│   │   ├── sales-agent.ts     # Skills de Sales
│   │   ├── inventory-agent.ts # Skills de Inventory
│   │   ├── orchestrator.ts    # Decide qué agentes activar
│   │   └── registry.ts        # Agent catalog
│   │
│   ├── memory/
│   │   ├── enterprise-memory.ts   # Orquestador de memoria (5 capas)
│   │   ├── event-stream.ts        # Decisiones históricas
│   │   ├── rag.ts                 # Vector search (docs)
│   │   ├── policies.ts            # Reglas de negocio
│   │   └── context.ts             # Chat history
│   │
│   ├── connectors/
│   │   ├── index.ts           # Interfaz Connector genérica
│   │   ├── odoo.ts            # Implementación Odoo
│   │   ├── sap.ts             # Implementación SAP
│   │   ├── sheets.ts          # Google Sheets como "ERP"
│   │   └── salesforce.ts      # Implementación Salesforce
│   │
│   ├── prometeo/
│   │   ├── scheduler.ts       # Cron + event triggers
│   │   ├── executor.ts        # Ejecución de tareas
│   │   └── triggers.ts        # Definición de reglas
│   │
│   ├── supabase/
│   │   ├── master.ts          # Cliente Master DB
│   │   ├── tenant.ts          # Factory (tenantId → client)
│   │   └── migrations/        # SQL schemas
│   │
│   ├── auth/                  # NextAuth config
│   ├── billing/               # Token tracking y límites
│   └── utils/                 # Helpers
│
├── supabase/
│   ├── master-schema.sql          # Schema Master DB
│   ├── tenant-schema.sql          # Schema Tenant DB
│   └── migrations/
│       ├── 006_rag_setup.sql      # RAG (vectores)
│       └── 007_memory_system.sql  # Event stream + policies
│
└── scripts/
    ├── setup.ts               # Initial setup (tenant + admin)
    └── seed-demo.ts           # Data de demo
```

---

## 🎯 Casos de Uso Core

### 1. Decisiones con Contexto Completo
**Problema**: Vendedor pregunta "¿Puedo dar X% descuento?"  
**Sin Tuqui**: Busca en manual, consulta gerente, pierde tiempo.  
**Con Tuqui**: Respuesta en 3 segundos con margen actual + histórico cliente + política empresa + stock disponible.

### 2. Alertas Proactivas
**Problema**: Stock se agota, facturas se vencen, nadie se da cuenta hasta que es tarde.  
**Sin Tuqui**: Reacción (apagar incendios).  
**Con Tuqui**: Anticipación (Prometeo detecta tendencias y alerta antes).

### 3. Onboarding Sin Fricción
**Problema**: Nuevos empleados interrumpen RRHH con preguntas básicas.  
**Sin Tuqui**: RRHH responde lo mismo 100 veces.  
**Con Tuqui**: HR Agent responde citando manual interno, sin interrupciones.

### 4. Aprendizaje Continuo
**Problema**: Cada decisión se toma "desde cero", sin memoria institucional.  
**Sin Tuqui**: Empresa repite errores, pierde conocimiento cuando alguien se va.  
**Con Tuqui**: Event stream captura decisiones + outcomes. Sistema aprende qué funciona.

---

## 🚀 Setup para Desarrollo

### 1. Prerrequisitos
- Node.js 18+
- 2 Proyectos Supabase (Master + Initial Tenant)
- Google Cloud Console (OAuth)
- Gemini API Key

### 2. Variables de Entorno
```bash
cp .env.example .env.local
```

Completar:
- Credenciales Master DB (Supabase)
- Credenciales Initial Tenant (Supabase)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `NEXTAUTH_SECRET`

### 3. Base de Datos
```bash
# En Supabase Console - Master Project
# Ejecutar: supabase/master-schema.sql

# En Supabase Console - Tenant Project
# Ejecutar: supabase/tenant-schema.sql
# Ejecutar: supabase/migrations/006_complete_rag_setup.sql
# Ejecutar: supabase/migrations/007_enterprise_memory.sql (nuevo)
```

### 4. Inicialización
```bash
npm install
npx tsx scripts/setup.ts  # Crea tenant demo + admin user
```

### 5. Run
```bash
npm run dev
```

Abre `http://localhost:3000`

---

## 🎨 Diferenciadores Clave

| Feature | Competencia (Copilot, Glean, ChatGPT) | Tuqui |
|---------|----------------------------------------|-------|
| **Memoria Organizacional** | Solo busca docs | 5 capas (docs + eventos + datos actuales + políticas + contexto) |
| **Agentes Especializados** | Genérico | Finance, Sales, Legal, etc. con skills específicos |
| **Proactividad** | Solo responde cuando preguntan | Prometeo ejecuta tareas sin intervención |
| **Multi-Agent** | Single model | Orquestador activa agentes en paralelo |
| **Conectores** | Lock-in (Microsoft, Google) | Pluggable (Odoo, SAP, Sheets, cualquiera) |
| **LATAM Focus** | Global genérico | AFIP, MercadoLibre, compliance local |

---

## 📊 Roadmap

### ✅ Fase 1: Foundation (Completado)
- Multi-tenant architecture
- RAG básico (documentos)
- Google Auth
- Chat interface
- Integraciones básicas (Odoo, MeLi, WhatsApp)

### 🚧 Fase 2: Enterprise Brain (En Desarrollo)
- [ ] Multi-agent orchestrator
- [ ] Event stream (decisiones históricas)
- [ ] Prometeo scheduler
- [ ] Política system
- [ ] Conectores pluggables (SAP, Salesforce, Sheets)

### 📅 Fase 3: Intelligence (Q2 2025)
- [ ] Learning loop (outcomes → mejora de modelos)
- [ ] Knowledge graph (relaciones entre entidades)
- [ ] Agent marketplace (community agents)
- [ ] Analytics dashboard (ROI, métricas)

### 📅 Fase 4: Scale (Q3-Q4 2025)
- [ ] Multi-región deployment
- [ ] Enterprise SLA
- [ ] Advanced security (SOC2, ISO27001)
- [ ] API pública para developers

---

## 🤝 Contribuir

Este es un proyecto privado en fase alpha. Si eres parte del equipo:

1. **Antes de cualquier cambio**: Lee `documentation/walkthrough.md`
2. **Arquitectura multi-tenant**: No rompas el aislamiento entre tenants
3. **Agentes como tools**: Nuevos agentes deben ser tools, no chats separados
4. **Memoria first**: Toda decisión/acción debe guardarse en event stream

---

## 📄 Documentación Adicional

- [Implementation Plan](documentation/implementation_plan.md) - Roadmap técnico detallado
- [Walkthrough](documentation/walkthrough.md) - Tour guiado del código
- [Architecture Deep Dive](documentation/architecture.md) - Decisiones de diseño (próximamente)

---

## 💡 Filosofía de Producto

> "Tuqui no responde preguntas.  
> Tuqui hace que la empresa piense mejor."

No vendemos IA. Vendemos **decisiones mejores**:
- Con contexto completo (presente + pasado)
- En tiempo real (sin esperas)
- Con criterio (reglas + experiencia)
- Sin ruido (solo cuando importa)

---

## 📞 Contacto

- **Empresa**: Adhoc S.A. (Partner Odoo Argentina)
- **Repositorio**: Privado
- **Status**: Alpha (uso interno + beta limitado)

---

**Última actualización**: Diciembre 2024  
**Versión**: 0.2.0-alpha