# TUQUI REFACTOR PLAN — Intelligence Layer

> De chatbot reactivo a agente de inteligencia de negocio proactivo.

---

## Visión

Tuqui no responde preguntas. **Tuqui vende inteligencia.**

Lo transaccional está resuelto (ERPs, dashboards, reportes). Lo que falta es alguien que mire todos los datos, entienda el rubro, conozca al usuario, y diga: "che, mirá esto que no sabías".

Tuqui es ese alguien.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TUQUI INTELLIGENCE                          │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ PERFILES   │  │ DISCOVERY  │  │ ENTREGA    │  │ MEMORIA      │  │
│  │            │  │ ENGINE     │  │            │  │              │  │
│  │ Empresa    │  │            │  │ PWA Push   │  │ Aprende del  │  │
│  │ (auto)     │→ │ Pool de    │→ │ Chat open  │→ │ uso y        │  │
│  │ Usuario    │  │ discoveries│  │ Sugeridas  │  │ enriquece    │  │
│  │ (conversa) │  │ Scoring    │  │ WhatsApp   │  │ todo         │  │
│  │ Memoria    │  │ Teasers    │  │            │  │              │  │
│  │ (auto)     │  │            │  │            │  │              │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ MODELOS DE NEGOCIO                                           │    │
│  │ Distribución: stock, vencimientos, rotación, pricing         │    │
│  │ Servicio: utilización, proyectos, rentabilidad, renovaciones │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ TOOLS EXISTENTES (no cambian)                                │    │
│  │ Odoo queries, RAG, MercadoLibre, AFIP, WhatsApp             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. PERFILES

### 1.1 Perfil de empresa (Capa 0 — automático)

Se construye solo al conectar Odoo. Cero input del usuario.

```typescript
// lib/intelligence/profiles/tenant-profile.ts

interface TenantProfile {
  businessModel: "distribucion" | "servicio";
  scale: {
    productCount: number;
    activeClients: number;
    monthlyRevenue: number;
    avgTicket: number;
  };
  topCategories: string[];
  hasEcommerce: boolean;
  hasExpiryTracking: boolean;
  hasSalesTeams: boolean;
  salesTeams: string[];
  activeProvinces: string[];
}

// Se genera con queries a Odoo existentes
// Se refresca semanalmente
// Activa/desactiva discoveries según capacidades del tenant
```

**Para qué sirve:**
- `hasExpiryTracking: true` → activa discoveries de vencimiento
- `hasSalesTeams: true` → activa discoveries de zona/vendedor
- `hasEcommerce: true` → activa discoveries de web/ML
- `topCategories` → los discoveries mencionan categorías reales

### 1.2 Perfil de usuario (Capa 1 — conversación libre)

No es un formulario. No es un journey hardcodeado. Es una conversación abierta.

Primera vez que el usuario entra:

```
Tuqui: ¡Hola! Soy Tuqui, tu asistente de inteligencia para [empresa].
       Contame un poco: ¿qué hacés acá, qué te interesa seguir 
       de cerca, qué te preocupa del negocio? Decime como quieras.
```

El usuario escribe lo que quiera:

```
"Soy Martín, el dueño. Me mata la cobranza, tenemos mucha guita 
en la calle. Quiero entender el stock que no se mueve, sobre todo 
siliconas. Córdoba me tiene intrigado, muchos clientes y no vendemos."
```

Tuqui extrae el perfil con un LLM call:

```typescript
// lib/intelligence/profiles/extract-profile.ts

async function extractProfileFromText(
  freeText: string, 
  currentProfile?: UserProfile
): Promise<UserProfile> {
  const result = await gemini.generate({
    prompt: `
      Un usuario de una empresa describió sus intereses y preocupaciones.
      Extraé un perfil estructurado en JSON.
      Si hay perfil previo, enriquecelo sin borrar lo anterior.
      
      Texto: "${freeText}"
      Perfil actual: ${JSON.stringify(currentProfile || {})}
      
      JSON con: role, painPoints[], watchlist { clients[], products[], 
      zones[], categories[] }, communicationStyle
    `,
    responseFormat: "json"
  });
  return JSON.parse(result);
}
```

