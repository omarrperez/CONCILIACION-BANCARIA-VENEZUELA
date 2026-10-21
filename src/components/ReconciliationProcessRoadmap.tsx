import React from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  BookOpen,
  Building,
  Check,
  Settings,
  ShieldCheck,
  Download,
  Scale,
  Zap,
  ChevronRight,
  Edit3,
  Save,
  Camera,
  RotateCcw
} from 'lucide-react';
import { BankTransaction, CurrencyType, ProofOfCash, UserCompanyProfile } from '../types/accounting';

interface ReconciliationProcessRoadmapProps {
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  company: UserCompanyProfile;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  proofOfCash: ProofOfCash;
  onOpenUploadModal: (source: 'BANK' | 'LEDGER', mode: 'FILE' | 'PASTE') => void;
  onNavigateToWorkspace: () => void;
  onNavigateToResults: () => void;
  onOpenProofModal: () => void;
  onOpenExportModal: () => void;
  onOpenAdjustments: () => void;
  onRunReconciliation: () => void;
  onUpdateInitialBalances?: (bankBal: number, ledgerBal: number) => void;
  onOpenRestoreModal?: () => void;
}

export const ReconciliationProcessRoadmap: React.FC<ReconciliationProcessRoadmapProps> = ({
  transactions,
  currency,
  bcvRate,
  company,
  initialBalanceBank,
  initialBalanceLedger,
  proofOfCash,
  onOpenUploadModal,
  onNavigateToWorkspace,
  onNavigateToResults,
  onOpenProofModal,
  onOpenExportModal,
  onOpenAdjustments,
  onRunReconciliation,
  onUpdateInitialBalances,
  onOpenRestoreModal
}) => {
  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Counts
  const bankTx = transactions.filter(t => t.source === 'BANK' && t.currency === currency);
  const ledgerTx = transactions.filter(t => t.source === 'LEDGER' && t.currency === currency);
  const matchedTx = transactions.filter(t => t.currency === currency && (t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY'));
  const unmatchedTx = transactions.filter(t => t.currency === currency && t.matchingStatus === 'UNMATCHED');

  const hasBankData = bankTx.length > 0;
  const hasLedgerData = ledgerTx.length > 0;
  const hasBothData = hasBankData && hasLedgerData;

  const totalPossible = Math.max(bankTx.length, ledgerTx.length, 1);
  const matchPercentage = Math.round((matchedTx.length / (transactions.length || 1)) * 100);

  // Balance editing state for Step 2
  const [isEditingBalances, setIsEditingBalances] = React.useState(false);
  const [tempBankBal, setTempBankBal] = React.useState(initialBalanceBank.toString());
  const [tempLedgerBal, setTempLedgerBal] = React.useState(initialBalanceLedger.toString());

  React.useEffect(() => {
    setTempBankBal(initialBalanceBank.toString());
    setTempLedgerBal(initialBalanceLedger.toString());
  }, [initialBalanceBank, initialBalanceLedger]);

  const handleSaveBalances = () => {
    if (onUpdateInitialBalances) {
      const b = parseFloat(tempBankBal.replace(',', '.')) || 0;
      const l = parseFloat(tempLedgerBal.replace(',', '.')) || 0;
      onUpdateInitialBalances(b, l);
    }
    setIsEditingBalances(false);
  };

  // Determine current active step (1 to 5)
  let currentStep = 1;
  if (!hasBothData) {
    currentStep = 1;
  } else if (matchedTx.length === 0) {
    currentStep = 3; // Ready to reconcile
  } else if (unmatchedTx.length > 0) {
    currentStep = 4; // Resolve pending
  } else {
    currentStep = 5; // Ready to export
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6">
      
      {/* Header with Title, Active Period & Overall Progress Gauge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
              Página 1: Proceso Guiado
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
              Normas Ven-NIF & SUDEBAN
            </span>
            <span className="text-xs text-slate-500 font-bold">
              Período Activo: {new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }).toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Flujo Guiado de Conciliación Bancaria Mensual
          </h2>
          <p className="text-xs text-slate-600 font-medium max-w-2xl">
            Proceso secuencial de 5 pasos diseñado conforme a las prácticas de ingeniería financiera y auditoría bancaria en Venezuela. Sigue el orden correlativo de las tarjetas con bordes de colores para completar el cierre mensual.
          </p>
        </div>

        {/* Global Progress Gauge */}
        <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200 flex items-center gap-4 min-w-[280px]">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-800">Avance de Conciliación</span>
              <span className="font-mono font-black text-emerald-700 text-sm">{matchPercentage}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-300/50">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(hasBothData ? 25 : 5, matchPercentage))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>{matchedTx.length} cruzadas</span>
              <span>{unmatchedTx.length} pendientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Steps Grid Cards con Bordes de Colores Vibrantes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* PASO 1 - Carga (Borde Azul / Sky) */}
        <div className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
          hasBothData
            ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/30 shadow-xs hover:shadow-md'
            : currentStep === 1
            ? 'border-sky-500 border-l-8 border-l-sky-600 bg-sky-50/80 ring-2 ring-sky-300 shadow-md'
            : 'border-sky-400 border-l-8 border-l-sky-500 bg-sky-50/40 shadow-xs hover:shadow-md'
        }`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-2xs ${
                hasBothData ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'
              }`}>
                {hasBothData ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                hasBothData
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : hasBankData
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-sky-100 text-sky-900 border border-sky-300'
              }`}>
                {hasBothData ? 'Listo ✓' : hasBankData ? 'Falta Mayor' : 'Paso 1: Carga'}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Paso 1: Cargar Movimientos
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug font-medium">
                Importa el extracto del banco y el libro mayor contable.
              </p>
            </div>

            <div className="text-[11px] font-mono text-slate-800 space-y-1 p-2 rounded-xl bg-white/80 border border-sky-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Extracto Banco:</span>
                <strong className={bankTx.length > 0 ? 'text-sky-800 font-extrabold' : 'text-slate-400'}>{bankTx.length} movs</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Libro Mayor:</span>
                <strong className={ledgerTx.length > 0 ? 'text-emerald-800 font-extrabold' : 'text-slate-400'}>{ledgerTx.length} movs</strong>
              </div>
            </div>
          </div>

          <div className="pt-3 space-y-1.5 border-t border-sky-200/80 mt-3">
            <button
              onClick={() => onOpenUploadModal('BANK', 'PASTE')}
              className="w-full py-1.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Pegar Extracto Banco</span>
            </button>
            <button
              onClick={() => onOpenUploadModal('LEDGER', 'PASTE')}
              className="w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Cargar Libro Mayor</span>
            </button>
          </div>
        </div>

        {/* PASO 2 - Saldos Apertura (Borde Índigo) */}
        <div className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
          hasBothData && currentStep === 2
            ? 'border-indigo-500 border-l-8 border-l-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-300 shadow-md'
            : 'border-indigo-400 border-l-8 border-l-indigo-500 bg-indigo-50/30 shadow-xs hover:shadow-md'
        }`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                2
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300">
                Paso 2: Saldos
              </span>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Paso 2: Saldos Iniciales
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug font-medium">
                Saldos de apertura del período para banco y libros.
              </p>
            </div>

            {isEditingBalances ? (
              <div className="space-y-1.5 pt-1 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block">Banco Inicial ({sym}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tempBankBal}
                    onChange={(e) => setTempBankBal(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-indigo-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block">Libro Inicial ({sym}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tempLedgerBal}
                    onChange={(e) => setTempLedgerBal(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-indigo-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    onClick={handleSaveBalances}
                    className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Guardar</span>
                  </button>
                  <button
                    onClick={() => setIsEditingBalances(false)}
                    className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-slate-800 space-y-1 p-2 rounded-xl bg-white/80 border border-indigo-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Banco Inicial:</span>
                  <strong className="text-slate-900 font-extrabold">{sym} {initialBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Libro Inicial:</span>
                  <strong className="text-slate-900 font-extrabold">{sym} {initialBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-indigo-200/80 mt-3 flex flex-col gap-1.5">
            {!isEditingBalances && onUpdateInitialBalances && (
              <button
                onClick={() => setIsEditingBalances(true)}
                className="w-full py-1.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Calibrar Saldos Iniciales</span>
              </button>
            )}
            <button
              onClick={onNavigateToWorkspace}
              className="w-full py-1.5 px-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold border border-indigo-200 flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <span>Ver Mesa de Trabajo →</span>
            </button>
          </div>
        </div>

        {/* PASO 3 - Auto-Cruce (Borde Púrpura) */}
        <div className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
          matchedTx.length > 0
            ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/30 shadow-xs hover:shadow-md'
            : 'border-purple-500 border-l-8 border-l-purple-600 bg-purple-50/50 shadow-xs hover:shadow-md'
        }`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-2xs ${
                matchedTx.length > 0 ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'
              }`}>
                {matchedTx.length > 0 ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                matchedTx.length > 0
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-purple-100 text-purple-900 border border-purple-300'
              }`}>
                {matchedTx.length > 0 ? `${matchedTx.length} Cruzados ✓` : 'Paso 3: Cruce'}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Paso 3: Auto-Cruce
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug font-medium">
                Cruce por referencia de 4 dígitos, fecha ±3 días y montos.
              </p>
            </div>

            <div className="text-[11px] font-mono text-slate-800 space-y-1 p-2 rounded-xl bg-white/80 border border-purple-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Coincidentes:</span>
                <strong className="text-emerald-700 font-black">{matchedTx.length}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Pendientes:</span>
                <strong className={unmatchedTx.length > 0 ? 'text-amber-700 font-extrabold' : 'text-slate-400'}>
                  {unmatchedTx.length}
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-purple-200/80 mt-3">
            <button
              onClick={onRunReconciliation}
              className="w-full py-2 px-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Ejecutar Cruce Automático</span>
            </button>
          </div>
        </div>

        {/* PASO 4 - Ajuste de Huérfanos (Borde Ámbar) */}
        <div className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
          hasBothData && unmatchedTx.length === 0 && matchedTx.length > 0
            ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/30 shadow-xs hover:shadow-md'
            : 'border-amber-500 border-l-8 border-l-amber-600 bg-amber-50/50 shadow-xs hover:shadow-md'
        }`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-2xs ${
                unmatchedTx.length === 0 && matchedTx.length > 0 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}>
                {unmatchedTx.length === 0 && matchedTx.length > 0 ? <Check className="w-4 h-4 stroke-[3]" /> : '4'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Paso 4: Ajustes
              </span>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Paso 4: Ajustar Huérfanos
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug font-medium">
                Comisiones, IGTF, débitos y notas de crédito/débito.
              </p>
            </div>

            <div className="text-[11px] font-mono text-slate-800 space-y-1 p-2 rounded-xl bg-white/80 border border-amber-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Por Conciliar:</span>
                <strong className={unmatchedTx.length > 0 ? 'text-amber-800 font-extrabold' : 'text-emerald-700 font-black'}>
                  {unmatchedTx.length === 0 ? '0 (Todo Al Día)' : `${unmatchedTx.length} partidas`}
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-amber-200/80 mt-3">
            <button
              onClick={onOpenAdjustments}
              className="w-full py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ver Ajustes Sugeridos</span>
            </button>
          </div>
        </div>

        {/* PASO 5 - Cédula y Cierre (Borde Esmeralda) */}
        <div className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
          proofOfCash.isBalanced
            ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-300 shadow-md'
            : 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/40 shadow-xs hover:shadow-md'
        }`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                5
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                proofOfCash.isBalanced
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-teal-100 text-teal-900 border border-teal-300'
              }`}>
                {proofOfCash.isBalanced ? 'Cuadrado ✓' : 'Paso 5: Cierre'}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Paso 5: Cédula y ERP
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug font-medium">
                Prueba de efectivo (4 columnas) y exportación a SGT/Gálac.
              </p>
            </div>

            <div className="text-[11px] font-mono space-y-1 p-2 rounded-xl bg-white/80 border border-emerald-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Saldo Conciliado:</span>
                <strong className="text-slate-900 font-extrabold">{sym} {proofOfCash.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Diferencia:</span>
                <strong className={proofOfCash.isBalanced ? 'text-emerald-700 font-black' : 'text-rose-700 font-bold'}>
                  {proofOfCash.isBalanced ? 'Bs. 0,00' : `${sym} ${proofOfCash.difference.toFixed(2)}`}
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-3 space-y-1.5 border-t border-emerald-200/80 mt-3">
            <button
              onClick={onNavigateToResults}
              className="w-full py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <span>Ver Cédula y Prueba →</span>
            </button>
            <button
              onClick={onOpenExportModal}
              className="w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel (SGT/Gálac)</span>
            </button>
          </div>
        </div>

      </div>

      {/* BANNER UNIFICADO DE SIGUIENTE PASO RECOMENDADO - Elimina la desorientación al final de la página */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
              📌 Paso Recomendado Ahora
            </span>
            <span className="text-xs font-bold text-slate-300">
              {currentStep === 1 && 'Paso 1: Carga de Archivos'}
              {currentStep === 2 && 'Paso 2: Saldos Iniciales'}
              {currentStep === 3 && 'Paso 3: Conciliación Automática'}
              {currentStep === 4 && 'Paso 4: Revisión de Partidas y Ajustes'}
              {currentStep === 5 && 'Paso 5: Cierre y Exportación'}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-100 max-w-xl">
            {!hasBothData && 'Aún falta importar datos. Carga tu extracto bancario o pega el texto copiado de tu PDF para comenzar.'}
            {hasBothData && matchedTx.length === 0 && '¡Tus datos están cargados! Pulsa el botón a la derecha para ejecutar la conciliación en 1 segundo.'}
            {hasBothData && matchedTx.length > 0 && unmatchedTx.length > 0 && `Se han conciliado ${matchedTx.length} partidas. Quedan ${unmatchedTx.length} pendientes por revisar en la Mesa de Trabajo.`}
            {hasBothData && unmatchedTx.length === 0 && '¡Excelente! Todos los movimientos están cuadrados. Puedes revisar el informe o exportar tu archivo Excel.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!hasBothData ? (
            <button
              onClick={() => onOpenUploadModal('BANK', 'PASTE')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black text-xs shadow-lg cursor-pointer transition-all flex items-center gap-2"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Cargar o Pegar Texto del Banco →</span>
            </button>
          ) : matchedTx.length === 0 ? (
            <button
              onClick={onRunReconciliation}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-lg cursor-pointer transition-all flex items-center gap-2 animate-pulse"
            >
              <Zap className="w-4 h-4" />
              <span>⚡ Ejecutar Conciliación Automática →</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onNavigateToWorkspace}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Mesa de Trabajo →</span>
              </button>
              <button
                onClick={onNavigateToResults}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Ver Diagnóstico y Cédula →</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
