import { VenNifAccount } from '../types/accounting';

export const VEN_NIF_ACCOUNTS: VenNifAccount[] = [
  // 1. ACTIVO
  {
    code: '1.1.01.01.001',
    name: 'Caja Principal Moneda Nacional',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Efectivo físico en Bolívares en custodia de caja general.'
  },
  {
    code: '1.1.01.01.002',
    name: 'Caja Moneda Extranjera (USD)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Efectivo físico en divisas (USD) resguardado bajo serialización SUDEBAN.'
  },
  {
    code: '1.1.01.01.003',
    name: 'Caja Chica Administrativa',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Fondo fijo para pagos menores exentos o sujetos a límite de 20 U.T.'
  },
  {
    code: '1.1.01.02.001',
    name: 'Banesco Banco Universal (Cta Corriente Bs)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Cuenta corriente operativa en Bolívares Banco 0134.'
  },
  {
    code: '1.1.01.02.002',
    name: 'Banco Mercantil C.A. (Cta Corriente Bs)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Cuenta corriente operativa en Bolívares Banco 0105.'
  },
  {
    code: '1.1.01.02.003',
    name: 'Banco de Venezuela S.A. (Cta Corriente Bs)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Cuenta corriente operativa fiscal y nómina Banco 0102.'
  },
  {
    code: '1.1.01.02.004',
    name: 'Banco Nacional de Crédito BNC (Bs)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Cuenta corriente operativa Banco 0191.'
  },
  {
    code: '1.1.01.02.005',
    name: 'Bancamiga Banco Universal (Bs/Moneda Extranjera)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Cuenta operativa Banco 0172.'
  },
  {
    code: '1.1.01.02.010',
    name: 'Banco Cta Moneda Extranjera (Convenio Cambiario N° 1)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Fondos en custodia en divisas autorizados en la banca nacional.'
  },
  {
    code: '1.1.01.03.001',
    name: 'Depósitos y Transferencias en Tránsito',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Partidas registradas en libros pendientes de efectividad bancaria.'
  },
  {
    code: '1.1.02.01.001',
    name: 'Cuentas por Cobrar Comerciales Clientes',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Facturación pendiente de cobro respaldada con providencia 0071.'
  },
  {
    code: '1.1.02.01.005',
    name: 'Cobranzas por Puntos de Venta (POS)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Lotes de tarjetas de débito/crédito pendientes de abono bancario.'
  },
  {
    code: '1.1.03.01.001',
    name: 'Cuentas por Cobrar Accionistas y Directores',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Préstamos temporales a directivos bajo contrato de mutuo ejecutable.'
  },
  {
    code: '1.1.04.01.001',
    name: 'Anticipo de Retenciones de IVA (Comprobantes Recibidos)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Retenciones del 75% o 100% aplicadas por clientes agentes de retención SPE.'
  },
  {
    code: '1.1.04.02.001',
    name: 'Anticipo de Retenciones de ISLR (Comprobantes AR-C)',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'Retenciones en la fuente recibidas según Decreto 1808.'
  },
  {
    code: '1.1.04.03.001',
    name: 'Crédito Fiscal IVA del Periodo',
    category: 'ACTIVO',
    nature: 'DEUDORA',
    description: 'IVA soportado en compras de bienes y servicios gravados.'
  },

  // 2. PASIVO
  {
    code: '2.1.01.01.001',
    name: 'Préstamos y Pagarés Bancarios Comerciales',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Obligaciones financieras vigentes con la banca nacional.'
  },
  {
    code: '2.1.02.01.001',
    name: 'Cuentas por Pagar Proveedores Nacionales',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Facturas de proveedores de compras locales.'
  },
  {
    code: '2.1.02.02.001',
    name: 'Cuentas por Pagar Proveedores del Exterior (USD)',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Obligaciones en divisas por importaciones de mercancía.'
  },
  {
    code: '2.1.03.01.001',
    name: 'Cuentas por Pagar Accionistas y Socios',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Préstamos recibidos de socios con contrato de mutuo y declaración SUDEBAN.'
  },
  {
    code: '2.1.04.01.001',
    name: 'Retenciones de IVA por Enterar (SPE - Prov. 2025/000054)',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'IVA retenido a proveedores pendiente de declarar en ciclo quincenal SENIAT.'
  },
  {
    code: '2.1.04.02.001',
    name: 'Retenciones de ISLR por Enterar (Decreto 1808)',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'ISLR retenido en compras de bienes y servicios.'
  },
  {
    code: '2.1.04.03.001',
    name: 'Débito Fiscal IVA del Periodo',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Impuesto al Valor Agregado generado en facturas emitidas.'
  },
  {
    code: '2.1.04.04.001',
    name: 'IGTF por Enterar (3% Divisas)',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Impuesto a las Grandes Transacciones Financieras percibido.'
  },
  {
    code: '2.1.05.01.001',
    name: 'Sueldos y Salarios por Pagar',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Nómina ordinaria pendiente de desembolso bancario.'
  },
  {
    code: '2.1.05.02.001',
    name: 'Retenciones Parafiscales por Enterar (IVSS, FAOV, INCES)',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Aportes de seguridad social retenidos al personal.'
  },
  {
    code: '2.1.05.03.001',
    name: 'Aporte Ley de Protección de Pensiones por Pagar (2024)',
    category: 'PASIVO',
    nature: 'ACREEDORA',
    description: 'Contribución especial patronal calculada sobre la nómina mensual.'
  },

  // 3. PATRIMONIO
  {
    code: '3.1.01.01.001',
    name: 'Capital Social Suscrito y Pagado',
    category: 'PATRIMONIO',
    nature: 'ACREEDORA',
    description: 'Aportes estatutarios según Registro Mercantil.'
  },
  {
    code: '3.2.01.01.001',
    name: 'Resultados Acumulados / Superávit',
    category: 'PATRIMONIO',
    nature: 'ACREEDORA',
    description: 'Utilidades o pérdidas retenidas de ejercicios contables.'
  },

  // 4. INGRESOS
  {
    code: '4.1.01.01.001',
    name: 'Ventas de Mercancías Gravadas con IVA',
    category: 'INGRESOS',
    nature: 'ACREEDORA',
    description: 'Ingresos ordinarios alícuota general 16%.'
  },
  {
    code: '4.1.01.02.001',
    name: 'Ventas Exentas o Exoneradas de IVA',
    category: 'INGRESOS',
    nature: 'ACREEDORA',
    description: 'Ventas no sujetas a retención de IVA según Art. 3 Prov. 2025/000054.'
  },
  {
    code: '4.2.01.01.001',
    name: 'Ganancia en Diferencial Cambiario (Ven-NIF NIC 21)',
    category: 'INGRESOS',
    nature: 'ACREEDORA',
    description: 'Ajuste positivo por fluctuación de tasa oficial BCV.'
  },

  // 6. GASTOS
  {
    code: '6.1.01.01.001',
    name: 'Gastos de Sueldos y Salarios Operativos',
    category: 'GASTOS',
    nature: 'DEUDORA',
    description: 'Remuneraciones brutas pagadas a la fuerza laboral.'
  },
  {
    code: '6.1.01.02.001',
    name: 'Gastos de Contribución Ley de Pensiones (2024)',
    category: 'GASTOS',
    nature: 'DEUDORA',
    description: 'Gasto estatutario por contribución especial sobre la nómina.'
  },
  {
    code: '6.1.02.01.001',
    name: 'Gastos por Comisiones Bancarias y Mantenimiento',
    category: 'GASTOS',
    nature: 'DEUDORA',
    description: 'Débitos bancarios automáticos por custodia y servicios de cuenta.'
  },
  {
    code: '6.1.02.01.002',
    name: 'Gastos por Comisiones Transaccionales POS / Adquirente',
    category: 'GASTOS',
    nature: 'DEUDORA',
    description: 'Comisión descontada en la liquidación diaria de puntos de venta.'
  },
  {
    code: '6.1.02.02.001',
    name: 'Gastos por Impuesto a las Grandes Transacciones Financieras (IGTF)',
    category: 'GASTOS',
    nature: 'DEUDORA',
    description: 'IGTF bancario no compensable.'
  },
  {
    code: '6.1.03.01.001',
    name: 'Pérdida en Diferencial Cambiario (Ven-NIF NIC 21)',
    category: 'GASTOS',
    nature: 'DEUDORA',
    description: 'Pérdida realizada o no realizada en partidas monetarias en divisas.'
  }
];

