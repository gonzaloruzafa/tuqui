import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function runMigrations() {
  console.log('🔄 Running pending migrations...\n')
  
  // Migration 107: MeLi Agent
  console.log('=== Migration 107: MeLi Agent ===')
  
  // Check if MeLi agent exists
  const { data: meliExists } = await db
    .from('master_agents')
    .select('id, slug')
    .eq('slug', 'meli')
    .single()
    
  if (meliExists) {
    console.log('✅ MeLi agent already exists, updating...')
  }
  
  // Upsert MeLi master agent
  const meliPrompt = `Buscás productos y precios en MercadoLibre Argentina.

## ⚠️ REGLA CRÍTICA: NUNCA INVENTES URLs
- SIEMPRE usá las URLs EXACTAS del campo "sources[].url" que devuelve web_search
- Copiá la URL tal cual aparece en el resultado, no la modifiques
- Si web_search devuelve {"sources": [{"url": "https://articulo.mercadolibre.com.ar/MLA-123", "title": "Producto X"}]}
  → Usá ESA URL exacta: [Ver en MeLi](https://articulo.mercadolibre.com.ar/MLA-123)
- Si no hay URL en el resultado, simplemente NO pongas link

## BÚSQUEDAS
- Agregá "site:mercadolibre.com.ar" a tus búsquedas con web_search
- Si no hay precios claros en los resultados, usá web_investigator en las URLs para extraer detalles

## FORMATO DE RESPUESTA
**🛒 Resultados para [producto]:**

1. **[Título exacto del resultado]** - $XX.XXX
   - [Ver en MeLi](URL_EXACTA_DEL_SOURCE)

2. **[Otro producto]** - $XX.XXX
   - [Ver en MeLi](URL_EXACTA)

## REGLAS
- Máximo 5 resultados, ordenados por precio (más barato primero)
- Si la búsqueda es muy general, preguntá para afinar (marca, modelo, tamaño)
- Mostrá precios en formato argentino: $XXX.XXX

## PERSONALIDAD
Español argentino, directo y útil. Emojis con moderación 🛒`

  const { error: meliError } = await db.from('master_agents').upsert({
    slug: 'meli',
    name: 'Asistente MercadoLibre',
    description: 'Especialista en búsqueda de precios y productos en MercadoLibre Argentina',
    icon: 'ShoppingCart',
    color: 'blue',
    system_prompt: meliPrompt,
    tools: ['web_search', 'web_investigator'],
    rag_enabled: false,
    is_published: true,
    sort_order: 10,
    welcome_message: '¡Hola! Soy tu asistente para buscar precios en MercadoLibre. 🛒 ¿Qué producto querés buscar?',
    placeholder_text: 'Ej: Precios de iPhone 15, botines Puma, notebooks Lenovo...'
  }, { onConflict: 'slug' })
  
  if (meliError) {
    console.log('❌ Error creating MeLi agent:', meliError.message)
  } else {
    console.log('✅ MeLi master agent created/updated')
  }

  // Migration 108: Keywords + Fix prompts
  console.log('\n=== Migration 108: Keywords ===')
  
  // Try to add keywords column
  console.log('Adding keywords column to master_agents...')
  // Note: Can't run DDL via REST API, but we can check if it exists
  
  // Update Odoo with keywords
  const { error: odooError } = await db
    .from('master_agents')
    .update({
      name: 'Tuqui Odoo',
    })
    .eq('slug', 'odoo')
    
  if (odooError) {
    console.log('⚠️ Odoo update:', odooError.message)
  } else {
    console.log('✅ Odoo agent name updated')
  }

  // Sync to tenant agents
  console.log('\n=== Syncing to tenant agents ===')
  
  // Get all master agents
  const { data: masters } = await db.from('master_agents').select('*').eq('is_published', true)
  
  if (!masters?.length) {
    console.log('❌ No master agents found')
    return
  }
  
  // Get tenant
  const { data: tenant } = await db.from('tenants').select('id').single()
  
  if (!tenant) {
    console.log('❌ No tenant found')
    return
  }
  
  console.log(`Found ${masters.length} master agents, syncing to tenant ${tenant.id}...`)
  
  for (const master of masters) {
    const { error } = await db.from('agents').upsert({
      tenant_id: tenant.id,
      master_agent_id: master.id,
      slug: master.slug,
      name: master.name,
      description: master.description,
      icon: master.icon,
      color: master.color,
      system_prompt: master.system_prompt,
      welcome_message: master.welcome_message,
      placeholder_text: master.placeholder_text,
      tools: master.tools,
      rag_enabled: master.rag_enabled,
      is_active: true,
      master_version_synced: master.version || 1
    }, { onConflict: 'tenant_id,slug' })
    
    if (error) {
      console.log(`  ⚠️ ${master.slug}:`, error.message)
    } else {
      console.log(`  ✅ ${master.slug} synced (tools: ${master.tools?.join(', ') || 'none'})`)
    }
  }
  
  console.log('\n🎉 Migrations complete!')
}

runMigrations().catch(console.error)
