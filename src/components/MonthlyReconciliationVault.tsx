import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  History,
  Building2,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Upload,
  Plus,
  Trash2,
  Eye,
  RotateCcw,
  ShieldCheck,
  Lock,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  FileCheck2,
  X,
  Layers,
  FileJson,
  Check,
  TrendingUp,
  Printer
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  BankTransaction,
  CurrencyType,
  ReconciliationSnapshot,
  UserCompanyProfile
} from '../types/accounting';
import {
  getSnapshots,
  saveSnapshot,
  deleteSnapshot,
  buildSnapshotFromCurrentState,
  applyRestoreSnapshot,
  exportSnapshotToJson,
  parseSnapshotFromJson
} from '../services/snapshotService';
import { calculateProofOfCash } from '../services/matchingEngine';

interface MonthlyReconciliationVaultProps {
  user: User | null;
  company: UserCompanyProfile;
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  onRestoreComplete: (
    restoredTransactions: BankTransaction[],
    initialBank: number,
    initialLedger: number,
    currency: CurrencyType
  ) => void;
  onOpenExportModal?: () => void;
}

const MONTH_NAMES_ES = [
  { code: '01', name: 'Enero' },
  { code: '02', name: 'Febrero' },
  { code: '03', name: 'Marzo' },
  { code: '04', name: 'Abril' },
  { code: '05', name: 'Mayo' },
  { code: '06', name: 'Junio' },
  { code: '07', name: 'Julio' },
  { code: '08', name: 'Agosto' },
  { code: '09', name: 'Septiembre' },
  { code: '10', name: 'Octubre' },
  { code: '11', name: 'Noviembre' },
  { code: '12', name: 'Diciembre' }
];

