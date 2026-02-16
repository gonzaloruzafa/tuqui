'use client'

import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
    Send, Loader2, ArrowLeft, ArrowUp,
    Scale, Users, Briefcase, HeadphonesIcon,
    Bot, Brain, Code, Lightbulb, MessageSquare, Sparkles,
    GraduationCap, Heart, ShoppingCart, TrendingUp, Wrench,
    FileText, Calculator, Globe, Shield, Zap, Mail, Copy,
    PanelLeftClose, PanelLeft, Search, Database, Mic, MicOff, Check, X,
    AudioLines, Settings
} from 'lucide-react'
import { marked } from 'marked'
import { useDictation } from '@/lib/hooks/useDictation'
import { parseMention } from '@/lib/chat/parse-mention'
import { VoiceChat } from '@/components/chat/VoiceChat'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatFooter } from '@/components/chat/ChatFooter'
import { ExecutionProgress } from '@/components/chat/ExecutionProgress'
import { ToolBadge } from '@/components/chat/ToolBadge'
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator'
import { MessageSources } from '@/components/chat/MessageSources'
import { MeliSkillsRenderer } from '@/components/chat/MeliSkillsRenderer'
import type { ThinkingStep, ThinkingSource } from '@/lib/thinking/types'

// Configure marked to open external links in new tab
const renderer = new marked.Renderer()
const originalLinkRenderer = renderer.link.bind(renderer)
renderer.link = function(link: any) {
    const { href, title, tokens } = link
    const text = this.parser.parseInline(tokens)
    const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'))
    if (isExternal) {
        const titleAttr = title ? ` title="${title}"` : ''
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`
    }
    return originalLinkRenderer(link)
}
marked.setOptions({ renderer })

// Helper to wrap tables in scrollable div
function wrapTablesInScrollContainer(html: string): string {
    return html.replace(/<table>/g, '<div class="table-wrapper"><table>')
        .replace(/<\/table>/g, '</table></div>')
}

// AudioVisualizer moved to @/components/chat/ChatFooter

/**
 * Wrapper for ThinkingStream in completed messages - has its own toggle state
 */
interface TuquiCapability {
    icon: string
    title: string
    description: string
    examples: string[]
}

interface Agent {
    id: string
    name: string
    slug: string
    icon: string
    welcome_message: string
    placeholder_text: string
    system_prompt?: string
    description?: string
    tools: string[]
    rag_enabled: boolean
    capabilities?: TuquiCapability[]
}

interface Message {
    id: string | number
    role: 'user' | 'assistant'
    content: string
    rawContent?: string
    sources?: ThinkingSource[]  // Sources used (for ToolBadge display)
    agentName?: string  // Agent that responded (for attribution)
}

interface Session {
    id: string
    title: string
    agent_id: string
}

const getAgentIcon = (iconName: string, size: 'sm' | 'md' | 'lg' = 'sm', colorClass = 'text-white') => {
    const sizeClass = size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
    const icons: Record<string, React.ReactNode> = {
        'Scale': <Scale className={`${sizeClass} ${colorClass}`} />,
        'Users': <Users className={`${sizeClass} ${colorClass}`} />,
        'Bot': <Bot className={`${sizeClass} ${colorClass}`} />,
        'ShoppingCart': <ShoppingCart className={`${sizeClass} ${colorClass}`} />,
        'Database': <Database className={`${sizeClass} ${colorClass}`} />,
        'Calculator': <Calculator className={`${sizeClass} ${colorClass}`} />,
        'Building': <Briefcase className={`${sizeClass} ${colorClass}`} />,
        'Sparkles': <Sparkles className={`${sizeClass} ${colorClass}`} />
    }
    return icons[iconName] || <Bot className={`${sizeClass} ${colorClass}`} />
}

export default function ChatPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const agentSlug = params.slug as string
    const sessionIdParam = searchParams.get('session')

    const [agent, setAgent] = useState<Agent | null | undefined>(undefined) // undefined = loading, null = not found
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [currentStep, setCurrentStep] = useState<ThinkingStep | null>(null) // Current executing step
    const [usedSources, setUsedSources] = useState<ThinkingSource[]>([]) // Sources for final badge
    const [respondedAgent, setRespondedAgent] = useState<string | undefined>(undefined)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionIdParam)
    const dictation = useDictation('es-AR')
    const [isVoiceOpen, setIsVoiceOpen] = useState(false)
    const [allAgents, setAllAgents] = useState<{ slug: string; name: string }[]>([])

    const confirmRecording = () => {
        const finalTranscript = dictation.confirm()
        if (finalTranscript) {
            setInput(prev => {
                const base = prev.trim()
                return base ? `${base} ${finalTranscript}` : finalTranscript
            })
        }
    }

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const lastUpdateRef = useRef<number>(0)
    const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null)

    // Auto open sidebar on desktop, keep closed on mobile
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setSidebarOpen(window.innerWidth >= 768)
        }
    }, [])

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setSidebarOpen(true)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Close sidebar on mobile when navigating
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false)
        }
    }, [agentSlug])

    // Load Agent
    useEffect(() => {
        fetch(`/api/agents?slug=${agentSlug}`)
            .then(res => {
                if (!res.ok) throw new Error('Agent not found')
                return res.json()
            })
            .then(data => setAgent(data))
            .catch(err => {
                console.error(err)
                setAgent(null)
            })
    }, [agentSlug])

    // Load all agents for @mention autocomplete
    useEffect(() => {
        fetch('/api/agents')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setAllAgents(data.map((a: any) => ({ slug: a.slug, name: a.name })))
            })
            .catch(() => {})
    }, [])

    // Load Sessions
    useEffect(() => {
        if (agent?.id) {
            fetch(`/api/chat-sessions?agentId=${agent.id}`)
                .then(res => res.ok ? res.json() : [])
                .then(data => setSessions(data))
                .catch(err => console.error('Error loading sessions:', err))
        }
    }, [agent?.id])

    // Load Messages
    useEffect(() => {
        if (sessionIdParam) {
            setCurrentSessionId(sessionIdParam)

            fetch(`/api/chat-sessions?sessionId=${sessionIdParam}`)
                .then(res => res.ok ? res.json() : [])
                .then(async (msgs: any[]) => {
                    const loaded: Message[] = []
                    for (const m of msgs) {
                        let content = m.content
                        if (m.role === 'assistant') {
                            content = wrapTablesInScrollContainer(await marked.parse(m.content))
                        }
                        // Load sources from tool_calls.sources (where we save them)
                        const sources = m.tool_calls?.sources || m.metadata?.sources || m.sources
                        loaded.push({ ...m, content, rawContent: m.content, sources })
                    }
                    setMessages(loaded)
                })
                .catch(err => console.error('Error loading messages:', err))
        } else {
            setMessages([])
            setCurrentSessionId(null)
        }
    }, [sessionIdParam])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || isLoading || !agent) return
        const userContent = input.trim()
        setInput('')

        // Parse @mention
        const availableSlugs = allAgents.map(a => a.slug)
        const { agentSlug: mentionedSlug, cleanMessage } = parseMention(userContent, availableSlugs)
        const messageToSend = mentionedSlug ? cleanMessage : userContent

        // Optimistic UI
        const tempUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userContent }
        setMessages(prev => [...prev, tempUserMsg])
        setIsLoading(true)
        
        // Clear state for NEW message (each message gets its own sources)
        setCurrentStep(null)
        setUsedSources([])
        setRespondedAgent(undefined)
        
        // Add temp bot message immediately to show loading state
        setMessages(prev => [...prev, { id: 'temp-bot', role: 'assistant', content: '' }])

        try {
            // Create session if needed
            let sid = currentSessionId
            let isNewSession = false
            if (!sid) {
                const res = await fetch('/api/chat-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create-session', agentId: agent.id })
                })
                if (!res.ok) throw new Error('Failed to create session')
                const session = await res.json()
                sid = session.id
                isNewSession = true
                
                // Update state but DON'T update URL yet (will do after streaming)
                setCurrentSessionId(sid)
            }

            // Save User Message
            await fetch('/api/chat-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save-message', sessionId: sid, role: 'user', content: userContent })
            })

            // Call AI
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentSlug,
                    messages: [...messages, tempUserMsg].map(m => ({
                        role: m.role,
                        content: m.rawContent || m.content
                    })),
                    sessionId: sid,
                    mentionedAgent: mentionedSlug || undefined
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                const errorMsg = errorData.error || 'API Error'
                const suggestion = errorData.suggestion
                const fullError = suggestion ? `${errorMsg}\n\n${suggestion}` : errorMsg
                throw new Error(fullError)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No reader available')

            let botText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = new TextDecoder().decode(value)
                
                // Check for thinking events (t:) first
                const lines = chunk.split('\n').filter(line => line.trim())
                let textChunk = ''
                
                for (const line of lines) {
                    if (line.startsWith('t:')) {
                        // Parse tool execution event
                        try {
                            const step = JSON.parse(line.slice(2)) as ThinkingStep
                            console.log('[Chat] 🔧 Tool step:', step.tool, step.status)
                            
                            // Update current step for ExecutionProgress display
                            setCurrentStep(step)
                            
                            // Collect source for final badge (check against current state, not stale closure)
                            if (step.source) {
                                setUsedSources(prev => {
                                    if (!prev.includes(step.source)) {
                                        return [...prev, step.source]
                                    }
                                    return prev
                                })
                            }
                            // Track agent name for attribution
                            if (step.agentName) {
                                setRespondedAgent(step.agentName)
                            }
                        } catch (e) {
                            console.warn('[Chat] Failed to parse tool event:', line)
                        }
                    } else if (line.startsWith('th:')) {
                        // Ignore thinking summary - we don't show it anymore
                        continue
                    } else {
                        textChunk += line + '\n'
                    }
                }
                
                // Process remaining text
                if (textChunk.trim()) {
                    const isDataStream = textChunk.match(/^[0-9a-z]:/m)

                    if (isDataStream) {
                        const dataLines = textChunk.split('\n').filter(l => l.trim())
                        for (const dataLine of dataLines) {
                            const match = dataLine.match(/^([0-9a-z]):(.*)$/)
                            if (match) {
                                const [_, type, content] = match
                                if (type === '0') {
                                    try {
                                        botText += JSON.parse(content)
                                    } catch (e) {
                                        botText += content.replace(/^"|"$/g, '')
                                    }
                                }
                            }
                        }
                    } else {
                        botText += textChunk
                    }
                }
                const displayText = botText
                
                // Debounced UI update - only parse markdown every 100ms to reduce re-renders
                if (displayText.trim()) {
                    const now = Date.now()
                    if (now - lastUpdateRef.current > 100) {
                        lastUpdateRef.current = now
                        if (pendingUpdateRef.current) {
                            clearTimeout(pendingUpdateRef.current)
                            pendingUpdateRef.current = null
                        }
                        const partialHtml = wrapTablesInScrollContainer(await marked.parse(displayText))
                        setMessages(prev => {
                            const last = prev[prev.length - 1]
                            if (last?.id === 'temp-bot') {
                                return [...prev.slice(0, -1), { ...last, content: partialHtml, rawContent: displayText }]
                            } else {
                                return [...prev, { id: 'temp-bot', role: 'assistant', content: partialHtml, rawContent: displayText }]
                            }
                        })
                    } else if (!pendingUpdateRef.current) {
                        // Schedule update for later
                        pendingUpdateRef.current = setTimeout(async () => {
                            pendingUpdateRef.current = null
                            lastUpdateRef.current = Date.now()
                            const html = wrapTablesInScrollContainer(await marked.parse(displayText))
                            setMessages(prev => {
                                const last = prev[prev.length - 1]
                                if (last?.id === 'temp-bot') {
                                    return [...prev.slice(0, -1), { ...last, content: html, rawContent: displayText }]
                                }
                                return prev
                            })
                        }, 100)
                    }
                }
            }

            // Final cleanup - remove thinking from saved/displayed text
            const finalText = botText
            const finalHtml = wrapTablesInScrollContainer(await marked.parse(finalText))
            
            // Capture sources from current state
            const capturedSources = [...usedSources]
            console.log('[Chat] 💾 Saving message with sources:', capturedSources)
            
            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== 'temp-bot')
                return [...filtered, { 
                    id: Date.now().toString(), 
                    role: 'assistant', 
                    content: finalHtml, 
                    rawContent: finalText,
                    sources: capturedSources.length > 0 ? capturedSources : undefined,
                    agentName: respondedAgent
                }]
            })

            // Save Bot Message (without thinking block) - include sources in tool_calls
            await fetch('/api/chat-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'save-message', 
                    sessionId: sid, 
                    role: 'assistant', 
                    content: finalText,
                    toolCalls: capturedSources.length > 0 ? { sources: capturedSources } : undefined
                })
            })

            // Update URL AFTER streaming completes (avoids race condition with useEffect)
            if (isNewSession && sid) {
                window.history.replaceState(null, '', `/chat/${agentSlug}?session=${sid}`)
            }

            // Generate title if it's the first message
            if (messages.length <= 1) {
                fetch('/api/chat-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'generate-title', sessionId: sid, userMessage: userContent })
                }).then(res => res.ok ? res.json() : null).then(data => {
                    if (data?.title) {
                        setSessions(prev => {
                            const exists = prev.find(s => s.id === sid)
                            if (exists) {
                                return prev.map(s => s.id === sid ? { ...s, title: data.title } : s)
                            } else {
                                return [{ id: sid!, title: data.title, agent_id: agent.id }, ...prev]
                            }
                        })
                    }
                })
            }

        } catch (e: any) {
            console.error(e)
            const errorMessage = e.message || 'No se pudo procesar el mensaje.'
            const errorHtml = await marked.parse(`**Error:**\n\n${errorMessage}`)
            setMessages(prev => [...prev.filter(m => m.id !== 'temp-bot'), { id: Date.now().toString(), role: 'assistant', content: errorHtml, rawContent: errorMessage }])
        } finally {
            setIsLoading(false)
            setCurrentStep(null) // Clear execution progress
        }
    }

    // Loading state
    if (agent === undefined) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-adhoc-violet" /></div>

    // Agent not found
    if (agent === null) {
        return (
            <div className="h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Bot className="w-16 h-16 text-gray-300" />
                    <h2 className="text-xl font-medium text-gray-700">Agente no encontrado</h2>
                    <p className="text-gray-500">El agente "{agentSlug}" no existe o no está disponible.</p>
                    <Link href="/" className="mt-4 px-4 py-2 bg-adhoc-violet text-white rounded-lg hover:bg-adhoc-violet/90 transition-colors">
                        Volver al inicio
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="h-[100dvh] flex bg-white overflow-hidden relative font-sans">

            {/* Sidebar */}
            <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed md:relative top-0 left-0 h-full z-40 bg-white flex flex-col transition-transform duration-300 ease-in-out border-r border-adhoc-lavender/30 w-[260px] shadow-xl md:shadow-none
      `}>
                <div className="p-3 flex items-center justify-center border-b border-gray-200/50 h-14 relative">
                    {/* Logo */}
                    <img src="/adhoc-logo.png" alt="Adhoc" className="h-6 w-auto" />

                    {/* Close Sidebar (Mobile only) */}
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden absolute right-3 p-1 text-gray-400 hover:text-gray-600">
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-3">
                    <button
                        onClick={() => {
                            router.push(`/chat/${agentSlug}`)
                            // Only close sidebar on mobile
                            if (window.innerWidth < 768) setSidebarOpen(false)
                        }}
                        className="w-full text-left px-3 py-3 text-base hover:bg-gray-100 rounded-xl flex gap-3 items-center transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-adhoc-violet/10 flex items-center justify-center transition-colors">
                            <svg className="w-5 h-5 text-gray-500 group-hover:text-adhoc-violet transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>
                        <span className="font-medium text-gray-700 group-hover:text-adhoc-violet transition-colors">Nuevo chat</span>
                    </button>
                </div>

                <div className="px-4 pb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Historial</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-0.5 font-sans">
                    {sessions.map(s => (
                        <Link key={s.id} href={`/chat/${agentSlug}?session=${s.id}`} className={`block px-3 py-2 text-sm rounded-md truncate transition-colors font-sans ${currentSessionId === s.id ? 'bg-adhoc-lavender/30 font-medium text-gray-900' : 'hover:bg-gray-100 text-gray-600'}`}>
                            {s.title}
                        </Link>
                    ))}
                    {sessions.length === 0 && (
                        <div className="px-4 py-8 text-center text-xs text-gray-400">
                            No hay historial reciente
                        </div>
                    )}
                </div>

                {/* User bottom section could go here */}
            </aside>

            {/* Overlay for mobile when sidebar open */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-30 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Chat */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">
                <ChatHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

                <div className="flex-1 overflow-y-auto p-4 pt-[72px] pb-[140px]">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-500">
                                <h1 className="text-3xl font-normal text-gray-800 mb-8">
                                    ¿En qué puedo ayudarte?
                                </h1>
                            </div>
                        )}

                        {messages.map((m, i) => {
                            const isLastMessage = i === messages.length - 1
                            const isStreamingBot = isLoading && m.id === 'temp-bot'
                            
                            return (
                            <div key={i}>
                                {/* Show ExecutionProgress BEFORE streaming bot message */}
                                {isStreamingBot && currentStep && (
                                    <ExecutionProgress step={currentStep} />
                                )}
                                
                                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.role === 'assistant' ? (
                                    <div className="max-w-[90%] md:max-w-[80%] min-w-0">
                                        {/* Render MeLi Skill result if applicable (returns null if not) */}
                                        <MeliSkillsRenderer content={m.rawContent || m.content} />
                                        {/* Always render the message content */}
                                        {m.content && (
                                            <div className="bot-message text-[15px] leading-relaxed text-gray-900 overflow-x-auto min-w-0" dangerouslySetInnerHTML={{ __html: m.content }}></div>
                                        )}
                                        
                                        {/* Show ToolBadge BELOW content for completed messages */}
                                        {m.sources && m.sources.length > 0 && !isStreamingBot && (
                                            <ToolBadge sources={m.sources} agentName={m.agentName} />
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-adhoc-lavender/30 px-4 py-2 rounded-3xl rounded-br-lg max-w-[80%] text-[15px] text-gray-900 whitespace-pre-wrap">
                                        {m.content}
                                    </div>
                                )}
                                </div>
                            </div>
                            )
                        })}
                        {/* Show rotating ThinkingIndicator when loading starts, before first tool event */}
                        {isLoading && !currentStep && messages.some(m => m.id === 'temp-bot') && (
                            <ThinkingIndicator />
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <ChatFooter
                    input={input}
                    setInput={setInput}
                    handleSend={handleSend}
                    isLoading={isLoading}
                    isRecording={dictation.isRecording}
                    recognition={dictation.isSupported}
                    startRecording={dictation.start}
                    cancelRecording={dictation.cancel}
                    confirmRecording={confirmRecording}
                    setIsVoiceOpen={setIsVoiceOpen}
                    agents={allAgents}
                />
            </div>

            <VoiceChat
                isOpen={isVoiceOpen}
                onClose={() => setIsVoiceOpen(false)}
                agentSlug={agentSlug}
                sessionId={currentSessionId}
                systemPrompt={agent.system_prompt || ''}
                messages={messages}
                onAddMessage={(role: 'user' | 'assistant', content: string) => {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role,
                        content,
                        rawContent: content
                    }])
                }}
            />
        </div>
    )
}
