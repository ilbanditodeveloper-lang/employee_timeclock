import { useEffect, useMemo } from "react";
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
import { trpc } from "@/lib/trpc";
import { isCheckoutPlan } from "@shared/stripeConfig";
import {
  DEFAULT_LANDING_PAGE_CONFIG,
  buildWhatsAppHref,
  resolveFaqAnswer,
  type LandingPageConfig,
} from "@shared/landingConfig";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Clock,
  FileDown,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Play,
  Shield,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeroBackground } from "@/components/LandingHeroBackground";
import LandingDashboardMockup from "@/components/LandingDashboardMockup";

const WHATSAPP_MSG = "Hola, me gustaría una demo de TimeClock para mi negocio.";

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

function useLandingConfig(): LandingPageConfig {
  const query = trpc.publicApi.getLandingPageConfig.useQuery();
  return query.data ?? DEFAULT_LANDING_PAGE_CONFIG;
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[220px] rounded-[2rem] border-[6px] border-slate-800 bg-slate-900 p-2 shadow-2xl">
      <div className="rounded-[1.4rem] bg-gradient-to-b from-blue-50 to-white p-4 min-h-[360px]">
        <div className="text-center mb-4">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-700 text-white mb-2">
            <Clock className="size-5" />
          </div>
          <p className="text-xs font-semibold text-slate-800">TimeClock</p>
          <p className="text-[10px] text-slate-500">martes, 30 jun</p>
        </div>
        <p className="text-3xl font-bold text-center text-slate-900 mb-1">09:02</p>
        <p className="text-[10px] text-center text-slate-500 mb-6">Horario de Madrid</p>
        <div className="space-y-2">
          <div className="rounded-xl bg-blue-700 text-white text-center py-3 text-sm font-semibold">
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

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { adminSession, employeeSession, isAuthLoading } = useAuthContext();
  const config = useLandingConfig();
  const appConfig = trpc.publicApi.getAppConfig.useQuery();
  const stripeEnabled = appConfig.data?.stripe?.enabled ?? false;

  const waHref = useMemo(
    () => buildWhatsAppHref(config.whatsappNumber, WHATSAPP_MSG) ?? "/register-business",
    [config.whatsappNumber]
  );
  const waExternal = waHref.startsWith("http");
  const { hero } = config;

  const pricingCtaHref = (packId: string) => {
    if (stripeEnabled && isCheckoutPlan(packId)) {
      return `/register-business?plan=${packId}`;
    }
    return waExternal ? waHref : "/register-business";
  };
  const pricingCtaExternal = (packId: string) =>
    !(stripeEnabled && isCheckoutPlan(packId)) && waExternal;

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

  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <a href="#" className="flex items-center gap-2 shrink-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-800 text-white">
              <Clock className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-blue-900">TimeClock</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Fichaje de empleados</p>
            </div>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#funciones" className="hover:text-blue-800">Funciones</a>
            <a href="#para-quien" className="hover:text-blue-800">Para quién es</a>
            <a href="#precios" className="hover:text-blue-800">Precios</a>
            <a href="#faq" className="hover:text-blue-800">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/acceso">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-700">
                Acceder
              </Button>
            </Link>
            {waExternal ? (
              <a href={waHref} target="_blank" rel="noreferrer">
                <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white gap-1.5">
                  <MessageCircle className="size-4" />
                  <span className="hidden sm:inline">{hero.ctaWhatsappLabel}</span>
                </Button>
              </a>
            ) : (
              <Link href="/register-business">
                <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white gap-1.5">
                  <MessageCircle className="size-4" />
                  <span className="hidden sm:inline">Probar gratis</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-white">
        <LandingHeroBackground />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="mb-4 inline-block rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100 backdrop-blur-sm">
              {hero.badge}
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">
              {hero.titleMain}{" "}
              <span className="text-sky-200">{hero.titleHighlight}</span>
            </h1>
            <p className="mt-5 text-lg text-blue-100/90 max-w-xl">{hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {waExternal ? (
                <a href={waHref} target="_blank" rel="noreferrer">
                  <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50 gap-2">
                    <MessageCircle className="size-5" />
                    {hero.ctaWhatsappLabel}
                  </Button>
                </a>
              ) : (
                <Link href="/register-business">
                  <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50 gap-2">
                    {hero.ctaTrialLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              )}
              <a href="#funciones">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-blue-400/50 text-white hover:bg-blue-800/50 gap-2"
                >
                  <Play className="size-4" />
                  {hero.ctaSecondaryLabel}
                </Button>
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-blue-100">
              {hero.trustBadges.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-blue-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute -right-4 top-8 hidden lg:block scale-[0.85] opacity-95">
              <LandingDashboardMockup compact />
            </div>
            <div className="relative z-10 -rotate-2 lg:mr-32">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="relative z-10 py-20 bg-white">
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
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
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
                  <ArrowRight className="absolute right-0 top-8 hidden md:block size-6 text-blue-300 -mr-4 translate-x-1/2" />
                ) : null}
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-blue-800 text-white">
                  <Icon className="size-8" />
                </div>
                <p className="text-xs font-semibold text-blue-700 mb-1">Paso {i + 1}</p>
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
            {config.audienceImages.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl min-h-[160px] flex flex-col justify-end bg-slate-800"
              >
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                <div className="relative p-4">
                  <p className="font-semibold text-white text-sm sm:text-base">{item.label}</p>
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
                  <Check className="size-5 shrink-0 text-blue-600 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/acceso">
              <Button className="bg-blue-700 hover:bg-blue-800 gap-2">
                <Play className="size-4" />
                Probar la app
              </Button>
            </Link>
          </div>
          <LandingDashboardMockup />
        </div>
      </section>

      {/* Pricing + FAQ */}
      <section id="precios" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Planes y precios</h2>
            <p className="mt-3 text-slate-600">{config.trialHeadline}</p>
            {stripeEnabled ? (
              <p className="mt-2 text-sm text-slate-500">
                ¿Tienes un código de descuento? Podrás aplicarlo en la pantalla de pago seguro.
              </p>
            ) : null}
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-16">
            {config.pricingPacks.map((pack) => (
              <Card
                key={pack.id}
                className={cn(
                  "p-6 flex flex-col",
                  pack.highlighted
                    ? "border-blue-500 shadow-lg ring-2 ring-blue-500/20 scale-[1.02]"
                    : "border-slate-200"
                )}
              >
                {pack.highlighted ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
                    Más popular
                  </p>
                ) : null}
                <h3 className="text-xl font-bold text-slate-900">{pack.name}</h3>
                <p className="text-sm text-slate-600 mt-1 mb-4">{pack.description}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-slate-900">{pack.price}</span>
                  <span className="text-slate-600">{pack.priceSuffix}</span>
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {pack.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="size-4 text-blue-600 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {pricingCtaExternal(pack.id) ? (
                  <a href={pricingCtaHref(pack.id)} target="_blank" rel="noreferrer" className="w-full">
                    <Button
                      className={cn(
                        "w-full",
                        pack.highlighted
                          ? "bg-blue-700 hover:bg-blue-800"
                          : "bg-slate-900 hover:bg-slate-800"
                      )}
                    >
                      {pack.ctaLabel}
                    </Button>
                  </a>
                ) : (
                  <Link href={pricingCtaHref(pack.id)}>
                    <Button
                      className={cn(
                        "w-full",
                        pack.highlighted
                          ? "bg-blue-700 hover:bg-blue-800"
                          : "bg-slate-900 hover:bg-slate-800"
                      )}
                    >
                      {stripeEnabled && isCheckoutPlan(pack.id) ? "Contratar plan" : pack.ctaLabel}
                    </Button>
                  </Link>
                )}
              </Card>
            ))}
          </div>

          <div id="faq" className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
              Preguntas frecuentes
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {config.faqs.map((faq, i) => (
                <AccordionItem key={`${faq.q}-${i}`} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-slate-900 hover:text-blue-800">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600">
                    {resolveFaqAnswer(faq.a, config.trialDays)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-blue-950 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-blue-800/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 text-center lg:px-8">
          <h2 className="text-3xl font-bold mb-4 sm:text-4xl">{hero.footerTitle}</h2>
          <p className="text-blue-100 mb-8">{hero.footerSubtitle}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {waExternal ? (
              <a href={waHref} target="_blank" rel="noreferrer">
                <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50 gap-2">
                  <MessageCircle className="size-5" />
                  {hero.ctaWhatsappLabel}
                </Button>
              </a>
            ) : null}
            <Link href="/register-business">
              <Button
                size="lg"
                variant={waExternal ? "outline" : "default"}
                className={cn(
                  waExternal
                    ? "border-blue-400 text-white hover:bg-blue-800"
                    : "bg-white text-blue-900 hover:bg-blue-50"
                )}
              >
                {hero.footerCtaRegisterLabel}
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
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-800 text-white">
                  <Clock className="size-4" />
                </div>
                <span className="font-bold text-blue-900">TimeClock</span>
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
                  <li><a href="#funciones" className="hover:text-blue-800">Funciones</a></li>
                  <li><a href="#precios" className="hover:text-blue-800">Precios</a></li>
                  <li><Link href="/acceso" className="hover:text-blue-800">Acceder</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-2">Legal</p>
                <ul className="space-y-1 text-slate-600">
                  <li><Link href="/legal/privacy" className="hover:text-blue-800">Privacidad</Link></li>
                  <li><Link href="/legal/terms" className="hover:text-blue-800">Términos</Link></li>
                  <li><Link href="/legal/dpa" className="hover:text-blue-800">DPA</Link></li>
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
