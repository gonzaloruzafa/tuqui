import Link from 'next/link'
import { ArrowLeft, Home, LucideIcon } from 'lucide-react'

interface AdminSubHeaderProps {
    title: string
    backHref: string
    icon: LucideIcon
    iconColor?: string
    iconBg?: string
    tenantName?: string
}

export function AdminSubHeader({
    title,
    backHref,
    icon: Icon,
    iconColor = 'text-adhoc-violet',
    iconBg = 'bg-adhoc-lavender/30',
    tenantName
}: AdminSubHeaderProps) {
    return (
        <div className="bg-white border-b border-adhoc-lavender/30 sticky top-0 z-10 shadow-sm">
            <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href={backHref} className="p-1.5 hover:bg-adhoc-lavender/20 rounded-lg transition-colors text-gray-400 hover:text-adhoc-violet">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 font-display">{title}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {tenantName && (
                        <span className="hidden sm:inline-flex text-xs font-semibold text-adhoc-violet px-2.5 py-1 bg-adhoc-lavender/20 rounded-full border border-adhoc-lavender/30">
                            {tenantName}
                        </span>
                    )}
                    <Link href="/" className="p-2 hover:bg-adhoc-lavender/20 rounded-lg transition-colors text-gray-400 hover:text-adhoc-violet" title="Ir a inicio">
                        <Home className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        </div>
    )
}
