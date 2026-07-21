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
const ITEM_NAME_PREFIX = "item.name.";
const SKILL_NAME_PREFIX = "skill.name.";
const ACTION_NAME_PREFIX = "action.name.";

export function translate(
  key: string,
  params?: { [key: string]: string | number | boolean | null | undefined }
): string {
  // Special case: item/skill names come from lazily-fetched id->name tables
  // (see UiStore.loadItemNames()/loadSkillNames()), not the static
  // per-language dictionaries below -- the wire protocol never sends these
  // as strings (only numeric ids), so there's nothing to look up in LANGS.
  if (key.startsWith(ITEM_NAME_PREFIX)) {
    const itemId = key.slice(ITEM_NAME_PREFIX.length);
    return rootStore.ui.itemNames[itemId] || key;
  }
  if (key.startsWith(SKILL_NAME_PREFIX)) {
    const skillId = key.slice(SKILL_NAME_PREFIX.length);
    return rootStore.ui.skillNames[skillId] || key;
  }
  if (key.startsWith(ACTION_NAME_PREFIX)) {
    const actionId = key.slice(ACTION_NAME_PREFIX.length);
    return rootStore.ui.actionNames[actionId] || key;
  }

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
