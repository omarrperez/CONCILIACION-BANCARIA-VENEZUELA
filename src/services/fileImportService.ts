import * as XLSX from 'xlsx';
import { BankTransaction, CurrencyType, TransactionSource } from '../types/accounting';
import { VENEZUELAN_BANKS } from '../data/venNifAccounts';
import { categorizeTransactionRuleBased } from './aiAccountant';
import { extractMetadataFromDescription } from './matchingEngine';

export interface ParsedFileRow {
  date: string;
  reference: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  balance?: number;
  accountCode?: string;
  accountName?: string;
  counterpartyRif?: string;
  counterpartyName?: string;
}

export interface FileImportResult {
  fileName: string;
  fileType: 'EXCEL' | 'CSV' | 'PDF' | 'TXT';
  detectedBankCode: string;
  detectedBankName: string;
  detectedInitialBalance?: number;
  detectedFinalBalance?: number;
  rows: ParsedFileRow[];
  totalCredits: number;
  totalDebits: number;
  summary: string;
}

/**
 * Normalizes date string into YYYY-MM-DD format
 */
function normalizeDateStr(d: any): string {
  if (!d) return new Date().toISOString().split('T')[0];

  // If Date object
  if (d instanceof Date) {
    return d.toISOString().split('T')[0];
  }

  const str = String(d).trim();

  // Excel serial date number
  if (/^\d{5}$/.test(str)) {
    const parsedDate = new Date((Number(str) - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parses numeric amount from various Venezuelan / International formats:
 * e.g. "1.234.567,89", "1,234.56", "(500,00)", "-150.00"
 */
function parseAmount(val: any): { amount: number; isNegative: boolean } {
  if (val === undefined || val === null || val === '') return { amount: 0, isNegative: false };
  if (typeof val === 'number') {
    return { amount: Math.abs(val), isNegative: val < 0 };
  }

  let str = String(val).trim();
  const isNegative = str.startsWith('-') || str.endsWith('-') || (str.startsWith('(') && str.endsWith(')'));
  str = str.replace(/[()\-+]/g, '').trim();

  // If contains both '.' and ','
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Venezuelan style: 1.250,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US style: 1,250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Single comma, e.g. "1250,50" -> "1250.50"
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return { amount: isNaN(num) ? 0 : num, isNegative };
}

/**
 * Attempts to detect Venezuelan Bank code from text or file contents
 */
export function detectBankCodeFromText(text: string): { code: string; name: string } {
  const upper = text.toUpperCase();
  if (upper.includes('BANESCO') || upper.includes('0134')) {
    return { code: '0134', name: 'Banesco Banco Universal' };
  }
  if (upper.includes('MERCANTIL') || upper.includes('0105')) {
    return { code: '0105', name: 'Banco Mercantil C.A.' };
  }
  if (upper.includes('VENEZUELA') || upper.includes('BDV') || upper.includes('0102')) {
    return { code: '0102', name: 'Banco de Venezuela S.A.' };
  }
  if (upper.includes('BNC') || upper.includes('NACIONAL DE CREDITO') || upper.includes('0191')) {
    return { code: '0191', name: 'Banco Nacional de Crédito BNC' };
  }
  if (upper.includes('BANCAMIGA') || upper.includes('0172')) {
    return { code: '0172', name: 'Bancamiga Banco Universal' };
  }
  if (upper.includes('PROVINCIAL') || upper.includes('BBVA') || upper.includes('0108')) {
    return { code: '0108', name: 'Banco Provincial BBVA' };
  }
  return { code: '0134', name: 'Banesco Banco Universal' };
}

/**
 * Parses Excel (.xlsx, .xls) files client-side into structured transactions
 */
export async function parseExcelFile(
  file: File,
  fallbackBankCode: string = '0134',
  sourceType: TransactionSource = 'BANK'
): Promise<FileImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to array of arrays
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Detect bank from sheet contents
  const textSample = rawRows.slice(0, 10).map(r => r.join(' ')).join(' ');
  const detectedBank = detectBankCodeFromText(textSample || file.name) || { code: fallbackBankCode, name: 'Banco Universal' };

  // Detect header row index
  let headerIndex = -1;
  let dateCol = -1;
  let refCol = -1;
  let descCol = -1;
  let debeCol = -1;
  let haberCol = -1;
  let amountCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i].map((c: any) => String(c).toUpperCase().trim());

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell.includes('FECHA') || cell.includes('DATE') || cell === 'F.') dateCol = c;
      if (cell.includes('REF') || cell.includes('DOC') || cell.includes('COMPROBANTE') || cell.includes('NUMERO') || cell.includes('NRO') || cell.includes('CHEQUE')) refCol = c;
      if (cell.includes('CONCEPTO') || cell.includes('DESCRIPCION') || cell.includes('DETALLE') || cell.includes('DESCRIP')) descCol = c;
      if (cell.includes('DEBE') || cell.includes('CARGO') || cell.includes('DEBITO') || cell.includes('EGRESO') || cell.includes('RETIRO')) debeCol = c;
      if (cell.includes('HABER') || cell.includes('ABONO') || cell.includes('CREDITO') || cell.includes('INGRESO') || cell.includes('DEPOSITO')) haberCol = c;
      if ((cell.includes('MONTO') || cell.includes('IMPORTE') || cell.includes('VALOR')) && debeCol === -1 && haberCol === -1) amountCol = c;
      if (cell.includes('SALDO') || cell.includes('BALANCE')) balanceCol = c;
    }

    if (dateCol !== -1 && (descCol !== -1 || refCol !== -1 || debeCol !== -1 || amountCol !== -1)) {
      headerIndex = i;
      break;
    }
  }

  // Detect initial balance from metadata rows if present
  let detectedInitialBalance: number | undefined = undefined;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const rowStr = rawRows[i].join(' ').toUpperCase();
    if (rowStr.includes('SALDO ANTERIOR') || rowStr.includes('SALDO INICIAL') || rowStr.includes('INITIAL BALANCE')) {
      for (const cell of rawRows[i]) {
        const { amount } = parseAmount(cell);
        if (amount > 0) {
          detectedInitialBalance = amount;
          break;
        }
      }
    }
  }

  const parsedRows: ParsedFileRow[] = [];
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((c: any) => !c || String(c).trim() === '')) continue;

    // Check if row has date or amount
    let dateVal = dateCol !== -1 ? row[dateCol] : row[0];
    let refVal = refCol !== -1 ? String(row[refCol]).trim() : '';
    let descVal = descCol !== -1 ? String(row[descCol]).trim() : '';
    let balanceVal = balanceCol !== -1 ? parseAmount(row[balanceCol]).amount : undefined;

    // Determine amount and type
    let amount = 0;
    let txType: 'CREDIT' | 'DEBIT' = 'DEBIT';

    if (debeCol !== -1 && haberCol !== -1) {
      const debe = parseAmount(row[debeCol]).amount;
      const haber = parseAmount(row[haberCol]).amount;

      if (debe > 0) {
        amount = debe;
        // In Bank: Debe = Cargo = Egreso (DEBIT). In Ledger: Debe = Ingreso/Aumento (CREDIT).
        txType = sourceType === 'BANK' ? 'DEBIT' : 'CREDIT';
      } else if (haber > 0) {
        amount = haber;
        txType = sourceType === 'BANK' ? 'CREDIT' : 'DEBIT';
      }
    } else if (amountCol !== -1) {
      const p = parseAmount(row[amountCol]);
      amount = p.amount;
      txType = p.isNegative ? 'DEBIT' : 'CREDIT';
    } else {
      // Scan for any number column
      for (let c = 0; c < row.length; c++) {
        if (c === dateCol || c === refCol) continue;
        const p = parseAmount(row[c]);
        if (p.amount > 0) {
          amount = p.amount;
          txType = p.isNegative ? 'DEBIT' : 'CREDIT';
          break;
        }
      }
    }

    if (amount <= 0) continue;

    // If description empty, find longest string cell
    if (!descVal) {
      const strings = row.filter((c: any) => typeof c === 'string' && c.length > 3 && isNaN(Number(c)));
      descVal = strings.join(' ') || `Transacción ${file.name}`;
    }

    // If reference empty, generate or look for digits
    if (!refVal) {
      const refMatch = descVal.match(/(?:REF|DOC|TRF|OP)[:#]?\s*([A-Za-z0-9_-]{4,15})/i) || descVal.match(/\b\d{5,12}\b/);
      refVal = refMatch ? refMatch[1] : `DOC-${i + 1}`;
    }

    const meta = extractMetadataFromDescription(descVal);

    parsedRows.push({
      date: normalizeDateStr(dateVal),
      reference: refVal,
      description: descVal,
      amount,
      type: txType,
      balance: balanceVal,
      counterpartyRif: meta.rif
    });
  }

  const totalCredits = parsedRows.filter(r => r.type === 'CREDIT').reduce((acc, r) => acc + r.amount, 0);
  const totalDebits = parsedRows.filter(r => r.type === 'DEBIT').reduce((acc, r) => acc + r.amount, 0);

  return {
    fileName: file.name,
    fileType: file.name.endsWith('.csv') ? 'CSV' : 'EXCEL',
    detectedBankCode: detectedBank.code,
    detectedBankName: detectedBank.name,
    detectedInitialBalance,
    detectedFinalBalance: parsedRows[parsedRows.length - 1]?.balance,
    rows: parsedRows,
    totalCredits,
    totalDebits,
    summary: `Se procesaron exitosamente ${parsedRows.length} movimientos de "${file.name}" para ${detectedBank.name}. Total Créditos: ${totalCredits.toFixed(2)}, Total Débitos: ${totalDebits.toFixed(2)}.`
  };
}

