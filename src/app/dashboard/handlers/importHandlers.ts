import { Trade, MTReportPreview } from '../utils/types'
import { toast } from 'sonner'
import { parseCSV, fileToBase64 } from '../utils/importUtils'
import { parseMT4HTML } from '../utils/parseMT4HTML'

interface ImportHandlersProps {
  csvFile: File | null
  setCsvFile: (file: File | null) => void
  csvPreview: Trade[]
  setCsvPreview: (trades: Trade[]) => void
  csvImporting: boolean
  setCsvImporting: (importing: boolean) => void
  csvImportOpen: boolean
  setCsvImportOpen: (open: boolean) => void
  smartImportOpen: boolean
  setSmartImportOpen: (open: boolean) => void
  smartImportPreview: MTReportPreview | null
  setSmartImportPreview: (preview: MTReportPreview | null) => void
  smartImportFile: File | null
  setSmartImportFile: (file: File | null) => void
  smartImportParsing: boolean
  setSmartImportParsing: (parsing: boolean) => void
  importTab: 'screenshot' | 'file'
  setImportTab: (tab: 'screenshot' | 'file') => void
  screenshotPreview: string | null
  setScreenshotPreview: (preview: string | null) => void
  importedTrades: Trade[]
  setImportedTrades: (trades: Trade[]) => void
  importParsing: boolean
  setImportParsing: (parsing: boolean) => void
  updateImportedTrade: (index: number, field: keyof Trade, value: string | number) => void
  removeImportedTrade: (index: number) => void
  isPro: boolean
  setPlanSelectionModalOpen: (open: boolean) => void
  getAuthHeaders: () => Record<string, string>
  fetchData: () => void
}

export const createImportHandlers = ({
  csvFile,
  setCsvFile,
  csvPreview,
  setCsvPreview,
  csvImporting,
  setCsvImporting,
  csvImportOpen,
  setCsvImportOpen,
  smartImportOpen,
  setSmartImportOpen,
  smartImportPreview,
  setSmartImportPreview,
  smartImportFile,
  setSmartImportFile,
  smartImportParsing,
  setSmartImportParsing,
  importTab,
  setImportTab,
  screenshotPreview,
  setScreenshotPreview,
  importedTrades,
  setImportedTrades,
  importParsing,
  setImportParsing,
  updateImportedTrade,
  removeImportedTrade,
  isPro,
  setPlanSelectionModalOpen,
  getAuthHeaders,
  fetchData
}: ImportHandlersProps) => {

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const parsed = parseCSV(text)
      setCsvPreview(parsed)
    }
    reader.readAsText(file)
  }
  
  const handleCsvImport = async () => {
    if (csvPreview.length === 0) {
      toast.error('No trades to import')
      return
    }

    setCsvImporting(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: csvPreview })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.inserted} trades!`)
        setCsvImportOpen(false)
        setCsvFile(null)
        setCsvPreview([])
        fetchData()
      } else {
        toast.error(data.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  const handleSmartImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setSmartImportFile(file)
    setSmartImportParsing(true)
    
    try {
      const text = await file.text()
      const preview = parseMT4HTML(text)
      setSmartImportPreview(preview)
    } catch (error) {
      toast.error('Failed to parse file')
    } finally {
      setSmartImportParsing(false)
    }
  }
  
  const handleSmartImportSave = async () => {
    if (!smartImportPreview || smartImportPreview.trades.length === 0) {
      toast.error('No trades to import')
      return
    }

    if (!isPro) {
      setPlanSelectionModalOpen(true)
      return
    }
    
    setCsvImporting(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ trades: smartImportPreview.trades })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.inserted} trades!`)
        setSmartImportOpen(false)
        setSmartImportPreview(null)
        setSmartImportFile(null)
        fetchData()
      } else {
        toast.error(data.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload an image file (PNG, JPG, etc.)'
      })
      return
    }
    
    // Show preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setScreenshotPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    
    // Send to OCR API
    setImportParsing(true)
    setImportedTrades([])
    
    try {
      const base64 = await fileToBase64(file)
      
      const res = await fetch('/api/import/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success && data.trades?.length > 0) {
        setImportedTrades(data.trades)
        toast.success(`✅ Detected ${data.trades.length} trades from screenshot!`, {
          description: `Method: ${data.method || 'VLM'}. Review and edit before saving.`
        })
      } else {
        // Clear preview and show error
        setScreenshotPreview(null)
        const errorMsg = data.message || data.error || 'Data tidak terbaca - Could not detect trades in screenshot'
        toast.error('❌ Data Tidak Terbaca', {
          description: errorMsg + '. Pastikan screenshot menampilkan history MT5 dengan jelas (Symbol, Type, Lots, Price, Profit).'
        })
      }
    } catch (err) {
      console.error('Screenshot OCR error:', err)
      setScreenshotPreview(null)
      toast.error('❌ Failed to process screenshot', {
        description: 'Please check your internet connection and try again.'
      })
    } finally {
      setImportParsing(false)
    }
  }
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    const validTypes = ['application/pdf', 'text/html', 'text/csv', 'text/plain']
    const validExtensions = ['.pdf', '.html', '.htm', '.csv', '.txt']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload PDF, HTML, CSV, or TXT files only.'
      })
      return
    }
    
    setImportParsing(true)
    setImportedTrades([])
    
    try {
      const base64 = await fileToBase64(file)
      
      const res = await fetch('/api/import/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileBase64: base64, 
          fileType: file.type,
          fileName: file.name 
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success && data.trades?.length > 0) {
        setImportedTrades(data.trades)
        toast.success(`✅ Found ${data.trades.length} trades in file!`, {
          description: 'Review and edit before saving.'
        })
      } else {
        const errorMsg = data.message || data.error || 'Data tidak terbaca - No trades found in file'
        toast.error('❌ Data Tidak Terbaca', {
          description: errorMsg + '. Pastikan file adalah report MT4/MT5 yang valid dengan kolom Symbol, Type, Profit, dll.'
        })
      }
    } catch (err) {
      console.error('File parse error:', err)
      toast.error('❌ Failed to parse file', {
        description: 'Make sure the file is a valid MT4/MT5 report.'
      })
    } finally {
      setImportParsing(false)
    }
  }
  
  const handleSaveImportedTrades = async () => {
    if (importedTrades.length === 0) {
      toast.error('No trades to import')
      return
    }

    if (!isPro) {
      setPlanSelectionModalOpen(true)
      return
    }
    
    setImportParsing(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ trades: importedTrades })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.inserted} trades!`)
        setSmartImportOpen(false)
        setImportedTrades([])
        setScreenshotPreview(null)
        setImportTab('screenshot')
        fetchData()
      } else {
        toast.error(data.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImportParsing(false)
    }
  }

  return {
    handleCsvFileChange,
    handleCsvImport,
    handleSmartImport,
    handleSmartImportSave,
    handleScreenshotUpload,
    handleFileUpload,
    handleSaveImportedTrades
  }
}