Resultado:

```json
{
  "role": "dueno",
  "painPoints": ["cobranza", "stock_sin_movimiento"],
  "watchlist": {
    "clients": [],
    "products": ["siliconas"],
    "zones": ["Córdoba"],
    "categories": []
  },
  "communicationStyle": "directo, informal"
}
```

**Enriquecimiento continuo:** Si en el día 15 el usuario dice "che, quiero seguir de cerca a Macrodental", se vuelve a correr `extractProfileFromText` con el perfil actual y se actualiza. Sin fricción.

### 1.3 Memoria (Capa 2 — automática)

Cada interacción alimenta el perfil silenciosamente.

```typescript
// lib/intelligence/profiles/memory-enricher.ts

async function onUserMessage(userId: string, message: string) {
  // Extraer entidades mencionadas
  const entities = extractEntities(message);
  // "cuánto le vendimos a Macrodental" → { type: "client", name: "Macrodental" }
  
  for (const entity of entities) {
    await incrementMention(userId, entity);
    // Si menciona algo 3+ veces → auto-agregar al watchlist
    if (await getMentionCount(userId, entity) >= 3) {
      await addToWatchlist(userId, entity);
    }
  }
}

async function onDiscoveryShown(userId: string, discoveryId: string, tapped: boolean) {
  await saveDiscoveryInteraction(userId, discoveryId, tapped);
  // Si ignora una categoría 5+ veces → penalizar en scoring
  // Si toca una categoría seguido → boostear en scoring
}
```

**El usuario no sabe que Tuqui "aprendió". Solo nota que cada día es más relevante.**

---

## 2. DISCOVERY ENGINE

### 2.1 Concepto

Cada vez que el usuario abre Tuqui, recibe:
- **Un dato real** de su negocio (el hook)
- **Una pregunta sugerida** para profundizar (el engagement)

```
👻 Macrodental no te compra hace 47 días — antes lo hacía cada 20.
   → "¿Qué dejó de llevar?"
```

El dato genera urgencia. La pregunta genera el click. El click genera conversación.

### 2.2 Estructura

```typescript
// lib/intelligence/discoveries/types.ts

interface Discovery {
  id: string;
  category: "dinero" | "stock" | "clientes" | "oportunidad";
  models: ("distribucion" | "servicio")[];
  roles: string[];
  cooldownDays: number;
  
  // Rápido (~1 query). Corre al abrir.
  getTeaser: (tenantId: string, profile: UserProfile) => Promise<Teaser | null>;
  
  // Pesado. Corre SOLO si el usuario toca la pregunta.
  deepDive: (tenantId: string, teaserData: any) => Promise<string>;
}

interface Teaser {
  emoji: string;
  dato: string;       // Una línea. El hook.
  pregunta: string;   // La pregunta sugerida.
  teaserData: any;    // Contexto para el deepDive.
}
```

### 2.3 Pool de discoveries — Distribución

