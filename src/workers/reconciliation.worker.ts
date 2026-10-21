import { BankTransaction } from '../types/accounting';

interface WorkerMessageData {
  type: 'START_RECONCILIATION';
  payload: {
    transactions: BankTransaction[];
    toleranceDays: number;
  };
}

export interface WorkerProgressMessage {
  type: 'PROGRESS';
  payload: {
    progress: number;
    stageName: string;
    exactCount: number;
    fuzzyCount: number;
    discrepancyCount: number;
  };
}

export interface WorkerCompleteMessage {
  type: 'COMPLETE';
  payload: {
    updatedTransactions: BankTransaction[];
    exactMatchesCount: number;
    fuzzyMatchesCount: number;
    discrepanciesCount: number;
  };
}

export interface WorkerErrorMessage {
  type: 'ERROR';
  payload: {
    message: string;
  };
}

// Lista de palabras vacías (stopwords) bancarias y contables venezolanas
const BANKING_STOPWORDS = new Set([
  'banco', 'bancario', 'cuenta', 'cta', 'transferencia', 'trf', 'tfr', 'traspaso', 'pago', 'pagos',
  'debito', 'deb', 'credito', 'crd', 'abono', 'cargo', 'cheque', 'chq', 'deposito', 'dep',
  'comprobante', 'comp', 'ref', 'referencia', 'asiento', 'factura', 'fac', 'fact', 'recibo',
  'nota', 'de', 'del', 'la', 'las', 'el', 'los', 'en', 'por', 'para', 'con', 'sin', 'sobre',
  'c.a.', 'ca', 's.a.', 'sa', 's.r.l.', 'srl', 'una', 'uno', 'unos', 'unas', 'al', 'a',
  'tercero', 'terceros', 'bancaria', 'operacion', 'transaccion', 'movil', 'c2p', 'p2p', 'p2c'
]);

export interface DescriptionTokensData {
  tokens: string[];
  rifs: string[];
  numbers: string[];
}

function extractDescriptionTokens(desc?: string | null): DescriptionTokensData {
  if (!desc) return { tokens: [], rifs: [], numbers: [] };
  const str = String(desc).toUpperCase();

  const rifs: string[] = [];
  const rifMatches = str.match(/\b([JVGE])-?(\d{7,9})-?(\d?)\b/g);
  if (rifMatches) {
    rifMatches.forEach(r => rifs.push(r.replace(/[^A-Z0-9]/g, '')));
  }

  const numbers: string[] = [];
  const numMatches = str.match(/\b\d{4,12}\b/g);
  if (numMatches) {
    numMatches.forEach(n => numbers.push(n));
  }

  const tokens = str
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 3 && !BANKING_STOPWORDS.has(w));

  return { tokens, rifs, numbers };
}

function calculateDescriptionSimilarity(
  d1?: string | null,
  d2?: string | null
): { score: number; reason: string } {
  if (!d1 || !d2) return { score: 0.0, reason: '' };

  const meta1 = extractDescriptionTokens(d1);
  const meta2 = extractDescriptionTokens(d2);

  for (const r1 of meta1.rifs) {
    if (meta2.rifs.includes(r1)) {
      return { score: 0.98, reason: `RIF común ${r1}` };
    }
  }

  for (const n1 of meta1.numbers) {
    if (meta2.numbers.includes(n1)) {
      return { score: 0.95, reason: `N° Doc ${n1}` };
    }
  }

  const set2 = new Set(meta2.tokens);
  const common = meta1.tokens.filter(t => set2.has(t));

  if (common.length >= 2) {
    return { score: 0.92, reason: `Conceptos: ${common.slice(0, 3).join(', ')}` };
  }

  if (common.length === 1 && common[0].length >= 4) {
    return { score: 0.88, reason: `Concepto: ${common[0]}` };
  }

  const clean1 = meta1.tokens.join(' ');
  const clean2 = meta2.tokens.join(' ');
  if (clean1.length >= 5 && clean2.includes(clean1)) {
    return { score: 0.90, reason: `Frase: ${clean1}` };
  }
  if (clean2.length >= 5 && clean1.includes(clean2)) {
    return { score: 0.90, reason: `Frase: ${clean2}` };
  }

  const jwScore = jaroWinkler(clean1 || d1, clean2 || d2);
  if (jwScore >= 0.65) {
    return { score: Number(jwScore.toFixed(2)), reason: `Similitud concepto ${(jwScore * 100).toFixed(0)}%` };
  }

  return { score: 0.0, reason: '' };
}

