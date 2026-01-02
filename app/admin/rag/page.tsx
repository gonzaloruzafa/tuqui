import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { FileText, Database } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { RAGUpload } from '@/components/admin/RAGUpload'
import { deleteDocument } from './actions'

async function getDocuments(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data } = await db.from('documents').select('*').order('created_at', { ascending: false })
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
                title="Base de Conocimiento RAG"
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
                        <div className="divide-y divide-gray-100">
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

                                    <form action={deleteDocument}>
                                        <input type="hidden" name="id" value={doc.id} />
                                        <button type="submit" className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90" title="Eliminar documento">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                        </button>
                                    </form>
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