export const VENEZUELAN_BANKS = [
  { code: '0134', name: 'Banesco Banco Universal', shortName: 'Banesco', color: '#E8F5E9', border: '#A5D6A7' },
  { code: '0105', name: 'Banco Mercantil C.A.', shortName: 'Mercantil', color: '#E3F2FD', border: '#90CAF9' },
  { code: '0102', name: 'Banco de Venezuela S.A.', shortName: 'BDV', color: '#FCE4EC', border: '#F48FB1' },
  { code: '0191', name: 'Banco Nacional de Crédito BNC', shortName: 'BNC', color: '#FFF3E0', border: '#FFCC80' },
  { code: '0172', name: 'Bancamiga Banco Universal', shortName: 'Bancamiga', color: '#F3E5F5', border: '#CE93D8' },
  { code: '0108', name: 'Banco Provincial BBVA', shortName: 'Provincial', color: '#E0F2F1', border: '#80CBC4' }
];

export const RECONCILIATION_MODULES = [
  { id: 'MOD_VENTAS', title: 'Cobro de Facturas', type: 'INFLOW', icon: 'FileCheck2', description: 'Cobranza comercial a clientes, pagos móviles recibidos y retenciones 75%/100% de IVA soportadas.' },
  { id: 'MOD_USD_IN', title: 'Ingresos en Divisas', type: 'INFLOW', icon: 'DollarSign', description: 'Convenio Cambiario N° 1 y cuentas custodia en divisas autorizadas por BCV.' },
  { id: 'MOD_TFR_PROPIAS_IN', title: 'Transferencias Interbancarias Propias (Entradas)', type: 'INFLOW', icon: 'ArrowDownLeft', description: 'Traspasos entre cuentas bancarias de la misma razón social (efecto neutro en patrimonio).' },
  { id: 'MOD_SOCIOS_IN', title: 'Aportes y Préstamos a Socios', type: 'INFLOW', icon: 'Users', description: 'Inyecciones de capital y mutuos societarios con respaldo probatorio SUDEBAN Res. 010.25.' },
  { id: 'MOD_POS', title: 'Liquidación POS', type: 'INFLOW', icon: 'CreditCard', description: 'Abonos diarios de lotes de puntos de venta (TMD, TDB CAPIT, Credicard, Megasoft).' },
  { id: 'MOD_PRESTAMOS_IN', title: 'Créditos y Préstamos Bancarios', type: 'INFLOW', icon: 'Landmark', description: 'Líneas de crédito comercial, pagarés bancarios y financiamientos liquidados.' },
  
  { id: 'MOD_CXC_SOCIOS', title: 'Cuentas por Cobrar Socios', type: 'OUTFLOW', icon: 'UserCheck', description: 'Préstamos o anticipos temporales entregados a directivos bajo Contrato de Mutuo ejecutable.' },
  { id: 'MOD_TFR_PROPIAS_OUT', title: 'Transferencias Interbancarias Propias (Salidas)', type: 'OUTFLOW', icon: 'ArrowUpRight', description: 'Débitos de cuenta origen traspasados a otra cuenta de la misma empresa.' },
  { id: 'MOD_CXP_SOCIOS', title: 'Devolución Préstamos Socios', type: 'OUTFLOW', icon: 'UserMinus', description: 'Amortización de deudas societarias auditadas sin recalificación fiscal como dividendos.' },
  { id: 'MOD_PROVEEDORES', title: 'Pago a Proveedores Locales', type: 'OUTFLOW', icon: 'Truck', description: 'Facturas de compras y servicios Prov. 0071 con retenciones de IVA e ISLR.' },
  { id: 'MOD_USD_OUT', title: 'Salidas en Divisas', type: 'OUTFLOW', icon: 'Globe', description: 'Transferencias al exterior para importaciones con DUA aduanera y normas NIC 21.' },
  { id: 'MOD_ANTICIPOS', title: 'Anticipos y Retenciones', type: 'OUTFLOW', icon: 'Receipt', description: 'Anticipos de compras con retención preventiva Prov. 2025/000054.' },
  { id: 'MOD_NOMINA', title: 'Nómina y Cargas Parafiscales', type: 'OUTFLOW', icon: 'Briefcase', description: 'Pago de sueldos, salarios, IVSS, FAOV y contribución especial Ley de Pensiones 2024.' },
  { id: 'MOD_SENIAT_PAGO', title: 'Liquidación Tributos SENIAT y Parafiscales', type: 'OUTFLOW', icon: 'Building2', description: 'Pago de impuestos nacionales (IVA Form 00030, ISLR Form 00026, Retenciones Form 00099, IGTF, BANAVIH y tasas municipales).' },
  { id: 'MOD_COMISIONES', title: 'Comisiones y Mantenimiento Bancario', type: 'OUTFLOW', icon: 'Landmark', description: 'Débitos bancarios por mantenimiento mensual, emisión de estados de cuenta, comisiones de pago móvil y SMS.' },
  { id: 'MOD_OTROS', title: 'Otros / No Identificados', type: 'ALL', icon: 'ShieldCheck', description: 'Transacciones no clasificadas automáticamente que requieren revisión contable manual o soporte probatorio.' }
];
