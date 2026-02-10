# 🧠 TUQUI REFACTOR v4 — SPECS TÉCNICAS

> Código de referencia para implementación de F5-F7.  
> El plan estratégico está en `TUQUI_REFACTOR_PLAN.md`.  
> **Orden de ejecución: F7 → F5 → F6**  
> Última actualización: 2026-02-10

### Convención de migrations

| Número | Fase | Descripción |
|--------|------|-------------|
| `300` | F7 | master_documents + chunks + M2M |
| `301` | F7 | fix match_documents (UNION tenant + master) |
| `310` | F5 | push_subscriptions |
| `320` | F6 | user_briefing_config |

---

## F7: MASTER AGENTS + RAG CENTRALIZADO

### 7.1: Migrations para docs centralizados (~1h)

```sql
-- supabase/migrations/300_master_documents.sql

-- Documentos a nivel plataforma (sin tenant_id)
CREATE TABLE IF NOT EXISTS master_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT DEFAULT 'file',     -- 'file', 'manual', 'url'
    file_name TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chunks con embeddings (sin tenant_id) — ÚNICA copia de los vectores
CREATE TABLE IF NOT EXISTS master_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES master_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768),
    chunk_index INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_doc_chunks_embedding
    ON master_document_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- M2M: qué documentos tiene cada master agent
CREATE TABLE IF NOT EXISTS master_agent_documents (
    master_agent_id UUID NOT NULL REFERENCES master_agents(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES master_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (master_agent_id, document_id)
);
```

### 7.2: Fix match_documents para buscar en ambas tablas (~1h)

```sql
-- supabase/migrations/301_fix_match_documents.sql

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_agent_id UUID,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context not set';
    END IF;

    RETURN QUERY

    -- 1. Docs propios del tenant (como hoy)
    SELECT dc.id, dc.content,
           1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.tenant_id = v_tenant_id
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
      AND (
          d.is_global = true
          OR d.agent_id = match_agent_id
          OR EXISTS (
              SELECT 1 FROM agent_documents ad
              WHERE ad.agent_id = match_agent_id
                AND ad.document_id = d.id
                AND ad.tenant_id = v_tenant_id
          )
      )

    UNION ALL

    -- 2. Docs centralizados del master agent (sin copiar, query directo)
    SELECT mdc.id, mdc.content,
           1 - (mdc.embedding <=> query_embedding) AS similarity
    FROM master_document_chunks mdc
    JOIN master_agent_documents mad ON mad.document_id = mdc.document_id
    JOIN agents a ON a.master_agent_id = mad.master_agent_id
    WHERE a.id = match_agent_id
      AND a.tenant_id = v_tenant_id
      AND 1 - (mdc.embedding <=> query_embedding) > match_threshold

    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
```

### 7.3: Lista de Master Agents (~2h)

**Ruta:** `/super-admin/agents`

```typescript
// app/super-admin/agents/page.tsx
import { getClient } from '@/lib/supabase/client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import Link from 'next/link'

export default async function MasterAgentsPage() {
  await requirePlatformAdmin()
  const db = getClient()
  
  const { data: agents } = await db
    .from('master_agents')
    .select(`
      id, slug, name, description, tools, is_published, version,
      master_agent_documents(count),
      agents(count)
    `)
    .order('name')
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Master Agents</h1>
        <Link href="/super-admin/agents/new" className="btn btn-primary">
          + Nuevo Agent
        </Link>
      </div>
      
      <div className="space-y-4">
        {agents?.map(agent => (
          <Link 
            key={agent.id} 
            href={`/super-admin/agents/${agent.slug}`}
            className="block p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="font-semibold">{agent.name}</h2>
                <p className="text-sm text-gray-600">{agent.description}</p>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {agent.tools?.length || 0} tools
                  </span>
                  <span className="px-2 py-1 bg-blue-100 rounded">
                    📄 {agent.master_agent_documents?.[0]?.count || 0} docs
                  </span>
                  <span className="px-2 py-1 bg-green-100 rounded">
                    {agent.agents?.[0]?.count || 0} tenants
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-xs ${
                  agent.is_published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {agent.is_published ? '✅ Publicado' : '📝 Borrador'}
                </span>
                <div className="text-xs text-gray-500 mt-1">v{agent.version}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

### 7.4: Editor de Master Agent con Docs (~4h)

**Ruta:** `/super-admin/agents/[slug]`

```typescript
// app/super-admin/agents/[slug]/page.tsx
import { getClient } from '@/lib/supabase/client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { revalidatePath } from 'next/cache'
import { MasterAgentEditor } from '@/components/super-admin/MasterAgentEditor'

