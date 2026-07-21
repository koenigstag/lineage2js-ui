import { rootStore } from "../stores/RootStore";
import { LANG_EN_US } from "./en_US";
import { LANG_RU_RU } from "./ru_RU";

export type LANG = "en" | "ru";

export const LANG_LABELS: Record<LANG, string> = {
  en: "English",
  ru: "Русский",
};

export type LangDictionary = Record<
  string,
  | string
  | {
      [key: string]: string | LangDictionary;
    }
>;

export const LANGS: Record<LANG, LangDictionary> = {
  en: LANG_EN_US,
  ru: LANG_RU_RU,
};

export const LANG_DEFAULT: LANG = "en";

// Ported from https://github.com/koenigstag/cooking-advisor's script/lang/lang.ts,
// rewired to read the current language from UiStore (this project's MobX
// equivalent of that app's `window.__appState()`) instead of a plain global.
export function translate(
  key: string,
  params?: { [key: string]: string | number | boolean | null | undefined }
): string {
  const parts = key.split(".");

  const currentLang = rootStore.ui.lang || LANG_DEFAULT;

  let dict: LangDictionary = LANGS[currentLang];
  let translation: string | undefined;

  for (const part of parts) {
    if (dict && part in dict) {
      if (typeof dict[part] === "string") {
        translation = dict[part] as string;
      } else if (typeof dict[part] === "object") {
        dict = dict[part] as LangDictionary;
      }
    }
  }

  if (params && translation) {
    for (const [paramKey, value] of Object.entries(params)) {
      if (value == null) continue;
      translation = translation.replace(`{${paramKey}}`, String(value));
    }
  }

  // fallback to the key itself if the translation isn't found
  return translation || key;
}

export const t = translate;
