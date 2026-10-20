import React, { useState, useMemo, useRef } from 'react';
import {
  FileCheck2,
  DollarSign,
  ArrowDownLeft,
  Users,
  CreditCard,
  Landmark,
  ArrowUpRight,
  UserCheck,
  UserMinus,
  Globe,
  Truck,
  Receipt,
  Briefcase,
  Building2,
  ShieldCheck,
  Check,
  Filter,
  Upload,
  FileText,
  Image as ImageIcon,
  Eye,
  Trash2,
  Download,
  AlertCircle,
  FolderOpen,
  Sparkles,
  Search,
  ExternalLink,
  HelpCircle,
  X,
  FilePlus,
  RefreshCw,
  Hash
} from 'lucide-react';
import {
  BankTransaction,
  CurrencyType,
  UserCompanyProfile,
  DigitalSupportAttachment
} from '../types/accounting';
import { RECONCILIATION_MODULES } from '../data/venNifAccounts';
import { categorizeTransactionRuleBased } from '../services/aiAccountant';
import { TelegramSyncControl } from './TelegramSyncControl';

interface ModuleJustificationSuiteProps {
  company: UserCompanyProfile;
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  selectedTxForJustification?: BankTransaction | null;
  onAssignModule: (txId: string, moduleTag: string, notes: string) => void;
  onUpdateTransactions?: (updated: BankTransaction[]) => void;
}

