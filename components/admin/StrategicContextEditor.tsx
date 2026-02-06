'use client'

import { useState } from 'react'
import { Plus, Trash2, Lightbulb, Users, Package, ShieldCheck, Eye } from 'lucide-react'

interface Item {
    name: string
    notes: string
}

interface StrategicContextEditorProps {
    initialProducts: Item[]
    initialCustomers: Item[]
    initialRules: string[]
    previewPrompt: string
}

export function StrategicContextEditor({
    initialProducts,
    initialCustomers,
    initialRules,
    previewPrompt
}: StrategicContextEditorProps) {
    const [products, setProducts] = useState<Item[]>(initialProducts || [])
    const [customers, setCustomers] = useState<Item[]>(initialCustomers || [])
    const [rules, setRules] = useState<string[]>(initialRules || [])
    const [showPreview, setShowPreview] = useState(false)

    const addItem = (type: 'product' | 'customer') => {
        if (type === 'product') setProducts([...products, { name: '', notes: '' }])
        else setCustomers([...customers, { name: '', notes: '' }])
    }

    const removeItem = (type: 'product' | 'customer', index: number) => {
        if (type === 'product') setProducts(products.filter((_, i) => i !== index))
        else setCustomers(customers.filter((_, i) => i !== index))
    }

    const updateItem = (type: 'product' | 'customer', index: number, field: keyof Item, value: string) => {
        if (type === 'product') {
            const newItems = [...products]
            newItems[index][field] = value
            setProducts(newItems)
        } else {
            const newItems = [...customers]
            newItems[index][field] = value
            setCustomers(newItems)
        }
    }

    const addRule = () => setRules([...rules, ''])
    const removeRule = (index: number) => setRules(rules.filter((_, i) => i !== index))
    const updateRule = (index: number, value: string) => {
        const newRules = [...rules]
        newRules[index] = value
        setRules(newRules)
    }

    return (
        <div className="space-y-8 mt-10">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Información Estratégica
                </h2>
                <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs flex items-center gap-1 text-adhoc-violet font-bold hover:underline"
                >
                    <Eye className="w-3 h-3" />
                    {showPreview ? 'Ocultar Preview' : 'Ver Preview de Prompt'}
                </button>
            </div>

            {showPreview && (
                <div className="bg-gray-900 text-gray-300 p-6 rounded-2xl font-mono text-xs leading-relaxed border border-gray-800 shadow-inner">
                    <div className="text-gray-500 mb-2 border-b border-gray-800 pb-2 flex justify-between">
                        <span>ASÍ LO VE EL AGENTE:</span>
                        <span className="text-[10px]">INJECTED INTO SYSTEM PROMPT</span>
                    </div>
                    {previewPrompt || "Completa la información abajo para ver el preview..."}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Key Products */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-500" />
                            Productos Clave
                        </h3>
                        <button type="button" onClick={() => addItem('product')} className="p-1 hover:bg-gray-100 rounded-lg text-adhoc-violet">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {products.map((item, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    placeholder="Nombre"
                                    value={item.name}
                                    onChange={(e) => updateItem('product', i, 'name', e.target.value)}
                                    className="flex-1 text-xs p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-adhoc-violet"
                                />
                                <input
                                    placeholder="Notas (ej: El que más margen deja)"
                                    value={item.notes}
                                    onChange={(e) => updateItem('product', i, 'notes', e.target.value)}
                                    className="flex-[2] text-xs p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-adhoc-violet"
                                />
                                <button type="button" onClick={() => removeItem('product', i)} className="text-gray-300 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Key Customers */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-500" />
                            Clientes Clave
                        </h3>
                        <button type="button" onClick={() => addItem('customer')} className="p-1 hover:bg-gray-100 rounded-lg text-adhoc-violet">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {customers.map((item, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    placeholder="Nombre"
                                    value={item.name}
                                    onChange={(e) => updateItem('customer', i, 'name', e.target.value)}
                                    className="flex-1 text-xs p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-adhoc-violet"
                                />
                                <input
                                    placeholder="Notas (ej: Siempre paga tarde)"
                                    value={item.notes}
                                    onChange={(e) => updateItem('customer', i, 'notes', e.target.value)}
                                    className="flex-[2] text-xs p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-adhoc-violet"
                                />
                                <button type="button" onClick={() => removeItem('customer', i)} className="text-gray-300 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Business Rules */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                            Reglas de Negocio
                        </h3>
                        <button type="button" onClick={addRule} className="p-1 hover:bg-gray-100 rounded-lg text-adhoc-violet">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {rules.map((rule, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    placeholder="Ej: No vender a clientes con más de 30 días de mora."
                                    value={rule}
                                    onChange={(e) => updateRule(i, e.target.value)}
                                    className="flex-1 text-xs p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-adhoc-violet"
                                />
                                <button type="button" onClick={() => removeRule(i)} className="text-gray-300 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hidden inputs to sync with form submission */}
            <input type="hidden" name="key_products_json" value={JSON.stringify(products)} />
            <input type="hidden" name="key_customers_json" value={JSON.stringify(customers)} />
            <input type="hidden" name="business_rules_json" value={JSON.stringify(rules)} />
        </div>
    )
}
