import React, { useState } from 'react';
import {
  ReceiptText,
  FileCheck2,
  AlertTriangle,
  Download,
  Check,
  Calculator,
  ShieldAlert,
  Percent,
  Calendar,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { BankTransaction, CurrencyType, UserCompanyProfile } from '../types/accounting';
import {
  calculateVatWithholding,
  calculateIslrWithholding,
  calculatePensionContribution,
  SENIAT_ART3_EXCLUSIONS,
  generateVatVoucherNumber
} from '../services/taxEngine';
import { exportSeniatWithholdingTxt, triggerFileDownload } from '../services/exportService';

interface SeniatTaxModuleProps {
  company: UserCompanyProfile;
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
}

export const SeniatTaxModule: React.FC<SeniatTaxModuleProps> = ({
  company,
  transactions,
  currency,
  bcvRate
}) => {
  // Interactive VAT Withholding Calculator (Limpio para datos reales)
  const [invoiceTotal, setInvoiceTotal] = useState<number>(0);
  const [isVatDiscriminated, setIsVatDiscriminated] = useState<boolean>(true);
  const [isRifCompliant, setIsRifCompliant] = useState<boolean>(true);
  const [meetsFormalReqs, setMeetsFormalReqs] = useState<boolean>(true);
  const [has100PercentFlag, setHas100PercentFlag] = useState<boolean>(false);
  const [selectedExclusion, setSelectedExclusion] = useState<string>('');

  // ISLR Calculator
  const [islrBase, setIslrBase] = useState<number>(0);
  const [islrConcept, setIslrConcept] = useState<'SERVICIOS_GENERALES' | 'HONORARIOS_PROF' | 'ARRENDAMIENTOS' | 'FLETES'>('SERVICIOS_GENERALES');

  // Pension Law 2024
  const [payrollAmount, setPayrollAmount] = useState<number>(0);

  // Compute live VAT
  const vatResult = calculateVatWithholding({
    invoiceTotal,
    isVatDiscriminated,
    vatRatePercent: 16,
    isRifCompliant,
    meetsFormalReqs,
    has100PercentFlag,
    exclusionId: selectedExclusion || undefined
  });

  const islrResult = calculateIslrWithholding(islrBase, islrConcept);
  const pensionResult = calculatePensionContribution(payrollAmount, 9);

  // Export TXT for SENIAT portal
  const handleDownloadSeniatTxt = () => {
    const txtContent = exportSeniatWithholdingTxt(company.companyRif, transactions);
    triggerFileDownload(txtContent, `RETENCIONES_IVA_SENIAT_${company.companyRif.replace(/[^A-Za-z0-9]/g, '')}_202610.txt`);
  };

  const sym = currency === 'VES' ? 'Bs.' : '$';

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-white p-5 rounded-2xl border border-teal-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shadow-xs">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Escudo Fiscal SENIAT & Motor de Retenciones
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Providencia SNAT/2025/000054
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Decreto 1808 (ISLR)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Cálculo del 75% o 100% de retención de IVA para Sujetos Pasivos Especiales (SPE), fórmula de descomposición para facturas no discriminadas, y comprobantes oficiales de 14 dígitos.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadSeniatTxt}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar TXT para Portal SENIAT</span>
          </button>
        </div>
      </div>

      {/* Grid: 3 Calculators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 1. CALCULADOR PROVIDENCIA SNAT/2025/000054 */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Simulador Oficial de Retención de IVA (SPE)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-semibold">
              Comp: {vatResult.voucherNumber}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Form Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Monto Total Facturado con IVA ({sym}):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceTotal}
                  onChange={(e) => setInvoiceTotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Toggles for 100% or Exclusions */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Condiciones de la Operación y Proveedor:
                </span>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVatDiscriminated}
                    onChange={(e) => setIsVatDiscriminated(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>¿El IVA está claramente discriminado en la factura?</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={meetsFormalReqs}
                    onChange={(e) => setMeetsFormalReqs(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>¿Cumple formalmente con la Providencia 0071 del SENIAT?</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRifCompliant}
                    onChange={(e) => setIsRifCompliant(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>¿Proveedor inscrito y activo en el Portal Fiscal (RIF)?</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={has100PercentFlag}
                    onChange={(e) => setHas100PercentFlag(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-amber-800">¿Portal SENIAT indica retención del 100% para este RIF?</span>
                </label>
              </div>

              {/* Art 3 Exclusions Dropdown */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Exclusiones Legales (Art. 3 Prov. 2025/000054):
                </label>
                <select
                  value={selectedExclusion}
                  onChange={(e) => setSelectedExclusion(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-[11px] focus:outline-none"
                >
                  <option value="">-- Sin exclusión (Aplica Retención Ordinaria) --</option>
                  {SENIAT_ART3_EXCLUSIONS.map(excl => (
                    <option key={excl.id} value={excl.id}>{excl.id} - {excl.text.slice(0, 60)}...</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Live Calculation Output Card */}
            <div className="bg-teal-50/40 p-4 rounded-xl border border-teal-200/80 flex flex-col justify-between text-xs space-y-2">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-teal-200/60">
                  <span className="font-bold text-teal-950">Porcentaje de Retención:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    vatResult.isExemptByArt3
                      ? 'bg-slate-200 text-slate-800'
                      : vatResult.retentionPercentage === 100
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                  }`}>
                    {vatResult.isExemptByArt3 ? '0% (Excluido Art. 3)' : `${vatResult.retentionPercentage}% Retención`}
                  </span>
                </div>

                {vatResult.isDecomposed && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                    <span className="font-bold">⚠️ IVA Descompuesto por Fórmula:</span>
                    <p className="font-mono text-[10px] mt-0.5">B.I. = Total / ((16/100) + 1)</p>
                  </div>
                )}

                <div className="space-y-1.5 mt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Imponible Calculada:</span>
                    <span className="font-mono font-semibold text-slate-900">{sym} {vatResult.taxableBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA Causado (16%):</span>
                    <span className="font-mono font-semibold text-slate-900">{sym} {vatResult.vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-teal-800 font-bold pt-1 border-t border-teal-100">
                    <span>Monto de IVA a Retener:</span>
                    <span className="font-mono text-sm">{sym} {vatResult.retentionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-bold">
                    <span>Neto a Pagar al Proveedor:</span>
                    <span className="font-mono text-sm text-slate-900">{sym} {vatResult.netPayableToSupplier.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-teal-100 text-[11px] text-slate-500 font-mono">
                Comprobante N°: <strong className="text-teal-900">{vatResult.voucherNumber}</strong>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Estructura obligatoria de 14 dígitos (AAAAMMSSSSSSSS).
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* 2. ISLR Y LEY DE PENSIONES */}
        <div className="space-y-4">
          
          {/* ISLR Decreto 1808 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Retención de ISLR (Decreto 1808)</span>
            </h4>
            
            <div>
              <label className="text-slate-600 block mb-1">Base Imponible ({sym}):</label>
              <input
                type="number"
                value={islrBase}
                onChange={(e) => setIslrBase(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Concepto:</label>
              <select
                value={islrConcept}
                onChange={(e) => setIslrConcept(e.target.value as any)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50"
              >
                <option value="SERVICIOS_GENERALES">Servicios Generales (2%)</option>
                <option value="HONORARIOS_PROF">Honorarios Profesionales (5%)</option>
                <option value="ARRENDAMIENTOS">Arrendamiento Inmuebles (5%)</option>
                <option value="FLETES">Transporte y Fletes (3%)</option>
              </select>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between items-center font-bold">
              <span className="text-slate-700">Monto ISLR a Retener:</span>
              <span className="font-mono text-sm text-rose-700">{sym} {islrResult.amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Ley de Pensiones 2024 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Ley 2024</span>
              <h4 className="font-bold text-slate-900 uppercase tracking-wide">
                Protección de Pensiones
              </h4>
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Nómina Bruta Mensual ({sym}):</label>
              <input
                type="number"
                value={payrollAmount}
                onChange={(e) => setPayrollAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex justify-between items-center font-bold">
              <div>
                <span className="text-amber-950 block">Contribución Patronal (9%):</span>
                <span className="text-[10px] text-amber-800 font-normal">Cta: 6.1.01.02.001</span>
              </div>
              <span className="font-mono text-sm text-amber-900">{sym} {pensionResult.contributionAmount.toFixed(2)}</span>
            </div>
          </div>

        </div>

      </div>

      {/* Calendario Quincenal de Sujetos Pasivos Especiales */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Ciclo Quincenal de Deberes Formales (SENIAT SPE)
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">Primera Quincena (Días 1 al 15)</span>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Declaración y enteramiento de retenciones de IVA efectuadas en la primera mitad del mes. Generación de Planilla 99035.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">Segunda Quincena (Día 16 al Último del Mes)</span>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Declaración y enteramiento de retenciones de la segunda mitad del mes + Declaración mensual de IVA Formulario 00030.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
