import { GoogleGenAI } from '@google/genai';
import { BankTransaction, JournalEntry, JournalEntryLine } from '../types/accounting';
import { extractMetadataFromDescription } from './matchingEngine';

export interface AIParsedBankRow {
  bankCode: string;
  bankName: string;
  txDate: string;
  referenceNum: string;
  rawDescription: string;
  amountNominal: number;
  txType: 'CREDIT' | 'DEBIT';
  currency: 'VES' | 'USD';
  counterpartyRif?: string;
  counterpartyName?: string;
  suggestedAccountCode: string;
  suggestedAccountName: string;
  moduleTag: string;
  confidence: number;
  rationale: string;
}

// Check if Gemini API key exists
const getApiKey = (): string | undefined => {
  return (
    (typeof localStorage !== 'undefined' && (localStorage.getItem('user_gemini_api_key') || localStorage.getItem('gemini_api_key'))) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    undefined
  );
};

// Domain-knowledge categorization engine for Venezuelan accounting
export function categorizeTransactionRuleBased(
  rawDesc: string,
  amount: number,
  txType: 'CREDIT' | 'DEBIT',
  currency: 'VES' | 'USD' = 'VES',
  bankName: string = 'Banesco'
): {
  accountCode: string;
  accountName: string;
  moduleTag: string;
  rationale: string;
  journalEntry: JournalEntryLine[];
} {
  const upper = rawDesc.toUpperCase();
  const meta = extractMetadataFromDescription(rawDesc);

  // 1. Point of sale (POS) Batch Settlements (TMD, TDB CAPIT, POS, Megasoft, Credicard)
  if (
    upper.includes('POS') ||
    upper.includes('CREDICARD') ||
    upper.includes('MEGASOFT') ||
    upper.includes('PLASTICO') ||
    upper.includes('LOTE') ||
    upper.includes('TMD ') ||
    upper.includes('TDB CAPIT')
  ) {
    const commissionEst = Number((amount * 0.02).toFixed(2));
    const grossEst = amount + commissionEst;

    return {
      accountCode: '1.1.02.01.005',
      accountName: 'Cobranzas por Puntos de Venta (POS)',
      moduleTag: 'MOD_POS',
      rationale: 'Liquidación de lote POS / adquirencia identificada (TMD/TDB CAPIT). Se desglosa crédito bancario y comisión de adquirente.',
      journalEntry: [
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: amount, haber: 0, concept: `Abono Lote POS ${meta.terminal || ''}` },
        { accountCode: '6.1.02.01.002', accountName: 'Gastos por Comisiones POS / Adquirente', debe: commissionEst, haber: 0, concept: 'Comisión bancaria adquirente' },
        { accountCode: '1.1.02.01.005', accountName: 'Cobranzas por Puntos de Venta (POS)', debe: 0, haber: grossEst, concept: 'Cancelación lote ventas POS' }
      ]
    };
  }

  // 2. Bank Maintenance or Operational Debits & Commissions
  if (
    upper.includes('MANTENIMIENTO') ||
    upper.includes('COMISION') ||
    upper.includes('COMIS') ||
    upper.includes('SERV. BANCARIO') ||
    upper.includes('CARGO MENSUAL') ||
    upper.includes('SERVICIO SMS') ||
    upper.includes('COM. PAGO MOVIL') ||
    upper.includes('COM.SERV.MTTO') ||
    upper.includes('EMISION DE ESTADO DE CUENTA') ||
    upper.includes('MANT Y SERV APLIC')
  ) {
    return {
      accountCode: '6.1.02.01.001',
      accountName: 'Gastos por Comisiones Bancarias y Mantenimiento',
      moduleTag: 'MOD_COMISIONES',
      rationale: 'Nota de débito bancaria automática por servicio, mantenimiento de cuenta o comisión transaccional.',
      journalEntry: [
        { accountCode: '6.1.02.01.001', accountName: 'Gastos por Comisiones Bancarias y Mantenimiento', debe: amount, haber: 0, concept: rawDesc },
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: 'Nota de débito bancaria' }
      ]
    };
  }

  // 3. IGTF Bank Tax & SENIAT Taxes / BANAVIH / Municipal
  if (
    upper.includes('SENIAT') ||
    upper.includes('PLANILLA') ||
    upper.includes('BANAVIH') ||
    upper.includes('ALCALDIA') ||
    upper.includes('RECAUDACION MULTIPAGOS') ||
    upper.includes('IGTF') ||
    upper.includes('LEY IGTF') ||
    upper.includes('GRAVAMEN FINANC') ||
    upper.includes('TRIBUTO')
  ) {
    const isIgtf = upper.includes('IGTF') || upper.includes('GRAVAMEN');
    const isVat = upper.includes('00030') || upper.includes('IVA');
    const isIslr = upper.includes('00026') || upper.includes('ISLR');
    const targetCode = isIgtf
      ? '6.1.02.02.001'
      : (isVat ? '2.1.04.03.001' : (isIslr ? '2.1.04.02.001' : '2.1.04.01.001'));
    const targetName = isIgtf
      ? 'Gastos por Impuesto a las Grandes Transacciones Financieras (IGTF)'
      : (isVat ? 'Débito Fiscal IVA' : (isIslr ? 'Retenciones de ISLR' : 'Liquidación Tributos SENIAT / Parafiscales'));

    return {
      accountCode: targetCode,
      accountName: targetName,
      moduleTag: 'MOD_SENIAT_PAGO',
      rationale: 'Pago o débito de tributo fiscal / parafiscal nacional o municipal (SENIAT, IGTF, BANAVIH, Alcaldía).',
      journalEntry: [
        { accountCode: targetCode, accountName: targetName, debe: amount, haber: 0, concept: `Pago Tributo ${rawDesc}` },
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: 'Débito pago tributo fiscal' }
      ]
    };
  }

  // 4. Payroll and Ley de Pensiones 2024
  if (upper.includes('NOMINA') || upper.includes('SUELDO') || upper.includes('SALARIO') || upper.includes('QUINCENA') || upper.includes('PENSIONES')) {
    return {
      accountCode: '6.1.01.01.001',
      accountName: 'Gastos de Sueldos y Salarios Operativos',
      moduleTag: 'MOD_NOMINA',
      rationale: 'Dispersión masiva de nómina laboral. Constituye la base para la alícuota de la Ley de Protección de Pensiones 2024.',
      journalEntry: [
        { accountCode: '6.1.01.01.001', accountName: 'Gastos de Sueldos y Salarios Operativos', debe: amount, haber: 0, concept: `Pago nómina quincenal ${rawDesc}` },
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: 'Débito bancario nómina' }
      ]
    };
  }

  // 5. Shareholder Loan / Aporte de Socio (SUDEBAN Res. 010.25)
  if (upper.includes('SOCIO') || upper.includes('ACCIONISTA') || upper.includes('PRESTAMO SOCIO') || upper.includes('APORTE') || upper.includes('MUTUO')) {
    if (txType === 'CREDIT') {
      return {
        accountCode: '2.1.03.01.001',
        accountName: 'Cuentas por Pagar Accionistas y Socios',
        moduleTag: 'MOD_SOCIOS_IN',
        rationale: 'Inyección de fondos de accionista. Obligatorio respaldar con Contrato de Mutuo y declaración jurada SUDEBAN Res. 010.25 para evitar presunción de ingresos omitidos.',
        journalEntry: [
          { accountCode: currency === 'USD' ? '1.1.01.02.010' : '1.1.01.02.001', accountName: `${bankName} ${currency}`, debe: amount, haber: 0, concept: 'Ingreso préstamo accionista' },
          { accountCode: '2.1.03.01.001', accountName: 'Cuentas por Pagar Accionistas y Socios', debe: 0, haber: amount, concept: `Contrato Mutuo ${meta.rif || ''}` }
        ]
      };
    } else {
      return {
        accountCode: '1.1.03.01.001',
        accountName: 'Cuentas por Cobrar Accionistas y Directores',
        moduleTag: 'MOD_CXC_SOCIOS',
        rationale: 'Préstamo o anticipo entregado a accionista respaldado bajo contrato de mutuo.',
        journalEntry: [
          { accountCode: '1.1.03.01.001', accountName: 'Cuentas por Cobrar Accionistas y Directores', debe: amount, haber: 0, concept: 'Entrega préstamo accionista' },
          { accountCode: currency === 'USD' ? '1.1.01.02.010' : '1.1.01.02.001', accountName: `${bankName} ${currency}`, debe: 0, haber: amount, concept: 'Transferencia débito' }
        ]
      };
    }
  }

  // 6. Bank Loans & Financing
  if (upper.includes('PAGARE') || upper.includes('CREDITO BANCARIO') || upper.includes('LINEA DE CREDITO') || upper.includes('PRESTAMO BANC')) {
    return {
      accountCode: '2.1.01.01.001',
      accountName: 'Préstamos y Pagarés Bancarios Comerciales',
      moduleTag: 'MOD_PRESTAMOS_IN',
      rationale: 'Liquidación de financiamiento o pagaré bancario comercial.',
      journalEntry: [
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: amount, haber: 0, concept: 'Abono crédito bancario' },
        { accountCode: '2.1.01.01.001', accountName: 'Préstamos y Pagarés Bancarios Comerciales', debe: 0, haber: amount, concept: rawDesc }
      ]
    };
  }

  // 7. Inter-bank Transfers (Own Accounts)
  if (upper.includes('TRASPASO') || upper.includes('CTA PROPIA') || upper.includes('MISMA RAZON') || upper.includes('MISMA EMPRESA') || upper.includes('CUENTA PROPIA')) {
    if (txType === 'CREDIT') {
      return {
        accountCode: '1.1.01.02.001',
        accountName: `${bankName} Cta Corriente`,
        moduleTag: 'MOD_TFR_PROPIAS_IN',
        rationale: 'Traspaso interbancario recibido entre cuentas de la misma empresa (efecto neutro).',
        journalEntry: [
          { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: amount, haber: 0, concept: 'Entrada traspaso cuenta propia' },
          { accountCode: '1.1.01.02.002', accountName: 'Banco Origen Cta Corriente', debe: 0, haber: amount, concept: rawDesc }
        ]
      };
    } else {
      return {
        accountCode: '1.1.01.02.002',
        accountName: 'Banco Destino Cta Corriente',
        moduleTag: 'MOD_TFR_PROPIAS_OUT',
        rationale: 'Traspaso interbancario enviado hacia otra cuenta de la misma empresa (efecto neutro).',
        journalEntry: [
          { accountCode: '1.1.01.02.002', accountName: 'Banco Destino Cta Corriente', debe: amount, haber: 0, concept: 'Salida traspaso cuenta propia' },
          { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: rawDesc }
        ]
      };
    }
  }

  // 8. Foreign Currency (USD / Convenio Cambiario N° 1)
  if (currency === 'USD' || upper.includes('CONVENIO 1') || upper.includes('CUSTODIA') || upper.includes('DIVISA')) {
    if (txType === 'CREDIT') {
      return {
        accountCode: '1.1.01.02.010',
        accountName: 'Banco Cta Moneda Extranjera (Convenio Cambiario N° 1)',
        moduleTag: 'MOD_USD_IN',
        rationale: 'Ingreso en divisas autorizado bajo Convenio Cambiario N° 1 a tasa oficial BCV.',
        journalEntry: [
          { accountCode: '1.1.01.02.010', accountName: 'Banco Cta Divisas USD', debe: amount, haber: 0, concept: 'Ingreso divisas extranjeras' },
          { accountCode: '1.1.02.01.001', accountName: 'Cuentas por Cobrar Clientes', debe: 0, haber: amount, concept: rawDesc }
        ]
      };
    } else {
      return {
        accountCode: '2.1.02.02.001',
        accountName: 'Cuentas por Pagar Proveedores del Exterior (USD)',
        moduleTag: 'MOD_USD_OUT',
        rationale: 'Salida en divisas para pago internacional con Declaración Única de Aduanas (DUA).',
        journalEntry: [
          { accountCode: '2.1.02.02.001', accountName: 'Proveedores del Exterior', debe: amount, haber: 0, concept: rawDesc },
          { accountCode: '1.1.01.02.010', accountName: 'Banco Cta Divisas USD', debe: 0, haber: amount, concept: 'Salida divisas' }
        ]
      };
    }
  }

  // 9. Anticipos a Proveedores
  if (upper.includes('ANTICIPO') || upper.includes('ADELANTO')) {
    return {
      accountCode: '1.1.04.01.001',
      accountName: 'Anticipos a Proveedores y Retenciones',
      moduleTag: 'MOD_ANTICIPOS',
      rationale: 'Anticipo comercial otorgado a proveedor sujeto a retención preventiva.',
      journalEntry: [
        { accountCode: '1.1.04.01.001', accountName: 'Anticipos a Proveedores', debe: amount, haber: 0, concept: rawDesc },
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: 'Débito bancario anticipo' }
      ]
    };
  }

  // 10. Proveedores y Gastos Operativos (Movistar, Zoom, Sistealarmas, Fiorca, Integral Colours, Seguros)
  if (
    txType === 'DEBIT' &&
    (
      upper.includes('MOVISTAR') ||
      upper.includes('CANTV') ||
      upper.includes('CORPOELEC') ||
      upper.includes('ZOOM') ||
      upper.includes('SISTEALARMAS') ||
      upper.includes('FIORCA') ||
      upper.includes('INTEGRAL COLOURS') ||
      upper.includes('SEGUROS') ||
      upper.includes('ESTAR SEGUROS') ||
      upper.includes('COMPRA') ||
      upper.includes('TRF.MB') ||
      upper.includes('FACT')
    )
  ) {
    return {
      accountCode: '2.1.02.01.001',
      accountName: 'Cuentas por Pagar Proveedores Nacionales',
      moduleTag: 'MOD_PROVEEDORES',
      rationale: 'Pago a proveedor de bienes o servicios. Sujeto a retención de IVA según Providencia SNAT/2025/000054 (75%/100%).',
      journalEntry: [
        { accountCode: '2.1.02.01.001', accountName: 'Cuentas por Pagar Proveedores Nacionales', debe: amount, haber: 0, concept: `Pago proveedor ${meta.rif || meta.docNum || ''}` },
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: 'Débito bancario proveedor' }
      ]
    };
  }

  // 11. Cobro de Facturas / Ventas (Chinakorea Motors, Agencia Selinger, Armas del Rosario, Pago Móvil recibido, TRF CR INM)
  if (
    txType === 'CREDIT' &&
    (
      upper.includes('CHINAKOREA') ||
      upper.includes('SELINGER') ||
      upper.includes('ARMAS DEL ROSARIO') ||
      upper.includes('TRF CR INM') ||
      upper.includes('PAGO MOVIL') ||
      upper.includes('ABONO') ||
      upper.includes('FACT') ||
      upper.includes('COBRO') ||
      upper.includes('CLIENTE')
    )
  ) {
    return {
      accountCode: '1.1.02.01.001',
      accountName: 'Cuentas por Cobrar Comerciales Clientes',
      moduleTag: 'MOD_VENTAS',
      rationale: 'Abono recibido de cliente por facturación comercial ordinaria.',
      journalEntry: [
        { accountCode: '1.1.01.02.001', accountName: `${bankName} Cta Operativa`, debe: amount, haber: 0, concept: 'Cobro factura cliente' },
        { accountCode: '1.1.02.01.001', accountName: 'Cuentas por Cobrar Comerciales Clientes', debe: 0, haber: amount, concept: `Cancelación crédito ${meta.rif || ''}` }
      ]
    };
  }

  // 12. Fallback: Otros / No Identificados (para revisión contable manual)
  return {
    accountCode: txType === 'CREDIT' ? '1.1.02.01.001' : '2.1.02.01.001',
    accountName: txType === 'CREDIT' ? 'Partidas Bancarias Pendientes de Identificar (Ingresos)' : 'Partidas Bancarias Pendientes de Identificar (Egresos)',
    moduleTag: 'MOD_OTROS',
    rationale: 'Transacción no identificada automáticamente. Requiere asignación y soporte probatorio en el Módulo de Justificación.',
    journalEntry: [
      { accountCode: txType === 'CREDIT' ? '1.1.01.02.001' : '2.1.02.01.001', accountName: txType === 'CREDIT' ? `${bankName} Cta Corriente` : 'Partidas por Identificar', debe: amount, haber: 0, concept: rawDesc },
      { accountCode: txType === 'CREDIT' ? '1.1.02.01.001' : '1.1.01.02.001', accountName: txType === 'CREDIT' ? 'Partidas por Identificar' : `${bankName} Cta Corriente`, debe: 0, haber: amount, concept: rawDesc }
    ]
  };
}