```
DINERO
├── moroso-que-compra      "X te debe $Y pero te compró $Z esta semana"
│                          → "¿Cuántos más están así?"
├── concentracion-riesgo   "El 52% de tu facturación depende de 3 clientes"
│                          → "¿Quiénes son y cuánto me duele si se va uno?"
└── dia-mas-rentable       "Los martes facturás 40% más que los jueves"
                           → "¿Qué se vende más cada día?"

STOCK
├── capital-dormido        "$4.2M parados en productos sin venta en 3 meses"
│                          → "¿Cuáles son y cómo los liquido?"
├── vencimiento            "Silicona Vericom: 90 unidades, vence en mayo, $3.8M"
│                          → "¿Con qué lo puedo combinar para sacarlo?"
├── comprando-al-pedo      "Seguís comprando X pero las ventas cayeron 40%"
│                          → "¿Qué otros productos estoy comprando de más?"
├── estrella-sin-stock     "Tu #2 en ventas tiene stock para 12 días"
│                          → "¿Hay pedido abierto?"
└── producto-trending      "Las puntas de mezcladoras crecieron 80% este mes"
                           → "¿Tengo stock para aguantar?"

CLIENTES
├── cliente-fantasma       "Macrodental no compra hace 47 días, antes cada 20"
│                          → "¿Qué dejó de llevar?"
├── cliente-que-achica     "X pasó de $500K/mes a $200K/mes"
│                          → "¿Qué categorías dejó?"
├── cliente-nuevo-fuerte   "Y es cliente hace 30 días y ya compró $1.2M"
│                          → "¿Qué más le puedo ofrecer?"
├── cross-sell             "15 clientes compran composite pero no adhesivo"
│                          → "¿Quiénes son?"
└── zona-muerta            "Córdoba: 14 clientes, $0 en febrero"
                           → "¿Qué pasa con el vendedor de esa zona?"
```

### 2.4 Pool de discoveries — Servicio

```
DINERO
├── horas-sin-facturar     "42 horas facturables no incluidas en facturas"
│                          → "¿De qué proyectos son?"
├── cliente-caro           "X te paga $200K/mes pero consume 80hs de soporte"
│                          → "¿Es rentable o me conviene renegociar?"
└── servicio-impago        "3 clientes con servicio activo y 2+ cuotas impagas"
                           → "¿Les corto el servicio?"

EQUIPO
├── saturacion             "Lucía está al 115% hace 3 semanas"
│                          → "¿Qué proyectos tiene y qué puedo redistribuir?"
├── subutilizacion         "Pedro está al 45% de utilización"
│                          → "¿Qué proyectos en pipeline le puedo asignar?"
└── skill-gap              "3 proyectos de tipo X en pipeline, 1 sola persona sabe X"
                           → "¿A quién puedo capacitar?"

CLIENTES
├── proyecto-pasado        "Implementación de Y lleva 140% de horas presupuestadas"
│                          → "¿Renegocio o cierro scope?"
├── proyecto-parado        "Proyecto Z sin movimiento hace 18 días"
│                          → "¿Está bloqueado por el cliente?"
├── contrato-por-vencer    "El contrato de W vence en 45 días"
│                          → "¿Arrancamos la renovación?"
└── tickets-anomalos       "Cliente V tiene 3x más tickets que su promedio"
                           → "¿Hay un problema de calidad?"
```

### 2.5 Scoring y selección

