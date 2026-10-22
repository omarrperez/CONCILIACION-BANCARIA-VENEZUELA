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
  RotateCcw,
  HelpCircle,
  Info,
  Layers,
  Grid,
  SlidersHorizontal,
  ArrowRightCircle,
  CheckCircle,
  Trash2
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
  onOpenTourOverlay?: () => void;
  onOpenClearModal?: () => void;
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
  onOpenRestoreModal,
  onOpenTourOverlay,
  onOpenClearModal
}) => {
  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Transaction counts
  const bankTx = transactions.filter(t => t.source === 'BANK' && t.currency === currency);
  const ledgerTx = transactions.filter(t => t.source === 'LEDGER' && t.currency === currency);
  const matchedTx = transactions.filter(t => t.currency === currency && (t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY'));
  const unmatchedTx = transactions.filter(t => t.currency === currency && t.matchingStatus === 'UNMATCHED');

  const hasBankData = bankTx.length > 0;
  const hasLedgerData = ledgerTx.length > 0;
  const hasBothData = hasBankData && hasLedgerData;

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

  // Automatically determine current active step (1 to 5)
  const computedStep: number = React.useMemo<number>(() => {
    if (!hasBothData) return 1;
    if (initialBalanceBank === 0 && initialBalanceLedger === 0) return 2;
    if (matchedTx.length === 0) return 3;
    if (unmatchedTx.length > 0) return 4;
    return 5;
  }, [hasBothData, initialBalanceBank, initialBalanceLedger, matchedTx.length, unmatchedTx.length]);

  // Active step in Wizard view mode (defaults to computed step)
  const [selectedStep, setSelectedStep] = React.useState<number>(1);

  // Sync selectedStep if computedStep changes and user hasn't explicitly clicked away
  React.useEffect(() => {
    setSelectedStep(computedStep);
  }, [computedStep]);

  // View Mode: 'GUIDED' (Wizard 1 step at a time) vs 'EXPANDED' (all 5 cards)
  const [viewMode, setViewMode] = React.useState<'GUIDED' | 'EXPANDED'>('GUIDED');

  const stepsInfo = [
    {
      step: 1,
      title: 'Paso 1: Cargar Movimientos',
      shortTitle: '1. Cargar Datos',
      color: 'sky',
      bgColor: 'bg-sky-500',
      badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
      description: 'Carga o pega tu extracto bancario y el libro mayor contable.',
      isDone: hasBothData
    },
    {
      step: 2,
      title: 'Paso 2: Saldos Iniciales',
      shortTitle: '2. Saldos Apertura',
      color: 'indigo',
      bgColor: 'bg-indigo-500',
      badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      description: 'Confirma los saldos de inicio de período para banco y libros.',
      isDone: hasBothData && initialBalanceBank !== 0
    },
    {
      step: 3,
      title: 'Paso 3: Auto-Cruce Ven-NIF',
      shortTitle: '3. Cruce Automático',
      color: 'purple',
      bgColor: 'bg-purple-500',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      description: 'El motor compara referencias, fechas ±3 días y montos exactos.',
      isDone: matchedTx.length > 0
    },
    {
      step: 4,
      title: 'Paso 4: Ajustar Pendientes',
      shortTitle: '4. Resolver Pendientes',
      color: 'amber',
      bgColor: 'bg-amber-500',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      description: 'Revisa notas de débito/crédito, IGTF y comisiones no registradas.',
      isDone: hasBothData && unmatchedTx.length === 0 && matchedTx.length > 0
    },
    {
      step: 5,
      title: 'Paso 5: Cierre & Cédula',
      shortTitle: '5. Cierre & Exportación',
      color: 'emerald',
      bgColor: 'bg-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      description: 'Obtén la Prueba de Efectivo de 4 columnas y exporta a tu ERP.',
      isDone: proofOfCash.isBalanced
    }
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6">
      
      {/* Header with Title, Mode Switcher & Global Progress Gauge */}
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
              Empresa: <strong className="text-slate-800">{company.companyName}</strong> ({company.companyRif})
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Asistente Intuitivo de Conciliación Bancaria Mensual
          </h2>
          <p className="text-xs text-slate-600 font-medium max-w-2xl">
            Sigue cada paso en orden. El sistema guiará tu trabajo punto por punto para que no te sientas perdido y obtengas una conciliación cuadrada al 100%.
          </p>
        </div>

        {/* View Mode Toggle Switcher + Progress Gauge */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Toggle buttons */}
          <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center shrink-0">
            <button
              onClick={() => setViewMode('GUIDED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'GUIDED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Muestra solo el paso activo actual sin saturar la pantalla de botones"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>🎯 Modo Guiado (Paso a Paso)</span>
            </button>
            <button
              onClick={() => setViewMode('EXPANDED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'EXPANDED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Muestra las 5 tarjetas simultáneamente en pantalla"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>📊 Vista Completa</span>
            </button>

            {onOpenTourOverlay && (
              <button
                onClick={onOpenTourOverlay}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                title="Abrir Tour Guiado Interactivo de 5 Pasos en pantalla flotante"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                <span>🎓 Tour Guiado</span>
              </button>
            )}
          </div>

          {/* Global Progress Gauge */}
          <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200 flex items-center gap-3 min-w-[220px]">
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800">Avance</span>
                <span className="font-mono font-black text-emerald-700 text-xs">{matchPercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden p-0.5 border border-slate-300/50">
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
      </div>

      {/* ----------------- MODO GUIADO PASO A PASO (DEFAULT RECOMENDADO) ----------------- */}
      {viewMode === 'GUIDED' && (
        <div className="space-y-5">
          {/* Top 5 Steps Interactive Ribbon Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-slate-100/80 p-2 rounded-2xl border border-slate-200/90">
            {stepsInfo.map(info => {
              const isSelected = selectedStep === info.step;
              const isCurrentRecommended = computedStep === info.step;

              return (
                <button
                  key={info.step}
                  onClick={() => setSelectedStep(info.step)}
                  className={`p-2.5 rounded-xl transition-all text-left flex items-center justify-between cursor-pointer border ${
                    isSelected
                      ? 'bg-white border-slate-900 text-slate-900 shadow-sm ring-2 ring-slate-900/10'
                      : 'bg-white/60 hover:bg-white border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0 ${
                      info.isDone ? 'bg-emerald-600' : isSelected ? info.bgColor : 'bg-slate-400'
                    }`}>
                      {info.isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : info.step}
                    </span>
                    <span className="text-xs font-bold truncate">
                      {info.shortTitle}
                    </span>
                  </div>
                  {isCurrentRecommended && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" title="Paso Recomendado Ahora" />
                  )}
                </button>
              );
            })}
          </div>

          {/* SINGLE FOCUSED STEP CONTAINER - Minimal design, zero confusion */}
          <div className="p-6 rounded-3xl border-2 border-slate-900 bg-gradient-to-br from-white via-slate-50/50 to-white shadow-md space-y-6">
            
            {/* Step Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-base shadow-sm">
                  {selectedStep}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Paso {selectedStep} de 5
                    </span>
                    {computedStep === selectedStep && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                        📌 Recomendado Ahora
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {stepsInfo[selectedStep - 1].title}
                  </h3>
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-500 bg-white px-3.5 py-2 rounded-2xl border border-slate-200">
                {stepsInfo[selectedStep - 1].description}
              </div>
            </div>

            {/* FOCUSED CONTENT ACCORDING TO SELECTED STEP */}

            {/* STEP 1: CARGA DE ARCHIVOS */}
            {selectedStep === 1 && (
              <div className="space-y-5">
                <div className="bg-sky-50/80 p-4 rounded-2xl border border-sky-200 text-xs text-sky-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sky-900 text-sm">
                    <Info className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>¿Qué debes hacer en el Paso 1?</span>
                  </div>
                  <p className="leading-relaxed text-sky-900">
                    Sube o pega la información de tu <strong>banco</strong> y tu <strong>libro mayor contable</strong>. Si no tienes archivo Excel, puedes copiar la tabla de tu PDF o portal bancario y usar el botón verde de <strong>"Pegar Texto Copiado"</strong>.
                  </p>
                </div>

                {/* Status indicator box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                    bankTx.length > 0 ? 'bg-emerald-50/70 border-emerald-400' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-600 block">1. Extracto del Banco ({sym}):</span>
                      <strong className={`text-sm font-extrabold font-mono ${bankTx.length > 0 ? 'text-emerald-800' : 'text-slate-400'}`}>
                        {bankTx.length > 0 ? `${bankTx.length} movimientos listos ✓` : 'Sin datos cargados'}
                      </strong>
                    </div>
                    <button
                      onClick={() => onOpenUploadModal('BANK', 'PASTE')}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      <span>Cargar / Pegar Banco</span>
                    </button>
                  </div>

                  <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                    ledgerTx.length > 0 ? 'bg-emerald-50/70 border-emerald-400' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-600 block">2. Libro Mayor Contable ({sym}):</span>
                      <strong className={`text-sm font-extrabold font-mono ${ledgerTx.length > 0 ? 'text-emerald-800' : 'text-slate-400'}`}>
                        {ledgerTx.length > 0 ? `${ledgerTx.length} movimientos listos ✓` : 'Sin datos cargados'}
                      </strong>
                    </div>
                    <button
                      onClick={() => onOpenUploadModal('LEDGER', 'PASTE')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Cargar / Pegar Libro Mayor</span>
                    </button>
                  </div>
                </div>

                {/* Banner de Limpieza Rápida en Paso 1 */}
                {transactions.length > 0 && onOpenClearModal && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-rose-950">
                    <div className="flex items-center gap-2 font-semibold">
                      <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>¿Quieres vaciar los datos cargados actualmente para volver a vaciar un extracto o libro nuevo desde cero?</span>
                    </div>
                    <button
                      onClick={onOpenClearModal}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-2xs cursor-pointer transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpiar Todo y Reiniciar</span>
                    </button>
                  </div>
                )}

                {/* Single Clear Next Step Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedStep(2)}
                    className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Continuar al Paso 2: Saldos Iniciales →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SALDOS INICIALES */}
            {selectedStep === 2 && (
              <div className="space-y-5">
                <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                    <Info className="w-4 h-4 text-indigo-700 shrink-0" />
                    <span>¿Qué debes hacer en el Paso 2?</span>
                  </div>
                  <p className="leading-relaxed text-indigo-900">
                    Verifica o edita el <strong>Saldo Inicial del Banco</strong> y el <strong>Saldo Inicial del Libro Mayor</strong> con el que arranca este mes. Si tus datos provienen de un estado de cuenta regular, coloca el valor del encabezado.
                  </p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-indigo-200 shadow-2xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-800 block">
                        Saldo Inicial Banco ({sym}):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={tempBankBal}
                        onChange={(e) => setTempBankBal(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-mono text-sm font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-800 block">
                        Saldo Inicial Libro Mayor ({sym}):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={tempLedgerBal}
                        onChange={(e) => setTempLedgerBal(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-mono text-sm font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={handleSaveBalances}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>Guardar Saldos Iniciales</span>
                    </button>

                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>Saldos de Apertura Calibrados</span>
                    </span>
                  </div>
                </div>

                {/* Single Clear Next Step Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedStep(3)}
                    className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Continuar al Paso 3: Cruce Automático →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: AUTO-CRUCE */}
            {selectedStep === 3 && (
              <div className="space-y-5">
                <div className="bg-purple-50/80 p-4 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
                    <Info className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>¿Qué debes hacer en el Paso 3?</span>
                  </div>
                  <p className="leading-relaxed text-purple-900">
                    Presiona el botón de abajo para que el motor inteligente compare automáticamente los últimos 4 dígitos de la referencia, fecha cercana y montos idénticos entre tu banco y tu contabilidad.
                  </p>
                </div>

                <div className="p-6 bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl border border-purple-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-400 text-slate-950">
                      Algoritmo Ven-NIF BNC/Banesco/BDV/Mercantil
                    </span>
                    <h4 className="text-base font-extrabold text-white">
                      Motor de Conciliación Automática en 1 Segundo
                    </h4>
                    <p className="text-xs text-purple-200 font-medium max-w-lg">
                      Pariación inteligente de movimientos bancarios y contables. Procesa cientos de transacciones al instante.
                    </p>
                  </div>

                  <button
                    onClick={onRunReconciliation}
                    className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0 animate-pulse"
                  >
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>⚡ Ejecutar Cruce Automático Ahora</span>
                  </button>
                </div>

                {matchedTx.length > 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center justify-between">
                    <span>¡Éxito! Se han cruzado {matchedTx.length} partidas correctamente.</span>
                    <span className="font-mono text-emerald-800">{matchPercentage}% de coincidencia</span>
                  </div>
                )}

                {/* Single Clear Next Step Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedStep(4)}
                    className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Continuar al Paso 4: Ajustar Pendientes →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVISAR PENDIENTES */}
            {selectedStep === 4 && (
              <div className="space-y-5">
                <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>¿Qué debes hacer en el Paso 4?</span>
                  </div>
                  <p className="leading-relaxed text-amber-900">
                    Revisa las partidas que no se cruzaron automáticamente. Por ejemplo: comisiones bancarias, IGTF 3%, o transferencias pendientes. Haz clic en <strong>"Mesa de Trabajo"</strong> para solucionarlas rápidamente.
                  </p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-amber-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-amber-800 block">Estado de Partidas:</span>
                    <strong className="text-sm font-black text-slate-900 font-mono">
                      {unmatchedTx.length === 0 ? '0 Partidas Pendientes (Todo al día) ✓' : `${unmatchedTx.length} partidas pendientes por conciliar`}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onOpenAdjustments}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Ver Ajustes Sugeridos</span>
                    </button>
                    <button
                      onClick={onNavigateToWorkspace}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>Abrir Mesa de Trabajo →</span>
                    </button>
                  </div>
                </div>

                {/* Single Clear Next Step Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedStep(5)}
                    className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Continuar al Paso 5: Cierre & Cédula →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: CIERRE Y CÉDULA */}
            {selectedStep === 5 && (
              <div className="space-y-5">
                <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                    <Info className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>¿Qué debes hacer en el Paso 5?</span>
                  </div>
                  <p className="leading-relaxed text-emerald-900">
                    ¡Felicitaciones! Revisa la <strong>Prueba de Efectivo de 4 columnas</strong> y exporta los archivos Excel para tu sistema de contabilidad (SGT, Gálac, Profit, Saint o Valery).
                  </p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-emerald-200 shadow-2xs space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Saldo Extracto Banco</span>
                      <strong className="font-mono text-sm font-extrabold text-slate-900">{sym} {proofOfCash.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 font-bold block">(+) Depósitos Tránsito</span>
                      <strong className="font-mono text-sm font-extrabold text-emerald-800">+{sym} {proofOfCash.depositsInTransit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] text-rose-800 font-bold block">(-) Cheques Pendientes</span>
                      <strong className="font-mono text-sm font-extrabold text-rose-800">-{sym} {proofOfCash.outstandingChecks.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                      <span className="text-[10px] text-sky-800 font-bold block">(=) Saldo Conciliado</span>
                      <strong className="font-mono text-sm font-extrabold text-sky-900">{sym} {proofOfCash.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-emerald-800">
                      {proofOfCash.isBalanced ? '✓ Prueba de Efectivo Cuadrada al 100%' : `Diferencia por Cuadrar: ${sym} ${proofOfCash.difference.toFixed(2)}`}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={onNavigateToResults}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <span>Ver Diagnóstico Completo →</span>
                      </button>
                      <button
                        onClick={onOpenExportModal}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Exportar Excel (SGT / Gálac)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ----------------- VISTA COMPLETA (5 TARJETAS EXPANDIDAS) ----------------- */}
      {viewMode === 'EXPANDED' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          
          {/* PASO 1 - Carga (Borde Azul / Sky) */}
          <div className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
            hasBothData
              ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/30 shadow-xs'
              : computedStep === 1
              ? 'border-sky-500 border-l-8 border-l-sky-600 bg-sky-50/80 ring-2 ring-sky-300 shadow-md'
              : 'border-sky-400 border-l-8 border-l-sky-500 bg-sky-50/40 shadow-xs'
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
            hasBothData && computedStep === 2
              ? 'border-indigo-500 border-l-8 border-l-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-300 shadow-md'
              : 'border-indigo-400 border-l-8 border-l-indigo-500 bg-indigo-50/30 shadow-xs'
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
              ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/30 shadow-xs'
              : 'border-purple-500 border-l-8 border-l-purple-600 bg-purple-50/50 shadow-xs'
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
              ? 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/30 shadow-xs'
              : 'border-amber-500 border-l-8 border-l-amber-600 bg-amber-50/50 shadow-xs'
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
              : 'border-emerald-500 border-l-8 border-l-emerald-600 bg-emerald-50/40 shadow-xs'
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
      )}

      {/* BANNER UNIFICADO DE SIGUIENTE PASO RECOMENDADO - Elimina la desorientación al final de la página */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
              📌 Paso Recomendado Ahora
            </span>
            <span className="text-xs font-bold text-slate-300">
              {computedStep === 1 && 'Paso 1: Carga de Archivos'}
              {computedStep === 2 && 'Paso 2: Saldos Iniciales'}
              {computedStep === 3 && 'Paso 3: Conciliación Automática'}
              {computedStep === 4 && 'Paso 4: Revisión de Partidas y Ajustes'}
              {computedStep === 5 && 'Paso 5: Cierre y Exportación'}
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
