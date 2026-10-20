// SENIAT & RegTech Engine for Venezuelan Accounting
// Based on Providencia Administrativa SNAT/2025/000054, Decreto 1808 (ISLR), and Ley de Protección de Pensiones 2024

export interface VatCalculationResult {
  invoicedTotal: number;
  taxableBase: number;
  vatRate: number; // e.g. 16%
  vatAmount: number;
  retentionPercentage: 75 | 100 | 0;
  retentionAmount: number;
  netPayableToSupplier: number;
  voucherNumber: string; // 14 digits AAAAMMSSSSSSSS
  isExemptByArt3: boolean;
  exclusionReason?: string;
  isDecomposed: boolean; // Was VAT decomposed because it was not discriminated?
}

export const SENIAT_ART3_EXCLUSIONS = [
  { id: 'EXCL_01', text: 'Operaciones no sujetas al IVA, exentas o exoneradas del impuesto.' },
  { id: 'EXCL_02', text: 'Proveedores con condición formal de contribuyentes formales de IVA.' },
  { id: 'EXCL_03', text: 'Proveedores agentes de percepción de bebidas alcohólicas, fósforos o cigarrillos.' },
  { id: 'EXCL_04', text: 'Régimen de percepción anticipada de IVA en importación de bienes debidamente acreditado.' },
  { id: 'EXCL_05', text: 'Operaciones pagadas por empleados de la empresa con cargo a viáticos.' },
  { id: 'EXCL_06', text: 'Gastos reembolsables pagados por directores o administradores que no excedan 20 U.T.' },
  { id: 'EXCL_07', text: 'Compras pagadas por caja chica cuyo monto no exceda de 20 U.T.' },
  { id: 'EXCL_08', text: 'Servicios públicos (electricidad, agua, telefonía, gas) pagados por domiciliación bancaria.' },
  { id: 'EXCL_09', text: 'Proveedores en Registro Nacional de Exportadores con solicitud de recuperación en los últimos 6 meses.' },
  { id: 'EXCL_10', text: 'Proveedores con ventas exentas/exoneradas superiores al 50% en el ejercicio anterior.' },
  { id: 'EXCL_11', text: 'Compras efectuadas por órganos de la República, Estados y Municipios notificados SPE.' },
  { id: 'EXCL_12', text: 'Compras efectuadas por entes públicos sin fines empresariales notificados SPE.' },
  { id: 'EXCL_13', text: 'Supuesto de excepción previsto en el Artículo 146 del Código Orgánico Tributario.' }
];

// Generate official 14-digit voucher number AAAAMMSSSSSSSS
export function generateVatVoucherNumber(year: number = 2026, month: number = 10, sequence: number = 1): string {
  const yyyy = year.toString().padStart(4, '0');
  const mm = month.toString().padStart(2, '0');
  const ssssssss = sequence.toString().padStart(8, '0');
  return `${yyyy}${mm}${ssssssss}`;
}

