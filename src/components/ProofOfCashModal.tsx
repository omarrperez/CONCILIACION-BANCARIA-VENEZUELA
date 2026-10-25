import React, { useState } from 'react';
import { X, Printer, CheckCircle2, AlertTriangle, FileSpreadsheet, Check } from 'lucide-react';
import { ProofOfCash, CurrencyType, BankTransaction, UserCompanyProfile } from '../types/accounting';
import { exportToReconciliationProofExcel } from '../services/exportService';

interface ProofOfCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  proof: ProofOfCash;
  currency: CurrencyType;
  bcvRate: number;
  company?: UserCompanyProfile;
  transactions?: BankTransaction[];
}

export const ProofOfCashModal: React.FC<ProofOfCashModalProps> = ({
  isOpen,
  onClose,
  proof,
  currency,
  bcvRate,
  company,
  transactions = []
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  if (!isOpen) return null;

  const sym = currency === 'VES' ? 'Bs.' : '$';

  const handleDownloadExcel = () => {
    exportToReconciliationProofExcel({
      proof,
      company: company || { companyName: 'EMPRESA CONTRIBUYENTE C.A.', companyRif: 'J-00000000-0', bcvRate, isSpecialTaxpayer: true } as any,
      transactions,
      currency
    });
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200">
                Norma Ven-NIF
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Cédula de Conciliación Bancaria y Prueba de Efectivo (4 Columnas)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Periodo: {proof.period} | Moneda: {currency} (Tasa BCV: Bs. {bcvRate.toFixed(2)})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="Descargar Portada Oficial y Formato de Cuadre en Excel (.xlsx)"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>¡Descargado!</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Descargar Cuadre Excel (.xlsx)</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Ecuación Fundamental Card */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-emerald-950">
            <span className="font-bold uppercase tracking-wider text-[11px] block text-emerald-800 mb-1">
              Ecuación de Conciliación Oficial (Libro - Banco)
            </span>
            <p className="font-mono text-emerald-900 font-semibold text-xs sm:text-sm">
              S_libros = S_banco + Depósitos_Tránsito - Cheques_Transferencias_Pendientes + Notas_Crédito - Notas_Débito
            </p>
            <p className="mt-1 text-emerald-700 text-[11px]">
              El método de cuatro columnas garantiza la doble verificación tanto de saldos de apertura y cierre como del flujo bruto de débitos y créditos del periodo fiscal.
            </p>
          </div>

          {/* Tabla de 4 Columnas */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Concepto / Mayor Auxiliar</th>
                  <th className="py-2.5 px-3 text-right">Saldo Inicial</th>
                  <th className="py-2.5 px-3 text-right text-emerald-700">Ingresos (+)</th>
                  <th className="py-2.5 px-3 text-right text-rose-700">Egresos (-)</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900">Saldo Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* Fila Banco */}
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                    1. Estado de Cuenta Bancario (Extracto)
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {sym} {proof.initialBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                    +{proof.inflowsBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-700 font-semibold">
                    -{proof.outflowsBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {sym} {proof.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Fila Libros */}
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                    2. Mayor General de Bancos (Libros Internos)
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {sym} {proof.initialBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                    +{proof.inflowsLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-700 font-semibold">
                    -{proof.outflowsLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {sym} {proof.finalBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Desglose de Partidas de Conciliación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Ajustes al Banco */}
            <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/50">
              <h4 className="text-xs font-bold text-sky-950 uppercase mb-2">
                Partidas en Tránsito (Ajustes al Banco)
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>(+) Depósitos en Tránsito (Caja/Cobranzas):</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    +{sym} {proof.depositsInTransit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>(-) Cheques / Transferencias Pendientes:</span>
                  <span className="font-mono font-semibold text-rose-700">
                    -{sym} {proof.outstandingChecks.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-sky-200/80 flex justify-between font-bold text-sky-950">
                  <span>Saldo Banco Conciliado:</span>
                  <span className="font-mono text-sm">
                    {sym} {proof.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Ajustes a Libros */}
            <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50">
              <h4 className="text-xs font-bold text-purple-950 uppercase mb-2">
                Operaciones No Registradas (Ajustes a Libros)
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>(+) Notas de Crédito (Abonos no asentados):</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    +{sym} {proof.unrecordedCredits.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>(-) Notas de Débito (Comisiones / IGTF / SENIAT):</span>
                  <span className="font-mono font-semibold text-rose-700">
                    -{sym} {proof.unrecordedDebits.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-purple-200/80 flex justify-between font-bold text-purple-950">
                  <span>Saldo Libros Conciliado:</span>
                  <span className="font-mono text-sm">
                    {sym} {proof.reconciledLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Resultado de Equilibrio */}
          <div className={`p-4 rounded-xl flex items-center justify-between border ${
            proof.isBalanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-3">
              {proof.isBalanced ? (
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="font-bold text-sm block">
                  {proof.isBalanced ? 'Conciliación Bancaria Exacta y Auditada' : 'Discrepancia Temporal por Asentar'}
                </span>
                <span className="text-xs opacity-80">
                  {proof.isBalanced
                    ? 'Cumple formalmente con la prueba de caja y balances según principios contables Ven-NIF.'
                    : `Existe una variación neta de ${sym} ${Math.abs(proof.difference).toFixed(2)} pendiente de reclamo o ajuste.`}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase tracking-wider opacity-75 font-semibold block">Diferencia Neta</span>
              <span className="font-mono text-lg font-bold">
                {sym} {proof.difference.toFixed(2)}
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <span className="text-[11px] text-slate-500">
            Documento de trabajo para auditoría externa y fiscalización SENIAT.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="Descargar Portada Oficial y Cédula de Cuadre en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>{downloadSuccess ? '¡Excel Descargado!' : 'Descargar Cuadre Excel (.xlsx)'}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Cédula
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
