'use client'

import { useState, useTransition } from 'react'
import { Globe, Loader2, Search } from 'lucide-react'

interface WebScannerProps {
  currentUrl: string
  currentSummary: string
  scannedAt: string | null
  scanAction: (formData: FormData) => Promise<{ success: boolean; summary?: string; pagesScanned?: number; error?: string }>
}

export function WebScanner({ currentUrl, currentSummary, scannedAt, scanAction }: WebScannerProps) {
  const [url, setUrl] = useState(currentUrl)
  const [summary, setSummary] = useState(currentSummary)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ pages?: number; error?: string } | null>(null)

  const handleScan = async () => {
    if (!url.trim()) return
    setScanning(true)
    setScanResult(null)

    try {
      const fd = new FormData()
      fd.set('url', url)
      const result = await scanAction(fd)

      if (result.success && result.summary) {
        setSummary(result.summary)
        setScanResult({ pages: result.pagesScanned })
      } else {
        setScanResult({ error: result.error || 'Error desconocido' })
      }
    } catch {
      setScanResult({ error: 'Error de conexión' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 bg-gray-50/20">
        <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Globe className="w-5 h-5 text-adhoc-violet" />
          Información de tu web
        </h2>
        <p className="text-sm text-gray-500 mt-1 italic">
          Tuqui lee tu página para conocer mejor tu empresa (2 niveles de profundidad)
        </p>
      </div>

      <div className="p-8 space-y-4">
        {/* URL + Scan button */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://tu-empresa.com"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || !url.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-adhoc-violet hover:bg-adhoc-violet/90 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all shadow-md shadow-adhoc-violet/20 active:scale-95 disabled:active:scale-100"
          >
            {scanning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>
            ) : (
              <><Search className="w-4 h-4" /> Escanear</>
            )}
          </button>
        </div>

        {/* Scan result feedback */}
        {scanResult?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            ⚠️ {scanResult.error}
          </div>
        )}
        {scanResult?.pages && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            ✅ {scanResult.pages} páginas escaneadas
          </div>
        )}

        {/* Editable summary */}
        {summary && (
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Resumen generado (editable)
            </label>
            <textarea
              name="web_summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-mono resize-none focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
            />
          </div>
        )}

        {/* Hidden fields for form submission */}
        <input type="hidden" name="scan_url" value={url} />
        {!summary && <input type="hidden" name="web_summary" value="" />}

        {/* Metadata */}
        {scannedAt && (
          <p className="text-xs text-gray-400">
            📊 Último escaneo: {new Date(scannedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </section>
  )
}
