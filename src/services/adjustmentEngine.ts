import { BankTransaction, JournalEntry, JournalEntryLine, CurrencyType } from '../types/accounting';
import { categorizeTransactionRuleBased } from './aiAccountant';
import { runAutomatedReconciliation } from './matchingEngine';

export interface SuggestedAdjustmentProposal {
  id: string;
  type: 'BANK_UNRECORDED_DEBIT' | 'BANK_UNRECORDED_CREDIT' | 'DISCREPANCY_VARIANCE' | 'IN_TRANSIT_TIMEOUT';
  sourceTransactionId: string;
  sourceTransaction: BankTransaction;
  matchedTransaction?: BankTransaction;
  title: string;
  categoryReason: string;
  differenceAmount: number;
  currency: CurrencyType;
  bcvRate: number;
  entryDate: string;
  referenceDoc: string;
  suggestedEntry: {
    reference: string;
    description: string;
    moduleTag: string;
    lines: JournalEntryLine[];
    totalDebe: number;
    totalHaber: number;
    isBalanced: boolean;
  };
  recommendedAction: string;
  venNifStandardNote: string;
  isApplied?: boolean;
}

/**
 * Helper to get proper Venezuelan bank asset account code and label
 */
export function getBankAccountByCode(bankCode: string, currency: CurrencyType = 'VES', bankName?: string): { code: string; name: string } {
  if (currency === 'USD') {
    return {
      code: '1.1.01.02.010',
      name: `${bankName || 'Banco Nacional'} Cta Moneda Extranjera (Convenio 1)`
    };
  }

  switch (bankCode) {
    case '0134':
      return { code: '1.1.01.02.001', name: 'Banesco Banco Universal (Cta Corriente Bs)' };
    case '0105':
      return { code: '1.1.01.02.002', name: 'Banco Mercantil C.A. (Cta Corriente Bs)' };
    case '0102':
      return { code: '1.1.01.02.003', name: 'Banco de Venezuela S.A. (Cta Corriente Bs)' };
    case '0191':
      return { code: '1.1.01.02.004', name: 'Banco Nacional de Crédito BNC (Bs)' };
    case '0172':
      return { code: '1.1.01.02.005', name: 'Bancamiga Banco Universal (Bs)' };
    default:
      return { code: '1.1.01.02.001', name: `${bankName || 'Banco'} Cta Corriente Bs` };
  }
}

/**
 * Analyzes unreconciled transactions and discrepancies to generate complete, balanced
 * Ven-NIF corrective journal entry proposals for the company's ledger.
 */
