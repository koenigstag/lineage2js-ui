// Base URLs are provided via env, e.g. "https://cdn.example.com/icons/skill/{id}.png".
// The "{id}" placeholder gets replaced with the actual skill/item/action/class id.
const SKILL_ICON_BASE_URL = import.meta.env.VITE_SKILL_ICON_BASE_URL;
const ITEM_ICON_BASE_URL = import.meta.env.VITE_ITEM_ICON_BASE_URL;
const ACTION_ICON_BASE_URL = import.meta.env.VITE_ACTION_ICON_BASE_URL;
const CLASS_ICON_BASE_URL = import.meta.env.VITE_CLASS_ICON_BASE_URL;

function buildIconUrl(baseUrl: string | undefined, id: string | number | undefined): string | undefined {
  if (!baseUrl || id === undefined) {
    return undefined;
  }
  return baseUrl.replace("{id}", String(id));
}

/** Icon URL by skill.id. */
export function getSkillIconUrl(skillId: string | number | undefined): string | undefined {
  return buildIconUrl(SKILL_ICON_BASE_URL, skillId);
}

/** Icon URL by item.id. */
export function getItemIconUrl(itemId: string | number | undefined): string | undefined {
  return buildIconUrl(ITEM_ICON_BASE_URL, itemId);
}

/** Icon URL by action id -- covers action, pet-action, pair-action and party action. Action icon filenames are zero-padded to 3 digits (e.g. "005.png"), unlike skill/item/class ids. */
export function getActionIconUrl(actionId: string | number | undefined): string | undefined {
  if (actionId === undefined) {
    return undefined;
  }
  return buildIconUrl(ACTION_ICON_BASE_URL, String(actionId).padStart(3, "0"));
}

/** Icon URL by char.baseClassId / char.classId. */
export function getClassIconUrl(classId: string | number | undefined): string | undefined {
  return buildIconUrl(CLASS_ICON_BASE_URL, classId);
}
