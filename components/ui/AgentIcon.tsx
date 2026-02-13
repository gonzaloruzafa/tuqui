import { Sparkles, Calculator, Scale, Database, ShoppingCart, Bot, Users, Briefcase } from 'lucide-react'
import type { ReactNode } from 'react'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Sparkles,
    Calculator,
    Scale,
    Database,
    ShoppingCart,
    Bot,
    Users,
    Building: Briefcase,
    Briefcase,
}

export function AgentIcon({ name, className = 'w-6 h-6' }: { name?: string; className?: string }): ReactNode {
    const Icon = (name && ICON_MAP[name]) || Bot
    return <Icon className={className} />
}
