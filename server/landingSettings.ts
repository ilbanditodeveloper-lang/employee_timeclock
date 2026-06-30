import {
  DEFAULT_LANDING_PAGE_CONFIG,
  LANDING_SETTINGS_KEY,
  type LandingPageConfig,
  landingPageConfigSchema,
  mergeLandingPageConfig,
} from "@shared/landingConfig";
import { getDb } from "./db";
import { platformSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { isDemoRequestActive } from "./demo/mode";

let demoLandingConfig: LandingPageConfig = { ...DEFAULT_LANDING_PAGE_CONFIG };

export function getDemoLandingPageConfig(): LandingPageConfig {
  return mergeLandingPageConfig(demoLandingConfig);
}

export function setDemoLandingPageConfig(config: LandingPageConfig): LandingPageConfig {
  demoLandingConfig = landingPageConfigSchema.parse(config);
  return demoLandingConfig;
}

export async function getLandingPageConfig(): Promise<LandingPageConfig> {
  if (isDemoRequestActive()) {
    return getDemoLandingPageConfig();
  }
  const db = await getDb();
  if (!db) return mergeLandingPageConfig(null);
  const rows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, LANDING_SETTINGS_KEY))
    .limit(1);
  const stored = rows[0]?.value as Partial<LandingPageConfig> | undefined;
  return mergeLandingPageConfig(stored);
}

export async function saveLandingPageConfig(config: LandingPageConfig): Promise<LandingPageConfig> {
  const parsed = landingPageConfigSchema.parse(config);
  if (isDemoRequestActive()) {
    return setDemoLandingPageConfig(parsed);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(platformSettings)
    .values({
      key: LANDING_SETTINGS_KEY,
      value: parsed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: parsed,
        updatedAt: new Date(),
      },
    });
  return parsed;
}
