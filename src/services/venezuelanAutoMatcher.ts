/**
 * Motor de Auto-Conciliación Bancaria Venezolana y Memoria de Beneficiarios
 * Cruza automáticamente extractos bancarios con soportes digitales de Telegram y reglas operativas de Venezuela.
 */

import { BankTransaction, DigitalSupportAttachment } from '../types/accounting';
import { getBeneficiaryRepository, learnBeneficiaryRepository } from './beneficiaryMemoryService';
import { extractMetadataFromDescription, calculateDescriptionSimilarity } from './matchingEngine';

export interface AutoReconcileReport {
  totalProcessed: number;
  matchedWithSupportCount: number;
  matchedBankFeeCount: number;
  matchedInternalTransferCount: number;
  matchedBeneficiaryMemoryCount: number;
  unreconciledCount: number;
  updatedTransactions: BankTransaction[];
  newLearnedBeneficiaries: number;
}

/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD
 */
function getDaysDiff(dateStr1: string, dateStr2: string): number {
  if (!dateStr1 || !dateStr2) return 999;
  try {
    const d1 = new Date(dateStr1).getTime();
    const d2 = new Date(dateStr2).getTime();
    return Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
  } catch {
    return 999;
  }
}

/**
 * Obtiene los últimos 4 dígitos numéricos de una referencia bancaria
 */
export function getLast4Digits(reference: string): string {
  if (!reference) return '';
  const digits = reference.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : digits;
}

/**
 * Ejecuta el algoritmo de conciliación bancaria venezolana
 */