// Calculate VAT withholding according to Providencia SNAT/2025/000054
export function calculateVatWithholding(params: {
  invoiceTotal: number;
  isVatDiscriminated: boolean;
  vatRatePercent?: number; // 16% standard
  isRifCompliant: boolean; // Validated in SENIAT portal
  meetsFormalReqs: boolean; // Providencia 0071 compliant
  has100PercentFlag: boolean; // Portal shows 100% withholding
  exclusionId?: string; // If applicable under Art 3
  sequence?: number;
}): VatCalculationResult {
  const {
    invoiceTotal,
    isVatDiscriminated,
    vatRatePercent = 16,
    isRifCompliant,
    meetsFormalReqs,
    has100PercentFlag,
    exclusionId,
    sequence = 1
  } = params;

  // Check Art. 3 statutory exclusions
  if (exclusionId) {
    const excl = SENIAT_ART3_EXCLUSIONS.find(e => e.id === exclusionId);
    return {
      invoicedTotal: invoiceTotal,
      taxableBase: invoiceTotal,
      vatRate: 0,
      vatAmount: 0,
      retentionPercentage: 0,
      retentionAmount: 0,
      netPayableToSupplier: invoiceTotal,
      voucherNumber: 'N/A - EXCLUIDO',
      isExemptByArt3: true,
      exclusionReason: excl?.text || 'Exclusión Art. 3 Prov. SNAT/2025/000054',
      isDecomposed: false
    };
  }

  let taxableBase = 0;
  let vatAmount = 0;
  let isDecomposed = false;

  if (isVatDiscriminated) {
    // Standard invoice: InvoiceTotal = Base + VAT
    taxableBase = Number((invoiceTotal / (1 + vatRatePercent / 100)).toFixed(2));
    vatAmount = Number((invoiceTotal - taxableBase).toFixed(2));
  } else {
    // Formula from PA SNAT/2025/000054:
    // B.I. = Pfac / ((AI / 100) + 1)
    // Mret = Pfac - B.I.
    taxableBase = Number((invoiceTotal / ((vatRatePercent / 100) + 1)).toFixed(2));
    vatAmount = Number((invoiceTotal - taxableBase).toFixed(2));
    isDecomposed = true;
  }

  // Determine percentage: 100% or 75%
  let retentionPercentage: 75 | 100 = 75;

  // 100% triggers:
  // 1. VAT not discriminated
  // 2. Fails formal invoice requirements (Prov 0071)
  // 3. Provider not registered in RIF or flagged 100% in SENIAT portal
  if (!isVatDiscriminated || !meetsFormalReqs || !isRifCompliant || has100PercentFlag) {
    retentionPercentage = 100;
  }

  const retentionAmount = Number((vatAmount * (retentionPercentage / 100)).toFixed(2));
  const netPayableToSupplier = Number((invoiceTotal - retentionAmount).toFixed(2));

  const now = new Date();
  const voucherNumber = generateVatVoucherNumber(now.getFullYear(), now.getMonth() + 1, sequence);

  return {
    invoicedTotal: invoiceTotal,
    taxableBase,
    vatRate: vatRatePercent,
    vatAmount,
    retentionPercentage,
    retentionAmount,
    netPayableToSupplier,
    voucherNumber,
    isExemptByArt3: false,
    isDecomposed
  };
}

// ISLR Withholding Calculation (Decreto 1808)
export function calculateIslrWithholding(taxableBase: number, concept: 'HONORARIOS_PROF' | 'SERVICIOS_GENERALES' | 'ARRENDAMIENTOS' | 'FLETES'): {
  rate: number;
  amount: number;
  conceptName: string;
} {
  let rate = 0.02; // 2% general services for legal entities
  let conceptName = 'Servicios Generales a Personas Jurídicas (2%)';

  switch (concept) {
    case 'HONORARIOS_PROF':
      rate = 0.05; // 5%
      conceptName = 'Honorarios Profesionales a Personas Jurídicas (5%)';
      break;
    case 'ARRENDAMIENTOS':
      rate = 0.05;
      conceptName = 'Arrendamiento de Inmuebles Comerciales (5%)';
      break;
    case 'FLETES':
      rate = 0.03;
      conceptName = 'Servicios de Transporte y Fletes (3%)';
      break;
    default:
      rate = 0.02;
  }

  const amount = Number((taxableBase * rate).toFixed(2));
  return { rate, amount, conceptName };
}

// Ley de Protección de las Pensiones de Seguridad Social de Venezuela (2024)
export function calculatePensionContribution(grossPayrollAmount: number, statutoryRatePercent: number = 9): {
  grossPayroll: number;
  ratePercent: number;
  contributionAmount: number;
  accountingAccount: string;
} {
  const contributionAmount = Number((grossPayrollAmount * (statutoryRatePercent / 100)).toFixed(2));
  return {
    grossPayroll: grossPayrollAmount,
    ratePercent: statutoryRatePercent,
    contributionAmount,
    accountingAccount: '6.1.01.02.001 - Gastos de Contribución Ley de Pensiones (2024)'
  };
}
