import type { AppLocale, TranslationTree } from "./types";
import { es } from "./locales/es/index";
import { en } from "./locales/en/index";

const catalogs: Record<AppLocale, TranslationTree> = { es, en };

function getNested(tree: TranslationTree | undefined, path: string): string | undefined {
  const parts = path.split(".");
  let current: TranslationTree | string | undefined = tree;
  for (const part of parts) {
    if (!current || typeof current === "string") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const primary = getNested(catalogs[locale], key);
  const fallback = locale !== "es" ? getNested(catalogs.es, key) : undefined;
  let value = primary ?? fallback ?? key;

  if (params) {
    for (const [name, val] of Object.entries(params)) {
      value = value.replaceAll(`{{${name}}}`, String(val));
    }
  }
  return value;
}