// Compute simple SHA-256 hash representation for forensic evidence
async function computeSha256(textOrBytes: string): Promise<string> {
  try {
    const msgUint8 = new TextEncoder().encode(textOrBytes);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `hash-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

export const ModuleJustificationSuite: React.FC<ModuleJustificationSuiteProps> = ({
  company,
  transactions,
  currency,
  bcvRate,
  selectedTxForJustification,
  onAssignModule,
  onUpdateTransactions
}) => {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    selectedTxForJustification?.moduleTag || 'MOD_VENTAS'
  );
  const [activeFilterType, setActiveFilterType] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTxIdForAttach, setSelectedTxIdForAttach] = useState<string>('');
  const [previewAttachment, setPreviewAttachment] = useState<DigitalSupportAttachment | null>(null);
  const [supportNoteInput, setSupportNoteInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Bank transactions filtered to current currency
  const bankTransactions = useMemo(() => {
    return transactions.filter(t => t.source === 'BANK' && t.currency === currency);
  }, [transactions, currency]);

  // Group transactions by moduleTag
  const transactionsByModule = useMemo(() => {
    const map: Record<string, BankTransaction[]> = {};
    for (const mod of RECONCILIATION_MODULES) {
      map[mod.id] = [];
    }
    // Also include MOD_OTROS fallback
    if (!map['MOD_OTROS']) map['MOD_OTROS'] = [];

    for (const tx of bankTransactions) {
      const tag = tx.moduleTag && map[tx.moduleTag] ? tx.moduleTag : 'MOD_OTROS';
      map[tag].push(tx);
    }
    return map;
  }, [bankTransactions]);

  // All attachments in current category (from transactions + category-wide)
  const currentCategoryTxs = useMemo(() => {
    const txs = transactionsByModule[selectedModuleId] || [];
    if (!searchTerm.trim()) return txs;
    const term = searchTerm.toLowerCase();
    return txs.filter(t =>
      t.rawDescription.toLowerCase().includes(term) ||
      t.referenceNum.toLowerCase().includes(term) ||
      (t.counterpartyRif && t.counterpartyRif.toLowerCase().includes(term))
    );
  }, [transactionsByModule, selectedModuleId, searchTerm]);

  // Collect all attachments from current category transactions
  const currentCategoryAttachments = useMemo(() => {
    const list: DigitalSupportAttachment[] = [];
    const txs = transactionsByModule[selectedModuleId] || [];
    for (const tx of txs) {
      if (tx.attachments && tx.attachments.length > 0) {
        list.push(...tx.attachments);
      }
    }
    return list;
  }, [transactionsByModule, selectedModuleId]);

  const activeModuleMeta = useMemo(() => {
    return RECONCILIATION_MODULES.find(m => m.id === selectedModuleId) || {
      id: 'MOD_OTROS',
      title: 'Otros / No Identificados',
      type: 'ALL',
      description: 'Partidas no clasificadas automáticamente que requieren revisión contable o soporte probatorio.'
    };
  }, [selectedModuleId]);

  // Calculate totals for active category
  const activeCategoryTotals = useMemo(() => {
    const txs = transactionsByModule[selectedModuleId] || [];
    const totalAmount = txs.reduce((acc, t) => acc + t.amountNominal, 0);
    const withSupportCount = txs.filter(t => t.attachments && t.attachments.length > 0).length;
    const supportRate = txs.length > 0 ? Math.round((withSupportCount / txs.length) * 100) : 0;
    return {
      count: txs.length,
      totalAmount,
      withSupportCount,
      supportRate
    };
  }, [transactionsByModule, selectedModuleId]);

  // Handle uploading files (images or PDFs)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
      const fileType = isPdf ? 'PDF' : 'IMAGE';

      // Read file as Base64 Data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const hash = await computeSha256(dataUrl.slice(0, 5000) + file.name + file.size);

      const targetTxId = selectedTxIdForAttach || (currentCategoryTxs[0]?.id || '');

      const newAttachment: DigitalSupportAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        fileType,
        dataUrl,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        sha256Hash: hash,
        notes: supportNoteInput.trim() || `Soporte probatorio cargado para ${activeModuleMeta.title}`,
        txId: targetTxId || undefined,
        moduleTag: selectedModuleId
      };

      // Attach to transaction if we have one, or first in category
      if (onUpdateTransactions) {
        const updated = transactions.map(t => {
          if (t.id === targetTxId) {
            return {
              ...t,
              attachments: [...(t.attachments || []), newAttachment]
            };
          }
          return t;
        });
        onUpdateTransactions(updated);
      }

      setSupportNoteInput('');
      setSelectedTxIdForAttach('');
      setSuccessMsg(`¡Soporte "${file.name}" cargado exitosamente en ${activeModuleMeta.title}!`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error al subir soporte digital:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Re-classify transaction to a new category
  const handleReclassifyTx = (txId: string, newModuleId: string) => {
    onAssignModule(txId, newModuleId, `Reclasificado a ${newModuleId}`);
    if (onUpdateTransactions) {
      const updated = transactions.map(t => (t.id === txId ? { ...t, moduleTag: newModuleId } : t));
      onUpdateTransactions(updated);
    }
    setSuccessMsg('Movimiento reclasificado con éxito.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Auto-classify all transactions based on Venezuelan accounting rules
  const handleAutoClassifyAll = () => {
    if (!onUpdateTransactions) return;

    let changedCount = 0;
    const updated = transactions.map(t => {
      // If already has a valid moduleTag other than MOD_OTROS, preserve it
      if (t.moduleTag && t.moduleTag !== 'MOD_OTROS') return t;

      const rule = categorizeTransactionRuleBased(
        t.rawDescription,
        t.amountNominal,
        t.txType,
        t.currency,
        t.bankName
      );

      changedCount++;
      return {
        ...t,
        moduleTag: rule.moduleTag,
        accountCode: rule.accountCode,
        accountName: rule.accountName
      };
    });

    onUpdateTransactions(updated);
    setSuccessMsg(`¡Clasificación automática completada! Se asignaron ${changedCount} transacciones a sus módulos correspondientes.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Remove an attachment
  const handleDeleteAttachment = (attId: string, txId?: string) => {
    if (!onUpdateTransactions) return;
    const updated = transactions.map(t => {
      if (t.attachments) {
        return {
          ...t,
          attachments: t.attachments.filter(a => a.id !== attId)
        };
      }
      return t;
    });
    onUpdateTransactions(updated);
    if (previewAttachment?.id === attId) setPreviewAttachment(null);
  };

  const getModuleIcon = (id: string) => {
    switch (id) {
      case 'MOD_VENTAS': return FileCheck2;
      case 'MOD_USD_IN': return DollarSign;
      case 'MOD_TFR_PROPIAS_IN': return ArrowDownLeft;
      case 'MOD_SOCIOS_IN': return Users;
      case 'MOD_POS': return CreditCard;
      case 'MOD_PRESTAMOS_IN': return Landmark;
      case 'MOD_CXC_SOCIOS': return UserCheck;
      case 'MOD_TFR_PROPIAS_OUT': return ArrowUpRight;
      case 'MOD_CXP_SOCIOS': return UserMinus;
      case 'MOD_PROVEEDORES': return Truck;
      case 'MOD_USD_OUT': return Globe;
      case 'MOD_ANTICIPOS': return Receipt;
      case 'MOD_NOMINA': return Briefcase;
      case 'MOD_SENIAT_PAGO': return Building2;
      case 'MOD_COMISIONES': return Landmark;
      case 'MOD_OTROS': return HelpCircle;
      default: return ShieldCheck;
    }
  };

  const filteredCatalog = useMemo(() => {
    return RECONCILIATION_MODULES.filter(m => {
      if (activeFilterType === 'ALL') return true;
      if (m.type === 'ALL') return true;
      return m.type === activeFilterType;
    });
  }, [activeFilterType]);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-sky-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-400/20 text-cyan-200 border border-cyan-300/30">
              Traza Documental Probatoria
            </span>
            <span className="text-xs text-cyan-200/70">
              Normas Ven-NIF • Prov. SENIAT 0071 • Res. SUDEBAN 010.25
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Módulo de Justificación Contable, Tributaria y Repositorio de Soportes
          </h2>
          <p className="text-xs text-cyan-100/80 max-w-2xl leading-relaxed">
            Organiza las transacciones bancarias en sus categorías exactas y carga los soportes digitales (fotos de transferencias, capturas de Pago Móvil, facturas y comprobantes PDF) para blindar la empresa ante cualquier fiscalización o auditoría.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <TelegramSyncControl
            bcvRate={bcvRate}
            transactions={transactions}
            onUpdateTransactions={onUpdateTransactions || (() => {})}
            onNewSupportsAdded={(newSupports) => {
              setSuccessMsg(`Se sincronizaron y archivaron ${newSupports.length} soportes desde Telegram.`);
              setTimeout(() => setSuccessMsg(null), 4000);
            }}
          />
          <button
            onClick={handleAutoClassifyAll}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Clasificar</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Left Catalog of 16 Categories | Right Content & Repository */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: 16 Categorías Selector */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 space-y-3 flex flex-col h-[750px]">
          
          <div className="border-b border-slate-100 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Categorías Contables ({filteredCatalog.length})
              </h3>
              
              {/* Type Filter */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setActiveFilterType('ALL')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    activeFilterType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setActiveFilterType('INFLOW')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    activeFilterType === 'INFLOW' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  Entradas
                </button>
                <button
                  onClick={() => setActiveFilterType('OUTFLOW')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    activeFilterType === 'OUTFLOW' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500 hover:text-rose-700'
                  }`}
                >
                  Salidas
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Selecciona una categoría para ver sus movimientos y cargar fotos/PDFs de soporte.
            </p>
          </div>

          {/* Scrollable Categories List */}
          <div className="overflow-y-auto space-y-2 flex-1 pr-1">
            {filteredCatalog.map(mod => {
              const isSelected = selectedModuleId === mod.id;
              const Icon = getModuleIcon(mod.id);
              const txs = transactionsByModule[mod.id] || [];
              const count = txs.length;
              const total = txs.reduce((acc, t) => acc + t.amountNominal, 0);
              const withSupport = txs.filter(t => t.attachments && t.attachments.length > 0).length;

              const isOtros = mod.id === 'MOD_OTROS';

              return (
                <div
                  key={mod.id}
                  onClick={() => { setSelectedModuleId(mod.id); setSearchTerm(''); }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/70 ring-2 ring-cyan-200 shadow-2xs'
                      : isOtros
                      ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        isOtros
                          ? 'bg-amber-100 text-amber-800'
                          : mod.type === 'INFLOW'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-slate-900 leading-tight block">
                        {mod.title}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      count > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {count} {count === 1 ? 'partida' : 'partidas'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    {mod.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                    <span className="font-mono font-semibold text-slate-700">
                      Total: {sym} {total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>

                    <span className={`font-semibold flex items-center gap-1 ${
                      withSupport > 0 ? 'text-emerald-700' : (count > 0 ? 'text-amber-700' : 'text-slate-400')
                    }`}>
                      {withSupport > 0 ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{withSupport} con soporte</span>
                        </>
                      ) : count > 0 ? (
                        <span>Sin soporte</span>
                      ) : (
                        <span>0 soportes</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Right Column: Active Category Details, Digital Support Repository & Transactions */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Category Header Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-xs ${
                  activeModuleMeta.id === 'MOD_OTROS'
                    ? 'bg-amber-600'
                    : activeModuleMeta.type === 'INFLOW'
                    ? 'bg-emerald-600'
                    : 'bg-rose-600'
                }`}>
                  {React.createElement(getModuleIcon(activeModuleMeta.id), { className: 'w-6 h-6' })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {activeModuleMeta.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {activeModuleMeta.type === 'INFLOW' ? 'Entrada al Banco' : (activeModuleMeta.type === 'OUTFLOW' ? 'Salida del Banco' : 'Especial')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeModuleMeta.description}
                  </p>
                </div>
              </div>

              {/* Quick Stat Pill */}
              <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Total en Categoría</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {sym} {activeCategoryTotals.totalAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-7 w-[1px] bg-slate-200" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Cobertura Soporte</span>
                  <span className={`font-mono font-bold text-sm ${
                    activeCategoryTotals.supportRate === 100
                      ? 'text-emerald-700'
                      : activeCategoryTotals.supportRate > 0
                      ? 'text-amber-700'
                      : 'text-slate-400'
                  }`}>
                    {activeCategoryTotals.supportRate}% ({activeCategoryTotals.withSupportCount}/{activeCategoryTotals.count})
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN A: REPOSITORIO DE SOPORTES DIGITALES (FOTOS Y PDFS) */}
            <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-cyan-700" />
                  <span className="text-xs font-bold text-slate-900">
                    Bóveda de Soportes Digitales de {activeModuleMeta.title} ({currentCategoryAttachments.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Admite capturas de transferencias, fotos de recibos Pago Móvil y comprobantes PDF.
                </span>
              </div>

              {/* Upload Input Area */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      Vincular a Movimiento Bancario Específico (Opcional):
                    </label>
                    <select
                      value={selectedTxIdForAttach}
                      onChange={(e) => setSelectedTxIdForAttach(e.target.value)}
                      className="w-full text-xs font-mono p-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none"
                    >
                      <option value="">-- Soporte general para toda la categoría --</option>
                      {currentCategoryTxs.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.txDate} | Ref: {t.referenceNum} | {sym} {t.amountNominal.toLocaleString('es-VE')} ({t.rawDescription.slice(0, 30)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      Nota o Concepto del Documento:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Captura de pantalla Pago Móvil Ref. 60053819318..."
                      value={supportNoteInput}
                      onChange={(e) => setSupportNoteInput(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <ImageIcon className="w-3.5 h-3.5 text-cyan-600" /> JPG, PNG, WebP
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <FileText className="w-3.5 h-3.5 text-rose-600" /> Documentos PDF
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                  >
                    <FilePlus className="w-4 h-4" />
                    <span>{isUploading ? 'Procesando archivo...' : 'Cargar Foto o PDF'}</span>
                  </button>
                </div>
              </div>

              {/* Gallery of Uploaded Attachments */}
              {currentCategoryAttachments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 text-xs space-y-1">
                  <Upload className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600">No hay soportes digitales cargados en esta categoría</p>
                  <p className="text-[11px] text-slate-400">
                    Sube las capturas de transferencias, fotos de recibos o comprobantes PDF para justificar estos movimientos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {currentCategoryAttachments.map(att => {
                    const isPdf = att.fileType === 'PDF';
                    const txLinked = transactions.find(t => t.id === att.txId);

                    return (
                      <div
                        key={att.id}
                        className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          {/* Thumbnail / Header */}
                          <div
                            onClick={() => setPreviewAttachment(att)}
                            className="h-28 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer relative group"
                          >
                            {isPdf ? (
                              <div className="flex flex-col items-center gap-1 text-rose-600">
                                <FileText className="w-10 h-10" />
                                <span className="text-[10px] font-bold uppercase">Documento PDF</span>
                              </div>
                            ) : (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            )}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" />
                              <span>Ver Soporte</span>
                            </div>
                          </div>

                          <div>
                            <span className="font-bold text-slate-900 text-xs block truncate" title={att.name}>
                              {att.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {(att.sizeBytes / 1024).toFixed(1)} KB • {new Date(att.uploadedAt).toLocaleDateString('es-VE')}
                            </span>
                          </div>

                          {att.notes && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                              {att.notes}
                            </p>
                          )}

                          {txLinked && (
                            <div className="text-[10px] font-mono text-cyan-800 bg-cyan-50/70 p-1 rounded-lg">
                              Vinculado a Ref: <strong>{txLinked.referenceNum}</strong> ({sym} {txLinked.amountNominal.toFixed(2)})
                            </div>
                          )}

                          {att.sha256Hash && (
                            <div className="text-[9px] font-mono text-slate-400 truncate flex items-center gap-1" title={att.sha256Hash}>
                              <Hash className="w-2.5 h-2.5 shrink-0" />
                              <span>SHA-256: {att.sha256Hash.slice(0, 16)}...</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <button
                            onClick={() => setPreviewAttachment(att)}
                            className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ampliar</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <a
                              href={att.dataUrl}
                              download={att.name}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Descargar archivo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(att.id, att.txId)}
                              className="text-rose-400 hover:text-rose-700 cursor-pointer"
                              title="Eliminar soporte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN B: MOVIMIENTOS BANCARIOS CLASIFICADOS EN ESTA CATEGORÍA */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Transacciones Bancarias Clasificadas en {activeModuleMeta.title} ({currentCategoryTxs.length})
                  </h4>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por ref, RIF o detalle..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {currentCategoryTxs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <p className="font-semibold text-slate-600">No hay movimientos bancarios en esta categoría</p>
                  <p className="text-[11px] text-slate-400">
                    Carga tu extracto bancario en el Paso 1 o usa el botón "Auto-Clasificar Movimientos" para distribuir automáticamente las partidas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Referencia</th>
                        <th className="p-3">Concepto Extracto Bancario</th>
                        <th className="p-3 text-right">Monto ({sym})</th>
                        <th className="p-3 text-center">Soporte Digital</th>
                        <th className="p-3 text-right">Reclasificar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {currentCategoryTxs.map(tx => {
                        const hasAttachments = tx.attachments && tx.attachments.length > 0;

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 whitespace-nowrap text-slate-600 font-sans text-xs">
                              {tx.txDate}
                            </td>
                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                              {tx.referenceNum}
                            </td>
                            <td className="p-3 font-sans max-w-xs text-xs text-slate-800">
                              <span className="font-medium">{tx.rawDescription}</span>
                              {tx.counterpartyRif && (
                                <span className="text-[10px] text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded font-mono font-bold ml-1.5">
                                  {tx.counterpartyRif}
                                </span>
                              )}
                            </td>
                            <td className={`p-3 text-right font-bold whitespace-nowrap ${
                              tx.txType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'
                            }`}>
                              {tx.txType === 'DEBIT' ? '-' : '+'}
                              {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            
                            {/* Soporte Digital */}
                            <td className="p-3 text-center whitespace-nowrap">
                              {hasAttachments ? (
                                <button
                                  onClick={() => setPreviewAttachment(tx.attachments![0])}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] cursor-pointer hover:bg-emerald-200 transition-colors"
                                >
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>{tx.attachments!.length} {tx.attachments!.length === 1 ? 'Soporte' : 'Soportes'}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedTxIdForAttach(tx.id);
                                    fileInputRef.current?.click();
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 cursor-pointer transition-colors"
                                >
                                  <Upload className="w-3 h-3 text-amber-600" />
                                  <span>+ Adjuntar Foto/PDF</span>
                                </button>
                              )}
                            </td>

                            {/* Dropdown to Re-classify */}
                            <td className="p-3 text-right whitespace-nowrap">
                              <select
                                value={tx.moduleTag || selectedModuleId}
                                onChange={(e) => handleReclassifyTx(tx.id, e.target.value)}
                                className="text-[11px] font-sans font-semibold p-1 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer"
                              >
                                {RECONCILIATION_MODULES.map(m => (
                                  <option key={m.id} value={m.id}>
                                    Mover a {m.title}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Modal: Fullscreen Preview for Images or PDFs */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {previewAttachment.fileType === 'PDF' ? (
                  <FileText className="w-5 h-5 text-rose-600" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-cyan-600" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{previewAttachment.name}</h4>
                  <span className="text-[10px] text-slate-500">
                    Cargado: {new Date(previewAttachment.uploadedAt).toLocaleString('es-VE')} • {(previewAttachment.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content Preview */}
            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-950/5 min-h-[350px]">
              {previewAttachment.fileType === 'PDF' ? (
                <iframe
                  src={previewAttachment.dataUrl}
                  title={previewAttachment.name}
                  className="w-full h-[600px] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-h-[600px] max-w-full rounded-xl object-contain shadow-sm border border-slate-200 bg-white"
                />
              )}
            </div>

            {/* Modal Footer Notes & Hash */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-slate-700">Memoria Explicativa: </span>
                <span className="text-slate-600">{previewAttachment.notes || 'Sin nota explicativa'}</span>
              </div>
              {previewAttachment.sha256Hash && (
                <div className="font-mono text-[10px] text-slate-400">
                  Hash SHA-256: {previewAttachment.sha256Hash}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
