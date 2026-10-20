import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI } from '@google/genai';
import { FileImportResult, ParsedFileRow, detectBankCodeFromText } from './fileImportService';
import { TransactionSource } from '../types/accounting';
import { extractMetadataFromDescription } from './matchingEngine';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/build/pdf.worker.min.mjs`;
  }
}

const getGeminiApiKey = (): string | undefined => {
  return (
    (typeof localStorage !== 'undefined' && (localStorage.getItem('user_gemini_api_key') || localStorage.getItem('gemini_api_key'))) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    undefined
  );
};

// Spanish month map for Venezuelan statements (e.g. "15-ENE-26", "02-FEB-2026")
const SPANISH_MONTHS_MAP: Record<string, string> = {
  ENE: '01', ENERO: '01',
  FEB: '02', FEBRERO: '02',
  MAR: '03', MARZO: '03',
  ABR: '04', ABRIL: '04',
  MAY: '05', MAYO: '05',
  JUN: '06', JUNIO: '06',
  JUL: '07', JULIO: '07',
  AGO: '08', AGOSTO: '08',
  SEP: '09', SET: '09', SEPTIEMBRE: '09',
  OCT: '10', OCTUBRE: '10',
  NOV: '11', NOVIEMBRE: '11',
  DIC: '12', DICIEMBRE: '12'
};

/**
 * Robust Spanish & Numeric date parser
 * Handles:
 * - 02/01/2026, 02-01-2026, 02.01.2026
 * - 02/01/26, 02-01-26
 * - 02-ENE-2026, 02-ENE-26, 02-Ene-26, 02 ENE 26, 02/ENE/26
 * - 02-ENE, 02 ENE, 02/01
 */
export function parseSpanishDateToIso(str: string, fallbackYear: string = '2026'): string | null {
  if (!str) return null;
  const clean = str.trim().toUpperCase();

  // Pattern A: DD-MMM-YYYY or DD-MMM-YY or DD MMM YYYY or DD MMM YY
  const mmmMatch = clean.match(/^(\d{1,2})[-/\s]+([A-Z]{3,10})[-/\s]*(\d{2,4})?$/);
  if (mmmMatch) {
    const day = mmmMatch[1].padStart(2, '0');
    const monthName = mmmMatch[2].slice(0, 3);
    const month = SPANISH_MONTHS_MAP[monthName] || SPANISH_MONTHS_MAP[mmmMatch[2]];
    if (month) {
      let year = mmmMatch[3] ? mmmMatch[3] : fallbackYear;
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
  }

  // Pattern B: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or DD/MM/YY or DD/MM
  const numMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (numMatch) {
    const p1 = parseInt(numMatch[1], 10);
    const p2 = parseInt(numMatch[2], 10);

    // If YYYY/MM/DD
    if (numMatch[1].length === 4) {
      return `${numMatch[1]}-${numMatch[2].padStart(2, '0')}-${(numMatch[3] || '01').padStart(2, '0')}`;
    }

    if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12) {
      const day = numMatch[1].padStart(2, '0');
      const month = numMatch[2].padStart(2, '0');
      let year = numMatch[3] ? numMatch[3] : fallbackYear;
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

// Regex matching Venezuelan and International monetary amounts:
// e.g. 1.250.000,50 | 1250000,50 | 1.250,50 | 1250,50 | 85,00 | 1,250.50 | 1250.50 | -1.250,50 | 1.250,50-
export const AMOUNT_TOKEN_REGEX = /(?:[-+(])?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?:[-+)]|[CDcd])?/g;

// Regex matching dates anywhere in text
export const DATE_TOKEN_REGEX = /\b(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{2,4})?|\d{1,2}\s+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[a-z]*\s+(?:\d{2,4})?|\d{1,2}[-/.]\d{1,2})\b/gi;

/**
 * Parses numeric amount from Venezuelan format
 */
export function parsePdfAmount(raw: string): number {
  if (!raw) return 0;
  let str = raw.trim().replace(/[()\-+CDcd]/g, '').trim();

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

interface TextItemPosition {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface LineGroup {
  y: number;
  text: string;
  items: TextItemPosition[];
}

/**
 * Extracts positioned text lines across all pages with adaptive bounding-box grouping
 */
async function extractLinesFromPdf(file: File): Promise<{
  lines: LineGroup[];
  fullText: string;
  pageCount: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const allLines: LineGroup[] = [];
  let fullTextAcc = '';

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: TextItemPosition[] = [];
    for (const item of content.items) {
      if ('str' in item && typeof item.str === 'string' && item.str.trim() !== '') {
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0
        });
      }
    }

    // Sort all items on page by Y descending (top to bottom)
    items.sort((a, b) => b.y - a.y);

    // Adaptive bounding-box line clustering (tolerance 5.5pt)
    const lineBuckets: { minY: number; maxY: number; y: number; items: TextItemPosition[] }[] = [];

    for (const item of items) {
      let matchedBucket = lineBuckets.find(
        b => Math.abs(b.y - item.y) <= 5.5 || (item.y >= b.minY - 3.0 && item.y <= b.maxY + 3.0)
      );

      if (!matchedBucket) {
        matchedBucket = {
          minY: item.y,
          maxY: item.y,
          y: item.y,
          items: []
        };
        lineBuckets.push(matchedBucket);
      }

      matchedBucket.items.push(item);
      matchedBucket.minY = Math.min(matchedBucket.minY, item.y);
      matchedBucket.maxY = Math.max(matchedBucket.maxY, item.y);
      matchedBucket.y = (matchedBucket.minY + matchedBucket.maxY) / 2;
    }

    // Sort buckets from top to bottom
    lineBuckets.sort((a, b) => b.y - a.y);

    for (const bucket of lineBuckets) {
      // Sort items inside line from left to right
      bucket.items.sort((a, b) => a.x - b.x);

      let lineText = '';
      let prevEnd = -1;
      for (const item of bucket.items) {
        if (prevEnd >= 0) {
          const gap = item.x - prevEnd;
          if (gap > 12) {
            lineText += '   ';
          } else if (gap > 2) {
            lineText += ' ';
          }
        }
        lineText += item.str.trim();
        prevEnd = item.x + item.width;
      }

      if (lineText.trim()) {
        allLines.push({
          y: bucket.y,
          text: lineText.trim(),
          items: bucket.items
        });
        fullTextAcc += lineText.trim() + '\n';
      }
    }
  }

  return { lines: allLines, fullText: fullTextAcc, pageCount };
}

/**
 * Infers whether transaction is DEBIT or CREDIT from Venezuelan banking terminology
 */
export function inferTypeFromDescription(desc: string, source: TransactionSource): 'CREDIT' | 'DEBIT' {
  const upper = desc.toUpperCase();

  const isDebitIndicator =
    upper.includes('NOTA DE DEBITO') ||
    upper.includes('ND ') ||
    upper.includes('N.D') ||
    upper.includes('CARGO') ||
    upper.includes('COMISION') ||
    upper.includes('COMIS') ||
    upper.includes('IGTF') ||
    upper.includes('RETIRO') ||
    upper.includes('PAGO MOVIL A ') ||
    upper.includes('PAGO MOVIL ENVIADO') ||
    upper.includes('PAGO MOVIL EMITIDO') ||
    upper.includes('TRANSFERENCIA A ') ||
    upper.includes('TRANSFERENCIA ENVIADA') ||
    upper.includes('COMPRA EN ') ||
    upper.includes('COMPRA POS') ||
    upper.includes('CONSUMO') ||
    upper.includes('IMPUESTO') ||
    upper.includes('SENIAT') ||
    upper.includes('CHEQUE');

  const isCreditIndicator =
    upper.includes('NOTA DE CREDITO') ||
    upper.includes('NC ') ||
    upper.includes('N.C') ||
    upper.includes('ABONO') ||
    upper.includes('DEPOSITO') ||
    upper.includes('TRANSFERENCIA DE ') ||
    upper.includes('TRANSFERENCIA RECIBIDA') ||
    upper.includes('PAGO MOVIL DE ') ||
    upper.includes('PAGO MOVIL RECIBIDO') ||
    upper.includes('LOTE') ||
    upper.includes('VENTAS POS') ||
    upper.includes('LIQUIDACION POS') ||
    upper.includes('CREDICARD') ||
    upper.includes('INTERESES');

  if (isDebitIndicator && !isCreditIndicator) {
    return source === 'BANK' ? 'DEBIT' : 'CREDIT';
  }
  if (isCreditIndicator && !isDebitIndicator) {
    return source === 'BANK' ? 'CREDIT' : 'DEBIT';
  }

  return source === 'BANK' ? 'DEBIT' : 'CREDIT';
}

/**
 * Strategy 1: Line-by-Line Movement Parser with Multiline Continuation
 */
function parseByLines(
  lines: LineGroup[],
  statementYear: string,
  sourceType: TransactionSource,
  initialBal?: number
): ParsedFileRow[] {
  const parsedRows: ParsedFileRow[] = [];
  let runningBalance = initialBal;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    const upper = text.toUpperCase();

    // Skip general headers
    if (
      upper.includes('ESTADO DE CUENTA') ||
      upper.includes('MOVIMIENTOS DE LA CUENTA') ||
      upper.includes('RESUMEN DE CUENTA') ||
      (upper.includes('FECHA') && upper.includes('REFERENCIA') && (upper.includes('DESCRIP') || upper.includes('CONCEPTO') || upper.includes('CARGO') || upper.includes('DEBITO'))) ||
      upper.includes('SALDO ANTERIOR') ||
      upper.includes('TOTAL CARGOS') ||
      upper.includes('TOTAL ABONOS') ||
      upper.includes('TOTAL DEPOSITOS') ||
      (upper.includes('PAGINA') && upper.includes('DE'))
    ) {
      continue;
    }

    // Look for date in first 40 characters of line
    const startSegment = text.slice(0, 45);
    const dateMatch = startSegment.match(
      /\b(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{2,4})?|\d{1,2}\s+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[a-z]*\s+(?:\d{2,4})?|\d{1,2}[-/.]\d{1,2})\b/i
    );

    if (dateMatch) {
      const isoDate = parseSpanishDateToIso(dateMatch[0], statementYear);
      if (!isoDate) continue;

      const dateEndIdx = (dateMatch.index || 0) + dateMatch[0].length;
      let afterDate = text.slice(dateEndIdx).trim();

      // Find amounts on this line
      const amounts = Array.from(afterDate.matchAll(AMOUNT_TOKEN_REGEX)).map(m => parsePdfAmount(m[0]));

      if (amounts.length === 0) continue;

      // Extract reference: digits 5-12 or marked with REF/DOC
      let ref = '';
      const refMatch = afterDate.match(/(?:REF|DOC|SECUENCIA|TRF|OP)[:#]?\s*([A-Za-z0-9_-]{4,15})/i) ||
                       afterDate.match(/\b\d{5,12}\b/);
      if (refMatch) {
        ref = refMatch[1] || refMatch[0];
      } else {
        ref = `MOV-${parsedRows.length + 1}`;
      }

      // Collect Description: remove amounts, reference, and clean
      let desc = afterDate.replace(AMOUNT_TOKEN_REGEX, '').replace(ref, '').replace(/\s+/g, ' ').trim();

      // Look ahead for continuation lines (e.g. RIF, recipient bank on lines 2 and 3)
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].text.trim();
        const nextUpper = nextLine.toUpperCase();
        const nextDate = nextLine.slice(0, 40).match(
          /\b(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{2,4})?|\d{1,2}\s+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[a-z]*\s+(?:\d{2,4})?|\d{1,2}[-/.]\d{1,2})\b/i
        );
        const nextAmounts = Array.from(nextLine.matchAll(AMOUNT_TOKEN_REGEX));

        // If next line has its own date and amount, it's a new transaction
        if (nextDate && nextAmounts.length > 0) break;

        // Skip headers or totals
        if (
          nextUpper.includes('PAGINA') ||
          nextUpper.includes('TOTAL') ||
          nextUpper.includes('SALDO FINAL') ||
          nextUpper.includes('ESTADO DE CUENTA')
        ) {
          break;
        }

        // Continuation text
        if (nextLine.length > 3 && nextAmounts.length === 0) {
          desc += ' ' + nextLine;
          i = j;
        } else {
          break;
        }
        j++;
      }

      // Determine Amount, Transaction Type (CREDIT vs DEBIT), and Balance
      let txAmount = 0;
      let txType: 'CREDIT' | 'DEBIT' = 'DEBIT';
      let rowBalance: number | undefined = undefined;

      if (amounts.length >= 2) {
        rowBalance = amounts[amounts.length - 1];
        txAmount = amounts[amounts.length - 2];

        // Running balance verification
        if (runningBalance !== undefined && rowBalance !== undefined) {
          const diffToDebit = Math.abs((runningBalance - txAmount) - rowBalance);
          const diffToCredit = Math.abs((runningBalance + txAmount) - rowBalance);

          if (diffToDebit < 0.05) {
            txType = sourceType === 'BANK' ? 'DEBIT' : 'CREDIT';
          } else if (diffToCredit < 0.05) {
            txType = sourceType === 'BANK' ? 'CREDIT' : 'DEBIT';
          } else {
            txType = inferTypeFromDescription(desc, sourceType);
          }
        } else {
          txType = inferTypeFromDescription(desc, sourceType);
        }

        runningBalance = rowBalance;
      } else if (amounts.length === 1) {
        txAmount = amounts[0];
        txType = inferTypeFromDescription(desc, sourceType);

        if (runningBalance !== undefined) {
          runningBalance = txType === 'DEBIT' ? runningBalance - txAmount : runningBalance + txAmount;
        }
      }

      if (txAmount > 0) {
        const meta = extractMetadataFromDescription(desc);

        parsedRows.push({
          date: isoDate,
          reference: ref,
          description: desc.trim() || `Movimiento bancario ${isoDate}`,
          amount: txAmount,
          type: txType,
          balance: rowBalance,
          counterpartyRif: meta.rif
        });
      }
    }
  }

  return parsedRows;
}

/**
 * Strategy 2: Date-to-Date Stream Segmentation
 * Robust against any line-break variations across columns
 */
function parseByDateSegments(
  fullText: string,
  statementYear: string,
  sourceType: TransactionSource,
  initialBal?: number
): ParsedFileRow[] {
  const rows: ParsedFileRow[] = [];
  const matches: { rawDate: string; isoDate: string; index: number; endIndex: number }[] = [];

  DATE_TOKEN_REGEX.lastIndex = 0;
  let m;
  while ((m = DATE_TOKEN_REGEX.exec(fullText)) !== null) {
    const iso = parseSpanishDateToIso(m[0], statementYear);
    if (iso) {
      // Exclude period dates in headers (e.g. "PERIODO: 01/01/2026 AL 31/01/2026")
      const prefix = fullText.slice(Math.max(0, m.index - 30), m.index).toUpperCase();
      if (!prefix.includes('PERIODO') && !prefix.includes('DESDE') && !prefix.includes('HASTA') && !prefix.includes('EMISION')) {
        matches.push({
          rawDate: m[0],
          isoDate: iso,
          index: m.index,
          endIndex: m.index + m[0].length
        });
      }
    }
  }

  if (matches.length === 0) return [];

  let runningBalance = initialBal;

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    let segment = fullText.slice(current.endIndex, next ? next.index : fullText.length);

    // Cut off if reached summary / total at the end of statement
    const stopIdx = segment.search(/\b(TOTAL CARGOS|TOTAL ABONOS|TOTAL DEPOSITOS|SALDO FINAL|SALDO ACTUAL|RESUMEN DE CUENTA)\b/i);
    if (stopIdx >= 0) {
      segment = segment.slice(0, stopIdx);
    }

    // Extract all amounts in this segment
    const amounts = Array.from(segment.matchAll(AMOUNT_TOKEN_REGEX)).map(am => parsePdfAmount(am[0]));

    if (amounts.length === 0) continue;

    // Extract reference
    const refMatch = segment.match(/(?:REF|DOC|SECUENCIA|TRF|OP)[:#]?\s*([A-Za-z0-9_-]{4,15})/i) ||
                     segment.match(/\b\d{5,12}\b/);
    const ref = refMatch ? (refMatch[1] || refMatch[0]) : `MOV-${rows.length + 1}`;

    // Clean description
    let desc = segment
      .replace(AMOUNT_TOKEN_REGEX, '')
      .replace(ref, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.toUpperCase().includes('TOTAL') && !l.toUpperCase().includes('SALDO FINAL'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    let txAmount = 0;
    let txType: 'CREDIT' | 'DEBIT' = 'DEBIT';
    let rowBalance: number | undefined = undefined;

    if (amounts.length >= 2) {
      rowBalance = amounts[amounts.length - 1];
      txAmount = amounts[amounts.length - 2];

      if (runningBalance !== undefined && rowBalance !== undefined) {
        const diffToDebit = Math.abs((runningBalance - txAmount) - rowBalance);
        const diffToCredit = Math.abs((runningBalance + txAmount) - rowBalance);

        if (diffToDebit < 0.05) {
          txType = sourceType === 'BANK' ? 'DEBIT' : 'CREDIT';
        } else if (diffToCredit < 0.05) {
          txType = sourceType === 'BANK' ? 'CREDIT' : 'DEBIT';
        } else {
          txType = inferTypeFromDescription(desc, sourceType);
        }
      } else {
        txType = inferTypeFromDescription(desc, sourceType);
      }
      runningBalance = rowBalance;
    } else {
      txAmount = amounts[0];
      txType = inferTypeFromDescription(desc, sourceType);
      if (runningBalance !== undefined) {
        runningBalance = txType === 'DEBIT' ? runningBalance - txAmount : runningBalance + txAmount;
      }
    }

    if (txAmount > 0) {
      const meta = extractMetadataFromDescription(desc);

      rows.push({
        date: current.isoDate,
        reference: ref,
        description: desc.trim() || `Movimiento bancario ${current.isoDate}`,
        amount: txAmount,
        type: txType,
        balance: rowBalance,
        counterpartyRif: meta.rif
      });
    }
  }

  return rows;
}

/**
 * Strategy 4: Gemini Multimodal AI Parsing (for scanned images, protected or complex vector PDFs)
 */
async function parsePdfWithGeminiAi(
  file: File,
  fallbackBankCode: string,
  sourceType: TransactionSource
): Promise<FileImportResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: 'application/pdf'
              }
            },
            {
              text: `Eres un perito contable especialista en estados de cuenta bancarios venezolanos (Banesco, Banco de Venezuela, Mercantil, Bancamiga, BNC, Provincial).
