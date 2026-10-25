import { BankTransaction, CurrencyType } from '../types/accounting';
import { categorizeTransactionRuleBased } from './aiAccountant';
import { RECONCILIATION_MODULES } from '../data/venNifAccounts';

export interface JustificationTransferSummary {
  totalBankTransactions: number;
  totalBankItems: number;
  totalAmountBank: number;
  totalInflows: number;
  totalOutflows: number;
  inflowsCount: number;
  outflowsCount: number;
  classifiedStandardCount: number;
  orphansCount: number;
  withAttachmentsCount: number;
  pendingSupportCount: number;
  breakdownByModule: Record<string, { count: number; totalAmount: number }>;
}

export const STANDARD_MODULE_IDS = new Set([
  'MOD_VENTAS',
  'MOD_USD_IN',
  'MOD_TFR_PROPIAS_IN',
  'MOD_SOCIOS_IN',
  'MOD_POS',
  'MOD_PRESTAMOS_IN',
  'MOD_CXC_SOCIOS',
  'MOD_TFR_PROPIAS_OUT',
  'MOD_CXP_SOCIOS',
  'MOD_PROVEEDORES',
  'MOD_USD_OUT',
  'MOD_ANTICIPOS',
  'MOD_NOMINA',
  'MOD_SENIAT_PAGO',
  'MOD_COMISIONES'
]);

/**
 * Procesa TODO el estado de cuenta bancario al terminar el cuadre de conciliación.
 * Clasifica cada partida (entrada o salida) en una de las categorías contables
 * o la destina a la "Carpeta de Huérfanos" (MOD_HUERFANOS) si no encaja en las 15 operativas.
 */
export function processBankStatementForJustification(
  transactions: BankTransaction[],
  currency: CurrencyType,
  bcvRate: number
): {
  updatedTransactions: BankTransaction[];
  summary: JustificationTransferSummary;
} {
  const breakdown: Record<string, { count: number; totalAmount: number }> = {};
  for (const m of RECONCILIATION_MODULES) {
    breakdown[m.id] = { count: 0, totalAmount: 0 };
  }
  if (!breakdown['MOD_HUERFANOS']) {
    breakdown['MOD_HUERFANOS'] = { count: 0, totalAmount: 0 };
  }

  let totalBankTransactions = 0;
  let totalAmountBank = 0;
  let totalInflows = 0;
  let totalOutflows = 0;
  let inflowsCount = 0;
  let outflowsCount = 0;
  let classifiedStandardCount = 0;
  let orphansCount = 0;
  let withAttachmentsCount = 0;
  let pendingSupportCount = 0;

  const updatedTransactions = transactions.map(t => {
    // Solo procesar movimientos bancarios de la moneda activa
    if (t.source !== 'BANK' || t.currency !== currency) {
      return t;
    }

    totalBankTransactions++;
    totalAmountBank += t.amountNominal;
    if (t.txType === 'CREDIT') {
      totalInflows += t.amountNominal;
      inflowsCount++;
    } else {
      totalOutflows += t.amountNominal;
      outflowsCount++;
    }

    if (t.attachments && t.attachments.length > 0) {
      withAttachmentsCount++;
    } else {
      pendingSupportCount++;
    }

    // Determinar categoría contable
    let targetTag = t.moduleTag;

    // Normalizar si venía como 'MOD_OTROS'
    if (targetTag === 'MOD_OTROS') {
      targetTag = 'MOD_HUERFANOS';
    }

    let assignedCode = t.accountCode;
    let assignedName = t.accountName;

    // Si no tiene categoría o es huérfano, intentar clasificar según reglas contables venezolanas
    if (!targetTag || targetTag === 'MOD_HUERFANOS') {
      const rule = categorizeTransactionRuleBased(
        t.rawDescription,
        t.amountNominal,
        t.txType,
        t.currency,
        t.bankName,
        t.bankCode
      );

      if (rule.moduleTag && STANDARD_MODULE_IDS.has(rule.moduleTag)) {
        targetTag = rule.moduleTag;
        if (!assignedCode) assignedCode = rule.accountCode;
        if (!assignedName) assignedName = rule.accountName;
      } else {
        // Asignar definitivamente a Carpeta de Huérfanos
        targetTag = 'MOD_HUERFANOS';
        if (!assignedCode) {
          assignedCode = t.txType === 'CREDIT' ? '1.1.02.01.001' : '2.1.02.01.001';
        }
        if (!assignedName) {
          assignedName = t.txType === 'CREDIT'
            ? 'Partida Huérfana Bancaria (Entrada por Justificar)'
            : 'Partida Huérfana Bancaria (Salida por Justificar)';
        }
      }
    }

    // Conteo estadístico
    if (STANDARD_MODULE_IDS.has(targetTag)) {
      classifiedStandardCount++;
    } else {
      targetTag = 'MOD_HUERFANOS';
      orphansCount++;
    }

    if (!breakdown[targetTag]) {
      breakdown[targetTag] = { count: 0, totalAmount: 0 };
    }
    breakdown[targetTag].count++;
    breakdown[targetTag].totalAmount += t.amountNominal;

    // Retenciones fiscales automáticas para SENIAT si aplica
    let vatAmount = t.retentionVatAmount;
    if (targetTag === 'MOD_PROVEEDORES' && t.txType === 'DEBIT' && !vatAmount) {
      // Cálculo de retención estándar SENIAT 75%
      const baseApprox = t.amountNominal / 1.16;
      const vatApprox = baseApprox * 0.16;
      vatAmount = Number((vatApprox * 0.75).toFixed(2));
    }

    return {
      ...t,
      moduleTag: targetTag,
      accountCode: assignedCode,
      accountName: assignedName,
      retentionVatAmount: vatAmount
    };
  });

  const summary: JustificationTransferSummary = {
    totalBankTransactions,
    totalBankItems: totalBankTransactions,
    totalAmountBank,
    totalInflows,
    totalOutflows,
    inflowsCount,
    outflowsCount,
    classifiedStandardCount,
    orphansCount,
    withAttachmentsCount,
    pendingSupportCount,
    breakdownByModule: breakdown
  };

  return {
    updatedTransactions,
    summary
  };
}
