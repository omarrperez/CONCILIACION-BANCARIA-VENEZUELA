import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen,
  X,
  Layers,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { BankTransaction, CurrencyType } from '../types/accounting';
import { getBankDefinition } from '../data/venezuelanBanks';

export type ClearReconciliationOption = 'ALL' | 'BANK' | 'LEDGER' | 'RESET_STATUS';

interface ClearReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: BankTransaction[];
  selectedBank: string;
  currency: CurrencyType;
  onConfirmClear: (
    option: ClearReconciliationOption,
    scope: 'ALL_BANKS' | 'SELECTED_BANK_ONLY'
  ) => Promise<void> | void;
}

export const ClearReconciliationModal: React.FC<ClearReconciliationModalProps> = ({
  isOpen,
  onClose,
  transactions,
  selectedBank,
  currency,
  onConfirmClear
}) => {
  const [selectedOption, setSelectedOption] = useState<ClearReconciliationOption>('ALL');
  const [scope, setScope] = useState<'ALL_BANKS' | 'SELECTED_BANK_ONLY'>(
    selectedBank === 'ALL' ? 'ALL_BANKS' : 'SELECTED_BANK_ONLY'
  );
  const [isClearing, setIsClearing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const currentBankDef = selectedBank !== 'ALL' ? getBankDefinition(selectedBank) : null;

  // Filtrar según el alcance seleccionado
  const targetTransactions = transactions.filter(t => {
    if (t.currency !== currency) return false;
    if (scope === 'SELECTED_BANK_ONLY' && selectedBank !== 'ALL') {
      return t.bankCode === selectedBank;
    }
    return true;
  });

  const bankTxCount = targetTransactions.filter(t => t.source === 'BANK').length;
  const ledgerTxCount = targetTransactions.filter(t => t.source === 'LEDGER').length;
  const matchedCount = targetTransactions.filter(
    t => t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY'
  ).length;

  const handleExecute = async () => {
    setIsClearing(true);
    try {
      await onConfirmClear(selectedOption, scope);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsClearing(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error al limpiar conciliación:', err);
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-50 via-rose-100/50 to-orange-50 border-b border-rose-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Limpiar y Reiniciar Conciliación</span>
              </h2>
              <p className="text-xs text-rose-900/80 mt-0.5">
                Vacía los datos cargados para corregir conciliaciones erróneas y empezar de nuevo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isClearing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Success state */}
          {isSuccess ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">¡Conciliación Limpiada con Éxito!</h3>
              <p className="text-xs text-slate-600">
                El sistema se encuentra listo para recibir el extracto bancario y libro mayor limpios.
              </p>
            </div>
          ) : (
            <>
              {/* Resumen del estado actual de datos */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
                    <span>Banco</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-0.5 font-mono">
                    {bankTxCount}
                  </div>
                  <span className="text-[10px] text-slate-400">movimientos</span>
                </div>
                <div className="border-x border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Libro</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-0.5 font-mono">
                    {ledgerTxCount}
                  </div>
                  <span className="text-[10px] text-slate-400">asientos</span>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pareadas</span>
                  </div>
                  <div className="text-lg font-black text-indigo-900 mt-0.5 font-mono">
                    {matchedCount}
                  </div>
                  <span className="text-[10px] text-slate-400">conciliadas</span>
                </div>
              </div>

              {/* Selector de Alcance (Si hay banco seleccionado) */}
              {selectedBank !== 'ALL' && currentBankDef && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-600" />
                      <span>Alcance de la limpieza:</span>
                    </span>
                    <span className="text-[11px] font-semibold text-amber-800">
                      Banco activo: {currentBankDef.shortName}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setScope('SELECTED_BANK_ONLY')}
                      className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                        scope === 'SELECTED_BANK_ONLY'
                          ? 'border-amber-500 bg-white shadow-2xs text-amber-950 font-bold ring-1 ring-amber-400'
                          : 'border-amber-200/60 bg-amber-100/40 text-amber-900 hover:bg-white'
                      }`}
                    >
                      <span className="block">Solo {currentBankDef.shortName}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Limpiar únicamente este banco ({bankTxCount + ledgerTxCount} reg)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('ALL_BANKS')}
                      className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                        scope === 'ALL_BANKS'
                          ? 'border-amber-500 bg-white shadow-2xs text-amber-950 font-bold ring-1 ring-amber-400'
                          : 'border-amber-200/60 bg-amber-100/40 text-amber-900 hover:bg-white'
                      }`}
                    >
                      <span className="block">Todos los Bancos</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Limpiar toda la empresa ({transactions.length} registros totales)
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Opciones de limpieza */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Selecciona la acción a ejecutar:
                </label>

                {/* Opción 1: LIMPIAR TODO */}
                <div
                  onClick={() => setSelectedOption('ALL')}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'ALL'
                      ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-200 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedOption === 'ALL' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'
                  }`}>
                    {selectedOption === 'ALL' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        🗑️ Limpiar TODO (Extracto Bancario + Libro Mayor)
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-rose-100 text-rose-800">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Elimina todos los movimientos bancarios y asientos contables cargados, y restablece los saldos iniciales a cero para volver a importar desde cero.
                    </p>
                  </div>
                </div>

                {/* Opción 2: LIMPIAR SOLO BANCO */}
                <div
                  onClick={() => setSelectedOption('BANK')}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'BANK'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-200 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedOption === 'BANK' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                  }`}>
                    {selectedOption === 'BANK' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-900">
                      🏦 Limpiar Solo Extracto Bancario
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Borra únicamente los movimientos descargados del banco ({bankTxCount} registros). Conserva tus asientos contables del libro mayor intactos.
                    </p>
                  </div>
                </div>

                {/* Opción 3: LIMPIAR SOLO LIBRO MAYOR */}
                <div
                  onClick={() => setSelectedOption('LEDGER')}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'LEDGER'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-200 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedOption === 'LEDGER' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                  }`}>
                    {selectedOption === 'LEDGER' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-900">
                      📖 Limpiar Solo Libro Mayor Contable
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Borra únicamente los asientos contables ({ledgerTxCount} registros). Conserva el extracto bancario cargado.
                    </p>
                  </div>
                </div>

                {/* Opción 4: RESTABLECER ESTADOS */}
                <div
                  onClick={() => setSelectedOption('RESET_STATUS')}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'RESET_STATUS'
                      ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedOption === 'RESET_STATUS' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                  }`}>
                    {selectedOption === 'RESET_STATUS' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-900">
                      🔄 Solo Desvincular / Resetear Estados de Conciliación
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      No borra ninguna transacción. Solo vuelve todas las partidas a estado "Pendiente" para re-ejecutar el algoritmo de conciliación desde cero.
                    </p>
                  </div>
                </div>
              </div>

              {/* Advertencia de confirmación */}
              <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  <strong>Aviso:</strong> Esta acción modificará la base de datos de transacciones local y en la nube. Te recomendamos realizar un respaldo o punto de restauración si deseas conservar los datos actuales.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isSuccess && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isClearing}
              className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-200/70 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isClearing || targetTransactions.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer ${
                selectedOption === 'RESET_STATUS'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-rose-600 hover:bg-rose-700 active:scale-95'
              } ${isClearing || targetTransactions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isClearing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Limpiando datos...</span>
                </>
              ) : selectedOption === 'RESET_STATUS' ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Restablecer Estados a Pendiente</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar y Limpiar Datos</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
