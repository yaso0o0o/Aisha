import "server-only";

const dictionaries = {
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export type Locale = keyof typeof dictionaries;
export const locales = Object.keys(dictionaries) as Locale[];
export const hasLocale = (value: string): value is Locale =>
  Object.hasOwn(dictionaries, value);
export const getDictionary = (locale: Locale) => dictionaries[locale]();
