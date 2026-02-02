/**
 * API Keys Configuration
 * 
 * Centralizes API key access to handle legacy naming inconsistencies.
 * 
 * Historical note:
 * - Some code uses GEMINI_API_KEY
 * - Some code uses GOOGLE_GENERATIVE_AI_API_KEY
 * - Both refer to the same Google AI Studio key
 * 
 * This module provides a unified way to access these keys.
 */

/**
 * Get the Gemini API key from environment
 * Checks both naming conventions for backwards compatibility
 * 
 * @throws Error if neither key is configured
 */
export function getGeminiApiKey(): string {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!key) {
        throw new Error('Gemini API key not configured. Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY')
    }
    return key
}

/**
 * Check if Gemini API key is available
 */
export function hasGeminiApiKey(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

/**
 * Get Tavily API key for web search
 */
export function getTavilyApiKey(): string | undefined {
    return process.env.TAVILY_API_KEY
}

/**
 * Get Firecrawl API key for web scraping
 */
export function getFirecrawlApiKey(): string | undefined {
    return process.env.FIRECRAWL_API_KEY
}
