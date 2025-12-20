'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
    Send, Loader2, ArrowLeft,
    Scale, Users, Briefcase, HeadphonesIcon,
    Bot, Brain, Code, Lightbulb, MessageSquare, Sparkles,
    GraduationCap, Heart, ShoppingCart, TrendingUp, Wrench,
    FileText, Calculator, Globe, Shield, Zap, Mail, Copy, Check,
    PanelLeftClose, PanelLeft, Search, Database
} from 'lucide-react'
import { marked } from 'marked'

// Simplified for brevity, assume types match
// In real app, reuse components

const getAgentIcon = (iconName: string, size: 'sm' | 'md' | 'lg' = 'sm', colorClass = 'text-white') => {
    const sizeClass = size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
    const icons: Record<string, React.ReactNode> = {
        'Scale': <Scale className={`${sizeClass} ${colorClass}`} />,
        'Users': <Users className={`${sizeClass} ${colorClass}`} />,
        'Bot': <Bot className={`${sizeClass} ${colorClass}`} />,
        'ShoppingCart': <ShoppingCart className={`${sizeClass} ${colorClass}`} />,
        'Database': <Database className={`${sizeClass} ${colorClass}`} />,
        'Calculator': <Calculator className={`${sizeClass} ${colorClass}`} />,
        'Building': <Briefcase className={`${sizeClass} ${colorClass}`} />, // Mapped from Building to Briefcase for now
        'Sparkles': <Sparkles className={`${sizeClass} ${colorClass}`} />
        // Add more as needed
    }
    return icons[iconName] || <Bot className={`${sizeClass} ${colorClass}`} />
}

