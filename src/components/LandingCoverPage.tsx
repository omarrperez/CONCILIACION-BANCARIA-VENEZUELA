import React, { useState } from 'react';
import {
  ShieldCheck,
  BarChart3,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface LandingCoverPageProps {
  onLoginWithGoogle: () => Promise<void>;
  onLoginWithEmail?: (email: string, displayName: string) => void;
  onStartDemo: () => void;
  bcvRate?: number;
}

export const LandingCoverPage: React.FC<LandingCoverPageProps> = ({
  onLoginWithGoogle,
  onLoginWithEmail,
  onStartDemo,
  bcvRate = 56.80
}) => {
  const [emailInput, setEmailInput] = useState('omarrperezc@gmail.com');
  const [passwordInput, setPasswordInput] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleClick = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await onLoginWithGoogle();
    } catch (err: any) {
      console.warn('Google Sign-In Error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('popup-blocked')) {
        setAuthError('El navegador bloqueó la ventana emergente de Google. Por favor autoriza emergentes e intenta nuevamente.');
      } else if (msg.includes('popup-closed-by-user')) {
        setAuthError('La ventana de Google fue cerrada antes de completar el inicio de sesión.');
      } else {
        setAuthError('No se pudo abrir la ventana de Google. Puedes ingresar directamente escribiendo tu correo a continuación.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const namePart = emailInput.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1) + ' (Usuario Registrado)';
    if (onLoginWithEmail) {
      onLoginWithEmail(emailInput.trim(), formattedName);
    } else {
      onStartDemo();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f0f4f8] font-sans text-slate-900 selection:bg-cyan-500 selection:text-white">
      
      {/* LEFT COLUMN: Deep Blue / Teal Branding Panel (Fiel a la portada de la imagen) */}
      <div className="lg:w-[52%] xl:w-[55%] bg-gradient-to-br from-[#0c3953] via-[#092e44] to-[#062031] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden shrink-0">
        
        {/* Subtle Background Glow FX */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Logo Header */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-400 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
              <TrendingUp className="w-6 h-6 text-slate-950 stroke-[3]" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">NOMINUS</span>
          </div>

          {/* Headline */}
          <div className="space-y-3 max-w-xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-[1.2] text-white tracking-tight">
              Software de Conciliación Bancaria y Nómina en Venezuela que Automatiza tu Contabilidad y Gestión de Pagos.
            </h1>
            <p className="text-xs sm:text-sm text-cyan-100/80 leading-relaxed">
              Plataforma especializada para contadores, administradores y empresas venezolanas. Integra bancos (Banesco, Mercantil, BDV, BNC, Bancamiga), retenciones SENIAT y prueba de efectivo a Bs. 0,00.
            </p>
          </div>
        </div>

        {/* Feature Highlights (3 tarjetas redondeadas como en la foto) */}
        <div className="relative z-10 space-y-4 my-8 max-w-xl">
          
          {/* Feature 1 */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs transition-all hover:bg-white/10">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-400/30">
              <ShieldCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Cumplimiento Ven-NIF & SENIAT</h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Cálculos automáticos de retenciones IVA/ISLR, comprobantes electrónicos, prueba de efectivo de 4 columnas a Bs. 0,00 bajo normativa legal vigente.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs transition-all hover:bg-white/10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
              <BarChart3 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Multimoneda & Parafiscales</h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Gestión integral de FAOV, INCES, IVSS y conciliación bancaria multibanco en Bs. / USD con conversión automática a Tasa Oficial BCV de hoy (Bs. {bcvRate.toFixed(2)}).
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs transition-all hover:bg-white/10">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-400/30">
              <Lock className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Estándares Internacionales & Base Aislada</h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Infraestructura blindada bajo reglas Zero-Trust en Google Cloud Firestore. Cada usuario mantiene su base de datos aislada por su correo electrónico de Gmail.
              </p>
            </div>
          </div>

        </div>

        {/* Left Footer Info */}
        <div className="relative z-10 text-[11px] text-slate-400 border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-2">
          <span>NOMINUS RegTech © {new Date().getFullYear()}</span>
          <span className="text-cyan-300 font-mono">Tasa Oficial BCV: Bs. {bcvRate.toFixed(2)}/USD</span>
        </div>

      </div>

      {/* RIGHT COLUMN: Clean White Login Card Area (Exactamente igual al mockup cargado) */}
      <div className="lg:w-[48%] xl:w-[45%] bg-[#f8fafc] p-6 sm:p-12 lg:p-16 flex items-center justify-center">
        
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 space-y-6">
          
          {/* Card Title */}
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bienvenido</h2>
            <p className="text-xs font-semibold text-slate-500">
              Ingresa a tu consola de administración.
            </p>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-snug">{authError}</p>
            </div>
          )}

          {/* Primary Action 1: Google Sign In Button */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleClick}
              disabled={isLoggingIn}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0c3953] hover:bg-[#082b3f] active:bg-[#051c2a] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.23v3.15C3.25 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.23C.44 8.16 0 9.99 0 12s.44 3.84 1.23 5.42l4.05-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.23 6.58l4.05 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>
              <span>{isLoggingIn ? 'Conectando con Google...' : 'Continuar con Google (Gmail)'}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider absolute">
              o ingresa tu usuario / correo
            </span>
          </div>

          {/* Form: Direct Email / Password Entry */}
          <form onSubmit={handleEmailSubmit} className="space-y-4 text-xs">
            
            {/* Field 1: USUARIO O CORREO */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                USUARIO O CORREO
              </label>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ejemplo@gmail.com o usuario"
                className="w-full px-4 py-3 rounded-2xl bg-[#eef3f8] border border-slate-200 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#0c3953] transition-all"
                required
              />
            </div>

            {/* Field 2: CONTRASEÑA */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  CONTRASEÑA
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Si usas inicio de sesión con Google, no requieres contraseña. Si usas correo directo, presiona "Ingresar al Sistema"');
                  }}
                  className="text-[10px] font-black text-sky-600 hover:text-sky-800 uppercase tracking-tight hover:underline"
                >
                  ¿OLVIDASTE LA CLAVE?
                </a>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-[#eef3f8] border border-slate-200 text-slate-900 font-bold pr-10 focus:outline-none focus:ring-2 focus:ring-[#0c3953] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0c3953] hover:bg-[#082b3f] active:bg-[#051c2a] text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Ingresar al Sistema</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>

          </form>

          {/* Quick Demo Access Option */}
          <div className="pt-2 text-center border-t border-slate-100 space-y-2">
            <button
              onClick={onStartDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4 text-amber-600" />
              <span>¿Quieres probar la app sin ingresar? **Entrar en Modo Demo**</span>
            </button>
          </div>

          {/* Footer Links & Fineprint */}
          <div className="text-center text-[11px] text-slate-500 space-y-1 pt-2">
            <div className="flex items-center justify-center gap-2 text-slate-600 font-bold">
              <span>¿Aún no tienes acceso?</span>
              <a href="#planes" onClick={(e) => { e.preventDefault(); alert('Todos los usuarios tienen acceso gratuito ilimitado.'); }} className="text-sky-700 hover:underline">Ver Planes</a>
              <span>•</span>
              <a href="#inicio" onClick={(e) => { e.preventDefault(); onStartDemo(); }} className="text-sky-700 hover:underline">Inicio</a>
              <span>•</span>
              <a href="#acerca" onClick={(e) => { e.preventDefault(); alert('NOMINUS RegTech Venezuela'); }} className="text-sky-700 hover:underline">Acerca de</a>
            </div>

            <p className="text-[10px] text-slate-400">
              Al ingresar, aceptas nuestra <span className="underline cursor-pointer">Política de Privacidad (RGPD)</span> y <span className="underline cursor-pointer">Términos de Servicio</span>.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
