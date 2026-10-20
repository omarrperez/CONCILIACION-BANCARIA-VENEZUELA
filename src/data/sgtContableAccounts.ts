export interface SgtAccountItem {
  code: string;
  name: string;
  monetary: 'S' | 'N' | '';
  type: string;
  category: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESOS' | 'COSTOS' | 'EGRESOS' | 'OTROS';
  nature: 'DEUDORA' | 'ACREEDORA';
}

/**
 * Plan de Cuentas Oficial del Sistema SGT CONTABLE
 * Suministrado por el usuario y configurado para empresas en Venezuela bajo Ven-NIF y SENIAT.
 */
export const SGT_CONTABLE_ACCOUNTS: SgtAccountItem[] = [
  // 1. ACTIVO
  { code: '1', name: 'ACTIVO', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1', name: 'ACTIVOS CORRIENTES', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1', name: 'EFECTIVO DISPONIBLE', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.1', name: 'CAJA', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.1.10', name: 'CAJA PRINCIPAL', monetary: 'S', type: 'CAJA', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.1.20', name: 'CAJA CHICA', monetary: 'S', type: 'CAJA', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.1.40', name: 'TARJETAS DE CREDITO EN CAJA', monetary: 'S', type: 'CAJA', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.1.50', name: 'CHEQUES EN CAJA', monetary: 'S', type: 'CAJA', category: 'ACTIVO', nature: 'DEUDORA' },
  
  // 1.1.1.2 BANCOS NACIONALES
  { code: '1.1.1.2', name: 'BANCOS NACIONALES', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.10', name: 'BANCO BANESCO', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.20', name: 'BANCAMIGA', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.21', name: 'BANCO ACTIVO', monetary: '', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.25', name: 'BANCO DEL TESORO', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.30', name: 'BANCO FONDO COMUN', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.40', name: 'BANCO BNC', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.50', name: 'BANCO BNC CASHEA', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.60', name: 'BANCO MERCANTIL', monetary: '', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.70', name: 'BANCO BANPLUS', monetary: '', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.80', name: 'BANCO PLAZA', monetary: '', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.2.90', name: 'BANCO PROVINCIAL', monetary: '', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  
  // 1.1.1.3 BANCOS EN EL EXTERIOR
  { code: '1.1.1.3', name: 'BANCOS EN EL EXTERIOR', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.3.10', name: 'BANESCO EXTERIOR', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.3.20', name: 'MERCANTIL EXTERIOR', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.1.3.30', name: 'BANCO C', monetary: 'S', type: 'BANCO', category: 'ACTIVO', nature: 'DEUDORA' },

  // 1.1.2 DEUDORES COMERCIALES Y OTROS
  { code: '1.1.2', name: 'DEUDORES COMERCIALES Y OTROS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.1', name: 'DEUDORES COMERCIALES', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.1.10', name: 'DEUDORES COMERCIALES NACIONALES', monetary: 'S', type: 'CLIENTES', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.1.20', name: 'DEUDORES COMERCIALES EN EL EXTERIOR', monetary: 'S', type: 'CLIENTES', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.1.30', name: 'DEUDORES CON CLAUSULAS REAJUSTABILIDAD', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.1.80', name: 'PROVISIONES DE DEUDAS INCOBRABLES', monetary: 'S', type: '', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.1.2.1.90', name: 'DETERIORO DE VALOR DE LAS DEUDAS COMERCIALES', monetary: 'S', type: '', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.1.2.2', name: 'OTROS DEUDORES', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.2.10', name: 'TRABAJADORES', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.2.30', name: 'SOCIOS O DIRECTORES', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.2.40', name: 'EMPRESAS AFILIADAS', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.2.2.90', name: 'DETERIORO DE VALOR DE LAS DEUDAS DE EMPRESAS AFILI', monetary: 'S', type: '', category: 'ACTIVO', nature: 'ACREEDORA' },

  // 1.1.3 INVENTARIOS
  { code: '1.1.3', name: 'INVENTARIOS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.3.1', name: 'MERCANCIAS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.3.1.10', name: 'MERCANCIAS DISPONIBLES', monetary: 'N', type: 'INV', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.3.1.20', name: 'MERCANCIAS EN TRANSITO', monetary: 'N', type: 'INV', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.3.1.30', name: 'MERCANCIAS EN CONSIGNACION', monetary: 'N', type: 'INV', category: 'ACTIVO', nature: 'DEUDORA' },

  // 1.1.4 GASTOS PREPAGADOS Y ANTICIPOS
  { code: '1.1.4', name: 'GASTOS PREPAGADOS Y ANTICIPOS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.4.1', name: 'GASTOS PREPAGADOS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.4.1.10', name: 'ITF PAGADOS POR ANTICIPADOS', monetary: 'S', type: 'IMPUESTO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.4.1.11', name: 'CREDITOS FISCALES', monetary: 'S', type: 'IVA', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.4.2', name: 'ANTICIPOS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.4.2.10', name: 'ANTICIPO A PROVEEDORES', monetary: 'S', type: 'ANTICIPO', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.4.2.15', name: 'OTROS ANTICIPOS', monetary: 'S', type: 'ANTICIPO', category: 'ACTIVO', nature: 'DEUDORA' },

  // 1.1.5 INVERSIONES FINANCIERAS
  { code: '1.1.5', name: 'INVERSIONES FINANCIERAS A CORTO PLAZO', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.5.1', name: 'INVERSIONES NACIONALES', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.5.1.10', name: 'COLOCACIONES EN MESA DE DINERO', monetary: 'N', type: 'ONM', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.5.1.20', name: 'INVERSIONES PACTADAS CON REAJUSTES', monetary: 'N', type: 'ONM', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.5.1.30', name: 'OTRAS INVERSIONES A CORTO PLAZO', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.5.2', name: 'INVERSIONES EN EL EXTERIOR', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.1.5.2.10', name: 'DEPOSITO A PLAZO FIJO', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },

  // 1.2 ACTIVOS NO CORRIENTES
  { code: '1.2', name: 'ACTIVOS NO CORRIENTES', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1', name: 'PROPIEDADES, PLANTA Y EQUIPOS', monetary: '', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.1.15', name: 'EDIFICIO PRINCIPAL', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.1.20', name: 'ANEXO EDIFICIO SEDE', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.1.25', name: 'INSTALACIONES DEL EDIFICIO SEDE', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.1.30', name: 'TERRENO EDIFICIO SEDE', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.4.60', name: 'MAQUINARIAS', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.4.65', name: 'HERRAMIENTAS', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.5.70', name: 'MOBILIARIOS Y EQUIPOS', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.5.75', name: 'EQUIPO DE OFICINA', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.6.80', name: 'VEHICULOS DE REPARTO', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.6.85', name: 'VEHICULOS DE OFICINA', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.1.7.15', name: 'DEPREC. ACUM. EDIFICIO PRINCIPAL', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.2.1.7.60', name: 'DEPREC. ACUM. MAQUINARIAS', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.2.1.7.70', name: 'DEPREC. ACUM. MOB. Y EQUIPO', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.2.1.7.75', name: 'DEPREC. ACUM. EQUIPO OFICINA', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.2.1.7.80', name: 'DEPREC. ACUM. VEHICULOS DE REPARTO', monetary: 'N', type: 'ACT', category: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '1.2.4.2.10', name: 'ISLR PAGADOS EN EXCESO EJERC. ANTERIORES', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.4.2.15', name: 'ISLR DECLARACION ESTIMADA DE RENTAS', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.4.2.20', name: 'ISLR PAGADOS POR DECLARACION SUSTITUTIVA', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.4.2.25', name: 'ISLR RETENIDO POR CLIENTES', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.4.2.30', name: 'ANTICIPOS ISLR', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.4.2.31', name: 'IVA POR APLICAR', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },
  { code: '1.2.4.2.32', name: 'IVA RETENIDO EN EL PERIODO', monetary: 'S', type: '', category: 'ACTIVO', nature: 'DEUDORA' },

  // 2. PASIVO
  { code: '2', name: 'PASIVO', monetary: '', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1', name: 'PASIVOS CORRIENTES', monetary: '', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1', name: 'ACREEDORES COMERCIALES Y OTROS', monetary: '', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.1', name: 'ACREEDORES NACIONALES', monetary: '', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.1.10', name: 'PROVEEDORES', monetary: 'S', type: 'PROVEEDORES', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.1.11', name: 'CUOTAS POR PAGAR VEHICULO', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.1.15', name: 'SOBREGIRO BANCARIO', monetary: 'S', type: 'BANCO', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.1.20', name: 'PAGARÉ BANCARIO', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.1.21', name: 'PRESTAMOS DE TERCEROS', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.2.10', name: 'PROVEEDORES EXTERIOR', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.3.10', name: 'CUENTAS POR PAGAR AFILIADAS', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.3.15', name: 'CUENTAS POR PAGAR SOCIOS', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.3.20', name: 'DIVIDENDOS POR PAGAR', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.1.3.30', name: 'ANTICIPOS DE CLIENTES', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },

  // 2.1.2 IMPUESTOS POR PAGAR
  { code: '2.1.2', name: 'IMPUESTOS POR PAGAR', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.1', name: 'IMPUESTO AL VALOR AGREGADO - IVA', monetary: '', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.1.10', name: 'DEBITOS FISCALES', monetary: 'S', type: 'IVA', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.1.15', name: 'CREDITOS FISCALES', monetary: 'S', type: 'IVA', category: 'PASIVO', nature: 'DEUDORA' },
  { code: '2.1.2.1.20', name: 'RETENCION IVA CLIENTES', monetary: 'S', type: 'RET_IVA', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.1.30', name: 'IVA PERCIBIDO POR CUENTA DE TERCEROS', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.2.10', name: 'IMPUESTO SOBRE LA RENTA', monetary: 'S', type: 'ISLR', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.2.15', name: 'IMPUESTOS MUNICIPALES', monetary: 'S', type: 'MUNICIPAL', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.2.25', name: 'IVA POR PAGAR', monetary: 'S', type: 'IVA', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.2.26', name: 'PENSIONES POR PAGAR', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.3.10', name: 'RETENCIONES ISLR', monetary: 'S', type: 'RET_ISLR', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.3.15', name: 'RETENCIONES DE IVA', monetary: 'S', type: 'RET_IVA', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.2.3.20', name: 'IGTF VENTA 3% POR PAGAR', monetary: 'S', type: 'IGTF', category: 'PASIVO', nature: 'ACREEDORA' },

  // 2.1.3 OBLIGACIONES LABORALES
  { code: '2.1.3.1.10', name: 'APARTADO INCE', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.3.1.15', name: 'APARTADO IVSS', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.3.1.20', name: 'APARTADO REGIMEN PRESTACIONAL DE EMPLEO', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.3.1.25', name: 'APARTADO LEY DE VIVIENDA Y HABITAD', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.3.2.10', name: 'NOMINA POR PAGAR', monetary: 'S', type: 'NOMINA', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.3.2.15', name: 'BONO ALIMENTARIO', monetary: 'S', type: 'NOMINA', category: 'PASIVO', nature: 'ACREEDORA' },
  { code: '2.1.3.2.20', name: 'COMISIONES', monetary: 'S', type: '', category: 'PASIVO', nature: 'ACREEDORA' },

  // 3. PATRIMONIO
  { code: '3', name: 'PATRIMONIO', monetary: '', type: '', category: 'PATRIMONIO', nature: 'ACREEDORA' },
  { code: '3.1.1.1.10', name: 'CAPITAL SOCIAL', monetary: 'N', type: 'CAP', category: 'PATRIMONIO', nature: 'ACREEDORA' },
  { code: '3.2.1.1.10', name: 'RESERVA LEGAL', monetary: 'N', type: 'OCP', category: 'PATRIMONIO', nature: 'ACREEDORA' },
  { code: '3.3.1.1.10', name: 'UTILIDADES NO DISTRIBUIDAS', monetary: 'N', type: 'UND', category: 'PATRIMONIO', nature: 'ACREEDORA' },
  { code: '3.3.1.1.20', name: 'RESULTADO DEL EJERCICIO', monetary: 'N', type: 'UND', category: 'PATRIMONIO', nature: 'ACREEDORA' },

  // 4. INGRESOS
  { code: '4', name: 'INGRESOS', monetary: '', type: '', category: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '4.1', name: 'VENTAS ORDINARIAS', monetary: '', type: '', category: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '4.1.1.1.10', name: 'VENTAS GRAVADAS', monetary: '', type: 'VENTA', category: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '4.1.1.1.11', name: 'VENTAS EXENTAS', monetary: '', type: 'VENTA', category: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '4.1.1.1.20', name: 'VENTAS AL EXTERIOR', monetary: '', type: 'VENTA', category: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '4.1.1.2.10', name: 'DEVOLUCIONES EN VENTAS', monetary: '', type: '', category: 'INGRESOS', nature: 'DEUDORA' },
  { code: '4.1.1.2.20', name: 'DESCUENTOS EN VENTAS', monetary: '', type: '', category: 'INGRESOS', nature: 'DEUDORA' },

  // 5. COSTOS
  { code: '5', name: 'COSTOS', monetary: '', type: '', category: 'COSTOS', nature: 'DEUDORA' },
  { code: '5.1.1.1.10', name: 'INVENTARIO INICIAL DE MERCANCIAS', monetary: '', type: '', category: 'COSTOS', nature: 'DEUDORA' },
  { code: '5.1.1.2.10', name: 'COMPRAS BRUTAS', monetary: '', type: 'COMPRAS', category: 'COSTOS', nature: 'DEUDORA' },
  { code: '5.1.1.2.20', name: 'DCTOS. EN COMPRAS', monetary: '', type: '', category: 'COSTOS', nature: 'ACREEDORA' },
  { code: '5.1.1.2.30', name: 'DEV. EN COMPRAS', monetary: '', type: '', category: 'COSTOS', nature: 'ACREEDORA' },
  { code: '5.1.1.2.40', name: 'FLETES S/COMPRAS', monetary: '', type: '', category: 'COSTOS', nature: 'DEUDORA' },
  { code: '5.1.1.8.10', name: 'COSTO DE VENTA (INV. CONTINUO)', monetary: '', type: '', category: 'COSTOS', nature: 'DEUDORA' },
  { code: '5.1.1.9.10', name: 'INVENTARIO FINAL DE MERCANCIAS', monetary: '', type: '', category: 'COSTOS', nature: 'ACREEDORA' },

  // 6. EGRESOS / GASTOS OPERACIONALES
  { code: '6', name: 'EGRESOS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1', name: 'GASTOS OPERACIONALES', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.1.10', name: 'SUELDOS DIRECTORES', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.1.11', name: 'SUELDOS EMPLEADOS', monetary: '', type: 'NOMINA', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.1.12', name: 'SALARIOS DE OBREROS', monetary: '', type: 'NOMINA', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.1.14', name: 'HORAS EXTRAS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.2.10', name: 'PRESTACIONES SOCIALES - ANTIGUEDAD', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.2.14', name: 'APORTE S.S.O', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.2.15', name: 'APORTE I.N.C.E', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.2.17', name: 'ALIMENTACION EMPLEADO A', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.1.2.18', name: 'LEY APORTE DE PENSIONES', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },

  // 6.1.2 GASTOS DE ADMINISTRACION Y VENTAS
  { code: '6.1.2.1.01', name: 'GASTOS VARIOS', monetary: '', type: 'GASTO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.02', name: 'TAXI', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.05', name: 'SERVICIO DE AGUA', monetary: '', type: 'SERVICIO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.10', name: 'ASEO URBANO DOMICILIARIO', monetary: '', type: 'SERVICIO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.15', name: 'CONSUMO DE TELEFONO', monetary: '', type: 'SERVICIO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.20', name: 'CONSUMO DE ELECTRICIDAD', monetary: '', type: 'SERVICIO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.25', name: 'POLIZAS DE SEGURO', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.26', name: 'GASTOS DE REPARACION Y MANTENIMIENTO', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.27', name: 'VIGILANCIA', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.28', name: 'SERVICIOS CONTRATADOS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.30', name: 'COMIDAS, VIAJES Y TRASLADOS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.31', name: 'PAGO DOMINIO WEB, SERVICIOS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.40', name: 'IMPUESTOS MUNICIPALES', monetary: '', type: 'TRIBUTO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.45', name: 'PAPELERIA VARIOS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.47', name: 'IMP. SOBRE ACT. ECONOMICAS', monetary: '', type: 'TRIBUTO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.48', name: 'ARTICULOS DE LIMPIEZA', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.50', name: 'ALQUILER DE LOCAL', monetary: '', type: 'ALQUILER', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.51', name: 'MULTAS Y RECARGOS', monetary: '', type: 'MULTA', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.53', name: 'GASTOS DE ISLR', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.58', name: 'INTERNET', monetary: '', type: 'SERVICIO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.60', name: 'CONDOMINIO', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.1.61', name: 'ACCESORIOS Y MANTTO EQUIPOS COMPUTACION', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },

  // 6.1.2.2 SERVICIOS PROFESIONALES
  { code: '6.1.2.2.10', name: 'HONORARIOS PROFESIONALES', monetary: '', type: 'HONORARIOS', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.2.15', name: 'SERVICIOS DE CONTABILIDAD', monetary: '', type: 'HONORARIOS', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.2.20', name: 'HONORARIOS SERVICIOS TECNOLOGICOS', monetary: '', type: 'HONORARIOS', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.2.21', name: 'HONORARIOS ABOGADOS', monetary: '', type: 'HONORARIOS', category: 'EGRESOS', nature: 'DEUDORA' },

  // 6.1.2.5 GASTOS BANCARIOS Y FINANCIEROS
  { code: '6.1.2.5', name: 'GASTOS BANCARIOS Y FINANCIEROS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.5.01', name: 'IGTF', monetary: '', type: 'IGTF_BANCO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.5.02', name: 'COMISIONES BANCARIAS', monetary: '', type: 'COMISION', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.5.03', name: 'GASTOS BANCARIOS', monetary: '', type: 'GASTO_BANCARIO', category: 'EGRESOS', nature: 'DEUDORA' },
  { code: '6.1.2.5.05', name: 'OTROS IMPUESTOS', monetary: '', type: '', category: 'EGRESOS', nature: 'DEUDORA' },

  // 7. OTROS INGRESOS Y EGRESOS
  { code: '7', name: 'OTROS INGRESOS Y EGRESOS', monetary: '', type: '', category: 'OTROS', nature: 'ACREEDORA' },
  { code: '7.1.1.1.15', name: 'INTERESES BANCARIOS', monetary: '', type: 'INTERESES', category: 'OTROS', nature: 'ACREEDORA' },
  { code: '7.1.1.1.20', name: 'INTERESES SOBRE CREDITOS', monetary: '', type: '', category: 'OTROS', nature: 'ACREEDORA' },
  { code: '7.1.1.1.25', name: 'OTROS INGRESOS', monetary: '', type: '', category: 'OTROS', nature: 'ACREEDORA' },
  { code: '7.1.1.1.30', name: 'OTROS EGRESOS', monetary: '', type: '', category: 'OTROS', nature: 'DEUDORA' },
  { code: '7.2.1.4.10', name: 'RESULTADO MONETARIO DEL EJERCICIO (REME)', monetary: '', type: '', category: 'OTROS', nature: 'DEUDORA' }
];

/**
 * Obtener cuenta de banco en SGT Contable según el código del banco venezolano
 */
export function getSgtAccountByBankCode(bankCode?: string, bankName?: string): { code: string; name: string } {
  switch (bankCode) {
    case '0134':
      return { code: '1.1.1.2.10', name: 'BANCO BANESCO' };
    case '0172':
      return { code: '1.1.1.2.20', name: 'BANCAMIGA' };
    case '0171':
      return { code: '1.1.1.2.21', name: 'BANCO ACTIVO' };
    case '0163':
      return { code: '1.1.1.2.25', name: 'BANCO DEL TESORO' };
    case '0151':
      return { code: '1.1.1.2.30', name: 'BANCO FONDO COMUN' };
    case '0191':
      return { code: '1.1.1.2.40', name: 'BANCO BNC' };
    case '0105':
      return { code: '1.1.1.2.60', name: 'BANCO MERCANTIL' };
    case '0166':
      return { code: '1.1.1.2.70', name: 'BANCO BANPLUS' };
    case '0104':
      return { code: '1.1.1.2.80', name: 'BANCO PLAZA' };
    case '0108':
      return { code: '1.1.1.2.90', name: 'BANCO PROVINCIAL' };
    case '0102': // BDV
      return { code: '1.1.1.2.25', name: 'BANCO DEL TESORO / BDV (BANCOS NACIONALES)' };
    default: {
      if (bankName?.toLowerCase().includes('banesco')) return { code: '1.1.1.2.10', name: 'BANCO BANESCO' };
      if (bankName?.toLowerCase().includes('mercantil')) return { code: '1.1.1.2.60', name: 'BANCO MERCANTIL' };
      if (bankName?.toLowerCase().includes('bnc')) return { code: '1.1.1.2.40', name: 'BANCO BNC' };
      if (bankName?.toLowerCase().includes('bancamiga')) return { code: '1.1.1.2.20', name: 'BANCAMIGA' };
      if (bankName?.toLowerCase().includes('provincial')) return { code: '1.1.1.2.90', name: 'BANCO PROVINCIAL' };
      return { code: '1.1.1.2.10', name: 'BANCO BANESCO (BANCOS NACIONALES)' };
    }
  }
}

/**
 * Traducir cuentas genéricas Ven-NIF o descripciones al Plan de Cuentas SGT CONTABLE
 */
export function mapVenNifToSgtContable(
  venNifCode: string,
  concept: string = '',
  bankCode?: string
): { code: string; name: string } {
  const norm = concept.toLowerCase();

  // 1. Bancos
  if (venNifCode.startsWith('1.1.01.02') || norm.includes('banco') || norm.includes('cta corriente')) {
    return getSgtAccountByBankCode(bankCode);
  }

  // 2. Caja
  if (venNifCode.startsWith('1.1.01.01') || norm.includes('caja')) {
    if (norm.includes('chica')) return { code: '1.1.1.1.20', name: 'CAJA CHICA' };
    return { code: '1.1.1.1.10', name: 'CAJA PRINCIPAL' };
  }

  // 3. IGTF Débito
  if (norm.includes('igtf') || venNifCode.includes('6.1.02.04') || norm.includes('impuesto a las grandes')) {
    return { code: '6.1.2.5.01', name: 'IGTF' };
  }

  // 4. Comisiones Bancarias
  if (
    norm.includes('comision') ||
    norm.includes('tarifa') ||
    norm.includes('mantenimiento') ||
    norm.includes('pos') ||
    norm.includes('punto') ||
    venNifCode.includes('6.1.02.01')
  ) {
    return { code: '6.1.2.5.02', name: 'COMISIONES BANCARIAS' };
  }

  // 5. Gastos Bancarios / Chequeras / Emisiones
  if (norm.includes('cheque') || norm.includes('gasto bancario') || venNifCode.includes('6.1.02.02')) {
    return { code: '6.1.2.5.03', name: 'GASTOS BANCARIOS' };
  }

  // 6. Intereses Ganados
  if (norm.includes('interes') || venNifCode.startsWith('4.2') || venNifCode.startsWith('7.1')) {
    return { code: '7.1.1.1.15', name: 'INTERESES BANCARIOS' };
  }

  // 7. Retenciones de IVA
  if (norm.includes('retencion iva') || norm.includes('retención iva') || venNifCode.includes('2.1.02.01')) {
    return { code: '2.1.2.3.15', name: 'RETENCIONES DE IVA' };
  }

  // 8. Retenciones de ISLR
  if (norm.includes('retencion islr') || norm.includes('retención islr') || venNifCode.includes('2.1.02.02')) {
    return { code: '2.1.2.3.10', name: 'RETENCIONES ISLR' };
  }

  // 9. Nómina y Sueldos
  if (norm.includes('nomina') || norm.includes('nómina') || norm.includes('sueldo') || norm.includes('quincena')) {
    return { code: '6.1.1.1.11', name: 'SUELDOS EMPLEADOS' };
  }

  // 10. Clientes / Cobros
  if (norm.includes('cliente') || norm.includes('cobro') || norm.includes('factura') && !norm.includes('compra')) {
    return { code: '1.1.2.1.10', name: 'DEUDORES COMERCIALES NACIONALES' };
  }

  // 11. Proveedores / Pagos
  if (norm.includes('proveedor') || norm.includes('pago fac') || norm.includes('compra')) {
    return { code: '2.1.1.1.10', name: 'PROVEEDORES' };
  }

  // 12. Impuestos Municipales
  if (norm.includes('alcaldia') || norm.includes('patente') || norm.includes('municipal')) {
    return { code: '6.1.2.1.40', name: 'IMPUESTOS MUNICIPALES' };
  }

  // 13. Servicios Públicos
  if (norm.includes('electricidad') || norm.includes('corpoelec')) return { code: '6.1.2.1.20', name: 'CONSUMO DE ELECTRICIDAD' };
  if (norm.includes('telefono') || norm.includes('cantv') || norm.includes('movistar')) return { code: '6.1.2.1.15', name: 'CONSUMO DE TELEFONO' };
  if (norm.includes('internet')) return { code: '6.1.2.1.58', name: 'INTERNET' };
  if (norm.includes('alquiler') || norm.includes('arrendamiento')) return { code: '6.1.2.1.50', name: 'ALQUILER DE LOCAL' };
  if (norm.includes('honorarios') || norm.includes('contabilidad')) return { code: '6.1.2.2.15', name: 'SERVICIOS DE CONTABILIDAD' };

  // Fallback a Gastos Varios o Activo SGT
  const exact = SGT_CONTABLE_ACCOUNTS.find(a => a.code === venNifCode);
  if (exact) return { code: exact.code, name: exact.name };

  return { code: '6.1.2.1.01', name: 'GASTOS VARIOS' };
}