export function generateSuggestedAdjustments(
  transactions: BankTransaction[],
  bankCode?: string,
  currency: CurrencyType = 'VES',
  bcvRate: number = 52.40
): SuggestedAdjustmentProposal[] {
  const proposals: SuggestedAdjustmentProposal[] = [];

  const bankTx = transactions.filter(t =>
    t.source === 'BANK' &&
    t.currency === currency &&
    (!bankCode || t.bankCode === bankCode)
  );

  const ledgerTx = transactions.filter(t =>
    t.source === 'LEDGER' &&
    t.currency === currency &&
    (!bankCode || t.bankCode === bankCode)
  );

  // 1. BANK UNRECORDED DEBITS (Notas de débito del banco: comisiones, IGTF, chequeras, retenciones bancarias)
  // En el banco restó dinero (DEBIT), en la contabilidad falta registrar el gasto y abonar al Banco (Haber)
  const unrecordedDebits = bankTx.filter(t => t.txType === 'DEBIT' && t.matchingStatus === 'UNMATCHED');

  unrecordedDebits.forEach((tx, idx) => {
    const bankAccount = getBankAccountByCode(tx.bankCode, tx.currency, tx.bankName);
    const rule = categorizeTransactionRuleBased(tx.rawDescription, tx.amountNominal, 'DEBIT', tx.currency, tx.bankName);
    const amount = tx.amountNominal;

    // Detect specialized expense accounts
    const upper = tx.rawDescription.toUpperCase();
    let expenseCode = rule.accountCode;
    let expenseName = rule.accountName;
    let reason = 'Nota de débito bancaria no registrada en libros.';
    let action = 'Cargar a gastos operacionales/tributarios y abonar a la cuenta bancaria.';
    let nifRef = 'NIC 7 Estado de Flujos de Efectivo & NIC 1 Presentación de Estados Financieros';

    if (upper.includes('IGTF') || upper.includes('LEY IGTF')) {
      expenseCode = '6.1.02.02.001';
      expenseName = 'Gastos por Impuesto a las Grandes Transacciones Financieras (IGTF)';
      reason = 'Débito fiscal bancario por percepción del tributo IGTF no compensable.';
      action = 'Registrar gasto tributario no deducible y rebajar saldo contable de bancos.';
      nifRef = 'Gaceta Oficial N° 6.687 / Ley IGTF - Gasto no compensable ni deducible';
    } else if (upper.includes('COMISION') || upper.includes('MANTENIMIENTO') || upper.includes('SERV. BANCARIO')) {
      expenseCode = '6.1.02.01.001';
      expenseName = 'Gastos por Comisiones Bancarias y Mantenimiento';
      reason = 'Cargo bancario por servicios operativos, transferencias interbancarias o mantenimiento.';
      action = 'Contabilizar en gastos financieros/bancarios del periodo.';
      nifRef = 'Ven-NIF PYME Sección 25 / Gastos por Servicios Financieros';
    } else if (upper.includes('INTERES') || upper.includes('MORA')) {
      expenseCode = '6.1.02.01.003';
      expenseName = 'Gastos por Intereses Bancarios y Financieros';
      reason = 'Débito por intereses moratorios o comisiones de crédito diferido.';
    }

    const lines: JournalEntryLine[] = [
      {
        accountCode: expenseCode,
        accountName: expenseName,
        debe: amount,
        haber: 0,
        rif: tx.counterpartyRif,
        concept: `${tx.rawDescription.slice(0, 50)} (Ajuste Conciliación)`
      },
      {
        accountCode: bankAccount.code,
        accountName: bankAccount.name,
        debe: 0,
        haber: amount,
        rif: tx.counterpartyRif,
        concept: `ND Banco Ref #${tx.referenceNum}`
      }
    ];

    proposals.push({
      id: `prop-debit-${tx.id}-${idx}`,
      type: 'BANK_UNRECORDED_DEBIT',
      sourceTransactionId: tx.id,
      sourceTransaction: tx,
      title: `Ajuste ND: ${tx.rawDescription.slice(0, 45)}`,
      categoryReason: reason,
      differenceAmount: amount,
      currency: tx.currency,
      bcvRate,
      entryDate: tx.txDate,
      referenceDoc: tx.referenceNum,
      suggestedEntry: {
        reference: `AJ-ND-${tx.referenceNum}`,
        description: `Ajuste por débito bancario no asentado Ref: ${tx.referenceNum}`,
        moduleTag: rule.moduleTag || 'MOD_TFR_PROPIAS_OUT',
        lines,
        totalDebe: amount,
        totalHaber: amount,
        isBalanced: true
      },
      recommendedAction: action,
      venNifStandardNote: nifRef
    });
  });

  // 2. BANK UNRECORDED CREDITS (Notas de crédito del banco: depósitos, cobranzas POS no conciliadas, transferencias recibidas)
  // En el banco sumó dinero (CREDIT), en la contabilidad falta registrar el ingreso/cobranza y cargar al Banco (Debe)
  const unrecordedCredits = bankTx.filter(t => t.txType === 'CREDIT' && t.matchingStatus === 'UNMATCHED');

  unrecordedCredits.forEach((tx, idx) => {
    const bankAccount = getBankAccountByCode(tx.bankCode, tx.currency, tx.bankName);
    const rule = categorizeTransactionRuleBased(tx.rawDescription, tx.amountNominal, 'CREDIT', tx.currency, tx.bankName);
    const amount = tx.amountNominal;
    const upper = tx.rawDescription.toUpperCase();

    let counterAccountCode = rule.accountCode;
    let counterAccountName = rule.accountName;
    let reason = 'Abono bancario no registrado en libros contables (cobranza o depósito directo).';
    let action = 'Cargar a banco y abonar a cuentas por cobrar o depósitos no identificados.';
    let nifRef = 'Ven-NIF PYME Sección 23 Ingresos de Actividades Ordinarias / Cobranzas';

    if (upper.includes('POS') || upper.includes('CREDICARD') || upper.includes('MEGASOFT') || upper.includes('LOTE')) {
      counterAccountCode = '1.1.02.01.005';
      counterAccountName = 'Cobranzas por Puntos de Venta (POS) por Liquidar';
      reason = 'Liquidación de lote POS acreditada en cuenta corriente por el adquirente.';
      action = 'Cargar a cuenta de bancos y cancelar partida transitoria de cobranzas POS.';
    } else if (upper.includes('INTERES') || upper.includes('RENDIMIENTO')) {
      counterAccountCode = '4.2.01.01.001';
      counterAccountName = 'Ingresos por Intereses Bancarios y Rendimientos';
      reason = 'Abono de intereses ganados sobre saldos bancarios o cuenta remunerada.';
      action = 'Registrar ingreso financiero y aumentar saldo de banco.';
    } else if (!tx.counterpartyRif) {
      counterAccountCode = '2.1.05.01.001';
      counterAccountName = 'Depósitos Bancarios no Identificados / Por Conciliar';
      reason = 'Transferencia recibida de tercero sin notificación ni RIF registrado en ERP.';
      action = 'Asentar transitoriamente en pasivo hasta identificar cliente o factura.';
    }

    const lines: JournalEntryLine[] = [
      {
        accountCode: bankAccount.code,
        accountName: bankAccount.name,
        debe: amount,
        haber: 0,
        rif: tx.counterpartyRif,
        concept: `NC Banco Ref #${tx.referenceNum}`
      },
      {
        accountCode: counterAccountCode,
        accountName: counterAccountName,
        debe: 0,
        haber: amount,
        rif: tx.counterpartyRif,
        concept: `${tx.rawDescription.slice(0, 50)} (Ajuste Conciliación)`
      }
    ];

    proposals.push({
      id: `prop-credit-${tx.id}-${idx}`,
      type: 'BANK_UNRECORDED_CREDIT',
      sourceTransactionId: tx.id,
      sourceTransaction: tx,
      title: `Ajuste NC: ${tx.rawDescription.slice(0, 45)}`,
      categoryReason: reason,
      differenceAmount: amount,
      currency: tx.currency,
      bcvRate,
      entryDate: tx.txDate,
      referenceDoc: tx.referenceNum,
      suggestedEntry: {
        reference: `AJ-NC-${tx.referenceNum}`,
        description: `Ajuste por crédito bancario directo Ref: ${tx.referenceNum}`,
        moduleTag: rule.moduleTag || 'MOD_VENTAS',
        lines,
        totalDebe: amount,
        totalHaber: amount,
        isBalanced: true
      },
      recommendedAction: action,
      venNifStandardNote: nifRef
    });
  });

  // 3. DISCREPANCIES / VARIANCES (Misma referencia pero diferente monto entre Banco y Libros)
  // Detectar items marcados como DISCREPANCY o buscar coincidencias de referencia con montos divergentes
  const discrepancyBankItems = bankTx.filter(t => t.matchingStatus === 'DISCREPANCY');

  discrepancyBankItems.forEach((bItem, idx) => {
    const lItem = ledgerTx.find(l => l.id === bItem.matchedWithId || l.referenceNum === bItem.referenceNum);
    if (!lItem) return;

    const bankAccount = getBankAccountByCode(bItem.bankCode, bItem.currency, bItem.bankName);
    const diff = Number((bItem.amountNominal - lItem.amountNominal).toFixed(2));
    const absDiff = Math.abs(diff);
    if (absDiff < 0.005) return;

    // Si el banco cobró más de lo registrado en libros (bItem > lItem en débito):
    // Falta cargar la diferencia al gasto o cuenta auxiliar y abonar al banco.
    let lines: JournalEntryLine[] = [];
    let reason = '';
    let action = '';

    if (bItem.txType === 'DEBIT') {
      if (diff > 0) {
        // Banco debitó más (ej: Banco cobró 1.050 Bs, en Libros se registró 1.000 Bs)
        reason = `Diferencia de monto: El banco debitó ${diff.toFixed(2)} ${currency} más que el libro contable.`;
        action = `Cargar la diferencia de ${diff.toFixed(2)} ${currency} a gastos o ajustes y abonar a Bancos.`;
        lines = [
          {
            accountCode: '6.1.02.01.001',
            accountName: 'Gastos por Ajustes y Comisiones Bancarias',
            debe: absDiff,
            haber: 0,
            rif: bItem.counterpartyRif,
            concept: `Ajuste diferencia en débito Ref #${bItem.referenceNum}`
          },
          {
            accountCode: bankAccount.code,
            accountName: bankAccount.name,
            debe: 0,
            haber: absDiff,
            rif: bItem.counterpartyRif,
            concept: `Corrección saldo contable Banco ${bItem.bankName}`
          }
        ];
      } else {
        // En libros se debitó de más (Libros 1.200 Bs, Banco 1.000 Bs)
        reason = `Diferencia de monto: En el libro contable se registró un egreso mayor al cobrado por el banco por ${absDiff.toFixed(2)} ${currency}.`;
        action = `Reversar el exceso contable cargando al Banco y abonando a la contrapartida.`;
        lines = [
          {
            accountCode: bankAccount.code,
            accountName: bankAccount.name,
            debe: absDiff,
            haber: 0,
            rif: bItem.counterpartyRif,
            concept: `Reverso exceso egreso contable Ref #${bItem.referenceNum}`
          },
          {
            accountCode: lItem.accountCode || '6.1.02.01.001',
            accountName: lItem.accountName || 'Ajustes de Periodos Anteriores / Proveedores',
            debe: 0,
            haber: absDiff,
            rif: bItem.counterpartyRif,
            concept: `Corrección asiento errado Ref #${lItem.referenceNum}`
          }
        ];
      }
    } else {
      // CREDIT (Ingresos / Cobranzas)
      if (diff > 0) {
        // Banco acreditó más dinero del registrado en libros
        reason = `Diferencia en cobranza: El banco acreditó ${absDiff.toFixed(2)} ${currency} más que el registro en libros.`;
        action = `Ajustar saldo bancario al debe y abonar la diferencia a ingresos o cobranzas.`;
        lines = [
          {
            accountCode: bankAccount.code,
            accountName: bankAccount.name,
            debe: absDiff,
            haber: 0,
            rif: bItem.counterpartyRif,
            concept: `Ajuste abono en exceso Ref #${bItem.referenceNum}`
          },
          {
            accountCode: '4.1.01.01.001',
            accountName: 'Ingresos Operacionales / Cobranzas Extraordinarias',
            debe: 0,
            haber: absDiff,
            rif: bItem.counterpartyRif,
            concept: `Ajuste diferencia abono Ref #${bItem.referenceNum}`
          }
        ];
      } else {
        // En libros se registró un ingreso mayor al liquidado por el banco
        reason = `Diferencia en cobranza: En libros se asentó un ingreso mayor por ${absDiff.toFixed(2)} ${currency} (posible comisión deducida en banco).`;
        action = `Registrar la deducción/comisión al gasto y rebajar saldo de bancos.`;
        lines = [
          {
            accountCode: '6.1.02.01.002',
            accountName: 'Gastos por Comisiones y Deducciones Bancarias',
            debe: absDiff,
            haber: 0,
            rif: bItem.counterpartyRif,
            concept: `Deducción bancaria no registrada Ref #${bItem.referenceNum}`
          },
          {
            accountCode: bankAccount.code,
            accountName: bankAccount.name,
            debe: 0,
            haber: absDiff,
            rif: bItem.counterpartyRif,
            concept: `Ajuste contra cuenta bancaria Ref #${bItem.referenceNum}`
          }
        ];
      }
    }

    proposals.push({
      id: `prop-disc-${bItem.id}-${idx}`,
      type: 'DISCREPANCY_VARIANCE',
      sourceTransactionId: bItem.id,
      sourceTransaction: bItem,
      matchedTransaction: lItem,
      title: `Ajuste por Variación: Ref #${bItem.referenceNum} (${currency} ${absDiff.toFixed(2)})`,
      categoryReason: reason,
      differenceAmount: absDiff,
      currency: bItem.currency,
      bcvRate,
      entryDate: bItem.txDate,
      referenceDoc: bItem.referenceNum,
      suggestedEntry: {
        reference: `AJ-VAR-${bItem.referenceNum}`,
        description: `Asiento de corrección por variación entre Banco y Libros Ref ${bItem.referenceNum}`,
        moduleTag: 'MOD_DISCREPANCY_ADJUST',
        lines,
        totalDebe: absDiff,
        totalHaber: absDiff,
        isBalanced: true
      },
      recommendedAction: action,
      venNifStandardNote: 'Ven-NIF PYME Sección 10 Políticas, Estimaciones y Errores Contables'
    });
  });

  return proposals;
}

