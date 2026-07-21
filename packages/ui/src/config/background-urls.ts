// Base URL is provided via env, e.g. "http://localhost:4000/legacy/images/titlescreens/{id}.jpg".
// "{id}" is replaced with a random number in [1, VITE_LOGIN_BACKGROUND_COUNT].
const LOGIN_BACKGROUND_BASE_URL = import.meta.env.VITE_LOGIN_BACKGROUND_BASE_URL;
const LOGIN_BACKGROUND_COUNT = Number(import.meta.env.VITE_LOGIN_BACKGROUND_COUNT ?? 0);

/** Random login background URL served by the assets server, or undefined if not configured. */
export function getRandomLoginBackgroundUrl(): string | undefined {
  if (!LOGIN_BACKGROUND_BASE_URL || LOGIN_BACKGROUND_COUNT <= 0) {
    return undefined;
  }

  const id = 1 + Math.floor(Math.random() * LOGIN_BACKGROUND_COUNT);
  return LOGIN_BACKGROUND_BASE_URL.replace("{id}", String(id));
}
