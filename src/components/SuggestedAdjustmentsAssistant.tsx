import React, { useState, useMemo } from 'react';
import {
  Wand2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  DollarSign,
  Layers,
  FileSpreadsheet,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Building,
  History
} from 'lucide-react';
import {
  BankTransaction,
  CurrencyType,
  UserCompanyProfile,
  JournalEntry
} from '../types/accounting';
import {
  SuggestedAdjustmentProposal,
  generateSuggestedAdjustments,
  applyAdjustmentProposals
} from '../services/adjustmentEngine';
import { VENEZUELAN_BANKS } from '../data/venNifAccounts';

interface SuggestedAdjustmentsAssistantProps {
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  selectedBank?: string;
  company?: UserCompanyProfile;
  initialBalanceBank?: number;
  initialBalanceLedger?: number;
  onUpdateInitialBalances?: (bankBal: number, ledgerBal: number) => void;
  onUpdateTransactions: (updated: BankTransaction[]) => void;
  onOpenExportModal?: () => void;
  onOpenRestoreModal?: () => void;
  onClose?: () => void;
}

export const SuggestedAdjustmentsAssistant: React.FC<SuggestedAdjustmentsAssistantProps> = ({
  transactions,
  currency,
  bcvRate,
  selectedBank,
  company,
  initialBalanceBank = 0,
  initialBalanceLedger = 0,
  onUpdateInitialBalances,
  onUpdateTransactions,
  onOpenExportModal,
  onOpenRestoreModal,
  onClose
}) => {
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>(selectedBank || '0134');
  const [filterType, setFilterType] = useState<'ALL' | 'BANK_UNRECORDED_DEBIT' | 'BANK_UNRECORDED_CREDIT' | 'DISCREPANCY_VARIANCE'>('ALL');
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(new Set());
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Initial balances editable state
  const [bankInitInput, setBankInitInput] = useState<string>(
    initialBalanceBank ? initialBalanceBank.toString() : (company?.initialBalanceBank?.toString() || '0')
  );
  const [ledgerInitInput, setLedgerInitInput] = useState<string>(
    initialBalanceLedger ? initialBalanceLedger.toString() : (company?.initialBalanceLedger?.toString() || '0')
  );
  const [initialBalSaved, setInitialBalSaved] = useState(false);

  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Generate proposals based on current differences
  const allProposals = useMemo(() => {
    return generateSuggestedAdjustments(transactions, selectedBankFilter, currency, bcvRate);
  }, [transactions, selectedBankFilter, currency, bcvRate]);

  // Filter proposals by type
  const filteredProposals = useMemo(() => {
    if (filterType === 'ALL') return allProposals;
    return allProposals.filter(p => p.type === filterType);
  }, [allProposals, filterType]);

  // Aggregate stats
  const stats = useMemo(() => {
    const debits = allProposals.filter(p => p.type === 'BANK_UNRECORDED_DEBIT');
    const credits = allProposals.filter(p => p.type === 'BANK_UNRECORDED_CREDIT');
    const discrepancies = allProposals.filter(p => p.type === 'DISCREPANCY_VARIANCE');

    const totalDebitDiff = debits.reduce((acc, p) => acc + p.differenceAmount, 0);
    const totalCreditDiff = credits.reduce((acc, p) => acc + p.differenceAmount, 0);
    const totalDiscrepancyDiff = discrepancies.reduce((acc, p) => acc + p.differenceAmount, 0);

    return {
      totalCount: allProposals.length,
      debitsCount: debits.length,
      totalDebitDiff,
      creditsCount: credits.length,
      totalCreditDiff,
      discrepanciesCount: discrepancies.length,
      totalDiscrepancyDiff,
      netDifference: totalCreditDiff - totalDebitDiff
    };
  }, [allProposals]);

  // Select all toggler
  const handleToggleSelectAll = () => {
    if (selectedProposalIds.size === filteredProposals.length) {
      setSelectedProposalIds(new Set());
    } else {
      setSelectedProposalIds(new Set(filteredProposals.map(p => p.id)));
    }
  };

  const handleToggleSingleSelect = (id: string) => {
    const next = new Set(selectedProposalIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProposalIds(next);
  };

  // Apply single proposal
  const handleApplySingle = (proposal: SuggestedAdjustmentProposal) => {
    setIsApplying(true);
    setTimeout(() => {
      const result = applyAdjustmentProposals(transactions, [proposal]);
      onUpdateTransactions(result.updatedTransactions);
      setIsApplying(false);
      setFeedbackMessage(`¡Asiento contable correctivo aplicado con éxito! Se cuadró el movimiento "${proposal.referenceDoc}".`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }, 400);
  };

  // Apply selected batch
  const handleApplySelected = () => {
    const toApply = allProposals.filter(p => selectedProposalIds.has(p.id));
    if (toApply.length === 0) return;

    setIsApplying(true);
    setTimeout(() => {
      const result = applyAdjustmentProposals(transactions, toApply);
      onUpdateTransactions(result.updatedTransactions);
      setSelectedProposalIds(new Set());
      setIsApplying(false);
      setFeedbackMessage(`¡Excelente! Se aplicaron ${toApply.length} asientos de ajuste correctivos. Tu libro mayor ha sido actualizado.`);
      setTimeout(() => setFeedbackMessage(null), 6000);
    }, 500);
  };

  // Apply all proposals in 1-click
  const handleApplyAll = () => {
    if (allProposals.length === 0) return;

    setIsApplying(true);
    setTimeout(() => {
      const result = applyAdjustmentProposals(transactions, allProposals);
      onUpdateTransactions(result.updatedTransactions);
      setSelectedProposalIds(new Set());
      setIsApplying(false);
      setFeedbackMessage(`¡Misión cumplida! Se aplicaron los ${allProposals.length} asientos correctivos bajo Ven-NIF. Tu conciliación bancaria ha quedado perfectamente cuadrada.`);
      setTimeout(() => setFeedbackMessage(null), 7000);
    }, 600);
  };

  // Save Initial Balances
  const handleSaveInitialBalances = () => {
    const bVal = parseFloat(bankInitInput.replace(',', '.')) || 0;
    const lVal = parseFloat(ledgerInitInput.replace(',', '.')) || 0;
    if (onUpdateInitialBalances) {
      onUpdateInitialBalances(bVal, lVal);
    }
    setInitialBalSaved(true);
    setFeedbackMessage(`¡Saldos iniciales fijados con éxito! Banco: ${sym} ${bVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })} | Libros: ${sym} ${lVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`);
    setTimeout(() => {
      setInitialBalSaved(false);
      setFeedbackMessage(null);
    }, 6000);
  };

  const currentBank = VENEZUELAN_BANKS.find(b => b.code === selectedBankFilter) || VENEZUELAN_BANKS[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col space-y-4">
      {/* Top Banner Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
              <Sparkles className="w-3 h-3 text-amber-300" />
              Asistente de Ajustes Sugeridos
            </span>
            <span className="text-[10px] font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">
              Ven-NIF & Normativa SENIAT
            </span>
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-400" />
            Propuesta Automática de Asientos Correctivos & Saldos Iniciales
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            El asistente analiza cada partida pendiente o con diferencias en el cuadre bancario y formula
            los asientos de diario requeridos (Debe / Haber) para corregir el Mayor de Bancos sin alterar auditorías.
          </p>
        </div>

        {/* Bank & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-800/80 p-1 rounded-xl flex items-center gap-1 border border-slate-700">
            {VENEZUELAN_BANKS.slice(0, 4).map(b => (
              <button
                key={b.code}
                onClick={() => setSelectedBankFilter(b.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBankFilter === b.code
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {b.shortName}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title="Cerrar asistente"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alert Toast */}
      {feedbackMessage && (
        <div className="mx-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-700 font-bold hover:text-emerald-900 text-sm ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* SECCIÓN DE SALDOS INICIALES (BANCO Y LIBROS) */}
      <div className="mx-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 border border-indigo-100 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-100/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>Saldos Iniciales de Conciliación (Apertura de Periodo)</span>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                  Campo Requerido si el Estado no lo Incluye
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Si tu estado de cuenta o libro contable no especifica el saldo inicial de apertura, introdúcelos abajo para que la ecuación de cuatro columnas cuadre con precisión matemática.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveInitialBalances}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 ${
              initialBalSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {initialBalSaved ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
            <span>{initialBalSaved ? 'Saldos Guardados' : 'Guardar Saldos Iniciales'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
          {/* Campo Saldo Inicial Banco */}
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-sky-600" />
                <span>1. Saldo Inicial según Banco:</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">Extracto Bancario</span>
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {sym}
              </span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={bankInitInput}
                onChange={(e) => setBankInitInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Saldo al primer día del mes según el banco {currentBank.shortName}.
            </p>
          </div>

          {/* Campo Saldo Inicial Libros */}
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Saldo Inicial según Libros:</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">Mayor de Bancos</span>
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {sym}
              </span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={ledgerInitInput}
                onChange={(e) => setLedgerInitInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Saldo de apertura registrado en tu contabilidad interna (Profit, Gálac, etc.).
            </p>
          </div>

          {/* Diferencia de Apertura */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-700 block">
                Diferencia de Apertura (Banco vs Libros):
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Representa partidas pendientes del mes anterior (tránsito / cheques o transferencias).
              </p>
            </div>
            <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-slate-100">
              <span className="text-[10px] font-medium text-slate-500">Desfase Inicial:</span>
              <span className={`font-mono text-xs font-bold ${
                Math.abs((parseFloat(bankInitInput) || 0) - (parseFloat(ledgerInitInput) || 0)) < 0.01
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}>
                {sym} {((parseFloat(bankInitInput) || 0) - (parseFloat(ledgerInitInput) || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Differences Found */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ajustes Requeridos</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900">{stats.totalCount}</span>
            <span className="text-xs font-medium text-slate-500">asientos propuestos</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Detectados en {currentBank.shortName} ({currency})
          </p>
        </div>

        {/* Card 2: Unrecorded Debits (Cargos Bancarios) */}
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Notas de Débito (ND)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">{stats.debitsCount}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-bold font-mono text-amber-950">
              {sym} {stats.totalDebitDiff.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-amber-800 mt-1">
            Comisiones, IGTF y débitos no registrados en libros.
          </p>
        </div>

        {/* Card 3: Unrecorded Credits (Abonos) */}
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Notas de Crédito (NC)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900">{stats.creditsCount}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-bold font-mono text-emerald-950">
              {sym} {stats.totalCreditDiff.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-emerald-800 mt-1">
            Cobranzas, lotes POS y abonos no incorporados en el Mayor.
          </p>
        </div>

        {/* Card 4: Discrepancies */}
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">Variaciones en Cifras</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-900">{stats.discrepanciesCount}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-bold font-mono text-rose-950">
              {sym} {stats.totalDiscrepancyDiff.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-rose-800 mt-1">
            Misma referencia pero diferente monto digitado.
          </p>
        </div>
      </div>

      {/* Action Bar: Filters, Select All, Batch Actions */}
      <div className="px-4 flex flex-wrap items-center justify-between gap-3 pt-2">
        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
          <span className="font-bold text-slate-500 text-[11px] mr-1">Filtrar:</span>
          {[
            { id: 'ALL', label: `Todos (${allProposals.length})` },
            { id: 'BANK_UNRECORDED_DEBIT', label: `Débitos / Comisiones (${stats.debitsCount})` },
            { id: 'BANK_UNRECORDED_CREDIT', label: `Créditos / Abonos (${stats.creditsCount})` },
            { id: 'DISCREPANCY_VARIANCE', label: `Variaciones (${stats.discrepanciesCount})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                filterType === f.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {filteredProposals.length > 0 && (
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
            >
              {selectedProposalIds.size === filteredProposals.length
                ? 'Deseleccionar todo'
                : `Seleccionar todo (${filteredProposals.length})`}
            </button>
          )}

          {selectedProposalIds.size > 0 && (
            <button
              onClick={handleApplySelected}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Aplicar Seleccionados ({selectedProposalIds.size})</span>
            </button>
          )}

          {allProposals.length > 0 && (
            <button
              onClick={handleApplyAll}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
              title="Aplica todos los asientos correctivos en el Mayor para que la conciliación quede cuadrada"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aplicar Todos los Ajustes (1 Clic)</span>
            </button>
          )}

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-900 font-bold text-xs shadow-2xs cursor-pointer transition-colors"
              title="Exportar comprobantes a Excel profesional para SGT Contable, Profit, Gálac, Saint o Valery"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Exportar a SGT / Excel</span>
            </button>
          )}

          {onOpenRestoreModal && (
            <button
              onClick={onOpenRestoreModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 font-bold text-xs shadow-2xs cursor-pointer transition-colors"
              title="Guardar o restaurar un snapshot de la conciliación en Firestore antes de aplicar ajustes masivos"
            >
              <History className="w-3.5 h-3.5 text-indigo-700" />
              <span>Punto de Restauración</span>
            </button>
          )}
        </div>
      </div>

      {/* Proposals List */}
      <div className="px-4 pb-4 space-y-3">
        {filteredProposals.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              ¡Sin diferencias ni asientos de ajuste pendientes!
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No se han encontrado notas de débito, cargos bancarios o variaciones sin conciliar para este banco.
              El libro contable y el extracto bancario se encuentran en orden.
            </p>
          </div>
        ) : (
          filteredProposals.map(proposal => {
            const isSelected = selectedProposalIds.has(proposal.id);
            const isExpanded = expandedProposalId === proposal.id;

            return (
              <div
                key={proposal.id}
                className={`rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-300'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                {/* Header row */}
                <div className="p-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSingleSelect(proposal.id)}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {proposal.type === 'BANK_UNRECORDED_DEBIT' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            Nota de Débito Bancaria
                          </span>
                        )}
                        {proposal.type === 'BANK_UNRECORDED_CREDIT' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                            Nota de Crédito Bancaria
                          </span>
                        )}
                        {proposal.type === 'DISCREPANCY_VARIANCE' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-200">
                            Variación de Cifra
                          </span>
                        )}

                        <span className="font-mono text-xs font-bold text-slate-800">
                          Ref: #{proposal.referenceDoc}
                        </span>

                        <span className="text-[11px] text-slate-400 font-medium">
                          {proposal.entryDate}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 mt-1">
                        {proposal.title}
                      </h4>

                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                        {proposal.categoryReason}
                      </p>
                    </div>
                  </div>

                  {/* Amount and Action */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {sym} {proposal.differenceAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleApplySingle(proposal)}
                        disabled={isApplying}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
                        title="Crear y asentar este asiento en el Mayor de Bancos"
                      >
                        <Check className="w-3 h-3" />
                        <span>Aplicar Asiento</span>
                      </button>

                      <button
                        onClick={() => setExpandedProposalId(isExpanded ? null : proposal.id)}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-[11px] flex items-center gap-0.5 cursor-pointer"
                        title="Ver desglose contable (Debe / Haber)"
                      >
                        <span>{isExpanded ? 'Ocultar' : 'Ver Asiento'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Journal Entry Detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl space-y-3">
                    
                    {/* Ven-NIF Rationale & Action info */}
                    <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2 text-xs">
                      <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-indigo-950">
                          Acción contable recomendada:
                        </p>
                        <p className="text-[11px] text-indigo-900 mt-0.5">
                          {proposal.recommendedAction}
                        </p>
                        <p className="text-[10px] font-mono text-indigo-700 mt-1">
                          Base Técnica: {proposal.venNifStandardNote}
                        </p>
                      </div>
                    </div>

                    {/* Accounting Entry Table (Comprobante de Diario) */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                      <div className="p-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span className="flex items-center gap-1 font-mono">
                          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          Comprobante de Diario: {proposal.suggestedEntry.reference}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">
                          {proposal.suggestedEntry.moduleTag}
                        </span>
                      </div>

                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-1.5 px-3">Cuenta Contable</th>
                            <th className="py-1.5 px-3">Nombre de la Cuenta</th>
                            <th className="py-1.5 px-3 text-right">Debe ({sym})</th>
                            <th className="py-1.5 px-3 text-right">Haber ({sym})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-xs">
                          {proposal.suggestedEntry.lines.map((line, lIdx) => (
                            <tr key={lIdx} className={line.debe > 0 ? 'bg-emerald-50/30' : 'bg-white'}>
                              <td className="py-1.5 px-3 font-semibold text-slate-700">
                                {line.accountCode}
                              </td>
                              <td className="py-1.5 px-3 font-sans font-medium text-slate-900">
                                {line.accountName}
                                <span className="block text-[10px] font-sans text-slate-400">
                                  {line.concept}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                {line.debe > 0 ? line.debe.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                {line.haber > 0 ? line.haber.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/90 font-bold border-t border-slate-200 text-xs">
                            <td colSpan={2} className="py-1.5 px-3 text-right font-sans uppercase text-[10px] text-slate-600">
                              Totales del Asiento (Cuadrado):
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-emerald-900">
                              {proposal.suggestedEntry.totalDebe.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-emerald-900">
                              {proposal.suggestedEntry.totalHaber.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
