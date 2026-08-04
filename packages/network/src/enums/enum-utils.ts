/**
 * Reliable numeric-value -> key-name lookup for a TS numeric enum.
 *
 * Built by keeping only the enum object's forward (name -> number) entries
 * and flipping them, rather than indexing the enum object directly
 * (`SomeEnum[value]`) at each call site -- that silently returns `undefined`
 * for any out-of-range number with no compile-time signal, and its
 * auto-generated reverse-mapping entries (`SomeEnum[0]`, `SomeEnum[1]`, ...)
 * are otherwise indistinguishable from the forward ones when iterating the
 * object (`Object.keys`/`Object.entries` mixes both directions together).
 * Call once per enum and reuse the resulting map.
 */
export function reverseEnumMap<E extends Record<string, number | string>>(
  enumObject: E
): ReadonlyMap<number, Extract<keyof E, string>> {
  const map = new Map<number, Extract<keyof E, string>>();
  for (const [key, value] of Object.entries(enumObject)) {
    if (typeof value === "number") {
      map.set(value, key as Extract<keyof E, string>);
    }
  }
  return map;
}