```typescript
// lib/intelligence/discoveries/engine.ts

async function getSessionOpener(
  tenantId: string, userId: string
): Promise<Teaser | null> {
  const tenant = await getTenantProfile(tenantId);
  const profile = await getUserProfile(userId);
  
  // 1. Filtrar por modelo de negocio y rol
  let pool = allDiscoveries.filter(d =>
    d.models.includes(tenant.businessModel) &&
    d.roles.includes(profile.role)
  );

  // 2. Filtrar por capacidades del tenant
  pool = pool.filter(d => {
    if (d.id === "vencimiento" && !tenant.hasExpiryTracking) return false;
    if (d.id === "zona-muerta" && !tenant.hasSalesTeams) return false;
    if (d.id.includes("web") && !tenant.hasEcommerce) return false;
    return true;
  });

  // 3. Excluir por cooldown
  const history = await getDiscoveryHistory(userId);
  pool = pool.filter(d => {
    const last = history.find(h => h.discoveryId === d.id);
    return !last || daysSince(last.shownAt) >= d.cooldownDays;
  });

  // 4. Scoring con perfil + memoria
  const scored = pool.map(d => ({
    discovery: d,
    score: scoreDiscovery(d, profile)
  }));

  // 5. Weighted random de top 5 (no siempre el #1)
  const top5 = scored.sort((a, b) => b.score - a.score).slice(0, 5);
  const shuffled = weightedShuffle(top5);

  // 6. Ejecutar teasers hasta encontrar dato interesante
  for (const { discovery } of shuffled) {
    try {
      const teaser = await discovery.getTeaser(tenantId, profile);
      if (teaser) {
        // Personalizar con watchlist
        const personalized = personalizeTeaser(teaser, profile);
        await saveShown(userId, discovery.id);
        return personalized;
      }
    } catch { continue; }
  }

  return null;
}

function scoreDiscovery(d: Discovery, profile: UserProfile): number {
  let score = 1.0;

  // Pain points del onboarding
  if (profile.painPoints.includes("cobranza") && d.category === "dinero") score += 2;
  if (profile.painPoints.includes("stock") && d.category === "stock") score += 2;

  // Watchlist: priorizar discoveries que involucren entidades seguidas
  if (d.canTargetEntity && hasWatchlistEntities(profile)) score += 1.5;

  // Memoria: categorías que toca seguido
  if (profile.learned.discoveryPreferences.includes(d.category)) score += 1;

  // Memoria: categorías que ignora
  if (profile.learned.discoveryIgnored.includes(d.category)) score -= 1.5;

  return score;
}
```

---

## 3. ENTREGA

### 3.1 Al abrir el chat (inmediato)

```typescript
// En el handler de nueva sesión / chat open

async function onChatOpen(tenantId: string, userId: string) {
  const teaser = await getSessionOpener(tenantId, userId);
  
  if (teaser) {
    return {
      role: "assistant",
      content: `${teaser.emoji} ${teaser.dato}`,
      suggestedQuestions: [teaser.pregunta],
      metadata: { teaserData: teaser.teaserData }
    };
  }
  
  return { 
    role: "assistant", 
    content: "¡Hola! ¿En qué te puedo ayudar?" 
  };
}
```

En la UI:

```
┌──────────────────────────────────────────┐
│                                          │
│  👻 Macrodental no te compra hace 47     │
│  días — antes lo hacía cada 20.          │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  ¿Qué dejó de llevar?           │    │ ← botón tocable
│  └──────────────────────────────────┘    │
│                                          │
└──────────────────────────────────────────┘
```

Usuario toca → se envía la pregunta como mensaje → Tuqui ejecuta el deepDive → conversación.

### 3.2 PWA Push Notifications (proactivo)

El scanner corre en un cron. Si encuentra algo de severidad alta, manda push.

**Setup PWA:**

```typescript
// public/sw.js (service worker)

self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/tuqui-icon-192.png',
      badge: '/icons/tuqui-badge-72.png',
      tag: data.tag,           // para agrupar/reemplazar
      data: { url: data.url }, // a dónde lleva el click
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data.url;
  event.waitUntil(
    clients.openWindow(url) // abre Tuqui en la pregunta sugerida
  );
});
```

```typescript
// lib/intelligence/push/subscribe.ts
// API route para registrar la suscripción push del usuario

import webpush from 'web-push';

// En el onboarding o en settings
async function subscribeToPush(userId: string, subscription: PushSubscription) {
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    subscription: JSON.stringify(subscription),
    updated_at: new Date()
  });
}
```

```typescript
// lib/intelligence/push/send.ts

async function sendPushToUser(userId: string, teaser: Teaser) {
  const sub = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single();
  
  if (!sub.data) return;

  await webpush.sendNotification(
    JSON.parse(sub.data.subscription),
    JSON.stringify({
      title: `${teaser.emoji} Tuqui`,
      body: teaser.dato,
      tag: `discovery-${Date.now()}`,
      url: `/chat?q=${encodeURIComponent(teaser.pregunta)}`
      // El click abre el chat con la pregunta pre-cargada
    })
  );
}
```

