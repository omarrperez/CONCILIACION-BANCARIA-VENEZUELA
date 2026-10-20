import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  BookOpen,
  Building,
  Upload,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Check,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  ExternalLink,
  Wand2,
  History
} from 'lucide-react';
import {
  BankTransaction,
  CurrencyType,
  UserCompanyProfile,
  ProofOfCash
} from '../types/accounting';
import { VENEZUELAN_BANKS } from '../data/venNifAccounts';
import { calculateProofOfCash, runAutomatedReconciliation } from '../services/matchingEngine';
import { SuggestedAdjustmentsAssistant } from './SuggestedAdjustmentsAssistant';
import { generateSuggestedAdjustments } from '../services/adjustmentEngine';

interface ReconciliationResultsModuleProps {
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  company: UserCompanyProfile;
  initialBalanceBank?: number;
  initialBalanceLedger?: number;
  onUpdateInitialBalances?: (bankBal: number, ledgerBal: number) => void;
  onOpenExportModal?: () => void;
  onOpenRestoreModal?: () => void;
  onUpdateTransactions: (updated: BankTransaction[]) => void;
  onNavigateToWorkspace: () => void;
  onNavigateToAssistant: (mode: 'BANK' | 'LEDGER') => void;
  onOpenProofModal: () => void;
}