/**
 * Applies a list of adjustment proposals directly into the transactions state,
 * creating corresponding ledger records so the reconciliation automatically squares up.
 */
export function applyAdjustmentProposals(
  currentTransactions: BankTransaction[],
  proposalsToApply: SuggestedAdjustmentProposal[]
): {
  updatedTransactions: BankTransaction[];
  newLedgerEntriesCount: number;
  newJournalEntries: JournalEntry[];
} {
  const proposalIds = new Set(proposalsToApply.map(p => p.id));
  const newLedgerItems: BankTransaction[] = [];
  const generatedJournalEntries: JournalEntry[] = [];

  proposalsToApply.forEach(prop => {
    const src = prop.sourceTransaction;

    // Create a matching LEDGER item
    const newLedgerItem: BankTransaction = {
      id: `led-adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      source: 'LEDGER',
      bankCode: src.bankCode,
      bankName: src.bankName,
      referenceNum: src.referenceNum,
      txDate: prop.entryDate,
      txType: src.txType,
      amountNominal: prop.type === 'DISCREPANCY_VARIANCE' && prop.matchedTransaction 
        ? src.amountNominal 
        : src.amountNominal,
      currency: src.currency,
      bcvRate: prop.bcvRate,
      amountVes: src.amountVes,
      rawDescription: `${src.rawDescription} (Asiento de Ajuste Contable)`,
      counterpartyRif: src.counterpartyRif,
      counterpartyName: src.counterpartyName,
      accountCode: prop.suggestedEntry.lines[0]?.accountCode || '1.1.01.02.001',
      accountName: prop.suggestedEntry.lines[0]?.accountName || `${src.bankName} Cta Corriente`,
      matchingStatus: 'UNMATCHED',
      moduleTag: prop.suggestedEntry.moduleTag,
      notes: `Asiento correctivo: ${prop.categoryReason}. ${prop.venNifStandardNote}`,
      createdAt: new Date().toISOString()
    };

    if (prop.type === 'DISCREPANCY_VARIANCE' && prop.matchedTransaction) {
      // For discrepancy, update the existing ledger item's amount or match it directly
      // Instead of adding a duplicate, we update the existing ledger item to match bank nominal
    } else {
      newLedgerItems.push(newLedgerItem);
    }

    // Prepare formal JournalEntry for export/accounting record
    generatedJournalEntries.push({
      id: `entry-${prop.id}`,
      date: prop.entryDate,
      reference: prop.suggestedEntry.reference,
      description: prop.suggestedEntry.description,
      lines: prop.suggestedEntry.lines,
      totalDebe: prop.suggestedEntry.totalDebe,
      totalHaber: prop.suggestedEntry.totalHaber,
      isBalanced: prop.suggestedEntry.isBalanced,
      moduleTag: prop.suggestedEntry.moduleTag
    });
  });

  // Combine with existing transactions
  let combined = [...currentTransactions, ...newLedgerItems];

  // If there are discrepancies corrected, update the discrepancy items
  proposalsToApply.forEach(prop => {
    if (prop.type === 'DISCREPANCY_VARIANCE' && prop.matchedTransaction) {
      combined = combined.map(t => {
        if (t.id === prop.sourceTransactionId) {
          return {
            ...t,
            matchingStatus: 'MATCHED_EXACT' as const,
            discrepancyAmount: 0,
            notes: (t.notes || '') + ' [Ajustado mediante asiento de corrección de variación]'
          };
        }
        if (t.id === prop.matchedTransaction?.id) {
          return {
            ...t,
            amountNominal: prop.sourceTransaction.amountNominal,
            amountVes: prop.sourceTransaction.amountVes,
            matchingStatus: 'MATCHED_EXACT' as const,
            discrepancyAmount: 0,
            notes: (t.notes || '') + ' [Ajustado a valor real del extracto bancario]'
          };
        }
        return t;
      });
    }
  });

  // Re-run reconciliation algorithm to pair newly added ledger items with bank items
  const reconciled = runAutomatedReconciliation(combined);

  return {
    updatedTransactions: reconciled.updatedTransactions,
    newLedgerEntriesCount: newLedgerItems.length,
    newJournalEntries: generatedJournalEntries
  };
}