async function getAgent(slug: string) {
  const db = getClient()
  
  const [agentResult, docsResult, tenantsResult] = await Promise.all([
    db.from('master_agents').select('*').eq('slug', slug).single(),
    db.from('master_agent_documents')
      .select('document_id, master_documents(id, title, file_name, created_at)')
      .eq('master_agent_id', slug), // Necesita subquery
    db.from('agents')
      .select('tenant_id, is_active, tenants(name)')
      .eq('master_agent_id', slug)
  ])
  
  return {
    agent: agentResult.data,
    documents: docsResult.data,
    tenants: tenantsResult.data
  }
}

// Server Actions
async function saveAgent(formData: FormData) {
  'use server'
  await requirePlatformAdmin()
  
  const db = getClient()
  const slug = formData.get('slug') as string
  
  const { data: current } = await db
    .from('master_agents')
    .select('version')
    .eq('slug', slug)
    .single()
  
  await db.from('master_agents').update({
    name: formData.get('name'),
    description: formData.get('description'),
    system_prompt: formData.get('system_prompt'),
    tools: formData.getAll('tools'),
    welcome_message: formData.get('welcome_message'),
    placeholder_text: formData.get('placeholder_text'),
    is_published: formData.get('is_published') === 'on',
    version: (current?.version || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('slug', slug)
  
  revalidatePath(`/super-admin/agents/${slug}`)
}

async function syncToTenants(formData: FormData) {
  'use server'
  await requirePlatformAdmin()
  
  const db = getClient()
  const slug = formData.get('slug') as string
  
  // Sync config (no docs - esos se leen directo)
  await db.rpc('sync_agents_from_masters', { p_master_slug: slug })
  
  revalidatePath(`/super-admin/agents/${slug}`)
}

async function deleteDocument(formData: FormData) {
  'use server'
  await requirePlatformAdmin()
  
  const db = getClient()
  const docId = formData.get('doc_id') as string
  const slug = formData.get('slug') as string
  
  // Cascade borra chunks y links
  await db.from('master_documents').delete().eq('id', docId)
  
  revalidatePath(`/super-admin/agents/${slug}`)
}

export default async function MasterAgentEditorPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  await requirePlatformAdmin()
  const { agent, documents, tenants } = await getAgent(params.slug)
  
  if (!agent) {
    return <div>Agent not found</div>
  }
  
  return (
    <MasterAgentEditor
      agent={agent}
      documents={documents}
      tenants={tenants}
      onSave={saveAgent}
      onSync={syncToTenants}
      onDeleteDocument={deleteDocument}
    />
  )
}
```

### 7.5: Componente Editor (~3h)

```typescript
// components/super-admin/MasterAgentEditor.tsx
'use client'

import { useState } from 'react'
import { MasterDocUpload } from './MasterDocUpload'

interface Props {
  agent: any
  documents: any[]
  tenants: any[]
  onSave: (formData: FormData) => Promise<void>
  onSync: (formData: FormData) => Promise<void>
  onDeleteDocument: (formData: FormData) => Promise<void>
}

const AVAILABLE_TOOLS = [
  { id: 'knowledge_base', name: 'Base de Conocimiento (RAG)', icon: '📚' },
  { id: 'web_search', name: 'Búsqueda Web', icon: '🔍' },
  { id: 'odoo_query', name: 'Consultas Odoo', icon: '📊' },
  { id: 'memory', name: 'Memoria', icon: '🧠' },
]

export function MasterAgentEditor({ agent, documents, tenants, onSave, onSync, onDeleteDocument }: Props) {
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  
  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    await onSave(new FormData(e.currentTarget))
    setSaving(false)
  }
  
  async function handleSync() {
    setSyncing(true)
    const fd = new FormData()
    fd.set('slug', agent.slug)
    await onSync(fd)
    setSyncing(false)
  }
  
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <a href="/super-admin/agents" className="text-sm text-gray-500 hover:underline">
            ← Master Agents
          </a>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
        </div>
        <span className="text-sm text-gray-500">v{agent.version}</span>
      </div>
      
      <form onSubmit={handleSave} className="space-y-6">
        <input type="hidden" name="slug" value={agent.slug} />
        
        {/* Configuración básica */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Configuración</h2>
          
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input 
                name="name" 
                defaultValue={agent.name}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <input 
                name="description" 
                defaultValue={agent.description}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input 
                value={agent.slug}
                disabled
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>
            
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                name="is_published"
                defaultChecked={agent.is_published}
              />
              <span>Publicado</span>
            </label>
          </div>
        </section>
        
        {/* System Prompt */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">System Prompt</h2>
          <textarea
            name="system_prompt"
            defaultValue={agent.system_prompt}
            rows={12}
            className="w-full border rounded px-3 py-2 font-mono text-sm"
          />
        </section>
        
        {/* Tools */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Tools</h2>
          <div className="space-y-2">
            {AVAILABLE_TOOLS.map(tool => (
              <label key={tool.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="tools"
                  value={tool.id}
                  defaultChecked={agent.tools?.includes(tool.id)}
                />
                <span>{tool.icon} {tool.name}</span>
              </label>
            ))}
          </div>
        </section>
        
        {/* Documentos RAG */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">
            Documentos RAG ({documents?.length || 0})
          </h2>
          
          <div className="space-y-2 mb-4">
            {documents?.map((doc: any) => (
              <div key={doc.document_id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">📄 {doc.master_documents?.title}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {doc.master_documents?.file_name}
                  </span>
                </div>
                <form action={onDeleteDocument}>
                  <input type="hidden" name="doc_id" value={doc.document_id} />
                  <input type="hidden" name="slug" value={agent.slug} />
                  <button 
                    type="submit"
                    className="text-red-500 hover:text-red-700 text-sm"
                    onClick={(e) => {
                      if (!confirm('¿Eliminar documento?')) e.preventDefault()
                    }}
                  >
                    🗑️
                  </button>
                </form>
              </div>
            ))}
          </div>
          
          <MasterDocUpload agentSlug={agent.slug} />
        </section>
        
        {/* Mensajes */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Mensajes</h2>
          
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Welcome Message</label>
              <input 
                name="welcome_message" 
                defaultValue={agent.welcome_message}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Placeholder</label>
              <input 
                name="placeholder_text" 
                defaultValue={agent.placeholder_text}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </section>
        
        {/* Actions */}
        <div className="flex gap-4">
          <button 
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
          
          <button 
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Sincronizando...' : '🔄 Sync a todos los tenants'}
          </button>
        </div>
      </form>
      
      {/* Tenants usando este agent */}
      <section className="border rounded-lg p-4 mt-6">
        <h2 className="font-semibold mb-4">Tenants usando este agent</h2>
        <div className="space-y-2">
          {tenants?.map((t: any) => (
            <div key={t.tenant_id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span>{t.tenants?.name}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {t.is_active ? '✅ Activo' : '❌ Inactivo'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

### 7.6: Upload de documentos (~2h)

```typescript
// components/super-admin/MasterDocUpload.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MasterDocUpload({ agentSlug }: { agentSlug: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('agent_slug', agentSlug)
      
      const res = await fetch(`/api/super-admin/agents/${agentSlug}/documents`, {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
      
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div>
      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded hover:bg-gray-50">
        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        {uploading ? '⏳ Subiendo...' : '📎 Subir documento'}
      </label>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}
```

### 7.7: API para upload de docs (~2h)

```typescript
// app/api/super-admin/agents/[slug]/documents/route.ts
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { getClient } from '@/lib/supabase/client'
import { processMasterDocument } from '@/lib/rag/master-documents'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  await requirePlatformAdmin()
  const db = getClient()
  
  const { data: agent } = await db
    .from('master_agents')
    .select('id')
    .eq('slug', params.slug)
    .single()
  
  if (!agent) {
    return Response.json({ error: 'Agent not found' }, { status: 404 })
  }
  
  const { data: docs } = await db
    .from('master_agent_documents')
    .select('master_documents(*)')
    .eq('master_agent_id', agent.id)
  
  return Response.json({ documents: docs })
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  await requirePlatformAdmin()
  const db = getClient()
  
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  
  // 1. Get agent
  const { data: agent } = await db
    .from('master_agents')
    .select('id')
    .eq('slug', params.slug)
    .single()
  
  if (!agent) {
    return Response.json({ error: 'Agent not found' }, { status: 404 })
  }
  
  // 2. Process document (extract text, chunk, embed)
  const processed = await processMasterDocument(file)
  
  // 3. Insert document
  const { data: doc, error: docError } = await db
    .from('master_documents')
    .insert({
      title: file.name.replace(/\.[^/.]+$/, ''),
      content: processed.fullText,
      file_name: file.name,
      source_type: 'file',
      metadata: { originalSize: file.size, mimeType: file.type }
    })
    .select()
    .single()
  
  if (docError) {
    return Response.json({ error: docError.message }, { status: 500 })
  }
  
  // 4. Insert chunks with embeddings
  const chunks = processed.chunks.map((chunk, i) => ({
    document_id: doc.id,
    content: chunk.text,
    embedding: chunk.embedding,
    chunk_index: i,
    metadata: chunk.metadata || {}
  }))
  
  const { error: chunksError } = await db
    .from('master_document_chunks')
    .insert(chunks)
  
  if (chunksError) {
    // Rollback document
    await db.from('master_documents').delete().eq('id', doc.id)
    return Response.json({ error: chunksError.message }, { status: 500 })
  }
  
  // 5. Link to agent
  const { error: linkError } = await db
    .from('master_agent_documents')
    .insert({
      master_agent_id: agent.id,
      document_id: doc.id
    })
  
  if (linkError) {
    return Response.json({ error: linkError.message }, { status: 500 })
  }
  
  return Response.json({ 
    success: true, 
    document: doc,
    chunksCount: chunks.length 
  })
}
```

### 7.8: Procesador de documentos master (~2h)

```typescript
// lib/rag/master-documents.ts
import { generateEmbedding } from './embeddings'
import { chunkDocument } from './chunker'

interface ProcessedChunk {
  text: string
  embedding: number[]
  metadata?: Record<string, any>
}

interface ProcessedDocument {
  fullText: string
  chunks: ProcessedChunk[]
}

export async function processMasterDocument(file: File): Promise<ProcessedDocument> {
  // 1. Extract text based on file type
  let fullText: string
  
  if (file.type === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = Buffer.from(await file.arrayBuffer())
    const pdf = await pdfParse(buffer)
    fullText = pdf.text
  } else {
    // txt, md
    fullText = await file.text()
  }
  
  // 2. Chunk the document
  const textChunks = chunkDocument(fullText, {
    chunkSize: 1000,
    chunkOverlap: 200,
  })
  
  // 3. Generate embeddings for each chunk
  const chunks: ProcessedChunk[] = []
  
  for (const text of textChunks) {
    const embedding = await generateEmbedding(text)
    chunks.push({ text, embedding })
  }
  
  console.log(`[MasterDocs] Processed ${file.name}: ${chunks.length} chunks`)
  
  return { fullText, chunks }
}
```

### 7.9: Helper de platform auth (~30 min)

```typescript
// lib/platform/auth.ts
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || 'gr@adhoc.inc')
  .split(',')
  .map(e => e.trim().toLowerCase())

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return !!email && PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function requirePlatformAdmin() {
  const session = await auth()
  
  if (!session?.user?.email || !isPlatformAdmin(session.user.email)) {
    redirect('/')
  }
  
  return session
}

export async function getPlatformAdmin() {
  const session = await auth()
  
  if (!session?.user?.email || !isPlatformAdmin(session.user.email)) {
    return null
  }
  
  return session
}
```

### 7.10: PDFs legales a subir

| Documento | Agente | Fuente |
|-----------|--------|--------|
| Ley IVA 23.349 | contador | https://www.oas.org/juridico/spanish/mesicic3_arg_ley23349.pdf |
| Ley Ganancias 20.628 | contador | https://www.oas.org/juridico/spanish/mesicic3_arg_ley20628.pdf |
| LCT 20.744 | abogado | InfoLeg |
| Ley Sociedades 19.550 | abogado | https://www.oas.org/juridico/spanish/mesicic2_arg_ley_19550.pdf |

---

## F5: PWA + PUSH NOTIFICATIONS

### 5.1: PWA Base (~3h)

**Archivos nuevos:**

```
public/
├── manifest.json
├── sw.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

**manifest.json:**
```json
{
  "name": "Tuqui",
  "short_name": "Tuqui",
  "description": "El cerebro de tu empresa",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#7C3AED",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**sw.js (service worker mínimo):**
```javascript
// Escuchar push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'Tenés novedades en Tuqui',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tuqui', options)
  )
})

// Click en notificación → abrir app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})
```

**Modificar `app/layout.tsx`:**
```tsx
<head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#7C3AED" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
</head>
```

### 5.2: Tabla push_subscriptions (~30 min)

```sql
-- supabase/migrations/310_push_subscriptions.sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_user ON push_subscriptions(user_id);
```

### 5.3: Push Sender (~2h)

```typescript
// lib/push/sender.ts (~60 líneas)
import webpush from 'web-push'

// Configurar VAPID keys (generar una vez, guardar en env)
webpush.setVapidDetails(
  'mailto:soporte@tuqui.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushNotification {
  title: string
  body: string
  url?: string
}

export async function sendPushToUser(
  userId: string,
  notification: PushNotification
): Promise<{ sent: number; failed: number }> {
  const db = getClient()
  
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  
  if (!subs?.length) return { sent: 0, failed: 0 }
  
  let sent = 0, failed = 0
  
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        JSON.stringify(notification)
      )
      sent++
    } catch (err: any) {
      failed++
      // 410 = subscription expirada
      if (err.statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  
  return { sent, failed }
}

export async function sendPushToTenant(
  tenantId: string,
  notification: PushNotification
): Promise<{ sent: number; failed: number }> {
  const db = getClient()
  
  const { data: users } = await db
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
  
  let totalSent = 0, totalFailed = 0
  
  for (const user of users || []) {
    const { sent, failed } = await sendPushToUser(user.id, notification)
    totalSent += sent
    totalFailed += failed
  }
  
  return { sent: totalSent, failed: totalFailed }
}
```

### 5.4: API para suscribirse (~1h)

```typescript
// app/api/push/subscribe/route.ts
import { auth } from '@/lib/auth/config'
import { getClient } from '@/lib/supabase/client'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { endpoint, keys } = await request.json()
  
  const db = getClient()
  
  // Upsert subscription
  await db.from('push_subscriptions').upsert({
    user_id: session.user.id,
    tenant_id: session.user.tenantId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, {
    onConflict: 'user_id,endpoint'
  })
  
  return Response.json({ success: true })
}
```

### 5.5: Hook para activar notificaciones (~1h)

```typescript
// lib/hooks/use-push-notifications.ts
'use client'

import { useState, useEffect } from 'react'

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])
  
  async function subscribe() {
    // 1. Pedir permiso
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm !== 'granted') return false
    
    // 2. Registrar service worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    
    // 3. Obtener subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    })
    
    // 4. Enviar a backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON())
    })
    
    setIsSubscribed(true)
    return true
  }
  
  return { permission, isSubscribed, subscribe }
}
```

### 5.6: UI para activar (~30 min)

```tsx
// components/PushNotificationToggle.tsx
'use client'

import { usePushNotifications } from '@/lib/hooks/use-push-notifications'

export function PushNotificationToggle() {
  const { permission, isSubscribed, subscribe } = usePushNotifications()
  
  if (permission === 'denied') {
    return <span className="text-sm text-gray-500">Notificaciones bloqueadas</span>
  }
  
  if (isSubscribed) {
    return <span className="text-sm text-green-600">🔔 Notificaciones activas</span>
  }
  
  return (
    <button 
      onClick={subscribe}
      className="text-sm text-purple-600 hover:underline"
    >
      🔔 Activar notificaciones
    </button>
  )
}
```

---

## F6: BRIEFINGS MATUTINOS

### 6.1: Tabla de configuración (~30 min)

```sql
-- supabase/migrations/320_briefing_config.sql
CREATE TABLE IF NOT EXISTS user_briefing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  is_enabled BOOLEAN DEFAULT true,
  send_time TIME DEFAULT '07:30:00',  -- Hora local del usuario
  timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  
  -- Qué incluir
  include_sales BOOLEAN DEFAULT true,
  include_receivables BOOLEAN DEFAULT true,
  include_stock_alerts BOOLEAN DEFAULT true,
  include_pending_orders BOOLEAN DEFAULT false,
  
  last_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

### 6.2: Generador de briefing (~2h)

```typescript
// lib/briefings/generator.ts (~100 líneas)

import { getCredentials } from '@/lib/skills/odoo/_client'
import { getSalesTotal } from '@/lib/skills/odoo/get-sales-total'
import { getAccountsReceivable } from '@/lib/skills/odoo/get-accounts-receivable'
import { getLowStockProducts } from '@/lib/skills/odoo/get-low-stock-products'

export interface BriefingData {
  salesYesterday?: { total: number; count: number }
  receivables?: { overdue: number; overdueCount: number }
  lowStock?: { products: string[]; count: number }
}

export async function generateBriefingData(
  tenantId: string,
  userId: string,
  config: { include_sales: boolean; include_receivables: boolean; include_stock_alerts: boolean }
): Promise<BriefingData> {
  const credentials = await getCredentials(tenantId)
  if (!credentials) return {}
  
  const ctx = { tenantId, userId, credentials: { odoo: credentials } }
  const data: BriefingData = {}
  
  // Ventas de ayer
  if (config.include_sales) {
    const result = await getSalesTotal.execute({ period: { start: 'yesterday', end: 'yesterday' } }, ctx)
    if (result.success) {
      data.salesYesterday = { total: result.data.totalWithTax, count: result.data.orderCount }
    }
  }
  
  // Cuentas por cobrar vencidas
  if (config.include_receivables) {
    const result = await getAccountsReceivable.execute({ state: 'overdue' }, ctx)
    if (result.success) {
      data.receivables = { overdue: result.data.totalOverdue, overdueCount: result.data.overdueCount }
    }
  }
  
  // Stock bajo
  if (config.include_stock_alerts) {
    const result = await getLowStockProducts.execute({ threshold: 10 }, ctx)
    if (result.success && result.data.products.length > 0) {
      data.lowStock = {
        products: result.data.products.slice(0, 3).map(p => p.name),
        count: result.data.products.length
      }
    }
  }
  
  return data
}

export function formatBriefingText(data: BriefingData, userName?: string): string {
  const lines: string[] = []
  
  lines.push(`🌅 Buenos días${userName ? `, ${userName}` : ''}!`)
  lines.push('')
  
  if (data.salesYesterday) {
    const formatted = new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(data.salesYesterday.total)
    lines.push(`📊 Ayer vendiste ${formatted} (${data.salesYesterday.count} pedidos)`)
  }
  
  if (data.receivables && data.receivables.overdue > 0) {
    const formatted = new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(data.receivables.overdue)
    lines.push(`⚠️ ${data.receivables.overdueCount} facturas vencidas por ${formatted}`)
  }
  
  if (data.lowStock && data.lowStock.count > 0) {
    lines.push(`📦 Stock bajo en: ${data.lowStock.products.join(', ')}`)
    if (data.lowStock.count > 3) {
      lines.push(`   (+${data.lowStock.count - 3} más)`)
    }
  }
  
  if (lines.length === 2) {
    lines.push('✨ Todo tranquilo por ahora')
  }
  
  return lines.join('\n')
}
```

### 6.3: Cron de briefings (~1h)

```typescript
// app/api/cron/briefings/route.ts

import { getClient } from '@/lib/supabase/client'
import { generateBriefingData, formatBriefingText } from '@/lib/briefings/generator'
import { sendPushToUser } from '@/lib/push/sender'

export async function GET(request: Request) {
  // Verificar cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const db = getClient()
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  
  // Buscar usuarios que les toca briefing ahora (ventana de 15 min)
  const { data: configs } = await db
    .from('user_briefing_config')
    .select(`
      *,
      users!inner(id, name, tenant_id)
    `)
    .eq('is_enabled', true)
    .or(`last_sent_at.is.null,last_sent_at.lt.${new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()}`)
  
  let sent = 0
  
  for (const config of configs || []) {
    const [hour, minute] = config.send_time.split(':').map(Number)
    
    // Verificar si es la hora (con ventana de 15 min)
    if (currentHour !== hour) continue
    if (Math.abs(currentMinute - minute) > 15) continue
    
    try {
      // Generar data
      const data = await generateBriefingData(
        config.users.tenant_id,
        config.users.id,
        config
      )
      
      // Formatear
      const text = formatBriefingText(data, config.users.name?.split(' ')[0])
      
      // Enviar push
      await sendPushToUser(config.users.id, {
        title: '🌅 Tu briefing de hoy',
        body: text.split('\n').slice(2, 4).join(' '),  // Resumen corto
        url: '/'
      })
      
      // Marcar como enviado
      await db
        .from('user_briefing_config')
        .update({ last_sent_at: now.toISOString() })
        .eq('id', config.id)
      
      sent++
    } catch (err) {
      console.error(`Error sending briefing to ${config.users.id}:`, err)
    }
  }
  
  return Response.json({ 
    status: 'ok',
    briefings_sent: sent,
    timestamp: now.toISOString()
  })
}
```

### 6.4: Configurar cron en Vercel (~10 min)

```json
// vercel.json — agregar al existente
{
  "crons": [
    {
      "path": "/api/cron/briefings",
      "schedule": "*/15 7-9 * * *"
    }
  ]
}
```

### 6.5: UI simple para configurar (~1h)

```tsx
// components/BriefingSettings.tsx
export function BriefingSettings() {
  const [config, setConfig] = useState({
    is_enabled: true,
    send_time: '07:30',
    include_sales: true,
    include_receivables: true,
    include_stock_alerts: true
  })
  
  return (
    <div className="space-y-4">
      <h3 className="font-medium">Briefing Matutino</h3>
      
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={config.is_enabled} onChange={...} />
        Recibir briefing diario
      </label>
      
      {config.is_enabled && (
        <>
          <div>
            <label>Hora de envío</label>
            <input type="time" value={config.send_time} onChange={...} />
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.include_sales} onChange={...} />
              📊 Ventas de ayer
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.include_receivables} onChange={...} />
              ⚠️ Facturas vencidas
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.include_stock_alerts} onChange={...} />
              📦 Alertas de stock
            </label>
          </div>
        </>
      )}
      
      <button onClick={save}>Guardar</button>
    </div>
  )
}
```