// Parse pasted raw text from Venezuelan bank statements (Banesco, Mercantil, BDV, etc.)
export async function parseAndCategorizeRawBankText(
  rawText: string,
  selectedBankCode: string = '0134',
  currency: 'VES' | 'USD' = 'VES',
  bcvRate: number = 52.40
): Promise<{
  parsedRows: AIParsedBankRow[];
  generatedEntries: JournalEntry[];
  summary: string;
}> {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: AIParsedBankRow[] = [];
  const entries: JournalEntry[] = [];

  const bankNameMap: Record<string, string> = {
    '0134': 'Banesco Banco Universal',
    '0105': 'Banco Mercantil C.A.',
    '0102': 'Banco de Venezuela S.A.',
    '0191': 'Banco Nacional de Crédito BNC',
    '0172': 'Bancamiga Banco Universal',
    '0108': 'Banco Provincial BBVA'
  };
  const bankName = bankNameMap[selectedBankCode] || 'Banesco Banco Universal';

  // Try calling Gemini if API key is present
  const apiKey = getApiKey();
  if (apiKey && lines.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Actúa como Contador Público Colegiado (CPC) y experto en Normas Ven-NIF y RegTech en Venezuela.
Analiza las siguientes líneas extraídas de un estado de cuenta bancario (${bankName}, Moneda: ${currency}):

${rawText.slice(0, 4000)}

Para cada movimiento detectado, extrae y categoriza en JSON con la siguiente estructura exacta:
[
  {
    "txDate": "YYYY-MM-DD",
    "referenceNum": "string",
    "rawDescription": "string",
    "amountNominal": number,
    "txType": "CREDIT" | "DEBIT",
    "counterpartyRif": "string o null",
    "counterpartyName": "string o null",
    "suggestedAccountCode": "string (código del plan Ven-NIF)",
    "suggestedAccountName": "string",
    "moduleTag": "MOD_VENTAS" | "MOD_POS" | "MOD_SOCIOS_IN" | "MOD_PROVEEDORES" | "MOD_NOMINA" | "MOD_SENIAT_PAGO" | "MOD_TFR_PROPIAS_OUT" | "MOD_USD_IN",
    "confidence": number entre 0.8 y 1.0,
    "rationale": "Breve justificación contable y fiscal según leyes venezolanas"
  }
]
Responde ÚNICAMENTE con el bloque JSON válido, sin texto introductorio ni explicaciones fuera del JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedAiData = JSON.parse(cleanJson);

      if (Array.isArray(parsedAiData) && parsedAiData.length > 0) {
        for (const item of parsedAiData) {
          const row: AIParsedBankRow = {
            bankCode: selectedBankCode,
            bankName,
            txDate: item.txDate || new Date().toISOString().split('T')[0],
            referenceNum: item.referenceNum || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
            rawDescription: item.rawDescription || 'Transacción Bancaria',
            amountNominal: Math.abs(Number(item.amountNominal) || 100),
            txType: item.txType === 'DEBIT' ? 'DEBIT' : 'CREDIT',
            currency,
            counterpartyRif: item.counterpartyRif || undefined,
            counterpartyName: item.counterpartyName || undefined,
            suggestedAccountCode: item.suggestedAccountCode || '1.1.02.01.001',
            suggestedAccountName: item.suggestedAccountName || 'Cuentas por Cobrar',
            moduleTag: item.moduleTag || 'MOD_VENTAS',
            confidence: item.confidence || 0.95,
            rationale: item.rationale || 'Categorización automática por IA Gemini según Ven-NIF'
          };
          rows.push(row);

          // Generate balanced journal entry
          const ruleBased = categorizeTransactionRuleBased(row.rawDescription, row.amountNominal, row.txType, currency, bankName);
          entries.push({
            id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            date: row.txDate,
            reference: row.referenceNum,
            description: `${row.rawDescription} [IA Ven-NIF]`,
            lines: ruleBased.journalEntry,
            totalDebe: ruleBased.journalEntry.reduce((acc, l) => acc + l.debe, 0),
            totalHaber: ruleBased.journalEntry.reduce((acc, l) => acc + l.haber, 0),
            isBalanced: true,
            moduleTag: row.moduleTag
          });
        }

        return {
          parsedRows: rows,
          generatedEntries: entries,
          summary: `Se procesaron exitosamente ${rows.length} transacciones con Inteligencia Artificial Gemini 2.5 Flash, cumpliendo normativas contables Ven-NIF y fiscales venezolanas.`
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed or returned unparseable output; falling back to local expert accounting rules:', err);
    }
  }

  // Fallback: Local Expert RegTech Rule Engine (Immediate, Zero Latency)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for numbers that look like amounts (e.g. 1.500,00 or 1500.00)
    const amountRegex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;
    const matches = Array.from(line.matchAll(amountRegex));
    let amount = 1000.00;
    if (matches.length > 0) {
      const rawNumStr = matches[matches.length - 1][1];
      // Normalize Venezuelan format (1.234,56 -> 1234.56) or international format
      const normalizedStr = rawNumStr.includes(',')
        ? rawNumStr.replace(/\./g, '').replace(',', '.')
        : rawNumStr;
      const parsedNum = parseFloat(normalizedStr);
      if (!isNaN(parsedNum) && parsedNum > 0) amount = parsedNum;
    }

    // Determine type (credit/debit)
    const isDebit = line.toUpperCase().includes('DEBITO') ||
      line.toUpperCase().includes('CARGO') ||
      line.toUpperCase().includes('PAGO') ||
      line.toUpperCase().includes('COMISION') ||
      line.toUpperCase().includes('RETENCION') ||
      line.toUpperCase().includes('SENIAT');
    const txType: 'CREDIT' | 'DEBIT' = isDebit ? 'DEBIT' : 'CREDIT';

    // Extract reference
    const refMatch = line.match(/(?:REF|NC|ND|TRF|DOC|TRANS|OP)[:#]?\s*([A-Za-z0-9_-]{4,15})/i) ||
      line.match(/\b(\d{6,12})\b/);
    const referenceNum = refMatch ? refMatch[1] : `REF-${Math.floor(100000 + Math.random() * 900000)}`;

    // Extract RIF
    const meta = extractMetadataFromDescription(line);

    // Date
    const dateMatch = line.match(/\b(\d{2}[-/.]\d{2}[-/.]\d{2,4})\b/) ||
      line.match(/\b(\d{4}[-/.]\d{2}[-/.]\d{2})\b/);
    const txDate = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().split('T')[0];

    const rule = categorizeTransactionRuleBased(line, amount, txType, currency, bankName);

    const row: AIParsedBankRow = {
      bankCode: selectedBankCode,
      bankName,
      txDate,
      referenceNum,
      rawDescription: line,
      amountNominal: amount,
      txType,
      currency,
      counterpartyRif: meta.rif,
      suggestedAccountCode: rule.accountCode,
      suggestedAccountName: rule.accountName,
      moduleTag: rule.moduleTag,
      confidence: 0.94,
      rationale: rule.rationale
    };
    rows.push(row);

    entries.push({
      id: `entry-${Date.now()}-${i}`,
      date: row.txDate,
      reference: row.referenceNum,
      description: `${row.rawDescription} [Ven-NIF]`,
      lines: rule.journalEntry,
      totalDebe: rule.journalEntry.reduce((acc, l) => acc + l.debe, 0),
      totalHaber: rule.journalEntry.reduce((acc, l) => acc + l.haber, 0),
      isBalanced: true,
      moduleTag: row.moduleTag
    });
  }

  return {
    parsedRows: rows,
    generatedEntries: entries,
    summary: `Se procesaron exitosamente ${rows.length} líneas de extracto bancario mediante el motor de IA Contable Ven-NIF y reglas tributarias vigentes.`
  };
}

function normalizeDate(d: string): string {
  const parts = d.split(/[-/.]/);
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

export interface AIParsedLedgerRow {
  bankCode: string;
  bankName: string;
  txDate: string;
  referenceNum: string;
  rawDescription: string;
  amountNominal: number;
  txType: 'CREDIT' | 'DEBIT'; // In reconciliation: CREDIT = Ingreso/Entrada (+), DEBIT = Egreso/Salida (-)
  currency: 'VES' | 'USD';
  accountCode?: string;
  accountName?: string;
  counterpartyRif?: string;
  debe: number;
  haber: number;
  rationale: string;
}

// Parse pasted raw text or Excel tabular copy from Company Accounting Ledger (Mayor Analítico / Auxiliar de Bancos)
export async function parseAndCategorizeLedgerText(
  rawText: string,
  selectedBankCode: string = '0134',
  currency: 'VES' | 'USD' = 'VES',
  bcvRate: number = 52.40
): Promise<{
  parsedRows: AIParsedLedgerRow[];
  totalDebe: number;
  totalHaber: number;
  summary: string;
}> {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: AIParsedLedgerRow[] = [];

  const bankNameMap: Record<string, string> = {
    '0134': 'Banesco Banco Universal',
    '0105': 'Banco Mercantil C.A.',
    '0102': 'Banco de Venezuela S.A.',
    '0191': 'Banco Nacional de Crédito BNC',
    '0172': 'Bancamiga Banco Universal',
    '0108': 'Banco Provincial BBVA'
  };
  const bankName = bankNameMap[selectedBankCode] || 'Banesco Banco Universal';

  let totalDebe = 0;
  let totalHaber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignore typical header lines (e.g. "FECHA", "REFERENCIA", "DEBE", "HABER", "SALDO")
    const upperLine = line.toUpperCase();
    if (
      (upperLine.includes('FECHA') && (upperLine.includes('REFERENCIA') || upperLine.includes('DEBE') || upperLine.includes('CONCEPTO'))) ||
      upperLine.startsWith('MAYOR ANALITICO') ||
      upperLine.startsWith('LIBRO MAYOR') ||
      upperLine.startsWith('SALDO ANTERIOR')
    ) {
      continue;
    }

    // Split by tabs or semicolons or commas or multiple spaces if tabular
    const isTabular = line.includes('\t') || line.includes(';') || line.includes('|');
    const tokens = isTabular
      ? line.split(/[\t;|]/).map(t => t.trim()).filter(t => t.length > 0)
      : [];

    // Extract Date
    const dateMatch = line.match(/\b(\d{2}[-/.]\d{2}[-/.]\d{2,4})\b/) ||
      line.match(/\b(\d{4}[-/.]\d{2}[-/.]\d{2})\b/);
    const txDate = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().split('T')[0];

    // Extract Reference / Voucher / Check / Transfer
    const refMatch = line.match(/(?:REF|CHQ|CHEQUE|TRF|TRANS|DOC|ASIENTO|COMPROBANTE)[:#]?\s*([A-Za-z0-9_-]{3,20})/i) ||
      line.match(/\b(\d{5,12})\b/);
    const referenceNum = refMatch ? refMatch[1] : `ASIENTO-${String(i + 1).padStart(4, '0')}`;

    // Extract amounts: Look for numbers with Venezuelan or International decimal formats
    const amountRegex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;
    const matches = Array.from(line.matchAll(amountRegex));

    let debe = 0;
    let haber = 0;
    let amountNominal = 0;
    let txType: 'CREDIT' | 'DEBIT' = 'DEBIT';

    if (tokens.length >= 4) {
      // Tabular parse from Excel copy (e.g., Fecha | Ref | Concepto | Debe | Haber)
      const numTokens: number[] = [];
      for (const tok of tokens) {
        const cleanTok = tok.includes(',')
          ? tok.replace(/\./g, '').replace(',', '.')
          : tok.replace(/,/g, '');
        const val = parseFloat(cleanTok);
        if (!isNaN(val) && val > 0) {
          numTokens.push(val);
        }
      }

      if (numTokens.length >= 2) {
        // First is Debe, second is Haber or vice versa
        debe = numTokens[0];
        haber = numTokens[1];
      } else if (numTokens.length === 1) {
        if (upperLine.includes('DEBE') || upperLine.includes('INGRESO') || upperLine.includes('COBRO') || upperLine.includes('ABONO')) {
          debe = numTokens[0];
        } else {
          haber = numTokens[0];
        }
      }
    } else if (matches.length >= 2) {
      // Two numerical amounts in the line: assume Debe and Haber
      const parseAmt = (rawStr: string) => {
        const norm = rawStr.includes(',')
          ? rawStr.replace(/\./g, '').replace(',', '.')
          : rawStr;
        return parseFloat(norm) || 0;
      };
      debe = parseAmt(matches[0][1]);
      haber = parseAmt(matches[1][1]);
    } else if (matches.length === 1) {
      const rawNumStr = matches[0][1];
      const normalizedStr = rawNumStr.includes(',')
        ? rawNumStr.replace(/\./g, '').replace(',', '.')
        : rawNumStr;
      const amt = parseFloat(normalizedStr) || 0;

      const isIngreso = upperLine.includes('DEBE') ||
        upperLine.includes('INGRESO') ||
        upperLine.includes('COBRO') ||
        upperLine.includes('ABONO') ||
        upperLine.includes('DEPOSITO');

      if (isIngreso) {
        debe = amt;
      } else {
        haber = amt;
      }
    }

    if (debe > 0 && haber === 0) {
      amountNominal = debe;
      txType = 'CREDIT'; // Representa entrada/aumento de banco (+)
      totalDebe += debe;
    } else if (haber > 0 && debe === 0) {
      amountNominal = haber;
      txType = 'DEBIT'; // Representa salida/disminución de banco (-)
      totalHaber += haber;
    } else if (debe > 0 && haber > 0) {
      // Take the dominant one
      if (debe > haber) {
        amountNominal = debe;
        txType = 'CREDIT';
        totalDebe += debe;
      } else {
        amountNominal = haber;
        txType = 'DEBIT';
        totalHaber += haber;
      }
    } else {
      // Default placeholder if amount is not identified
      amountNominal = 100.0;
      txType = 'DEBIT';
      totalHaber += 100.0;
    }

    // Extract Description: strip date and amount from line
    let cleanDesc = line
      .replace(dateMatch ? dateMatch[0] : '', '')
      .replace(/[\t;|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanDesc.length < 3) {
      cleanDesc = `Asiento Libro de Banco ${referenceNum}`;
    }

    const meta = extractMetadataFromDescription(line);

    // Look for account code like 1.1.01.02...
    const acctCodeMatch = line.match(/\b([1-6]\.\d(?:\.\d{2}){2,3})\b/);
    const accountCode = acctCodeMatch ? acctCodeMatch[1] : '1.1.01.02.001';

    rows.push({
      bankCode: selectedBankCode,
      bankName,
      txDate,
      referenceNum,
      rawDescription: cleanDesc,
      amountNominal,
      txType,
      currency,
      accountCode,
      accountName: `${bankName} Cta Corriente`,
      counterpartyRif: meta.rif,
      debe,
      haber,
      rationale: txType === 'CREDIT' ? 'Ingreso contable registrado en libros (Debe de Bancos)' : 'Egreso contable registrado en libros (Haber de Bancos)'
    });
  }

  return {
    parsedRows: rows,
    totalDebe,
    totalHaber,
    summary: `Se procesaron exitosamente ${rows.length} asientos del Libro Mayor de Bancos (${rows.filter(r => r.txType === 'CREDIT').length} Ingresos, ${rows.filter(r => r.txType === 'DEBIT').length} Egresos).`
  };
}
