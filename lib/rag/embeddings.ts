import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

// Use explicit API key configuration
const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})

// Using gemini-embedding-001 (text-embedding-004 was deprecated)
const EMBEDDING_MODEL = 'gemini-embedding-001'

export async function generateEmbedding(text: string) {
    const { embedding } = await embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: text,
    })
    return embedding
}

// Gemini API has a limit of 100 requests per batch
const BATCH_SIZE = 100

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    // If within batch limit, process all at once
    if (texts.length <= BATCH_SIZE) {
        const { embeddings } = await embedMany({
            model: google.textEmbeddingModel(EMBEDDING_MODEL),
            values: texts,
        })
        return embeddings
    }

    // Process in batches of 100
    console.log(`[RAG] Processing ${texts.length} embeddings in batches of ${BATCH_SIZE}`)
    const allEmbeddings: number[][] = []
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        const totalBatches = Math.ceil(texts.length / BATCH_SIZE)
        
        console.log(`[RAG] Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`)
        
        const { embeddings } = await embedMany({
            model: google.textEmbeddingModel(EMBEDDING_MODEL),
            values: batch,
        })
        
        allEmbeddings.push(...embeddings)
    }
    
    console.log(`[RAG] Completed all ${allEmbeddings.length} embeddings`)
    return allEmbeddings
}