export const MonthlyReconciliationVault: React.FC<MonthlyReconciliationVaultProps> = ({
  user,
  company,
  transactions,
  currency,
  bcvRate,
  initialBalanceBank,
  initialBalanceLedger,
  onRestoreComplete,
  onOpenExportModal
}) => {
  const [records, setRecords] = useState<ReconciliationSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Active Record Detail Modal
  const [detailRecord, setDetailRecord] = useState<ReconciliationSnapshot | null>(null);
  const [detailSearchTerm, setDetailSearchTerm] = useState<string>('');

  // Create Monthly Archive Modal
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [archiveMonth, setArchiveMonth] = useState<string>(
    (new Date().getMonth() + 1).toString().padStart(2, '0')
  );
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear());
  const [archiveBankName, setArchiveBankName] = useState<string>('Banesco Banco Universal');
  const [archiveNotes, setArchiveNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Restore Confirmation
  const [recordToRestore, setRecordToRestore] = useState<ReconciliationSnapshot | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Load records on mount & user change
  useEffect(() => {
    loadMonthlyVaultRecords();
  }, [user]);

  const loadMonthlyVaultRecords = async () => {
    setIsLoading(true);
    try {
      const list = await getSnapshots(user);
      setRecords(list);
    } catch (err) {
      console.error('Error cargando historial de conciliaciones mensuales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Archive current workspace reconciliation into the monthly vault
  const handleArchiveCurrentMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const monthObj = MONTH_NAMES_ES.find((m) => m.code === archiveMonth);
      const periodLabel = `${monthObj?.name || 'Mes'} ${archiveYear}`;

      const newRecord = buildSnapshotFromCurrentState(
        `Conciliación Bancaria Mensual - ${periodLabel} (${archiveBankName})`,
        archiveNotes || `Conciliación bancaria oficial cerrada correspondiente a ${periodLabel} para ${archiveBankName}.`,
        transactions,
        currency,
        archiveBankName,
        initialBalanceBank,
        initialBalanceLedger,
        user?.uid,
        {
          periodMonth: archiveMonth,
          periodYear: archiveYear,
          periodLabel,
          bankName: archiveBankName,
          bcvRateUsed: bcvRate,
          preparedBy: company.companyName || 'Contador Encargado',
          approvedBy: 'Auditoría Forense Ven-NIF'
        }
      );

      await saveSnapshot(newRecord, user);
      await loadMonthlyVaultRecords();

      setIsArchiveModalOpen(false);
      setArchiveNotes('');
      setFeedbackMsg({
        type: 'success',
        text: `¡Conciliación mensual de ${periodLabel} archivada y sellada con éxito en el repositorio!`
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Error al archivar conciliación: ${err.message}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Restore past reconciliation into active workspace
  const handleConfirmRestore = async () => {
    if (!recordToRestore) return;
    try {
      await applyRestoreSnapshot(recordToRestore, user);
      onRestoreComplete(
        recordToRestore.transactions,
        recordToRestore.initialBalanceBank,
        recordToRestore.initialBalanceLedger,
        recordToRestore.currency
      );
      setRecordToRestore(null);
      setDetailRecord(null);
      setFeedbackMsg({
        type: 'success',
        text: `¡Conciliación de "${recordToRestore.name}" cargada en el Espacio de Trabajo en Vivo!`
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Error al restaurar conciliación: ${err.message}`
      });
    }
  };

  // Delete a past reconciliation record
  const handleDeleteRecord = async (recordId: string, recordName: string) => {
    if (window.confirm(`¿Confirmas que deseas eliminar del repositorio la conciliación "${recordName}"?`)) {
      try {
        await deleteSnapshot(recordId, user);
        await loadMonthlyVaultRecords();
        if (detailRecord?.id === recordId) setDetailRecord(null);
        setFeedbackMsg({
          type: 'success',
          text: 'Registro de conciliación eliminado del historial.'
        });
        setTimeout(() => setFeedbackMsg(null), 3000);
      } catch (err: any) {
        setFeedbackMsg({
          type: 'error',
          text: `Error eliminando registro: ${err.message}`
        });
      }
    }
  };

  // Import past JSON backup
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const imported = parseSnapshotFromJson(text);
        await saveSnapshot(imported, user);
        await loadMonthlyVaultRecords();
        setFeedbackMsg({
          type: 'success',
          text: `¡Conciliación "${imported.name}" importada y registrada en el repositorio!`
        });
        setTimeout(() => setFeedbackMsg(null), 4000);
      } catch (err: any) {
        setFeedbackMsg({
          type: 'error',
          text: `Archivo JSON no válido: ${err.message}`
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Available unique years for filtering
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    records.forEach((r) => {
      if (r.periodYear) yearsSet.add(r.periodYear);
      else if (r.createdAt) yearsSet.add(new Date(r.createdAt).getFullYear());
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [records]);

  // Available unique banks
  const availableBanks = useMemo(() => {
    const banksSet = new Set<string>();
    records.forEach((r) => {
      if (r.bankName) banksSet.add(r.bankName);
      if (r.bankCode && r.bankCode !== 'ALL') banksSet.add(r.bankCode);
    });
    return Array.from(banksSet);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Year filter
      if (selectedYearFilter !== 'ALL') {
        const yr = r.periodYear || new Date(r.createdAt).getFullYear();
        if (yr.toString() !== selectedYearFilter) return false;
      }

      // Month filter
      if (selectedMonthFilter !== 'ALL') {
        const mo = r.periodMonth || (new Date(r.createdAt).getMonth() + 1).toString().padStart(2, '0');
        if (mo !== selectedMonthFilter) return false;
      }

      // Bank filter
      if (selectedBankFilter !== 'ALL') {
        if (r.bankName !== selectedBankFilter && r.bankCode !== selectedBankFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'BALANCED' && !r.isBalanced) return false;
        if (selectedStatusFilter === 'UNBALANCED' && r.isBalanced) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = r.name.toLowerCase().includes(term);
        const matchDesc = (r.description || '').toLowerCase().includes(term);
        const matchPeriod = (r.periodLabel || '').toLowerCase().includes(term);
        const matchBank = (r.bankName || r.bankCode || '').toLowerCase().includes(term);
        const matchHash = (r.sha256Hash || '').toLowerCase().includes(term);
        if (!matchName && !matchDesc && !matchPeriod && !matchBank && !matchHash) return false;
      }

      return true;
    });
  }, [records, selectedYearFilter, selectedMonthFilter, selectedBankFilter, selectedStatusFilter, searchTerm]);

  // Compute stats for detail view
  const detailProof = useMemo(() => {
    if (!detailRecord) return null;
    if (detailRecord.proofOfCashData) return detailRecord.proofOfCashData;
    return calculateProofOfCash(
      detailRecord.transactions,
      detailRecord.bankCode === 'ALL' ? '' : detailRecord.bankCode || '',
      detailRecord.currency,
      detailRecord.initialBalanceBank,
      detailRecord.initialBalanceLedger
    );
  }, [detailRecord]);

  // Filtered transactions inside detail record
  const detailFilteredTransactions = useMemo(() => {
    if (!detailRecord) return [];
    if (!detailSearchTerm.trim()) return detailRecord.transactions;

    const term = detailSearchTerm.toLowerCase();
    return detailRecord.transactions.filter(
      (t) =>
        t.rawDescription.toLowerCase().includes(term) ||
        t.referenceNum.toLowerCase().includes(term) ||
        t.amountNominal.toString().includes(term) ||
        (t.counterpartyName && t.counterpartyName.toLowerCase().includes(term))
    );
  }, [detailRecord, detailSearchTerm]);

  return (
    <div className="space-y-6">
      
      {/* Hidden File Input for JSON Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJsonFile}
        accept=".json"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 rounded-3xl text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-400/20 text-sky-200 border border-sky-300/30">
              Repositorio Permanente Ven-NIF
            </span>
            <span className="text-xs text-sky-200/80">
              Norma NIIF/Ven-NIF 7 • SUDEBAN Circular 010.25 • SENIAT Fiscal
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            🏛️ Repositorio de Conciliaciones Bancarias Mensuales
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Historial completo y cerrado de las conciliaciones bancarias realizadas mes por mes. Consulta conciliaciones viejas, audita las partidas pendientes de meses anteriores, verifica firmas criptográficas de cierre y exporta actas oficiales en cualquier momento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            title="Archivar la conciliación del mes activo actual en el repositorio"
          >
            <Plus className="w-4 h-4" />
            <span>Archivar Conciliación de este Mes</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
            title="Importar un archivo JSON de respaldo de conciliación pasada"
          >
            <Upload className="w-3.5 h-3.5 text-sky-300" />
            <span>Cargar Resguardo (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center justify-between gap-3 animate-fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 shadow-2xs'
              : 'bg-rose-50 text-rose-900 border-rose-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-700 p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra de Filtros de Auditoría */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Buscador libre */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por mes, banco, hash SHA-256 o notas de conciliación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Selectores de Filtro */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filtro Año */}
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">Año: Todos</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr.toString()}>
                  Año: {yr}
                </option>
              ))}
            </select>

            {/* Filtro Mes */}
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">Mes: Todos</option>
              {MONTH_NAMES_ES.map((m) => (
                <option key={m.code} value={m.code}>
                  Mes: {m.name}
                </option>
              ))}
            </select>

            {/* Filtro Banco */}
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">Banco: Todos</option>
              {availableBanks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Filtro Estado */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">Estado: Todos</option>
              <option value="BALANCED">🟢 Cuadrada (100% Sin Diferencia)</option>
              <option value="UNBALANCED">🔴 Con Diferencia / Pendiente</option>
            </select>
          </div>
        </div>

        {/* Resumen de Registros */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Mostrando <strong>{filteredRecords.length}</strong> de <strong>{records.length}</strong> conciliaciones archivadas en el repositorio.
          </span>
          {(selectedYearFilter !== 'ALL' || selectedMonthFilter !== 'ALL' || selectedBankFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedYearFilter('ALL');
                setSelectedMonthFilter('ALL');
                setSelectedBankFilter('ALL');
                setSelectedStatusFilter('ALL');
                setSearchTerm('');
              }}
              className="text-sky-700 hover:underline font-bold text-[11px] cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista / Grid de Conciliaciones Mensuales */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-semibold">Cargando repositorio histórico de conciliaciones...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">
            No se encontraron conciliaciones mensuales registradas
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Aún no has archivado conciliaciones pasadas o los filtros aplicados no coinciden. Puedes archivar la conciliación activa pulsando el botón verde superior.
          </p>
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Archivar Conciliación de este Mes Ahora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((rec) => {
            const isBal = rec.isBalanced;
            const periodText = rec.periodLabel || `Mes de ${new Date(rec.createdAt).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}`;
            const recSym = rec.currency === 'VES' ? 'Bs.' : '$';

            return (
              <div
                key={rec.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Header Tarjeta */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {periodText}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                        isBal
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {isBal ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Cuadrada y Cerrada
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Diferencia: {recSym} {Math.abs(rec.difference).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Título & Banco */}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-1">
                      {rec.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold truncate mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{rec.bankName || rec.bankCode || 'Banesco Banco Universal'}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-700">{rec.currency}</span>
                    </p>
                  </div>

                  {/* Cuadro Resumen de Saldos */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1.5 font-mono">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Saldo según Banco:</span>
                      <span className="font-bold text-slate-900">
                        {recSym} {rec.initialBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Saldo según Libro:</span>
                      <span className="font-bold text-slate-900">
                        {recSym} {rec.initialBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-[10px]">
                      <span className="text-slate-500">Transacciones:</span>
                      <span className="font-sans font-bold text-slate-800">
                        {rec.transactionsCount} partidas ({rec.matchedCount} conc.)
                      </span>
                    </div>
                  </div>

                  {/* Metadata Hash */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Cierre: {new Date(rec.createdAt).toLocaleDateString('es-VE')}</span>
                    <span className="truncate max-w-[120px]" title={rec.sha256Hash || rec.id}>
                      Hash: {(rec.sha256Hash || rec.id).slice(0, 10)}...
                    </span>
                  </div>
                </div>

                {/* Footer Botones de Acción */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => setDetailRecord(rec)}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="Ver acta de conciliación, cuadro de 4 columnas y detalle de partidas de este mes"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Detalle del Mes</span>
                  </button>

                  <button
                    onClick={() => setRecordToRestore(rec)}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    title="Cargar esta conciliación en el espacio de trabajo activo"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  </button>

                  <button
                    onClick={() => exportSnapshotToJson(rec)}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    title="Descargar copia de resguardo .JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                  </button>

                  <button
                    onClick={() => handleDeleteRecord(rec.id, rec.name)}
                    className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 font-bold text-[11px] rounded-lg border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                    title="Eliminar registro del repositorio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE DETALLE DE CONCILIACIÓN PASADA */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">
            
            {/* Header del Visor */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-400/20 text-sky-200 border border-sky-300/30">
                    Acta Oficial de Conciliación Bancaria Mensual
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {detailRecord.periodLabel || new Date(detailRecord.createdAt).toLocaleDateString('es-VE')}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {detailRecord.name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer"
                  title="Imprimir o Guardar en PDF"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDetailRecord(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo del Visor */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* Membrete de Empresa */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Empresa</span>
                  <span className="font-black text-slate-900 text-sm block">
                    {company.companyName || 'EMPRESA REGISTRADA'}
                  </span>
                  <span className="text-slate-500 font-mono">
                    RIF: {company.companyRif || 'J-00000000-0'}
                  </span>
                </div>

                <div className="sm:text-right space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Banco & Moneda</span>
                  <span className="font-bold text-slate-800 block">
                    {detailRecord.bankName || detailRecord.bankCode || 'Banesco Banco Universal'} ({detailRecord.currency})
                  </span>
                  {detailRecord.bcvRateUsed && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200 inline-block">
                      Tasa BCV del Mes: Bs. {detailRecord.bcvRateUsed.toFixed(2)}/USD
                    </span>
                  )}
                </div>
              </div>

              {/* Cuadro Cuádruple de Conciliación Bancaria Ven-NIF */}
              {detailProof && (
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-sky-700" />
                    <span>Cuadro Cuádruple de Conciliación y Arqueo de Saldos (Ven-NIF 7)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                    {/* Columna Banco */}
                    <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2">
                      <div className="font-black text-blue-950 pb-1 border-b border-blue-200 flex justify-between">
                        <span>ESTADO DE CUENTA BANCO</span>
                        <span>{detailRecord.currency}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Saldo Inicial Banco:</span>
                        <span className="font-bold">
                          {detailRecord.currency === 'VES' ? 'Bs.' : '$'} {detailProof.initialBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-800">
                        <span>(+) Entradas / Depósitos:</span>
                        <span className="font-bold">
                          + {detailProof.inflowsBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-rose-800">
                        <span>(-) Salidas / Débitos:</span>
                        <span className="font-bold">
                          - {detailProof.outflowsBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-950 font-black text-xs pt-1.5 border-t border-blue-200">
                        <span>Saldo Según Estado Banco:</span>
                        <span>
                          {detailRecord.currency === 'VES' ? 'Bs.' : '$'} {detailProof.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Columna Libros */}
                    <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-2">
                      <div className="font-black text-indigo-950 pb-1 border-b border-indigo-200 flex justify-between">
                        <span>LIBRO MAYOR CONTABLE</span>
                        <span>{detailRecord.currency}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Saldo Inicial Libro:</span>
                        <span className="font-bold">
                          {detailRecord.currency === 'VES' ? 'Bs.' : '$'} {detailProof.initialBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-800">
                        <span>(+) Entradas / Cobros:</span>
                        <span className="font-bold">
                          + {detailProof.inflowsLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-rose-800">
                        <span>(-) Salidas / Pagos:</span>
                        <span className="font-bold">
                          - {detailProof.outflowsLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-indigo-950 font-black text-xs pt-1.5 border-t border-indigo-200">
                        <span>Saldo Según Libro Mayor:</span>
                        <span>
                          {detailRecord.currency === 'VES' ? 'Bs.' : '$'} {detailProof.finalBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buscador de partidas dentro del detalle */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-extrabold text-slate-900 text-xs">
                    Listado de Partidas Registradas en esta Conciliación ({detailFilteredTransactions.length})
                  </h4>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por referencia o concepto..."
                      value={detailSearchTerm}
                      onChange={(e) => setDetailSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 border border-slate-300 rounded-lg text-[11px] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tabla de Movimientos de este Mes */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-60 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Origen</th>
                        <th className="p-2">Referencia</th>
                        <th className="p-2">Descripción</th>
                        <th className="p-2 text-right">Monto</th>
                        <th className="p-2 text-center">Estado Cruce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {detailFilteredTransactions.slice(0, 100).map((t) => {
                        const isMatch = t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY';
                        const isOut = t.txType === 'DEBIT';

                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="p-2 text-slate-600 whitespace-nowrap">{t.txDate}</td>
                            <td className="p-2 font-sans font-bold">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                t.source === 'BANK' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {t.source === 'BANK' ? 'BANCO' : 'LIBRO'}
                              </span>
                            </td>
                            <td className="p-2 font-bold text-slate-800">{t.referenceNum}</td>
                            <td className="p-2 font-sans text-slate-700 max-w-xs truncate">{t.rawDescription}</td>
                            <td className={`p-2 text-right font-bold whitespace-nowrap ${isOut ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {isOut ? '-' : '+'} {t.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-sans font-bold ${
                                isMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isMatch ? 'Conciliado' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Firmas y Hash de Cierre Forensic */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600 font-mono">
                <div>
                  <span className="font-bold text-slate-800 block font-sans">
                    🔒 Sello Forensic SHA-256 de Cierre
                  </span>
                  <span className="text-[10px] text-slate-500 break-all">
                    {detailRecord.sha256Hash || detailRecord.id}
                  </span>
                </div>

                <button
                  onClick={() => setRecordToRestore(detailRecord)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-2xs cursor-pointer font-sans text-xs shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cargar en Espacio de Trabajo</span>
                </button>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-medium">
                RegTech Ven-NIF • Conciliación Bancaria Auditada
              </span>
              <button
                onClick={() => setDetailRecord(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PARA ARCHIVAR CONCILIACIÓN DE ESTE MES */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-fade-in">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Archivar Conciliación Bancaria Mensual
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Guarda la conciliación activa en el repositorio oficial de cierres.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsArchiveModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleArchiveCurrentMonth} className="space-y-3.5 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Mes de Conciliación:</label>
                  <select
                    value={archiveMonth}
                    onChange={(e) => setArchiveMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none"
                    required
                  >
                    {MONTH_NAMES_ES.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Año de Ejercicio:</label>
                  <input
                    type="number"
                    value={archiveYear}
                    onChange={(e) => setArchiveYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Banco Institucional:</label>
                <select
                  value={archiveBankName}
                  onChange={(e) => setArchiveBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-xs font-semibold focus:outline-none"
                >
                  <option value="Banesco Banco Universal">Banesco Banco Universal</option>
                  <option value="Banco Mercantil">Banco Mercantil</option>
                  <option value="Banco de Venezuela (BDV)">Banco de Venezuela (BDV)</option>
                  <option value="Banco Nacional de Crédito (BNC)">Banco Nacional de Crédito (BNC)</option>
                  <option value="Bancamiga">Bancamiga</option>
                  <option value="Banco Provincial (BBVA)">Banco Provincial (BBVA)</option>
                  <option value="Zelle / Bank of America">Zelle / Bank of America</option>
                  <option value="Binance Pay (USDT)">Binance Pay (USDT)</option>
                  <option value="Todos los Bancos Unificados">Todos los Bancos Unificados</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Observaciones de Auditoría / Cierre:</label>
                <textarea
                  value={archiveNotes}
                  onChange={(e) => setArchiveNotes(e.target.value)}
                  placeholder="ej. Conciliación mensual cerrada sin diferencias. Se adjuntan soportes probatorios de Pago Móvil."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Guardando Cierre...' : 'Archivar en Repositorio'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE RESTAURACIÓN */}
      {recordToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 text-amber-800 font-extrabold text-sm">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <span>¿Cargar Conciliación en el Espacio de Trabajo?</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cargarás en pantalla la conciliación de <strong>"{recordToRestore.name}"</strong> ({recordToRestore.transactionsCount} partidas). Esto reemplazará las partidas activas actuales para permitirte revisar o reajustar esa conciliación.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setRecordToRestore(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRestore}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-2xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sí, Cargar esta Conciliación</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
