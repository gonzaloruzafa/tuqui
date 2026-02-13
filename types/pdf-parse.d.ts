declare module 'pdf-parse' {
  interface PDFData {
    numpages: number
    numrender: number
    info: Record<string, any>
    metadata: any
    text: string
    version: string
  }
  function pdfParse(buffer: Buffer): Promise<PDFData>
  export default pdfParse
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFData {
    numpages: number
    text: string
  }
  function pdfParse(buffer: Buffer): Promise<PDFData>
  export default pdfParse
}
