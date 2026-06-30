import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Dumbbell,
  FileDown,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Play,
  Scissors,
  Shield,
  Smartphone,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, "");
const WHATSAPP_MSG = encodeURIComponent(
  "Hola, me gustaría una demo de TimeClock para mi negocio."
);

function whatsAppHref() {
  if (!WHATSAPP_NUMBER) return "/register-business";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
}

const features = [
  {
    icon: Smartphone,
    title: "Fichaje digital",
    text: "Tus empleados fichan desde el móvil, tablet o PC con un solo clic.",
  },
  {
    icon: LayoutDashboard,
    title: "Panel de administrador",
    text: "Dashboard con seguimiento en vivo: quién trabaja, está de pausa o sin fichar.",
  },
  {
    icon: Clock,
    title: "Control de horas",
    text: "Visualiza horas por día, semana o mes con calendario y correcciones.",
  },
  {
    icon: CalendarDays,
    title: "Vacaciones y ausencias",
    text: "Solicitudes, aprobaciones e incidencias en un solo lugar.",
  },
  {
    icon: FileDown,
    title: "Informes descargables",
    text: "Exporta registros laborales en PDF, Excel o CSV para nóminas.",
  },
  {
    icon: Shield,
    title: "Datos seguros",
    text: "Cumplimiento RGPD, auditoría y control de acceso por empresa.",
  },
];

const steps = [
  {
    icon: Building2,
    title: "Configuramos tu empresa",
    text: "Registra tu negocio, ubicación GPS y empleados en minutos.",
  },
  {
    icon: Smartphone,
    title: "Tus empleados fichan",
    text: "Entrada y salida desde el móvil, con validación de ubicación opcional.",
  },
  {
    icon: BarChart3,
    title: "Tú controlas todo",
    text: "Dashboard, horas, vacaciones e informes desde el panel admin.",
  },
];

const audiences = [
  { icon: UtensilsCrossed, label: "Restaurantes y bares" },
  { icon: Store, label: "Tiendas y comercios" },
  { icon: Scissors, label: "Peluquerías y estética" },
  { icon: Wrench, label: "Talleres y servicios" },
  { icon: Building2, label: "Oficinas y equipos" },
  { icon: Dumbbell, label: "Gimnasios y centros" },
];