export const ReconciliationResultsModule: React.FC<ReconciliationResultsModuleProps> = ({
  transactions,
  currency,
  bcvRate,
  company,
  initialBalanceBank = 0,
  initialBalanceLedger = 0,
  onUpdateInitialBalances,
  onOpenExportModal,
  onOpenRestoreModal,
  onUpdateTransactions,
  onNavigateToWorkspace,
  onNavigateToAssistant,
  onOpenProofModal
}) => {
  const [selectedBank, setSelectedBank] = useState<string>('0134'); // Banesco default
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ADJUSTMENTS' | 'WHAT_TO_TAKE' | 'ACTION_PLAN'>('OVERVIEW');
  const [expandedSection, setExpandedSection] = useState<'MATCHED' | 'BANK_UNRECORDED' | 'TRANSIT' | 'DISCREPANCY' | null>('BANK_UNRECORDED');
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Computed proposed adjustments count
  const pendingAdjustments = useMemo(() => {
    return generateSuggestedAdjustments(transactions, selectedBank, currency, bcvRate);
  }, [transactions, selectedBank, currency, bcvRate]);

  // Filter transactions for this bank & currency
  const bankTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.currency === currency &&
      t.source === 'BANK' &&
      (!selectedBank || t.bankCode === selectedBank)
    );
  }, [transactions, currency, selectedBank]);

  const ledgerTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.currency === currency &&
      t.source === 'LEDGER' &&
      (!selectedBank || t.bankCode === selectedBank)
    );
  }, [transactions, currency, selectedBank]);

  // Proof of cash calculation for this bank
  const proof = useMemo(() => {
    return calculateProofOfCash(transactions, selectedBank, currency, initialBalanceBank, initialBalanceLedger);
  }, [transactions, selectedBank, currency, initialBalanceBank, initialBalanceLedger]);

  // Breakdown classifications
  const matchedBank = useMemo(() => {
    return bankTransactions.filter(t => t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY');
  }, [bankTransactions]);

  const unrecordedBankDebits = useMemo(() => {
    // Bank debits (cargos, comisiones, IGTF) not yet registered in Ledger
    return bankTransactions.filter(t => t.txType === 'DEBIT' && t.matchingStatus === 'UNMATCHED');
  }, [bankTransactions]);

  const unrecordedBankCredits = useMemo(() => {
    // Bank credits (transferencias entrantes, liquidaciones) not yet in Ledger
    return bankTransactions.filter(t => t.txType === 'CREDIT' && t.matchingStatus === 'UNMATCHED');
  }, [bankTransactions]);

  const depositsInTransit = useMemo(() => {
    // Ledger credit (ingresos) registered by company but not yet cleared by bank
    return ledgerTransactions.filter(t => t.txType === 'CREDIT' && t.matchingStatus === 'UNMATCHED');
  }, [ledgerTransactions]);

  const outstandingChecks = useMemo(() => {
    // Ledger debit (gastos/cheques) registered by company but not yet debited by bank
    return ledgerTransactions.filter(t => t.txType === 'DEBIT' && t.matchingStatus === 'UNMATCHED');
  }, [ledgerTransactions]);

  const discrepancies = useMemo(() => {
    return bankTransactions.filter(t => t.matchingStatus === 'DISCREPANCY');
  }, [bankTransactions]);

  // Totals
  const totalMatchedAmount = matchedBank.reduce((acc, t) => acc + t.amountNominal, 0);
  const totalUnrecordedBankCharges = unrecordedBankDebits.reduce((acc, t) => acc + t.amountNominal, 0);
  const totalUnrecordedBankInflows = unrecordedBankCredits.reduce((acc, t) => acc + t.amountNominal, 0);
  const totalInTransit = depositsInTransit.reduce((acc, t) => acc + t.amountNominal, 0) + outstandingChecks.reduce((acc, t) => acc + t.amountNominal, 0);
  const totalDiscrepancyAmount = discrepancies.reduce((acc, t) => acc + Math.abs(t.discrepancyAmount || 0), 0);

  // Overall Verdict State: 'BALANCED' | 'PENDING_ADJUSTMENTS' | 'UNEXPLAINED_DIFFERENCE' | 'MISSING_DATA'
  const verdict = useMemo(() => {
    if (bankTransactions.length === 0 && ledgerTransactions.length === 0) {
      return 'NO_DATA';
    }
    if (bankTransactions.length === 0 || ledgerTransactions.length === 0) {
      return 'MISSING_ONE_SIDE';
    }
    if (proof.isBalanced) {
      return 'BALANCED';
    }
    if (unrecordedBankDebits.length > 0 || unrecordedBankCredits.length > 0) {
      // Check if explaining the bank unrecorded charges would balance it
      return 'PENDING_ADJUSTMENTS';
    }
    return 'UNEXPLAINED_DIFFERENCE';
  }, [bankTransactions, ledgerTransactions, proof.isBalanced, unrecordedBankDebits, unrecordedBankCredits]);

  // Auto-Fix: Incorporate unrecorded bank debits (comisiones, IGTF) directly into Ledger with 1 Click
  const handleAutoIncorporateBankCharges = () => {
    setIsAutoFixing(true);

    const pendingBankItems = [...unrecordedBankDebits, ...unrecordedBankCredits];
    if (pendingBankItems.length === 0) {
      setIsAutoFixing(false);
      return;
    }

    const newLedgerItems: BankTransaction[] = pendingBankItems.map((bItem, idx) => {
      // Determine proper Ven-NIF account
      let acctCode = '6.1.04.01.001';
      let acctName = 'Gastos Comisiones Bancarias';

      const desc = bItem.rawDescription.toLowerCase();
      if (desc.includes('igtf') || desc.includes('impuesto') || desc.includes('0.75') || desc.includes('3%')) {
        acctCode = '6.1.04.01.002';
        acctName = 'Gasto IGTF Bancario Ley 2022';
      } else if (desc.includes('iva') || desc.includes('retenc')) {
        acctCode = '2.1.03.01.001';
        acctName = 'Retenciones IVA por Enterar SENIAT';
      } else if (bItem.txType === 'CREDIT') {
        acctCode = '4.1.01.01.001';
        acctName = 'Ingresos por Ventas / Cobranzas';
      }

      return {
        id: `led-autofix-${Date.now()}-${idx}`,
        source: 'LEDGER',
        bankCode: bItem.bankCode,
        bankName: bItem.bankName,
        referenceNum: bItem.referenceNum,
        txDate: bItem.txDate,
        txType: bItem.txType,
        amountNominal: bItem.amountNominal,
        currency: bItem.currency,
        bcvRate: bItem.bcvRate,
        amountVes: bItem.amountVes,
        rawDescription: `${bItem.rawDescription} (Asiento de Ajuste Contable)`,
        counterpartyRif: bItem.counterpartyRif,
        counterpartyName: bItem.counterpartyName,
        accountCode: acctCode,
        accountName: acctName,
        matchingStatus: 'UNMATCHED',
        moduleTag: bItem.moduleTag || 'MOD_BANCOS',
        notes: `Asiento generado automáticamente para conciliar cargos del banco ref ${bItem.referenceNum}`,
        createdAt: new Date().toISOString()
      };
    });

    const combined = [...transactions, ...newLedgerItems];
    const { updatedTransactions, exactMatchesCount, fuzzyMatchesCount } = runAutomatedReconciliation(combined);

    onUpdateTransactions(updatedTransactions);
    setIsAutoFixing(false);
    setActionFeedback(`¡Excelente! Se crearon ${newLedgerItems.length} asientos contables de ajuste en tu Libro Mayor y se conciliaron ${exactMatchesCount + fuzzyMatchesCount} partidas automáticamente.`);
    setTimeout(() => setActionFeedback(null), 8000);
  };

  const currentBankObj = VENEZUELAN_BANKS.find(b => b.code === selectedBank) || VENEZUELAN_BANKS[0];

  return (
    <div className="space-y-6">
      
      {/* Header with Navigation and Bank Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Diagnóstico & Resultados Clave
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Normativa Ven-NIF & SENIAT
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Resultados de la Conciliación Bancaria
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Respuestas claras a tus dudas: ¿Está bien o mal?, ¿cuál es el descuadre?, y qué datos tomar de tus libros contables.
            </p>
          </div>

          {/* Quick Bank Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Banco:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {VENEZUELAN_BANKS.slice(0, 4).map(b => (
                <button
                  key={b.code}
                  onClick={() => setSelectedBank(b.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedBank === b.code
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {b.shortName}
                </button>
              ))}
            </div>

            <button
              onClick={onNavigateToWorkspace}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer ml-1"
            >
              <span>Ver Mesa de Conciliación (2 Columnas)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onOpenRestoreModal && (
              <button
                onClick={onOpenRestoreModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs border border-indigo-200/90 shadow-2xs transition-all cursor-pointer"
                title="Puntos de Restauración en Firestore"
              >
                <History className="w-3.5 h-3.5 text-indigo-700" />
                <span>Puntos de Restauración</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher for Navigation */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>1. Diagnóstico: ¿Está Bien o Mal?</span>
          </button>

          <button
            onClick={() => setActiveTab('ADJUSTMENTS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ADJUSTMENTS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Wand2 className="w-4 h-4 text-amber-500" />
            <span>2. Asistente de Ajustes Sugeridos</span>
            {pendingAdjustments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-indigo-950 text-[10px] font-black">
                {pendingAdjustments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('WHAT_TO_TAKE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'WHAT_TO_TAKE'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>3. ¿Qué Datos Tomar del Libro Contable?</span>
          </button>

          <button
            onClick={() => setActiveTab('ACTION_PLAN')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ACTION_PLAN'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>4. Plan de Acción en 3 Pasos</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {actionFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-medium leading-relaxed">{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold underline px-2 py-1 hover:bg-emerald-700 rounded-lg cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: DIAGNÓSTICO "¿ESTÁ BIEN O MAL?" (EL SEMÁFORO)      */}
      {/* ======================================================== */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* BANNER PRINCIPAL DEL VEREDICTO */}
          {verdict === 'BALANCED' && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 bg-white/10 px-2 py-0.5 rounded-md">
                      Veredicto Oficial
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      ¡TODO ESTÁ BIEN! Tu Conciliación está Cuadrada al 100%
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-emerald-50 max-w-3xl leading-relaxed">
                  No tienes ningún descuadre. El <strong>Saldo Real Disponible en el Banco</strong> coincide exactamente con el <strong>Saldo en tus Libros Contables</strong> después de considerar las partidas en tránsito y los ajustes. Cumples plenamente con la normativa contable venezolana (Ven-NIF) y la exigencia de auditoría del SENIAT.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div className="px-3.5 py-1.5 rounded-xl bg-white/20 backdrop-blur-xs text-xs font-mono font-bold">
                    Diferencia Neta: {sym} 0,00
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-white/20 backdrop-blur-xs text-xs font-mono font-bold">
                    Saldo Conciliado: {sym} {proof.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </div>
                  <button
                    onClick={onOpenProofModal}
                    className="px-4 py-1.5 rounded-xl bg-white text-emerald-900 font-bold text-xs hover:bg-emerald-50 shadow-xs cursor-pointer transition-colors"
                  >
                    Ver Cédula de 4 Columnas Formal →
                  </button>
                </div>
              </div>
            </div>
          )}

          {verdict === 'PENDING_ADJUSTMENTS' && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <Info className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100 bg-white/10 px-2 py-0.5 rounded-md">
                      Diagnóstico del Semáforo
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      ESTÁ CASI LISTA: Hay Cargos del Banco Pendientes de Contabilizar
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-amber-50 max-w-3xl leading-relaxed">
                  <strong>No te preocupes, no es un error grave ni dinero perdido:</strong> El banco te cobró comisiones bancarias, IGTF o retenciones por un total de <strong>{sym} {totalUnrecordedBankCharges.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong> que tu empresa aún no había anotado en su Libro Contable. En cuanto incorpores estos asientos a tus libros, ¡tu conciliación quedará 100% cuadrada!
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleAutoIncorporateBankCharges}
                    disabled={isAutoFixing}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-amber-950 font-black text-xs hover:bg-amber-50 shadow-md cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>{isAutoFixing ? 'Generando Asientos...' : '⚡ Incorporar y Contabilizar Cargos en Mis Libros (1 Clic)'}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('WHAT_TO_TAKE')}
                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    ¿Cómo funciona esto en mi contabilidad? →
                  </button>
                </div>
              </div>
            </div>
          )}

          {verdict === 'UNEXPLAINED_DIFFERENCE' && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-100 bg-white/10 px-2 py-0.5 rounded-md">
                      Atención Requerida
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      HAY UN DESCUADRE de {sym} {Math.abs(proof.difference).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-rose-50 max-w-3xl leading-relaxed">
                  Existe una diferencia que no está explicada únicamente por partidas en tránsito. Causas más habituales: un error al transcribir montos en el libro contable, una factura pagada que se registró dos veces, o movimientos del extracto que faltan por cargar.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={onNavigateToWorkspace}
                    className="px-4 py-2 rounded-xl bg-white text-rose-900 font-bold text-xs hover:bg-rose-50 shadow-xs cursor-pointer transition-colors"
                  >
                    Revisar Movimiento por Movimiento en Mesa Split →
                  </button>

                  {unrecordedBankDebits.length > 0 && (
                    <button
                      onClick={handleAutoIncorporateBankCharges}
                      className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs cursor-pointer"
                    >
                      Ajustar comisiones pendientes primero ({sym} {totalUnrecordedBankCharges.toFixed(2)})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {(verdict === 'NO_DATA' || verdict === 'MISSING_ONE_SIDE') && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                      Falta Información
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      {bankTransactions.length > 0
                        ? '¡Ya tienes el Extracto Bancario! Ahora falta tu Libro Contable'
                        : 'Para conciliar necesitas ambos lados: Banco y Libro Contable'}
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 max-w-3xl leading-relaxed">
                  {bankTransactions.length > 0
                    ? `Tienes ${bankTransactions.length} movimientos cargados del banco ${currentBankObj.shortName}. Para saber si tu contabilidad está bien o mal, debes cargar los asientos registrados en tu sistema contable (o generarlos automáticamente).`
                    : 'Carga el extracto que te da el banco y luego tus asientos contables para que el sistema los compare al céntimo.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onNavigateToAssistant('LEDGER')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Cargar Libro Contable de Banco</span>
                  </button>

                  <button
                    onClick={() => onNavigateToAssistant('BANK')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    <Building className="w-4 h-4" />
                    <span>Cargar Extracto Bancario</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* LAS 4 CAJAS DE RESULTADOS SIMPLES Y HUMANAS              */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* CAJA 1: LO QUE CUADRÓ PERFECTO */}
            <div
              onClick={() => setExpandedSection(expandedSection === 'MATCHED' ? null : 'MATCHED')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                expandedSection === 'MATCHED'
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-300'
                  : 'bg-white border-slate-200/90 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  1. Cuadrado 100%
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 mt-2">Partidas Conciliadas</h4>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {sym} {totalMatchedAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {matchedBank.length} ops.
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Movimientos que existen idénticos en el banco y en tus libros contables.
              </p>
            </div>

            {/* CAJA 2: LO QUE EL BANCO COBRÓ Y FALTA EN LIBROS */}
            <div
              onClick={() => setExpandedSection(expandedSection === 'BANK_UNRECORDED' ? null : 'BANK_UNRECORDED')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                expandedSection === 'BANK_UNRECORDED'
                  ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-white border-slate-200/90 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                  2. Falta en Libros
                </span>
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 mt-2">Cargos del Banco no Contabilizados</h4>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold text-amber-900 font-mono">
                  {sym} {totalUnrecordedBankCharges.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-amber-700">
                  {unrecordedBankDebits.length} ops.
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Comisiones, IGTF o retenciones cobradas por el banco que aún no has registrado.
              </p>
            </div>

            {/* CAJA 3: PARTIDAS EN TRÁNSITO */}
            <div
              onClick={() => setExpandedSection(expandedSection === 'TRANSIT' ? null : 'TRANSIT')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                expandedSection === 'TRANSIT'
                  ? 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-300'
                  : 'bg-white border-slate-200/90 hover:border-sky-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-900 bg-sky-100 px-2 py-0.5 rounded">
                  3. En Tránsito Normal
                </span>
                <TrendingUp className="w-4 h-4 text-sky-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 mt-2">Depósitos y Cheques en Tránsito</h4>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold text-sky-900 font-mono">
                  {sym} {totalInTransit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-sky-700">
                  {depositsInTransit.length + outstandingChecks.length} ops.
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Registrados en tus libros pero que el banco liquidará en los días siguientes.
              </p>
            </div>

            {/* CAJA 4: DISCREPANCIAS */}
            <div
              onClick={() => setExpandedSection(expandedSection === 'DISCREPANCY' ? null : 'DISCREPANCY')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                expandedSection === 'DISCREPANCY'
                  ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-300'
                  : 'bg-white border-slate-200/90 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-100 px-2 py-0.5 rounded">
                  4. Diferencias de Monto
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 mt-2">Discrepancias en Cifras</h4>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold text-rose-900 font-mono">
                  {sym} {totalDiscrepancyAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-rose-700">
                  {discrepancies.length} ops.
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Misma referencia pero diferente monto (errores de dedo o comisiones no deducidas).
              </p>
            </div>

          </div>

          {/* ======================================================== */}
          {/* DETALLE DESPLEGABLE DE LA CAJA SELECCIONADA              */}
          {/* ======================================================== */}
          {expandedSection && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    {expandedSection === 'MATCHED' && 'Detalle de Partidas Conciliadas (Cuadradas)'}
                    {expandedSection === 'BANK_UNRECORDED' && 'Detalle de Cargos del Banco Pendientes por Contabilizar en tus Libros'}
                    {expandedSection === 'TRANSIT' && 'Detalle de Partidas en Tránsito (Registradas en Libros, pendientes por el Banco)'}
                    {expandedSection === 'DISCREPANCY' && 'Detalle de Discrepancias de Monto'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Revisa las partidas individuales que componen este resultado.
                  </p>
                </div>

                {expandedSection === 'BANK_UNRECORDED' && unrecordedBankDebits.length > 0 && (
                  <button
                    onClick={handleAutoIncorporateBankCharges}
                    disabled={isAutoFixing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Contabilizar estos {unrecordedBankDebits.length} cargos ahora</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {expandedSection === 'BANK_UNRECORDED' && (
                  unrecordedBankDebits.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      ¡Excelente! No tienes cargos del banco pendientes de contabilizar.
                    </div>
                  ) : (
                    unrecordedBankDebits.map(tx => (
                      <div key={tx.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{tx.txDate}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                              Ref: {tx.referenceNum}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                              Cargo Bancario
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium">{tx.rawDescription}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-rose-700 block text-sm">
                            -{sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Falta registrar asiento en cuenta 6.1.04
                          </span>
                        </div>
                      </div>
                    ))
                  )
                )}

                {expandedSection === 'MATCHED' && (
                  matchedBank.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Aún no hay partidas emparejadas. Ejecuta la conciliación automática o empareja manualmente.
                    </div>
                  ) : (
                    matchedBank.map(tx => (
                      <div key={tx.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{tx.txDate}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                              Ref: {tx.referenceNum}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              {tx.matchingStatus === 'MATCHED_EXACT' ? 'Coincidencia Exacta' : 'Coincidencia Inteligente'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{tx.rawDescription}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-700 block text-sm">
                            {tx.txType === 'CREDIT' ? '+' : '-'}{sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            ✓ Cuadrado con Libro Mayor
                          </span>
                        </div>
                      </div>
                    ))
                  )
                )}

                {expandedSection === 'TRANSIT' && (
                  (depositsInTransit.length === 0 && outstandingChecks.length === 0) ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No hay depósitos ni cheques en tránsito registrados.
                    </div>
                  ) : (
                    [...depositsInTransit, ...outstandingChecks].map(tx => (
                      <div key={tx.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{tx.txDate}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">
                              Ref: {tx.referenceNum}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                              {tx.txType === 'CREDIT' ? 'Depósito en Tránsito (+)' : 'Cheque Pendiente Cobro (-)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{tx.rawDescription}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sky-800 block text-sm">
                            {tx.txType === 'CREDIT' ? '+' : '-'}{sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Normal: liquidará en próximos días
                          </span>
                        </div>
                      </div>
                    ))
                  )
                )}

                {expandedSection === 'DISCREPANCY' && (
                  discrepancies.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      ¡Excelente! No hay discrepancias de monto con la misma referencia.
                    </div>
                  ) : (
                    discrepancies.map(tx => (
                      <div key={tx.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{tx.txDate}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                              Ref: {tx.referenceNum}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Diferencia de Monto
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{tx.rawDescription}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-rose-700 block text-sm">
                            Monto Banco: {sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-rose-600 font-semibold">
                            Variación: {sym} {Math.abs(tx.discrepancyAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* EL PUENTE DE CONCILIACIÓN GRÁFICO (SALDO BANCO vs LIBROS) */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  El Puente de Conciliación Matemática (Cómo se Encuentran los Saldos)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Visualización de cómo los saldos del banco y de la empresa llegan al mismo valor exacto.
                </p>
              </div>
              <button
                onClick={onOpenProofModal}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Abrir Cédula de 4 Columnas →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Lado Banco */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                  Óptica del Banco ({currentBankObj.shortName})
                </span>
                
                <div className="space-y-1 pt-1 font-mono">
                  <div className="flex justify-between text-slate-700">
                    <span>Saldo Final según Extracto:</span>
                    <span className="font-bold">{sym} {proof.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>(+) Depósitos en Tránsito (de tus libros):</span>
                    <span className="font-bold">+{sym} {proof.depositsInTransit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>(-) Cheques Girados no Cobrados:</span>
                    <span className="font-bold">-{sym} {proof.outstandingChecks.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 flex justify-between text-slate-900 font-bold text-sm bg-sky-50/80 p-2 rounded-lg">
                    <span>(=) Saldo Banco Conciliado:</span>
                    <span className="text-sky-900">{sym} {proof.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Lado Libros */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  Óptica de la Empresa (Tus Libros Contables)
                </span>

                <div className="space-y-1 pt-1 font-mono">
                  <div className="flex justify-between text-slate-700">
                    <span>Saldo Final según tu Mayor Contable:</span>
                    <span className="font-bold">{sym} {proof.finalBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>(+) Cobros del Banco no Registrados:</span>
                    <span className="font-bold">+{sym} {proof.unrecordedCredits.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>(-) Comisiones/IGTF del Banco no Registrados:</span>
                    <span className="font-bold">-{sym} {proof.unrecordedDebits.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 flex justify-between text-slate-900 font-bold text-sm bg-emerald-50/80 p-2 rounded-lg">
                    <span>(=) Saldo Libros Conciliado:</span>
                    <span className="text-emerald-900">{sym} {proof.reconciledLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Resultado Final de Cuadre */}
            <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
              proof.isBalanced ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
            }`}>
              <div className="flex items-center gap-2">
                {proof.isBalanced ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 text-rose-700" />}
                <span>
                  {proof.isBalanced
                    ? '✓ ¡Ecuación Cumplida! Saldo Banco Conciliado = Saldo Libros Conciliado'
                    : `Diferencia de Cuadre Pendiente: ${sym} ${proof.difference.toFixed(2)}`}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('ACTION_PLAN')}
                className="underline hover:opacity-80 cursor-pointer text-[11px]"
              >
                ¿Qué debo hacer ahora? →
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: ASISTENTE DE AJUSTES SUGERIDOS (ASIENTOS CORRECTIVOS) */}
      {/* ======================================================== */}
      {activeTab === 'ADJUSTMENTS' && (
        <SuggestedAdjustmentsAssistant
          transactions={transactions}
          currency={currency}
          bcvRate={bcvRate}
          selectedBank={selectedBank}
          company={company}
          initialBalanceBank={initialBalanceBank}
          initialBalanceLedger={initialBalanceLedger}
          onUpdateInitialBalances={onUpdateInitialBalances}
          onOpenExportModal={onOpenExportModal}
          onOpenRestoreModal={onOpenRestoreModal}
          onUpdateTransactions={onUpdateTransactions}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 3: GUÍA "¿QUÉ DATOS TOMAR DEL LIBRO CONTABLE?"        */}
      {/* ======================================================== */}
      {activeTab === 'WHAT_TO_TAKE' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
            
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                Guía Práctica para el Usuario
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                ¿Qué datos debo tomar de mi Libro Contable y cómo funciona?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Si te sientes perdido sobre de dónde sacar la información de tus libros o si debes cambiarlos, aquí tienes la respuesta clara y directa.
              </p>
            </div>

            {/* PREGUNTA 1: ¿QUÉ ES EL LIBRO CONTABLE? */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs">1</span>
                <span>¿Qué es exactamente el "Libro Contable de Banco"?</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed pl-8">
                Es el <strong>Mayor Analítico</strong> de tu cuenta bancaria (por ejemplo la cuenta <code>1.1.01.02.001 - Banesco Cta Corriente</code>) que extraes de tu sistema administrativo o contable: <strong>Profit Plus, Gálac, Saint, SAP, Valery, o tu propio archivo de Excel</strong> donde anotas los cheques, transferencias emitidas y cobros.
              </p>
            </div>

            {/* PREGUNTA 2: ¿QUÉ COLUMNAS NECESITAS? */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs">2</span>
                <span>¿Cuáles son los 5 datos que necesitas copiar de tu software contable?</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pl-8 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-bold text-slate-800 block">1. Fecha</span>
                  <span className="text-[10px] text-slate-500">Ej: 15/10/2026</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-bold text-slate-800 block">2. Referencia</span>
                  <span className="text-[10px] text-slate-500">N° de cheque o transferencia</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-bold text-slate-800 block">3. Concepto / Tercero</span>
                  <span className="text-[10px] text-slate-500">Proveedor, Cliente o Gasto</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="font-bold text-emerald-800 block">4. Debe (Ingreso)</span>
                  <span className="text-[10px] text-emerald-600">Dinero que entró (+)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="font-bold text-rose-800 block">5. Haber (Egreso)</span>
                  <span className="text-[10px] text-rose-600">Dinero que pagaste (-)</span>
                </div>
              </div>
            </div>

            {/* PREGUNTA 3: ¿DEBO CAMBIAR MI LIBRO CONTABLE POR LO QUE DIGA EL BANCO? */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">3</span>
                <span>¿Debo modificar o ajustar mi Libro Contable con lo que diga el Banco?</span>
              </h4>
              <div className="text-xs text-amber-900 leading-relaxed pl-8 space-y-2">
                <p>
                  <strong>¡SÍ, pero solo para los cargos directos del banco!</strong> Sigue esta Regla de Oro contable:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px]">
                  <li>
                    <strong>Comisiones bancarias, IGTF (0.75% / 3%), intereses y retenciones del punto de venta:</strong> El banco ya te debitó ese dinero de tu cuenta. Por lo tanto, <strong>tu empresa tiene la obligación de registrar un asiento de gasto en su Libro Diario</strong> para que tu contabilidad refleje la realidad.
                  </li>
                  <li>
                    <strong>Depósitos en tránsito o cheques no cobrados:</strong> <strong>NO los toques en tus libros.</strong> Tu registro contable está perfecto; simplemente el banco tardará unas horas o días en procesarlo.
                  </li>
                </ul>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN RÁPIDA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                ¿Listo para cargar tu libro o generar los asientos automáticamente?
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateToAssistant('LEDGER')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Pegar Asientos de mi Libro Contable</span>
                </button>

                <button
                  onClick={onNavigateToWorkspace}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
                >
                  <span>Ir a Mesa de Conciliación</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PLAN DE ACCIÓN PASO A PASO (RESOLVER EN 3 PASOS)  */}
      {/* ======================================================== */}
      {activeTab === 'ACTION_PLAN' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
            
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                Procedimiento Guiado
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Plan de Acción en 3 Pasos para Dejar tu Conciliación Lista
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Sigue estos tres pasos sencillos para cerrar tu mes sin estrés ni descuadres.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* PASO 1 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  1
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Cargar Extracto Bancario y Libro Mayor
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Asegúrate de tener cargadas las dos columnas. Si solo tienes el extracto, puedes usar el botón de <em>"Generar Asientos con IA"</em> para crear la base de tus libros contables.
                  </p>
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Estado actual: {bankTransactions.length} movs. banco | {ledgerTransactions.length} asientos libros
                    </span>
                  </div>
                </div>
              </div>

              {/* PASO 2 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Ajustar los Cargos del Banco (Comisiones, IGTF, Retenciones)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Si el banco cobró comisiones que tú no tenías anotadas, presiona el botón directo para generar los asientos de ajuste. Así tu libro contable reflejará exactamente el saldo real.
                  </p>
                  
                  {unrecordedBankDebits.length > 0 ? (
                    <button
                      onClick={handleAutoIncorporateBankCharges}
                      disabled={isAutoFixing}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isAutoFixing ? 'Procesando...' : `Ajustar automáticamente ${unrecordedBankDebits.length} cargos (${sym} ${totalUnrecordedBankCharges.toFixed(2)})`}</span>
                    </button>
                  ) : (
                    <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>¡Paso completado! No tienes comisiones pendientes de registrar.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PASO 3 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Emitir Cédula de Auditoría y Exportar a tu ERP
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Una vez cuadrado, abre la Cédula de Prueba de Efectivo de 4 Columnas para imprimirla firmada por el Contador Público Colegiado (CPC), o exporta los asientos hacia Profit Plus, Gálac o Saint.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={onOpenProofModal}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      Ver Cédula 4 Columnas →
                    </button>
                    <button
                      onClick={onNavigateToWorkspace}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
                    >
                      Revisar Workspace
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
