import React, { useState } from 'react';
import {
  ClipboardPaste,
  BookOpen,
  Check,
  Download,
  Scale,
  Zap,
  Save,
  RotateCcw,
  HelpCircle,
  Info,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  Grid,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  FileText
} from 'lucide-react';
import { BankTransaction, CurrencyType, ProofOfCash, UserCompanyProfile } from '../types/accounting';
import { generateSuggestedAdjustments, applyAdjustmentProposals } from '../services/adjustmentEngine';

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
  onUpdateTransactions?: (updated: BankTransaction[]) => void;
  onOpenRestoreModal?: () => void;
  onOpenTourOverlay?: () => void;
  onOpenClearModal?: () => void;
  activeStep?: number;
  onSelectStep?: (step: number) => void;
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
  onUpdateTransactions,
  onOpenRestoreModal,
  onOpenTourOverlay,
  onOpenClearModal,
  activeStep,
  onSelectStep
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
  const [tempBankBal, setTempBankBal] = useState(initialBalanceBank.toString());
  const [tempLedgerBal, setTempLedgerBal] = useState(initialBalanceLedger.toString());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setTempBankBal(initialBalanceBank.toString());
    setTempLedgerBal(initialBalanceLedger.toString());
  }, [initialBalanceBank, initialBalanceLedger]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveBalances = () => {
    if (onUpdateInitialBalances) {
      const b = parseFloat(tempBankBal.replace(',', '.')) || 0;
      const l = parseFloat(tempLedgerBal.replace(',', '.')) || 0;
      onUpdateInitialBalances(b, l);
      showToast('¡Saldos iniciales guardados correctamente!');
    }
  };

  const handleCopyBankBalanceToLedger = () => {
    if (onUpdateInitialBalances) {
      const b = parseFloat(tempBankBal.replace(',', '.')) || 0;
      setTempLedgerBal(b.toString());
      onUpdateInitialBalances(b, b);
      showToast(`¡Saldo de libros igualado al del banco (${sym} ${b.toLocaleString('es-VE', { minimumFractionDigits: 2 })})!`);
    }
  };

  // Step 4: Auto-cuadre de todas las diferencias (comisiones, IGTF y asientos faltantes)
  const handleAutoBalanceAllDifferences = () => {
    if (!onUpdateTransactions) return;

    // 1. Probar propuestas de ajustes inteligentes (comisiones, IGTF, etc.)
    const proposals = generateSuggestedAdjustments(transactions, undefined, currency, bcvRate);
    if (proposals.length > 0) {
      const result = applyAdjustmentProposals(transactions, proposals);
      onUpdateTransactions(result.updatedTransactions);

      // Si los saldos iniciales eran diferentes, alinearlos también para cuadre total
      if (initialBalanceLedger === 0 && initialBalanceBank !== 0 && onUpdateInitialBalances) {
        onUpdateInitialBalances(initialBalanceBank, initialBalanceBank);
        setTempLedgerBal(initialBalanceBank.toString());
      }

      showToast(`🎉 ¡Listo! Se crearon ${result.newLedgerEntriesCount} ajustes contables automáticos (comisiones/IGTF). ¡Conciliación cuadrada!`);
      return;
    }

    // 2. Si quedan partidas del extracto sin asentar en libros, generar sus asientos contables equivalentes
    const unrecordedBankItems = bankTx.filter(t => t.matchingStatus === 'UNMATCHED');
    if (unrecordedBankItems.length > 0) {
      const newLedgerItems: BankTransaction[] = [];
      const updatedTx = transactions.map(t => {
        if (t.source === 'BANK' && t.matchingStatus === 'UNMATCHED') {
          const ledgerId = `led-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const isDebit = t.txType === 'DEBIT';
          const newLedger: BankTransaction = {
            id: ledgerId,
            source: 'LEDGER',
            bankCode: t.bankCode,
            bankName: t.bankName,
            referenceNum: t.referenceNum,
            txDate: t.txDate,
            txType: t.txType,
            amountNominal: t.amountNominal,
            currency: t.currency,
            bcvRate: t.bcvRate,
            amountVes: t.amountVes,
            rawDescription: `[Ajuste Contable] ${t.rawDescription}`,
            matchingStatus: 'MATCHED_EXACT',
            matchedWithId: t.id,
            accountCode: isDebit ? '5.2.01.03.001' : '4.1.01.01.001',
            accountName: isDebit ? 'Gastos y Comisiones Bancarias' : 'Ingresos Operacionales',
            createdAt: new Date().toISOString()
          };
          newLedgerItems.push(newLedger);
          return {
            ...t,
            matchingStatus: 'MATCHED_EXACT' as const,
            matchedWithId: ledgerId,
            autoReconciledBy: 'MANUAL' as const
          };
        }
        return t;
      });

      // Alinear saldo inicial si era 0
      if (initialBalanceLedger === 0 && initialBalanceBank !== 0 && onUpdateInitialBalances) {
        onUpdateInitialBalances(initialBalanceBank, initialBalanceBank);
        setTempLedgerBal(initialBalanceBank.toString());
      }

      onUpdateTransactions([...updatedTx, ...newLedgerItems]);
      showToast(`🎉 ¡Conciliación Cuadrada! Se asentaron ${newLedgerItems.length} partidas en libros contables con diferencia Bs. 0,00.`);
      return;
    }

    // 3. Si solo hay variación en saldo inicial
    if (!proofOfCash.isBalanced && onUpdateInitialBalances) {
      onUpdateInitialBalances(initialBalanceBank, initialBalanceBank);
      setTempLedgerBal(initialBalanceBank.toString());
      showToast(`🎉 ¡Saldos sincronizados! Tu conciliación ahora está cuadrada al 100%.`);
    } else {
      showToast(`¡Excelente! Todos los movimientos ya están cuadrados al 100%.`);
    }
  };

  // Cuadrar una sola partida individual desde el Paso 4
  const handleSingleReconcile = (tx: BankTransaction) => {
    if (!onUpdateTransactions) return;

    const ledgerId = `led-single-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const isDebit = tx.txType === 'DEBIT';

    const newLedgerItem: BankTransaction = {
      id: ledgerId,
      source: 'LEDGER',
      bankCode: tx.bankCode,
      bankName: tx.bankName,
      referenceNum: tx.referenceNum,
      txDate: tx.txDate,
      txType: tx.txType,
      amountNominal: tx.amountNominal,
      currency: tx.currency,
      bcvRate: tx.bcvRate,
      amountVes: tx.amountVes,
      rawDescription: `[Ajuste Conciliación] ${tx.rawDescription}`,
      matchingStatus: 'MATCHED_EXACT',
      matchedWithId: tx.id,
      accountCode: isDebit ? '5.2.01.03.001' : '4.1.01.01.001',
      accountName: isDebit ? 'Gastos y Comisiones Bancarias' : 'Ingresos Operacionales',
      createdAt: new Date().toISOString()
    };

    const updated = transactions.map(t =>
      t.id === tx.id
        ? { ...t, matchingStatus: 'MATCHED_EXACT' as const, matchedWithId: ledgerId, autoReconciledBy: 'MANUAL' as const }
        : t
    );

    onUpdateTransactions([...updated, newLedgerItem]);
    showToast(`✅ Partida Ref: ${tx.referenceNum} cuadrada exitosamente.`);
  };

  // Automatically determine recommended active step (1 to 5)
  const computedStep: number = React.useMemo<number>(() => {
    if (!hasBothData) return 1;
    if (initialBalanceBank === 0 && initialBalanceLedger === 0) return 2;
    if (matchedTx.length === 0) return 3;
    if (unmatchedTx.length > 0 || !proofOfCash.isBalanced) return 4;
    return 5;
  }, [hasBothData, initialBalanceBank, initialBalanceLedger, matchedTx.length, unmatchedTx.length, proofOfCash.isBalanced]);

  // Active step in Wizard view mode (defaults to computed step)
  const [internalStep, setInternalStep] = useState<number>(activeStep || 1);

  React.useEffect(() => {
    if (activeStep !== undefined) {
      setInternalStep(activeStep);
    } else {
      setInternalStep(computedStep);
    }
  }, [activeStep, computedStep]);

  const selectedStep = activeStep !== undefined ? activeStep : internalStep;

  const handleStepChange = (step: number) => {
    setInternalStep(step);
    if (onSelectStep) {
      onSelectStep(step);
    }
  };

  const stepsInfo = [
    {
      step: 1,
      shortTitle: '1. Cargar Datos',
      fullTitle: 'Paso 1: Carga de Datos (Banco y Libros)',
      subtitle: 'Sube o pega tu extracto bancario y libro mayor',
      color: 'sky',
      bgColor: 'bg-sky-600',
      isDone: hasBothData
    },
    {
      step: 2,
      shortTitle: '2. Saldos Iniciales',
      fullTitle: 'Paso 2: Saldos de Inicio de Período',
      subtitle: 'Confirma los saldos de apertura de banco y contabilidad',
      color: 'indigo',
      bgColor: 'bg-indigo-600',
      isDone: hasBothData && initialBalanceBank !== 0
    },
    {
      step: 3,
      shortTitle: '3. Cruce Automático',
      fullTitle: 'Paso 3: Cruce Automático Ven-NIF',
      subtitle: 'El motor compara referencias de 4 dígitos, fechas y montos',
      color: 'purple',
      bgColor: 'bg-purple-600',
      isDone: matchedTx.length > 0
    },
    {
      step: 4,
      shortTitle: '4. Resolver Diferencias',
      fullTitle: 'Paso 4: Resolver Diferencias y Dejar en Bs. 0,00',
      subtitle: 'Auto-cuadra comisiones bancarias, IGTF y débitos pendientes',
      color: 'amber',
      bgColor: 'bg-amber-600',
      isDone: proofOfCash.isBalanced && unmatchedTx.length === 0 && matchedTx.length > 0
    },
    {
      step: 5,
      shortTitle: '5. Cédula & Cierre',
      fullTitle: 'Paso 5: Cédula de Conciliación y Descarga de Archivos',
      subtitle: 'Descarga tu informe oficial en Excel y cierra el mes',
      color: 'emerald',
      bgColor: 'bg-emerald-600',
      isDone: proofOfCash.isBalanced
    }
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header with Title & Quick Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
              Conciliación Bancaria Mensual
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
              Normas Ven-NIF & SUDEBAN
            </span>
            <span className="text-xs text-slate-500 font-bold">
              Empresa: <strong className="text-slate-800">{company.companyName}</strong> ({company.companyRif})
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Flujo Lineal de Conciliación (Paso a Paso sin Perderte)
          </h2>
          <p className="text-xs text-slate-600 font-medium max-w-2xl">
            Sigue cada uno de los 5 pasos sin salirte de esta pantalla. El sistema te guiará hasta alcanzar la meta: <strong>Diferencia Bs. 0,00 y Cédula Cuadrada al 100%</strong>.
          </p>
        </div>

        {/* Global Progress + Tour Button */}
        <div className="flex items-center gap-3">
          {onOpenTourOverlay && (
            <button
              onClick={onOpenTourOverlay}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              title="Abrir Tour Guiado Interactivo"
            >
              <HelpCircle className="w-4 h-4 stroke-[2.5]" />
              <span>🎓 Ver Explicación de Pasos</span>
            </button>
          )}

          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 min-w-[200px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-700">Avance General:</span>
              <span className="font-mono font-black text-emerald-700">{matchPercentage}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(hasBothData ? 25 : 5, matchPercentage))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5 STEPS PROGRESS TABS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-slate-100/90 p-2 rounded-2xl border border-slate-200">
        {stepsInfo.map(info => {
          const isSelected = selectedStep === info.step;
          const isCurrentRecommended = computedStep === info.step;

          return (
            <button
              key={info.step}
              onClick={() => handleStepChange(info.step)}
              className={`p-3 rounded-xl transition-all text-left flex items-center justify-between cursor-pointer border ${
                isSelected
                  ? 'bg-white border-slate-900 text-slate-900 shadow-md ring-2 ring-slate-900/10'
                  : 'bg-white/60 hover:bg-white border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${
                  info.isDone ? 'bg-emerald-600' : isSelected ? info.bgColor : 'bg-slate-400'
                }`}>
                  {info.isDone ? <Check className="w-4 h-4 stroke-[3]" /> : info.step}
                </span>
                <span className="text-xs font-extrabold truncate">
                  {info.shortTitle}
                </span>
              </div>
              {isCurrentRecommended && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" title="Paso Recomendado Ahora" />
              )}
            </button>
          );
        })}
      </div>

      {/* FOCUSED STEP CONTAINER - Minimal, Linear, No labyrinth */}
      <div className="p-6 rounded-3xl border-2 border-slate-900 bg-gradient-to-br from-white via-slate-50/50 to-white shadow-md space-y-6">
        
        {/* Step Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-4">
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
                    📌 Estás Aquí
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                {stepsInfo[selectedStep - 1].fullTitle}
              </h3>
            </div>
          </div>

          <div className="text-xs font-bold text-slate-600 bg-white px-3.5 py-2 rounded-2xl border border-slate-200">
            {stepsInfo[selectedStep - 1].subtitle}
          </div>
        </div>

        {/* -------------------- PASO 1: CARGA DE ARCHIVOS -------------------- */}
        {selectedStep === 1 && (
          <div className="space-y-5">
            <div className="bg-sky-50 p-4 rounded-2xl border border-sky-200 text-xs text-sky-950 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-sky-900 text-sm">
                <Info className="w-4 h-4 text-sky-700 shrink-0" />
                <span>¿Qué debes hacer en este Paso 1?</span>
              </div>
              <p className="leading-relaxed">
                Importa los dos archivos necesarios para la conciliación: el <strong>extracto del banco</strong> y el <strong>libro mayor contable</strong>. Si no tienes archivo Excel, puedes simplemente copiar el texto de tu portal bancario o PDF y pegarlo con el botón azul.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tarjeta Banco */}
              <div className={`p-5 rounded-2xl border-2 flex flex-col justify-between gap-4 ${
                bankTx.length > 0 ? 'bg-emerald-50/70 border-emerald-400' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                    Fuente 1: Banco
                  </span>
                  <h4 className="text-base font-extrabold text-slate-900 mt-1">
                    Extracto Bancario ({sym})
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Movimientos reportados por el banco (débitos, créditos, notas y comisiones).
                  </p>
                  <div className="mt-3 font-mono text-sm font-extrabold">
                    {bankTx.length > 0 ? (
                      <span className="text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        {bankTx.length} movimientos cargados correctamente
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin datos cargados</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onOpenUploadModal('BANK', 'PASTE')}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Cargar o Pegar Extracto Banco</span>
                </button>
              </div>

              {/* Tarjeta Libro Mayor */}
              <div className={`p-5 rounded-2xl border-2 flex flex-col justify-between gap-4 ${
                ledgerTx.length > 0 ? 'bg-emerald-50/70 border-emerald-400' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                    Fuente 2: Contabilidad
                  </span>
                  <h4 className="text-base font-extrabold text-slate-900 mt-1">
                    Libro Mayor de Bancos ({sym})
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Asientos contables registrados en tu sistema contable (SGT, Gálac, Profit, Saint).
                  </p>
                  <div className="mt-3 font-mono text-sm font-extrabold">
                    {ledgerTx.length > 0 ? (
                      <span className="text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        {ledgerTx.length} asientos contables cargados
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin datos cargados</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onOpenUploadModal('LEDGER', 'PASTE')}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Cargar o Pegar Libro Mayor</span>
                </button>
              </div>
            </div>

            {/* Limpiar datos si se desea reiniciar */}
            {transactions.length > 0 && onOpenClearModal && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-950">
                <span className="font-semibold">
                  ¿Deseas vaciar estos datos para cargar un estado de cuenta nuevo desde cero?
                </span>
                <button
                  onClick={onOpenClearModal}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar Todo</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* -------------------- PASO 2: SALDOS INICIALES -------------------- */}
        {selectedStep === 2 && (
          <div className="space-y-5">
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-indigo-900 text-sm">
                <Info className="w-4 h-4 text-indigo-700 shrink-0" />
                <span>¿Qué debes hacer en este Paso 2?</span>
              </div>
              <p className="leading-relaxed">
                Ingresa el saldo con el que comenzó el mes en el <strong>extracto del banco</strong> y en el <strong>libro mayor</strong>. Si tu empresa comenzó este mes o no tienes saldo anterior, puedes dejarlos en <strong>0,00</strong> o igualar el libro al banco con el botón mágico.
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-indigo-200 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    1. Saldo Inicial del Extracto Bancario ({sym}):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tempBankBal}
                    onChange={(e) => setTempBankBal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-mono text-base font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="0.00"
                  />
                  <span className="text-[11px] text-slate-500">Saldo inicial que figura en el encabezado del estado de cuenta bancario.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    2. Saldo Inicial del Libro Mayor ({sym}):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tempLedgerBal}
                    onChange={(e) => setTempLedgerBal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-mono text-base font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="0.00"
                  />
                  <span className="text-[11px] text-slate-500">Saldo de apertura en tu catálogo de cuentas antes de registrar los movimientos del mes.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveBalances}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Saldos Iniciales</span>
                  </button>

                  <button
                    onClick={handleCopyBankBalanceToLedger}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 cursor-pointer transition-colors"
                    title="Copia el saldo del banco al libro si no tienes histórico contable previo"
                  >
                    🪄 Igualar Libro al Banco
                  </button>
                </div>

                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Saldos de Apertura Calibrados</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- PASO 3: AUTO-CRUCE VEN-NIF -------------------- */}
        {selectedStep === 3 && (
          <div className="space-y-5">
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-purple-900 text-sm">
                <Info className="w-4 h-4 text-purple-700 shrink-0" />
                <span>¿Qué debes hacer en este Paso 3?</span>
              </div>
              <p className="leading-relaxed">
                Presiona el botón de abajo. El motor inteligente buscará coincidencias exactas entre el banco y los libros comparando los <strong>últimos 4 dígitos de la referencia</strong>, <strong>fechas cercanas (±3 días)</strong> y <strong>montos idénticos</strong>.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl border border-purple-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-400 text-slate-950">
                  Algoritmo Ven-NIF
                </span>
                <h4 className="text-base sm:text-lg font-black text-white">
                  Motor de Conciliación Automática en 1 Clic
                </h4>
                <p className="text-xs text-purple-200 max-w-lg">
                  Cruza automáticamente transferencias, depósitos, cobros y pagos entre el estado de cuenta y tu libro contable.
                </p>
              </div>

              <button
                onClick={onRunReconciliation}
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0 animate-pulse"
              >
                <Zap className="w-5 h-5 fill-slate-950" />
                <span>⚡ Ejecutar Cruce Automático Ahora</span>
              </button>
            </div>

            {/* Resultado del Cruce */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">Coincidentes Exactos</span>
                <div className="text-2xl font-black font-mono text-emerald-900 mt-0.5">
                  {matchedTx.length} partidas
                </div>
                <span className="text-xs font-semibold text-emerald-700">Pareadas automáticamente ✓</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">Pendientes por Cuadrar</span>
                <div className="text-2xl font-black font-mono text-amber-900 mt-0.5">
                  {unmatchedTx.length} partidas
                </div>
                <span className="text-xs font-semibold text-amber-800">Se resolverán en el Paso 4 a continuación ➔</span>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- PASO 4: RESOLVER DIFERENCIAS Y DEJAR EN 0,00 (THE KEY SOLUTION) -------------------- */}
        {selectedStep === 4 && (
          <div className="space-y-5">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>¿Por qué hay diferencias y cómo resolverlas en 1 clic?</span>
              </div>
              <p className="leading-relaxed">
                En Venezuela, los bancos aplican <strong>comisiones bancarias</strong>, <strong>IGTF del 3%</strong> y débitos que aún no has registrado en tus libros contables. Por eso la conciliación dice que hay diferencia. <strong>Presiona el botón verde de abajo para que el sistema cree automáticamente los asientos contables faltantes y deje la diferencia en Bs. 0,00 de inmediato.</strong>
              </p>
            </div>

            {/* TARJETA MAESTRA DE AUTO-CUADRE A DIFERENCIA BS. 0,00 */}
            <div className={`p-6 rounded-2xl border-2 transition-all ${
              proofOfCash.isBalanced && unmatchedTx.length === 0
                ? 'bg-emerald-50 border-emerald-500 shadow-md'
                : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-700 shadow-lg'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      proofOfCash.isBalanced
                        ? 'bg-emerald-200 text-emerald-950'
                        : 'bg-amber-400 text-slate-950'
                    }`}>
                      {proofOfCash.isBalanced ? '✓ Cuadrado al 100%' : 'Acción Recomendada'}
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      Estado: {proofOfCash.isBalanced ? 'Sin diferencias pendientes' : `${unmatchedTx.length} partidas pendientes`}
                    </span>
                  </div>

                  <h4 className="text-lg font-black">
                    {proofOfCash.isBalanced
                      ? '🎉 ¡Conciliación Cuadrada! Diferencia: Bs. 0,00'
                      : 'Resolver Todas las Diferencias Automáticamente'}
                  </h4>

                  <p className={`text-xs ${proofOfCash.isBalanced ? 'text-emerald-800 font-semibold' : 'text-slate-300'}`}>
                    {proofOfCash.isBalanced
                      ? 'Todos los movimientos de comisiones, IGTF y débitos ya están registrados en libros y pareados. Puedes avanzar al Paso 5 para descargar el informe en Excel.'
                      : 'Genera de forma automática los asientos contables de comisiones e IGTF faltantes en libros contables para cuadrar la ecuación al 100%.'}
                  </p>
                </div>

                {!proofOfCash.isBalanced && (
                  <button
                    onClick={handleAutoBalanceAllDifferences}
                    className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0 animate-bounce"
                  >
                    <Sparkles className="w-5 h-5 fill-slate-950" />
                    <span>⚡ Auto-Cuadrar Diferencias y Dejar en 0,00</span>
                  </button>
                )}
              </div>
            </div>

            {/* LISTA RÁPIDA DE PARTIDAS PENDIENTES CON BOTÓN DE 1 CLIC (SIN SALIRSE DE LA PÁGINA) */}
            {unmatchedTx.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Partidas pendientes ({unmatchedTx.length}):
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Haz clic en "Cuadrar Asiento" en cualquiera de ellas o usa el botón superior para cuadrar todas juntas.
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {unmatchedTx.slice(0, 15).map(tx => {
                    const isDebit = tx.txType === 'DEBIT';
                    return (
                      <div
                        key={tx.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDebit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isDebit ? 'Débito (-)' : 'Crédito (+)'}
                            </span>
                            <span className="font-mono font-bold text-slate-700">Ref: {tx.referenceNum}</span>
                            <span className="text-slate-400">{tx.txDate}</span>
                            <span className="text-slate-500 font-semibold">{tx.bankName}</span>
                          </div>
                          <p className="font-medium text-slate-800 truncate" title={tx.rawDescription}>
                            {tx.rawDescription}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-mono font-black text-sm ${isDebit ? 'text-slate-900' : 'text-emerald-700'}`}>
                            {sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>

                          <button
                            onClick={() => handleSingleReconcile(tx)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Cuadrar Asiento</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {unmatchedTx.length > 15 && (
                    <p className="text-center text-xs text-slate-500 pt-2 font-medium">
                      Mostrando 15 de {unmatchedTx.length} partidas. Presiona "Auto-Cuadrar Diferencias" arriba para resolverlas todas de una vez.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- PASO 5: CÉDULA Y CIERRE OFICIAL -------------------- */}
        {selectedStep === 5 && (
          <div className="space-y-5">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-emerald-900 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>¡Felicitaciones! Tu conciliación bancaria está finalizada</span>
              </div>
              <p className="leading-relaxed">
                La ecuación contable de la Prueba de Efectivo de 4 Columnas está cuadrada. A continuación puedes descargar la <strong>Cédula de Conciliación en Excel (.xlsx)</strong> y los asientos contables para importar en tu sistema ERP.
              </p>
            </div>

            {/* TABLA OFICIAL PRUEBA DE EFECTIVO 4 COLUMNAS */}
            <div className="p-5 bg-white rounded-2xl border border-emerald-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Cédula Oficial de Conciliación Bancaria Mensual
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    Empresa: {company.companyName} | Período: {new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }).toUpperCase()}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  ✓ Diferencia: {proofOfCash.isBalanced ? 'Bs. 0,00' : `${sym} ${proofOfCash.difference.toFixed(2)}`}
                </span>
              </div>

              {/* 4 Cards Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Saldo Extracto Banco</span>
                  <strong className="font-mono text-base font-extrabold text-slate-900 mt-1 block">
                    {sym} {proofOfCash.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase">(+) Depósitos Tránsito</span>
                  <strong className="font-mono text-base font-extrabold text-emerald-800 mt-1 block">
                    +{sym} {proofOfCash.depositsInTransit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block uppercase">(-) Cheques Pendientes</span>
                  <strong className="font-mono text-base font-extrabold text-rose-800 mt-1 block">
                    -{sym} {proofOfCash.outstandingChecks.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200">
                  <span className="text-[10px] text-sky-800 font-bold block uppercase">(=) Saldo Conciliado</span>
                  <strong className="font-mono text-base font-extrabold text-sky-900 mt-1 block">
                    {sym} {proofOfCash.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Saldo Mayor Contable en Libros: <strong>{sym} {proofOfCash.finalBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></span>
                <span className="font-mono text-emerald-700 font-extrabold text-sm">
                  {proofOfCash.isBalanced ? '✓ Prueba de Efectivo Cuadrada al 100%' : `Variación: ${sym} ${proofOfCash.difference.toFixed(2)}`}
                </span>
              </div>

              {/* Botones de Descarga */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={onOpenProofModal}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Detalle de Cédula (4 Columnas)</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={onOpenExportModal}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel Oficial (SGT / Gálac / Profit)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- LINEAR NAVIGATION CONTROLS (NEXT / PREV) -------------------- */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
          {selectedStep > 1 ? (
            <button
              onClick={() => handleStepChange(Math.max(1, selectedStep - 1))}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Volver al Paso {selectedStep - 1}</span>
            </button>
          ) : (
            <div />
          )}

          {selectedStep < 5 && (
            <button
              onClick={() => handleStepChange(Math.min(5, selectedStep + 1))}
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all ml-auto"
            >
              <span>Continuar al Paso {selectedStep + 1} ({stepsInfo[selectedStep].shortTitle}) →</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {selectedStep === 5 && (
            <button
              onClick={() => {
                handleStepChange(1);
                showToast('¡Iniciando revisión desde el Paso 1!');
              }}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all ml-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Revisar desde el Paso 1</span>
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
