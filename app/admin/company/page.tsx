import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Building, Globe, Mail, MapPin, Phone, BookOpen, MessageSquare, ArrowRight } from 'lucide-react'
import { getClient, getTenantClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { CompanyForm } from '@/components/admin/CompanyForm'
import { DynamicList } from '@/components/admin/DynamicList'
import { RulesList } from '@/components/admin/RulesList'
import { WebScanner } from '@/components/admin/WebScanner'
import { DocumentSelector } from '@/components/ui/DocumentSelector'
import { getCompanyContext } from '@/lib/company/context-injector'
import Link from 'next/link'

async function getTenantData(tenantId: string) {
  const db = getClient()
  const { data } = await db.from('tenants').select('*').eq('id', tenantId).single()
  return data
}

async function getCompanyContextData(tenantId: string) {
  const db = getClient()
  const { data } = await db.from('company_contexts').select('*').eq('tenant_id', tenantId).single()
  return data
}

async function getAllDocuments(tenantId: string) {
  try {
    const db = await getTenantClient(tenantId)
    const { data } = await db.from('documents').select('id, title, metadata').order('created_at', { ascending: false })
    return data || []
  } catch { return [] }
}

export default async function AdminCompanyPage() {
  const session = await auth()
  if (!session?.user || !session.isAdmin) redirect('/')

  const tenantId = session.tenant!.id
  const [tenant, ctx, documents, contextPreview] = await Promise.all([
    getTenantData(tenantId),
    getCompanyContextData(tenantId),
    getAllDocuments(tenantId),
    getCompanyContext(tenantId),
  ])

  if (!tenant) return <div>Error: No se encontró la empresa.</div>

  const basics = (ctx?.basics || {}) as Record<string, string>
  const keyCustomers = (ctx?.key_customers || []) as { name: string; notes: string }[]
  const keyProducts = (ctx?.key_products || []) as { name: string; notes: string }[]
  const businessRules = (ctx?.business_rules || []) as string[]
  const toneOfVoice = (ctx?.tone_of_voice || '') as string
  const webSummary = (ctx?.web_summary || '') as string
  const scanUrl = ((ctx?.source_urls as string[] | null)?.[0] || tenant.website || '') as string
  const linkedDocs = (ctx?.linked_documents || []) as string[]

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
      <Header />
      <AdminSubHeader title="Tu Empresa" backHref="/admin" icon={Building} tenantName={tenant.name} />

      <div className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
        <CompanyForm initialPreview={contextPreview}>

          {/* SECTION 1: Datos Básicos */}
          <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/20">
              <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                <Building className="w-5 h-5 text-adhoc-violet" />
                Información básica
              </h2>
              <p className="text-sm text-gray-500 mt-1 italic">
                Datos principales de tu empresa
              </p>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Nombre Comercial" name="name" icon={Building} defaultValue={tenant.name || ''} />
                <InputField label="Industria / Rubro" name="industry" icon={Building} defaultValue={basics.industry || ''} placeholder="Ej: Distribuidora odontológica" />
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Descripción</label>
                  <textarea
                    name="description"
                    defaultValue={basics.description || ''}
                    placeholder="Breve descripción de qué hace tu empresa"
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm resize-none focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                  />
                </div>
                <InputField label="Sitio Web" name="website" icon={Globe} defaultValue={tenant.website || ''} type="url" />
                <InputField label="Email de Contacto" name="email" icon={Mail} defaultValue={tenant.email || ''} type="email" />
                <InputField label="Teléfono" name="phone" icon={Phone} defaultValue={tenant.phone || ''} />
                <InputField label="Dirección" name="address" icon={MapPin} defaultValue={tenant.address || ''} />
              </div>
            </div>
          </section>

          {/* SECTION 2: Web Scraping */}
          <WebScanner
            currentUrl={scanUrl}
            currentSummary={webSummary}
            scannedAt={ctx?.web_scanned_at || null}
          />

          {/* SECTION 3: Clientes Clave */}
          <DynamicList
            label="Clientes importantes"
            icon="👥"
            subtitle="Tuqui mencionará estos clientes cuando sea relevante"
            items={keyCustomers}
            fieldName="key_customers"
            namePlaceholder="Nombre del cliente"
            notesPlaceholder="Ej: Mayor volumen, paga tarde"
          />

          {/* SECTION 4: Productos Clave */}
          <DynamicList
            label="Productos importantes"
            icon="📦"
            subtitle="Productos o servicios clave de tu negocio"
            items={keyProducts}
            fieldName="key_products"
            namePlaceholder="Nombre del producto"
            notesPlaceholder="Ej: Producto estrella, margen 40%"
          />

          {/* SECTION 5: Reglas de Negocio */}
          <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/20">
              <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                <span>📋</span> Reglas de negocio
              </h2>
              <p className="text-sm text-gray-500 mt-1 italic">Tuqui seguirá estas reglas al responder</p>
            </div>
            <div className="p-8">
              <RulesList rules={businessRules} fieldName="business_rules" />
            </div>
          </section>

          {/* SECTION 6: Tono de Comunicación */}
          <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/20">
              <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-adhoc-violet" />
                Tono de comunicación
              </h2>
            </div>
            <div className="p-8">
              <textarea
                name="tone_of_voice"
                defaultValue={toneOfVoice}
                placeholder="Ej: Profesional pero cercano. Tutear al cliente. Usar emojis con moderación."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm resize-none focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
              />
            </div>
          </section>

          {/* SECTION 7: Documentos Vinculados */}
          <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/20">
              <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-adhoc-violet" />
                Base de conocimiento
              </h2>
              <p className="text-sm text-gray-500 mt-1 italic">
                Estos documentos se inyectan siempre como contexto de empresa
              </p>
            </div>
            <div className="p-8 space-y-4">
              {documents.length > 0 ? (
                <DocumentSelector
                  documents={documents}
                  selectedIds={linkedDocs}
                  name="linked_documents"
                />
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">No hay documentos en la base de conocimiento</p>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <Link
                  href="/admin/rag"
                  className="inline-flex items-center gap-2 text-sm text-adhoc-violet hover:text-adhoc-violet/80 font-medium transition-colors"
                >
                  ¿Necesitás subir archivos nuevos? Ir a Base de Conocimiento
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* Preview + Save button are rendered by CompanyForm */}

        </CompanyForm>
      </div>

      <Footer />
    </div>
  )
}

/* Reusable input field component */
function InputField({ label, name, icon: Icon, defaultValue, type = 'text', placeholder }: {
  label: string; name: string; icon: any; defaultValue: string; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
        />
      </div>
    </div>
  )
}
