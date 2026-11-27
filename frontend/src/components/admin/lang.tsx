"use client";

import { createContext, useContext, type ReactNode } from "react";

type Lang = "ar" | "en";

const Context = createContext<Lang>("ar");

export function AdminLang({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Context.Provider value={lang}>{children}</Context.Provider>;
}

/** Dashboard wording: `tr(arabic, english)`, plus numbers in the same language. */
export function useAdmin() {
  const lang = useContext(Context);
  const locale = lang === "ar" ? "ar-EG" : "en";
  return {
    lang,
    locale,
    tr: (ar: string, en: string) => (lang === "ar" ? ar : en),
    num: (value: number) => value.toLocaleString(locale),
  };
}
