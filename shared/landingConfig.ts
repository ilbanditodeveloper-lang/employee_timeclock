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

export const landingPageConfigSchema = z.object({
  whatsappNumber: z.string().default(""),
  trialDays: z.number().int().min(0).default(14),
  trialHeadline: z.string().default("14 días de prueba gratis"),
  pricingPacks: z.array(landingPricingPackSchema).length(3),
  audienceImages: z.array(landingAudienceSchema).length(6),
});

export type LandingPricingPack = z.infer<typeof landingPricingPackSchema>;
export type LandingAudience = z.infer<typeof landingAudienceSchema>;
export type LandingPageConfig = z.infer<typeof landingPageConfigSchema>;

export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  whatsappNumber: "",
  trialDays: 14,
  trialHeadline: "14 días de prueba gratis",
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
  if (!partial) return { ...DEFAULT_LANDING_PAGE_CONFIG };
  return landingPageConfigSchema.parse({
    ...DEFAULT_LANDING_PAGE_CONFIG,
    ...partial,
    pricingPacks: partial.pricingPacks ?? DEFAULT_LANDING_PAGE_CONFIG.pricingPacks,
    audienceImages: partial.audienceImages ?? DEFAULT_LANDING_PAGE_CONFIG.audienceImages,
  });
}

export function buildWhatsAppHref(number: string, message: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
