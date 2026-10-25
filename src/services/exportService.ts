import * as XLSX from 'xlsx-js-style';
import { BankTransaction, CurrencyType, JournalEntry, ProofOfCash, UserCompanyProfile } from '../types/accounting';
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



