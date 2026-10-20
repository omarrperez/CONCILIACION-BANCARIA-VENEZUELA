import { BankTransaction, ProofOfCash, CurrencyType } from '../types/accounting';

// Jaro-Winkler string similarity algorithm
export function jaroWinkler(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 1.0;
  if (!str1.length || !str2.length) return 0.0;

  const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (!str2Matches[j] && str1[i] === str2[j]) {
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1Matches[i]) {
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
  }

  const jaro = (matches / str1.length + matches / str2.length + (matches - transpositions / 2) / matches) / 3;

  // Prefix scale (up to 4 chars, p = 0.1)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(str1.length, str2.length)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// Extract potential RIF or terminal ID via regex
export function extractMetadataFromDescription(raw: string): { rif?: string; terminal?: string; docNum?: string } {
  const result: { rif?: string; terminal?: string; docNum?: string } = {};

  // Venezuelan RIF pattern: J-12345678-9, V-12345678-9, G-12345678-9, E-12345678-9 or without hyphens
  const rifMatch = raw.match(/\b([JVGE])-?(\d{7,9})-?(\d)\b/i);
  if (rifMatch) {
    result.rif = `${rifMatch[1].toUpperCase()}-${rifMatch[2]}-${rifMatch[3]}`;
  }

  // POS Terminal pattern
  const terminalMatch = raw.match(/TERM(?:INAL)?\s*[:#]?\s*([A-Z0-9]{4,10})/i);
  if (terminalMatch) {
    result.terminal = terminalMatch[1];
  }

  // Factura or Doc number
  const docMatch = raw.match(/(?:FACT|FAC|DOC|NC|ND)\s*[:#]?\s*(\d{3,8})/i);
  if (docMatch) {
    result.docNum = docMatch[1];
  }

  return result;
}

// 5-Stage Automated Matching Engine
export function runAutomatedReconciliation(transactions: BankTransaction[], toleranceDays: number = 3): {
  updatedTransactions: BankTransaction[];
  exactMatchesCount: number;
  fuzzyMatchesCount: number;
  discrepanciesCount: number;
} {
  const bankItems = transactions.filter(t => t.source === 'BANK');
  const ledgerItems = transactions.filter(t => t.source === 'LEDGER');

  const updated = [...transactions];
  let exactMatchesCount = 0;
  let fuzzyMatchesCount = 0;
  let discrepanciesCount = 0;

  // Set of already matched IDs
  const matchedLedgerIds = new Set<string>();

  for (const bnk of bankItems) {
    if (bnk.matchingStatus === 'MATCHED_EXACT') {
      if (bnk.matchedWithId) matchedLedgerIds.add(bnk.matchedWithId);
      continue;
    }

    const bnkDate = new Date(bnk.txDate).getTime();
    let bestMatch: BankTransaction | null = null;
    let bestScore = 0;
    let matchType: 'EXACT' | 'FUZZY' | 'DISCREPANCY' | null = null;

    for (const led of ledgerItems) {
      if (matchedLedgerIds.has(led.id)) continue;
      if (led.bankCode !== bnk.bankCode && bnk.bankCode && led.bankCode) continue;

      const ledDate = new Date(led.txDate).getTime();
      const diffDays = Math.abs(bnkDate - ledDate) / (1000 * 60 * 60 * 24);

      // Clean reference match
      const cleanBnkRef = bnk.referenceNum.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const cleanLedRef = led.referenceNum.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const isRefMatch = cleanBnkRef && cleanLedRef && (cleanBnkRef === cleanLedRef || cleanBnkRef.includes(cleanLedRef) || cleanLedRef.includes(cleanBnkRef));

      // 1. Stage 2: Exact Deterministic Match
      if (isRefMatch && Math.abs(bnk.amountNominal - led.amountNominal) < 0.01 && diffDays <= toleranceDays) {
        bestMatch = led;
        matchType = 'EXACT';
        bestScore = 1.0;
        break;
      }

      // 2. Stage 3 & 4: Heuristic + Jaro-Winkler Fuzzy Similarity
      const textSimilarity = jaroWinkler(bnk.rawDescription, led.rawDescription);
      const isSameAmount = Math.abs(bnk.amountNominal - led.amountNominal) < 0.01;

      if (isSameAmount && textSimilarity >= 0.85 && diffDays <= toleranceDays + 2) {
        if (textSimilarity > bestScore) {
          bestMatch = led;
          matchType = 'FUZZY';
          bestScore = textSimilarity;
        }
      }

      // 3. Stage Discrepancy: Same reference but slight discrepancy in amount (e.g. withholding or commission)
      if (isRefMatch && Math.abs(bnk.amountNominal - led.amountNominal) >= 0.01 && diffDays <= toleranceDays) {
        bestMatch = led;
        matchType = 'DISCREPANCY';
        bestScore = 0.80;
      }
    }

    if (bestMatch && matchType) {
      matchedLedgerIds.add(bestMatch.id);

      const bnkIndex = updated.findIndex(t => t.id === bnk.id);
      const ledIndex = updated.findIndex(t => t.id === bestMatch.id);

      if (matchType === 'EXACT') {
        exactMatchesCount++;
        if (bnkIndex >= 0) {
          updated[bnkIndex] = {
            ...updated[bnkIndex],
            matchingStatus: 'MATCHED_EXACT',
            matchedWithId: bestMatch.id,
            matchScore: 1.0,
            discrepancyAmount: 0
          };
        }
        if (ledIndex >= 0) {
          updated[ledIndex] = {
            ...updated[ledIndex],
            matchingStatus: 'MATCHED_EXACT',
            matchedWithId: bnk.id,
            matchScore: 1.0,
            discrepancyAmount: 0
          };
        }
      } else if (matchType === 'FUZZY') {
        fuzzyMatchesCount++;
        if (bnkIndex >= 0) {
          updated[bnkIndex] = {
            ...updated[bnkIndex],
            matchingStatus: 'MATCHED_FUZZY',
            matchedWithId: bestMatch.id,
            matchScore: Number(bestScore.toFixed(2)),
            discrepancyAmount: 0
          };
        }
        if (ledIndex >= 0) {
          updated[ledIndex] = {
            ...updated[ledIndex],
            matchingStatus: 'MATCHED_FUZZY',
            matchedWithId: bnk.id,
            matchScore: Number(bestScore.toFixed(2)),
            discrepancyAmount: 0
          };
        }
      } else if (matchType === 'DISCREPANCY') {
        discrepanciesCount++;
        const delta = bnk.amountNominal - bestMatch.amountNominal;
        if (bnkIndex >= 0) {
          updated[bnkIndex] = {
            ...updated[bnkIndex],
            matchingStatus: 'DISCREPANCY',
            matchedWithId: bestMatch.id,
            discrepancyAmount: delta
          };
        }
        if (ledIndex >= 0) {
          updated[ledIndex] = {
            ...updated[ledIndex],
            matchingStatus: 'DISCREPANCY',
            matchedWithId: bnk.id,
            discrepancyAmount: -delta
          };
        }
      }
    }
  }

  return {
    updatedTransactions: updated,
    exactMatchesCount,
    fuzzyMatchesCount,
    discrepanciesCount
  };
}

// Calculate Proof of Cash (4-Column Proof of Cash: S_conciliado = S_banco + D_transito - C_pendientes)
export function calculateProofOfCash(
  transactions: BankTransaction[],
  bankCode: string,
  currency: CurrencyType = 'VES',
  initialBankBalance: number = 0.00,
  initialLedgerBalance: number = 0.00
): ProofOfCash {
  const filtered = transactions.filter(t => t.currency === currency && (!bankCode || t.bankCode === bankCode));

  const bankTx = filtered.filter(t => t.source === 'BANK');
  const ledgerTx = filtered.filter(t => t.source === 'LEDGER');

  const inflowsBank = bankTx.filter(t => t.txType === 'CREDIT').reduce((acc, t) => acc + t.amountNominal, 0);
  const outflowsBank = bankTx.filter(t => t.txType === 'DEBIT').reduce((acc, t) => acc + t.amountNominal, 0);
  const finalBalanceBank = initialBankBalance + inflowsBank - outflowsBank;

  const inflowsLedger = ledgerTx.filter(t => t.txType === 'CREDIT').reduce((acc, t) => acc + t.amountNominal, 0);
  const outflowsLedger = ledgerTx.filter(t => t.txType === 'DEBIT').reduce((acc, t) => acc + t.amountNominal, 0);
  const finalBalanceLedger = initialLedgerBalance + inflowsLedger - outflowsLedger;

  // Reconciling items
  // Deposits in transit: Ledger credit (income) not yet in Bank statement
  const depositsInTransit = ledgerTx
    .filter(t => t.txType === 'CREDIT' && t.matchingStatus === 'UNMATCHED')
    .reduce((acc, t) => acc + t.amountNominal, 0);

  // Outstanding checks / pending debits in transit: Ledger debit (expense) not yet in Bank statement
  const outstandingChecks = ledgerTx
    .filter(t => t.txType === 'DEBIT' && t.matchingStatus === 'UNMATCHED')
    .reduce((acc, t) => acc + t.amountNominal, 0);

  // Unrecorded bank credits: Bank credit not yet recorded in books (e.g. direct transfers from clients, loan disbursements)
  const unrecordedCredits = bankTx
    .filter(t => t.txType === 'CREDIT' && t.matchingStatus === 'UNMATCHED')
    .reduce((acc, t) => acc + t.amountNominal, 0);

  // Unrecorded bank debits: Bank debit not yet recorded in books (e.g. maintenance fees, POS commissions, IGTF, SENIAT)
  const unrecordedDebits = bankTx
    .filter(t => t.txType === 'DEBIT' && t.matchingStatus === 'UNMATCHED')
    .reduce((acc, t) => acc + t.amountNominal, 0);

  // Reconciled Balances according to the Venezuelan Accounting Standard:
  // Reconciled Bank = Final Bank Balance + Deposits in Transit - Outstanding Checks
  const reconciledBank = finalBalanceBank + depositsInTransit - outstandingChecks;

  // Reconciled Ledger = Final Ledger Balance + Unrecorded Credits - Unrecorded Debits
  const reconciledLedger = finalBalanceLedger + unrecordedCredits - unrecordedDebits;

  const difference = Number((reconciledBank - reconciledLedger).toFixed(2));
  const isBalanced = Math.abs(difference) < 0.05;

  return {
    period: 'Octubre 2026',
    bankCode,
    currency,
    initialBalanceBank: initialBankBalance,
    inflowsBank,
    outflowsBank,
    finalBalanceBank,
    initialBalanceLedger: initialLedgerBalance,
    inflowsLedger,
    outflowsLedger,
    finalBalanceLedger,
    depositsInTransit,
    outstandingChecks,
    unrecordedCredits,
    unrecordedDebits,
    reconciledBank,
    reconciledLedger,
    difference,
    isBalanced
  };
}