/**
 * Normaliza y limpia una referencia bancaria para pareo determinístico
 */
function cleanReference(ref?: string | null): string {
  if (!ref) return '';
  return String(ref).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Algoritmo de similitud de cadenas Jaro-Winkler ultra-optimizado
 */
function jaroWinkler(s1?: string | null, s2?: string | null): number {
  if (!s1 || !s2) return 0.0;
  const str1 = String(s1).toLowerCase().trim().slice(0, 100);
  const str2 = String(s2).toLowerCase().trim().slice(0, 100);

  if (str1 === str2) return 1.0;
  if (!str1.length || !str2.length) return 0.0;

  const matchDistance = Math.max(0, Math.floor(Math.max(str1.length, str2.length) / 2) - 1);
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
      while (k < str2Matches.length && !str2Matches[k]) {
        k++;
      }
      if (k < str2Matches.length) {
        if (str1[i] !== str2[k]) transpositions++;
        k++;
      }
    }
  }

  const jaro = (matches / str1.length + matches / str2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  const score = jaro + prefix * 0.1 * (1 - jaro);
  return Math.min(1.0, Math.max(0.0, score));
}

// Escuchar mensajes del hilo principal
self.onmessage = (event: MessageEvent<WorkerMessageData>) => {
  const { type, payload } = event.data;

  if (type === 'START_RECONCILIATION') {
    try {
      const { transactions, toleranceDays = 3 } = payload;

      if (!transactions || transactions.length === 0) {
        self.postMessage({
          type: 'COMPLETE',
          payload: {
            updatedTransactions: [],
            exactMatchesCount: 0,
            fuzzyMatchesCount: 0,
            discrepanciesCount: 0
          }
        });
        return;
      }

      const updated: BankTransaction[] = transactions.map(t => ({ ...t }));
      const idToIndexMap = new Map<string, number>();
      for (let idx = 0; idx < updated.length; idx++) {
        idToIndexMap.set(updated[idx].id, idx);
      }

      let exactMatchesCount = 0;
      let fuzzyMatchesCount = 0;
      let discrepanciesCount = 0;

      const bankItems = updated.filter(t => t.source === 'BANK');
      const ledgerItems = updated.filter(t => t.source === 'LEDGER');

      const matchedLedgerIds = new Set<string>();
      const matchedBankIds = new Set<string>();

      for (const t of updated) {
        if (t.matchingStatus === 'MATCHED_EXACT' && t.matchedWithId) {
          if (t.source === 'LEDGER') matchedLedgerIds.add(t.id);
          if (t.source === 'BANK') matchedBankIds.add(t.id);
        }
      }

      const dateCache = new Map<string, number>();
      function getTimestamp(dStr?: string): number {
        if (!dStr) return 0;
        let cached = dateCache.get(dStr);
        if (cached !== undefined) return cached;
        const ts = new Date(dStr).getTime();
        const val = isNaN(ts) ? 0 : ts;
        dateCache.set(dStr, val);
        return val;
      }

      // Notificar inicio
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          progress: 10,
          stageName: 'Indexando referencias bancarias...',
          exactCount: 0,
          fuzzyCount: 0,
          discrepancyCount: 0
        }
      });

      // 1. Indexar Ledger por referencia completa y numérica
      const ledgerByRefMap = new Map<string, BankTransaction[]>();
      for (const led of ledgerItems) {
        if (matchedLedgerIds.has(led.id)) continue;
        const cleanRef = cleanReference(led.referenceNum);
        if (cleanRef && cleanRef.length >= 3) {
          const keyFull = `${led.bankCode || ''}_${led.currency}_${cleanRef}`;
          const existing = ledgerByRefMap.get(keyFull) || [];
          existing.push(led);
          ledgerByRefMap.set(keyFull, existing);

          const digitsOnly = cleanRef.replace(/\D/g, '');
          if (digitsOnly && digitsOnly.length >= 4 && digitsOnly !== cleanRef) {
            const keyDigits = `${led.bankCode || ''}_${led.currency}_#${digitsOnly}`;
            const existingDigits = ledgerByRefMap.get(keyDigits) || [];
            existingDigits.push(led);
            ledgerByRefMap.set(keyDigits, existingDigits);
          }
        }
      }

      // 2. ETAPA 1 & 2: Pareo Exacto
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          progress: 25,
          stageName: 'Ejecutando cruce exacto por referencia...',
          exactCount: exactMatchesCount,
          fuzzyCount: 0,
          discrepancyCount: 0
        }
      });

      for (const bnk of bankItems) {
        if (matchedBankIds.has(bnk.id) || bnk.matchingStatus === 'MATCHED_EXACT') continue;

        const bnkRef = cleanReference(bnk.referenceNum);
        if (!bnkRef || bnkRef.length < 3) continue;

        const key = `${bnk.bankCode || ''}_${bnk.currency}_${bnkRef}`;
        const bnkDigits = bnkRef.replace(/\D/g, '');
        const keyDigits = bnkDigits.length >= 4 ? `${bnk.bankCode || ''}_${bnk.currency}_#${bnkDigits}` : '';

        let candidates = ledgerByRefMap.get(key);
        if ((!candidates || candidates.length === 0) && keyDigits) {
          candidates = ledgerByRefMap.get(keyDigits);
        }
        if (!candidates || candidates.length === 0) continue;

        const bnkTs = getTimestamp(bnk.txDate);

        for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
          const led = candidates[cIdx];
          if (matchedLedgerIds.has(led.id)) continue;

          const diffDays = bnkTs && getTimestamp(led.txDate)
            ? Math.abs(bnkTs - getTimestamp(led.txDate)) / (1000 * 60 * 60 * 24)
            : 0;

          if (Math.abs(bnk.amountNominal - led.amountNominal) < 0.01 && diffDays <= toleranceDays) {
            matchedLedgerIds.add(led.id);
            matchedBankIds.add(bnk.id);
            exactMatchesCount++;

            const bnkIdx = idToIndexMap.get(bnk.id);
            const ledIdx = idToIndexMap.get(led.id);

            if (bnkIdx !== undefined) {
              updated[bnkIdx] = {
                ...updated[bnkIdx],
                matchingStatus: 'MATCHED_EXACT',
                matchedWithId: led.id,
                matchScore: 1.0,
                discrepancyAmount: 0
              };
            }

            if (ledIdx !== undefined) {
              updated[ledIdx] = {
                ...updated[ledIdx],
                matchingStatus: 'MATCHED_EXACT',
                matchedWithId: bnk.id,
                matchScore: 1.0,
                discrepancyAmount: 0
              };
            }

            candidates.splice(cIdx, 1);
            break;
          }
        }
      }

      // 3. ETAPA 3: Similitud Semántica de Concepto
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          progress: 60,
          stageName: 'Analizando similitud semántica de conceptos...',
          exactCount: exactMatchesCount,
          fuzzyCount: fuzzyMatchesCount,
          discrepancyCount: 0
        }
      });

      const ledgerByAmountMap = new Map<string, BankTransaction[]>();
      for (const led of ledgerItems) {
        if (matchedLedgerIds.has(led.id)) continue;
        const amtKey = `${led.bankCode || ''}_${led.currency}_${led.amountNominal.toFixed(2)}`;
        const list = ledgerByAmountMap.get(amtKey) || [];
        list.push(led);
        ledgerByAmountMap.set(amtKey, list);
      }

      for (const bnk of bankItems) {
        if (matchedBankIds.has(bnk.id) || bnk.matchingStatus === 'MATCHED_EXACT') continue;

        const amtKey = `${bnk.bankCode || ''}_${bnk.currency}_${bnk.amountNominal.toFixed(2)}`;
        const candidates = ledgerByAmountMap.get(amtKey);
        if (!candidates || candidates.length === 0) continue;

        const bnkTs = getTimestamp(bnk.txDate);
        let bestMatch: BankTransaction | null = null;
        let bestMatchIdx = -1;
        let bestScore = 0;
        let bestReason = '';

        for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
          const led = candidates[cIdx];
          if (matchedLedgerIds.has(led.id)) continue;

          const diffDays = bnkTs && getTimestamp(led.txDate)
            ? Math.abs(bnkTs - getTimestamp(led.txDate)) / (1000 * 60 * 60 * 24)
            : 0;

          if (diffDays > toleranceDays + 2) continue;

          const { score, reason } = calculateDescriptionSimilarity(bnk.rawDescription, led.rawDescription);
          if (score >= 0.65 && score > bestScore) {
            bestScore = score;
            bestMatch = led;
            bestMatchIdx = cIdx;
            bestReason = reason;
          }
        }

        if (bestMatch && bestMatchIdx >= 0) {
          matchedLedgerIds.add(bestMatch.id);
          matchedBankIds.add(bnk.id);

          const isHighConfidence = bestScore >= 0.90;
          if (isHighConfidence) {
            exactMatchesCount++;
          } else {
            fuzzyMatchesCount++;
          }

          const bnkIdx = idToIndexMap.get(bnk.id);
          const ledIdx = idToIndexMap.get(bestMatch.id);

          const status = isHighConfidence ? 'MATCHED_EXACT' : 'MATCHED_FUZZY';
          const matchNote = bestReason ? `Conciliado por Monto y Concepto (${bestReason})` : 'Conciliado por similitud de concepto';

          if (bnkIdx !== undefined) {
            updated[bnkIdx] = {
              ...updated[bnkIdx],
              matchingStatus: status,
              matchedWithId: bestMatch.id,
              matchScore: Number(bestScore.toFixed(2)),
              discrepancyAmount: 0,
              notes: updated[bnkIdx].notes ? `${updated[bnkIdx].notes} | ${matchNote}` : matchNote
            };
          }

          if (ledIdx !== undefined) {
            updated[ledIdx] = {
              ...updated[ledIdx],
              matchingStatus: status,
              matchedWithId: bnk.id,
              matchScore: Number(bestScore.toFixed(2)),
              discrepancyAmount: 0,
              notes: updated[ledIdx].notes ? `${updated[ledIdx].notes} | ${matchNote}` : matchNote
            };
          }

          candidates.splice(bestMatchIdx, 1);
        }
      }

      // 4. ETAPA 4: Discrepancias de Monto
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          progress: 85,
          stageName: 'Detectando variaciones de comisiones e impuestos...',
          exactCount: exactMatchesCount,
          fuzzyCount: fuzzyMatchesCount,
          discrepancyCount: discrepanciesCount
        }
      });

      for (const bnk of bankItems) {
        if (matchedBankIds.has(bnk.id) || bnk.matchingStatus === 'MATCHED_EXACT' || bnk.matchingStatus === 'MATCHED_FUZZY') {
          continue;
        }

        const bnkRef = cleanReference(bnk.referenceNum);
        const bnkTs = getTimestamp(bnk.txDate);

        for (const led of ledgerItems) {
          if (matchedLedgerIds.has(led.id)) continue;
          if (bnk.bankCode && led.bankCode && bnk.bankCode !== led.bankCode) continue;
          if (bnk.currency !== led.currency) continue;

          const ledRef = cleanReference(led.referenceNum);

          const isRefMatch = (bnkRef.length >= 4 && ledRef.length >= 4) && (
            bnkRef === ledRef || 
            (bnkRef.length >= 6 && ledRef.length >= 6 && (bnkRef.endsWith(ledRef.slice(-6)) || ledRef.endsWith(bnkRef.slice(-6))))
          );

          const sim = calculateDescriptionSimilarity(bnk.rawDescription, led.rawDescription);
          const isConceptMatch = sim.score >= 0.70;

          if (!isRefMatch && !isConceptMatch) continue;

          const diffDays = bnkTs && getTimestamp(led.txDate)
            ? Math.abs(bnkTs - getTimestamp(led.txDate)) / (1000 * 60 * 60 * 24)
            : 0;

          if (diffDays <= toleranceDays) {
            const delta = bnk.amountNominal - led.amountNominal;
            if (Math.abs(delta) >= 0.01) {
              matchedLedgerIds.add(led.id);
              matchedBankIds.add(bnk.id);
              discrepanciesCount++;

              const bnkIdx = idToIndexMap.get(bnk.id);
              const ledIdx = idToIndexMap.get(led.id);

              const discNote = isConceptMatch
                ? `Diferencia de monto con concepto común (${sim.reason})`
                : `Diferencia de monto con misma referencia`;

              if (bnkIdx !== undefined) {
                updated[bnkIdx] = {
                  ...updated[bnkIdx],
                  matchingStatus: 'DISCREPANCY',
                  matchedWithId: led.id,
                  discrepancyAmount: delta,
                  notes: updated[bnkIdx].notes ? `${updated[bnkIdx].notes} | ${discNote}` : discNote
                };
              }

              if (ledIdx !== undefined) {
                updated[ledIdx] = {
                  ...updated[ledIdx],
                  matchingStatus: 'DISCREPANCY',
                  matchedWithId: bnk.id,
                  discrepancyAmount: -delta,
                  notes: updated[ledIdx].notes ? `${updated[ledIdx].notes} | ${discNote}` : discNote
                };
              }

              break;
            }
          }
        }
      }

      // Notificar completitud
      self.postMessage({
        type: 'COMPLETE',
        payload: {
          updatedTransactions: updated,
          exactMatchesCount,
          fuzzyMatchesCount,
          discrepanciesCount
        }
      });
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        payload: {
          message: err?.message || 'Error desconocido en el Worker de conciliación.'
        }
      });
    }
  }
};
