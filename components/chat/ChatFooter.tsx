'use client'

import React, { memo, useRef, useEffect, useState } from 'react'
import { Mic, ArrowUp, AudioLines, X, Check } from 'lucide-react'

// Real-time Scrolling Temporal Waveform for Voice Input
const AudioVisualizer = memo(({ isRecording }: { isRecording: boolean }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number | null>(null)
    const historyRef = useRef<number[]>(new Array(100).fill(0))
    const frameCountRef = useRef(0)

    useEffect(() => {
        if (!isRecording) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
            return
        }

        const draw = () => {
            if (!canvasRef.current) return
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const width = canvas.width
            const height = canvas.height

            animationRef.current = requestAnimationFrame(draw)

            frameCountRef.current++
            if (frameCountRef.current % 4 === 0) {
                const t = Date.now() / 1000
                const wave = Math.sin(t * 3) * 0.5 + 0.5
                const randomVariation = Math.random() * 0.3
                const average = (wave * 80 + randomVariation * 40) + 30

                historyRef.current.shift()
                historyRef.current.push(average)
            }

            ctx.clearRect(0, 0, width, height)

            const barWidth = 0.8
            const gap = 2.5
            const totalBarWidth = barWidth + gap
            const barsToDraw = historyRef.current.length

            ctx.fillStyle = '#a78bfa'

            for (let i = 0; i < barsToDraw; i++) {
                const vol = historyRef.current[i]
                const barHeight = Math.max(1, (vol / 160) * height * 0.6)

                const x = i * totalBarWidth
                const y = (height - barHeight) / 2

                ctx.beginPath()
                ctx.roundRect(x, y, barWidth, barHeight, 0.4)
                ctx.fill()
            }
        }

        draw()
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
        }
    }, [isRecording])

    return (
        <canvas
            ref={canvasRef}
            width={330}
            height={32}
            className="w-full h-8 rounded"
        />
    )
})
AudioVisualizer.displayName = 'AudioVisualizer'

interface ChatFooterProps {
    input: string
    setInput: (value: string) => void
    handleSend: () => void
    isLoading: boolean
    isRecording: boolean
    recognition: boolean
    startRecording: () => void
    cancelRecording: () => void
    confirmRecording: () => void
    setIsVoiceOpen: (open: boolean) => void
    agents?: { slug: string; name: string }[]
}

export function ChatFooter({
    input,
    setInput,
    handleSend,
    isLoading,
    isRecording,
    recognition,
    startRecording,
    cancelRecording,
    confirmRecording,
    setIsVoiceOpen,
    agents = [],
}: ChatFooterProps) {
    const [showMentions, setShowMentions] = useState(false)
    const [mentionFilter, setMentionFilter] = useState('')
    const [selectedIdx, setSelectedIdx] = useState(0)

    // Detect @mention typing
    const handleInputChange = (value: string) => {
        setInput(value)
        const match = value.match(/^@([a-z0-9_-]*)$/)
        if (match && agents.length > 0) {
            setMentionFilter(match[1])
            setShowMentions(true)
            setSelectedIdx(0)
        } else {
            setShowMentions(false)
        }
    }

    const filteredAgents = agents.filter(a =>
        a.slug.includes(mentionFilter) || a.name.toLowerCase().includes(mentionFilter)
    )

    const selectMention = (slug: string) => {
        setInput(`@${slug} `)
        setShowMentions(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions && filteredAgents.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filteredAgents.length - 1)); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return }
            if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); selectMention(filteredAgents[selectedIdx].slug); return }
            if (e.key === 'Escape') { setShowMentions(false); return }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }
    return (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <div className="h-8 bg-gradient-to-t from-white to-transparent" />
            <div className="bg-white/80 backdrop-blur-md pb-[env(safe-area-inset-bottom,8px)] px-3 md:px-6 pb-3 md:pb-6 pointer-events-auto">
                <div className="max-w-3xl mx-auto">
                    {isRecording ? (
                        <div className="w-full bg-gray-50 border border-adhoc-violet/30 rounded-full px-4 py-2 flex items-center gap-3 animate-in fade-in zoom-in duration-300 shadow-sm">
                            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                <AudioVisualizer isRecording={isRecording} />
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={cancelRecording}
                                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Cancelar"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={confirmRecording}
                                    className="p-2 bg-adhoc-violet text-white rounded-full hover:bg-adhoc-violet/90 shadow-sm transition-all"
                                    title="Terminar y revisar"
                                >
                                    <Check className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-[24px] focus-within:border-adhoc-violet focus-within:ring-1 focus-within:ring-adhoc-violet/20 focus-within:bg-white transition-all p-1.5 px-3 group shadow-sm">
                            {/* @mention autocomplete */}
                            {showMentions && filteredAgents.length > 0 && (
                                <div className="absolute bottom-full left-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30 min-w-[200px]">
                                    {filteredAgents.map((a, idx) => (
                                        <button
                                            key={a.slug}
                                            onClick={() => selectMention(a.slug)}
                                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                                                idx === selectedIdx ? 'bg-adhoc-lavender/30 text-adhoc-violet' : 'hover:bg-gray-50 text-gray-700'
                                            }`}
                                        >
                                            <span className="font-mono text-xs text-gray-400">@</span>
                                            <span className="font-medium">{a.name}</span>
                                            <span className="text-xs text-gray-400 ml-auto">{a.slug}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <textarea
                                value={input}
                                onChange={e => handleInputChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Preguntale a Tuqui — escribí @ para elegir agente"
                                className="flex-1 bg-transparent border-none rounded-2xl pl-2 pr-2 py-2.5 resize-none focus:outline-none min-h-[44px] max-h-[200px] text-[16px] leading-relaxed w-0"
                                rows={1}
                            />
                            <div className="flex items-center gap-1 pb-1">
                                {recognition && (
                                    <button
                                        onClick={startRecording}
                                        className="p-2 text-gray-400 hover:text-adhoc-violet hover:bg-adhoc-lavender/20 rounded-full transition-all"
                                        title="Dictar mensaje"
                                    >
                                        <Mic className="w-5 h-5" />
                                    </button>
                                )}
                                {input.trim().length > 0 ? (
                                    <button
                                        onClick={handleSend}
                                        disabled={isLoading}
                                        className="p-2 bg-adhoc-violet text-white rounded-full hover:bg-adhoc-violet/90 shadow-sm transition-all disabled:opacity-50"
                                        title="Enviar mensaje"
                                    >
                                        <ArrowUp className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsVoiceOpen(true)}
                                        className="p-2 bg-adhoc-coral text-white rounded-full hover:bg-adhoc-coral/90 shadow-sm transition-all flex items-center justify-center animate-in zoom-in duration-300"
                                        title="Voz en tiempo real"
                                    >
                                        <AudioLines className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <p className="text-center text-[10px] text-gray-400 mt-2">Tuqui puede cometer errores.</p>
                </div>
            </div>
        </div>
    )
}
