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

export async function generateEmbeddings(texts: string[]) {
    const { embeddings } = await embedMany({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        values: texts,
    })
    return embeddings
}
