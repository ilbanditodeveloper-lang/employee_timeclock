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
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useLocalizedLandingConfig } from "@/i18n/useLocalizedLandingConfig";
import { trpc } from "@/lib/trpc";
import { isCheckoutPlan } from "@shared/stripeConfig";
import {
  DEFAULT_LANDING_PAGE_CONFIG,
  buildVisitorSupportWhatsAppHref,
  resolveFaqAnswer,
  type LandingPageConfig,
} from "@shared/landingConfig";
import {
  ArrowRight,
  AlertCircle,
  BarChart3,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  FileDown,
  House,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Palmtree,
  Pause,
  Play,
  Shield,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeroBackground } from "@/components/LandingHeroBackground";
import LandingDashboardMockup from "@/components/LandingDashboardMockup";
import WhatsAppFloatButton from "@/components/WhatsAppFloatButton";

const PRICING_SECTION_ID = "precios";
const CONTACT_SECTION_ID = "contacto";

function useLandingConfig(): LandingPageConfig {
  const query = trpc.publicApi.getLandingPageConfig.useQuery();
  return query.data ?? DEFAULT_LANDING_PAGE_CONFIG;
}

function PhoneMockup() {
  const { t } = useLocale();

  const navItems = useMemo(
    () =>
      [
        { label: t("landing.phoneMockup.nav.home"), icon: House, active: true },
        { label: t("landing.phoneMockup.nav.timeOff"), icon: Palmtree },
        { label: t("landing.phoneMockup.nav.calendar"), icon: Calendar },
        { label: t("landing.phoneMockup.nav.schedule"), icon: CalendarDays },
      ] as const,
    [t]
  );

  return (
    <div className="relative mx-auto w-[220px] rounded-[2rem] border-[6px] border-slate-800 bg-slate-900 p-2 shadow-2xl">
      <div className="flex min-h-[440px] flex-col overflow-hidden rounded-[1.4rem] bg-white">
        <div className="border-b border-slate-100 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-800 text-white">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-900">{t("landing.phoneMockup.appName")}</p>
              <p className="text-[8px] text-slate-500">{t("landing.phoneMockup.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-3 py-3">
          <div className="mb-3 text-center">
            <p className="text-[26px] font-bold leading-none text-slate-900">09:02</p>
            <p className="mt-1 text-[9px] text-slate-500">martes, 30 jun</p>
            <p className="text-[8px] text-slate-400">{t("landing.phoneMockup.timezone")}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-700 py-2.5 text-white">
              <Clock className="size-3.5" />
              <span className="text-[10px] font-semibold">{t("landing.phoneMockup.clockIn")}</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-blue-200 bg-white py-2.5 text-blue-900">
              <Pause className="size-3.5" />
              <span className="text-[10px] font-semibold">{t("landing.phoneMockup.pause")}</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-slate-200 bg-white py-2.5 text-slate-800">
              <Clock className="size-3.5" />
              <span className="text-[10px] font-semibold">{t("landing.phoneMockup.clockOut")}</span>
            </div>
            <div className="flex items-center justify-center gap-1 rounded-xl border-2 border-blue-200 bg-white py-2 text-blue-900">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="text-[9px] font-semibold">{t("landing.phoneMockup.reportIncident")}</span>
            </div>
          </div>

          <div className="mt-auto rounded-lg bg-blue-50 px-2 py-1.5 text-center text-[8px] text-slate-600">
            {t("landing.phoneMockup.statusLabel")}{" "}
            <span className="font-semibold text-slate-800">{t("landing.phoneMockup.notClockedIn")}</span>
          </div>
        </div>

        <nav className="grid grid-cols-4 gap-0.5 border-t border-blue-100 bg-white p-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[7px] font-medium",
                  "active" in item && item.active
                    ? "bg-blue-600 text-white"
                    : "text-slate-600"
                )}
              >
                <Icon className="size-3" />
                {item.label}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { adminSession, employeeSession } = useAuthContext();
  const { t, locale } = useLocale();
  const apiConfig = useLandingConfig();
  const config = useLocalizedLandingConfig(apiConfig);
  const appConfig = trpc.publicApi.getAppConfig.useQuery();
  const stripeEnabled = appConfig.data?.stripe?.enabled ?? false;
  const { hero } = config;

  const features = useMemo(
    () => [
      {
        id: "digitalClock",
        icon: Smartphone,
        title: t("landing.features.items.digitalClock.title"),
        text: t("landing.features.items.digitalClock.text"),
      },
      {
        id: "adminPanel",
        icon: LayoutDashboard,
        title: t("landing.features.items.adminPanel.title"),
        text: t("landing.features.items.adminPanel.text"),
      },
      {
        id: "hoursControl",
        icon: Clock,
        title: t("landing.features.items.hoursControl.title"),
        text: t("landing.features.items.hoursControl.text"),
      },
      {
        id: "timeOff",
        icon: CalendarDays,
        title: t("landing.features.items.timeOff.title"),
        text: t("landing.features.items.timeOff.text"),
      },
      {
        id: "reports",
        icon: FileDown,
        title: t("landing.features.items.reports.title"),
        text: t("landing.features.items.reports.text"),
      },
      {
        id: "security",
        icon: Shield,
        title: t("landing.features.items.security.title"),
        text: t("landing.features.items.security.text"),
      },
    ],
    [t, locale]
  );

  const steps = useMemo(
    () => [
      {
        id: "setup",
        icon: Building2,
        title: t("landing.steps.items.setup.title"),
        text: t("landing.steps.items.setup.text"),
      },
      {
        id: "clock",
        icon: Smartphone,
        title: t("landing.steps.items.clock.title"),
        text: t("landing.steps.items.clock.text"),
      },
      {
        id: "control",
        icon: BarChart3,
        title: t("landing.steps.items.control.title"),
        text: t("landing.steps.items.control.text"),
      },
    ],
    [t, locale]
  );

  const dashboardBullets = useMemo(
    () => [
      t("landing.dashboardPreview.bullets.liveTracking"),
      t("landing.dashboardPreview.bullets.timeOffCalendar"),
      t("landing.dashboardPreview.bullets.payrollReports"),
      t("landing.dashboardPreview.bullets.optionalGeolocation"),
    ],
    [t, locale]
  );

  const pricingCtaHref = (packId: string) =>
    isCheckoutPlan(packId) ? `/register-business?plan=${packId}` : "/register-business";

  const supportWhatsAppHref = useMemo(
    () => buildVisitorSupportWhatsAppHref(config.whatsappNumber),
    [config.whatsappNumber]
  );

  useEffect(() => {
    if (adminSession) setLocation("/admin");
    else if (employeeSession) setLocation("/employee");
  }, [adminSession, employeeSession, setLocation]);

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
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {t("landing.brandTagline")}
              </p>
            </div>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#funciones" className="hover:text-blue-800">
              {t("landing.nav.features")}
            </a>
            <a href="#para-quien" className="hover:text-blue-800">
              {t("landing.nav.audience")}
            </a>
            <a href="#precios" className="hover:text-blue-800">
              {t("landing.nav.pricing")}
            </a>
            <a href="#faq" className="hover:text-blue-800">
              {t("landing.nav.faq")}
            </a>
            {supportWhatsAppHref ? (
              <a href={`#${CONTACT_SECTION_ID}`} className="hover:text-blue-800">
                {t("landing.nav.contact")}
              </a>
            ) : null}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageSwitcher compact />
            <Link href="/acceso">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-700 px-2 sm:px-3 text-xs sm:text-sm"
              >
                {t("landing.nav.signIn")}
              </Button>
            </Link>
            <a href={`#${PRICING_SECTION_ID}`}>
              <Button
                size="sm"
                className="bg-blue-700 hover:bg-blue-800 text-white gap-1.5 px-2 sm:px-3"
              >
                <Building2 className="size-4 shrink-0" />
                <span className="hidden md:inline">{t("landing.nav.registerFull")}</span>
                <span className="md:hidden text-xs">{t("landing.nav.register")}</span>
              </Button>
            </a>
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
              <a href={`#${PRICING_SECTION_ID}`}>
                <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50 gap-2">
                  <Building2 className="size-5" />
                  {t("landing.nav.registerFull")}
                </Button>
              </a>
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
              {t("landing.features.title")}
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              {t("landing.features.subtitle")}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ id, icon: Icon, title, text }) => (
              <Card key={id} className="p-6 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
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
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            {t("landing.steps.title")}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map(({ id, icon: Icon, title, text }, i) => (
              <div key={id} className="relative text-center">
                {i < steps.length - 1 ? (
                  <ArrowRight className="absolute right-0 top-8 hidden md:block size-6 text-blue-300 -mr-4 translate-x-1/2" />
                ) : null}
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-blue-800 text-white">
                  <Icon className="size-8" />
                </div>
                <p className="text-xs font-semibold text-blue-700 mb-1">
                  {t("landing.steps.stepLabel", { number: String(i + 1) })}
                </p>
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
            {t("landing.audience.title")}
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
              {t("landing.dashboardPreview.title")}
            </h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              {t("landing.dashboardPreview.description")}
            </p>
            <ul className="space-y-3 mb-8">
              {dashboardBullets.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="size-5 shrink-0 text-blue-600 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/acceso">
              <Button className="bg-blue-700 hover:bg-blue-800 gap-2">
                <Play className="size-4" />
                {t("landing.dashboardPreview.cta")}
              </Button>
            </Link>
          </div>
          <div className="w-full min-w-0 overflow-x-auto pb-1 lg:overflow-visible">
            <LandingDashboardMockup className="min-w-[min(100%,340px)]" />
          </div>
        </div>
      </section>

      {/* Pricing + FAQ */}
      <section id={PRICING_SECTION_ID} className="py-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              {t("landing.pricing.title")}
            </h2>
            <p className="mt-3 text-slate-600">{config.trialHeadline}</p>
            {stripeEnabled ? (
              <p className="mt-2 text-sm text-slate-500">{t("landing.pricing.discountHint")}</p>
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
                    {t("landing.pricing.mostPopular")}
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
                <Link href={pricingCtaHref(pack.id)}>
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
                </Link>
              </Card>
            ))}
          </div>

          <div id="faq" className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
              {t("landing.faq.title")}
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

      {/* Contact */}
      {supportWhatsAppHref ? (
        <section id={CONTACT_SECTION_ID} className="py-20 bg-white">
          <div className="mx-auto max-w-3xl px-4 text-center lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              {t("landing.contact.title")}
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              {t("landing.contact.description")}
            </p>
            <p className="mt-2 text-sm text-slate-500">{t("landing.contact.note")}</p>
            <a
              href={supportWhatsAppHref}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block"
            >
              <Button
                size="lg"
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 shadow-md"
              >
                <MessageCircle className="size-5" />
                {t("landing.contact.whatsappCta")}
              </Button>
            </a>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="relative overflow-hidden bg-blue-950 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-blue-800/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 text-center lg:px-8">
          <h2 className="text-3xl font-bold mb-4 sm:text-4xl">{hero.footerTitle}</h2>
          <p className="text-blue-100 mb-8">{hero.footerSubtitle}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`#${PRICING_SECTION_ID}`}>
              <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50 gap-2">
                <Building2 className="size-5" />
                {t("landing.registerCta.registerNow")}
              </Button>
            </a>
            <Link href="/register-business">
              <Button
                size="lg"
                variant="outline"
                className="border-blue-400 text-white hover:bg-blue-800"
              >
                {hero.footerCtaRegisterLabel}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-800 text-white">
                  <Clock className="size-4" />
                </div>
                <span className="font-bold text-blue-900">TimeClock</span>
              </div>
              <p className="text-sm text-slate-600">{t("landing.footer.description")}</p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm">
              <div>
                <p className="font-semibold text-slate-900 mb-2">{t("landing.footer.product")}</p>
                <ul className="space-y-1 text-slate-600">
                  <li>
                    <a href="#funciones" className="hover:text-blue-800">
                      {t("landing.nav.features")}
                    </a>
                  </li>
                  <li>
                    <a href="#precios" className="hover:text-blue-800">
                      {t("landing.nav.pricing")}
                    </a>
                  </li>
                  <li>
                    <Link href="/acceso" className="hover:text-blue-800">
                      {t("landing.nav.signIn")}
                    </Link>
                  </li>
                  {supportWhatsAppHref ? (
                    <li>
                      <a href={`#${CONTACT_SECTION_ID}`} className="hover:text-blue-800">
                        {t("landing.nav.contact")}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-2">{t("landing.footer.legal")}</p>
                <ul className="space-y-1 text-slate-600">
                  <li>
                    <Link href="/legal/privacy" className="hover:text-blue-800">
                      {t("landing.footer.privacy")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/terms" className="hover:text-blue-800">
                      {t("landing.footer.terms")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/dpa" className="hover:text-blue-800">
                      {t("landing.footer.dpa")}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500">
            <p>
              {t("landing.footer.copyright", { year: String(new Date().getFullYear()) })}
            </p>
            <div className="flex items-center gap-3">
              <MapPin className="size-3.5" />
              <span>{t("landing.footer.location")}</span>
            </div>
          </div>
        </div>
      </footer>

      {supportWhatsAppHref ? (
        <WhatsAppFloatButton href={supportWhatsAppHref} />
      ) : null}
    </div>
  );
}
