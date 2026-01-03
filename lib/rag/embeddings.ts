import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

// Use explicit API key configuration
const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})

export async function generateEmbedding(text: string) {
    const { embedding } = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: text,
    })
    return embedding
}

export async function generateEmbeddings(texts: string[]) {
    const { embeddings } = await embedMany({
        model: google.textEmbeddingModel('text-embedding-004'),
        values: texts,
    })
    return embeddings
}
