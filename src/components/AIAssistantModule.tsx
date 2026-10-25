import React, { useState } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Copy,
  PlusCircle,
  BrainCircuit,
  HelpCircle,
  Send,
  Loader2,
  Check,
  Building,
  BookOpen,
  ArrowRight,
  ClipboardPaste,
  ShieldCheck
} from 'lucide-react';
import { BankTransaction, CurrencyType, JournalEntry } from '../types/accounting';
import { VENEZUELAN_BANKS } from '../data/venNifAccounts';
import {
  parseAndCategorizeRawBankText,
  parseAndCategorizeLedgerText,
  AIParsedBankRow,
  AIParsedLedgerRow
} from '../services/aiAccountant';

export type AssistantImportMode = 'BANK' | 'LEDGER';

interface AIAssistantModuleProps {
  currency: CurrencyType;
  bcvRate: number;
  onAddParsedTransactions: (newTx: BankTransaction[]) => void;
  initialMode?: AssistantImportMode;
}

export const AIAssistantModule: React.FC<AIAssistantModuleProps> = ({
  currency,
  bcvRate,
  onAddParsedTransactions,
  initialMode = 'BANK'
}) => {
  const [importMode, setImportMode] = useState<AssistantImportMode>(initialMode);
  const [selectedBankCode, setSelectedBankCode] = useState<string>('0134');
  const [pastedText, setPastedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Bank extract results
  const [bankResults, setBankResults] = useState<{
    parsedRows: AIParsedBankRow[];
    generatedEntries: JournalEntry[];
    summary: string;
  } | null>(null);

  // Ledger results
  const [ledgerResults, setLedgerResults] = useState<{
    parsedRows: AIParsedLedgerRow[];
    totalDebe: number;
    totalHaber: number;
    summary: string;
  } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [addedLedgerSuccess, setAddedLedgerSuccess] = useState(false);

  const supportedBanks = [
    { code: '0134', name: 'Banesco' },
    { code: '0102', name: 'Banco de Venezuela' },
    { code: '0105', name: 'Mercantil' },
    { code: '0172', name: 'Bancamiga' },
    { code: '0191', name: 'BNC' }
  ];

  // Process text based on mode
  const handleProcessText = async () => {
    if (!pastedText.trim()) return;
    setIsLoading(true);
    setAddedSuccess(false);
    setAddedLedgerSuccess(false);

    try {
      if (importMode === 'BANK') {
        const output = await parseAndCategorizeRawBankText(pastedText, selectedBankCode, currency, bcvRate);
        setBankResults(output);
      } else {
        const output = await parseAndCategorizeLedgerText(pastedText, selectedBankCode, currency, bcvRate);
        setLedgerResults(output);
      }
    } catch (error) {
      console.error('Error procesando información con IA:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add parsed Bank statement transactions (source: 'BANK')
  const handleAddAllToReconciliation = () => {
    if (!bankResults || bankResults.parsedRows.length === 0) return;

    const newTransactions: BankTransaction[] = bankResults.parsedRows.map((row, idx) => ({
      id: `bnk-tx-${Date.now()}-${idx}`,
      source: 'BANK',
      bankCode: row.bankCode,
      bankName: row.bankName,
      referenceNum: row.referenceNum,
      txDate: row.txDate,
      txType: row.txType,
      amountNominal: row.amountNominal,
      currency: row.currency,
      bcvRate,
      amountVes: row.currency === 'USD' ? row.amountNominal * bcvRate : row.amountNominal,
      rawDescription: row.rawDescription,
      counterpartyRif: row.counterpartyRif,
      counterpartyName: row.counterpartyName,
      accountCode: row.suggestedAccountCode,
      accountName: row.suggestedAccountName,
      matchingStatus: 'UNMATCHED',
      moduleTag: row.moduleTag,
      notes: row.rationale,
      createdAt: new Date().toISOString()
    }));

    onAddParsedTransactions(newTransactions);
    setAddedSuccess(true);
  };

  // Add parsed Ledger transactions (source: 'LEDGER')
  const handleAddLedgerToReconciliation = () => {
    if (!ledgerResults || ledgerResults.parsedRows.length === 0) return;

    const newTransactions: BankTransaction[] = ledgerResults.parsedRows.map((row, idx) => ({
      id: `led-tx-${Date.now()}-${idx}`,
      source: 'LEDGER',
      bankCode: row.bankCode,
      bankName: row.bankName,
      referenceNum: row.referenceNum,
      txDate: row.txDate,
      txType: row.txType,
      amountNominal: row.amountNominal,
      currency: row.currency,
      bcvRate,
      amountVes: row.currency === 'USD' ? row.amountNominal * bcvRate : row.amountNominal,
      rawDescription: row.rawDescription,
      counterpartyRif: row.counterpartyRif,
      accountCode: row.accountCode || '1.1.01.02.001',
      accountName: row.accountName || `${row.bankName} Cta Corriente`,
      matchingStatus: 'UNMATCHED',
      moduleTag: 'MOD_VENTAS',
      notes: row.rationale,
      createdAt: new Date().toISOString()
    }));

    onAddParsedTransactions(newTransactions);
    setAddedLedgerSuccess(true);
  };

  // Incorporate balanced journal entries as internal ledger items
  const handleIncorporateGeneratedEntriesAsLedger = () => {
    if (!bankResults || bankResults.generatedEntries.length === 0) return;

    const newTransactions: BankTransaction[] = bankResults.generatedEntries.map((entry, idx) => {
      // Find the line that affects the bank account
      const bankLine = entry.lines.find(l => l.accountCode.startsWith('1.1.01')) || entry.lines[0];
      const isIngreso = bankLine.debe > 0;
      const nominal = isIngreso ? bankLine.debe : bankLine.haber;

      return {
        id: `led-gen-${Date.now()}-${idx}`,
        source: 'LEDGER',
        bankCode: selectedBankCode,
        bankName: supportedBanks.find(b => b.code === selectedBankCode)?.name || 'Banco Universal',
        referenceNum: entry.reference,
        txDate: entry.date,
        txType: isIngreso ? 'CREDIT' : 'DEBIT',
        amountNominal: nominal,
        currency,
        bcvRate,
        amountVes: currency === 'USD' ? nominal * bcvRate : nominal,
        rawDescription: `${entry.description} (Asiento Contable Generado)`,
        accountCode: bankLine.accountCode,
        accountName: bankLine.accountName,
        matchingStatus: 'UNMATCHED',
        moduleTag: entry.moduleTag,
        notes: `Asiento generado bajo Ven-NIF por IA para comprobante ${entry.reference}`,
        createdAt: new Date().toISOString()
      };
    });

    onAddParsedTransactions(newTransactions);
    setAddedLedgerSuccess(true);
  };

  const handleCopyJournal = (entry: JournalEntry) => {
    const text = `Asiento: ${entry.reference} - ${entry.description}\n` +
      entry.lines.map(l => `${l.accountCode} | ${l.accountName} | Debe: ${l.debe.toFixed(2)} | Haber: ${l.haber.toFixed(2)}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to load sample ledger format
  const handleLoadSampleLedger = () => {
    const sample = `FECHA\tREFERENCIA\tCONCEPTO\tDEBE\tHABER
10/05/2024\tTRF-0019283\tCobro Factura 00412 Distribuidora Los Andes\t45.000,00\t0,00
11/05/2024\tTRF-0004521\tPago Proveedor Materiales Eléctricos C.A.\t0,00\t18.250,00
12/05/2024\tTRF-0084920\tNómina Primera Quincena Mayo Personal\t0,00\t12.800,00
13/05/2024\tPAGO-992182\tPago Impuesto Retención IVA SENIAT\t0,00\t4.500,00
14/05/2024\tDEP-0048192\tLiquidación Puntos de Venta (POS) Lote 492\t32.100,00\t0,00`;
    setPastedText(sample);
  };

  const handleLoadSampleBank = () => {
    const sample = `10/05/2024 REF: 0019283 CREDITO TRF RECIBIDA CLIENTE J-30492811-0 BS. 45.000,00
11/05/2024 REF: 0004521 DEBITO CHEQUE/TRANSFERENCIA PAGADA BS. 18.250,00
12/05/2024 REF: 0084920 DEBITO PAGO NOMINA EMPLEADOS BANCO BS. 12.800,00
13/05/2024 REF: 0048192 CREDITO LIQ POS CREDICARD LOTE 492 COMIS BS. 32.100,00
14/05/2024 REF: 9002199 DEBITO COMISION MANTENIMIENTO CUENTA BS. 150,00`;
    setPastedText(sample);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-purple-50/80 via-white to-sky-50/80 p-5 rounded-2xl border border-purple-200/70 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Carga Inteligente: Extracto Bancario & Libro Contable de Banco
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  Ven-NIF Experto
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                La conciliación bancaria compara dos fuentes: el <strong>Estado de Cuenta del Banco</strong> (fuente externa) contra el <strong>Libro Mayor de Banco</strong> (tu contabilidad interna). Selecciona qué deseas cargar abajo.
              </p>
            </div>
          </div>
        </div>

        {/* SELECTOR PRINCIPAL: EXTRACTO BANCARIO vs LIBRO CONTABLE */}
        <div className="mt-4 pt-3 border-t border-purple-100/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          <button
            type="button"
            onClick={() => {
              setImportMode('BANK');
              setPastedText('');
              setAddedSuccess(false);
            }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              importMode === 'BANK'
                ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-300 shadow-xs'
                : 'bg-white border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              importMode === 'BANK' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">1. Estado de Cuenta Bancario</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold">Columna Izquierda</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Movimientos reales emitidos por el banco (Banesco, BDV, Mercantil, etc.).
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportMode('LEDGER');
              setPastedText('');
              setAddedLedgerSuccess(false);
            }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              importMode === 'LEDGER'
                ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-300 shadow-xs'
                : 'bg-white border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              importMode === 'LEDGER' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">2. Libro Contable de Banco (Mayor)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Columna Derecha</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Asientos contables internos exportados de Profit Plus, Gálac, Saint, SAP o Excel.
              </p>
            </div>
          </button>

        </div>
      </div>

      {/* Input Form & Bank Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700">
              {importMode === 'BANK' ? 'Banco del Extracto:' : 'Cuenta Bancaria Contable a Conciliar:'}
            </label>
            <select
              value={selectedBankCode}
              onChange={(e) => setSelectedBankCode(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none cursor-pointer"
            >
              {VENEZUELAN_BANKS.map(b => (
                <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-slate-500">Selección rápida:</span>
            {supportedBanks.map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => setSelectedBankCode(b.code)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
                  selectedBankCode === b.code
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
              >
                {b.name}
              </button>
            ))}

            <button
              type="button"
              onClick={importMode === 'BANK' ? handleLoadSampleBank : handleLoadSampleLedger}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer ml-1"
            >
              Cargar formato de prueba
            </button>
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {importMode === 'BANK'
                ? 'Pega las líneas de tu extracto bancario (copiado de banca online, PDF o archivo):'
                : 'Pega las líneas de tu Libro Mayor de Banco (copiadas de Excel, Profit Plus, Gálac, Saint o SAP):'}
            </span>
            <span className="text-[11px] font-mono">
              {pastedText ? `${pastedText.split('\n').filter(l => l.trim()).length} líneas ingresadas` : 'Vacío'}
            </span>
          </div>

          <textarea
            rows={7}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={
              importMode === 'BANK'
                ? `Pega aquí los movimientos del extracto bancario...\nEjemplo:\n10/05/2024 REF: 0019283 CREDITO TRF RECIBIDA CLIENTE J-30492811-0 BS. 45.000,00\n11/05/2024 REF: 0004521 DEBITO PAGO PROVEEDOR MATERIALES BS. 18.250,00`
                : `Pega aquí los asientos de tu Libro Mayor de Banco de la empresa...\nPuedes pegar columnas de Excel directamente con: Fecha | Referencia | Beneficiario/Concepto | Debe | Haber\nEjemplo:\n10/05/2024\tTRF-0019283\tCobro Factura 00412 Cliente\t45.000,00\t0,00\n11/05/2024\tCHQ-0004521\tPago Proveedor Materiales\t0,00\t18.250,00`
            }
            className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-purple-400 focus:outline-none transition-colors"
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <BrainCircuit className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            {importMode === 'BANK'
              ? 'La IA extraerá cada movimiento bancario y propondrá los asientos contables Ven-NIF correspondientes.'
              : 'El motor detectará fechas, números de comprobante/referencia, Debe (ingresos) y Haber (egresos) contables.'}
          </span>

          <button
            onClick={handleProcessText}
            disabled={isLoading || !pastedText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analizando datos contables...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {importMode === 'BANK' ? 'Procesar Extracto Bancario Real' : 'Procesar Libro Contable de Banco'}
                </span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* RESULTS: LEDGER MODE */}
      {importMode === 'LEDGER' && ledgerResults && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold block">{ledgerResults.summary}</span>
                <span className="text-[11px] text-emerald-800">
                  Total Debe (Entradas): {currency === 'VES' ? 'Bs.' : '$'} {ledgerResults.totalDebe.toLocaleString('es-VE', { minimumFractionDigits: 2 })} | Total Haber (Salidas): {currency === 'VES' ? 'Bs.' : '$'} {ledgerResults.totalHaber.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              onClick={handleAddLedgerToReconciliation}
              disabled={addedLedgerSuccess}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                addedLedgerSuccess
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {addedLedgerSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Libro Incorporado al Mayor de Bancos!</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Incorporar al Mayor de Bancos ({ledgerResults.parsedRows.length} Asientos)</span>
                </>
              )}
            </button>
          </div>

          {/* Table of Ledger rows */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>Asientos del Mayor Contable Listos para Conciliar ({ledgerResults.parsedRows.length})</span>
              <span className="text-[11px] font-normal text-slate-500">
                Se cargarán en la columna derecha de la Mesa de Conciliación
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto p-2 space-y-2">
              {ledgerResults.parsedRows.map((row, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{row.referenceNum}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{row.txDate}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        row.txType === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {row.txType === 'CREDIT' ? 'Debe (Ingreso)' : 'Haber (Egreso)'}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{row.rawDescription}</p>
                    <span className="text-[10px] text-slate-500 font-mono">Cta: {row.accountCode} - {row.accountName}</span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono font-bold text-xs block ${
                      row.txType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {row.txType === 'CREDIT' ? '+' : '-'}{currency === 'VES' ? 'Bs.' : '$'} {row.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESULTS: BANK MODE */}
      {importMode === 'BANK' && bankResults && (
        <div className="space-y-4">
          
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
              <span className="text-xs font-semibold">{bankResults.summary}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAddAllToReconciliation}
                disabled={addedSuccess}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  addedSuccess
                    ? 'bg-sky-800 text-white'
                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                }`}
              >
                {addedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Extracto Cargado a Conciliación!</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>1. Cargar como Extracto Bancario ({bankResults.parsedRows.length})</span>
                  </>
                )}
              </button>

              <button
                onClick={handleIncorporateGeneratedEntriesAsLedger}
                disabled={addedLedgerSuccess}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  addedLedgerSuccess
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                }`}
                title="Genera automáticamente los asientos contables para llenar la columna de libros contables si no tienes un Excel a mano"
              >
                {addedLedgerSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>¡Asientos Incorporados a Libros!</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>2. Generar Asientos en Mayor de Libros</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid of Results: Extracted Rows & Balanced Journal Entries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Left: Extracted Transacciones */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
                1. Movimientos Identificados en Extracto ({bankResults.parsedRows.length})
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto p-2 space-y-2">
                {bankResults.parsedRows.map((row, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{row.referenceNum}</span>
                      <span className={`font-mono font-bold ${row.txType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {row.txType === 'CREDIT' ? '+' : '-'}{currency === 'VES' ? 'Bs.' : '$'} {row.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{row.rawDescription}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                        {row.suggestedAccountCode}
                      </span>
                      <span className="text-slate-600 font-medium">{row.suggestedAccountName}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic pt-1">{row.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Generated Comprobantes de Diario (Balanced) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                <span>2. Asientos Contables Ven-NIF Generados ({bankResults.generatedEntries.length})</span>
                <span className="text-[10px] font-semibold text-emerald-700">Debe = Haber (Balanceados)</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto p-2 space-y-3">
                {bankResults.generatedEntries.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{entry.reference}</span>
                        <span className="text-slate-400 font-mono text-[10px]">{entry.date}</span>
                      </div>
                      <button
                        onClick={() => handleCopyJournal(entry)}
                        className="flex items-center gap-1 text-[10px] text-purple-700 hover:text-purple-900 font-bold cursor-pointer"
                      >
                        {copiedId === entry.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedId === entry.id ? 'Copiado' : 'Copiar Asiento'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600">{entry.description}</p>

                    {/* Table Debe / Haber */}
                    <table className="w-full text-[11px] font-mono border-t border-slate-100 pt-1">
                      <thead>
                        <tr className="text-slate-400 font-medium text-left">
                          <th className="py-1">Cuenta</th>
                          <th className="py-1 text-right">Debe</th>
                          <th className="py-1 text-right">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {entry.lines.map((l, lIdx) => (
                          <tr key={lIdx}>
                            <td className="py-1 text-slate-800 font-sans">
                              <span className="font-mono text-purple-700 font-semibold">{l.accountCode}</span> - {l.accountName}
                            </td>
                            <td className="py-1 text-right font-semibold text-emerald-700">
                              {l.debe > 0 ? l.debe.toFixed(2) : '-'}
                            </td>
                            <td className="py-1 text-right font-semibold text-slate-900">
                              {l.haber > 0 ? l.haber.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-bold text-slate-900">
                          <td className="py-1 font-sans">TOTALES BALANCEADOS</td>
                          <td className="py-1 text-right text-emerald-700">{entry.totalDebe.toFixed(2)}</td>
                          <td className="py-1 text-right text-slate-900">{entry.totalHaber.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