Extrae TODOS los movimientos y transacciones que aparezcan en este estado de cuenta bancario.
Devuelve ÚNICAMENTE un objeto JSON estrictamente válido, sin markdown ni bloques de código, con este esquema exacto:
{
  "detectedBankCode": "0134",
  "detectedBankName": "Banesco Banco Universal",
  "detectedInitialBalance": 10000.00,
  "detectedFinalBalance": 35000.00,
  "rows": [
    {
      "date": "YYYY-MM-DD",
      "reference": "12345678",
      "description": "Concepto completo incluyendo RIF y beneficiario",
      "amount": 1250.50,
      "type": "DEBIT",
      "balance": 8749.50,
      "counterpartyRif": "J-123456780"
    }
  ]
}`
            }
          ]
        }
      ]
    });

    const textOutput = response.text || '';
    const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.rows && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
      const validRows: ParsedFileRow[] = parsed.rows.map((r: any) => ({
        date: r.date || new Date().toISOString().split('T')[0],
        reference: String(r.reference || ''),
        description: String(r.description || 'Movimiento bancario'),
        amount: Number(r.amount) || 0,
        type: r.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        balance: r.balance !== undefined ? Number(r.balance) : undefined,
        counterpartyRif: r.counterpartyRif
      })).filter((r: ParsedFileRow) => r.amount > 0);

      const totalCredits = validRows.filter(r => r.type === 'CREDIT').reduce((acc, r) => acc + r.amount, 0);
      const totalDebits = validRows.filter(r => r.type === 'DEBIT').reduce((acc, r) => acc + r.amount, 0);

      return {
        fileName: file.name,
        fileType: 'PDF',
        detectedBankCode: parsed.detectedBankCode || fallbackBankCode,
        detectedBankName: parsed.detectedBankName || 'Banco Universal',
        detectedInitialBalance: parsed.detectedInitialBalance,
        detectedFinalBalance: parsed.detectedFinalBalance || validRows[validRows.length - 1]?.balance,
        rows: validRows,
        totalCredits,
        totalDebits,
        summary: `Se procesaron exitosamente con IA ${validRows.length} movimientos de "${file.name}" para ${parsed.detectedBankName || 'Banesco'}. Total Créditos: ${totalCredits.toFixed(2)}, Total Débitos: ${totalDebits.toFixed(2)}.`
      };
    }
  } catch (err) {
    console.warn('Gemini PDF parser fallback attempt:', err);
  }

  return null;
}

/**
 * Main PDF parsing entry point for Venezuelan Bank Statements
 */
export async function parsePdfFile(
  file: File,
  fallbackBankCode: string = '0134',
  sourceType: TransactionSource = 'BANK'
): Promise<FileImportResult> {
  let lines: LineGroup[] = [];
  let fullText = '';
  let pageCount = 1;

  try {
    const res = await extractLinesFromPdf(file);
    lines = res.lines;
    fullText = res.fullText;
    pageCount = res.pageCount;
  } catch (err: any) {
    console.warn('PDF.js text extraction error:', err);
  }

  // Detect bank from text or file name
  const detectedBank = detectBankCodeFromText(fullText || file.name) || {
    code: fallbackBankCode,
    name: 'Banco Universal'
  };

  // Detect statement year
  let statementYear = new Date().getFullYear().toString();
  const yearMatch = fullText.match(/\b(202\d)\b/);
  if (yearMatch) {
    statementYear = yearMatch[1];
  }

  // Detect Initial and Final Balance from headers
  let detectedInitialBalance: number | undefined = undefined;
  let detectedFinalBalance: number | undefined = undefined;

  for (const line of lines) {
    const upper = line.text.toUpperCase();

    if (
      (upper.includes('SALDO ANTERIOR') || upper.includes('SALDO INICIAL') || upper.includes('SALDO AL INICIO') || upper.includes('BALANCE INICIAL')) &&
      detectedInitialBalance === undefined
    ) {
      const amounts = Array.from(line.text.matchAll(AMOUNT_TOKEN_REGEX));
      if (amounts.length > 0) {
        detectedInitialBalance = parsePdfAmount(amounts[amounts.length - 1][0]);
      }
    }

    if (
      (upper.includes('SALDO ACTUAL') || upper.includes('SALDO FINAL') || upper.includes('NUEVO SALDO') || upper.includes('BALANCE FINAL')) &&
      detectedFinalBalance === undefined
    ) {
      const amounts = Array.from(line.text.matchAll(AMOUNT_TOKEN_REGEX));
      if (amounts.length > 0) {
        detectedFinalBalance = parsePdfAmount(amounts[amounts.length - 1][0]);
      }
    }
  }

  let parsedRows: ParsedFileRow[] = [];

  // Strategy 1: Line-by-Line Movement Parser
  if (lines.length > 0) {
    parsedRows = parseByLines(lines, statementYear, sourceType, detectedInitialBalance);
  }

  // Strategy 2: Date-to-Date Stream Segmentation (if Strategy 1 got 0 rows)
  if (parsedRows.length === 0 && fullText.trim().length > 30) {
    parsedRows = parseByDateSegments(fullText, statementYear, sourceType, detectedInitialBalance);
  }

  // Strategy 3: Gemini Vision OCR Fallback (if PDF is scanned image, complex vector, or 0 rows)
  if (parsedRows.length === 0) {
    const geminiResult = await parsePdfWithGeminiAi(file, detectedBank.code, sourceType);
    if (geminiResult && geminiResult.rows.length > 0) {
      return geminiResult;
    }
  }

  // If still 0 rows, throw diagnostic message with helpful instructions
  if (parsedRows.length === 0) {
    const hasText = fullText.trim().length > 30;
    if (!hasText) {
      throw new Error(
        `El archivo "${file.name}" parece ser una imagen o escaneo sin capa de texto seleccionable (OCR).\n\n` +
        `Para solucionarlo:\n` +
        `1. Descarga el extracto digital nativo directamente desde Banesco Online (contiene texto digital directo).\n` +
        `2. O en tu banca en línea Banesco, elige la opción de descargar movimientos en formato Excel (.xlsx) o CSV y cárgalo directamente.\n` +
        `3. O usa el módulo "Asistente IA" para copiar y pegar el texto del estado de cuenta.`
      );
    }

    throw new Error(
      `No se pudieron detectar movimientos válidos en "${file.name}".\n\n` +
      `Sugerencias:\n` +
      `1. Verifica que el archivo sea un Estado de Cuenta emitido por el banco con fecha y montos.\n` +
      `2. Si está en formato Excel (.xlsx/.xls) o CSV, puedes cargarlo directamente desde el botón "Cargar Archivo Excel / CSV".\n` +
      `3. También puedes copiar el texto desde tu banca en línea y pegarlo en el "Asistente IA".`
    );
  }

  const totalCredits = parsedRows.filter(r => r.type === 'CREDIT').reduce((acc, r) => acc + r.amount, 0);
  const totalDebits = parsedRows.filter(r => r.type === 'DEBIT').reduce((acc, r) => acc + r.amount, 0);

  return {
    fileName: file.name,
    fileType: 'PDF',
    detectedBankCode: detectedBank.code,
    detectedBankName: detectedBank.name,
    detectedInitialBalance,
    detectedFinalBalance: detectedFinalBalance || parsedRows[parsedRows.length - 1]?.balance,
    rows: parsedRows,
    totalCredits,
    totalDebits,
    summary: `Se procesaron exitosamente ${parsedRows.length} movimientos de "${file.name}" para ${detectedBank.name} (${pageCount} páginas). Total Créditos: ${totalCredits.toFixed(2)}, Total Débitos: ${totalDebits.toFixed(2)}.`
  };
}

/**
 * Parses raw text copied directly from a PDF or online banking page,
 * WITHOUT requiring any header row (Fecha, Referencia, Descripción, Monto, Saldo).
 */
/**
 * Parses numeric amount with flexible decimals (-72.800,00 | -218,4 | -48 | 100.000,00 | -8)
 */
function parseFlexAmount(val: any): { amount: number; isNegative: boolean } {
  if (val === undefined || val === null || val === '') return { amount: 0, isNegative: false };
  const str = String(val).trim();
  const isNeg = str.startsWith('-') || str.endsWith('-') || (str.startsWith('(') && str.endsWith(')'));
  let clean = str.replace(/[()\-+]/g, '').trim();

  if (clean.includes('.') && clean.includes(',')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return { amount: isNaN(num) ? 0 : Math.abs(num), isNegative: isNeg };
}

/**
 * Parses raw text copied directly from a PDF or online banking page,
 * WITHOUT requiring any header row (Fecha, Referencia, Descripción, Monto, Saldo).
 * 100% Client-Side Pure JavaScript — Works Offline and on Netlify with Zero Configuration!
 */
export function parsePastedStatementText(
  rawText: string,
  fallbackBankCode: string = '0134',
  sourceType: TransactionSource = 'BANK'
): FileImportResult {
  const cleanText = rawText.trim();
  if (!cleanText) {
    throw new Error('El texto pegado está vacío. Copia los movimientos del extracto o PDF y pégalos aquí.');
  }

  // Detect bank from text
  const detectedBank = detectBankCodeFromText(cleanText) || {
    code: fallbackBankCode,
    name: 'Banesco Banco Universal'
  };

  // Detect year
  let statementYear = new Date().getFullYear().toString();
  const yearMatch = cleanText.match(/\b(202\d)\b/);
  if (yearMatch) {
    statementYear = yearMatch[1];
  }

  // Pre-process: split concatenated lines where a date was glued to previous balance
  // e.g. "123.754,2716/1/2026" -> "123.754,27\n16/1/2026"
  // e.g. "27.087,3723/1/2026" -> "27.087,37\n23/1/2026"
  let preprocessedText = cleanText
    .replace(/,(\d{2})(\d{1,2}\/\d{1,2}\/\d{4})/g, ',$1\n$2')
    .replace(/([^\s\n])(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/g, '$1\n$2')
    .replace(/([0-9.,]+)\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s+[A-Za-z0-9])/g, '$1\n$2');
  const rawLines = preprocessedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Detect initial balance if present in the text explicitly
  let detectedInitialBalance: number | undefined = undefined;
  const initialBalMatch = cleanText.match(/(?:SALDO\s+(?:ANTERIOR|INICIAL|AL\s+INICIO)|BALANCE\s+INICIAL)[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+(?:\.[0-9]{2})?)/i);
  if (initialBalMatch) {
    detectedInitialBalance = parseFlexAmount(initialBalMatch[1]).amount;
  }

  // High-precision Tabular Row Parser (e.g. "2/1/2026 53653663474 Banesco Pago Movil -72.800,00 26.571,65")
  const tabularRows: ParsedFileRow[] = [];

  for (const line of rawLines) {
    const upper = line.toUpperCase();
    if (
      upper.startsWith('FECHA REFERENCIA') ||
      upper.startsWith('FECHA\tREFERENCIA') ||
      upper.startsWith('DATE REFERENCE') ||
      (upper.includes('FECHA') && upper.includes('REFERENCIA') && upper.includes('MONTO'))
    ) {
      continue;
    }

    const dateMatch = line.match(/^(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{2,4})?|\d{1,2}\s+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[a-z]*\s+(?:\d{2,4})?|\d{1,2}[-/.]\d{1,2})\b/i);
    if (!dateMatch) continue;

    const isoDate = parseSpanishDateToIso(dateMatch[0], statementYear);
    if (!isoDate) continue;

    const afterDate = line.slice(dateMatch[0].length).trim();
    const tokens = afterDate.split(/\s+/);
    if (tokens.length < 2) continue;

    const lastToken = tokens[tokens.length - 1];
    const secondLastToken = tokens.length >= 3 ? tokens[tokens.length - 2] : null;

    const lastP = parseFlexAmount(lastToken);
    const secondLastP = secondLastToken ? parseFlexAmount(secondLastToken) : null;

    if (secondLastP && secondLastP.amount > 0 && lastP && lastP.amount > 0) {
      // Tabular: [Reference, ...Description, Amount, Balance]
      const ref = tokens[0];
      const desc = tokens.slice(1, -2).join(' ') || `Movimiento ${isoDate}`;
      const isDebit = secondLastP.isNegative || inferTypeFromDescription(desc, sourceType) === 'DEBIT';
      const meta = extractMetadataFromDescription(desc);

      tabularRows.push({
        date: isoDate,
        reference: ref,
        description: desc,
        amount: secondLastP.amount,
        type: isDebit ? 'DEBIT' : 'CREDIT',
        balance: lastP.amount,
        counterpartyRif: meta.rif
      });
    } else if (lastP && lastP.amount > 0) {
      // Tabular without balance: [Reference, ...Description, Amount]
      const ref = tokens[0];
      const desc = tokens.slice(1, -1).join(' ') || `Movimiento ${isoDate}`;
      const isDebit = lastP.isNegative || inferTypeFromDescription(desc, sourceType) === 'DEBIT';
      const meta = extractMetadataFromDescription(desc);

      tabularRows.push({
        date: isoDate,
        reference: ref,
        description: desc,
        amount: lastP.amount,
        type: isDebit ? 'DEBIT' : 'CREDIT',
        counterpartyRif: meta.rif
      });
    }
  }

  let parsedRows: ParsedFileRow[] = tabularRows;

  // Fallback 1: Flexible line by line
  if (parsedRows.length === 0) {
    const lines: LineGroup[] = rawLines.map((text, idx) => ({
      y: 1000 - idx * 15,
      text,
      items: []
    }));
    parsedRows = parseByLines(lines, statementYear, sourceType, detectedInitialBalance);
  }

  // Fallback 2: Date-to-date segmentation
  if (parsedRows.length === 0) {
    parsedRows = parseByDateSegments(preprocessedText, statementYear, sourceType, detectedInitialBalance);
  }

  if (parsedRows.length === 0) {
    throw new Error(
      'No se pudieron detectar movimientos con fecha y montos en el texto pegado.\n\n' +
      'Asegúrate de copiar las líneas de movimientos del estado de cuenta (por ejemplo: "02/01/2026 123456 PAGO MOVIL 1.500,00").\n' +
      'No necesitas incluir encabezados de Fecha, Descripción o Montos.'
    );
  }

  // Automatic calculation of initial balance from first movement if missing
  if (detectedInitialBalance === undefined && parsedRows.length > 0 && typeof parsedRows[0].balance === 'number') {
    const first = parsedRows[0];
    const bal = first.balance as number;
    detectedInitialBalance = first.type === 'DEBIT'
      ? Number((bal + first.amount).toFixed(2))
      : Number(Math.max(0, bal - first.amount).toFixed(2));
  }

  const totalCredits = parsedRows.filter(r => r.type === 'CREDIT').reduce((acc, r) => acc + r.amount, 0);
  const totalDebits = parsedRows.filter(r => r.type === 'DEBIT').reduce((acc, r) => acc + r.amount, 0);

  return {
    fileName: 'Texto Copiado del PDF',
    fileType: 'TXT',
    detectedBankCode: detectedBank.code,
    detectedBankName: detectedBank.name,
    detectedInitialBalance,
    detectedFinalBalance: parsedRows[parsedRows.length - 1]?.balance,
    rows: parsedRows,
    totalCredits,
    totalDebits,
    summary: `Se procesaron exitosamente ${parsedRows.length} movimientos pegados para ${detectedBank.name}. Total Créditos: ${totalCredits.toFixed(2)}, Total Débitos: ${totalDebits.toFixed(2)}.`
  };
}
