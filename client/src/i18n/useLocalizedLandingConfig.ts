import { useMemo } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  localizeAudienceForEn,
  localizePricingPacksForEn,
} from "@/i18n/landingEnOverrides";
import {
  type LandingFaq,
  type LandingPageConfig,
} from "@shared/landingConfig";

const EN_FAQS: LandingFaq[] = [
  {
    q: "Do employees need to install an app?",
    a: "No. TimeClock runs in the mobile or desktop browser. They can add a shortcut to the home screen like an app.",
  },
  {
    q: "Can I view clock-ins from my phone?",
    a: "Yes. The admin panel is responsive and the live dashboard updates in real time.",
  },
  {
    q: "Is it valid for time tracking in Spain?",
    a: "It records clock-ins, breaks, and incidents with audit trails. Reports help meet working-time record requirements.",
  },
  {
    q: "Is geolocation mandatory?",
    a: "It is optional per company. You can enable GPS validation with a configurable radius around the workplace.",
  },
  {
    q: "Can I try it before subscribing?",
    a: "Yes. Register free for a trial period or contact us on WhatsApp for a demo.",
  },
];

/** Localized landing: EN uses i18n fallbacks for hero/FAQs; ES uses API/CMS config. */
export function useLocalizedLandingConfig(apiConfig: LandingPageConfig): LandingPageConfig {
  const { locale, t } = useLocale();

  return useMemo(() => {
    if (locale === "es") return apiConfig;

    return {
      ...apiConfig,
      trialHeadline: t("auth.register.trialHeadlineFallback", { days: String(apiConfig.trialDays) }),
      hero: {
        ...apiConfig.hero,
        badge: t("landing.hero.badgeFallback"),
        titleMain: t("landing.hero.titleMainFallback"),
        titleHighlight: t("landing.hero.titleHighlightFallback"),
        subtitle: t("landing.hero.subtitleFallback"),
        ctaWhatsappLabel: t("landing.nav.registerFull"),
        ctaTrialLabel: t("landing.nav.registerFull"),
        ctaSecondaryLabel: t("landing.hero.ctaSecondaryFallback"),
        footerTitle: t("landing.hero.footerTitleFallback"),
        footerSubtitle: t("landing.hero.footerSubtitleFallback"),
        footerCtaRegisterLabel: t("landing.hero.footerCtaRegisterFallback"),
        trustBadges: [
          t("landing.hero.trustNoPaper"),
          t("landing.hero.trustNoInstall"),
          t("landing.hero.trustAccessible"),
        ],
      },
      faqs: EN_FAQS,
      pricingPacks: localizePricingPacksForEn(apiConfig.pricingPacks),
      audienceImages: localizeAudienceForEn(apiConfig.audienceImages),
    };
  }, [apiConfig, locale, t]);
}
