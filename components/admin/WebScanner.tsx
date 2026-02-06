'use client'

import { useState } from 'react'
import { Globe, Loader2, Search, Check, X, Sparkles } from 'lucide-react'

interface ScanProgress {
  url: string
  status: 'scanning' | 'done' | 'skipped'
  current: number
  total: number
  phase: 'crawling' | 'summarizing'
}

interface WebScannerProps {
  currentUrl: string
  currentSummary: string
  scannedAt: string | null
}

export function WebScanner({ currentUrl, currentSummary, scannedAt }: WebScannerProps) {
  const [url, setUrl] = useState(currentUrl)
  const [summary, setSummary] = useState(currentSummary)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [scannedUrls, setScannedUrls] = useState<{ url: string; status: 'done' | 'skipped' }[]>([])
  const [scanResult, setScanResult] = useState<{ pages?: number; error?: string } | null>(null)

  const handleScan = async () => {
    if (!url.trim()) return
    setScanning(true)
    setScanResult(null)
    setProgress(null)
    setScannedUrls([])

    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok || !res.body) {
        setScanResult({ error: 'Error de conexión' })
        setScanning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'progress') {
              setProgress(data)
              if (data.status === 'done' || data.status === 'skipped') {
                setScannedUrls(prev => [...prev, { url: data.url, status: data.status }])
              }
            } else if (data.type === 'result') {
              if (data.success && data.summary) {
                setSummary(data.summary)
                setScanResult({ pages: data.pagesScanned })
              } else {
                setScanResult({ error: data.error || 'Error desconocido' })
              }
            }
          } catch { /* parse error, skip */ }
        }
      }
    } catch {
      setScanResult({ error: 'Error de conexión' })
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  const progressPercent = progress
    ? progress.phase === 'summarizing' ? 95 : Math.min(90, (progress.current / progress.total) * 90)
    : 0

  const shortUrl = (u: string) => {
    try { return new URL(u).pathname || '/' } catch { return u }
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

        {/* Progress bar + page log */}
        {scanning && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  {progress?.phase === 'summarizing' ? (
                    <><Sparkles className="w-3.5 h-3.5 text-adhoc-violet animate-pulse" /> Generando resumen con IA...</>
                  ) : (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Escaneando páginas...</>
                  )}
                </span>
                <span className="font-mono">{scannedUrls.filter(u => u.status === 'done').length} páginas</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-adhoc-violet to-adhoc-violet/70 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Page log */}
            <div className="max-h-32 overflow-y-auto bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1">
              {progress?.status === 'scanning' && (
                <div className="flex items-center gap-2 text-xs text-gray-500 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                  <span className="truncate font-mono">{shortUrl(progress.url)}</span>
                </div>
              )}
              {[...scannedUrls].reverse().map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {item.status === 'done' ? (
                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                  ) : (
                    <X className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={`truncate font-mono ${item.status === 'done' ? 'text-gray-600' : 'text-gray-300'}`}>
                    {shortUrl(item.url)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan result feedback */}
        {scanResult?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            ⚠️ {scanResult.error}
          </div>
        )}
        {scanResult?.pages && !scanning && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            ✅ {scanResult.pages} páginas escaneadas correctamente
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
        {scannedAt && !scanning && (
          <p className="text-xs text-gray-400">
            📊 Último escaneo: {new Date(scannedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </section>
  )
}
