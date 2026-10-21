import { BankTransaction } from '../types/accounting';

export type HealthIssueType = 
  | 'EXACT_DUPLICATE' 
  | 'SUSPECTED_DUPLICATE' 
  | 'MALFORMED_REFERENCE' 
  | 'ZERO_OR_NEGATIVE_AMOUNT' 
  | 'INVALID_DATE'
  | 'EMPTY_DESCRIPTION';

export type HealthSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface HealthIssue {
  id: string;
  type: HealthIssueType;
  severity: HealthSeverity;
  title: string;
  description: string;
  transactionId: string;
  transaction: BankTransaction;
  duplicateOfTransaction?: BankTransaction;
  suggestedAction: 'DELETE' | 'SANITIZE_REFERENCE' | 'NORMALIZE_AMOUNT' | 'CLEAN_DATE';
  suggestedFixPreview: {
    before: string;
    after: string;
    newReference?: string;
    newAmount?: number;
    newDate?: string;
  };
}

export interface HealthReport {
  analyzedAt: string;
  totalTransactions: number;
  healthScore: number; // 0 to 100
  status: 'EXCELLENT' | 'GOOD' | 'ATTENTION_NEEDED' | 'CRITICAL';
  exactDuplicatesCount: number;
  suspectedDuplicatesCount: number;
  malformedReferencesCount: number;
  amountIssuesCount: number;
  dateIssuesCount: number;
  issues: HealthIssue[];
}

/**
 * Normaliza una referencia para comparar si es un duplicado o está sucia
 */
export function normalizeReference(ref?: string | null): string {
  if (!ref) return '';
  return String(ref).trim().replace(/\s+/g, ' ');
}

/**
 * Determina si una referencia bancaria está mal formada o vacía
 */
