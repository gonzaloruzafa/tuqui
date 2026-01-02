import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { ToolsList } from '@/components/admin/ToolsForm'

async function getIntegrations(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data, error } = await db.from('integrations').select('*')
    if (error) {
        console.error('Error fetching integrations:', error)
        return []
    }
    return data || []
}

export default async function AdminToolsPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const integrations = await getIntegrations(session.tenant!.id)

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />

            <AdminSubHeader
                title="Herramientas e Integraciones"
                backHref="/admin"
                icon={Wrench}
                tenantName={session.tenant?.name}
            />

            <div className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
                <div className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm p-8">
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-adhoc-violet" />
                            Catálogo de Conectores
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 italic">Habilita conexiones con tus sistemas externos para potenciar tus agentes.</p>
                    </div>
                    <ToolsList integrations={integrations} />
                </div>
            </div>

            <Footer />
        </div>
    )
}
