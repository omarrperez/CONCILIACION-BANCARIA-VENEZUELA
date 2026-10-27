import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { BankTransaction, CurrencyType, ProofOfCash } from '../types/accounting';

interface ReconciliationStatusWidgetProps {
  transactions: BankTransaction[];
  currency: CurrencyType;
  proofOfCash: ProofOfCash;
  onNavigateToStep?: (step: number) => void;
  onAutoBalance?: () => void;
  onOpenProofModal?: () => void;
  onOpenExportModal?: () => void;
}

export const ReconciliationStatusWidget: React.FC<ReconciliationStatusWidgetProps> = ({
  transactions,
  currency,
  proofOfCash,
  onNavigateToStep,
  onAutoBalance,
  onOpenProofModal,
  onOpenExportModal
}) => {
  const sym = currency === 'VES' ? 'Bs.' : '$';

  // 1. Número de Partidas Pendientes (Banco y Libro Mayor)
  const activeTx = transactions.filter(t => t.currency === currency);
  const bankTx = activeTx.filter(t => t.source === 'BANK');
  const ledgerTx = activeTx.filter(t => t.source === 'LEDGER');

  const pendingBank = bankTx.filter(
    t => t.matchingStatus !== 'MATCHED_EXACT' && t.matchingStatus !== 'MATCHED_FUZZY'
  );
  const pendingLedger = ledgerTx.filter(
    t => t.matchingStatus !== 'MATCHED_EXACT' && t.matchingStatus !== 'MATCHED_FUZZY'
  );
  const totalPending = pendingBank.length + pendingLedger.length;
  const hasData = activeTx.length > 0;

  // 2. Total de Diferencia Monetaria
  const rawDiff = Math.abs(proofOfCash?.difference ?? 0);
  const isZeroDiff = rawDiff < 0.01;
  const formattedDifference = `${sym} ${rawDiff.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  // 3. Estado de la Cuadratura de Caja (Proof of Cash)
  const isBalanced = proofOfCash?.isBalanced && isZeroDiff;
  const statusType: 'BALANCED' | 'UNBALANCED' | 'EMPTY' = !hasData
    ? 'EMPTY'
    : isBalanced
    ? 'BALANCED'
    : 'UNBALANCED';

  return (
    <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-sky-50/70 text-slate-800 p-5 sm:p-6 rounded-3xl border border-emerald-200/90 shadow-sm relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar: Title & Subtitle */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-emerald-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                Estado de la Conciliación
              </h2>
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300/80">
                Diagnóstico Inmediato
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Los 3 datos más críticos para identificar el estado del cuadre sin entrar a menús
            </p>
          </div>
        </div>

        {/* Currency & Quick Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-white/95 text-slate-700 border border-slate-200 shadow-2xs">
            Moneda: {currency}
          </span>
          {isBalanced ? (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-emerald-100/90 text-emerald-900 border border-emerald-300 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Conciliación Cuadrada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Pendiente de Ajustes
            </span>
          )}
        </div>
      </div>

      {/* The 3 Critical Metrics Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* DATO 1: Número de Partidas Pendientes */}
        <div
          onClick={() => onNavigateToStep && onNavigateToStep(hasData ? (totalPending > 0 ? 4 : 5) : 1)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            totalPending === 0 && hasData
              ? 'bg-white/95 hover:bg-emerald-50/60 border-emerald-300/90 shadow-2xs hover:shadow-sm'
              : totalPending > 0
              ? 'bg-white/95 hover:bg-amber-50/60 border-amber-300/90 shadow-2xs hover:shadow-sm'
              : 'bg-white/95 hover:bg-slate-50 border-slate-200/90 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              1. Partidas Pendientes
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              totalPending > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              Por Cruzar
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className={`text-3xl sm:text-4xl font-mono font-black ${
              totalPending === 0 && hasData ? 'text-emerald-600' : totalPending > 0 ? 'text-amber-600' : 'text-slate-400'
            }`}>
              {totalPending}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {totalPending === 1 ? 'partida pendiente' : 'partidas pendientes'}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
            {hasData ? (
              <span>Banco: <strong className="text-slate-800">{pendingBank.length}</strong> | Libros: <strong className="text-slate-800">{pendingLedger.length}</strong></span>
            ) : (
              <span>Sin movimientos cargados</span>
            )}
            <span className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1">
              {totalPending > 0 ? 'Resolver en Paso 4' : 'Verificadas'}
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* DATO 2: Total de Diferencia Monetaria */}
        <div
          onClick={() => onNavigateToStep && onNavigateToStep(hasData ? 4 : 1)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            isZeroDiff && hasData
              ? 'bg-white/95 hover:bg-emerald-50/60 border-emerald-300/90 shadow-2xs hover:shadow-sm'
              : !isZeroDiff && hasData
              ? 'bg-white/95 hover:bg-rose-50/60 border-rose-300/90 shadow-2xs hover:shadow-sm'
              : 'bg-white/95 hover:bg-slate-50 border-slate-200/90 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-600" />
              2. Total Diferencia Monetaria
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isZeroDiff && hasData ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
            }`}>
              {isZeroDiff && hasData ? 'Sin Diferencia' : 'Descuadre Activo'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className={`text-2xl sm:text-3xl font-mono font-black truncate ${
              isZeroDiff && hasData ? 'text-emerald-600' : !isZeroDiff && hasData ? 'text-rose-600' : 'text-slate-400'
            }`}>
              {formattedDifference}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
            {isZeroDiff && hasData ? (
              <span className="text-emerald-700 font-semibold">✓ Cero diferencia (Cuadre 100%)</span>
            ) : hasData ? (
              <span className="text-rose-700">Variación Banco vs Libros</span>
            ) : (
              <span>Esperando saldos</span>
            )}
            {!isZeroDiff && onAutoBalance ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoBalance();
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3 h-3" />
                Auto-Cuadrar
              </button>
            ) : (
              <span className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold">
                Paso 4 <ArrowRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* DATO 3: Estado de la Cuadratura de Caja */}
        <div
          onClick={() => onNavigateToStep && onNavigateToStep(hasData ? (isBalanced ? 5 : 4) : 1)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusType === 'BALANCED'
              ? 'bg-white/95 hover:bg-teal-50/60 border-teal-300/90 shadow-2xs hover:shadow-sm'
              : statusType === 'UNBALANCED'
              ? 'bg-white/95 hover:bg-rose-50/60 border-rose-300/90 shadow-2xs hover:shadow-sm'
              : 'bg-white/95 hover:bg-slate-50 border-slate-200/90 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              3. Cuadratura de Caja
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Proof of Cash
            </span>
          </div>

          <div className="my-2">
            {statusType === 'BALANCED' && (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-black text-emerald-900 block leading-tight">
                    CUADRADA ✓
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Ecuación 100% equilibrada
                  </span>
                </div>
              </div>
            )}

            {statusType === 'UNBALANCED' && (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-black text-rose-900 block leading-tight">
                    DESCUADRADA ⚠️
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium">
                    Requiere asiento o ajuste
                  </span>
                </div>
              </div>
            )}

            {statusType === 'EMPTY' && (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-black text-slate-700 block leading-tight">
                    EN ESPERA DE DATOS
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Carga extracto y libro
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>
              {statusType === 'BALANCED'
                ? 'Norma Ven-NIF cumplida'
                : statusType === 'UNBALANCED'
                ? 'Resolver en Paso 4'
                : 'Iniciar en Paso 1'}
            </span>
            {statusType === 'BALANCED' && onOpenExportModal ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenExportModal();
                }}
                className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Descargar Excel
              </button>
            ) : (
              <span className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1">
                {statusType === 'BALANCED' ? 'Ver Cédula' : 'Corregir'}
                <ArrowRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
