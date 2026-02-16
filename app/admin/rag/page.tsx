import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { FileText, Database } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { RAGUpload } from '@/components/admin/RAGUpload'
import { DeleteDocumentForm } from '@/components/admin/DeleteDocumentButton'

async function getDocuments(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data } = await db.from('documents').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    return data || []
}

export default async function RAGPage() {
    const session = await auth()
    if (!session?.user || !session.isAdmin) redirect('/')

    const documents = await getDocuments(session.tenant!.id)

    return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
            <Header />

            <AdminSubHeader
                title="Base de Conocimiento"
                backHref="/admin"
                icon={Database}
                tenantName={session.tenant?.name}
            />

            <div className="flex-grow max-w-4xl mx-auto px-6 py-10 w-full">

                <div className="mb-12">
                    <RAGUpload />
                </div>

                {/* Documents List */}
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-3 h-3" />
                        Documentos Indexados ({documents.length})
                    </h2>
                </div>

                <div className="bg-white rounded-2xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                    {documents.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 italic text-sm">
                            No hay documentos cargados aún.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                            {documents.map((doc: any) => (
                                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-adhoc-lavender/5 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-adhoc-lavender/20 flex items-center justify-center text-adhoc-violet">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900 text-sm">{(doc.metadata as any)?.filename || 'Documento sin nombre'}</h4>
                                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight mt-0.5">
                                                {new Date(doc.created_at).toLocaleDateString('es-AR')} • {(doc.metadata as any)?.size ? Math.round((doc.metadata as any).size / 1024) + ' KB' : 'Size unknown'}
                                            </p>
                                        </div>
                                    </div>

                                    <DeleteDocumentForm documentId={doc.id} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    )
}