export default function ChatPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const agentSlug = params.slug as string
    const sessionIdParam = searchParams.get('session')

    const [agent, setAgent] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [sessions, setSessions] = useState<any[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionIdParam)

    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Load Agent
    useEffect(() => {
        fetch(`/api/agents?slug=${agentSlug}`)
            .then(res => res.json())
            .then(data => setAgent(data))
            .catch(err => console.error(err))
    }, [agentSlug])

    // Load Sessions
    useEffect(() => {
        if (agent?.id) {
            fetch(`/api/chat-sessions?agentId=${agent.id}`)
                .then(res => res.json())
                .then(data => setSessions(data))
        }
    }, [agent?.id])

    // Load Messages
    useEffect(() => {
        if (sessionIdParam) {
            setCurrentSessionId(sessionIdParam)
            fetch(`/api/chat-sessions?sessionId=${sessionIdParam}`)
                .then(res => res.json())
                .then(async msgs => {
                    const loaded = []
                    for (const m of msgs) {
                        // Simple parse
                        let content = m.content
                        if (m.role === 'assistant') {
                            content = await marked.parse(m.content)
                        }
                        loaded.push({ ...m, content, rawContent: m.content })
                    }
                    setMessages(loaded)
                })
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

        // Optimistic UI
        const tempUserMsg = { id: Date.now(), role: 'user', content: userContent }
        setMessages(prev => [...prev, tempUserMsg])
        setIsLoading(true)

        try {
            // Create session if needed
            let sid = currentSessionId
            if (!sid) {
                const res = await fetch('/api/chat-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create-session', agentId: agent.id })
                })
                const session = await res.json()
                sid = session.id
                setCurrentSessionId(sid)
                router.push(`/chat/${agentSlug}?session=${sid}`, { scroll: false })
            }

            // Save User Message
            await fetch('/api/chat-sessions', {
                method: 'POST',
                body: JSON.stringify({ action: 'save-message', sessionId: sid, role: 'user', content: userContent })
            })

            // Call AI
            const response = await fetch('/api/chat', {
                method: 'POST',
                body: JSON.stringify({
                    agentSlug,
                    messages: [{ role: 'user', content: userContent }], // Simplified history for Alpha
                    sessionId: sid
                })
            })

            if (!response.ok) throw new Error('API Error')

            const reader = response.body?.getReader()
            let botText = ''

            while (true) {
                const { done, value } = await reader!.read()
                if (done) break
                const chunk = new TextDecoder().decode(value)
                botText += chunk
                // Streaming UI update could happen here
            }

            const htmlContent = await marked.parse(botText)

            setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: htmlContent, rawContent: botText }])

            // Save Bot Message
            await fetch('/api/chat-sessions', {
                method: 'POST',
                body: JSON.stringify({ action: 'save-message', sessionId: sid, role: 'assistant', content: botText })
            })

        } catch (e) {
            console.error(e)
            setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'Error al procesar mensaje.' }])
        } finally {
            setIsLoading(false)
        }
    }

    if (!agent) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-adhoc-violet" /></div>

    return (
        <div className="h-screen flex bg-white overflow-hidden relative font-sans">

            {/* Sidebar */}
            <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed md:static top-0 left-0 h-full z-40 bg-[#f9f9f9] flex flex-col transition-transform duration-200 border-r border-gray-200 w-[260px]
      `}>
                <div className="p-4 flex items-center gap-2 border-b border-gray-200/50 h-14">
                    <Link href="/" className="hover:bg-gray-200 p-1 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
                    <span className="font-medium text-sm">Historial</span>
                </div>

                <div className="px-2 py-2">
                    <button onClick={() => router.push(`/chat/${agentSlug}`)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded flex gap-2 items-center">
                        <Bot className="w-4 h-4" /> Nuevo Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2">
                    {sessions.map(s => (
                        <Link key={s.id} href={`/chat/${agentSlug}?session=${s.id}`} className={`block px-3 py-2 text-sm rounded truncate ${currentSessionId === s.id ? 'bg-gray-200 font-medium' : 'hover:bg-gray-100 text-gray-600'}`}>
                            {s.title}
                        </Link>
                    ))}
                </div>
            </aside>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col min-w-0 h-full">
                <header className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden"><PanelLeft className="w-5 h-5" /></button>
                        <div className="w-8 h-8 rounded-full bg-adhoc-lavender flex items-center justify-center">
                            {getAgentIcon(agent.icon, 'sm', 'text-adhoc-violet')}
                        </div>
                        <span className="font-medium text-gray-800">{agent.name}</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.length === 0 && (
                            <div className="text-center mt-20">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-adhoc-lavender flex items-center justify-center">
                                    {getAgentIcon(agent.icon, 'lg', 'text-adhoc-violet')}
                                </div>
                                <h2 className="text-xl font-medium mb-2">{agent.welcome_message}</h2>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.role === 'assistant' ? (
                                    <div className="flex gap-3 max-w-[90%] md:max-w-[80%]">
                                        <div className="w-8 h-8 rounded-full bg-adhoc-lavender flex items-center justify-center flex-shrink-0 mt-1">
                                            {getAgentIcon(agent.icon, 'sm', 'text-adhoc-violet')}
                                        </div>
                                        <div className="bot-message text-[15px] leading-relaxed text-gray-900" dangerouslySetInnerHTML={{ __html: m.content }}></div>
                                    </div>
                                ) : (
                                    <div className="bg-adhoc-lavender px-4 py-2 rounded-3xl rounded-br-lg max-w-[80%] text-[15px] text-gray-900 whitespace-pre-wrap">
                                        {m.content}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && <div className="flex gap-2 items-center text-gray-400 text-sm ml-12"><Loader2 className="w-4 h-4 animate-spin" /> Generando...</div>}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="max-w-3xl mx-auto relative">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                            placeholder={agent.placeholder_text}
                            className="w-full bg-white border border-gray-200 rounded-2xl pl-4 pr-12 py-3 resize-none focus:outline-none focus:border-adhoc-violet focus:ring-1 focus:ring-adhoc-violet transition-all"
                            rows={1}
                        />
                        <button onClick={handleSend} disabled={isLoading || !input.trim()} className="absolute right-2 bottom-2 p-2 bg-adhoc-violet text-white rounded-xl hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">IA puede cometer errores.</p>
                </div>
            </div>
        </div>
    )
}