const faqs = [
  {
    q: "¿Los empleados tienen que instalar una app?",
    a: "No. TimeClock funciona en el navegador del móvil o PC. Pueden añadir un acceso directo a la pantalla de inicio como una app.",
  },
  {
    q: "¿Puedo ver los fichajes desde el móvil?",
    a: "Sí. El panel de administrador es responsive y el dashboard de seguimiento se actualiza en tiempo real.",
  },
  {
    q: "¿Es válido para el control horario en España?",
    a: "Registra entradas, salidas, pausas e incidencias con trazabilidad. Los informes facilitan el cumplimiento del registro de jornada.",
  },
  {
    q: "¿Hay geolocalización obligatoria?",
    a: "Es opcional por empresa. Puedes activar validación GPS con radio configurable alrededor del local.",
  },
  {
    q: "¿Puedo probarlo antes de contratar?",
    a: "Sí. Regístrate gratis con 14 días de prueba o pide una demo por WhatsApp.",
  },
];

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[220px] rounded-[2rem] border-[6px] border-slate-800 bg-slate-900 p-2 shadow-2xl">
      <div className="rounded-[1.4rem] bg-gradient-to-b from-emerald-50 to-white p-4 min-h-[360px]">
        <div className="text-center mb-4">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-700 text-white mb-2">
            <Clock className="size-5" />
          </div>
          <p className="text-xs font-semibold text-slate-800">TimeClock</p>
          <p className="text-[10px] text-slate-500">martes, 30 jun</p>
        </div>
        <p className="text-3xl font-bold text-center text-slate-900 mb-1">09:02</p>
        <p className="text-[10px] text-center text-slate-500 mb-6">Horario de Madrid</p>
        <div className="space-y-2">
          <div className="rounded-xl bg-emerald-700 text-white text-center py-3 text-sm font-semibold">
            Fichar entrada
          </div>
          <div className="rounded-xl border border-slate-200 text-slate-400 text-center py-3 text-sm">
            Fichar salida
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      <div className="flex min-h-[280px]">
        <div className="w-36 shrink-0 bg-slate-900 p-3 space-y-2 hidden sm:block">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2">Menú</p>
          {["Dashboard", "Empleados", "Horas", "Vacaciones", "Ajustes"].map((item, i) => (
            <div
              key={item}
              className={cn(
                "rounded-lg px-2 py-1.5 text-[11px]",
                i === 0 ? "bg-emerald-700 text-white" : "text-slate-400"
              )}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 bg-slate-50">
          <p className="text-sm font-bold text-slate-900 mb-3">Dashboard · Seguimiento en vivo</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-emerald-100 border border-emerald-200 p-2">
              <p className="text-[10px] text-emerald-800">Trabajando</p>
              <p className="text-lg font-bold text-emerald-900">4</p>
            </div>
            <div className="rounded-lg bg-amber-100 border border-amber-200 p-2">
              <p className="text-[10px] text-amber-800">En pausa</p>
              <p className="text-lg font-bold text-amber-900">1</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2 h-24 flex items-end gap-1">
            {[40, 65, 55, 80, 70, 90, 60].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-emerald-600/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { adminSession, employeeSession, isAuthLoading } = useAuthContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (adminSession) setLocation("/admin");
    else if (employeeSession) setLocation("/employee");
  }, [adminSession, employeeSession, isAuthLoading, setLocation]);

  if (isAuthLoading || adminSession || employeeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  const waHref = whatsAppHref();
  const waExternal = waHref.startsWith("http");

  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <a href="#" className="flex items-center gap-2 shrink-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <Clock className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-emerald-900">TimeClock</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Fichaje de empleados</p>
            </div>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#funciones" className="hover:text-emerald-800">Funciones</a>
            <a href="#para-quien" className="hover:text-emerald-800">Para quién es</a>
            <a href="#precios" className="hover:text-emerald-800">Precios</a>
            <a href="#faq" className="hover:text-emerald-800">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/acceso">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-700">
                Acceder
              </Button>
            </Link>
            {waExternal ? (
              <a href={waHref} target="_blank" rel="noreferrer">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5">
                  <MessageCircle className="size-4" />
                  <span className="hidden sm:inline">Pedir demo</span>
                </Button>
              </a>
            ) : (
              <Link href="/register-business">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5">
                  <MessageCircle className="size-4" />
                  <span className="hidden sm:inline">Probar gratis</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="mb-4 inline-block rounded-full bg-emerald-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Control horario fácil y legal
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">
              Controla los horarios de tu equipo{" "}
              <span className="text-emerald-300">sin complicaciones</span>
            </h1>
            <p className="mt-5 text-lg text-emerald-100/90 max-w-xl">
              Tus empleados fichan desde el móvil, tablet o PC. Tú tienes un panel claro con
              seguimiento en vivo, informes y vacaciones.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {waExternal ? (
                <a href={waHref} target="_blank" rel="noreferrer">
                  <Button size="lg" className="bg-white text-emerald-900 hover:bg-emerald-50 gap-2">
                    <MessageCircle className="size-5" />
                    Pedir demo por WhatsApp
                  </Button>
                </a>
              ) : (
                <Link href="/register-business">
                  <Button size="lg" className="bg-white text-emerald-900 hover:bg-emerald-50 gap-2">
                    Empezar prueba gratis
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              )}
              <a href="#funciones">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-emerald-400/50 text-white hover:bg-emerald-800/50 gap-2"
                >
                  <Play className="size-4" />
                  Ver cómo funciona
                </Button>
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-emerald-100">
              {["Sin papel", "Sin instalaciones", "Siempre accesible"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute -right-4 top-8 hidden lg:block scale-90 opacity-95">
              <DashboardMockup />
            </div>
            <div className="relative z-10 -rotate-2 lg:mr-32">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Todo lo que necesitas en un solo sistema
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              Fichaje, control horario, vacaciones e informes laborales pensados para pymes españolas.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="p-6 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Icon className="size-6" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Empezar es muy fácil</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="relative text-center">
                {i < steps.length - 1 ? (
                  <ArrowRight className="absolute right-0 top-8 hidden md:block size-6 text-emerald-300 -mr-4 translate-x-1/2" />
                ) : null}
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-800 text-white">
                  <Icon className="size-8" />
                </div>
                <p className="text-xs font-semibold text-emerald-700 mb-1">Paso {i + 1}</p>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section id="para-quien" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Ideal para todo tipo de negocios
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-8 min-h-[140px] flex flex-col justify-end"
              >
                <div className="absolute right-4 top-4 opacity-20 group-hover:opacity-30 transition-opacity">
                  <Icon className="size-16 text-white" />
                </div>
                <div className="relative flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white">
                    <Icon className="size-5" />
                  </div>
                  <p className="font-semibold text-white">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Un panel claro y fácil de usar
            </h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Dashboard con seguimiento en vivo, gestión de empleados, horas trabajadas, turnos,
              vacaciones e informes descargables. Todo desde el navegador, sin instalar nada.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Seguimiento en tiempo real del equipo",
                "Calendario de vacaciones con nombres",
                "Informes PDF y Excel para nóminas",
                "Geolocalización opcional al fichar",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="size-5 shrink-0 text-emerald-600 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/acceso">
              <Button className="bg-emerald-700 hover:bg-emerald-800 gap-2">
                <Play className="size-4" />
                Probar la app
              </Button>
            </Link>
          </div>
          <DashboardMockup />
        </div>
      </section>

      {/* Pricing + FAQ */}
      <section id="precios" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <Card className="p-8 border-emerald-200 shadow-lg">
              <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                Plan negocio
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-slate-900">14 días</span>
                <span className="text-slate-600">de prueba gratis</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Fichaje móvil y PC",
                  "Panel admin con dashboard",
                  "Hasta 5 empleados en trial",
                  "Informes y exportación",
                  "Vacaciones e incidencias",
                  "Soporte por email",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="size-4 text-emerald-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register-business">
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800" size="lg">
                  Registrar mi negocio
                </Button>
              </Link>
              <p className="text-xs text-slate-500 text-center mt-3">
                Sin tarjeta para empezar · Horario Europa/Madrid
              </p>
            </Card>

            <div id="faq">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Preguntas frecuentes</h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, i) => (
                  <AccordionItem key={faq.q} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-slate-900 hover:text-emerald-800">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-emerald-950 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-emerald-800/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 text-center lg:px-8">
          <h2 className="text-3xl font-bold mb-4 sm:text-4xl">
            Empieza a controlar los horarios de tu equipo hoy mismo
          </h2>
          <p className="text-emerald-100 mb-8">
            Regístrate en minutos o contacta con nosotros para una demo personalizada.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {waExternal ? (
              <a href={waHref} target="_blank" rel="noreferrer">
                <Button size="lg" className="bg-white text-emerald-900 hover:bg-emerald-50 gap-2">
                  <MessageCircle className="size-5" />
                  Pedir demo por WhatsApp
                </Button>
              </a>
            ) : null}
            <Link href="/register-business">
              <Button
                size="lg"
                variant={waExternal ? "outline" : "default"}
                className={cn(
                  waExternal
                    ? "border-emerald-400 text-white hover:bg-emerald-800"
                    : "bg-white text-emerald-900 hover:bg-emerald-50"
                )}
              >
                Crear cuenta gratis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacto" className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-800 text-white">
                  <Clock className="size-4" />
                </div>
                <span className="font-bold text-emerald-900">TimeClock</span>
              </div>
              <p className="text-sm text-slate-600">
                Software de fichaje y control horario para equipos en España. Simple, legal y
                accesible desde cualquier dispositivo.
              </p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm">
              <div>
                <p className="font-semibold text-slate-900 mb-2">Producto</p>
                <ul className="space-y-1 text-slate-600">
                  <li><a href="#funciones" className="hover:text-emerald-800">Funciones</a></li>
                  <li><a href="#precios" className="hover:text-emerald-800">Precios</a></li>
                  <li><Link href="/acceso" className="hover:text-emerald-800">Acceder</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-2">Legal</p>
                <ul className="space-y-1 text-slate-600">
                  <li><Link href="/legal/privacy" className="hover:text-emerald-800">Privacidad</Link></li>
                  <li><Link href="/legal/terms" className="hover:text-emerald-800">Términos</Link></li>
                  <li><Link href="/legal/dpa" className="hover:text-emerald-800">DPA</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} TimeClock. Todos los derechos reservados.</p>
            <div className="flex items-center gap-3">
              <MapPin className="size-3.5" />
              <span>España · Zona horaria Europe/Madrid</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
