import React, { useState, useMemo } from 'react';
import {
  HeartPulse,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Trash2,
  Wand2,
  X,
  ShieldCheck,
  ArrowRight,
  Filter,
  Check,
  RefreshCw,
  Info
} from 'lucide-react';
import { BankTransaction } from '../types/accounting';
import {
  HealthReport,
  HealthIssue,
  runDatabaseHealthCheck,
  executeAutomaticHealthCleanup
} from '../services/healthCheckService';

interface DataHealthCheckupModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: BankTransaction[];
  onApplyCleanup: (
    cleanedTransactions: BankTransaction[],
    deletedIds: string[],
    summary: {
      deletedDuplicates: number;
      fixedReferences: number;
      normalizedAmounts: number;
    }
  ) => Promise<void> | void;
}

export const DataHealthCheckupModal: React.FC<DataHealthCheckupModalProps> = ({
  isOpen,
  onClose,
  transactions,
  onApplyCleanup
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DUPLICATES' | 'REFERENCES' | 'AMOUNTS'>('ALL');
  const [isApplying, setIsApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState<string | null>(null);

  // Ejecutar el diagnóstico de salud en memoria
  const report: HealthReport = useMemo(() => {
    return runDatabaseHealthCheck(transactions);
  }, [transactions]);

  // Filtrado de problemas según pestaña
  const filteredIssues = useMemo(() => {
    if (activeFilter === 'ALL') return report.issues;
    if (activeFilter === 'DUPLICATES') {
      return report.issues.filter(i => i.type === 'EXACT_DUPLICATE' || i.type === 'SUSPECTED_DUPLICATE');
    }
    if (activeFilter === 'REFERENCES') {
      return report.issues.filter(i => i.type === 'MALFORMED_REFERENCE');
    }
    if (activeFilter === 'AMOUNTS') {
      return report.issues.filter(i => i.type === 'ZERO_OR_NEGATIVE_AMOUNT' || i.type === 'INVALID_DATE');
    }
    return report.issues;
  }, [report.issues, activeFilter]);

  if (!isOpen) return null;

  const handleRun1ClickCleanup = async () => {
    if (report.issues.length === 0) return;
    setIsApplying(true);
    setAppliedSuccess(null);

    try {
      const result = executeAutomaticHealthCleanup(transactions, report);
      
      await onApplyCleanup(
        result.cleanedTransactions,
        result.deletedTransactionIds,
        {
          deletedDuplicates: result.deletedDuplicateCount,
          fixedReferences: result.fixedReferenceCount,
          normalizedAmounts: result.normalizedAmountCount + result.cleanedDateCount
        }
      );

      setAppliedSuccess(
        `¡Limpieza saludable completada! Se eliminaron ${result.deletedDuplicateCount} duplicados y se repararon ${result.fixedReferenceCount} referencias.`
      );
      setTimeout(() => {
        setAppliedSuccess(null);
      }, 7000);
    } catch (err) {
      console.error('Error al aplicar limpieza saludable:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 95) return { label: 'Excelente Salud', badgeClass: 'bg-emerald-100 text-emerald-800' };
    if (score >= 80) return { label: 'Buena Integridad', badgeClass: 'bg-blue-100 text-blue-800' };
    if (score >= 60) return { label: 'Atención Requerida', badgeClass: 'bg-amber-100 text-amber-800' };
    return { label: 'Crítico / Inconsistente', badgeClass: 'bg-rose-100 text-rose-800' };
  };

  const totalProblemCount = report.issues.length;
  const scoreInfo = getScoreBadge(report.healthScore);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  Checkup Saludable de Transacciones
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide ${scoreInfo.badgeClass}`}>
                  {scoreInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Auditoría automática de duplicados, referencias mal formadas e inconsistencias en libros y bancos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificación de Éxito al Aplicar */}
        {appliedSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-2xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{appliedSuccess}</span>
          </div>
        )}

        {/* Tablero de Diagnóstico y Salud */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Tarjeta de Puntuación Principal */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between items-center text-center ${getScoreColor(report.healthScore)}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              Salud General
            </span>
            <div className="my-1">
              <span className="text-4xl font-black">{report.healthScore}%</span>
            </div>
            <span className="text-[10px] font-medium">
              {transactions.length} registros auditados
            </span>
          </div>

          {/* Métrica 1: Duplicados */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Duplicados</span>
              <Copy className="w-4 h-4 text-rose-500" />
            </div>
            <div className="my-1">
              <span className={`text-2xl font-black ${report.exactDuplicatesCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {report.exactDuplicatesCount}
              </span>
              {report.suspectedDuplicatesCount > 0 && (
                <span className="text-xs text-amber-600 ml-1.5 font-bold">
                  (+{report.suspectedDuplicatesCount} sospechosos)
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {report.exactDuplicatesCount === 0 ? 'Sin registros repetidos' : 'Requieren depuración'}
            </span>
          </div>

          {/* Métrica 2: Referencias Mal Formadas */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Referencias</span>
              <Wand2 className="w-4 h-4 text-amber-500" />
            </div>
            <div className="my-1">
              <span className={`text-2xl font-black ${report.malformedReferencesCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                {report.malformedReferencesCount}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {report.malformedReferencesCount === 0 ? 'Todas normalizadas' : 'Vacías o con basura'}
            </span>
          </div>

          {/* Métrica 3: Montos y Fechas */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Montos y Fechas</span>
              <AlertTriangle className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="my-1">
              <span className={`text-2xl font-black ${report.amountIssuesCount + report.dateIssuesCount > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                {report.amountIssuesCount + report.dateIssuesCount}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {report.amountIssuesCount === 0 ? 'Importes válidos' : 'En cero o invertidos'}
            </span>
          </div>

        </div>

        {/* Panel de Acción Rápida (1-Click Fix) */}
        {totalProblemCount > 0 ? (
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/90 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                  Tratamiento Sugerido Automático
                </h4>
                <p className="text-xs text-emerald-800">
                  Depura {report.exactDuplicatesCount + report.suspectedDuplicatesCount} duplicados redundantes y sanea {report.malformedReferencesCount} referencias con 1 solo clic.
                </p>
              </div>
            </div>
            <button
              onClick={handleRun1ClickCleanup}
              disabled={isApplying}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saneando Base de Datos...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Limpiar y Sanear Todo en 1 Clic</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-medium">
            <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <strong className="font-bold text-emerald-950 block">¡Base de datos en óptimo estado de salud!</strong>
              No se detectaron transacciones duplicadas ni referencias mal formateadas. Tu información está lista para conciliar sin riesgo de error.
            </div>
          </div>
        )}

        {/* Filtros de Pestañas */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos los Hallazgos ({totalProblemCount})
            </button>
            <button
              onClick={() => setActiveFilter('DUPLICATES')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeFilter === 'DUPLICATES'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Duplicados ({report.exactDuplicatesCount + report.suspectedDuplicatesCount})
            </button>
            <button
              onClick={() => setActiveFilter('REFERENCES')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeFilter === 'REFERENCES'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Referencias ({report.malformedReferencesCount})
            </button>
            <button
              onClick={() => setActiveFilter('AMOUNTS')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeFilter === 'AMOUNTS'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              Montos y Fechas ({report.amountIssuesCount + report.dateIssuesCount})
            </button>
          </div>
        </div>

        {/* Lista de Casos Detectados con Antes vs Después */}
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {filteredIssues.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Check className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="font-semibold">No hay incidencias en esta categoría.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      issue.severity === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : issue.severity === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {issue.severity === 'CRITICAL' ? 'Crítico' : 'Advertencia'}
                    </span>
                    <strong className="text-xs font-bold text-slate-800">
                      {issue.title}
                    </strong>
                    <span className="text-[10px] text-slate-500 font-mono">
                      [{issue.transaction.source === 'BANK' ? 'Banco' : 'Libro'} • {issue.transaction.bankName || issue.transaction.bankCode}]
                    </span>
                  </div>

                  <span className="text-xs font-mono font-extrabold text-slate-700">
                    {issue.transaction.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {issue.transaction.currency}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600">
                  {issue.description}
                </p>

                {/* Vista Previa de Corrección: Antes vs Después */}
                <div className="p-2 bg-white rounded-xl border border-slate-200/90 text-[11px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 font-semibold">Antes:</span>
                    <span className="font-mono text-rose-700 line-through truncate max-w-[220px]">
                      {issue.suggestedFixPreview.before}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-400 font-semibold">Después:</span>
                    <span className="font-mono text-emerald-700 font-bold truncate max-w-[240px]">
                      {issue.suggestedFixPreview.after}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md flex-shrink-0">
                    {issue.suggestedAction === 'DELETE' ? 'Eliminar copia redundante' : 'Saneamiento automático'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>La limpieza automática preserva todos los registros originales y sus respaldos digitales.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
