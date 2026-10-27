import * as XLSX from 'xlsx-js-style';
import { BankTransaction, CashDenominationCount, CashLogRecord, CurrencyType, DigitalSupportAttachment, JournalEntry, PettyCashExpenseItem, ProofOfCash, UserCompanyProfile } from '../types/accounting';
import {
  SGT_CONTABLE_ACCOUNTS,
  mapVenNifToSgtContable
} from '../data/sgtContableAccounts';
import {
  formatToVenezuelanDateHyphen,
  formatVenezuelanNumber,
  generateBankLedgerExcel,
  getBankRulesDefinition
} from './bankAccountingRules';

export { formatToVenezuelanDateHyphen, formatVenezuelanNumber };


// Formatter for SGT CONTABLE - Plan de Cuentas Nacional (Batch CSV / TXT)
export function exportToSgtContableBatch(entries: JournalEntry[]): string {
  const header = 'COMPROBANTE,FECHA,COD_CUENTA_SGT,DESCRIPCION_CUENTA,REFERENCIA,CONCEPTO,DEBE,HABER,RIF\n';
  const rows = entries.flatMap((entry, idx) => {
    const compNum = `SGT-${(idx + 1).toString().padStart(6, '0')}`;
    const dateFormatted = formatToVenezuelanDateHyphen(entry.date);
    return entry.lines.map(line => {
      const sgtAcc = mapVenNifToSgtContable(line.accountCode, `${line.concept} ${line.accountName}`);
      const cleanConcept = (line.concept || entry.description).replace(/"/g, '""');
      return `"${compNum}","${dateFormatted}","${sgtAcc.code}","${sgtAcc.name}","${entry.reference}","${cleanConcept}","${formatVenezuelanNumber(line.debe)}","${formatVenezuelanNumber(line.haber)}","${line.rif || ''}"`;
    });
  });
  return header + rows.join('\n');
}


// Formatter for Profit Plus Contabilidad (2K8 / 2K12 / ERP)
export function exportToProfitPlus(entries: JournalEntry[]): string {
  const header = ';--- NOMINUS EXPORT TO PROFIT PLUS CONTABILIDAD ---;\n;CUENTA\tFECHA\tREFERENCIA\tDESCRIPCION\tDEBE\tHABER\tRIF_AUXILIAR\n';
  const rows = entries.flatMap(entry => {
    const formattedDate = formatToVenezuelanDateHyphen(entry.date);
    return entry.lines.map(line => {
      const debeStr = line.debe.toFixed(2);
      const haberStr = line.haber.toFixed(2);
      const rif = line.rif || '';
      return `${line.accountCode}\t${formattedDate}\t${entry.reference}\t${line.concept.slice(0, 50)}\t${debeStr}\t${haberStr}\t${rif}`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Gálac Software Contabilidad
export function exportToGalac(entries: JournalEntry[]): string {
  const header = '"COMPROBANTE","FECHA","CUENTA","DESCRIPCION","REFERENCIA","DEBE","HABER","RIF"\n';
  const rows = entries.flatMap((entry, idx) => {
    const compNum = `COMP-${(idx + 1).toString().padStart(6, '0')}`;
    const formattedDate = formatToVenezuelanDateHyphen(entry.date);
    return entry.lines.map(line => {
      return `"${compNum}","${formattedDate}","${line.accountCode}","${line.concept.replace(/"/g, '""')}","${entry.reference}",${line.debe.toFixed(2)},${line.haber.toFixed(2)},"${line.rif || ''}"`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Saint Enterprise Contabilidad
export function exportToSaint(entries: JournalEntry[]): string {
  const lines: string[] = ['[SAINT_CONTABILIDAD_BATCH_VENEZUELA]'];
  entries.forEach((entry, idx) => {
    const formattedDate = formatToVenezuelanDateHyphen(entry.date);
    lines.push(`ASIENTO=${idx + 1};FECHA=${formattedDate};REF=${entry.reference};DESC=${entry.description}`);
    entry.lines.forEach(l => {
      lines.push(`CTA=${l.accountCode};DEBE=${l.debe.toFixed(2)};HABER=${l.haber.toFixed(2)};CONCEPTO=${l.concept}`);
    });
    lines.push('FIN_ASIENTO');
  });
  return lines.join('\n');
}

// Formatter for Valery Software
export function exportToValery(entries: JournalEntry[]): string {
  const header = 'COD_CUENTA,FECHA_ASIENTO,DOCUMENTO,DETALLE,MONTO_DEBE,MONTO_HABER\n';
  const rows = entries.flatMap(entry => {
    const formattedDate = formatToVenezuelanDateHyphen(entry.date);
    return entry.lines.map(line => {
      return `${line.accountCode},${formattedDate},${entry.reference},"${line.concept.replace(/"/g, '')}",${line.debe.toFixed(2)},${line.haber.toFixed(2)}`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Standard CSV Ven-NIF
export function exportToCsvVenNif(entries: JournalEntry[]): string {
  const header = 'Fecha,Comprobante,Referencia,Código Cuenta,Nombre Cuenta,Debe (Bs),Haber (Bs),RIF Contraparte,Concepto,Módulo RegTech\n';
  const rows = entries.flatMap((entry, idx) => {
    const compNum = `AS-${(idx + 1).toString().padStart(5, '0')}`;
    const formattedDate = formatToVenezuelanDateHyphen(entry.date);
    return entry.lines.map(line => {
      return `"${formattedDate}","${compNum}","${entry.reference}","${line.accountCode}","${line.accountName}","${formatVenezuelanNumber(line.debe)}","${formatVenezuelanNumber(line.haber)}","${line.rif || ''}","${line.concept}","${entry.moduleTag}"`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for SENIAT TXT Retenciones de IVA (para carga en Portal SENIAT)
export function exportSeniatWithholdingTxt(companyRif: string, transactions: BankTransaction[]): string {
  const cleanAgentRif = companyRif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const period = '202610';

  const rows = transactions
    .filter(t => t.retentionVatAmount && t.retentionVatAmount > 0)
    .map((t, idx) => {
      const cleanProvRif = (t.counterpartyRif || 'J-00000000-0').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const invoiceDate = t.txDate;
      const invoiceNum = t.referenceNum.slice(0, 15);
      const controlNum = `00-${t.referenceNum.slice(-6)}`;
      const totalAmount = t.amountNominal.toFixed(2);
      const baseAmount = ((t.amountNominal / 1.16)).toFixed(2);
      const retAmount = t.retentionVatAmount?.toFixed(2) || '0.00';
      const voucherNum = `202610${(idx + 1).toString().padStart(8, '0')}`;
      const alicuota = '16.00';

      return `${cleanAgentRif}\t${period}\t${invoiceDate}\tC\t01\t${cleanProvRif}\t${invoiceNum}\t${controlNum}\t${totalAmount}\t${baseAmount}\t${retAmount}\t0\t${voucherNum}\t0.00\t${alicuota}\t0`;
    });

  return rows.join('\r\n');
}

// Download file trigger helper
export function triggerFileDownload(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * EXPORTACIÓN A EXCEL PROFESIONAL (.XLSX) PARA SGT CONTABLE
 * Genera un archivo Excel estructurado con formato ejecutivo que incluye:
 * - Pestaña 1: "Asientos Diarios SGT" (Comprobantes con códigos exactos del Plan de Cuentas SGT)
 * - Pestaña 2: "Mayor Analítico SGT" (Resumen acumulado por cuenta con verificación de balance)
 * - Pestaña 3: "Plan de Cuentas SGT" (Catálogo oficial completo para consulta y auditoría)
 */
export function exportToSgtContableExcel(
  entries: JournalEntry[],
  company: UserCompanyProfile
): void {
  const wb = XLSX.utils.book_new();
  const companyName = company.companyName || 'EMPRESA CONTRIBUYENTE C.A.';
  const companyRif = company.companyRif || 'J-00000000-0';
  const bcvRate = company.bcvRate || 52.40;
  const now = new Date();
  const dateFormatted = formatToVenezuelanDateHyphen(now);
  const timeFormatted = now.toLocaleTimeString('es-VE');

  // ==========================================
  // HOJA 1: ASIENTOS DE DIARIO - SGT CONTABLE
  // ==========================================
  const journalRows: (string | number | null)[][] = [
    [`EMPRESA: ${companyName}`, null, null, null, null, null, null, null, null, null, null],
    [`RIF: ${companyRif} | SUJETO PASIVO: ${company.isSpecialTaxpayer ? 'ESPECIAL (SPE)' : 'ORDINARIO'}`, null, null, null, null, null, null, null, null, null, null],
    ['SISTEMA CONTABLE: "SGT CONTABLE" - PLAN DE CUENTAS VENEZUELA', null, null, null, null, null, null, null, null, null, null],
    [`FECHA DE EMISIÓN: ${dateFormatted} ${timeFormatted} | TASA BCV: Bs. ${formatVenezuelanNumber(bcvRate)} / USD`, null, null, null, null, null, null, null, null, null, null],
    ['ESTADO DEL CUADRE: COMPROBANTES DE DIARIO AUDITADOS BAJO VEN-NIF PYME', null, null, null, null, null, null, null, null, null, null],
    [], // Blank separator row
    [
      'COMPROBANTE',
      'FECHA',
      'CÓDIGO CUENTA (SGT)',
      'DESCRIPCIÓN DE LA CUENTA (SGT)',
      'REFERENCIA / DOC',
      'RIF CONTRAPARTE',
      'CONCEPTO / DETALLE DEL ASIENTO',
      'DEBE (Bs.)',
      'HABER (Bs.)',
      'MONETARIA',
      'TIPO SGT'
    ]
  ];

  let totalDebeGlobal = 0;
  let totalHaberGlobal = 0;
  const accountStatsMap = new Map<string, { name: string; monetary: string; type: string; debe: number; haber: number; count: number }>();

  entries.forEach((entry, eIdx) => {
    const compNum = `SGT-${(eIdx + 1).toString().padStart(6, '0')}`;
    const dateCol = formatToVenezuelanDateHyphen(entry.date);

    entry.lines.forEach(line => {
      const sgtAcc = mapVenNifToSgtContable(line.accountCode, `${line.concept} ${line.accountName}`);
      const masterInfo = SGT_CONTABLE_ACCOUNTS.find(a => a.code === sgtAcc.code);
      const monetary = masterInfo?.monetary || 'S';
      const sgtType = masterInfo?.type || '';

      const debeNum = Number(line.debe.toFixed(2));
      const haberNum = Number(line.haber.toFixed(2));

      totalDebeGlobal += debeNum;
      totalHaberGlobal += haberNum;

      // Track account summary for Sheet 2
      const existing = accountStatsMap.get(sgtAcc.code) || {
        name: sgtAcc.name,
        monetary,
        type: sgtType,
        debe: 0,
        haber: 0,
        count: 0
      };
      existing.debe += debeNum;
      existing.haber += haberNum;
      existing.count += 1;
      accountStatsMap.set(sgtAcc.code, existing);

      journalRows.push([
        compNum,
        dateCol,
        sgtAcc.code,
        sgtAcc.name,
        entry.reference,
        line.rif || '',
        line.concept || entry.description,
        formatVenezuelanNumber(debeNum),
        formatVenezuelanNumber(haberNum),
        monetary,
        sgtType
      ]);
    });
  });

  // Total summary row
  const difference = Number((totalDebeGlobal - totalHaberGlobal).toFixed(2));
  const cuadreStatus = Math.abs(difference) < 0.01
    ? 'BALANCEADO (CUADRADO AL 100%)'
    : `DESCUADRE: Bs. ${formatVenezuelanNumber(difference)}`;

  journalRows.push([]);
  journalRows.push([
    'TOTALES GENERALES SGT CONTABLE',
    '',
    '',
    cuadreStatus,
    '',
    '',
    `${entries.length} Asientos Contables Procesados`,
    formatVenezuelanNumber(totalDebeGlobal),
    formatVenezuelanNumber(totalHaberGlobal),
    '',
    ''
  ]);

  const wsJournal = XLSX.utils.aoa_to_sheet(journalRows);

  // Column widths for professional presentation
  wsJournal['!cols'] = [
    { wch: 15 }, // Comprobante
    { wch: 13 }, // Fecha
    { wch: 18 }, // Código SGT
    { wch: 38 }, // Descripción Cuenta
    { wch: 18 }, // Referencia
    { wch: 16 }, // RIF
    { wch: 48 }, // Concepto
    { wch: 16 }, // Debe
    { wch: 16 }, // Haber
    { wch: 12 }, // Monetaria
    { wch: 12 }  // Tipo
  ];

  // ==========================================
  // HOJA 2: MAYOR ANALÍTICO / RESUMEN SGT
  // ==========================================
  const summaryRows: (string | number | null)[][] = [
    [`EMPRESA: ${companyName} | RIF: ${companyRif}`],
    ['SISTEMA SGT CONTABLE - RESUMEN DE SALDOS POR CUENTA'],
    [`Generado: ${dateFormatted} | Tasa Oficial BCV: Bs. ${formatVenezuelanNumber(bcvRate)}`],
    [],
    [
      'CÓDIGO SGT',
      'NOMBRE DE LA CUENTA',
      'MOVIMIENTOS',
      'TOTAL CARGOS / DEBE (Bs.)',
      'TOTAL ABONOS / HABER (Bs.)',
      'SALDO NETO (Bs.)',
      'NATURALEZA',
      'MONETARIA',
      'TIPO'
    ]
  ];

  const sortedCodes = Array.from(accountStatsMap.keys()).sort();
  sortedCodes.forEach(code => {
    const stat = accountStatsMap.get(code)!;
    const net = Number((stat.debe - stat.haber).toFixed(2));
    const masterInfo = SGT_CONTABLE_ACCOUNTS.find(a => a.code === code);
    const nature = masterInfo?.nature || (net >= 0 ? 'DEUDORA' : 'ACREEDORA');

    summaryRows.push([
      code,
      stat.name,
      stat.count,
      formatVenezuelanNumber(stat.debe),
      formatVenezuelanNumber(stat.haber),
      formatVenezuelanNumber(net),
      nature,
      stat.monetary,
      stat.type
    ]);
  });

  summaryRows.push([]);
  summaryRows.push([
    'TOTALIZACIÓN DEL MAYOR SGT',
    cuadreStatus,
    entries.length,
    formatVenezuelanNumber(totalDebeGlobal),
    formatVenezuelanNumber(totalHaberGlobal),
    formatVenezuelanNumber(totalDebeGlobal - totalHaberGlobal),
    'DIFERENCIA 0,00',
    '',
    ''
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 18 }, // Código
    { wch: 42 }, // Nombre
    { wch: 14 }, // Movimientos
    { wch: 20 }, // Total Debe
    { wch: 20 }, // Total Haber
    { wch: 18 }, // Saldo Neto
    { wch: 14 }, // Naturaleza
    { wch: 12 }, // Monetaria
    { wch: 12 }  // Tipo
  ];

  // ==========================================
  // HOJA 3: CATÁLOGO MAESTRO SGT CONTABLE
  // ==========================================
  const catalogRows: (string | number | null)[][] = [
    ['PLAN DE CUENTAS MAESTRO - SISTEMA "SGT CONTABLE" (VENEZUELA)'],
    ['Estructura Oficial para Empresas bajo Ven-NIF y SENIAT'],
    [],
    [
      'CÓDIGO DE CUENTA',
      'DESCRIPCIÓN DE LA CUENTA',
      'MONETARIA',
      'TIPO',
      'CATEGORÍA',
      'NATURALEZA'
    ]
  ];

  SGT_CONTABLE_ACCOUNTS.forEach(acc => {
    catalogRows.push([
      acc.code,
      acc.name,
      acc.monetary,
      acc.type,
      acc.category,
      acc.nature
    ]);
  });

  const wsCatalog = XLSX.utils.aoa_to_sheet(catalogRows);
  wsCatalog['!cols'] = [
    { wch: 18 }, // Código
    { wch: 45 }, // Descripción
    { wch: 12 }, // Monetaria
    { wch: 12 }, // Tipo
    { wch: 16 }, // Categoría
    { wch: 14 }  // Naturaleza
  ];

  // Agregar las 3 hojas al Libro Excel
  XLSX.utils.book_append_sheet(wb, wsJournal, 'Asientos Diarios SGT');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Mayor Analítico SGT');
  XLSX.utils.book_append_sheet(wb, wsCatalog, 'Plan Cuentas SGT');

  // Descarga del archivo Excel
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const cleanRif = companyRif.replace(/[^A-Za-z0-9]/g, '');
  a.download = `SGT_CONTABLE_ASIENTOS_${cleanRif}_${timestamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Re-exportación del Libro de Bancos Oficial en Excel (3 Hojas con Partida Doble)
 * Aplicando las reglas de Banco de Venezuela, Banco Mercantil, Banco Plaza, etc.
 */
export { generateBankLedgerExcel as exportToOfficialBankLedgerExcel } from './bankAccountingRules';

/**
 * EXPORTACIÓN OFICIAL DE CÉDULA DE CUADRE Y PORTADA DE CONCILIACIÓN (.XLSX)
 * Genera el documento oficial de demostración de cuadre de conciliación bajo Ven-NIF PYME / SENIAT
 * con diseño profesional de alta presentación fiscal:
 * - Pestaña 1: "Portada y Cuadre Oficial" (Encabezado institucional azul marino, datos fiscales completos, dictamen de auditoría destacado en verde, Ecuación de Conciliación demostrada a Bs. 0,00, Estado de Prueba de Efectivo de 4 Columnas y tarjetas de firmas paralelas)
 * - Pestaña 2: "Partidas de Conciliación" (Detalle analítico con celdas cebradas, bordes y montos formateados)
 * - Pestaña 3: "Detalle de Movimientos" (Auditoría íntegra con diseño tabular ejecutivo)
 */
export function exportToReconciliationProofExcel(params: {
  proof: ProofOfCash;
  company: UserCompanyProfile;
  transactions?: BankTransaction[];
  bankName?: string;
  currency?: CurrencyType;
}): void {
  const { proof, company, transactions = [], bankName, currency = 'VES' } = params;
  const wb = XLSX.utils.book_new();

  const companyName = company.companyName || 'EMPRESA CONTRIBUYENTE C.A.';
  const companyRif = company.companyRif || 'J-00000000-0';
  const bcvRate = company.bcvRate || 52.40;
  const now = new Date();
  const dateFormatted = formatToVenezuelanDateHyphen(now);
  const timeFormatted = now.toLocaleTimeString('es-VE');

  const firstBankTx = transactions.find(t => t.source === 'BANK' && (t.bankName || t.bankCode));
  const bankDef = firstBankTx?.bankCode ? getBankRulesDefinition(firstBankTx.bankCode) : null;
  const resolvedBankName = bankName || firstBankTx?.bankName || bankDef?.bankName || 'Institución Bancaria Universal';
  const resolvedAccount = bankDef?.accountCodeBank || '1.1.1.2.10';

  const isCuadrada = proof.isBalanced || Math.abs(proof.difference) < 0.05;
  const dictamenCuadre = isCuadrada
    ? '✓ CONCILIACIÓN CUADRADA AL 100% - DIFERENCIA EXACTA: Bs. 0,00'
    : `DESCUADRE DETECTADO: Bs. ${formatVenezuelanNumber(proof.difference)}`;

  // ==============================================================
  // PALETA DE ESTILOS EJECUTIVOS PARA FISCALIZACIÓN SENIAT / AUDITORÍA
  // ==============================================================
  const borderThin = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  const styleBannerTitle = {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0F2942' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const styleBannerSub = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'BFDBFE' } },
    fill: { fgColor: { rgb: '0F2942' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const styleBannerTag = {
    font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: 'E2E8F0' } },
    fill: { fgColor: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const styleSectionBar = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2942' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } }
    }
  };

  const styleInfoLabel = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin
  };

  const styleInfoVal = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin
  };

  const styleDictamenLabel = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2942' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin
  };

  const styleDictamenBadge = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: isCuadrada ? '166534' : '991B1B' } },
    fill: { fgColor: { rgb: isCuadrada ? 'DCFCE7' : 'FEE2E2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      bottom: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      left: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      right: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } }
    }
  };

  const styleDictamenObs = {
    font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '475569' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin
  };

  const styleTh = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'medium', color: { rgb: '0F2942' } },
      bottom: { style: 'medium', color: { rgb: '0F2942' } },
      left: { style: 'thin', color: { rgb: '3B82F6' } },
      right: { style: 'thin', color: { rgb: '3B82F6' } }
    }
  };

  const styleTdItem = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '64748B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const styleTdText = {
    font: { name: 'Calibri', sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin
  };

  const styleTdNature = {
    font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '475569' } },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const styleTdNum = {
    font: { name: 'Calibri', sz: 10, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin
  };

  const styleTdAudit = {
    font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '2563EB' } },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const styleSubtotalRow = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2942' } },
    fill: { fgColor: { rgb: 'EFF6FF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'double', color: { rgb: '0F2942' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  };

  const styleSubtotalNum = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2942' } },
    fill: { fgColor: { rgb: 'EFF6FF' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'double', color: { rgb: '0F2942' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  };

  const styleProofZeroLabel = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: isCuadrada ? '166534' : '991B1B' } },
    fill: { fgColor: { rgb: isCuadrada ? 'DCFCE7' : 'FEE2E2' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      bottom: { style: 'double', color: { rgb: isCuadrada ? '166534' : '991B1B' } },
      left: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      right: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } }
    }
  };

  const styleProofZeroNum = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: isCuadrada ? '166534' : '991B1B' } },
    fill: { fgColor: { rgb: isCuadrada ? 'DCFCE7' : 'FEE2E2' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      bottom: { style: 'double', color: { rgb: isCuadrada ? '166534' : '991B1B' } },
      left: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } },
      right: { style: 'thin', color: { rgb: isCuadrada ? '86EFAC' : 'FCA5A5' } }
    }
  };

  const styleSignatureBox = {
    font: { name: 'Calibri', sz: 9, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const styleSignatureTitle = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F2942' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  // ==========================================
  // HOJA 1: PORTADA Y CUADRE OFICIAL
  // ==========================================
  const wsPortada: any = {};
  const mergesPortada: any[] = [];
  const rowsPortada: any[] = [];

  function setPortadaCell(r: number, c: number, val: any, style: any, t: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    wsPortada[addr] = { t, v: val ?? '', s: style || {} };
  }

  function mergePortada(r1: number, c1: number, r2: number, c2: number, val: any, style: any, t: string = 's') {
    mergesPortada.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        setPortadaCell(r, c, (r === r1 && c === c1) ? val : '', style, t);
      }
    }
  }

  let rowIdx = 0;

  // Banner Superior
  mergePortada(rowIdx, 0, rowIdx, 5, 'CÉDULA OFICIAL DE CONCILIACIÓN BANCARIA Y DEMOSTRACIÓN DE CUADRE', styleBannerTitle);
  rowsPortada.push({ hpt: 30 });
  rowIdx++;

  mergePortada(rowIdx, 0, rowIdx, 5, 'ESTADO DE DEMOSTRACIÓN DE FLUJOS Y SALDOS CONCILIADOS - NORMA VEN-NIF PYME', styleBannerSub);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  mergePortada(rowIdx, 0, rowIdx, 5, 'INSPECCIÓN TÉCNICA FINANCIERA Y CONCILIACIÓN FISCAL PARA EL SENIAT', styleBannerTag);
  rowsPortada.push({ hpt: 18 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 10 });
  rowIdx++;

  // Sección Datos de la Entidad
  mergePortada(rowIdx, 0, rowIdx, 5, 'DATOS DE LA ENTIDAD Y PARÁMETROS DEL EJERCICIO FISCAL', styleSectionBar);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Info Row 1
  setPortadaCell(rowIdx, 0, 'EMPRESA / RAZÓN SOCIAL:', styleInfoLabel);
  mergePortada(rowIdx, 1, rowIdx, 3, companyName, styleInfoVal);
  setPortadaCell(rowIdx, 4, 'RIF:', styleInfoLabel);
  setPortadaCell(rowIdx, 5, companyRif, styleInfoVal);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Info Row 2
  setPortadaCell(rowIdx, 0, 'CONDICIÓN FISCAL SENIAT:', styleInfoLabel);
  mergePortada(rowIdx, 1, rowIdx, 3, company.isSpecialTaxpayer ? 'CONTRIBUYENTE ESPECIAL (SPE)' : 'CONTRIBUYENTE ORDINARIO', styleInfoVal);
  setPortadaCell(rowIdx, 4, 'FECHA DE EMISIÓN:', styleInfoLabel);
  setPortadaCell(rowIdx, 5, dateFormatted, styleInfoVal);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Info Row 3
  setPortadaCell(rowIdx, 0, 'BANCO CONCILIADO:', styleInfoLabel);
  mergePortada(rowIdx, 1, rowIdx, 3, resolvedBankName, styleInfoVal);
  setPortadaCell(rowIdx, 4, 'CUENTA CONTABLE:', styleInfoLabel);
  setPortadaCell(rowIdx, 5, resolvedAccount, styleInfoVal);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Info Row 4
  setPortadaCell(rowIdx, 0, 'PERÍODO AUDITADO:', styleInfoLabel);
  mergePortada(rowIdx, 1, rowIdx, 3, proof.period || 'Octubre 2026', styleInfoVal);
  setPortadaCell(rowIdx, 4, 'MONEDA / TASA BCV:', styleInfoLabel);
  setPortadaCell(rowIdx, 5, `${currency} (Tasa BCV: Bs. ${formatVenezuelanNumber(bcvRate)} / USD)`, styleInfoVal);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 10 });
  rowIdx++;

  // Sección Dictamen
  mergePortada(rowIdx, 0, rowIdx, 5, 'DICTAMEN DE AUDITORÍA Y ESTADO DE EQUILIBRIO MATEMÁTICO', styleSectionBar);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Dictamen Row 1
  setPortadaCell(rowIdx, 0, 'ESTADO DEL CUADRE:', styleDictamenLabel);
  mergePortada(rowIdx, 1, rowIdx, 3, dictamenCuadre, styleDictamenBadge);
  setPortadaCell(rowIdx, 4, 'VERIFICACIÓN:', styleDictamenLabel);
  setPortadaCell(rowIdx, 5, isCuadrada ? 'AUDITADA Y CUADRADA' : 'PENDIENTE DE AJUSTE', styleDictamenBadge);
  rowsPortada.push({ hpt: 24 });
  rowIdx++;

  // Dictamen Row 2
  setPortadaCell(rowIdx, 0, 'OBSERVACIÓN:', styleDictamenLabel);
  mergePortada(rowIdx, 1, rowIdx, 5, isCuadrada
    ? 'La ecuación contable de conciliación satisface plenamente el principio de dualidad económica y partida doble bajo normas Ven-NIF PYME y providencias administrativas del SENIAT.'
    : 'Existen partidas pendientes de regularización en el extracto bancario o en el mayor de bancos.', styleDictamenObs);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 12 });
  rowIdx++;

  // Sección I: Demostración de la Ecuación de Conciliación
  mergePortada(rowIdx, 0, rowIdx, 5, 'I. DEMOSTRACIÓN DE LA ECUACIÓN DE CONCILIACIÓN BANCARIA (MÉTODO SALDOS CONCILIADOS)', styleSectionBar);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Table Headers
  setPortadaCell(rowIdx, 0, 'LÍNEA', styleTh);
  setPortadaCell(rowIdx, 1, 'CONCEPTO / DESCRIPCIÓN DE LA PARTIDA', styleTh);
  setPortadaCell(rowIdx, 2, 'NATURALEZA / CLASIFICACIÓN', styleTh);
  setPortadaCell(rowIdx, 3, 'MONTO PARCIAL (Bs.)', styleTh);
  setPortadaCell(rowIdx, 4, 'SALDO CONCILIADO (Bs.)', styleTh);
  setPortadaCell(rowIdx, 5, 'AUDITORÍA SENIAT', styleTh);
  rowsPortada.push({ hpt: 24 });
  rowIdx++;

  // Line 1: Banco Extracto
  setPortadaCell(rowIdx, 0, '1', styleTdItem);
  setPortadaCell(rowIdx, 1, 'Saldo Final según Estado de Cuenta Bancario al Cierre del Período', styleTdText);
  setPortadaCell(rowIdx, 2, 'Base Extracto Bancario', styleTdNature);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.finalBalanceBank), styleTdNum);
  setPortadaCell(rowIdx, 4, '', styleTdNum);
  setPortadaCell(rowIdx, 5, 'Conforme Extracto', styleTdAudit);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Line 2: Depósitos en Tránsito
  setPortadaCell(rowIdx, 0, '2', styleTdItem);
  setPortadaCell(rowIdx, 1, '(+) Más: Depósitos en Tránsito (Cobranzas / Abonos registrados en libros pendientes en banco)', styleTdText);
  setPortadaCell(rowIdx, 2, 'Partida en Tránsito (+)', styleTdNature);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.depositsInTransit), styleTdNum);
  setPortadaCell(rowIdx, 4, '', styleTdNum);
  setPortadaCell(rowIdx, 5, 'Pendiente Banco', styleTdAudit);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Line 3: Cheques / Transferencias en Tránsito
  setPortadaCell(rowIdx, 0, '3', styleTdItem);
  setPortadaCell(rowIdx, 1, '(-) Menos: Cheques y Transferencias Emitidos Pendientes de Cobro Bancario', styleTdText);
  setPortadaCell(rowIdx, 2, 'Partida en Tránsito (-)', styleTdNature);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(-Math.abs(proof.outstandingChecks)), styleTdNum);
  setPortadaCell(rowIdx, 4, '', styleTdNum);
  setPortadaCell(rowIdx, 5, 'Flotante en Tránsito', styleTdAudit);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Line 4: Saldo Banco Conciliado
  setPortadaCell(rowIdx, 0, '4', styleSubtotalRow);
  setPortadaCell(rowIdx, 1, '(=) IGUAL: SALDO BANCARIO CONCILIADO AUDITADO', styleSubtotalRow);
  setPortadaCell(rowIdx, 2, 'Subtotal Banco Conciliado', styleSubtotalRow);
  setPortadaCell(rowIdx, 3, '', styleSubtotalRow);
  setPortadaCell(rowIdx, 4, formatVenezuelanNumber(proof.reconciledBank), styleSubtotalNum);
  setPortadaCell(rowIdx, 5, '✓ S_Banco_Auditado', styleSubtotalRow);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 10 });
  rowIdx++;

  // Line 5: Libros
  setPortadaCell(rowIdx, 0, '5', styleTdItem);
  setPortadaCell(rowIdx, 1, 'Saldo Final según Mayor General de Bancos en Libros al Cierre del Período', styleTdText);
  setPortadaCell(rowIdx, 2, 'Base Libros Contables', styleTdNature);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.finalBalanceLedger), styleTdNum);
  setPortadaCell(rowIdx, 4, '', styleTdNum);
  setPortadaCell(rowIdx, 5, 'Conforme Libros', styleTdAudit);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Line 6: Notas de Crédito
  setPortadaCell(rowIdx, 0, '6', styleTdItem);
  setPortadaCell(rowIdx, 1, '(+) Más: Notas de Crédito Bancarias no Asentadas (Intereses / Abonos Directos)', styleTdText);
  setPortadaCell(rowIdx, 2, 'Ajuste a Libros (+)', styleTdNature);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.unrecordedCredits), styleTdNum);
  setPortadaCell(rowIdx, 4, '', styleTdNum);
  setPortadaCell(rowIdx, 5, 'Por Asentar en Libros', styleTdAudit);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Line 7: Notas de Débito
  setPortadaCell(rowIdx, 0, '7', styleTdItem);
  setPortadaCell(rowIdx, 1, '(-) Menos: Notas de Débito Bancarias no Registradas (Comisiones / IGTF / Impuestos / Servicios)', styleTdText);
  setPortadaCell(rowIdx, 2, 'Ajuste a Libros (-)', styleTdNature);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(-Math.abs(proof.unrecordedDebits)), styleTdNum);
  setPortadaCell(rowIdx, 4, '', styleTdNum);
  setPortadaCell(rowIdx, 5, 'Por Asentar en Libros', styleTdAudit);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Line 8: Saldo Libros Conciliado
  setPortadaCell(rowIdx, 0, '8', styleSubtotalRow);
  setPortadaCell(rowIdx, 1, '(=) IGUAL: SALDO EN LIBROS CONCILIADO AUDITADO', styleSubtotalRow);
  setPortadaCell(rowIdx, 2, 'Subtotal Libros Conciliado', styleSubtotalRow);
  setPortadaCell(rowIdx, 3, '', styleSubtotalRow);
  setPortadaCell(rowIdx, 4, formatVenezuelanNumber(proof.reconciledLedger), styleSubtotalNum);
  setPortadaCell(rowIdx, 5, '✓ S_Libros_Auditado', styleSubtotalRow);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 10 });
  rowIdx++;

  // Line 9: Demostración de Cuadre
  setPortadaCell(rowIdx, 0, '9', styleProofZeroLabel);
  setPortadaCell(rowIdx, 1, '(=) DIFERENCIA NETA DE CONCILIACIÓN (Saldo Banco Conciliado - Saldo Libros Conciliado)', styleProofZeroLabel);
  setPortadaCell(rowIdx, 2, 'Prueba Matemática de Cero', styleProofZeroLabel);
  setPortadaCell(rowIdx, 3, '', styleProofZeroLabel);
  setPortadaCell(rowIdx, 4, formatVenezuelanNumber(proof.difference), styleProofZeroNum);
  setPortadaCell(rowIdx, 5, isCuadrada ? '✓ CUADRADO AL 100%' : 'DIFERENCIA DETECTADA', styleProofZeroNum);
  rowsPortada.push({ hpt: 24 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 12 });
  rowIdx++;

  // Sección II: Estado de Prueba de Efectivo (4 Columnas)
  mergePortada(rowIdx, 0, rowIdx, 5, 'II. ESTADO DE PRUEBA DE EFECTIVO (MÉTODO DE 4 COLUMNAS - ENFOQUE VEN-NIF)', styleSectionBar);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Headers 4 Columnas
  mergePortada(rowIdx, 0, rowIdx, 1, 'ORIGEN DE INFORMACIÓN / REGISTRO', styleTh);
  setPortadaCell(rowIdx, 2, 'SALDO INICIAL (Bs.)', styleTh);
  setPortadaCell(rowIdx, 3, 'INGRESOS / CRÉDITOS (+ Bs.)', styleTh);
  setPortadaCell(rowIdx, 4, 'EGRESOS / DÉBITOS (- Bs.)', styleTh);
  setPortadaCell(rowIdx, 5, 'SALDO FINAL (Bs.)', styleTh);
  rowsPortada.push({ hpt: 24 });
  rowIdx++;

  // Fila Banco
  mergePortada(rowIdx, 0, rowIdx, 1, '1. Estado de Cuenta Bancario (Movimientos del Banco)', styleTdText);
  setPortadaCell(rowIdx, 2, formatVenezuelanNumber(proof.initialBalanceBank), styleTdNum);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.inflowsBank), styleTdNum);
  setPortadaCell(rowIdx, 4, formatVenezuelanNumber(proof.outflowsBank), styleTdNum);
  setPortadaCell(rowIdx, 5, formatVenezuelanNumber(proof.finalBalanceBank), styleTdNum);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Fila Libros
  mergePortada(rowIdx, 0, rowIdx, 1, '2. Mayor General de Bancos (Libros Contables Internos)', styleTdText);
  setPortadaCell(rowIdx, 2, formatVenezuelanNumber(proof.initialBalanceLedger), styleTdNum);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.inflowsLedger), styleTdNum);
  setPortadaCell(rowIdx, 4, formatVenezuelanNumber(proof.outflowsLedger), styleTdNum);
  setPortadaCell(rowIdx, 5, formatVenezuelanNumber(proof.finalBalanceLedger), styleTdNum);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Fila Variación
  mergePortada(rowIdx, 0, rowIdx, 1, '3. Variación Neta / Flujo Conciliatorio', styleSubtotalRow);
  setPortadaCell(rowIdx, 2, formatVenezuelanNumber(proof.initialBalanceBank - proof.initialBalanceLedger), styleSubtotalNum);
  setPortadaCell(rowIdx, 3, formatVenezuelanNumber(proof.inflowsBank - proof.inflowsLedger), styleSubtotalNum);
  setPortadaCell(rowIdx, 4, formatVenezuelanNumber(proof.outflowsBank - proof.outflowsLedger), styleSubtotalNum);
  setPortadaCell(rowIdx, 5, formatVenezuelanNumber(proof.difference), styleSubtotalNum);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Blank row
  rowsPortada.push({ hpt: 12 });
  rowIdx++;

  // Sección III: Constancia de Revisión y Firmas
  mergePortada(rowIdx, 0, rowIdx, 5, 'III. CONSTANCIA DE REVISIÓN, AUDITORÍA Y APROBACIÓN DE CUADRE', styleSectionBar);
  rowsPortada.push({ hpt: 22 });
  rowIdx++;

  // Headers Firmas
  mergePortada(rowIdx, 0, rowIdx, 2, 'ELABORADO POR (RESPONSABLE DE CONCILIACIÓN)', styleSignatureTitle);
  mergePortada(rowIdx, 3, rowIdx, 5, 'REVISADO Y APROBADO (ADMINISTRACIÓN / FINANZAS)', styleSignatureTitle);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Línea de firma
  mergePortada(rowIdx, 0, rowIdx, 2, '____________________________________________________', styleSignatureBox);
  mergePortada(rowIdx, 3, rowIdx, 5, '____________________________________________________', styleSignatureBox);
  rowsPortada.push({ hpt: 28 });
  rowIdx++;

  // Nombre y Cargo
  mergePortada(rowIdx, 0, rowIdx, 2, 'Contador General / Auditor Externo (Colegio de Contadores Públicos)', styleSignatureBox);
  mergePortada(rowIdx, 3, rowIdx, 5, 'Gerencia de Administración y Finanzas / Representante Legal', styleSignatureBox);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // CPC / RIF y Fecha
  mergePortada(rowIdx, 0, rowIdx, 2, `C.P.C. N°: _________________ | Fecha: ${dateFormatted}`, styleSignatureBox);
  mergePortada(rowIdx, 3, rowIdx, 5, `C.I. / RIF: _________________ | Fecha: ${dateFormatted}`, styleSignatureBox);
  rowsPortada.push({ hpt: 20 });
  rowIdx++;

  // Sello
  mergePortada(rowIdx, 0, rowIdx, 2, '[ FIRMA Y SELLO DEL CONTADOR PÚBLICO ]', styleSignatureBox);
  mergePortada(rowIdx, 3, rowIdx, 5, '[ SELLO FISCAL DE LA EMPRESA ]', styleSignatureBox);
  rowsPortada.push({ hpt: 24 });
  rowIdx++;

  wsPortada['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx, c: 5 } });
  wsPortada['!merges'] = mergesPortada;
  wsPortada['!rows'] = rowsPortada;
  wsPortada['!cols'] = [
    { wch: 8 },  // A: Línea / ID
    { wch: 58 }, // B: Concepto / Descripción
    { wch: 26 }, // C: Naturaleza / Saldo Inicial
    { wch: 22 }, // D: Monto Parcial / Ingresos
    { wch: 22 }, // E: Saldo Conciliado / Egresos
    { wch: 24 }  // F: Auditoría / Saldo Final
  ];

  // ==========================================
  // HOJA 2: PARTIDAS EN TRÁNSITO Y AJUSTES
  // ==========================================
  const wsReconciling: any = {};
  const mergesReconciling: any[] = [];
  const rowsReconciling: any[] = [];

  function setRecCell(r: number, c: number, val: any, style: any, t: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    wsReconciling[addr] = { t, v: val ?? '', s: style || {} };
  }

  function mergeRec(r1: number, c1: number, r2: number, c2: number, val: any, style: any, t: string = 's') {
    mergesReconciling.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        setRecCell(r, c, (r === r1 && c === c1) ? val : '', style, t);
      }
    }
  }

  let recIdx = 0;
  mergeRec(recIdx, 0, recIdx, 6, 'CÉDULA DE CONCILIACIÓN BANCARIA - PARTIDAS EN TRÁNSITO Y AJUSTES', styleBannerTitle);
  rowsReconciling.push({ hpt: 28 });
  recIdx++;

  mergeRec(recIdx, 0, recIdx, 6, `EMPRESA: ${companyName} | RIF: ${companyRif} | BANCO: ${resolvedBankName} | PERÍODO: ${proof.period} | EMISIÓN: ${dateFormatted}`, styleBannerSub);
  rowsReconciling.push({ hpt: 20 });
  recIdx++;

  rowsReconciling.push({ hpt: 10 });
  recIdx++;

  // Table Headers
  const recHeaders = ['ORIGEN', 'TIPO DE PARTIDA', 'FECHA', 'REFERENCIA', 'DESCRIPCIÓN / CONCEPTO', 'MONTO (Bs.)', 'ESTADO AUDITORÍA'];
  recHeaders.forEach((h, col) => {
    setRecCell(recIdx, col, h, styleTh);
  });
  rowsReconciling.push({ hpt: 24 });
  recIdx++;

  const unmatchedList = transactions.filter(t => t.matchingStatus === 'UNMATCHED');

  if (unmatchedList.length === 0) {
    mergeRec(recIdx, 0, recIdx, 4, 'Todas las operaciones se encuentran conciliadas satisfactoriamente (Cuadre exacto al 100%)', styleTdText);
    setRecCell(recIdx, 5, formatVenezuelanNumber(0), styleTdNum);
    setRecCell(recIdx, 6, 'CONCILIADO', styleDictamenBadge);
    rowsReconciling.push({ hpt: 22 });
    recIdx++;
  } else {
    unmatchedList.forEach((t, i) => {
      let tipoPartida = 'Partida Pendiente';
      if (t.source === 'LEDGER' && t.txType === 'CREDIT') {
        tipoPartida = 'Depósito en Tránsito (+)';
      } else if (t.source === 'LEDGER' && t.txType === 'DEBIT') {
        tipoPartida = 'Cheque / Transferencia Pendiente (-)';
      } else if (t.source === 'BANK' && t.txType === 'CREDIT') {
        tipoPartida = 'Nota de Crédito por Asentar (+)';
      } else if (t.source === 'BANK' && t.txType === 'DEBIT') {
        tipoPartida = 'Nota de Débito por Asentar (-)';
      }

      const zebraStyle = i % 2 === 0 ? styleTdText : { ...styleTdText, fill: { fgColor: { rgb: 'F8FAFC' } } };
      const zebraNum = i % 2 === 0 ? styleTdNum : { ...styleTdNum, fill: { fgColor: { rgb: 'F8FAFC' } } };
      const zebraNature = i % 2 === 0 ? styleTdNature : { ...styleTdNature, fill: { fgColor: { rgb: 'F1F5F9' } } };

      setRecCell(recIdx, 0, t.source === 'BANK' ? 'BANCO' : 'LIBROS', zebraNature);
      setRecCell(recIdx, 1, tipoPartida, zebraNature);
      setRecCell(recIdx, 2, formatToVenezuelanDateHyphen(t.txDate), zebraNature);
      setRecCell(recIdx, 3, t.referenceNum, zebraNature);
      setRecCell(recIdx, 4, t.rawDescription, zebraStyle);
      setRecCell(recIdx, 5, formatVenezuelanNumber(t.amountNominal), zebraNum);
      setRecCell(recIdx, 6, 'PENDIENTE', styleDictamenBadge);
      rowsReconciling.push({ hpt: 20 });
      recIdx++;
    });
  }

  wsReconciling['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: recIdx, c: 6 } });
  wsReconciling['!merges'] = mergesReconciling;
  wsReconciling['!rows'] = rowsReconciling;
  wsReconciling['!cols'] = [
    { wch: 14 }, // Origen
    { wch: 36 }, // Tipo Partida
    { wch: 14 }, // Fecha
    { wch: 18 }, // Referencia
    { wch: 54 }, // Descripción
    { wch: 22 }, // Monto
    { wch: 20 }  // Estado
  ];

  // ==========================================
  // HOJA 3: DETALLE TOTAL TRANSACCIONES
  // ==========================================
  const wsDetail: any = {};
  const mergesDetail: any[] = [];
  const rowsDetail: any[] = [];

  function setDetCell(r: number, c: number, val: any, style: any, t: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    wsDetail[addr] = { t, v: val ?? '', s: style || {} };
  }

  function mergeDet(r1: number, c1: number, r2: number, c2: number, val: any, style: any, t: string = 's') {
    mergesDetail.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        setDetCell(r, c, (r === r1 && c === c1) ? val : '', style, t);
      }
    }
  }

  let detIdx = 0;
  mergeDet(detIdx, 0, detIdx, 8, 'AUDITORÍA DETALLADA DE TRANSACCIONES - ESTADO DE CUENTA Y LIBROS', styleBannerTitle);
  rowsDetail.push({ hpt: 28 });
  detIdx++;

  mergeDet(detIdx, 0, detIdx, 8, `EMPRESA: ${companyName} | RIF: ${companyRif} | TOTAL TRANSACCIONES: ${transactions.length} | EMISIÓN: ${dateFormatted}`, styleBannerSub);
  rowsDetail.push({ hpt: 20 });
  detIdx++;

  rowsDetail.push({ hpt: 10 });
  detIdx++;

  const detHeaders = ['ID', 'ORIGEN', 'FECHA', 'TIPO', 'REFERENCIA', 'DESCRIPCIÓN DE LA OPERACIÓN', 'MONTO (Bs.)', 'ESTADO CONCILIACIÓN', 'CONTRAPARTE / VÍNCULO'];
  detHeaders.forEach((h, col) => {
    setDetCell(detIdx, col, h, styleTh);
  });
  rowsDetail.push({ hpt: 24 });
  detIdx++;

  transactions.forEach((t, i) => {
    const zebraStyle = i % 2 === 0 ? styleTdText : { ...styleTdText, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraNum = i % 2 === 0 ? styleTdNum : { ...styleTdNum, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraCenter = i % 2 === 0 ? styleTdNature : { ...styleTdNature, fill: { fgColor: { rgb: 'F1F5F9' } } };

    setDetCell(detIdx, 0, t.id, zebraCenter);
    setDetCell(detIdx, 1, t.source === 'BANK' ? 'BANCO' : 'LIBROS', zebraCenter);
    setDetCell(detIdx, 2, formatToVenezuelanDateHyphen(t.txDate), zebraCenter);
    setDetCell(detIdx, 3, t.txType, zebraCenter);
    setDetCell(detIdx, 4, t.referenceNum, zebraCenter);
    setDetCell(detIdx, 5, t.rawDescription, zebraStyle);
    setDetCell(detIdx, 6, formatVenezuelanNumber(t.amountNominal), zebraNum);
    setDetCell(detIdx, 7, t.matchingStatus, zebraCenter);
    setDetCell(detIdx, 8, t.matchedWithId || t.counterpartyName || '', zebraCenter);
    rowsDetail.push({ hpt: 20 });
    detIdx++;
  });

  wsDetail['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detIdx, c: 8 } });
  wsDetail['!merges'] = mergesDetail;
  wsDetail['!rows'] = rowsDetail;
  wsDetail['!cols'] = [
    { wch: 18 }, // ID
    { wch: 12 }, // Origen
    { wch: 14 }, // Fecha
    { wch: 10 }, // Tipo
    { wch: 18 }, // Referencia
    { wch: 54 }, // Descripción
    { wch: 22 }, // Monto
    { wch: 22 }, // Estado
    { wch: 24 }  // Vínculo
  ];

  // Agregar las 3 hojas reglamentarias
  XLSX.utils.book_append_sheet(wb, wsPortada, 'Portada y Cuadre Oficial');
  XLSX.utils.book_append_sheet(wb, wsReconciling, 'Partidas de Conciliación');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle de Movimientos');

  // Descarga con opciones de estilos habilitadas
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const cleanRif = companyRif.replace(/[^A-Za-z0-9]/g, '');
  a.download = `CEDULA_CUADRE_CONCILIACION_${cleanRif}_${timestamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * EXPORTACIÓN A EXCEL (.XLSX) DEL MÓDULO DE JUSTIFICACIÓN CONTABLE, TRIBUTARIA Y REPOSITORIO DE SOPORTES
 * Genera un reporte institucional en Excel con 3 hojas estructuradas y estilizadas para fiscalización SENIAT:
 * 1. "Resumen_Por_Repositorios": Resumen de cada categoría/módulo, cantidad de partidas, montos en Bs./USD y % cobertura de soportes.
 * 2. "Detalle_Operaciones": Listado exhaustivo de todas las operaciones bancarias agrupadas por su categoría/repositorio con estado probatorio.
 * 3. "Inventario_De_Soportes": Inventario de todos los archivos y comprobantes cargados/recibidos por Telegram con metadata de IA.
 */
export function exportToJustificationAndRepositoryExcel(params: {
  company: UserCompanyProfile;
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  digitalSupports?: DigitalSupportAttachment[];
}): void {
  const { company, transactions, currency, bcvRate, digitalSupports = [] } = params;
  const wb = XLSX.utils.book_new();

  const companyName = company.companyName || 'EMPRESA CONTRIBUYENTE C.A.';
  const companyRif = company.companyRif || 'J-00000000-0';
  const now = new Date();
  const dateFormatted = formatToVenezuelanDateHyphen(now);

  // Estilos visuales institucionales
  const styleHeaderBanner = {
    font: { name: 'Arial', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0F2942' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const styleSubBanner = {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'E2E8F0' } },
    fill: { fgColor: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const styleSectionBar = {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  const styleTh = {
    font: { name: 'Arial', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { rgb: '1E3A8A' } }
    }
  };

  const styleTdText = {
    font: { name: 'Arial', sz: 9, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    }
  };

  const styleTdCenter = {
    font: { name: 'Arial', sz: 9, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    }
  };

  const styleTdNum = {
    font: { name: 'Arial', sz: 9, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    }
  };

  const styleTotalRow = {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'EFF6FF' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'medium', color: { rgb: '1E3A8A' } },
      bottom: { style: 'double', color: { rgb: '1E3A8A' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  };

  // ----------------------------------------------------
  // HOJA 1: RESUMEN POR REPOSITORIOS Y CATEGORÍAS
  // ----------------------------------------------------
  const ws1: any = {};
  const merges1: any[] = [];
  const rows1: any[] = [];

  function set1Cell(r: number, c: number, val: any, style: any, t: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws1[addr] = { t, v: val ?? '', s: style || {} };
  }

  function merge1(r1: number, c1: number, r2: number, c2: number, val: any, style: any, t: string = 's') {
    merges1.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        set1Cell(r, c, (r === r1 && c === c1) ? val : '', style, t);
      }
    }
  }

  let r1Idx = 0;
  merge1(r1Idx, 0, r1Idx, 7, 'MATRIZ DE JUSTIFICACIÓN CONTABLE, TRIBUTARIA Y REPOSITORIO DE SOPORTES', styleHeaderBanner);
  rows1.push({ hpt: 28 });
  r1Idx++;

  merge1(r1Idx, 0, r1Idx, 7, `EMPRESA: ${companyName} | RIF: ${companyRif} | TASA BCV: Bs. ${bcvRate.toFixed(2)} | FECHA EMISIÓN: ${dateFormatted}`, styleSubBanner);
  rows1.push({ hpt: 20 });
  r1Idx++;

  rows1.push({ hpt: 10 });
  r1Idx++;

  merge1(r1Idx, 0, r1Idx, 7, 'I. CLASIFICACIÓN DE MOVIMIENTOS Y COBERTURA PROBATORIA POR CATEGORÍA DE REPOSITORIO', styleSectionBar);
  rows1.push({ hpt: 22 });
  r1Idx++;

  const h1 = ['CÓDIGO REPOSITORIO', 'CATEGORÍA / MÓDULO OPERATIVO', 'NATURALEZA', 'CANT. MOVIMIENTOS', 'MONTO TOTAL (Bs.)', 'EQUIV. USD ($)', 'CON SOPORTE', '% COBERTURA PROBATORIA'];
  h1.forEach((colTitle, c) => set1Cell(r1Idx, c, colTitle, styleTh));
  rows1.push({ hpt: 24 });
  r1Idx++;

  const bankTxs = transactions.filter(t => t.source === 'BANK' && t.currency === currency);

  // Group stats by module
  const moduleCatalog = [
    { id: 'MOD_VENTAS', title: 'Cobro de Facturas / Ventas', nature: 'Entrada (+)' },
    { id: 'MOD_USD_IN', title: 'Ingresos en Divisas', nature: 'Entrada (+)' },
    { id: 'MOD_TFR_PROPIAS_IN', title: 'Transferencias Propias (Entradas)', nature: 'Entrada (+)' },
    { id: 'MOD_SOCIOS_IN', title: 'Aportes y Préstamos de Socios', nature: 'Entrada (+)' },
    { id: 'MOD_POS', title: 'Liquidación Puntos de Venta (POS)', nature: 'Entrada (+)' },
    { id: 'MOD_PRESTAMOS_IN', title: 'Créditos Bancarios Recibidos', nature: 'Entrada (+)' },
    { id: 'MOD_PROVEEDORES', title: 'Pago a Proveedores Locales', nature: 'Salida (-)' },
    { id: 'MOD_USD_OUT', title: 'Salidas en Divisas / Importaciones', nature: 'Salida (-)' },
    { id: 'MOD_CXC_SOCIOS', title: 'Cuentas por Cobrar Socios (Gastos)', nature: 'Salida (-)' },
    { id: 'MOD_CXP_SOCIOS', title: 'Devolución Préstamos Socios', nature: 'Salida (-)' },
    { id: 'MOD_TFR_PROPIAS_OUT', title: 'Transferencias Propias (Salidas)', nature: 'Salida (-)' },
    { id: 'MOD_ANTICIPOS', title: 'Anticipos y Retenciones Compras', nature: 'Salida (-)' },
    { id: 'MOD_NOMINA', title: 'Nómina y Ley de Pensiones 2024', nature: 'Salida (-)' },
    { id: 'MOD_SENIAT_PAGO', title: 'Tributos SENIAT y Municipales', nature: 'Salida (-)' },
    { id: 'MOD_COMISIONES', title: 'Comisiones y Gastos Bancarios', nature: 'Salida (-)' },
    { id: 'MOD_HUERFANOS', title: 'Carpeta de Huérfanos (Pendientes)', nature: 'Por Clasificar' }
  ];

  let totCount = 0;
  let totVes = 0;
  let totUsd = 0;
  let totWithSupp = 0;

  moduleCatalog.forEach((mod, i) => {
    const modTxs = bankTxs.filter(t => (t.moduleTag || 'MOD_HUERFANOS') === mod.id);
    const count = modTxs.length;
    const ves = modTxs.reduce((acc, t) => acc + (t.amountVes || (t.currency === 'VES' ? t.amountNominal : t.amountNominal * bcvRate)), 0);
    const usd = modTxs.reduce((acc, t) => acc + (t.amountUsdEquivalent || (t.currency === 'USD' ? t.amountNominal : t.amountNominal / bcvRate)), 0);
    const withSupp = modTxs.filter(t => (t.attachments && t.attachments.length > 0) || t.matchingStatus === 'MATCHED_EXACT').length;
    const covPct = count > 0 ? Math.round((withSupp / count) * 100) : 0;

    totCount += count;
    totVes += ves;
    totUsd += usd;
    totWithSupp += withSupp;

    const zebraStyle = i % 2 === 0 ? styleTdText : { ...styleTdText, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraCenter = i % 2 === 0 ? styleTdCenter : { ...styleTdCenter, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraNum = i % 2 === 0 ? styleTdNum : { ...styleTdNum, fill: { fgColor: { rgb: 'F8FAFC' } } };

    set1Cell(r1Idx, 0, mod.id, zebraCenter);
    set1Cell(r1Idx, 1, mod.title, zebraStyle);
    set1Cell(r1Idx, 2, mod.nature, zebraCenter);
    set1Cell(r1Idx, 3, count, zebraCenter);
    set1Cell(r1Idx, 4, formatVenezuelanNumber(ves), zebraNum);
    set1Cell(r1Idx, 5, formatVenezuelanNumber(usd), zebraNum);
    set1Cell(r1Idx, 6, withSupp, zebraCenter);
    set1Cell(r1Idx, 7, `${covPct}%`, zebraCenter);
    rows1.push({ hpt: 20 });
    r1Idx++;
  });

  // Total row
  const globalCov = totCount > 0 ? Math.round((totWithSupp / totCount) * 100) : 0;
  set1Cell(r1Idx, 0, 'TOTAL', styleTotalRow);
  set1Cell(r1Idx, 1, 'TOTAL GENERAL ESTADO DE CUENTA BANCARIO', styleTotalRow);
  set1Cell(r1Idx, 2, 'GLOBAL', styleTotalRow);
  set1Cell(r1Idx, 3, totCount, styleTotalRow);
  set1Cell(r1Idx, 4, formatVenezuelanNumber(totVes), styleTotalRow);
  set1Cell(r1Idx, 5, formatVenezuelanNumber(totUsd), styleTotalRow);
  set1Cell(r1Idx, 6, totWithSupp, styleTotalRow);
  set1Cell(r1Idx, 7, `${globalCov}%`, styleTotalRow);
  rows1.push({ hpt: 24 });
  r1Idx++;

  ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r1Idx, c: 7 } });
  ws1['!merges'] = merges1;
  ws1['!rows'] = rows1;
  ws1['!cols'] = [
    { wch: 22 }, // Codigo
    { wch: 42 }, // Titulo
    { wch: 18 }, // Nature
    { wch: 18 }, // Cantidad
    { wch: 24 }, // Monto Bs
    { wch: 20 }, // Monto USD
    { wch: 16 }, // Con soporte
    { wch: 22 }  // Cobertura
  ];

  // ----------------------------------------------------
  // HOJA 2: DETALLE DE OPERACIONES BANCARIAS POR REPOSITORIO
  // ----------------------------------------------------
  const ws2: any = {};
  const merges2: any[] = [];
  const rows2: any[] = [];

  function set2Cell(r: number, c: number, val: any, style: any, t: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws2[addr] = { t, v: val ?? '', s: style || {} };
  }

  function merge2(r1: number, c1: number, r2: number, c2: number, val: any, style: any, t: string = 's') {
    merges2.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        set2Cell(r, c, (r === r1 && c === c1) ? val : '', style, t);
      }
    }
  }

  let r2Idx = 0;
  merge2(r2Idx, 0, r2Idx, 11, 'DETALLE DE OPERACIONES BANCARIAS Y REPOSITORIOS ASIGNADOS', styleHeaderBanner);
  rows2.push({ hpt: 28 });
  r2Idx++;

  merge2(r2Idx, 0, r2Idx, 11, `EMPRESA: ${companyName} | TOTAL PARTIDAS BANCARIAS: ${bankTxs.length}`, styleSubBanner);
  rows2.push({ hpt: 20 });
  r2Idx++;

  rows2.push({ hpt: 10 });
  r2Idx++;

  const h2 = [
    'REPOSITORIO / CATEGORÍA',
    'FECHA',
    'BANCO',
    'REFERENCIA',
    'TIPO',
    'CONCEPTO BANCARIO / DESCRIPCIÓN',
    'RIF/CÉDULA',
    'MONTO NOMINAL (Bs.)',
    'EQUIV. USD ($)',
    'ESTADO PROBATORIO',
    'ARCHIVO ADJUNTO / COMPROBANTE',
    'NOTAS Y EXPLICACIÓN CONTABLE'
  ];
  h2.forEach((colTitle, c) => set2Cell(r2Idx, c, colTitle, styleTh));
  rows2.push({ hpt: 24 });
  r2Idx++;

  bankTxs.forEach((t, i) => {
    const modTitle = moduleCatalog.find(m => m.id === (t.moduleTag || 'MOD_HUERFANOS'))?.title || t.moduleTag || 'Carpeta de Huérfanos';
    const ves = t.amountVes || (t.currency === 'VES' ? t.amountNominal : t.amountNominal * bcvRate);
    const usd = t.amountUsdEquivalent || (t.currency === 'USD' ? t.amountNominal : t.amountNominal / bcvRate);
    const hasAtt = (t.attachments && t.attachments.length > 0) || t.matchingStatus === 'MATCHED_EXACT';
    const attName = t.attachments?.[0]?.name || (t.matchingStatus === 'MATCHED_EXACT' ? 'Auto-Conciliado exacto' : 'Sin archivo');

    const zebraStyle = i % 2 === 0 ? styleTdText : { ...styleTdText, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraCenter = i % 2 === 0 ? styleTdCenter : { ...styleTdCenter, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraNum = i % 2 === 0 ? styleTdNum : { ...styleTdNum, fill: { fgColor: { rgb: 'F8FAFC' } } };

    set2Cell(r2Idx, 0, modTitle, zebraStyle);
    set2Cell(r2Idx, 1, formatToVenezuelanDateHyphen(t.txDate), zebraCenter);
    set2Cell(r2Idx, 2, t.bankName, zebraStyle);
    set2Cell(r2Idx, 3, t.referenceNum, zebraCenter);
    set2Cell(r2Idx, 4, t.txType === 'DEBIT' ? 'Débito / Salida' : 'Crédito / Entrada', zebraCenter);
    set2Cell(r2Idx, 5, t.rawDescription, zebraStyle);
    set2Cell(r2Idx, 6, t.counterpartyRif || 'N/P', zebraCenter);
    set2Cell(r2Idx, 7, formatVenezuelanNumber(t.txType === 'DEBIT' ? -ves : ves), zebraNum);
    set2Cell(r2Idx, 8, formatVenezuelanNumber(t.txType === 'DEBIT' ? -usd : usd), zebraNum);
    set2Cell(r2Idx, 9, hasAtt ? '✅ CON SOPORTE' : '⚠️ HUÉRFANO / SIN SOPORTE', zebraCenter);
    set2Cell(r2Idx, 10, attName, zebraStyle);
    set2Cell(r2Idx, 11, t.notes || 'Asignado en estación de trabajo NOMINUS', zebraStyle);
    rows2.push({ hpt: 20 });
    r2Idx++;
  });

  ws2['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r2Idx, c: 11 } });
  ws2['!merges'] = merges2;
  ws2['!rows'] = rows2;
  ws2['!cols'] = [
    { wch: 34 }, // Repositorio
    { wch: 14 }, // Fecha
    { wch: 22 }, // Banco
    { wch: 18 }, // Referencia
    { wch: 16 }, // Tipo
    { wch: 48 }, // Concepto
    { wch: 16 }, // RIF
    { wch: 22 }, // Monto Bs
    { wch: 18 }, // Monto USD
    { wch: 24 }, // Estado
    { wch: 32 }, // Archivo
    { wch: 42 }  // Notas
  ];

  // ----------------------------------------------------
  // HOJA 3: INVENTARIO DE SOPORTES Y COMPROBANTES DIGITALES
  // ----------------------------------------------------
  const ws3: any = {};
  const merges3: any[] = [];
  const rows3: any[] = [];

  function set3Cell(r: number, c: number, val: any, style: any, t: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws3[addr] = { t, v: val ?? '', s: style || {} };
  }

  function merge3(r1: number, c1: number, r2: number, c2: number, val: any, style: any, t: string = 's') {
    merges3.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        set3Cell(r, c, (r === r1 && c === c1) ? val : '', style, t);
      }
    }
  }

  // Build unique map of all digital supports
  const supportMap = new Map<string, DigitalSupportAttachment>();
  digitalSupports.forEach(s => supportMap.set(s.id, s));
  bankTxs.forEach(t => {
    t.attachments?.forEach(s => supportMap.set(s.id, s));
  });

  const supportList = Array.from(supportMap.values());

  let r3Idx = 0;
  merge3(r3Idx, 0, r3Idx, 10, 'INVENTARIO DE SOPORTES Y COMPROBANTES DIGITALES EN REPOSITORIO', styleHeaderBanner);
  rows3.push({ hpt: 28 });
  r3Idx++;

  merge3(r3Idx, 0, r3Idx, 10, `EMPRESA: ${companyName} | TOTAL COMPROBANTES: ${supportList.length}`, styleSubBanner);
  rows3.push({ hpt: 20 });
  r3Idx++;

  rows3.push({ hpt: 10 });
  r3Idx++;

  const h3 = [
    'ID SOPORTE',
    'NOMBRE DEL ARCHIVO',
    'REPOSITORIO / CATEGORÍA',
    'BANCO EMISOR',
    'REFERENCIA EXTRAÍDA',
    'FECHA COMPROBANTE',
    'MONTO (Bs.)',
    'EQUIV. USD ($)',
    'IDENTIFICADOR TERCEIRO',
    'TIPO ARCHIVO',
    'EXPLICACIÓN CONTABLE / NOTAS IA'
  ];
  h3.forEach((colTitle, c) => set3Cell(r3Idx, c, colTitle, styleTh));
  rows3.push({ hpt: 24 });
  r3Idx++;

  supportList.forEach((s, i) => {
    const meta = s.extractedMetadata;
    const modTitle = moduleCatalog.find(m => m.id === (s.moduleTag || 'MOD_HUERFANOS'))?.title || s.moduleTag || 'Carpeta de Huérfanos';

    const zebraStyle = i % 2 === 0 ? styleTdText : { ...styleTdText, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraCenter = i % 2 === 0 ? styleTdCenter : { ...styleTdCenter, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const zebraNum = i % 2 === 0 ? styleTdNum : { ...styleTdNum, fill: { fgColor: { rgb: 'F8FAFC' } } };

    set3Cell(r3Idx, 0, s.id, zebraCenter);
    set3Cell(r3Idx, 1, s.name, zebraStyle);
    set3Cell(r3Idx, 2, modTitle, zebraStyle);
    set3Cell(r3Idx, 3, meta?.banco_origen || 'N/A', zebraStyle);
    set3Cell(r3Idx, 4, meta?.referencia_completa || meta?.referencia_ultimos_4 || 'Sin Ref', zebraCenter);
    set3Cell(r3Idx, 5, meta?.fecha || formatToVenezuelanDateHyphen(s.uploadedAt.split('T')[0]), zebraCenter);
    set3Cell(r3Idx, 6, formatVenezuelanNumber(meta?.monto || 0), zebraNum);
    set3Cell(r3Idx, 7, formatVenezuelanNumber(meta?.monto_usd_equivalente || 0), zebraNum);
    set3Cell(r3Idx, 8, meta?.identificador_tercero || 'N/P', zebraCenter);
    set3Cell(r3Idx, 9, s.fileType, zebraCenter);
    set3Cell(r3Idx, 10, meta?.audioContext || s.notes || 'Archivado en repositorio probatorio', zebraStyle);
    rows3.push({ hpt: 20 });
    r3Idx++;
  });

  ws3['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r3Idx, c: 10 } });
  ws3['!merges'] = merges3;
  ws3['!rows'] = rows3;
  ws3['!cols'] = [
    { wch: 18 }, // ID
    { wch: 36 }, // Nombre
    { wch: 32 }, // Categoria
    { wch: 22 }, // Banco
    { wch: 20 }, // Ref
    { wch: 16 }, // Fecha
    { wch: 20 }, // Monto Bs
    { wch: 18 }, // Monto USD
    { wch: 20 }, // Tercero
    { wch: 14 }, // Tipo
    { wch: 48 }  // Notas
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen_Por_Repositorios');
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle_Operaciones');
  XLSX.utils.book_append_sheet(wb, ws3, 'Inventario_De_Soportes');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const cleanRif = companyRif.replace(/[^A-Za-z0-9]/g, '');
  a.download = `REPOSITORIO_SOPORTES_Y_JUSTIFICACION_${cleanRif}_${timestamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * EXPORTACIÓN DEL MANUAL DE PROCEDIMIENTOS Y GUÍA DE USUARIO A WORD (.DOC)
 * Genera un documento Microsoft Word estructurado en lenguaje sencillo y claro.
 */
export function exportManualToWord(company: UserCompanyProfile): void {
  const companyName = company.companyName || 'EMPRESA CONTRIBUYENTE C.A.';
  const companyRif = company.companyRif || 'J-00000000-0';
  const now = new Date();
  const dateFormatted = formatToVenezuelanDateHyphen(now);

  const htmlContent = `
  <html xmlns:o='urn:schemas-microsoft-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset='utf-8'>
    <title>Manual de Procedimientos NOMINUS</title>
    <style>
      body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.6; margin: 30px; }
      h1 { font-size: 20pt; color: #0f2942; text-align: center; font-weight: bold; margin-bottom: 4px; }
      .subtitle { font-size: 11pt; color: #475569; text-align: center; font-weight: normal; margin-bottom: 25px; }
      .header-box { background-color: #0f2942; color: #ffffff; padding: 16px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
      .header-box h2 { font-size: 14pt; margin: 0; color: #ffffff; border: none; }
      h2 { font-size: 13pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin-top: 22px; }
      h3 { font-size: 11pt; color: #0f2942; font-weight: bold; margin-top: 14px; }
      p { margin-bottom: 10px; }
      ul, ol { margin-left: 20px; margin-bottom: 12px; }
      li { margin-bottom: 6px; }
      .step-box { background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px; margin: 12px 0; border-radius: 4px; }
      .tip-box { background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 12px 0; border-radius: 4px; }
      .warning-box { background-color: #fffbeb; border-left: 4px solid #d97706; padding: 12px; margin: 12px 0; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th { background-color: #1e3a8a; color: #ffffff; padding: 8px; font-size: 10pt; font-weight: bold; text-align: left; }
      td { border: 1px solid #cbd5e1; padding: 8px; font-size: 9.5pt; }
      .signature-table td { border: none; padding: 25px 10px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header-box">
      <h2>MANUAL DE PROCEDIMIENTOS Y POLÍTICAS CONTABLES OFICIALES</h2>
      <div class="subtitle" style="color:#e2e8f0; margin-top:5px;">SISTEMA CONTABLE Y CONCILIACIÓN BANCARIA INTELIGENTE VEN-NIF Y SGT</div>
    </div>

    <div style="background-color:#f1f5f9; padding:12px; border-radius:6px; font-size:10pt; margin-bottom:20px; border-left: 4px solid #0f2942;">
      <strong>EMPRESA CONTRIBUYENTE:</strong> ${companyName}<br>
      <strong>REGISTRO DE INFORMACIÓN FISCAL (RIF):</strong> ${companyRif}<br>
      <strong>FECHA DE EMISIÓN Y ADOPCIÓN:</strong> ${dateFormatted}<br>
      <strong>MARCO TÉCNICO Y REGULATORIO:</strong> Ven-NIF PYME | Providencias SENIAT 0071 y 2025/000054 | Normativa SUDEBAN Res. 010.25 | Ecuación de Partida Doble
    </div>

    <h2>CAPÍTULO 1: OBJETIVO, POLÍTICA DE CONTROL INTERNO Y ALCANCE</h2>
    <p>El presente manual tiene por objeto regular y estandarizar el proceso integral de conciliación bancaria, registro de movimientos y generación automática de asientos contables para la empresa <strong>${companyName}</strong>. Sus directrices son de cumplimiento obligatorio para todo el personal del departamento de administración, contabilidad y tesorería.</p>
    <ul>
      <li><strong>Principio de Partida Doble Estricta:</strong> Ningún asiento o cierre mensual puede generarse con descuadre. Todo movimiento contable debe satisfacer la ecuación: <code>Total Debe = Total Haber (Diferencia = Bs. 0,00)</code>.</li>
      <li><strong>Trazabilidad de Fondos y Soportes (SUDEBAN / SENIAT):</strong> Cada débito o crédito bancario debe estar justificado por su soporte documental (factura fiscal legal, comprobante de retención, recibo de caja chica o capture de transferencia/Pago Móvil).</li>
      <li><strong>Separación por Banco Emisor:</strong> Cada institución bancaria venezolana (Banco de Venezuela, Banesco, Mercantil, BNC, Bancamiga, Plaza) se rige por su código de cuenta específico asignado en el Plan de Cuentas Maestro.</li>
    </ul>

    <h2>CAPÍTULO 2: ARQUITECTURA DEL SISTEMA Y FLUJO OPERATIVO EN 3 PASOS</h2>
    <p>La aplicación ha sido diseñada bajo una diagramación fresca y descansada, permitiendo al usuario completar la conciliación y los asientos contables en 3 acciones directas:</p>
    
    <div class="step-box">
      <h3>ACCIÓN 1: Cargar Estado de Cuenta Bancario y Libro Mayor</h3>
      <p>El usuario accede al botón <strong>"1. Cargar Estado de Cuenta"</strong> y suministra la información mensual:</p>
      <ul>
        <li><strong>Formatos Aceptados:</strong> Archivos Excel (.xlsx, .xls), archivos separados por comas (.csv) o archivos de texto/PDF descargados directamente del portal bancario.</li>
        <li><strong>Lector Rápido por Portapapeles:</strong> Es posible copiar las filas directamente del banco y pegarlas en el recuadro blanco para su estructuración automática.</li>
        <li><strong>Validación de Saldos Iniciales:</strong> Se debe verificar que el saldo inicial del banco y el saldo inicial del mayor coincidan con el corte del mes inmediatamente anterior.</li>
      </ul>
    </div>

    <div class="step-box">
      <h3>ACCIÓN 2: Cruzar y Auto-Cuadrar con Reglas Venezolanas</h3>
      <p>Al presionar <strong>"2. Cruzar y Auto-Cuadrar"</strong>, el motor de conciliación ejecuta de forma instantánea:</p>
      <ul>
        <li><strong>Emparejamiento de Referencias:</strong> Cruce algorítmico por número de referencia bancaria (últimos 4 u 8 dígitos) y monto idéntico en Bolívares o Dólares.</li>
        <li><strong>Reconocimiento de Gastos Fijos:</strong> Comisiones bancarias, gastos de mantenimiento de cuenta, emisión de estados de cuenta y cobros de Pago Móvil se imputan automáticamente a la cuenta de egreso <code>6.1.2.5.02</code>.</li>
        <li><strong>Detección de Partidas en Tránsito:</strong> Identificación precisa de depósitos en tránsito y cheques no cobrados para la ecuación matemática de prueba de efectivo.</li>
      </ul>
    </div>

    <div class="step-box">
      <h3>ACCIÓN 3: Generación de Asientos para SGT Contable y ERP</h3>
      <p>Al presionar <strong>"3. Asientos SGT y Excel"</strong>, el sistema compila y descarga el libro de asientos contables conforme a las normas técnicas venezolanas.</p>
    </div>

    <h2>CAPÍTULO 3: ESTRUCTURA REGLAMENTARIA DE ASIENTOS SGT CONTABLE (3 HOJAS)</h2>
    <p>Para la carga automática en <strong>SGT Contable</strong> y sistemas ERP (Profit Plus, Gálac, Saint, Valery), el archivo Excel generado (<code>asientos_generados.xlsx</code>) contiene estrictamente 5 columnas y se desglosa en 3 hojas de cálculo:</p>

    <table>
      <thead>
        <tr>
          <th>Columna A</th>
          <th>Columna B</th>
          <th>Columna C</th>
          <th>Columna D</th>
          <th>Columna E</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>CUENTA CONTABLE</td>
          <td>DESCRIPCION</td>
          <td>TIPO (NC / ND)</td>
          <td>REFERENCIA</td>
          <td>MONTO (Bs.)</td>
        </tr>
      </tbody>
    </table>

    <div class="step-box">
      <h3>Hoja 1: Hoja de Entrada Contable Completa</h3>
      <p>Contiene la totalidad de los registros extraídos del estado de cuenta bancario, clasificados con su respectiva cuenta contable y manteniendo el signo original de los valores (positivos y negativos en la misma columna de monto).</p>
    </div>

    <div class="step-box">
      <h3>Hoja 2: Notas de Crédito (NC - Montos Positivos / Ingresos)</h3>
      <ol>
        <li>Filtra exclusivamente todas las transacciones con monto positivo extraídas del extracto.</li>
        <li>Asigna el código de cuenta contable del Banco correspondiente (ejemplo: <code>1.1.1.2.10</code>, <code>1.1.1.2.20</code>, <code>1.1.1.2.30</code> o <code>1.1.1.2.60</code>) y coloca <code>NC</code> en la columna TIPO.</li>
        <li><strong>Fila de Contrapartida Obligatoria al Final:</strong> Al término de la lista, se adiciona una fila de contrapartida con:
          <ul>
            <li><strong>Cuenta Contable:</strong> <code>1.1.2.1.10</code> (Cuentas por cobrar).</li>
            <li><strong>Descripción:</strong> "Cuentas por cobrar (contrapartida NC)".</li>
            <li><strong>Tipo:</strong> NC.</li>
            <li><strong>Referencia:</strong> "RES-[Fecha de Cierre]".</li>
            <li><strong>Monto:</strong> La sumatoria total de los ingresos pero en signo <strong>NEGATIVO (-)</strong>.</li>
          </ul>
        </li>
        <li><strong>Validación Matemática:</strong> La sumatoria de la columna Monto debe resultar <strong>exactamente 0,00</strong>.</li>
      </ol>
    </div>

    <div class="step-box">
      <h3>Hoja 3: Notas de Débito (ND - Montos Negativos / Egresos)</h3>
      <ol>
        <li>Filtra exclusivamente todas las filas de débito o salida de fondos.</li>
        <li>Se asientan en primer lugar las partidas con signo positivo (+) asignadas a sus cuentas de gasto o pasivo correspondientes (Proveedores <code>2.1.1.1.10</code>, Comisiones <code>6.1.2.5.02</code>, Impuestos, etc.) y Tipo <code>ND</code>.</li>
        <li>A continuación, se duplican exactamente las mismas partidas pero con signo <strong>NEGATIVO (-)</strong> y asignadas a la cuenta contable del Banco (ejemplo: <code>1.1.1.2.60</code>, <code>1.1.1.2.20</code>, etc.).</li>
        <li><strong>Validación Matemática:</strong> El asiento contable cumple la doble partida y su sumatoria total cierra exactamente en <strong>0,00</strong>.</li>
      </ol>
    </div>

    <div class="tip-box">
      <strong>Regla de Formato Numérico Venezolano:</strong> Todos los importes monetarios deben formatearse con dos (2) decimales, utilizando el punto (.) como separador de miles y la coma (,) como separador decimal: <code>-1.234,10</code> y <code>1.234,10</code>.
    </div>

    <h2>CAPÍTULO 4: MANUAL OPERATIVO DEL PANEL DE MÓDULOS SGT (LOS 13 MÓDULOS)</h2>
    <p>A continuación se describe de manera clara y sencilla el propósito, uso paso a paso y fundamento legal de cada uno de los 13 módulos del Panel Operativo SGT:</p>

    <div class="step-box">
      <h3>1. Movimientos Huérfanos por Aclarar (Modo Rápido 1 Clic - PENDIENTES_ACLARAR)</h3>
      <p><strong>Objetivo:</strong> Clasificar con 1 solo clic los débitos y créditos bancarios que no tienen contrapartida identificada, evitando que el SENIAT los presuma como ingresos gravables omitidos (COT, Art. 129).</p>
      <p><strong>Cómo se usa:</strong> El usuario abre la bandeja de huérfanos, observa el monto y concepto del banco, y presiona el botón directo correspondiente: [Proveedor], [Socio], [Gasto Menor], [Venta] o [Consultar por Telegram al Socio]. El movimiento sale de la lista y se incorpora al libro diario de forma automática.</p>
    </div>

    <div class="step-box">
      <h3>2. Bóveda de Conciliaciones Mensuales (MONTHLY_RECONCILIATION_VAULT)</h3>
      <p><strong>Objetivo:</strong> Archivo histórico de cierres contables mensuales bajo Ven-NIF, cumpliendo con la obligación del Código de Comercio venezolano (Art. 44) de conservar libros y respaldos por 10 años.</p>
      <p><strong>Cómo se usa:</strong> Permite consultar meses pasados (ejemplo: Enero 2026, Febrero 2026, Septiembre 2025), reimprimir la Cédula oficial y restaurar un punto de control si se requiere auditar transacciones pasadas.</p>
    </div>

    <div class="step-box">
      <h3>3. Mesa de Trabajo de Conciliación Bancaria (5 Etapas / Split-Screen - RECONCILIATION)</h3>
      <p><strong>Objetivo:</strong> Comparar visualmente en pantalla dividida el Extracto Bancario (izquierda) y el Libro Mayor (derecha) conforme a la Ven-NIF PYME Sección 7.</p>
      <p><strong>Cómo se usa:</strong> Permite buscar partidas por monto o referencia, emparejar transacciones manualmente, conciliar diferencias de céntimos y auditar las 5 etapas del cierre.</p>
    </div>

    <div class="step-box">
      <h3>4. Cédula Oficial de Conciliación Ven-NIF (RECONCILIATION_RESULTS)</h3>
      <p><strong>Objetivo:</strong> Dictamen formal y carátula de conciliación bancaria en 4 columnas exigida por comisarios mercantiles, bancos y auditores de la FCCPV.</p>
      <p><strong>Cómo se usa:</strong> Muestra la fórmula matemática: Saldo Banco + Depósitos en Tránsito - Cheques en Tránsito = Saldo Libros (Diferencia = Bs. 0,00) y descarga la portada ejecutiva en Excel (.xlsx) con firmas de auditoría.</p>
    </div>

    <div class="step-box">
      <h3>5. Asistente de Asientos Contables y Ajustes por IA (AI_ASSISTANT)</h3>
      <p><strong>Objetivo:</strong> Normalizar conceptos bancarios abreviados y generar los asientos de ajuste en partida doble para cargos bancarios no registrados.</p>
      <p><strong>Cómo se usa:</strong> Pega el texto del banco o libro mayor; el motor de IA identifica la contraparte, propone el asiento (Debe/Haber) y con un clic lo incorpora al libro diario.</p>
    </div>

    <div class="step-box">
      <h3>6. Arqueos de Caja y Traza de Efectivo en Bs. y Divisas (CASH_TRAIL)</h3>
      <p><strong>Objetivo:</strong> Control del dinero físico (Bolívares y Dólares), fondo de caja chica, conteo de billetes por denominación y soporte para depósitos bancarios.</p>
      <p><strong>Cómo se usa:</strong> El cajero apertura turno con el fondo fijo, anota ventas en efectivo y gastos menores con vale, cuenta las piezas de billetes ($100, $50, $20, etc.) y genera la planilla de depósito bancario con cuadre a 0,00.</p>
    </div>

    <div class="step-box">
      <h3>7. Módulo Fiscal SENIAT e Impuestos (SENIAT_TAX)</h3>
      <p><strong>Objetivo:</strong> Cumplimiento de retenciones de IVA (75%/100% Prov. SNAT/2025/000054), IGTF, retenciones de ISLR y Ley de Pensiones.</p>
      <p><strong>Cómo se usa:</strong> Agrupa todos los pagos al SENIAT, valida las retenciones practicadas y genera el archivo plano oficial .TXT para la carga masiva en el portal del SENIAT.</p>
    </div>

    <div class="step-box">
      <h3>8. Escudo SUDEBAN 010.25 y Prevención AML (SUDEBAN_AML)</h3>
      <p><strong>Objetivo:</strong> Blindaje ante bloqueos de cuentas y requerimientos de la UNIF / SUDEBAN conforme a la Resolución 010.25 sobre Administración de Riesgos LC/FT/FPADM.</p>
      <p><strong>Cómo se usa:</strong> Monitorea transacciones que superen umbrales de alerta, clasifica el perfil de riesgo de clientes/proveedores y emite el Dossier de Cumplimiento Bancario.</p>
    </div>

    <div class="step-box">
      <h3>9. Justificación de Fondos y 16 Repositorios Digitales (JUSTIFICATION_MODULES)</h3>
      <p><strong>Objetivo:</strong> Organizar los movimientos bancarios en 16 carpetas temáticas con fotos y documentos probatorios de deducibilidad (LISLR Arts. 86 y 87).</p>
      <p><strong>Cómo se usa:</strong> Al terminar el cuadre, presiona "Transferir a Repositorios", revisa cada carpeta temática y descarga la matriz de justificación en Excel de 3 hojas para inspecciones fiscales.</p>
    </div>

    <div class="step-box">
      <h3>10. Contratos Legales y Bóveda de Socios (LEGAL_CONTRACTS)</h3>
      <p><strong>Objetivo:</strong> Instrumentar contractualmente las transferencias entre accionistas y la empresa mediante contratos de mutuo conforme al Código de Comercio venezolano.</p>
      <p><strong>Cómo se usa:</strong> Selecciona el tipo de préstamo, ingresa el porcentaje y plazo del socio, y el sistema redacta el contrato legal listo para firmar y notarizar, evitando presunciones de dividendos encubiertos.</p>
    </div>

    <div class="step-box">
      <h3>11. Expediente y Bóveda Criptográfica SHA-256 (AUDIT_VAULT)</h3>
      <p><strong>Objetivo:</strong> Sellar con huella digital matemática inmutable cada cierre mensual bajo la Ley de Mensajes de Datos y Firmas Electrónicas.</p>
      <p><strong>Cómo se usa:</strong> Presiona "Sellar Cierre Mensual con SHA-256"; el sistema calcula el hash irreversible de 64 caracteres, garantizando que los libros no puedan ser alterados sin detección.</p>
    </div>

    <div class="step-box">
      <h3>12. Centro de Exportación ERP y Sistemas Contables (ERP_EXPORT)</h3>
      <p><strong>Objetivo:</strong> Exportar los asientos conciliados para carga automática en software venezolano: SGT Contable, Profit Plus, Gálac, Saint, Valery y Excel.</p>
      <p><strong>Cómo se usa:</strong> Selecciona la tarjeta de tu sistema contable, descarga el archivo en su formato nativo (.xlsx, .txt, .csv) e impórtalo en tu libro diario principal.</p>
    </div>

    <div class="step-box">
      <h3>13. Reglas Contables de Bancos Venezolanos (BANK_RULES)</h3>
      <p><strong>Objetivo:</strong> Diccionario normativo con los planes de cuentas de Banco Mercantil, Bancamiga, Banco de Venezuela, Banco Plaza, BNC y Banesco.</p>
      <p><strong>Cómo se usa:</strong> Consulta la asignación de cuentas contables específicas por concepto bancario (SGLBTR, BioPago, CCE, Masterdebit, P2C, Domiciliaciones).</p>
    </div>

    <h2>CAPÍTULO 5: MANUAL DE PROCEDIMIENTOS: CONEXIÓN TELEGRAM Y DISTRIBUCIÓN DE SOPORTES</h2>
    <p>Este procedimiento regula la recepción automatizada de comprobantes de pago por Telegram y su incorporación al expediente contable:</p>

    <div class="step-box">
      <h3>Fase 1: Configuración Técnica del Bot de Telegram</h3>
      <ol>
        <li>Abrir la aplicación Telegram y buscar la cuenta oficial <strong>@BotFather</strong>.</li>
        <li>Enviar el comando <code>/newbot</code>, asignar nombre al bot (ejemplo: <em>Cobranzas Empresa C.A.</em>) y un usuario que termine en "bot" (ejemplo: <code>empresa_pagos_bot</code>).</li>
        <li>Copiar el <strong>Token HTTP API</strong> entregado por @BotFather (ej. <code>7123456789:AAH...</code>).</li>
        <li>En NOMINUS, hacer clic en el botón de Telegram en la barra superior, pegar el Token en la pestaña <em>Configuración</em> y presionar <strong>"Probar Conexión"</strong>.</li>
        <li>Configurar el <strong>Chat ID</strong> del grupo de cobranza de la empresa para sincronización automática.</li>
      </ol>
    </div>

    <div class="step-box">
      <h3>Fase 2: Procedimiento de Envío y Recepción de Soportes</h3>
      <ol>
        <li>El cliente, vendedor o cajero toma una fotografía o captura de pantalla del Pago Móvil, transferencia bancaria, recibo de punto de venta o factura y la envía por chat al Bot de Telegram.</li>
        <li>NOMINUS se conecta en tiempo real al bot, descarga el archivo multimedia en alta calidad y registra la marca de tiempo (timestamp) y el remitente.</li>
        <li>El motor de <strong>Inteligencia Artificial (OCR Contable)</strong> procesa la imagen y extrae:
          <ul>
            <li>Banco Emisor y Receptor (Banesco, BDV, Mercantil, BNC, Bancamiga, Plaza, etc.).</li>
            <li>Número de Referencia de la operación.</li>
            <li>Monto en Bolívares y su equivalente en Dólares según la Tasa Oficial BCV.</li>
            <li>Fecha y hora de la transacción.</li>
            <li>Identificación del pagador o beneficiario (Cédula / RIF y Nombre).</li>
          </ul>
        </li>
      </ol>
    </div>

    <div class="step-box">
      <h3>Fase 3: Distribución Automática en la Aplicación</h3>
      <ol>
        <li><strong>Emparejamiento Bancario:</strong> El sistema compara la referencia y el monto extraído con las partidas del extracto bancario cargado. Al hallar coincidencia exacta, enlaza el soporte a la transacción y le asigna el estado <code>✅ CON SOPORTE</code>.</li>
        <li><strong>Distribución en las 16 Carpetas Temáticas:</strong> El comprobante se almacena automáticamente en su repositorio correspondiente: Ventas (<code>MOD_VENTAS</code>), Puntos de Venta (<code>MOD_POS</code>), Proveedores (<code>MOD_PROVEEDORES</code>), Pagos SENIAT (<code>MOD_SENIAT_PAGO</code>), Cuentas Socios (<code>MOD_SOCIOS_IN</code>), Nómina (<code>MOD_NOMINA</code>), etc.</li>
        <li><strong>Gestión de Huérfanos:</strong> Si el capture no coincide con ninguna partida bancaria en el extracto, pasa a la <strong>Carpeta de Huérfanos (MOD_HUERFANOS)</strong>.</li>
        <li><strong>Consulta Interactiva a Telegram:</strong> Desde la app se puede enviar una consulta automática al celular del socio o director con botones interactivos para que confirme a qué corresponde el pago con un solo toque desde su Telegram.</li>
        <li><strong>Inventario Probatorio en Excel:</strong> Todos los comprobantes sincronizados quedan inventariados en la Hoja 3 del reporte Excel para auditorías del SENIAT y SUDEBAN.</li>
      </ol>
    </div>

    <h2>CAPÍTULO 6: MATRIZ DE PLAN DE CUENTAS POR BANCO VENEZOLANO</h2>
    <p>A continuación se detallan las cuentas contables maestras y reglas de asignación por cada institución financiera:</p>

    <table>
      <thead>
        <tr>
          <th>Banco e Institución</th>
          <th>Cuenta Banco</th>
          <th>Proveedores / Pasivo</th>
          <th>Comisiones Bancarias</th>
          <th>Cuentas Socios</th>
          <th>Impuestos y SENIAT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Banco Mercantil (0105)</strong></td>
          <td>1.1.1.2.60</td>
          <td>2.1.1.1.10 (SGLBTR, OSGLBTR)</td>
          <td>6.1.2.5.02 / 6.1.2.5.03</td>
          <td>1.1.2.2.30</td>
          <td>1.2.4.2.30 (Anticipo) / 2.1.2.3.15 (IVA) / 6.1.1.2.19 (Pensiones)</td>
        </tr>
        <tr>
          <td><strong>Bancamiga (0172)</strong></td>
          <td>1.1.1.2.20</td>
          <td>2.1.1.1.10 (Masterdebit)</td>
          <td>6.1.2.5.02 (LBTR, P2C, SMS)</td>
          <td>1.1.2.2.30</td>
          <td>6.1.2.1.15 (Teléf) / 6.1.2.1.20 (Luz) / 6.1.2.1.06 (Combust.)</td>
        </tr>
        <tr>
          <td><strong>Banco de Venezuela (0102)</strong></td>
          <td>1.1.1.2.30 / 1.1.1.2.20</td>
          <td>2.1.1.1.10 (Domiciliación, OP)</td>
          <td>6.1.2.5.02 (Banca Móvil, P2P)</td>
          <td>2.1.1.3.15 / 1.1.2.2.30</td>
          <td>2.1.2.3.10 (Retenciones ISLR) / 1.1.2.1.10 (CxC Contrapartida)</td>
        </tr>
        <tr>
          <td><strong>Banco Plaza (0138)</strong></td>
          <td>1.1.1.2.10</td>
          <td>2.1.1.1.10 (Transf, Prov Plaza)</td>
          <td>6.1.2.5.02 / 6.1.2.5.03</td>
          <td>1.1.2.2.30</td>
          <td>6.1.2.1.64 (Timbres) / 6.1.2.1.25 (Seguros)</td>
        </tr>
        <tr>
          <td><strong>Banco BNC (0191)</strong></td>
          <td>1.1.1.2.40 / 1.1.1.2.50</td>
          <td>2.1.1.1.10</td>
          <td>6.1.2.5.02 (Comisión Créd. Inmdto)</td>
          <td>1.1.2.2.30</td>
          <td>99044 ISLR (1.2.4.2.30) / 99019 Pensiones (6.1.1.2.19)</td>
        </tr>
        <tr>
          <td><strong>Banco Banesco (0134)</strong></td>
          <td>1.1.1.2.10</td>
          <td>2.1.1.1.10</td>
          <td>6.1.2.5.02</td>
          <td>1.1.2.2.30</td>
          <td>1.1.2.1.10 (Cuentas por cobrar contrapartida NC)</td>
        </tr>
      </tbody>
    </table>

    <h2>CAPÍTULO 7: PROTOCOLO DE CIERRE MENSUAL Y EMISIÓN DE CÉDULA VEN-NIF</h2>
    <p>Al cierre de cada ejercicio mensual, el departamento contable ejecutará las siguientes validaciones:</p>
    <ol>
      <li>Verificar que el saldo conciliado de bancos sea matemáticamente igual al saldo del mayor general contable (Diferencia = Bs. 0,00).</li>
      <li>Descargar la <strong>Cédula de Cuadre y Portada de Conciliación en Excel (.xlsx)</strong>, la cual contiene la ecuación formal, el estado de prueba de efectivo de 4 columnas y el dictamen de auditoría.</li>
      <li>Archivar el expediente digital mensual en la <strong>Bóveda Criptográfica SHA-256</strong> para resguardo inalterable.</li>
      <li>Imprimir y suscribir la presente planilla de aprobación formal.</li>
    </ol>

    <h2>APROBACIÓN FORMAL Y FIRMAS DE CONFORMIDAD</h2>
    <p>El presente Manual de Procedimientos y Políticas Contables entra en vigencia a partir de su firma y regirá para todos los cierres bancarios del ejercicio económico:</p>

    <table class="signature-table">
      <tr>
        <td style="width: 50%;">
          __________________________________________________<br>
          <strong>GERENCIA DE ADMINISTRACIÓN Y FINANZAS</strong><br>
          Representante Legal / Gerente General<br>
          Empresa: ${companyName}<br>
          RIF: ${companyRif}<br>
          Fecha: ${dateFormatted}
        </td>
        <td style="width: 50%;">
          __________________________________________________<br>
          <strong>CONTADOR PÚBLICO COLEGIADO (C.P.C.)</strong><br>
          Contador General / Auditor Externo<br>
          Colegio de Contadores Públicos de Venezuela<br>
          Matrícula C.P.C. N°: _____________________<br>
          Fecha: ${dateFormatted}
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanRif = companyRif.replace(/[^A-Za-z0-9]/g, '');
  a.download = `MANUAL_DE_PROCEDIMIENTOS_NOMINUS_${cleanRif}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Exportador Oficial a Excel de Arqueo de Caja y Gastos Detallados para el SENIAT
export function exportCashLogToExcel(
  company: UserCompanyProfile,
  cashLog: CashLogRecord,
  bcvRate: number
) {
  const companyName = company?.companyName || 'MI EMPRESA, C.A.';
  const companyRif = company?.companyRif || 'J-00000000-0';
  const currencySym = cashLog.currency === 'VES' ? 'Bs.' : '$';

  const expensesRowsHtml = (cashLog.expenseItems || []).map((exp: PettyCashExpenseItem, idx: number) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${exp.concept}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${exp.category || 'Gasto General'}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${exp.receiptNum || 'N/A'}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: bold; color: #991b1b;">
        ${currencySym} ${formatVenezuelanNumber(exp.amount)}
      </td>
    </tr>
  `).join('');

  const billsRowsHtml = (cashLog.billsDetails || []).map((b: CashDenominationCount) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">Billete ${currencySym} ${b.denomination}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${b.count}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: bold; color: #065f46;">
        ${currencySym} ${formatVenezuelanNumber(b.total)}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
      .header-title { font-size: 14px; font-weight: bold; text-align: center; background-color: #0f172a; color: #ffffff; padding: 10px; }
      .section-header { font-size: 11px; font-weight: bold; background-color: #f1f5f9; color: #0f172a; padding: 8px; border: 1px solid #94a3b8; }
      .number { text-align: right; font-family: monospace; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <tr>
        <td colspan="5" class="header-title">ACTA OFICIAL DE ARQUEO DE CAJA, GASTOS DETALLADOS Y REMESA BANCARIA</td>
      </tr>
      <tr>
        <td colspan="5" style="text-align: center; font-size: 10px; color: #475569; padding-bottom: 10px;">
          AUDITORÍA FISCAL DE CAJA CHICA Y RECAUDACIÓN — CUMPLIMIENTO SENIAT Y VEN-NIF
        </td>
      </tr>
      <tr>
        <td style="font-weight: bold;">EMPRESA / RAZÓN SOCIAL:</td>
        <td colspan="2">${companyName}</td>
        <td style="font-weight: bold;">RIF:</td>
        <td>${companyRif}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">RESPONSABLE / CAJERO:</td>
        <td colspan="2">${cashLog.cashier}</td>
        <td style="font-weight: bold;">TURNO / FECHA:</td>
        <td>${cashLog.shift} — ${cashLog.date}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">MONEDA DE CAJA:</td>
        <td colspan="2">${cashLog.currency} (${currencySym})</td>
        <td style="font-weight: bold;">TASA BCV HOY:</td>
        <td>Bs. ${formatVenezuelanNumber(bcvRate)} / USD</td>
      </tr>
    </table>

    <table>
      <tr>
        <td colspan="2" class="section-header">RESUMEN Y DIAGNÓSTICO DE CUADRE DE CAJA</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">(+) Fondo Inicial de Caja:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;" class="number">${currencySym} ${formatVenezuelanNumber(cashLog.initialBalance)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">(+) Ventas / Recaudación en Efectivo:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; color: #065f46;" class="number">${currencySym} ${formatVenezuelanNumber(cashLog.totalSales)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">(-) Total Gastos / Compras Detalladas (Caja Chica):</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; color: #991b1b;" class="number">${currencySym} ${formatVenezuelanNumber(cashLog.pettyCashExpenses)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; background-color: #f8fafc;">(=) TOTAL ESPERADO EN CAJA:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; background-color: #f8fafc;" class="number">${currencySym} ${formatVenezuelanNumber(cashLog.expectedTotal)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; background-color: #ecfdf5;">TOTAL FÍSICO CONTADO EN BILLETES:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; background-color: #ecfdf5; color: #065f46;" class="number">${currencySym} ${formatVenezuelanNumber(cashLog.physicalCount)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">DIFERENCIA DE ARQUEO:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;" class="number font-mono">
          ${cashLog.difference === 0 ? '✓ CUADRADO (0,00)' : `${cashLog.difference > 0 ? '+ SOBRANTE:' : '- FALTANTE:'} ${currencySym} ${formatVenezuelanNumber(Math.abs(cashLog.difference))}`}
        </td>
      </tr>
    </table>

    <table>
      <thead>
        <tr>
          <td colspan="5" class="section-header">RELACIÓN DETALLADA DE GASTOS Y COMPRAS EN EFECTIVO (CAJA CHICA)</td>
        </tr>
        <tr style="background-color: #fee2e2; font-weight: bold; border: 1px solid #fca5a5;">
          <td style="padding: 6px; text-align: center;">N°</td>
          <td style="padding: 6px;">CONCEPTO DE COMPRA / GASTO</td>
          <td style="padding: 6px;">CATEGORÍA</td>
          <td style="padding: 6px; text-align: center;">VALE / FACTURA FISCAL</td>
          <td style="padding: 6px; text-align: right;">MONTO (${currencySym})</td>
        </tr>
      </thead>
      <tbody>
        ${expensesRowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 8px;">Sin gastos en efectivo registrados</td></tr>'}
      </tbody>
    </table>

    <table>
      <thead>
        <tr>
          <td colspan="3" class="section-header">CONTEO DE BILLETES FÍSICOS POR DENOMINACIÓN</td>
        </tr>
        <tr style="background-color: #d1fae5; font-weight: bold; border: 1px solid #6ee7b7;">
          <td style="padding: 6px; text-align: center;">DENOMINACIÓN DE BILLETE</td>
          <td style="padding: 6px; text-align: center;">CANTIDAD PIEZAS</td>
          <td style="padding: 6px; text-align: right;">SUBTOTAL (${currencySym})</td>
        </tr>
      </thead>
      <tbody>
        ${billsRowsHtml || '<tr><td colspan="3" style="text-align: center; padding: 8px;">Sin conteo registrado</td></tr>'}
      </tbody>
    </table>

    <table>
      <tr>
        <td colspan="2" class="section-header">DESTINO Y DESPACHO DE LOS FONDOS</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">DESTINO DE FONDOS:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${cashLog.bankTarget || 'Caja Fuerte / Bóveda'}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">N° PLANILLA DE DEPÓSITO BANCARIO:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${cashLog.bankDepositRef || 'RETENIDO EN BÓVEDA'}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">ESTADO DEL DESPACHO:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${cashLog.depositStatus === 'EN_CAJA' ? 'Conservado en Caja Fuerte' : 'Despachado a Banco'}</td>
      </tr>
    </table>

    <br><br>
    <table>
      <tr>
        <td style="text-align: center; width: 50%;">
          _______________________________________<br>
          <strong>${cashLog.cashier}</strong><br>
          Cajero / Responsable de Caja<br>
          Fecha: ${cashLog.date}
        </td>
        <td style="text-align: center; width: 50%;">
          _______________________________________<br>
          <strong>GERENCIA DE FINANZAS Y AUDITORÍA</strong><br>
          Aprobado y Verificado<br>
          Firma y Sello Fiscal de la Empresa
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanCashier = cashLog.cashier.replace(/[^A-Za-z0-9]/g, '_');
  a.download = `ARQUEO_DE_CAJA_SENIAT_${cleanCashier}_${cashLog.date}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