/**
 * Parses CSV and Plain Text statements client-side
 */
export async function parseCsvOrTextFile(
  file: File,
  fallbackBankCode: string = '0134',
  sourceType: TransactionSource = 'BANK'
): Promise<FileImportResult> {
  const text = await file.text();
  const detectedBank = detectBankCodeFromText(text || file.name) || { code: fallbackBankCode, name: 'Banco Universal' };

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const parsedRows: ParsedFileRow[] = [];

  // Try delimiter detection
  const firstLines = lines.slice(0, 5).join('\n');
  const delimiter = firstLines.includes('\t') ? '\t' : (firstLines.includes(';') ? ';' : ',');

  let detectedInitialBalance: number | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Check for initial balance line
    if (upper.includes('SALDO INICIAL') || upper.includes('SALDO ANTERIOR') || upper.includes('INITIAL BALANCE')) {
      const match = line.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/);
      if (match) {
        detectedInitialBalance = parseAmount(match[1]).amount;
      }
      continue;
    }

    if (upper.includes('FECHA') && (upper.includes('REFERENCIA') || upper.includes('CONCEPTO') || upper.includes('DEBE'))) {
      continue;
    }

    const tokens = line.split(delimiter).map(t => t.replace(/^["']|["']$/g, '').trim());

    // Extract Date
    const dateMatch = line.match(/\b(\d{2}[-/.]\d{2}[-/.]\d{2,4})\b/) ||
      line.match(/\b(\d{4}[-/.]\d{2}[-/.]\d{2})\b/);
    if (!dateMatch && tokens.length < 3) continue;

    const txDate = dateMatch ? normalizeDateStr(dateMatch[1]) : new Date().toISOString().split('T')[0];

    // Extract Reference
    const refMatch = line.match(/(?:REF|DOC|TRF|OP|CHQ|NC|ND)[:#]?\s*([A-Za-z0-9_-]{4,15})/i) || line.match(/\b\d{5,12}\b/);
    const ref = refMatch ? refMatch[1] : `DOC-${i + 1}`;

    // Extract Amount and Type
    const amountMatches = Array.from(line.matchAll(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g));
    if (amountMatches.length === 0) continue;

    let amount = 0;
    let txType: 'CREDIT' | 'DEBIT' = 'DEBIT';

    if (tokens.length >= 4) {
      // Tabular structure: find if there are Debe & Haber columns
      const num1 = parseAmount(tokens[tokens.length - 2]).amount;
      const num2 = parseAmount(tokens[tokens.length - 1]).amount;

      if (num1 > 0 && num2 === 0) {
        amount = num1;
        txType = sourceType === 'BANK' ? 'DEBIT' : 'CREDIT';
      } else if (num2 > 0) {
        amount = num2;
        txType = sourceType === 'BANK' ? 'CREDIT' : 'DEBIT';
      } else {
        const p = parseAmount(amountMatches[amountMatches.length - 1][1]);
        amount = p.amount;
        txType = upper.includes('DEBITO') || upper.includes('CARGO') || upper.includes('RETIRO') || upper.includes('COMISION') ? 'DEBIT' : 'CREDIT';
      }
    } else {
      const p = parseAmount(amountMatches[amountMatches.length - 1][1]);
      amount = p.amount;
      txType = upper.includes('DEBITO') || upper.includes('CARGO') || upper.includes('RETIRO') || upper.includes('COMISION') ? 'DEBIT' : 'CREDIT';
    }

    if (amount <= 0) continue;

    const meta = extractMetadataFromDescription(line);

    parsedRows.push({
      date: txDate,
      reference: ref,
      description: line.slice(0, 120),
      amount,
      type: txType,
      counterpartyRif: meta.rif
    });
  }

  const totalCredits = parsedRows.filter(r => r.type === 'CREDIT').reduce((acc, r) => acc + r.amount, 0);
  const totalDebits = parsedRows.filter(r => r.type === 'DEBIT').reduce((acc, r) => acc + r.amount, 0);

  return {
    fileName: file.name,
    fileType: file.name.endsWith('.csv') ? 'CSV' : 'TXT',
    detectedBankCode: detectedBank.code,
    detectedBankName: detectedBank.name,
    detectedInitialBalance,
    rows: parsedRows,
    totalCredits,
    totalDebits,
    summary: `Se procesaron ${parsedRows.length} movimientos desde archivo de texto/CSV.`
  };
}

/**
 * Converts FileImportResult rows into structured BankTransaction objects
 */
export function convertImportResultToTransactions(
  result: FileImportResult,
  source: TransactionSource,
  bankCode: string,
  currency: CurrencyType,
  bcvRate: number
): BankTransaction[] {
  const bankObj = VENEZUELAN_BANKS.find(b => b.code === bankCode) || {
    code: bankCode,
    name: result.detectedBankName || 'Banco Universal'
  };

  return result.rows.map((row, idx) => {
    const rule = categorizeTransactionRuleBased(
      row.description,
      row.amount,
      row.type,
      currency,
      bankObj.name
    );

    const amountVes = currency === 'USD' ? row.amount * bcvRate : row.amount;
    const amountUsdEquivalent = currency === 'USD' ? row.amount : (bcvRate > 0 ? Number((row.amount / bcvRate).toFixed(2)) : row.amount);
    const referenceLast4 = row.reference ? row.reference.replace(/\D/g, '').slice(-4) : '';

    return {
      id: `${source === 'BANK' ? 'bnk' : 'led'}-file-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      source,
      bankCode: bankObj.code,
      bankName: bankObj.name,
      referenceNum: row.reference,
      referenceLast4,
      txDate: row.date,
      txType: row.type,
      amountNominal: row.amount,
      currency,
      bcvRate,
      amountVes,
      amountUsdEquivalent,
      rawDescription: row.description,
      counterpartyRif: row.counterpartyRif,
      counterpartyName: row.counterpartyName,
      accountCode: rule.accountCode,
      accountName: rule.accountName,
      matchingStatus: 'UNMATCHED',
      moduleTag: rule.moduleTag,
      notes: `Importado desde archivo ${result.fileName}`,
      createdAt: new Date().toISOString()
    };
  });
}

export { parsePdfFile, parsePastedStatementText } from './pdfImportService';
