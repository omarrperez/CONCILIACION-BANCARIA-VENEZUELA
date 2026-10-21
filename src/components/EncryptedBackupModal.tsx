import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  Building2,
  Database,
  Layers,
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  BankTransaction,
  CompanyProfile,
  CurrencyType,
  DigitalSupportAttachment,
  CashLogRecord,
  CashFlowTraceItem
} from '../types/accounting';
import {
  createEncryptedDatabaseBackup,
  decryptDatabaseBackup,
  downloadEncryptedBackupFile,
  NominusDatabasePayload,
  EncryptedBackupEnvelope
} from '../services/encryptedBackupService';

interface EncryptedBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompany: CompanyProfile;
  companies: CompanyProfile[];
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  digitalSupports?: DigitalSupportAttachment[];
  cashLogs?: CashLogRecord[];
  cashTraces?: CashFlowTraceItem[];
  onRestoreDatabase: (restoredData: NominusDatabasePayload) => Promise<void> | void;
}

export const EncryptedBackupModal: React.FC<EncryptedBackupModalProps> = ({
  isOpen,
  onClose,
  activeCompany,
  companies,
  transactions,
  currency,
  bcvRate,
  initialBalanceBank,
  initialBalanceLedger,
  digitalSupports = [],
  cashLogs = [],
  cashTraces = [],
  onRestoreDatabase
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');

  // Export State
  const [exportPassword, setExportPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Import State
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importedEnvelope, setImportedEnvelope] = useState<EncryptedBackupEnvelope | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Manejar exportación cifrada
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (exportPassword.length < 6) {
      setFeedback({ type: 'error', message: 'La contraseña debe contener al menos 6 caracteres.' });
      return;
    }

    if (exportPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Las contraseñas ingresadas no coinciden.' });
      return;
    }

    setIsExporting(true);
    try {
      const bankCount = transactions.filter(t => t.source === 'BANK').length;
      const ledgerCount = transactions.filter(t => t.source === 'LEDGER').length;
      const matchedCount = transactions.filter(t => t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY').length;
      const unmatchedCount = transactions.filter(t => t.matchingStatus === 'UNMATCHED').length;

      const payload: NominusDatabasePayload = {
        version: '2.0',
        createdAt: new Date().toISOString(),
        sourceSystem: 'NOMINUS_CONCILIACIONES_VEN_NIF',
        company: activeCompany,
        companies: companies,
        transactions: transactions,
        currency: currency,
        bcvRate: bcvRate,
        initialBalanceBank: initialBalanceBank,
        initialBalanceLedger: initialBalanceLedger,
        digitalSupports: digitalSupports,
        cashLogs: cashLogs,
        cashTraces: cashTraces,
        metadata: {
          totalTransactions: transactions.length,
          bankTransactionsCount: bankCount,
          ledgerTransactionsCount: ledgerCount,
          matchedTransactionsCount: matchedCount,
          unmatchedTransactionsCount: unmatchedCount,
          activeCompanyRif: activeCompany.companyRif,
          activeCompanyName: activeCompany.companyName
        }
      };

      const envelope = await createEncryptedDatabaseBackup(payload, exportPassword);
      downloadEncryptedBackupFile(envelope);

      setFeedback({
        type: 'success',
        message: '¡Base de datos cifrada y descargada exitosamente! Guarda tu archivo y recuerda tu contraseña.'
      });
      setExportPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cifrar la base de datos.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Carga de archivo para importar
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    setImportFileContent(null);
    setImportedEnvelope(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.format !== 'NOMINUS_ENCRYPTED_BACKUP' || !parsed.ciphertext) {
          throw new Error('El archivo no corresponde a una copia de seguridad cifrada válida de Nominus.');
        }
        setImportFileContent(text);
        setImportedEnvelope(parsed);
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err.message || 'El archivo seleccionado no es un JSON válido de respaldo.'
        });
      }
    };
    reader.readAsText(file);
  };

  // Manejar descifrado y restauración
  const handleImportAndRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFileContent) return;

    setIsDecrypting(true);
    setFeedback(null);

    try {
      const restoredPayload = await decryptDatabaseBackup(importFileContent, importPassword);
      await onRestoreDatabase(restoredPayload);

      setFeedback({
        type: 'success',
        message: `¡Base de datos descifrada y restaurada con éxito! Se cargaron ${restoredPayload.transactions.length} transacciones y el perfil de ${restoredPayload.company.companyName}.`
      });

      setImportPassword('');
      setImportFileContent(null);
      setImportedEnvelope(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al descifrar el archivo de seguridad.'
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-indigo-800 text-white flex items-center justify-center shadow-md">
              <Lock className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  Bóveda de Seguridad Cifrada Local
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Respaldo completo de base de datos fuera de Firestore protegido con contraseña
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

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab('EXPORT');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'EXPORT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Exportar Respaldo Cifrado</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('IMPORT');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'IMPORT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Restaurar Archivo Cifrado</span>
          </button>
        </div>

        {/* PESTAÑA 1: EXPORTAR */}
        {activeTab === 'EXPORT' && (
          <form onSubmit={handleExport} className="space-y-4">
            
            {/* Resumen del Contenido a Exportar */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Paquete Completo de la Base de Datos a Cifrar:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Empresa</span>
                  <strong className="text-slate-800 truncate block">{activeCompany.companyName}</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Transacciones</span>
                  <strong className="text-slate-800 block">{transactions.length} registros</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Moneda & Tasa</span>
                  <strong className="text-slate-800 block">{currency} (Bs. {bcvRate.toFixed(2)})</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Cuentas Bancarias</span>
                  <strong className="text-slate-800 block">{activeCompany.bankAccounts?.length || 0} cuentas</strong>
                </div>
              </div>
            </div>

            {/* Inputs de Contraseña */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Contraseña de Cifrado Maestro (Mínimo 6 caracteres):
                </label>
                <div className="relative">
                  <input
                    type={showExportPassword ? 'text' : 'password'}
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Escribe una contraseña segura..."
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPassword(!showExportPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Confirmar Contraseña:
                </label>
                <input
                  type={showExportPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña..."
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Aviso Criptográfico */}
            <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Cifrado de Conocimiento Cero (Zero-Knowledge):</strong> La contraseña nunca se transmite a ningún servidor ni se almacena en Firebase. Si la olvidas, nadie podrá descifrar ni recuperar este archivo de seguridad.
              </div>
            </div>

            <button
              type="submit"
              disabled={isExporting || exportPassword.length < 6 || exportPassword !== confirmPassword}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                  <span>Cifrando Base de Datos con AES-256...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-indigo-300" />
                  <span>Cifrar y Descargar Archivo JSON (.json)</span>
                </>
              )}
            </button>

          </form>
        )}

        {/* PESTAÑA 2: IMPORTAR Y DESCIFRAR */}
        {activeTab === 'IMPORT' && (
          <form onSubmit={handleImportAndRestore} className="space-y-4">
            
            {/* Selector de Archivo */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Selecciona el Archivo de Respaldo Cifrado (.json):
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            {/* Metadatos detectados en el encabezado del archivo */}
            {importedEnvelope && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-emerald-600" />
                    Paquete Cifrado Válido Detectado
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    {importedEnvelope.algorithm} • PBKDF2
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Empresa:</span>
                    <strong>{importedEnvelope.summary.companyName} {importedEnvelope.summary.companyRif ? `(${importedEnvelope.summary.companyRif})` : ''}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Transacciones:</span>
                    <strong>{importedEnvelope.summary.totalTransactions} registros</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Moneda:</span>
                    <strong>{importedEnvelope.summary.currency} (Bs. {importedEnvelope.summary.bcvRate})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Fecha de Exportación:</span>
                    <strong>{new Date(importedEnvelope.exportedAt).toLocaleDateString('es-VE')}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Input de Contraseña para Descifrar */}
            {importedEnvelope && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Contraseña de Seguridad para Descifrar:
                </label>
                <div className="relative">
                  <input
                    type={showImportPassword ? 'text' : 'password'}
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="Ingresa la contraseña con la que fue cifrado..."
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImportPassword(!showImportPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {importedEnvelope && (
              <button
                type="submit"
                disabled={isDecrypting || !importPassword}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isDecrypting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>Descifrando y Verificando Integridad...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-emerald-200" />
                    <span>Descifrar y Restaurar Estado de Conciliación</span>
                  </>
                )}
              </button>
            )}

          </form>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Cifrado nativo Web Crypto API ejecutado 100% en tu navegador.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