export function runVenezuelanAutoMatcher(params: {
  transactions: BankTransaction[];
  availableSupports: DigitalSupportAttachment[];
  ownRegisteredBanks?: string[];
}): AutoReconcileReport {
  const { transactions, availableSupports } = params;

  let matchedWithSupportCount = 0;
  let matchedBankFeeCount = 0;
  let matchedInternalTransferCount = 0;
  let matchedBeneficiaryMemoryCount = 0;
  let newLearnedBeneficiaries = 0;

  // Pool de soportes disponibles no asignados
  const unassignedSupports = [...availableSupports];

  // Copia de transacciones para actualizar
  const updatedTransactions = transactions.map((t) => ({ ...t }));

  // REGLA 1: Cruce con Soportes de Telegram / Repositorios
  // Coincidencia: Monto Exacto (±0.05) + Fecha (±2 días) + Últimos 4 dígitos de Referencia
  for (let i = 0; i < updatedTransactions.length; i++) {
    const tx = updatedTransactions[i];
    if (tx.matchingStatus === 'MATCHED_EXACT') continue;

    const txLast4 = getLast4Digits(tx.referenceNum);
    if (!txLast4 || txLast4.length < 3) continue;

    const supportIdx = unassignedSupports.findIndex((s) => {
      const meta = s.extractedMetadata;
      if (!meta) return false;

      // 1. Monto
      const amountDiff = Math.abs(tx.amountNominal - (meta.monto || 0));
      if (amountDiff > 0.05) return false;

      // 2. Últimos 4 dígitos
      const sLast4 = meta.referencia_ultimos_4 || getLast4Digits(meta.referencia_completa || '');
      if (sLast4 !== txLast4) return false;

      // 3. Fecha (±2 días de margen)
      const days = getDaysDiff(tx.txDate, meta.fecha || s.uploadedAt.split('T')[0]);
      if (days > 2) return false;

      return true;
    });

    if (supportIdx >= 0) {
      const matchedSupport = unassignedSupports[supportIdx];
      unassignedSupports.splice(supportIdx, 1);

      tx.matchingStatus = 'MATCHED_EXACT';
      tx.matchedWithId = matchedSupport.id;
      tx.matchScore = 1.0;
      tx.autoReconciledBy = 'EXACT_SUPPORT';
      tx.moduleTag = matchedSupport.moduleTag || matchedSupport.extractedMetadata?.repositorio_sugerido || tx.moduleTag;
      tx.referenceLast4 = txLast4;

      const existingAttachments = tx.attachments || [];
      if (!existingAttachments.some((a) => a.id === matchedSupport.id)) {
        tx.attachments = [...existingAttachments, matchedSupport];
      }

      tx.notes = `Conciliado automáticamente con soporte digital (Ref: ${matchedSupport.extractedMetadata?.referencia_completa || txLast4}).`;
      matchedWithSupportCount++;

      // Si el soporte tenía un tercero, aprenderlo
      if (matchedSupport.extractedMetadata?.identificador_tercero && tx.moduleTag) {
        learnBeneficiaryRepository(
          matchedSupport.extractedMetadata.identificador_tercero,
          tx.moduleTag,
          matchedSupport.extractedMetadata.nombre_tercero
        );
        newLearnedBeneficiaries++;
      }
    }
  }

  // REGLA 2: Auto-conciliación sin soporte para Gastos Bancarios e Impuestos Débitados
  // COM. PAGO MOVIL, IGTF 3%, MANTENIMIENTO, SERVICIO SMS, EMISION DE ESTADO DE CUENTA
  for (let i = 0; i < updatedTransactions.length; i++) {
    const tx = updatedTransactions[i];
    if (tx.matchingStatus === 'MATCHED_EXACT') continue;

    const descUpper = tx.rawDescription.toUpperCase();

    const isBankFee =
      descUpper.includes('COM. PAGO MOVIL') ||
      descUpper.includes('COMISION PAGO MOVIL') ||
      descUpper.includes('COM.SERV.MTTO') ||
      descUpper.includes('MANT Y SERV APLIC') ||
      descUpper.includes('EMISION DE ESTADO DE CUENTA') ||
      descUpper.includes('COMIS. EMISION EDO') ||
      descUpper.includes('COMISION SERVICIO SMS') ||
      descUpper.includes('CARGO MENSUAL') ||
      descUpper.includes('IGTF');

    if (isBankFee && tx.txType === 'DEBIT') {
      tx.matchingStatus = 'MATCHED_EXACT';
      tx.moduleTag = 'MOD_COMISIONES';
      tx.autoReconciledBy = 'AUTO_BANK_FEE';
      tx.referenceLast4 = getLast4Digits(tx.referenceNum);
      tx.notes = 'Débito bancario automático por comisiones, servicios o IGTF (no requiere soporte físico).';
      matchedBankFeeCount++;
      continue;
    }

    // Pagos fiscales directos al SENIAT o BANAVIH
    const isDirectTax =
      descUpper.includes('INCLUSION DE PLANILLA SENIAT') ||
      descUpper.includes('RECAUDACION MULTIPAGOS') ||
      descUpper.includes('BANAVIH REC. EN LINEA');

    if (isDirectTax && tx.txType === 'DEBIT') {
      tx.matchingStatus = 'MATCHED_EXACT';
      tx.moduleTag = 'MOD_SENIAT_PAGO';
      tx.autoReconciledBy = 'AUTO_BANK_FEE';
      tx.referenceLast4 = getLast4Digits(tx.referenceNum);
      tx.notes = 'Pago directo de planilla de tributos SENIAT o parafiscales debitado en cuenta.';
      matchedBankFeeCount++;
      continue;
    }
  }

  // REGLA 3: Transferencias entre Cuentas Propias
  // Si sale un monto de una cuenta propia y entra el mismo monto el mismo día (o ±1 día) en otra transacción
  for (let i = 0; i < updatedTransactions.length; i++) {
    const txOut = updatedTransactions[i];
    if (txOut.matchingStatus === 'MATCHED_EXACT') continue;
    if (txOut.txType !== 'DEBIT') continue;

    const descOut = txOut.rawDescription.toUpperCase();
    const isPotentialInternal =
      descOut.includes('TRF') ||
      descOut.includes('TRANSFERENCIA') ||
      descOut.includes('TRASPASO') ||
      descOut.includes('PAGO MOVIL');

    if (!isPotentialInternal) continue;

    // Buscar contraparte de entrada con mismo monto
    for (let j = 0; j < updatedTransactions.length; j++) {
      if (i === j) continue;
      const txIn = updatedTransactions[j];
      if (txIn.matchingStatus === 'MATCHED_EXACT') continue;
      if (txIn.txType !== 'CREDIT') continue;

      if (Math.abs(txOut.amountNominal - txIn.amountNominal) < 0.05) {
        const days = getDaysDiff(txOut.txDate, txIn.txDate);
        if (days <= 1) {
          // Coincidencia de transferencia entre cuentas
          txOut.matchingStatus = 'MATCHED_EXACT';
          txOut.moduleTag = 'MOD_TFR_PROPIAS_OUT';
          txOut.autoReconciledBy = 'INTERNAL_TRANSFER';
          txOut.matchedWithId = txIn.id;
          txOut.notes = `Traspaso interbancario propio cruzado con abono en fecha ${txIn.txDate}.`;

          txIn.matchingStatus = 'MATCHED_EXACT';
          txIn.moduleTag = 'MOD_TFR_PROPIAS_IN';
          txIn.autoReconciledBy = 'INTERNAL_TRANSFER';
          txIn.matchedWithId = txOut.id;
          txIn.notes = `Traspaso interbancario propio cruzado con débito en fecha ${txOut.txDate}.`;

          matchedInternalTransferCount += 2;
          break;
        }
      }
    }
  }

  // REGLA 4: Memoria Histórica de Beneficiarios
  // Si la transacción tiene un RIF, Cédula o Teléfono que ya conocemos en el diccionario de memoria
  for (let i = 0; i < updatedTransactions.length; i++) {
    const tx = updatedTransactions[i];
    if (tx.matchingStatus === 'MATCHED_EXACT') continue;

    const meta = extractMetadataFromDescription(tx.rawDescription);
    const identifier = meta.rif || tx.counterpartyRif || tx.counterpartyPhoneOrId;

    if (identifier) {
      const memoryMatch = getBeneficiaryRepository(identifier);
      if (memoryMatch && memoryMatch.moduleTag) {
        tx.moduleTag = memoryMatch.moduleTag;
        tx.autoReconciledBy = 'BENEFICIARY_MEMORY';
        tx.notes = `Asignado por memoria histórica a ${memoryMatch.beneficiaryName || memoryMatch.moduleTag}.`;
        matchedBeneficiaryMemoryCount++;
      }
    }
  }

  // REGLA 5: Cruce Banco vs Libro por Monto y Similitud de Concepto
  for (let i = 0; i < updatedTransactions.length; i++) {
    const bnk = updatedTransactions[i];
    if (bnk.source !== 'BANK' || bnk.matchingStatus === 'MATCHED_EXACT') continue;

    for (let j = 0; j < updatedTransactions.length; j++) {
      if (i === j) continue;
      const led = updatedTransactions[j];
      if (led.source !== 'LEDGER' || led.matchingStatus === 'MATCHED_EXACT') continue;
      if (bnk.bankCode && led.bankCode && bnk.bankCode !== led.bankCode) continue;
      if (bnk.currency !== led.currency) continue;

      if (Math.abs(bnk.amountNominal - led.amountNominal) < 0.05) {
        const days = getDaysDiff(bnk.txDate, led.txDate);
        if (days <= 3) {
          const { score, reason } = calculateDescriptionSimilarity(bnk.rawDescription, led.rawDescription);
          if (score >= 0.70) {
            bnk.matchingStatus = 'MATCHED_EXACT';
            bnk.matchedWithId = led.id;
            bnk.matchScore = Number(score.toFixed(2));
            bnk.notes = `Conciliado por Monto y Concepto (${reason}).`;

            led.matchingStatus = 'MATCHED_EXACT';
            led.matchedWithId = bnk.id;
            led.matchScore = Number(score.toFixed(2));
            led.notes = `Conciliado por Monto y Concepto (${reason}).`;

            matchedWithSupportCount++;
            break;
          }
        }
      }
    }
  }

  const unreconciledCount = updatedTransactions.filter((t) => t.matchingStatus !== 'MATCHED_EXACT').length;

  return {
    totalProcessed: updatedTransactions.length,
    matchedWithSupportCount,
    matchedBankFeeCount,
    matchedInternalTransferCount,
    matchedBeneficiaryMemoryCount,
    unreconciledCount,
    updatedTransactions,
    newLearnedBeneficiaries
  };
}
