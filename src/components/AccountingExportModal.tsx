import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  Check,
  Building,
  Layers,
  ArrowRight,
  ArrowLeft,
  FileText,
  LogOut,
  Sparkles
} from 'lucide-react';
import { BankTransaction, JournalEntry, ProofOfCash, UserCompanyProfile } from '../types/accounting';
import {
  exportToSgtContableExcel,
  exportToSgtContableBatch,
  exportToProfitPlus,
  exportToGalac,
  exportToSaint,
  exportToValery,
  exportToCsvVenNif,
  exportSeniatWithholdingTxt,
  triggerFileDownload,
  exportToOfficialBankLedgerExcel,
  exportToReconciliationProofExcel
} from '../services/exportService';

interface AccountingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: UserCompanyProfile;
  transactions: BankTransaction[];
  journalEntries: JournalEntry[];
  proofOfCash?: ProofOfCash;
}

export const AccountingExportModal: React.FC<AccountingExportModalProps> = ({
  isOpen,
  onClose,
  company,
  transactions,
  journalEntries,
  proofOfCash
}) => {
  const [selectedFormat, setSelectedFormat] = useState<
    'RECONCILIATION_PROOF_EXCEL' | 'BANK_LEDGER_3SHEETS' | 'SGT_EXCEL' | 'SGT_BATCH' | 'PROFIT' | 'GALAC' | 'SAINT' | 'VALERY' | 'CSV' | 'SENIAT_TXT'
  >('RECONCILIATION_PROOF_EXCEL');

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const triggerDownloadForFormat = (formatId: typeof selectedFormat) => {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let content = '';
    let filename = '';

    switch (formatId) {
      case 'RECONCILIATION_PROOF_EXCEL': {
        const fallbackProof: ProofOfCash = proofOfCash || {
          period: `${new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}`,
          bankCode: '0102',
          currency: 'VES',
          initialBalanceBank: 0,
          inflowsBank: 0,
          outflowsBank: 0,
          finalBalanceBank: 0,
          initialBalanceLedger: 0,
          inflowsLedger: 0,
          outflowsLedger: 0,
          finalBalanceLedger: 0,
          depositsInTransit: 0,
          outstandingChecks: 0,
          unrecordedCredits: 0,
          unrecordedDebits: 0,
          reconciledBank: 0,
          reconciledLedger: 0,
          difference: 0,
          isBalanced: true
        };
        exportToReconciliationProofExcel({
          proof: fallbackProof,
          company,
          transactions,
          currency: 'VES'
        });
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
        return;
      }

      case 'BANK_LEDGER_3SHEETS': {
        // Detect current bank code from transactions or default to 0102
        const firstBankTx = transactions.find(t => t.source === 'BANK' && t.bankCode);
        const bankCode = firstBankTx?.bankCode || '0102';
        exportToOfficialBankLedgerExcel(transactions, bankCode, company, 'VES');
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
        return;
      }

      case 'SGT_EXCEL':
        exportToSgtContableExcel(journalEntries, company);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
        return;

      case 'SGT_BATCH':
        content = exportToSgtContableBatch(journalEntries);
        filename = `SGT_CONTABLE_COMPROBANTES_${timestamp}.csv`;
        break;

      case 'PROFIT':
        content = exportToProfitPlus(journalEntries);
        filename = `NOMINUS_ASIENTOS_PROFIT_${timestamp}.txt`;
        break;

      case 'GALAC':
        content = exportToGalac(journalEntries);
        filename = `NOMINUS_COMPROBANTES_GALAC_${timestamp}.csv`;
        break;

      case 'SAINT':
        content = exportToSaint(journalEntries);
        filename = `NOMINUS_INTERFASE_SAINT_${timestamp}.txt`;
        break;

      case 'VALERY':
        content = exportToValery(journalEntries);
        filename = `NOMINUS_ASIENTOS_VALERY_${timestamp}.csv`;
        break;

      case 'CSV':
        content = exportToCsvVenNif(journalEntries);
        filename = `NOMINUS_MAYOR_VEN_NIF_${timestamp}.csv`;
        break;

      case 'SENIAT_TXT':
        content = exportSeniatWithholdingTxt(company.companyRif, transactions);
        filename = `RETENCIONES_IVA_SENIAT_${company.companyRif.replace(/[^A-Za-z0-9]/g, '')}_${timestamp}.txt`;
        break;
    }

    triggerFileDownload(content, filename);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleDownload = () => {
    triggerDownloadForFormat(selectedFormat);
  };

  const formats = [
    {
      id: 'RECONCILIATION_PROOF_EXCEL' as const,
      title: '📗 Cédula de Cuadre y Portada de Conciliación (Excel .XLSX)',
      desc: 'Formato oficial de demostración de cuadre a Bs. 0,00 bajo Ven-NIF: Portada ejecutiva con dictamen de auditoría y firmas, demostración formal de la ecuación de conciliación, estado de prueba de efectivo de 4 columnas y detalle analítico de partidas en tránsito.',
      ext: '.XLSX',
      recommended: true,
      color: 'emerald'
    },
    {
      id: 'BANK_LEDGER_3SHEETS' as const,
      title: 'Libro de Bancos Oficial (Excel 3 Hojas - Formato -1.234,10 / 1.234,10)',
      desc: 'Formato reglamentario de 5 columnas en 3 Hojas con formato numérico venezolano estricto (-1.234,10 y 1.234,10): Hoja 1 (Entrada Contable), Hoja 2 (Ingresos NC contra Cuentas por Cobrar 1.1.2.1.10 = 0,00), Hoja 3 (Egresos ND con partida doble = 0,00).',
      ext: '.XLSX',
      recommended: false,
      color: 'cyan'
    },
    {
      id: 'SGT_EXCEL' as const,
      title: 'SGT Contable (Excel Profesional .XLSX)',
      desc: 'Formato ejecutivo en Excel de 3 hojas con fecha XX-XX-XXXX y formato numérico venezolano (-1.234,10 y 1.234,10): Libro Diario con códigos exactos SGT, Mayor Analítico acumulado y Plan de Cuentas Maestro SGT.',
      ext: '.XLSX',
      recommended: false,
      color: 'emerald'
    },
    {
      id: 'CSV' as const,
      title: 'Excel / CSV Oficial Ven-NIF',
      desc: 'Tabla completa compatible con Excel y Calc con códigos de cuenta Ven-NIF, Debe, Haber y notas de auditoría.',
      ext: '.CSV',
      recommended: false,
      color: 'blue'
    },
    {
      id: 'PROFIT' as const,
      title: 'Profit Plus Contabilidad (2K8 / 2K12 / ERP)',
      desc: 'Genera el archivo tabular para importación directa de asientos contables en Profit Plus.',
      ext: '.TXT',
      recommended: false,
      color: 'indigo'
    },
    {
      id: 'GALAC' as const,
      title: 'Gálac Software Contabilidad',
      desc: 'Formato estándar de comprobantes con encabezado, Debe, Haber y RIF de contraparte para importar a Gálac.',
      ext: '.CSV',
      recommended: false,
      color: 'amber'
    },
    {
      id: 'SAINT' as const,
      title: 'Saint Enterprise Contabilidad',
      desc: 'Estructura por lotes para el módulo de integración contable de Saint.',
      ext: '.TXT',
      recommended: false,
      color: 'cyan'
    },
    {
      id: 'VALERY' as const,
      title: 'Valery Software Administrativo',
      desc: 'Interfaz para carga de asientos en la contabilidad general de Valery Software.',
      ext: '.CSV',
      recommended: false,
      color: 'teal'
    },
    {
      id: 'SGT_BATCH' as const,
      title: 'SGT Contable (Lote CSV / TXT para Carga Rápida)',
      desc: 'Estructura por registros delimitados para importación directa en el sistema SGT Contable.',
      ext: '.CSV',
      recommended: false,
      color: 'slate'
    },
    {
      id: 'SENIAT_TXT' as const,
      title: 'Archivo TXT para Portal Fiscal SENIAT',
      desc: 'Formato reglamentario de 16 columnas para carga masiva de Retenciones de IVA (SPE).',
      ext: '.TXT',
      recommended: false,
      color: 'rose'
    }
  ];

  const selectedFormatObj = formats.find(f => f.id === selectedFormat);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header - Fixed & Always Visible */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>Exportar Asientos y Conciliación (ERP / Excel)</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Selecciona tu sistema contable o descarga en Excel (.XLSX / .CSV)
              </p>
            </div>
          </div>

          {/* Top Exit Buttons: Very prominent */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer border border-slate-300"
              title="Cerrar y volver al programa"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver / Salir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Formats List - Fits on small laptops */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <p className="text-xs text-sky-950 leading-relaxed">
              Haz clic en cualquier formato para seleccionarlo y luego presiona <strong>"Descargar Archivo"</strong> en la parte inferior, o pulsa el botón directo <strong>"Descargar"</strong> al lado de cada opción.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {formats.map((fmt) => {
              const isSelected = selectedFormat === fmt.id;
              return (
                <div
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/90 ring-2 ring-sky-300 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{fmt.title}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {fmt.ext}
                        </span>
                        {fmt.recommended && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{fmt.desc}</p>
                    </div>
                  </div>

                  {/* Direct Download Button right on the card */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFormat(fmt.id);
                        triggerDownloadForFormat(fmt.id);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'bg-sky-600 hover:bg-sky-700 text-white'
                          : 'bg-white hover:bg-sky-50 text-sky-700 border border-slate-200 hover:border-sky-300'
                      }`}
                      title={`Descargar ${fmt.title}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Descargar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer - Fixed, Sticky & Always Visible on Laptop Screens */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Main Return / Exit Button */}
          <button
            onClick={onClose}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-300 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
            <span>← Salir y Volver al Programa</span>
          </button>

          {/* Right Action: Download Selected */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3">
            <span className="text-[11px] text-slate-500 font-medium">
              {journalEntries.length} comprobantes listos
            </span>

            <button
              onClick={handleDownload}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadSuccess
                  ? '¡Archivo Descargado!'
                  : `Descargar ${selectedFormatObj?.ext || 'Archivo'}`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
