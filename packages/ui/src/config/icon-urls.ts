const SKILL_ICON_BASE_URL = import.meta.env.VITE_SKILL_ICON_BASE_URL;
const ITEM_ICON_BASE_URL = import.meta.env.VITE_ITEM_ICON_BASE_URL;
const SLOT_ICON_BASE_URL = import.meta.env.VITE_SLOT_ICON_BASE_URL;
const ACTION_ICON_BASE_URL = import.meta.env.VITE_ACTION_ICON_BASE_URL;
const CLASS_ICON_BASE_URL = import.meta.env.VITE_CLASS_ICON_BASE_URL;
const RACE_ICON_BASE_URL = import.meta.env.VITE_RACE_ICON_BASE_URL;

const ITEM_ID_TO_ICON_MAP: Record<string | number, string> = {};
const SLOT_ID_TO_ICON_MAP: Record<string | number, string> = {};
const SKILL_ID_TO_ICON_MAP: Record<string | number, string> = {};
const ACTION_ID_TO_ICON_MAP: Record<string | number, string> = {};
const CLASS_ID_TO_ICON_MAP: Record<string | number, string> = {};
const RACE_ID_TO_ICON_MAP: Record<string | number, string> = {};

export const loadIconMaps = async () => {
  const makeIndexUrl = (baseUrl: string, indexFile: string) => {
    if (isNil(baseUrl) || isNil(indexFile)) {
      return undefined;
    }

    return baseUrl.endsWith("/")
      ? baseUrl + indexFile
      : `${baseUrl}/${indexFile}`;
  };

  const indexFiles = [
    {
      baseUrl: SKILL_ICON_BASE_URL,
      indexFile: "index.json",
      map: SKILL_ID_TO_ICON_MAP,
    },
    {
      baseUrl: ITEM_ICON_BASE_URL,
      indexFile: "index.json",
      map: ITEM_ID_TO_ICON_MAP,
    },
    {
      baseUrl: ACTION_ICON_BASE_URL,
      indexFile: "index.json",
      map: ACTION_ID_TO_ICON_MAP,
    },
    {
      baseUrl: CLASS_ICON_BASE_URL,
      indexFile: "index.json",
      map: CLASS_ID_TO_ICON_MAP,
    },
  ];

  for (const { baseUrl, indexFile, map } of indexFiles) {
    if (!baseUrl) {
      console.warn(
        `Base URL for ${indexFile} is not set in env, skipping icon map load.`
      );
      continue;
    }

    const indexUrl = makeIndexUrl(baseUrl, indexFile);

    if (!indexUrl) continue;

    try {
      const response = await fetch(indexUrl);
      if (!response.ok) {
        console.warn(
          `Failed to fetch icon index from ${indexUrl}: ${response.status} ${response.statusText}`
        );
        continue;
      }
      const data = await response.json();
      Object.assign(map, data);
    } catch (error) {
      console.error(`Error loading icon index from ${indexUrl}:`, error);
    }
  }
};

const isNil = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

function buildIconUrl(
  baseUrl: string | undefined,
  file: string | number | undefined
): string | undefined {
  if (isNil(baseUrl) || isNil(file)) return undefined;
  return baseUrl.endsWith("/") ? baseUrl + file : `${baseUrl}/${file}`;
}

/** Icon URL by skill.id. */
export function getSkillIconUrl(
  skillId: string | number | undefined
): string | undefined {
  if (isNil(skillId) || Object.keys(SKILL_ID_TO_ICON_MAP).length === 0) return undefined;
  return buildIconUrl(SKILL_ICON_BASE_URL, SKILL_ID_TO_ICON_MAP[skillId]);
}

/** Icon URL by item.id. */
export function getItemIconUrl(
  itemId: string | number | undefined
): string | undefined {
  if (isNil(itemId) || Object.keys(ITEM_ID_TO_ICON_MAP).length === 0) return undefined;
  return buildIconUrl(ITEM_ICON_BASE_URL, ITEM_ID_TO_ICON_MAP[itemId]);
}

/** Icon URL by action id -- covers action, pet-action, pair-action and party action. Action icon filenames are zero-padded to 3 digits (e.g. "005.png"), unlike skill/item/class ids. */
export function getActionIconUrl(
  actionId: string | number | undefined
): string | undefined {
  if (isNil(actionId) || Object.keys(ACTION_ID_TO_ICON_MAP).length === 0) return undefined;
  return buildIconUrl(ACTION_ICON_BASE_URL, ACTION_ID_TO_ICON_MAP[actionId]);
}

/** Icon URL by char.baseClassId / char.classId. */
export function getClassIconUrl(
  classId: string | number | undefined
): string | undefined {
  if (isNil(classId) || Object.keys(CLASS_ID_TO_ICON_MAP).length === 0) return undefined;
  return buildIconUrl(CLASS_ICON_BASE_URL, CLASS_ID_TO_ICON_MAP[classId]);
}

/** Icon URL by char.race */
export function getRaceIconUrl(
  raceId: string | number | undefined
): string | undefined {
  if (isNil(raceId) || Object.keys(RACE_ID_TO_ICON_MAP).length === 0) return undefined;
  return buildIconUrl(RACE_ICON_BASE_URL, RACE_ID_TO_ICON_MAP[raceId]);
}

/** Icon URL by slot.id */
export function getSlotIconUrl(
  slotId: string | number | undefined
): string | undefined {
  if (isNil(slotId) || Object.keys(SLOT_ID_TO_ICON_MAP).length === 0) return undefined;
  return buildIconUrl(SLOT_ICON_BASE_URL, SLOT_ID_TO_ICON_MAP[slotId]);
}
