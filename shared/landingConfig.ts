import { z } from "zod";

export const LANDING_SETTINGS_KEY = "landing_page";

export const landingPricingPackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.string().min(1),
  priceSuffix: z.string().default("/mes"),
  description: z.string().default(""),
  features: z.array(z.string()).min(1),
  highlighted: z.boolean().optional(),
  ctaLabel: z.string().default("Pedir información"),
});

export const landingAudienceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  imageUrl: z.string().url(),
});

export const landingFaqSchema = z.object({
  q: z.string().min(1),
  a: z.string().min(1),
});

export const landingHeroSchema = z.object({
  badge: z.string().default("Control horario fácil y legal"),
  titleMain: z.string().default("Controla los horarios de tu equipo"),
  titleHighlight: z.string().default("sin complicaciones"),
  subtitle: z
    .string()
    .default(
      "Tus empleados fichan desde el móvil, tablet o PC. Tú tienes un panel claro con seguimiento en vivo, informes y vacaciones."
    ),
  ctaWhatsappLabel: z.string().default("Pedir demo por WhatsApp"),
  ctaTrialLabel: z.string().default("Empezar prueba gratis"),
  ctaSecondaryLabel: z.string().default("Ver cómo funciona"),
  trustBadges: z.array(z.string().min(1)).min(1).max(6),
  footerTitle: z
    .string()
    .default("Empieza a controlar los horarios de tu equipo hoy mismo"),
  footerSubtitle: z
    .string()
    .default("Regístrate en minutos o contacta con nosotros para una demo personalizada."),
  footerCtaRegisterLabel: z.string().default("Crear cuenta gratis"),
});

export const landingPageConfigSchema = z.object({
  whatsappNumber: z.string().default(""),
  trialDays: z.number().int().min(0).default(14),
  trialHeadline: z.string().default("14 días de prueba gratis"),
  hero: landingHeroSchema,
  faqs: z.array(landingFaqSchema).min(1).max(20),
  pricingPacks: z.array(landingPricingPackSchema).length(3),
  audienceImages: z.array(landingAudienceSchema).length(6),
});

export type LandingPricingPack = z.infer<typeof landingPricingPackSchema>;
export type LandingAudience = z.infer<typeof landingAudienceSchema>;
export type LandingFaq = z.infer<typeof landingFaqSchema>;
export type LandingHero = z.infer<typeof landingHeroSchema>;
export type LandingPageConfig = z.infer<typeof landingPageConfigSchema>;

const DEFAULT_FAQS: LandingFaq[] = [
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
    a: "Sí. Regístrate gratis con {trialDays} días de prueba o pide una demo por WhatsApp.",
  },
];

const DEFAULT_HERO: LandingHero = {
  badge: "Control horario fácil y legal",
  titleMain: "Controla los horarios de tu equipo",
  titleHighlight: "sin complicaciones",
  subtitle:
    "Tus empleados fichan desde el móvil, tablet o PC. Tú tienes un panel claro con seguimiento en vivo, informes y vacaciones.",
  ctaWhatsappLabel: "Pedir demo por WhatsApp",
  ctaTrialLabel: "Empezar prueba gratis",
  ctaSecondaryLabel: "Ver cómo funciona",
  trustBadges: ["Sin papel", "Sin instalaciones", "Siempre accesible"],
  footerTitle: "Empieza a controlar los horarios de tu equipo hoy mismo",
  footerSubtitle: "Regístrate en minutos o contacta con nosotros para una demo personalizada.",
  footerCtaRegisterLabel: "Crear cuenta gratis",
};

export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  whatsappNumber: "",
  trialDays: 14,
  trialHeadline: "14 días de prueba gratis",
  hero: DEFAULT_HERO,
  faqs: DEFAULT_FAQS,
  pricingPacks: [
    {
      id: "starter",
      name: "Starter",
      price: "19€",
      priceSuffix: "/mes",
      description: "Para equipos pequeños que empiezan con el control horario digital.",
      features: [
        "Hasta 10 empleados",
        "Fichaje móvil y PC",
        "Panel admin y dashboard",
        "Informes básicos",
        "Soporte por email",
      ],
      ctaLabel: "Empezar prueba",
    },
    {
      id: "pro",
      name: "Pro",
      price: "29€",
      priceSuffix: "/mes",
      description: "El plan más elegido para negocios en crecimiento.",
      features: [
        "Hasta 50 empleados",
        "Geolocalización GPS",
        "Vacaciones e incidencias",
        "Informes PDF y Excel",
        "Soporte prioritario",
      ],
      highlighted: true,
      ctaLabel: "Pedir demo",
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "79€",
      priceSuffix: "/mes",
      description: "Para cadenas y empresas con varios centros o muchos empleados.",
      features: [
        "Empleados ilimitados",
        "Multi-sede (próximamente)",
        "Auditoría y RGPD",
        "Onboarding asistido",
        "Soporte dedicado",
      ],
      ctaLabel: "Contactar",
    },
  ],
  audienceImages: [
    {
      id: "restaurants",
      label: "Restaurantes y bares",
      imageUrl:
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "shops",
      label: "Tiendas y comercios",
      imageUrl:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "salons",
      label: "Peluquerías y estética",
      imageUrl:
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "workshops",
      label: "Talleres y servicios",
      imageUrl:
        "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "offices",
      label: "Oficinas y equipos",
      imageUrl:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "gyms",
      label: "Gimnasios y centros",
      imageUrl:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
    },
  ],
};

export function mergeLandingPageConfig(
  partial: Partial<LandingPageConfig> | null | undefined
): LandingPageConfig {
  if (!partial) return landingPageConfigSchema.parse(DEFAULT_LANDING_PAGE_CONFIG);
  return landingPageConfigSchema.parse({
    ...DEFAULT_LANDING_PAGE_CONFIG,
    ...partial,
    hero: {
      ...DEFAULT_HERO,
      ...(partial.hero ?? {}),
      trustBadges:
        partial.hero?.trustBadges && partial.hero.trustBadges.length > 0
          ? partial.hero.trustBadges
          : DEFAULT_HERO.trustBadges,
    },
    faqs: partial.faqs && partial.faqs.length > 0 ? partial.faqs : DEFAULT_FAQS,
    pricingPacks:
      partial.pricingPacks?.length === 3
        ? partial.pricingPacks
        : DEFAULT_LANDING_PAGE_CONFIG.pricingPacks,
    audienceImages:
      partial.audienceImages?.length === 6
        ? partial.audienceImages
        : DEFAULT_LANDING_PAGE_CONFIG.audienceImages,
  });
}

/** Sustituye `{trialDays}` en respuestas FAQ por el valor configurado. */
export function resolveFaqAnswer(answer: string, trialDays: number): string {
  return answer.replace(/\{trialDays\}/g, String(trialDays));
}

export function buildWhatsAppHref(number: string, message: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
