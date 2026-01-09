#!/usr/bin/env node
/**
 * Test de Validación: Serper.dev para MeLi Links Directos
 *
 * Valida que Serper.dev devuelva links directos a productos (no listados)
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

interface TestCase {
    product: string
    expectedKeywords: string[]
}

const TEST_CASES: TestCase[] = [
    { product: 'sillón odontológico', expectedKeywords: ['sillón', 'odontológico'] },
    { product: 'autoclave 18 litros', expectedKeywords: ['autoclave', '18'] },
    { product: 'compresor odontológico silencioso', expectedKeywords: ['compresor', 'silencioso'] }
]

async function testSerper(product: string): Promise<any> {
    const SERPER_API_KEY = process.env.SERPER_API_KEY

    if (!SERPER_API_KEY) {
        throw new Error('SERPER_API_KEY no configurada en .env.local')
    }

    const query = `${product} site:articulo.mercadolibre.com.ar OR site:mercadolibre.com.ar/p/`

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🧪 TEST: ${product}`)
    console.log(`📝 Query: ${query}`)
    console.log('='.repeat(80))

    try {
        const res = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                num: 5,
                gl: 'ar',
                hl: 'es'
            })
        })

        if (!res.ok) {
            const error = await res.text()
            throw new Error(`Serper API error (${res.status}): ${error}`)
        }

        const data = await res.json()
        const sources = (data.organic || []).map((r: any) => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet
        }))

        console.log(`\n📊 Resultados: ${sources.length} productos encontrados\n`)

        // Analizar links
        let directLinks = 0
        let listingLinks = 0

        sources.forEach((s: any, i: number) => {
            const isDirect = s.url.includes('/articulo') || s.url.includes('/MLA-') || s.url.includes('/p/')
            const isListing = s.url.includes('/listado')

            if (isDirect) {
                directLinks++
                console.log(`   ✅ [${i+1}] DIRECTO: ${s.title}`)
                console.log(`       ${s.url}`)
            } else if (isListing) {
                listingLinks++
                console.log(`   ❌ [${i+1}] LISTADO: ${s.title}`)
                console.log(`       ${s.url}`)
            } else {
                console.log(`   ⚠️  [${i+1}] OTRO: ${s.title}`)
                console.log(`       ${s.url}`)
            }
        })

        // Validaciones
        const pass = directLinks >= 3 && listingLinks === 0

        console.log(`\n📈 ESTADÍSTICAS:`)
        console.log(`   Links directos: ${directLinks}/${sources.length}`)
        console.log(`   Links de listado: ${listingLinks}/${sources.length}`)
        console.log(`   Otros: ${sources.length - directLinks - listingLinks}/${sources.length}`)

        console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'}: ${product}`)

        return {
            product,
            pass,
            directLinks,
            listingLinks,
            totalLinks: sources.length,
            sources
        }

    } catch (err: any) {
        console.error(`\n❌ ERROR: ${err.message}`)
        return {
            product,
            pass: false,
            error: err.message
        }
    }
}

async function main() {
    console.log('🔍 VALIDACIÓN: Serper.dev para MeLi Links Directos')
    console.log(`📍 API: https://google.serper.dev`)
    console.log(`🔑 API Key: ${process.env.SERPER_API_KEY ? '✓ Configurada' : '✗ NO configurada'}\n`)

    if (!process.env.SERPER_API_KEY) {
        console.error('❌ ERROR: SERPER_API_KEY no configurada')
        console.error('Agregar a .env.local: SERPER_API_KEY=your_key_here')
        process.exit(1)
    }

    const results = []

    for (const testCase of TEST_CASES) {
        const result = await testSerper(testCase.product)
        results.push(result)

        // Delay entre queries
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Resumen final
    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMEN FINAL')
    console.log('='.repeat(80))

    const passed = results.filter(r => r.pass).length
    const failed = results.filter(r => !r.pass).length
    const successRate = (passed / results.length * 100).toFixed(1)

    results.forEach(r => {
        const status = r.pass ? '✅ PASS' : '❌ FAIL'
        console.log(`${status} ${r.product}`)
        if (r.directLinks !== undefined) {
            console.log(`        Links directos: ${r.directLinks}/${r.totalLinks}`)
            if (r.listingLinks > 0) {
                console.log(`        ⚠️  Links de listado: ${r.listingLinks}`)
            }
        }
        if (r.error) {
            console.log(`        Error: ${r.error}`)
        }
    })

    console.log(`\n🎯 Success Rate: ${successRate}% (${passed}/${results.length})`)

    if (successRate === '100.0') {
        console.log('\n✅ ÉXITO TOTAL: Serper.dev funcionando perfectamente')
        console.log('   - Links directos a productos ✅')
        console.log('   - Sin links de listado ✅')
        console.log('   - Listo para producción ✅')
    } else if (parseFloat(successRate) >= 66) {
        console.log(`\n⚠️  PARCIAL: ${passed}/${results.length} tests pasaron`)
        console.log('   - Serper funciona pero puede necesitar ajustes')
    } else {
        console.log(`\n❌ CRÍTICO: Solo ${passed}/${results.length} tests pasaron`)
        console.log('   - Revisar configuración de Serper')
        console.log('   - Verificar site: filter en queries')
    }

    // Guardar resultados
    const fs = require('fs')
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const outputPath = path.join(__dirname, 'e2e-tests/results', `serper-validation-${timestamp}.json`)

    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        successRate: parseFloat(successRate),
        passed,
        failed,
        total: results.length,
        results
    }, null, 2))

    console.log(`\n💾 Resultados guardados: ${outputPath}`)

    process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)