export function isMalformedReference(ref?: string | null): boolean {
  if (!ref) return true;
  const trimmed = String(ref).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '--' || trimmed === '0' || trimmed === '0000' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 's/r') {
    return true;
  }
  // Espacios dobles internos o símbolos molestos
  if (/\s{2,}/.test(trimmed) || /^[#*\/\\-]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Sanea y repara una referencia mal formada
 */
export function sanitizeReference(ref?: string | null, indexFallback: number = 1): string {
  if (!ref || isMalformedReference(ref)) {
    return `REF-AUTOFILTER-${String(indexFallback).padStart(5, '0')}`;
  }
  let cleaned = String(ref).trim();
  // Limpiar prefijos redundantes repetidos como "REF: REF#"
  cleaned = cleaned.replace(/^(?:REF|REFERENCIA|COMPROBANTE)[:\s#\-_]+/i, 'REF-');
  // Reemplazar espacios múltiples por un solo guion
  cleaned = cleaned.replace(/\s+/g, '-');
  // Remover caracteres ilegales en referencias
  cleaned = cleaned.replace(/[^A-Za-z0-9\-_]/g, '');
  return cleaned || `REF-AUTOFILTER-${String(indexFallback).padStart(5, '0')}`;
}

/**
 * Ejecuta el análisis profundo de salud de la base de datos de transacciones
 */
export function runDatabaseHealthCheck(transactions: BankTransaction[]): HealthReport {
  const issues: HealthIssue[] = [];
  const now = new Date().toISOString();

  if (!transactions || transactions.length === 0) {
    return {
      analyzedAt: now,
      totalTransactions: 0,
      healthScore: 100,
      status: 'EXCELLENT',
      exactDuplicatesCount: 0,
      suspectedDuplicatesCount: 0,
      malformedReferencesCount: 0,
      amountIssuesCount: 0,
      dateIssuesCount: 0,
      issues: []
    };
  }

  // Mapa para detectar duplicados exactos (mismo origen, cuenta/banco, fecha, tipo, monto y referencia)
  const exactKeyMap = new Map<string, BankTransaction>();
  // Mapa para detectar duplicados sospechosos (mismo origen, cuenta, fecha, monto exacto pero referencia ligeramente distinta o vacía)
  const suspectedKeyMap = new Map<string, BankTransaction>();

  let exactDuplicatesCount = 0;
  let suspectedDuplicatesCount = 0;
  let malformedReferencesCount = 0;
  let amountIssuesCount = 0;
  let dateIssuesCount = 0;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    // 1. Detección de Referencia Mal Formada
    if (isMalformedReference(tx.referenceNum)) {
      malformedReferencesCount++;
      const sanitized = sanitizeReference(tx.referenceNum, i + 1);
      issues.push({
        id: `health-malformed-ref-${tx.id}`,
        type: 'MALFORMED_REFERENCE',
        severity: 'WARNING',
        title: 'Referencia bancaria ausente o mal formateada',
        description: `La transacción contiene una referencia inválida ("${tx.referenceNum || '(vacía)'}"). Esto impide el cruce determinístico con el banco.`,
        transactionId: tx.id,
        transaction: tx,
        suggestedAction: 'SANITIZE_REFERENCE',
        suggestedFixPreview: {
          before: tx.referenceNum || '(Sin referencia)',
          after: sanitized,
          newReference: sanitized
        }
      });
    }

    // 2. Detección de Montos Inválidos o Negativos
    if (tx.amountNominal <= 0) {
      amountIssuesCount++;
      const correctedAmount = Math.abs(tx.amountNominal) || 0.01;
      issues.push({
        id: `health-amount-${tx.id}`,
        type: 'ZERO_OR_NEGATIVE_AMOUNT',
        severity: tx.amountNominal === 0 ? 'CRITICAL' : 'WARNING',
        title: tx.amountNominal === 0 ? 'Monto en cero detectado' : 'Monto negativo en registro nominal',
        description: tx.amountNominal === 0 
          ? 'El registro no tiene importe económico asentado (0.00), lo que distorsiona el balance de caja.' 
          : 'El monto viene con signo negativo en vez de positivo con clasificación de Débito/Crédito.',
        transactionId: tx.id,
        transaction: tx,
        suggestedAction: 'NORMALIZE_AMOUNT',
        suggestedFixPreview: {
          before: `${tx.amountNominal.toFixed(2)} ${tx.currency}`,
          after: `${correctedAmount.toFixed(2)} ${tx.currency}`,
          newAmount: correctedAmount
        }
      });
    }

    // 3. Detección de Fechas Inválidas o Corruptas
    const parsedDate = new Date(tx.txDate);
    const isInvalidDate = isNaN(parsedDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(tx.txDate);
    if (isInvalidDate) {
      dateIssuesCount++;
      const todayIso = new Date().toISOString().split('T')[0];
      issues.push({
        id: `health-date-${tx.id}`,
        type: 'INVALID_DATE',
        severity: 'WARNING',
        title: 'Fecha inválida o con formato corrupto',
        description: `La fecha registrada "${tx.txDate}" no es válida y causará errores en cálculos de tolerancia.`,
        transactionId: tx.id,
        transaction: tx,
        suggestedAction: 'CLEAN_DATE',
        suggestedFixPreview: {
          before: tx.txDate || '(vacía)',
          after: todayIso,
          newDate: todayIso
        }
      });
    }

    // 4. Detección de Duplicados Exactos
    const cleanRef = (tx.referenceNum || '').trim().toUpperCase();
    const exactKey = `${tx.source}_${tx.bankCode || ''}_${tx.txDate}_${tx.txType}_${tx.amountNominal.toFixed(2)}_${cleanRef}`;
    
    if (cleanRef && cleanRef !== '0' && cleanRef !== '-' && exactKeyMap.has(exactKey)) {
      const primaryTx = exactKeyMap.get(exactKey)!;
      exactDuplicatesCount++;
      issues.push({
        id: `health-dup-exact-${tx.id}`,
        type: 'EXACT_DUPLICATE',
        severity: 'CRITICAL',
        title: 'Movimiento duplicado exacto',
        description: `Se detectó una copia idéntica del movimiento (${tx.source === 'BANK' ? 'Banco' : 'Libro Mayor'}, Fecha: ${tx.txDate}, Monto: ${tx.amountNominal.toFixed(2)}, Ref: ${tx.referenceNum}).`,
        transactionId: tx.id,
        transaction: tx,
        duplicateOfTransaction: primaryTx,
        suggestedAction: 'DELETE',
        suggestedFixPreview: {
          before: `Transacción redundante ID: ${tx.id.slice(-6)}`,
          after: `Conservar original ID: ${primaryTx.id.slice(-6)} y depurar duplicado`
        }
      });
    } else if (cleanRef && cleanRef !== '0') {
      exactKeyMap.set(exactKey, tx);
    }

    // 5. Detección de Duplicados Sospechosos (mismo banco, misma fecha, mismo monto, misma descripción corta)
    const cleanDesc = (tx.rawDescription || '').toLowerCase().slice(0, 30).trim();
    const suspectedKey = `${tx.source}_${tx.bankCode || ''}_${tx.txDate}_${tx.txType}_${tx.amountNominal.toFixed(2)}_${cleanDesc}`;

    if (!cleanRef && suspectedKeyMap.has(suspectedKey)) {
      const primaryTx = suspectedKeyMap.get(suspectedKey)!;
      suspectedDuplicatesCount++;
      issues.push({
        id: `health-dup-suspected-${tx.id}`,
        type: 'SUSPECTED_DUPLICATE',
        severity: 'WARNING',
        title: 'Movimiento sospechoso de doble importación',
        description: `Misma fecha (${tx.txDate}), monto (${tx.amountNominal.toFixed(2)}) y concepto similar sin número de comprobante único.`,
        transactionId: tx.id,
        transaction: tx,
        duplicateOfTransaction: primaryTx,
        suggestedAction: 'DELETE',
        suggestedFixPreview: {
          before: `Posible duplicado sin referencia`,
          after: `Conservar ${primaryTx.id.slice(-6)} y eliminar copia`
        }
      });
    } else if (!cleanRef) {
      suspectedKeyMap.set(suspectedKey, tx);
    }
  }

  // Cálculo de Puntuación de Salud (100 = Impecable)
  const penalty = (exactDuplicatesCount * 6) + (malformedReferencesCount * 2) + (amountIssuesCount * 5) + (dateIssuesCount * 3) + (suspectedDuplicatesCount * 3);
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / Math.max(1, transactions.length * 0.1)))));

  let status: HealthReport['status'] = 'EXCELLENT';
  if (healthScore < 60) status = 'CRITICAL';
  else if (healthScore < 85) status = 'ATTENTION_NEEDED';
  else if (healthScore < 95) status = 'GOOD';

  return {
    analyzedAt: now,
    totalTransactions: transactions.length,
    healthScore,
    status,
    exactDuplicatesCount,
    suspectedDuplicatesCount,
    malformedReferencesCount,
    amountIssuesCount,
    dateIssuesCount,
    issues
  };
}