**Cron job (alertas proactivas):**

```typescript
// lib/intelligence/push/daily-scanner.ts

async function dailyScan() {
  const tenants = await getActiveTenants();
  
  for (const tenant of tenants) {
    // Correr solo discoveries de alta prioridad
    const criticalDiscoveries = allDiscoveries.filter(d => 
      d.pushWorthy === true && d.models.includes(tenant.businessModel)
    );
    
    for (const disc of criticalDiscoveries) {
      const teaser = await disc.getTeaser(tenant.id, null);
      if (!teaser) continue;
      
      // Mandar push a usuarios relevantes según rol
      const users = await getTenantUsers(tenant.id);
      for (const user of users) {
        if (disc.roles.includes(user.role)) {
          await sendPushToUser(user.id, teaser);
        }
      }
    }
  }
}

// Vercel Cron o Cloud Scheduler
// Corre 1x/día a las 7AM hora del tenant
```

**Qué es pushWorthy (no todo merece una push):**

```typescript
// Solo discoveries con impacto inmediato mandan push
const pushWorthyIds = [
  "estrella-sin-stock",        // se te acaba lo que vendés → urgente
  "vencimiento",               // se te vence mercadería → urgente
  "servicio-impago",           // te deben y siguen usando → acción
  "contrato-por-vencer",       // se te vence un contrato → acción
  "saturacion",                // alguien está quemándose → acción
];
```

La push se ve así en el celular:

```
┌──────────────────────────────────────────┐
│ 🚨 Tuqui                          7:02 AM│
│                                          │
│ Tu #2 en ventas tiene stock para 12 días │
│ y no hay pedido abierto.                 │
│                                          │
└──────────────────────────────────────────┘
  ↓ (toca)
  → Abre Tuqui con "¿Hay pedido abierto?" pre-cargado
  → Conversación sobre qué reponer
```

### 3.3 Inteligencia inyectada en todas las respuestas

El último scan se cachea. Se inyecta en el contexto de cada conversación.

```typescript
// En el chat handler

async function handleMessage(tenantId: string, userId: string, message: string) {
  const cachedScan = await getCachedScan(tenantId); // max 6hs de antigüedad
  
  const intelligenceContext = cachedScan ? `
    ALERTAS ACTIVAS DEL NEGOCIO:
    ${cachedScan.alerts.map(a => `- ${a.type}: ${a.summary}`).join('\n')}
    
    Si alguna alerta es relevante para lo que preguntó el usuario,
    mencionala brevemente al final. No la repitas entera.
  ` : "";

  const response = await gemini.chat({
    systemPrompt: basePrompt + intelligenceContext,
    history: sessionHistory,
    message,
    tools: availableTools,
  });
}
```

Ahora "cuánto vendimos esta semana?" no solo da el número:

> Ventas: $18.2M (+8%). Sillones CINGOL lideran.
> Dato: Córdoba sigue en $0 para mayoristas — 14 clientes sin facturar.

---

## 4. MODELOS DE NEGOCIO

### 4.1 Distribución

Activos que se pudren: **stock** (se vence, se rompe), **plata en la calle** (morosidad), **espacio** (depósito finito).

Alertas clave:
- Stock muerto (sin venta 90+ días, capital parado)
- Vencimientos cercanos (<120 días)
- Sobrestock (>6 meses de cobertura)
- Quiebre inminente (<15 días de cobertura, sin OC)
- Compras innecesarias (compramos pero no vendemos)
- Margen erosionado (<15% o cayendo)
- Cliente que achica (ticket -30% en 3 meses)
- Zona floja (muchos clientes, poca facturación)

Cruces que generan valor:
- Stock muerto × clientes que compran esa categoría → campaña dirigida
- Morosos × compradores recientes → apalancamiento de cobro
- Compras crecientes + ventas estancadas → sobrestock en formación
- Productos complementarios no vendidos juntos → cross-sell

