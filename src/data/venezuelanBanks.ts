export interface VenezuelanBankDefinition {
  code: string; // e.g. '0134'
  shortName: string; // e.g. 'Banesco'
  fullName: string; // e.g. 'Banesco Banco Universal'
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const VENEZUELAN_BANKS: VenezuelanBankDefinition[] = [
  {
    code: '0134',
    shortName: 'Banesco',
    fullName: 'Banesco Banco Universal, C.A.',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-900',
    borderColor: 'border-emerald-300'
  },
  {
    code: '0105',
    shortName: 'Mercantil',
    fullName: 'Mercantil Banco Universal, C.A.',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-900',
    borderColor: 'border-blue-300'
  },
  {
    code: '0102',
    shortName: 'Banco de Venezuela',
    fullName: 'Banco de Venezuela, S.A. Banco Universal (BDV)',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-900',
    borderColor: 'border-rose-300'
  },
  {
    code: '0191',
    shortName: 'BNC',
    fullName: 'Banco Nacional de Crédito, C.A. Banco Universal',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-900',
    borderColor: 'border-indigo-300'
  },
  {
    code: '0172',
    shortName: 'Bancamiga',
    fullName: 'Bancamiga Banco Microfinanciero, C.A.',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-900',
    borderColor: 'border-amber-300'
  },
  {
    code: '0108',
    shortName: 'Provincial',
    fullName: 'BBVA Banco Provincial, S.A. Banco Universal',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-900',
    borderColor: 'border-sky-300'
  },
  {
    code: '0174',
    shortName: 'Banplus',
    fullName: 'Banplus Banco Universal, C.A.',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-900',
    borderColor: 'border-orange-300'
  },
  {
    code: '0114',
    shortName: 'Bancaribe',
    fullName: 'Banco del Caribe, C.A. Banco Universal',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-900',
    borderColor: 'border-teal-300'
  },
  {
    code: '0163',
    shortName: 'Banco del Tesoro',
    fullName: 'Banco del Tesoro, C.A. Banco Universal',
    bgColor: 'bg-red-50',
    textColor: 'text-red-900',
    borderColor: 'border-red-300'
  },
  {
    code: '0138',
    shortName: 'Banco Plaza',
    fullName: 'Banco Plaza, Banco Universal',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-300'
  },
  {
    code: '0175',
    shortName: 'Banco Digital Trabajadores',
    fullName: 'Banco Digital de los Trabajadores (BDT / Bicentenario)',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-900',
    borderColor: 'border-purple-300'
  },
  {
    code: '0171',
    shortName: 'Banco Activo',
    fullName: 'Banco Activo, C.A. Banco Universal',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-900',
    borderColor: 'border-cyan-300'
  },
  {
    code: '0115',
    shortName: 'Banco Exterior',
    fullName: 'Banco Exterior, C.A. Banco Universal',
    bgColor: 'bg-lime-50',
    textColor: 'text-lime-900',
    borderColor: 'border-lime-300'
  },
  {
    code: '0151',
    shortName: 'BFC Fondo Común',
    fullName: 'BFC Banco Fondo Común, C.A. Banco Universal',
    bgColor: 'bg-fuchsia-50',
    textColor: 'text-fuchsia-900',
    borderColor: 'border-fuchsia-300'
  },
  {
    code: '0156',
    shortName: '100% Banco',
    fullName: '100% Banco, Banco Universal C.A.',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-950',
    borderColor: 'border-emerald-400'
  },
  {
    code: '0137',
    shortName: 'Sofitasa',
    fullName: 'Banco Sofitasa Banco Universal, C.A.',
    bgColor: 'bg-stone-50',
    textColor: 'text-stone-900',
    borderColor: 'border-stone-300'
  },
  {
    code: '0128',
    shortName: 'Banco Caroní',
    fullName: 'Banco Caroní, C.A. Banco Universal',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-900',
    borderColor: 'border-violet-300'
  }
];

export function getBankDefinition(codeOrName: string): VenezuelanBankDefinition {
  const clean = codeOrName ? codeOrName.trim().toLowerCase() : '';
  const found = VENEZUELAN_BANKS.find(
    b => b.code === clean || b.shortName.toLowerCase().includes(clean) || b.fullName.toLowerCase().includes(clean)
  );
  if (found) return found;

  return {
    code: '0000',
    shortName: codeOrName || 'Banco Nacional',
    fullName: codeOrName || 'Banco Comercial Venezolano',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-300'
  };
}
