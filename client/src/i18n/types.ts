export type AppLocale = "es" | "en";

export const APP_LOCALES: AppLocale[] = ["es", "en"];

export const LOCALE_STORAGE_KEY = "timeclock-locale";

export type TranslationValue = string | TranslationTree;

export type TranslationTree = {
  [key: string]: TranslationValue;
};
