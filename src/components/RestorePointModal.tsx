import React, { useState, useEffect, useRef } from 'react';
import {
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  Calendar,
  Layers,
  Building,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Check,
  Loader2,
  FileJson,
  Lock
} from 'lucide-react';
import { User } from 'firebase/auth';
import { BankTransaction, CurrencyType, ReconciliationSnapshot } from '../types/accounting';
import {
  buildSnapshotFromCurrentState,
  saveSnapshot,
  getSnapshots,
  deleteSnapshot,
  applyRestoreSnapshot,
  exportSnapshotToJson,
  parseSnapshotFromJson
} from '../services/snapshotService';

interface RestorePointModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  transactions: BankTransaction[];
  currency: CurrencyType;
  selectedBank?: string;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  onRestoreComplete: (restoredTransactions: BankTransaction[], initialBank: number, initialLedger: number, currency: CurrencyType) => void;
  onOpenEncryptedBackup?: () => void;
}

export const RestorePointModal: React.FC<RestorePointModalProps> = ({
  isOpen,
  onClose,
  user,
  transactions,
  currency,
  selectedBank = 'ALL',
  initialBalanceBank,
  initialBalanceLedger,
  onRestoreComplete,
  onOpenEncryptedBackup
}) => {
  const [snapshots, setSnapshots] = useState<ReconciliationSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Snapshot Form State
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Confirmation state for restore
  const [snapshotToRestore, setSnapshotToRestore] = useState<ReconciliationSnapshot | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load snapshots when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSnapshotsList();
      const defaultName = `Snapshot - ${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
      setSnapshotName(defaultName);
      setSnapshotDesc('');
      setSnapshotToRestore(null);
      setFeedback(null);
    }
  }, [isOpen, user]);

  const loadSnapshotsList = async () => {
    setIsLoading(true);
    try {
      const list = await getSnapshots(user);
      setSnapshots(list);
    } catch (err) {
      console.error('Error cargando snapshots:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Handle Save Snapshot
  const handleCreateSnapshot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (transactions.length === 0) {
      setFeedback({
        type: 'error',
        message: 'No hay transacciones cargadas para guardar en un Punto de Restauración.'
      });
      return;
    }

    setIsSaving(true);
    try {
      const snapshot = buildSnapshotFromCurrentState(
        snapshotName,
        snapshotDesc,
        transactions,
        currency,
        selectedBank,
        initialBalanceBank,
        initialBalanceLedger,
        user?.uid
      );

      await saveSnapshot(snapshot, user);
      setFeedback({
        type: 'success',
        message: `¡Punto de restauración "${snapshot.name}" guardado exitosamente en Firestore y almacenamiento seguro!`
      });

      setShowCreateForm(false);
      setSnapshotName('');
      setSnapshotDesc('');
      await loadSnapshotsList();

      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error al crear snapshot:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error al guardar el punto de restauración.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Restore Snapshot Execution
  const handleExecuteRestore = async () => {
    if (!snapshotToRestore) return;

    setIsRestoring(true);
    try {
      await applyRestoreSnapshot(snapshotToRestore, user);
      
      onRestoreComplete(
        snapshotToRestore.transactions,
        snapshotToRestore.initialBalanceBank || 0,
        snapshotToRestore.initialBalanceLedger || 0,
        snapshotToRestore.currency || 'VES'
      );

      setFeedback({
        type: 'success',
        message: `¡Conciliación restaurada con éxito! Se cargaron ${snapshotToRestore.transactions.length} movimientos del punto "${snapshotToRestore.name}".`
      });

      setSnapshotToRestore(null);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error al restaurar:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error al restaurar el punto seleccionado.'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Delete Snapshot
  const handleDeleteSnapshot = async (snapshotId: string, name: string) => {
    if (!confirm(`¿Eliminar el punto de restauración "${name}"?`)) return;

    try {
      await deleteSnapshot(snapshotId, user);
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
      setFeedback({
        type: 'success',
        message: `Punto de restauración "${name}" eliminado.`
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      console.error('Error al eliminar:', err);
    }
  };

  // Handle Import JSON file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseSnapshotFromJson(text);
      await saveSnapshot(parsed, user);
      await loadSnapshotsList();
      setFeedback({
        type: 'success',
        message: `¡Punto de restauración importado con éxito desde "${file.name}"!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'No se pudo leer el archivo JSON de snapshot.'
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Puntos de Restauración de la Conciliación
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Firestore Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Guarda snapshots completos de tus movimientos, cuadres y saldos. Si cometes un error contable, puedes volver atrás en un clic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {feedback && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
            >
              ×
            </button>
          </div>
        )}

        {/* Current State Summary Card & Quick Save Button */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                Estado Actual en Pantalla
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                <span className="font-bold">
                  {transactions.length} movimientos
                </span>
                <span>•</span>
                <span>Banco: {transactions.filter(t => t.source === 'BANK').length}</span>
                <span>•</span>
                <span>Libro: {transactions.filter(t => t.source === 'LEDGER').length}</span>
                <span>•</span>
                <span>Saldo Inicial Bco: {sym} {initialBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                <span>•</span>
                <span>Saldo Inicial Libros: {sym} {initialBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateForm(prev => !prev)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showCreateForm ? 'Ocultar Formulario' : 'Crear Punto Ahora'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs cursor-pointer transition-colors"
                title="Subir archivo .json de respaldo previo"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Importar JSON</span>
              </button>

              {onOpenEncryptedBackup && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEncryptedBackup();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                  title="Exportar base de datos completa a un archivo JSON cifrado localmente con AES-256"
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Bóveda Cifrada (AES-256)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Form to Create Snapshot */}
          {showCreateForm && (
            <form onSubmit={handleCreateSnapshot} className="mt-4 pt-3 border-t border-indigo-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nombre del Punto de Restauración:
                  </label>
                  <input
                    type="text"
                    required
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    placeholder="Ej: Pre-cuadre antes de conciliar Banesco"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nota o Motivo (Opcional):
                  </label>
                  <input
                    type="text"
                    value={snapshotDesc}
                    onChange={(e) => setSnapshotDesc(e.target.value)}
                    placeholder="Ej: Guardado antes de aplicar los 14 asientos correctivos"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Guardando en Firestore...' : 'Guardar Snapshot'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Confirmation Modal when user clicks 'Restaurar' */}
        {snapshotToRestore && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-950">
                  ¿Confirmas restaurar tu conciliación a este punto?
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Esta acción reemplazará los movimientos y saldos actuales en tu pantalla por los del snapshot:{' '}
                  <strong>"{snapshotToRestore.name}"</strong> ({snapshotToRestore.transactionsCount} movimientos, guardado el {new Date(snapshotToRestore.createdAt).toLocaleString('es-VE')}).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSnapshotToRestore(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-amber-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleExecuteRestore}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{isRestoring ? 'Restaurando...' : 'Sí, Restaurar Conciliación'}</span>
              </button>
            </div>
          </div>
        )}

        {/* List of Saved Snapshots */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>Snapshots Guardados</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                {snapshots.length}
              </span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Sincronizado con Firestore & LocalStorage
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Cargando puntos de restauración...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                <History className="w-5 h-5" />
              </div>
              <h5 className="text-xs font-bold text-slate-700">Aún no tienes Puntos de Restauración guardados</h5>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Crea tu primer punto de restauración con el botón "Crear Punto Ahora" para proteger tu trabajo antes de realizar cambios o asientos correctivos.
              </p>
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
              {snapshots.map((snap) => {
                const dateStr = new Date(snap.createdAt).toLocaleDateString('es-VE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const timeStr = new Date(snap.createdAt).toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={snap.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{snap.name}</span>
                        {snap.isBalanced ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Cuadrado
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Dif: {snap.currency === 'USD' ? '$' : 'Bs.'} {Math.abs(snap.difference || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      {snap.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{snap.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {dateStr} {timeStr}
                        </span>
                        <span>•</span>
                        <span>Total: {snap.transactionsCount} txs</span>
                        <span>•</span>
                        <span>Bco: {snap.bankCount}</span>
                        <span>•</span>
                        <span>Libro: {snap.ledgerCount}</span>
                        <span>•</span>
                        <span>Conciliados: {snap.matchedCount}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => exportSnapshotToJson(snap)}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                        title="Descargar archivo JSON de respaldo"
                      >
                        <FileJson className="w-4 h-4 text-slate-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSnapshot(snap.id, snap.name)}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-700 flex items-center justify-center cursor-pointer transition-colors"
                        title="Eliminar este punto de restauración"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSnapshotToRestore(snap)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Almacenamiento en Firestore respaldado y cifrado por usuario.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