/**
 * Aplica la limpieza automática con un solo clic sobre la base de datos de transacciones
 */
export function executeAutomaticHealthCleanup(
  transactions: BankTransaction[],
  report: HealthReport
): {
  cleanedTransactions: BankTransaction[];
  deletedTransactionIds: string[];
  fixedReferenceCount: number;
  deletedDuplicateCount: number;
  normalizedAmountCount: number;
  cleanedDateCount: number;
} {
  const idsToDelete = new Set<string>();
  const referenceFixes = new Map<string, string>();
  const amountFixes = new Map<string, number>();
  const dateFixes = new Map<string, string>();

  let deletedDuplicateCount = 0;
  let fixedReferenceCount = 0;
  let normalizedAmountCount = 0;
  let cleanedDateCount = 0;

  for (const issue of report.issues) {
    if (issue.suggestedAction === 'DELETE') {
      idsToDelete.add(issue.transactionId);
      deletedDuplicateCount++;
    } else if (issue.suggestedAction === 'SANITIZE_REFERENCE' && issue.suggestedFixPreview.newReference) {
      referenceFixes.set(issue.transactionId, issue.suggestedFixPreview.newReference);
      fixedReferenceCount++;
    } else if (issue.suggestedAction === 'NORMALIZE_AMOUNT' && issue.suggestedFixPreview.newAmount !== undefined) {
      amountFixes.set(issue.transactionId, issue.suggestedFixPreview.newAmount);
      normalizedAmountCount++;
    } else if (issue.suggestedAction === 'CLEAN_DATE' && issue.suggestedFixPreview.newDate) {
      dateFixes.set(issue.transactionId, issue.suggestedFixPreview.newDate);
      cleanedDateCount++;
    }
  }

  // Filtrar eliminados y aplicar parches
  const cleanedTransactions: BankTransaction[] = [];
  const deletedTransactionIds: string[] = Array.from(idsToDelete);

  for (const tx of transactions) {
    if (idsToDelete.has(tx.id)) {
      continue;
    }

    let modifiedTx = { ...tx };
    let hasChanges = false;

    if (referenceFixes.has(tx.id)) {
      const fixedRef = referenceFixes.get(tx.id)!;
      modifiedTx.referenceNum = fixedRef;
      modifiedTx.referenceLast4 = fixedRef.replace(/\D/g, '').slice(-4) || '';
      hasChanges = true;
    }

    if (amountFixes.has(tx.id)) {
      const newAmt = amountFixes.get(tx.id)!;
      modifiedTx.amountNominal = newAmt;
      modifiedTx.amountVes = modifiedTx.currency === 'USD' ? newAmt * (modifiedTx.bcvRate || 1) : newAmt;
      hasChanges = true;
    }

    if (dateFixes.has(tx.id)) {
      modifiedTx.txDate = dateFixes.get(tx.id)!;
      hasChanges = true;
    }

    if (hasChanges) {
      modifiedTx.notes = (modifiedTx.notes ? `${modifiedTx.notes} | ` : '') + '[Checkup Saludable: Saneado automáticamente]';
    }

    cleanedTransactions.push(modifiedTx);
  }

  return {
    cleanedTransactions,
    deletedTransactionIds,
    fixedReferenceCount,
    deletedDuplicateCount,
    normalizedAmountCount,
    cleanedDateCount
  };
}
