/**
 * PDF text extraction — shared between tenant RAG and master documents
 * 
 * Uses pdf-parse/lib/pdf-parse.js (skips test file init bug in Vercel serverless)
 * Falls back to pdfjs-dist, then raw buffer extraction
 */

function cleanText(text: string): string {
    return text
        .replace(/\u0000/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
    // Primary: pdf-parse (import internal module to skip test file issue in serverless)
    try {
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
        const data = await pdfParse(buffer)
        if (data.text && data.text.length > 50) {
            console.log(`[PDF] pdf-parse OK: ${data.text.length} chars, ${data.numpages} pages`)
            return cleanText(data.text)
        }
    } catch (e: any) {
        console.error('[PDF] pdf-parse error:', e.message)
    }

    // Fallback: pdfjs-dist
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
            const pageText = textContent.items.map((item: any) => item.str).join(' ')
            fullText += pageText + '\n'
        }

        if (fullText.trim().length > 50) {
            console.log(`[PDF] pdfjs-dist OK: ${fullText.length} chars`)
            return cleanText(fullText)
        }
    } catch (e: any) {
        console.error('[PDF] pdfjs-dist error:', e.message)
    }

    // Last resort: raw text extraction from PDF buffer
    try {
        const text = buffer.toString('latin1')
        const parenMatches = text.match(/\(([^)]{2,100})\)/g)
        if (parenMatches && parenMatches.length > 20) {
            const extracted = parenMatches.map(m => m.slice(1, -1)).join(' ')
            return cleanText(extracted)
        }
    } catch (e) {
        console.error('[PDF] Raw extraction failed:', e)
    }

    throw new Error('Could not extract text from PDF. Try converting to .txt first.')
}

export { cleanText }
