import React, { useState } from 'react';
import {
  ScrollText,
  Printer,
  Download,
  Copy,
  Check,
  FileCheck,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { UserCompanyProfile, CurrencyType } from '../types/accounting';

interface LegalContractsVaultProps {
  company: UserCompanyProfile;
  currency: CurrencyType;
  bcvRate: number;
}

export const LegalContractsVault: React.FC<LegalContractsVaultProps> = ({
  company,
  currency,
  bcvRate
}) => {
  const [activeContract, setActiveContract] = useState<'MUTUO' | 'COMISION'>('MUTUO');
  
  // Mutuo Contract fields (Inicializados en blanco para datos reales)
  const [partnerName, setPartnerName] = useState('');
  const [partnerCi, setPartnerCi] = useState('');
  const [partnerRif, setPartnerRif] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanCurrency, setLoanCurrency] = useState<'USD' | 'VES'>('USD');
  const [bankOrigin, setBankOrigin] = useState('');
  const [accountOrigin, setAccountOrigin] = useState('');
  const [bankDest, setBankDest] = useState('');
  const [accountDest, setAccountDest] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [loanTermMonths, setLoanTermMonths] = useState('12');
  const [interestRate, setInterestRate] = useState('0'); // 0% under Art 1.737 CC

  // Comisión Mercantil fields
  const [commissionerName, setCommissionerName] = useState('');
  const [commissionerRif, setCommissionerRif] = useState('');
  const [commissionerRep, setCommissionerRep] = useState('');
  const [commissionRate, setCommissionRate] = useState('2.5');

  const [copied, setCopied] = useState(false);

  // Formatters with clean placeholders for blank contracts
  const pName = partnerName || '[NOMBRE DEL ACCIONISTA / MUTUANTE]';
  const pCi = partnerCi || '[V-00.000.000]';
  const pRif = partnerRif || '[V-00000000-0]';
  const lAmount = loanAmount ? Number(loanAmount).toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '[MONTO]';
  const bOrig = bankOrigin || '[BANCO ORIGEN]';
  const aOrig = accountOrigin || '[NÚMERO DE CUENTA ORIGEN]';
  const bDest = bankDest || '[BANCO DESTINO]';
  const aDest = accountDest || '[NÚMERO DE CUENTA DESTINO]';
  const rNum = refNumber || '[N° REFERENCIA BANCARIA]';
  const cName = commissionerName || '[RAZÓN SOCIAL COMISIONISTA]';
  const cRif = commissionerRif || '[J-00000000-0]';
  const cRep = commissionerRep || '[REPRESENTANTE LEGAL]';
  const compName = company.companyName || '[EMPRESA / RAZÓN SOCIAL]';
  const compRif = company.companyRif || '[RIF EMPRESA]';
  const compAddr = company.address || '[DOMICILIO FISCAL]';

  // Generate Contrato de Mutuo
  const mutuoText = `CONTRATO DE MUTUO DE DINERO CON INTERÉS Y RECONOCIMIENTO DE DEUDA

Entre la sociedad mercantil ${compName}, domicilio fiscal en ${compAddr}, inscrita ante el Registro Mercantil Primero de la Circunscripción Judicial del Distrito Capital y Estado Miranda, bajo el RIF N° ${compRif}, representada en este acto por su Director Ejecutivo, en lo sucesivo denominada "LA MUTUATARIA"; y por la otra parte el ciudadano ${pName}, titular de la Cédula de Identidad N° ${pCi}, actuando en su propio nombre y derecho en su condición de accionista, bajo el RIF N° ${pRif}, en lo sucesivo denominado "EL MUTUANTE"; se ha convenido en celebrar el presente Contrato de Mutuo de Dinero, el cual se regirá por las cláusulas siguientes y supletoriamente por el Código Civil de la República Bolivariana de Venezuela:

PRIMERA: OBJETO Y MONTO DEL PRÉSTAMO.
EL MUTUANTE entrega en calidad de préstamo de dinero (mutuo) a LA MUTUATARIA la cantidad de ${lAmount} ${loanCurrency === 'USD' ? 'DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD)' : 'BOLÍVARES (Bs.)'}. Dicha suma es transferida desde la cuenta bancaria de EL MUTUANTE N° ${aOrig} ubicada en el Banco ${bOrig} hacia la cuenta bancaria de LA MUTUATARIA N° ${aDest} ubicada en el Banco ${bDest}, bajo el N° de Referencia Bancaria ${rNum} en fecha ${new Date().toLocaleDateString('es-VE')}.

SEGUNDA: ORIGEN DE LOS FONDOS (DECLARACIÓN SUDEBAN RES. 010.25).
EL MUTUANTE declara bajo fe de juramento que los fondos entregados provienen de actividades de lícito comercio, en estricto cumplimiento con la Resolución SUDEBAN N° 010.25 relativa a la Administración de Riesgos de Legitimación de Capitales, Financiamiento al Terrorismo y Proliferación de Armas de Destrucción Masiva.

TERCERA: DESTINO DE LOS FONDOS.
LA MUTUATARIA destinará la totalidad de la suma mutuada a atender necesidades operativas, pago de proveedores o capital de trabajo de la entidad mercantil.

CUARTA: PLAZO, FORMA DE DEVOLUCIÓN E INTERESES.
LA MUTUATARIA se compromete a restituir el capital prestado en un plazo máximo de ${loanTermMonths || '12'} meses contados a partir de la firma de este instrumento. La devolución podrá realizarse mediante cuotas parciales o una cancelación única a través de transferencia bancaria. ${
    Number(interestRate) > 0
      ? `La presente obligación devengará una tasa de interés del ${interestRate}% anual sobre saldos deudores.`
      : 'Se pacta formalmente como préstamo sin intereses conforme al Artículo 1.737 del Código Civil.'
  }

QUINTA: DOCUMENTACIÓN DE SOPORTE Y CONCILIACIÓN FISCAL (SENIAT).
Ambas partes acuerdan que el comprobante de conciliación bancaria emitido por el sistema NOMINUS CONCILIACIONES, junto con la certificación contable bajo normas Ven-NIF, constituirán prueba fehaciente de la entrega y posterior restitución de los fondos a los efectos de desvirtuar presunciones de dividendos o ingresos gravables no declarados ante el SENIAT.

En fe de conformidad, se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en Caracas, a los ${new Date().getDate()} días del mes de ${new Date().toLocaleString('es-VE', { month: 'long' })} del año ${new Date().getFullYear()}.

___________________________                         ___________________________
       EL MUTUANTE                                         LA MUTUATARIA
    ${pName}                                 ${compName}
  C.I. ${pCi}                                   RIF: ${compRif}`;

  // Generate Contrato de Comisión Mercantil
  const comisionText = `CONTRATO DE COMISIÓN MERCANTIL Y MANDATO DE GESTIÓN DE PAGOS Y DIVISAS

Conste por el presente documento el Contrato de Comisión Mercantil que celebran, de una parte, la sociedad mercantil ${compName}, RIF N° ${compRif}, debidamente representada en este acto, en adelante denominada "EL COMITENTE"; y de la otra parte, la sociedad mercantil ${cName}, RIF N° ${cRif}, representada por ${cRep}, en adelante denominada "EL COMISIONISTA"; conforme a las siguientes cláusulas reguladas por el Código de Comercio de la República Bolivariana de Venezuela:

PRIMERA: OBJETO DEL MANDATO.
EL COMITENTE encarga a EL COMISIONISTA, quien acepta, la realización por su cuenta y orden de las gestiones comerciales de cobro, recepción de fondos y ejecución de pagos a proveedores locales e internacionales en moneda nacional (Bs.) o extranjera (USD) en apego al Convenio Cambiario N° 1 del BCV.

SEGUNDA: RENDICIÓN DE CUENTAS Y NO AFECTACIÓN PATRIMONIAL.
Todos los fondos recibidos por EL COMISIONISTA en virtud de este contrato pertenecen exclusivamente a EL COMITENTE. EL COMISIONISTA se obliga a rendir cuenta detallada de cada operación dentro de los cinco (5) días hábiles siguientes a su ejecución. Los fondos manejados bajo esta comisión mercantil no constituyen ingreso propio de EL COMISIONISTA a los efectos del Impuesto Sobre la Renta (ISLR) ni Impuesto al Valor Agregado (IVA).

TERCERA: COMISIÓN MERCANTIL.
Como retribución por la gestión encomendada, EL COMITENTE pagará a EL COMISIONISTA una comisión equivalente al ${commissionRate || '0'}% sobre el valor de las operaciones procesadas, previa emisión de la factura fiscal correspondiente por parte de EL COMISIONISTA con sus respectivas retenciones de ley.

CUARTA: REGISTRO Y SOPORTE DIGITAL NOMINUS.
Las partes acuerdan asociar cada transferencia bancaria y recibo de cobro dentro del sistema NOMINUS CONCILIACIONES, adjuntando la orden de comisión y el comprobante de liquidación con huella SHA-256 como soporte definitivo frente a la administración tributaria (SENIAT) y las instituciones bancarias reguladas por SUDEBAN.

Firman las partes en señal de aceptación en Caracas, a los ${new Date().getDate()} días del mes de ${new Date().toLocaleString('es-VE', { month: 'long' })} del año ${new Date().getFullYear()}.

___________________________                         ___________________________
       EL COMITENTE                                        EL COMISIONISTA
  ${compName}                             ${cName}
  RIF: ${compRif}                          RIF: ${cRif}`;

  const currentContractText = activeContract === 'MUTUO' ? mutuoText : comisionText;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContractText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-yellow-50/90 via-amber-50/40 to-white p-5 rounded-2xl border border-yellow-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center shadow-xs">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Bóveda Legal & Generador de Contratos Ejecutables
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                Código Civil 1.737 & Código de Comercio
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Instrumentos jurídicos indispensables para justificar inyecciones de accionistas, retiros, y gestión de divisas ante inspecciones de SENIAT y SUDEBAN, desvirtuando presunciones fiscales.
            </p>
          </div>
        </div>
      </div>

      {/* Contract Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveContract('MUTUO')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeContract === 'MUTUO'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          1. Contrato de Mutuo de Dinero (Préstamo Accionista / Directivo)
        </button>
        <button
          onClick={() => setActiveContract('COMISION')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeContract === 'COMISION'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          2. Contrato de Comisión Mercantil (Mandato de Pagos y Divisas)
        </button>
      </div>

      {/* Contract Form & Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: Interactive Field Customization */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
            Parámetros del Instrumento Jurídico
          </h3>

          {activeContract === 'MUTUO' ? (
            <div className="space-y-2.5">
              <div>
                <label className="text-slate-600 block mb-0.5 font-semibold">Nombre del Accionista / Prestamista:</label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">Cédula:</label>
                  <input
                    type="text"
                    value={partnerCi}
                    onChange={(e) => setPartnerCi(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">RIF Personal:</label>
                  <input
                    type="text"
                    value={partnerRif}
                    onChange={(e) => setPartnerRif(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">Monto del Préstamo:</label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">Moneda:</label>
                  <select
                    value={loanCurrency}
                    onChange={(e) => setLoanCurrency(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">Bolívares (Bs.)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-0.5 font-semibold">N° Referencia Bancaria Conciliada:</label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">Plazo (Meses):</label>
                  <input
                    type="number"
                    value={loanTermMonths}
                    onChange={(e) => setLoanTermMonths(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">Interés Anual (%):</label>
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="text-slate-600 block mb-0.5 font-semibold">Razón Social del Comisionista:</label>
                <input
                  type="text"
                  value={commissionerName}
                  onChange={(e) => setCommissionerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">RIF Comisionista:</label>
                  <input
                    type="text"
                    value={commissionerRif}
                    onChange={(e) => setCommissionerRif(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-0.5 font-semibold">Comisión (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-600 block mb-0.5 font-semibold">Representante Legal Comisionista:</label>
                <input
                  type="text"
                  value={commissionerRep}
                  onChange={(e) => setCommissionerRep(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
            <span className="font-bold">Norma de Blindaje Fiscal:</span>
            <p className="mt-0.5">
              De acuerdo con la jurisprudencia tributaria del SENIAT, todo movimiento entre socios y la empresa sin contrato notariado o debidamente protocolizado puede ser considerado "dividendo presunto" o "ingreso no declarado".
            </p>
          </div>
        </div>

        {/* Right: Contract View */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Vista del Documento Legal Redactado
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / Guardar PDF</span>
              </button>
            </div>
          </div>

          <div className="p-5 bg-slate-50 text-slate-800 font-serif text-xs rounded-xl border border-slate-200 overflow-y-auto max-h-[500px] whitespace-pre-wrap leading-relaxed shadow-inner">
            {currentContractText}
          </div>

        </div>

      </div>

    </div>
  );
};
