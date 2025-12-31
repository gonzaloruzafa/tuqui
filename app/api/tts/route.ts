import { NextResponse } from 'next/server'

const TTS_VOICE_CONFIG = {
    voiceName: 'Aoede', // Breezy - fresca y natural
}

const VOICE_DIRECTION = `
### DIRECTOR'S NOTES
Style: Warm, professional consultant with a friendly approachable tone. Like talking to a knowledgeable colleague who genuinely wants to help. Natural conversational style.

Pacing: SPEAK FASTER than normal - brisk and energetic pace, like an excited professional sharing insights. Keep the flow quick and dynamic. No pauses between sentences.

Accent: Latin American Spanish with Argentine flavor. Natural Buenos Aires urban accent.

### TRANSCRIPT
`

export async function POST(req: Request) {
    try {
        const { text } = await req.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
        }

        console.log(`[TTS] Generating audio for: "${text.substring(0, 50)}..."`)

        // Clear HTML and prepare text
        const cleanText = text
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n+/g, '. ')
            .replace(/\s+/g, ' ')
            .trim()

        const maxLength = 2000
        const truncatedText = cleanText.length > maxLength
            ? cleanText.substring(0, maxLength) + '...'
            : cleanText

        const prompt = VOICE_DIRECTION + truncatedText

        // Gemini TTS Restricted REST API
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: TTS_VOICE_CONFIG.voiceName,
                            }
                        }
                    }
                }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[TTS] API Error:', errorText)
            // Fallback to client-side speech if API fails
            return NextResponse.json({ fallback: true, text: truncatedText })
        }

        const data = await response.json()
        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

        if (!audioData) {
            return NextResponse.json({ fallback: true, text: truncatedText })
        }

        const pcmBuffer = Buffer.from(audioData, 'base64')

        // Add WAV header for 24kHz mono PCM 16-bit
        const sampleRate = 24000
        const numChannels = 1
        const bitsPerSample = 16
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
        const blockAlign = numChannels * (bitsPerSample / 8)
        const dataSize = pcmBuffer.length
        const fileSize = 36 + dataSize

        const wavHeader = Buffer.alloc(44)
        wavHeader.write('RIFF', 0)
        wavHeader.writeUInt32LE(fileSize, 4)
        wavHeader.write('WAVE', 8)
        wavHeader.write('fmt ', 12)
        wavHeader.writeUInt32LE(16, 16)
        wavHeader.writeUInt16LE(1, 20)
        wavHeader.writeUInt16LE(numChannels, 22)
        wavHeader.writeUInt32LE(sampleRate, 24)
        wavHeader.writeUInt32LE(byteRate, 28)
        wavHeader.writeUInt16LE(blockAlign, 32)
        wavHeader.writeUInt16LE(bitsPerSample, 34)
        wavHeader.write('data', 36)
        wavHeader.writeUInt32LE(dataSize, 40)

        const audioBuffer = Buffer.concat([wavHeader, pcmBuffer])

        return new Response(audioBuffer, {
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': audioBuffer.length.toString(),
            }
        })

    } catch (error: any) {
        console.error("[TTS] Error:", error.message)
        return NextResponse.json({ fallback: true, error: error.message }, { status: 200 })
    }
}