### 4.2 Servicio

Activos que se pudren: **tiempo** (horas sin facturar), **proyectos** (scope creep), **relaciones** (clientes que se van).

Alertas clave:
- Equipo subutilizado (<60% utilización)
- Equipo saturado (>110% por 2+ semanas)
- Horas sin facturar (timesheets sin invoice)
- Proyecto pasado de scope (>120% horas presupuestadas)
- Proyecto estancado (sin movimiento 15+ días)
- Rentabilidad negativa por proyecto
- Contrato por vencer (<60 días)
- Tickets anómalos (3x promedio → insatisfacción)

Cruces:
- Facturado vs costo real por cliente → rentabilidad real
- Skills del equipo × pipeline → cuellos de botella
- Tiempo de respuesta × churn → ¿el soporte lento nos cuesta clientes?

---

## 5. ESQUEMA DE DATOS

```sql
-- Supabase, todas con RLS por tenant_id

-- Perfil de empresa (auto-generado)
CREATE TABLE tenant_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  business_model TEXT NOT NULL, -- 'distribucion' | 'servicio'
  scale JSONB,
  top_categories TEXT[],
  has_ecommerce BOOLEAN DEFAULT false,
  has_expiry_tracking BOOLEAN DEFAULT false,
  has_sales_teams BOOLEAN DEFAULT false,
  sales_teams TEXT[],
  active_provinces TEXT[],
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Perfil de usuario (onboarding + enriquecido)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  role TEXT, -- 'dueno' | 'comercial' | 'compras' | 'cobranzas' | 'ecommerce'
  pain_points TEXT[],
  watchlist_clients TEXT[],
  watchlist_products TEXT[],
  watchlist_zones TEXT[],
  watchlist_categories TEXT[],
  communication_style TEXT,
  discovery_preferences TEXT[], -- categorías que toca
  discovery_ignored TEXT[],     -- categorías que ignora
  onboarded BOOLEAN DEFAULT false,
  raw_onboarding_text TEXT,     -- lo que escribió el usuario
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Menciones de entidades (para auto-watchlist)
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  entity_type TEXT, -- 'client' | 'product' | 'zone' | 'category'
  entity_name TEXT,
  mention_count INT DEFAULT 1,
  last_mentioned TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_name)
);

-- Historial de discoveries mostrados
CREATE TABLE discovery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  discovery_id TEXT,
  shown_at TIMESTAMPTZ DEFAULT now(),
  tapped BOOLEAN DEFAULT false
);

-- Suscripciones push
CREATE TABLE push_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  subscription JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cache de scans (para inyectar en contexto)
CREATE TABLE scan_cache (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  result JSONB,
  scanned_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. ESTRUCTURA DE ARCHIVOS

```
lib/
  intelligence/
    profiles/
      tenant-profile.ts       # Auto-genera perfil de empresa desde Odoo
      user-profile.ts          # Tipos y CRUD
      extract-profile.ts       # LLM extrae perfil de texto libre
      memory-enricher.ts       # Enriquece perfil con cada interacción
    
    discoveries/
      types.ts                 # Interfaces Discovery, Teaser
      engine.ts                # Selección + scoring + getSessionOpener()
      
      distribucion/            # Pool de discoveries para distribución
        capital-dormido.ts
        moroso-que-compra.ts
        vencimiento.ts
        estrella-sin-stock.ts
        comprando-al-pedo.ts
        producto-trending.ts
        cliente-fantasma.ts
        cliente-que-achica.ts
        cliente-nuevo-fuerte.ts
        cross-sell.ts
        zona-muerta.ts
        concentracion-riesgo.ts
        dia-mas-rentable.ts
      
      servicio/                # Pool de discoveries para servicio
        horas-sin-facturar.ts
        saturacion.ts
        subutilizacion.ts
        proyecto-pasado.ts
        proyecto-parado.ts
        contrato-por-vencer.ts
        tickets-anomalos.ts
        cliente-caro.ts
        servicio-impago.ts
    
    push/
      subscribe.ts             # Registrar suscripción push
      send.ts                  # Enviar push notification
      daily-scanner.ts         # Cron: scan + push alertas críticas
    
    context/
      scan-cache.ts            # Cachear último scan
      inject-intelligence.ts   # Inyectar alertas en contexto del chat
