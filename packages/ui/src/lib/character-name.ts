// Client-side mirror of the server's character-name rules, so an obviously
// bad name gets a message right away instead of a round-trip ending in a
// generic CharCreateFail. The server stays authoritative -- deliberately only
// as strict as every server is, never stricter.

export const MIN_CHARACTER_NAME_LENGTH = 1;
export const MAX_CHARACTER_NAME_LENGTH = 16;

/**
 * Letters and digits only, in any script -- no spaces, punctuation or symbols.
 *
 * This is the strictest rule we can apply without guessing at server config.
 * L2J_Mobius requires isAlphaNumeric() (Java's Character.isLetterOrDigit,
 * which is Unicode-aware, so "Тест" passes) and defaults CnameTemplate to
 * `.*`; lineage2ts applies PlayerNameTemplate, whose shipped default is the
 * far narrower `[a-zA-Z0-9]*`. Since that template is per-server config,
 * hardcoding ASCII-only here would reject names some servers accept -- when a
 * server does run the narrower template, its own CharCreateFail carries the
 * message instead.
 */
const ALLOWED_NAME_PATTERN = /^[\p{L}\p{N}]+$/u;

export type CharacterNameError = "length" | "characters" | "taken";

/**
 * Returns why `name` is unacceptable, or undefined when it looks valid.
 * `existingNames` are the account's current characters -- the server also
 * rejects names taken by *other* accounts, which only it can know about.
 */
export function validateCharacterName(name: string, existingNames: string[]): CharacterNameError | undefined {
  const trimmed = name.trim();

  if (trimmed.length < MIN_CHARACTER_NAME_LENGTH || trimmed.length > MAX_CHARACTER_NAME_LENGTH) {
    return "length";
  }

  if (!ALLOWED_NAME_PATTERN.test(trimmed)) {
    return "characters";
  }

  // Character names are case-insensitively unique server-side.
  const taken = existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());
  if (taken) {
    return "taken";
  }

  return undefined;
}
