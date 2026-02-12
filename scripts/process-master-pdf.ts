/**
 * Script para procesar un PDF y cargarlo como master document
 * 
 * Uso:
 *   npx tsx scripts/process-master-pdf.ts <pdf-path> <master-agent-slug> [title]
 * 
 * Ejemplo:
 *   npx tsx scripts/process-master-pdf.ts tuqui-rag-pdfs/ley-sociedades-19550.pdf contador "Ley de Sociedades 19.550"
 */

import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

// Load env
config({ path: '.env.local' })

import { getClient } from '@/lib/supabase/client'
import { processMasterDocument, linkDocumentToAgent } from '@/lib/rag/master-documents'

// Simple PDF text extraction (copied from admin/rag/actions.ts)
function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const uint8Array = new Uint8Array(buffer)
    const pdf = await pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true
    }).promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }

    return cleanText(fullText)
  } catch (e: any) {
    console.error('[PDF] pdfjs-dist error:', e.message)
  }

  // Fallback: pdf-parse
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return cleanText(data.text)
}

async function getMasterAgentId(slug: string): Promise<string> {
  const db = getClient()
  const { data, error } = await db
    .from('master_agents')
    .select('id')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    throw new Error(`Master agent "${slug}" not found: ${error?.message}`)
  }
  return data.id
}

async function main() {
  const [, , pdfPath, agentSlug, customTitle] = process.argv

  if (!pdfPath || !agentSlug) {
    console.error('Uso: npx tsx scripts/process-master-pdf.ts <pdf-path> <master-agent-slug> [title]')
    console.error('Ejemplo: npx tsx scripts/process-master-pdf.ts tuqui-rag-pdfs/ley-sociedades-19550.pdf contador "Ley de Sociedades"')
    process.exit(1)
  }

  const absolutePath = path.resolve(pdfPath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${absolutePath}`)
    process.exit(1)
  }

  const fileName = path.basename(pdfPath)
  const title = customTitle || fileName.replace(/\.pdf$/i, '').replace(/-/g, ' ')

  console.log(`\n📄 Processing: ${fileName}`)
  console.log(`🤖 Agent: ${agentSlug}`)
  console.log(`📝 Title: ${title}\n`)

  // 1. Extract text from PDF
  console.log('1️⃣  Extracting text from PDF...')
  const buffer = fs.readFileSync(absolutePath)
  const text = await extractPdfText(buffer)
  console.log(`   ✅ Extracted ${text.length} characters`)

  if (text.length < 100) {
    console.error('   ❌ Too little text extracted. Is this a scanned PDF?')
    process.exit(1)
  }

  // 2. Get master agent ID
  console.log(`2️⃣  Looking up master agent "${agentSlug}"...`)
  const masterAgentId = await getMasterAgentId(agentSlug)
  console.log(`   ✅ Found: ${masterAgentId}`)

  // 3. Process document (chunk + embed + store)
  console.log('3️⃣  Processing document (chunk + embed)...')
  const docId = await processMasterDocument({
    title,
    content: text,
    sourceType: 'file',
    fileName,
    metadata: { originalPath: pdfPath, processedAt: new Date().toISOString() }
  })
  console.log(`   ✅ Document created: ${docId}`)

  // 4. Link to master agent
  console.log(`4️⃣  Linking to master agent "${agentSlug}"...`)
  await linkDocumentToAgent(docId, masterAgentId)
  console.log(`   ✅ Linked!`)

  console.log(`\n🎉 Done! Document "${title}" is now available for all tenants with agent "${agentSlug}"`)
  console.log(`   ID: ${docId}`)
}

main().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
