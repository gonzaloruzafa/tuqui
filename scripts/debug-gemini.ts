
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('ERROR: GEMINI_API_KEY is missing.');
        process.exit(1);
    }

    const google = createGoogleGenerativeAI({
        apiKey: apiKey,
    });

    const modelName = 'gemini-2.0-flash';
    console.log(`Testing model: ${modelName}...`);
    try {
        const result = await generateText({
            model: google(modelName),
            prompt: 'Hello',
        });
        console.log(`SUCCESS with ${modelName}:`, result.text);
    } catch (error: any) {
        console.error(`FAILED with ${modelName}:`, error.message);
    }
}

main();
