export interface TabState {
  id: string
  filePath: string
  fileName: string
  documentId: string | null
  pdfData: ArrayBuffer | null
  scrollPosition: number
  scale: number
  isLoading: boolean
  loadError: string | null
}
