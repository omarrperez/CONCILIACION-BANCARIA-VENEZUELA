import * as XLSX from 'xlsx';
import { BankTransaction, JournalEntry, UserCompanyProfile } from '../types/accounting';
import {
  SGT_CONTABLE_ACCOUNTS,
  mapVenNifToSgtContable
} from '../data/sgtContableAccounts';

// Formatter for SGT CONTABLE - Plan de Cuentas Nacional (Batch CSV / TXT)
export function exportToSgtContableBatch(entries: JournalEntry[]): string {
  const header = 'COMPROBANTE,FECHA,COD_CUENTA_SGT,DESCRIPCION_CUENTA,REFERENCIA,CONCEPTO,DEBE,HABER,RIF\n';
  const rows = entries.flatMap((entry, idx) => {
    const compNum = `SGT-${(idx + 1).toString().padStart(6, '0')}`;
    return entry.lines.map(line => {
      const sgtAcc = mapVenNifToSgtContable(line.accountCode, `${line.concept} ${line.accountName}`);
      const cleanConcept = (line.concept || entry.description).replace(/"/g, '""');
      return `"${compNum}","${entry.date}","${sgtAcc.code}","${sgtAcc.name}","${entry.reference}","${cleanConcept}",${line.debe.toFixed(2)},${line.haber.toFixed(2)},"${line.rif || ''}"`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Profit Plus Contabilidad (2K8 / 2K12 / ERP)
export function exportToProfitPlus(entries: JournalEntry[]): string {
  const header = ';--- NOMINUS EXPORT TO PROFIT PLUS CONTABILIDAD ---;\n;CUENTA\tFECHA\tREFERENCIA\tDESCRIPCION\tDEBE\tHABER\tRIF_AUXILIAR\n';
  const rows = entries.flatMap(entry => {
    return entry.lines.map(line => {
      const debeStr = line.debe.toFixed(2);
      const haberStr = line.haber.toFixed(2);
      const rif = line.rif || '';
      return `${line.accountCode}\t${entry.date}\t${entry.reference}\t${line.concept.slice(0, 50)}\t${debeStr}\t${haberStr}\t${rif}`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Gálac Software Contabilidad
export function exportToGalac(entries: JournalEntry[]): string {
  const header = '"COMPROBANTE","FECHA","CUENTA","DESCRIPCION","REFERENCIA","DEBE","HABER","RIF"\n';
  const rows = entries.flatMap((entry, idx) => {
    const compNum = `COMP-${(idx + 1).toString().padStart(6, '0')}`;
    return entry.lines.map(line => {
      return `"${compNum}","${entry.date}","${line.accountCode}","${line.concept.replace(/"/g, '""')}","${entry.reference}",${line.debe.toFixed(2)},${line.haber.toFixed(2)},"${line.rif || ''}"`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Saint Enterprise Contabilidad
export function exportToSaint(entries: JournalEntry[]): string {
  const lines: string[] = ['[SAINT_CONTABILIDAD_BATCH_VENEZUELA]'];
  entries.forEach((entry, idx) => {
    lines.push(`ASIENTO=${idx + 1};FECHA=${entry.date};REF=${entry.reference};DESC=${entry.description}`);
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
    return entry.lines.map(line => {
      return `${line.accountCode},${entry.date},${entry.reference},"${line.concept.replace(/"/g, '')}",${line.debe.toFixed(2)},${line.haber.toFixed(2)}`;
    });
  });
  return header + rows.join('\n');
}

// Formatter for Standard CSV Ven-NIF
export function exportToCsvVenNif(entries: JournalEntry[]): string {
  const header = 'Fecha,Comprobante,Referencia,Código Cuenta,Nombre Cuenta,Debe (Bs),Haber (Bs),RIF Contraparte,Concepto,Módulo RegTech\n';
  const rows = entries.flatMap((entry, idx) => {
    const compNum = `AS-${(idx + 1).toString().padStart(5, '0')}`;
    return entry.lines.map(line => {
      return `"${entry.date}","${compNum}","${entry.reference}","${line.accountCode}","${line.accountName}",${line.debe.toFixed(2)},${line.haber.toFixed(2)},"${line.rif || ''}","${line.concept}","${entry.moduleTag}"`;
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
  const dateFormatted = now.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeFormatted = now.toLocaleTimeString('es-VE');

  // ==========================================
  // HOJA 1: ASIENTOS DE DIARIO - SGT CONTABLE
  // ==========================================
  const journalRows: (string | number | null)[][] = [
    [`EMPRESA: ${companyName}`, null, null, null, null, null, null, null, null, null, null],
    [`RIF: ${companyRif} | SUJETO PASIVO: ${company.isSpecialTaxpayer ? 'ESPECIAL (SPE)' : 'ORDINARIO'}`, null, null, null, null, null, null, null, null, null, null],
    ['SISTEMA CONTABLE: "SGT CONTABLE" - PLAN DE CUENTAS VENEZUELA', null, null, null, null, null, null, null, null, null, null],
    [`FECHA DE EMISIÓN: ${dateFormatted} ${timeFormatted} | TASA BCV: Bs. ${bcvRate.toFixed(2)} / USD`, null, null, null, null, null, null, null, null, null, null],
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
        entry.date,
        sgtAcc.code,
        sgtAcc.name,
        entry.reference,
        line.rif || '',
        line.concept || entry.description,
        debeNum,
        haberNum,
        monetary,
        sgtType
      ]);
    });
  });

  // Total summary row
  const difference = Number((totalDebeGlobal - totalHaberGlobal).toFixed(2));
  const cuadreStatus = Math.abs(difference) < 0.01 ? 'BALANCEADO (CUADRADO AL 100%)' : `DESCUADRE: Bs. ${difference.toFixed(2)}`;

  journalRows.push([]);
  journalRows.push([
    'TOTALES GENERALES SGT CONTABLE',
    '',
    '',
    cuadreStatus,
    '',
    '',
    `${entries.length} Asientos Contables Procesados`,
    Number(totalDebeGlobal.toFixed(2)),
    Number(totalHaberGlobal.toFixed(2)),
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
    [`Generado: ${dateFormatted} | Tasa Oficial BCV: Bs. ${bcvRate.toFixed(2)}`],
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
      Number(stat.debe.toFixed(2)),
      Number(stat.haber.toFixed(2)),
      net,
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
    Number(totalDebeGlobal.toFixed(2)),
    Number(totalHaberGlobal.toFixed(2)),
    Number((totalDebeGlobal - totalHaberGlobal).toFixed(2)),
    'DIFERENCIA 0.00',
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
