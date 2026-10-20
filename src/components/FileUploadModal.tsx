import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Building,
  BookOpen,
  DollarSign,
  ArrowRight,
  Loader2,
  Check,
  FileUp,
  Info,
  ClipboardPaste,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { BankTransaction, CurrencyType, TransactionSource } from '../types/accounting';
import { VENEZUELAN_BANKS } from '../data/venNifAccounts';
import {
  parseExcelFile,
  parsePdfFile,
  parseCsvOrTextFile,
  parsePastedStatementText,
  convertImportResultToTransactions,
  FileImportResult
} from '../services/fileImportService';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSource?: TransactionSource;
  initialMode?: 'FILE' | 'PASTE';
  currency: CurrencyType;
  bcvRate: number;
  selectedBankCode?: string;
  onImportComplete: (
    transactions: BankTransaction[],
    source: TransactionSource,
    detectedInitialBalance?: number
  ) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  defaultSource = 'BANK',
  initialMode = 'FILE',
  currency,
  bcvRate,
  selectedBankCode = '0134',
  onImportComplete
}) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>(initialMode);
  const [sourceType, setSourceType] = useState<TransactionSource>(defaultSource);
  const [targetBankCode, setTargetBankCode] = useState<string>(selectedBankCode || '0134');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>(currency || 'VES');
  const [initialBalanceInput, setInitialBalanceInput] = useState<string>('');
  const [pastedRawText, setPastedRawText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<FileImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setSourceType(defaultSource);
      setErrorMsg(null);
      setImportResult(null);
    }
  }, [isOpen, initialMode, defaultSource]);

  if (!isOpen) return null;

  const sym = selectedCurrency === 'VES' ? 'Bs.' : '$';

  // Process uploaded file
  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let result: FileImportResult;

      if (ext === 'xlsx' || ext === 'xls') {
        result = await parseExcelFile(file, targetBankCode, sourceType);
      } else if (ext === 'pdf') {
        result = await parsePdfFile(file, targetBankCode, sourceType);
      } else if (ext === 'csv' || ext === 'txt') {
        result = await parseCsvOrTextFile(file, targetBankCode, sourceType);
      } else {
        result = await parseCsvOrTextFile(file, targetBankCode, sourceType);
      }

      if (result.rows.length === 0) {
        throw new Error(result.summary || `No se detectaron movimientos válidos con montos en el archivo "${file.name}".`);
      }

      setImportResult(result);
      if (result.detectedBankCode) {
        setTargetBankCode(result.detectedBankCode);
      }
      if (result.detectedInitialBalance !== undefined && result.detectedInitialBalance > 0) {
        setInitialBalanceInput(result.detectedInitialBalance.toString());
      }
    } catch (err: any) {
      console.error('Error procesando archivo:', err);
      setErrorMsg(err.message || 'Error al procesar el archivo. Asegúrate de que sea un archivo Excel (.xlsx/.xls), CSV o PDF válido.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process text copied and pasted by the user (no headers required!)
  const handleProcessPastedText = () => {
    if (!pastedRawText.trim()) {
      setErrorMsg('Por favor pega el texto copiado de tu PDF o extracto bancario en el recuadro.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const result = parsePastedStatementText(pastedRawText, targetBankCode, sourceType);

      if (result.rows.length === 0) {
        throw new Error('No se detectaron movimientos válidos en el texto pegado.');
      }

      setImportResult(result);
      if (result.detectedBankCode) {
        setTargetBankCode(result.detectedBankCode);
      }
      if (result.detectedInitialBalance !== undefined && result.detectedInitialBalance > 0) {
        setInitialBalanceInput(result.detectedInitialBalance.toString());
      }
    } catch (err: any) {
      console.error('Error procesando texto pegado:', err);
      setErrorMsg(err.message || 'No se pudieron extraer movimientos. Verifica que el texto copiado contenga fechas y montos.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Paste sample Banesco statement without headers (using real Venezuelan extract format)
  const handleLoadSampleBanesco = () => {
    const sample = `2/1/2026 53653663474 Banesco Pago Movil -72.800,00 26.571,65
2/1/2026 53653663474 Banesco Pago Movil -218,4 26.353,25
5/1/2026 10568 TRF CR INM 0191 J299979066 CHINAKOREA MOTORS 100.000,00 126.353,25
5/1/2026 60053819318 PAGO MOVIL CCE -16.000,00 110.353,25
5/1/2026 60053819318 COM. PAGO MOVIL CCE -48 110.305,25
5/1/2026 3170081347 MOVISTAR CARGO C/CTA. -2.608,65 107.696,60
7/1/2026 7 TMD 0088778215 L.7 20260106 7 4.529,81 111.468,55
7/1/2026 7 TDB CAPIT. 0088778215 L.000007 30687 31.104,65 142.573,20
7/1/2026 134867 TRF CR INM 0191 J299979066 CHINAKOREA MOTORS 90.000,00 232.573,20
8/1/2026 60082260635 Banesco Pago Movil -240.000,00 4.506,59
8/1/2026 60082260635 Banesco Pago Movil -720 3.786,59
13/1/2026 42259 TRF CR INM 0191 J299979066 CHINAKOREA MOTORS 150.000,00 269.512,29
13/1/2026 60124197601 Banesco Pago Movil -30.000,00 239.512,29
15/1/2026 29122025 Comision Servicio SMS -8 11.436,80
16/1/2026 16324531 TRF CR INM 0172 J404786856 ARMAS DEL ROSARIO 36.154,00 39.722,53
16/1/2026 24192064516 Banesco Pago Movil -2 123.754,27
20/1/2026 2600448734 INCLUSION DE PLANILLA SENIAT C/CTA -82.328,74 234.467,21
21/1/2026 6354634 TRF CR INM 0171 J300851567 AGENCIA SELINGER 500.000,00 502.600,41
22/1/2026 60220412508 Banesco Pago Movil -210.000,00 40.907,42
30/1/2026 0 COM.SERV.MTTO CTA -8 25.052,48`;
    setPastedRawText(sample);
    setErrorMsg(null);
  };

  // Paste directly from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setPastedRawText(clipText);
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Haz clic en el recuadro de texto y presiona Ctrl + V para pegar tu texto.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!importResult) return;

    const newTransactions = convertImportResultToTransactions(
      importResult,
      sourceType,
      targetBankCode,
      selectedCurrency,
      bcvRate
    );

    const initialBalNum = initialBalanceInput ? parseFloat(initialBalanceInput.replace(',', '.')) : undefined;

    onImportComplete(newTransactions, sourceType, isNaN(initialBalNum as any) ? undefined : initialBalNum);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
              sourceType === 'BANK' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Incorporar Datos a la Conciliación
              </h3>
              <p className="text-xs text-slate-500">
                Carga tu archivo (.pdf, .xlsx, .csv) o copia y pega el texto directamente sin encabezados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Switcher: Extracto Bancario vs Libro Mayor */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSourceType('BANK')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
              sourceType === 'BANK'
                ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200 shadow-2xs'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              sourceType === 'BANK' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              <Building className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">1. Estado de Cuenta Bancario</span>
              <span className="text-[10px] text-slate-500">Extracto emitido por la institución financiera</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('LEDGER')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
              sourceType === 'LEDGER'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              sourceType === 'LEDGER' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">2. Libro Mayor de Banco</span>
              <span className="text-[10px] text-slate-500">Registros contables (SGT, Profit, Gálac, Saint)</span>
            </div>
          </button>
        </div>

        {/* Method Switcher Tabs: Subir Archivo vs Pegar Texto Copiado */}
        {!importResult && (
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => { setActiveTab('FILE'); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'FILE'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Archivo (.pdf, .xlsx, .csv)</span>
            </button>
            <button
              onClick={() => { setActiveTab('PASTE'); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'PASTE'
                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>📋 Pegar Texto Copiado de PDF (Sin Encabezados)</span>
            </button>
          </div>
        )}

        {/* Bank & Initial Balance Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Banco Correspondiente:
            </label>
            <select
              value={targetBankCode}
              onChange={(e) => setTargetBankCode(e.target.value)}
              className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-300 bg-white focus:outline-none"
            >
              {VENEZUELAN_BANKS.map(b => (
                <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Saldo Inicial / Anterior ({sym}):</span>
              <span className="text-[10px] font-normal text-slate-400">Opcional</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 15000.00"
                value={initialBalanceInput}
                onChange={(e) => setInitialBalanceInput(e.target.value)}
                className="w-full text-xs font-mono font-bold p-2 pl-7 rounded-xl border border-slate-300 bg-white focus:outline-none"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {sym}
              </span>
            </div>
          </div>
        </div>

        {/* TAB 1: File Upload */}
        {!importResult && activeTab === 'FILE' && (
          <div className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                accept=".xlsx,.xls,.csv,.txt,.pdf"
                className="hidden"
              />

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-700">Analizando y extrayendo movimientos del archivo...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs border border-indigo-100">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Haz clic para seleccionar o arrastra tu archivo aquí
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Formatos: <strong>PDF (.pdf)</strong>, <strong>Excel (.xlsx, .xls)</strong> o <strong>CSV (.csv)</strong>
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Soporte Banesco, BDV, Mercantil y Bancamiga
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Shortcut to switch to Paste tab */}
            <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 flex items-center justify-between gap-3">
              <div className="text-xs">
                <span className="font-bold block text-indigo-900">¿Prefieres copiar y pegar el texto del PDF?</span>
                <p className="text-[11px] text-indigo-700">
                  Selecciona el texto en tu lector PDF (Ctrl+C) y pégalo directamente sin necesidad de encabezados.
                </p>
              </div>
              <button
                onClick={() => { setActiveTab('PASTE'); setErrorMsg(null); }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-2xs"
              >
                Pegar Texto
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Direct Text Paste (No headers required!) */}
        {!importResult && activeTab === 'PASTE' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-900 block">
                  Sin necesidad de encabezados de Fecha, Descripción o Montos
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Copia los movimientos con tu ratón o teclado directamente desde tu PDF o banca en línea y pégalos aquí. El motor detecta automáticamente la fecha, la referencia, el concepto y clasifica si es Débito o Crédito.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>100% Autónomo en el Navegador • Funciona en Netlify, Vercel y sin depender de servidores o cuotas de IA.</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Texto copiado del extracto bancario o PDF:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    Pegar del Portapapeles
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleLoadSampleBanesco}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cargar Ejemplo Banesco
                  </button>
                </div>
              </div>

              <textarea
                rows={7}
                value={pastedRawText}
                onChange={(e) => setPastedRawText(e.target.value)}
                placeholder="Pega aquí el texto copiado de tu PDF (Ctrl+V)...&#10;Ejemplo sin encabezados:&#10;02/01/2026 10293847 PAGO MOVIL A TERCEROS 1.250,00 45.320,50&#10;05-ENE-26  88374621 TRANSFERENCIA DE TERCEROS 25000,00 70.320,50&#10;06-ENE-26  00492812 ND COMISION MANTENIMIENTO 85,50 70.235,00"
                className="w-full text-xs font-mono p-3 rounded-2xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPastedRawText('')}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Limpiar texto
              </button>

              <button
                type="button"
                onClick={handleProcessPastedText}
                disabled={isProcessing || !pastedRawText.trim()}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white font-bold text-xs shadow-xs transition-all cursor-pointer ${
                  isProcessing || !pastedRawText.trim()
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-200'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analizando movimientos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Procesar Movimientos Copiados</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1 leading-relaxed">
              <span className="font-bold block text-rose-900">Atención al procesar la información:</span>
              <p className="whitespace-pre-line text-rose-800">{errorMsg}</p>
              {activeTab === 'FILE' && (
                <div className="pt-2">
                  <button
                    onClick={() => { setActiveTab('PASTE'); setErrorMsg(null); }}
                    className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                  >
                    👉 Probar copiando y pegando el texto del PDF directamente aquí
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import Preview Result */}
        {importResult && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">
                    Movimientos identificados con éxito: {importResult.fileName}
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Se detectaron <strong>{importResult.rows.length} movimientos</strong> para <strong>{importResult.detectedBankName}</strong>.
                    {' '}(Total Débitos: {sym} {importResult.totalDebits.toLocaleString('es-VE', { minimumFractionDigits: 2 })}, Total Créditos: {sym} {importResult.totalCredits.toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setImportResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              >
                Volver a cargar / pegar
              </button>
            </div>

            {/* Table Preview */}
            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Referencia</th>
                    <th className="p-2">Concepto</th>
                    <th className="p-2 text-right">Monto ({sym})</th>
                    <th className="p-2 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {importResult.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-sans whitespace-nowrap">{r.date}</td>
                      <td className="p-2 font-bold text-slate-800 whitespace-nowrap">{r.reference}</td>
                      <td className="p-2 font-sans truncate max-w-xs">{r.description}</td>
                      <td className={`p-2 text-right font-bold whitespace-nowrap ${r.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {r.type === 'CREDIT' ? '+' : '-'}{sym} {r.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {r.type === 'CREDIT' ? 'ABONO' : 'CARGO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importResult.rows.length > 8 && (
              <p className="text-[10px] text-slate-400 text-right">
                ...y {importResult.rows.length - 8} movimientos adicionales que serán incorporados.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-xs cursor-pointer ${
                  sourceType === 'BANK'
                    ? 'bg-sky-600 hover:bg-sky-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Incorporar {importResult.rows.length} Movimientos a la Conciliación</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
