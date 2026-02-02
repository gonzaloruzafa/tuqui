import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

// Use explicit API key configuration
const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})

// Using gemini-embedding-001 (text-embedding-004 was deprecated)
const EMBEDDING_MODEL = 'gemini-embedding-001'

// Rate limiting configuration for Gemini API
// Free tier: 1500 requests/min, Paid: higher limits
const BATCH_SIZE = 100
const DELAY_BETWEEN_BATCHES_MS = 1500  // 1.5 seconds between batches
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY_MS = 2000    // Start with 2 second delay

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Exponential backoff with jitter
function getRetryDelay(attempt: number): number {
    const exponentialDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
    const jitter = Math.random() * 1000  // Add up to 1 second of jitter
    return exponentialDelay + jitter
}

export async function generateEmbedding(text: string) {
    const { embedding } = await embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: text,
    })
    return embedding
}

// Process a single batch with retry logic
async function processBatchWithRetry(
    batch: string[],
    batchNumber: number,
    totalBatches: number
): Promise<number[][]> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const { embeddings } = await embedMany({
                model: google.textEmbeddingModel(EMBEDDING_MODEL),
                values: batch,
            })
            return embeddings
        } catch (error: any) {
            lastError = error
            const isRateLimitError = error?.statusCode === 429 || 
                error?.lastError?.statusCode === 429 ||
                error?.message?.includes('quota') ||
                error?.message?.includes('RESOURCE_EXHAUSTED')
            
            if (isRateLimitError && attempt < MAX_RETRIES - 1) {
                const retryDelay = getRetryDelay(attempt)
                console.log(`[RAG] Rate limit hit on batch ${batchNumber}/${totalBatches}, waiting ${Math.round(retryDelay/1000)}s before retry ${attempt + 2}/${MAX_RETRIES}`)
                await delay(retryDelay)
            } else if (!isRateLimitError) {
                // Non-rate-limit error, don't retry
                throw error
            }
        }
    }
    
    throw lastError || new Error('Max retries exceeded')
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    // If within batch limit, process all at once
    if (texts.length <= BATCH_SIZE) {
        const { embeddings } = await embedMany({
            model: google.textEmbeddingModel(EMBEDDING_MODEL),
            values: texts,
        })
        return embeddings
    }

    // Process in batches with rate limiting
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE)
    console.log(`[RAG] Processing ${texts.length} embeddings in ${totalBatches} batches of ${BATCH_SIZE}`)
    const allEmbeddings: number[][] = []
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        
        console.log(`[RAG] Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`)
        
        const embeddings = await processBatchWithRetry(batch, batchNumber, totalBatches)
        allEmbeddings.push(...embeddings)
        
        // Add delay between batches to avoid rate limiting (except for last batch)
        if (i + BATCH_SIZE < texts.length) {
            await delay(DELAY_BETWEEN_BATCHES_MS)
        }
    }
    
    console.log(`[RAG] Completed all ${allEmbeddings.length} embeddings`)
    return allEmbeddings
}
