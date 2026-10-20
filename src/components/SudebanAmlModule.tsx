import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  Search,
  AlertTriangle,
  Printer,
  Download,
  Fingerprint,
  Lock,
  Building,
  CheckCircle2
} from 'lucide-react';
import { BankTransaction, CurrencyType, UserCompanyProfile } from '../types/accounting';
import { calculateSha256 } from '../services/cryptoService';

interface SudebanAmlModuleProps {
  company: UserCompanyProfile;
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
}

export const SudebanAmlModule: React.FC<SudebanAmlModuleProps> = ({
  company,
  transactions,
  currency,
  bcvRate
}) => {
  const [selectedTxId, setSelectedTxId] = useState<string>(transactions[0]?.id || '');
  const [generatedDossier, setGeneratedDossier] = useState<{
    id: string;
    hash: string;
    date: string;
    content: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // High-volume or high-amount transactions that might trigger SUDEBAN alerts (> $1,000 or > Bs. 50,000)
  const suspiciousCandidates = transactions.filter(t => {
    const valUsd = t.currency === 'USD' ? t.amountNominal : t.amountNominal / bcvRate;
    return valUsd >= 1000 || t.matchingStatus === 'UNMATCHED';
  });

  const selectedTx = transactions.find(t => t.id === selectedTxId) || transactions[0];

  const handleGenerateDossier = async () => {
    if (!selectedTx) return;
    setIsGenerating(true);

    const dossierText = `EXPEDIENTE DE CUMPLIMIENTO Y DEFENSA BANCARIA (COMPLIANCE DOSSIER)
NORMATIVA SUDEBAN: RESOLUCIÓN N° 010.25 (ADMINISTRACIÓN INTEGRAL DE RIESGOS LC/FT/FPADM)
FECHA DE EMISIÓN: ${new Date().toISOString()}

1. IDENTIFICACIÓN DE LA ENTIDAD MERCANTIL:
- Razón Social: ${company.companyName}
- R.I.F.: ${company.companyRif}
- Domicilio Fiscal: ${company.address}
- Condición Fiscal: ${company.isSpecialTaxpayer ? 'Sujeto Pasivo Especial (SPE) SENIAT' : 'Ordinario'}

2. DATOS DE LA OPERACIÓN FINANCIERA REQUERIDA:
- Institución Bancaria: ${selectedTx.bankName} (${selectedTx.bankCode})
- Número de Referencia Bancaria: ${selectedTx.referenceNum}
- Fecha Valor de la Transacción: ${selectedTx.txDate}
- Monto Nominal: ${selectedTx.currency === 'VES' ? 'Bs.' : '$'} ${selectedTx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
- Contraparte Identificada: ${selectedTx.counterpartyName || 'TERCERO DECLARADO'} (RIF: ${selectedTx.counterpartyRif || 'N/A'})
- Concepto Bancario: ${selectedTx.rawDescription}

3. ORIGEN Y DESTINO LÍCITO DE LOS FONDOS:
Declaramos bajo fe de juramento que los fondos acreditados/debitados en la cuenta provienen exclusivamente de actividades comerciales de lícito comercio conforme al marco jurídico de la República Bolivariana de Venezuela. No guardan relación con actividades ilícitas tipificadas en la Ley Orgánica Contra la Delincuencia Organizada y Financiamiento al Terrorismo (LOCDOFT).

4. IMPUTACIÓN CONTABLE VEN-NIF:
- Código de Cuenta Mayor: ${selectedTx.accountCode || '1.1.02.01.001'}
- Denominación de Cuenta: ${selectedTx.accountName || 'Operación Justificada'}
- Estatus de Conciliación: ${selectedTx.matchingStatus}

5. CADENA DE CUSTODIA Y HASH CRIPTOGRÁFICO:
El presente expediente ha sido sellado digitalmente en el sistema NOMINUS CONCILIACIONES garantizando su inmutabilidad frente a auditorías de la Superintendencia de las Instituciones del Sector Bancario (SUDEBAN) y el SENIAT.`;

    const hash = await calculateSha256(dossierText);

    setTimeout(() => {
      setGeneratedDossier({
        id: `DOSSIER-${Date.now()}`,
        hash,
        date: new Date().toLocaleDateString('es-VE'),
        content: dossierText
      });
      setIsGenerating(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-rose-50/90 via-red-50/40 to-white p-5 rounded-2xl border border-rose-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Prevención SUDEBAN (Resolución N° 010.25) & Compliance Dossier
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                Enfoque Basado en Riesgo (EBR)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Supervisión de transacciones de alto volumen, préstamos societarios y movimientos en divisas. Genera en segundos el Expediente de Soporte para responder a solicitudes de la Unidad de Prevención del banco ante bloqueos preventivos.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Monitoreo & Generador de Expediente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: Lista de Partidas Relevantes SUDEBAN */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              Operaciones Sujetas a Monitoreo ({suspiciousCandidates.length})
            </h3>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
              Umbral EBR Activo
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto space-y-2 p-1">
            {suspiciousCandidates.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                <ShieldCheck className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                <p className="font-semibold text-slate-700">Sin operaciones con alerta de riesgo</p>
                <p className="text-[11px] text-slate-400">
                  Las transacciones cargadas se encuentran limpias y dentro de los parámetros ordinarios SUDEBAN Res. 010.25.
                </p>
              </div>
            ) : (
              suspiciousCandidates.map(tx => {
              const isSelected = selectedTxId === tx.id;
              const valUsd = tx.currency === 'USD' ? tx.amountNominal : tx.amountNominal / bcvRate;

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTxId(tx.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                    isSelected
                      ? 'border-rose-400 bg-rose-50/60 ring-2 ring-rose-200'
                      : 'border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{tx.referenceNum}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {tx.currency === 'VES' ? 'Bs.' : '$'} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium line-clamp-1">{tx.rawDescription}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>{tx.bankName}</span>
                    <span className="font-semibold text-rose-700">≈ ${valUsd.toFixed(2)} USD</span>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Right: Generador y Visualizador del Expediente de Soporte */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Expediente de Soporte Oficial (Compliance Dossier)
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecciona la transacción y genera el documento auditable con hash SHA-256.
              </p>
            </div>

            <button
              onClick={handleGenerateDossier}
              disabled={isGenerating || !selectedTx}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{isGenerating ? 'Sellando Digitalmente...' : 'Generar Expediente SUDEBAN'}</span>
            </button>
          </div>

          {selectedTx && !generatedDossier && (
            <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">
                Transacción seleccionada: {selectedTx.referenceNum} ({selectedTx.bankName})
              </p>
              <p className="max-w-md mx-auto">
                Monto: {selectedTx.currency === 'VES' ? 'Bs.' : '$'} {selectedTx.amountNominal.toLocaleString('es-VE')} | Concepto: {selectedTx.rawDescription}
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                Haz clic en "Generar Expediente SUDEBAN" para compilar la justificación legal con huella criptográfica.
              </p>
            </div>
          )}

          {generatedDossier && (
            <div className="space-y-3">
              
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Expediente Generado Exitosamente: {generatedDossier.id}</span>
                    <span className="font-mono text-[10px] block opacity-80 break-all">
                      SHA-256: {generatedDossier.hash}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 font-bold hover:bg-emerald-100 cursor-pointer text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>

              {/* Dossier Preformatted View */}
              <div className="p-4 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[400px]">
                {generatedDossier.content}
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