```

---

## 7. FASES DE IMPLEMENTACIÓN

### Fase 1: Discovery feed en chat (2-3 semanas)
- [ ] Crear tabla `user_profiles` y `discovery_history`
- [ ] Implementar onboarding conversacional (extractProfileFromText)
- [ ] Crear 5 discoveries de distribución (los más impactantes):
  - `moroso-que-compra`
  - `vencimiento`
  - `estrella-sin-stock`
  - `cliente-fantasma`
  - `capital-dormido`
- [ ] Implementar engine (scoring + selección + cooldown)
- [ ] Integrar con chat: al abrir → teaser + pregunta sugerida
- [ ] Probar con Cedent

### Fase 2: Perfil + memoria (2 semanas)
- [ ] Crear tabla `entity_mentions`
- [ ] Implementar memory-enricher (auto-watchlist)
- [ ] Scoring con perfil + memoria
- [ ] Personalización de teasers con watchlist
- [ ] Validar que la experiencia mejora con el uso en Cedent

### Fase 3: PWA Push (2 semanas)
- [ ] Configurar manifest.json + service worker
- [ ] Implementar subscribe/send push
- [ ] Crear daily-scanner con cron (Vercel Cron o Cloud Scheduler)
- [ ] Definir qué discoveries son pushWorthy
- [ ] Push → click → abre chat con pregunta pre-cargada

### Fase 4: Inteligencia en todas las respuestas (1 semana)
- [ ] Implementar scan-cache
- [ ] Inyectar alertas activas en contexto de cada conversación
- [ ] Gemini agrega proactivamente datos relevantes a cualquier respuesta

### Fase 5: Modelo servicio (2-3 semanas)
- [ ] Crear discoveries de servicio (8-9 del pool)
- [ ] Validar con primer cliente de servicio de Adhoc
- [ ] Ajustar umbrales con datos reales

### Fase 6: Flywheel (ongoing)
- [ ] Trackear qué discoveries se tocan vs se ignoran
- [ ] A/B testear hooks y preguntas
- [ ] Agregar nuevos discoveries según feedback
- [ ] Ajustar umbrales con datos de producción
- [ ] Las verticales (dental, indumentaria, etc.) se apilan después como Capa 2

---

## 8. MÉTRICAS DE ÉXITO

```
RETENCIÓN
- DAU / MAU ratio (target: >40%)
- Días consecutivos de uso
- % usuarios que abren Tuqui sin trigger externo

ENGAGEMENT
- % de teasers tocados (target: >30%)
- Largo de sesión después de tocar un discovery
- Preguntas por sesión

VALOR
- Discoveries que generaron acción (el usuario hizo algo con el dato)
- Descubrimientos "no sabía esto" (NPS del insight)
- Revenue recuperado por alertas (stock liquidado, deuda cobrada, quiebre evitado)

PRODUCTO
- Tiempo hasta primer "wow moment" (target: <5 minutos)
- Usuarios que completan onboarding conversacional (target: >80%)
- Push notification open rate (target: >25%)
```

---

## El pitch en una línea

**"Tuqui no te muestra datos. Te dice lo que no sabías que tenías que preguntar."**

---

*Creado: 2026-02-15*
*Relación: Este plan es la visión a mediano plazo. Las fases de implementación inmediatas están en `TUQUI_REFACTOR_PLAN.md` (F7 → F7.6 → F5 → F6 → F8 → F9).*
