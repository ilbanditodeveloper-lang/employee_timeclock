import type { LandingAudience, LandingPricingPack } from "@shared/landingConfig";

/** English copy for CMS landing pricing packs (keyed by pack id). Prices come from API. */
export const EN_PRICING_PACK_OVERRIDES: Record<
  string,
  Pick<LandingPricingPack, "name" | "description" | "features" | "ctaLabel" | "priceSuffix">
> = {
  starter: {
    name: "Micro",
    description: "All features active for teams of up to 10 people.",
    features: [
      "Up to 10 employees",
      "GPS and geolocation INCLUDED",
      "Time off and incidents INCLUDED",
      "Legal reports and audit",
      "Mobile app and push notifications",
    ],
    ctaLabel: "Try free for 14 days",
    priceSuffix: "/month",
  },
  pro: {
    name: "Growing business",
    description:
      "Growing company up to 50 employees (+€5 per employee from employee 11).",
    features: [
      "Everything in Micro INCLUDED",
      "Priority support and inquiries",
      "Multiple locations INCLUDED",
      "Languages and business formats",
    ],
    ctaLabel: "Try free for 14 days",
    priceSuffix: "/month",
  },
  enterprise: {
    name: "Enterprise",
    description: "Custom plan (+€4 per employee from employee 51) up to 1,000 employees.",
    features: [
      "Everything in Growing business INCLUDED",
      "Implementation and setup included",
      "API for integrations",
      "White-label (optional)",
    ],
    ctaLabel: "Try free for 14 days",
    priceSuffix: "/month",
  },
};

export const EN_AUDIENCE_LABELS: Record<string, string> = {
  restaurants: "Restaurants and bars",
  shops: "Shops and retail",
  salons: "Hair salons and beauty",
  workshops: "Workshops and services",
  offices: "Offices and teams",
  gyms: "Gyms and fitness centers",
};

export function localizePricingPacksForEn(
  packs: LandingPricingPack[]
): LandingPricingPack[] {
  return packs.map((pack) => {
    const en = EN_PRICING_PACK_OVERRIDES[pack.id];
    if (!en) {
      return { ...pack, priceSuffix: "/month" };
    }
    return {
      ...pack,
      name: en.name,
      description: en.description,
      features: en.features,
      ctaLabel: en.ctaLabel,
      priceSuffix: en.priceSuffix,
    };
  });
}

export function localizeAudienceForEn(audience: LandingAudience[]): LandingAudience[] {
  return audience.map((item) => ({
    ...item,
    label: EN_AUDIENCE_LABELS[item.id] ?? item.label,
  }));
}
