export const MELI_SITES = {
    MLA: { id: 'MLA', name: 'Argentina', currency: 'ARS', domain: 'mercadolibre.com.ar' },
    MLB: { id: 'MLB', name: 'Brasil', currency: 'BRL', domain: 'mercadolivre.com.br' },
    MLM: { id: 'MLM', name: 'México', currency: 'MXN', domain: 'mercadolibre.com.mx' },
    MLC: { id: 'MLC', name: 'Chile', currency: 'CLP', domain: 'mercadolibre.cl' },
    MLU: { id: 'MLU', name: 'Uruguay', currency: 'UYU', domain: 'mercadolibre.com.uy' },
    MCO: { id: 'MCO', name: 'Colombia', currency: 'COP', domain: 'mercadolibre.com.co' },
    MPE: { id: 'MPE', name: 'Perú', currency: 'PEN', domain: 'mercadolibre.com.pe' },
} as const

export type MeliSiteId = keyof typeof MELI_SITES
export const MELI_SITE_LIST = Object.keys(MELI_SITES) as MeliSiteId[]

export function isValidSite(siteId: string): siteId is MeliSiteId {
    return siteId in MELI_SITES
}

export function calculatePercentiles(values: number[]) {
    if (values.length === 0) return { min: 0, p25: 0, p50: 0, p75: 0, max: 0, avg: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const len = sorted.length

    const percentile = (p: number) => {
        const index = (p / 100) * (len - 1)
        return sorted[Math.round(index)]
    }

    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
        min: sorted[0],
        p25: percentile(25),
        p50: percentile(50),
        p75: percentile(75),
        max: sorted[len - 1],
        avg: Math.round(sum / len)
    }
}
